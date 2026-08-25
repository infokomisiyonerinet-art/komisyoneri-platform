#!/usr/bin/env node
// Regenerates sitemap.xml from the canonical list of public, crawlable
// routes, plus one entry per approved, active property listing.
//
// Before this fix, zero /property/{id} URLs existed anywhere — not in
// this sitemap, and not as a crawlable <a href> on any property card
// (cards are onclick-only divs, unchanged by this fix — that's a
// separate, larger navigation change). The sitemap entry alone gives
// Google's crawler a discovery path to /property/:id, which is already a
// fully SEO-optimized, working route (api/property-og.js + vercel.json
// rewrite already serve proper bot-facing HTML there).
//
// Per-property path format matches _propShareUrl(prop.id) in index.html
// exactly: /property/{id}. Approved/active filter matches
// loadApprovedProperties()'s query in index.html: status in
// ['approved', 'Approved'], then isActive !== false client-side — minus
// that function's 60-doc UI page cap, since a sitemap should cover the
// full catalog, not one paginated screen of it.
//
// This script is run MANUALLY today — there is no schedule, CI step, or
// deploy hook invoking it (checked: no reference to it in vercel.json or
// any workflow in this repo). Wiring it into an automated schedule is a
// separate fast-follow, not part of this fix.
//
// Usage:
//   node scripts/generate-sitemap.js --static-only
//     Regenerates only the 8 static marketing routes below — no Firestore
//     access, no credentials needed. Useful when just editing ROUTES.
//
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node scripts/generate-sitemap.js --project=<firebase-project-id>
//     Regenerates the 8 static routes plus one <url> per approved, active
//     property. This is the normal way to run it. If the property fetch
//     fails for any reason (bad/missing credentials, network, etc.), the
//     script aborts WITHOUT touching sitemap.xml — it never silently
//     writes a sitemap that's missing properties over one that already
//     has them.

const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://komisiyoneri.co.rw';

// Keep this in sync with the CLEAN_PATHS map in index.html's go() function.
// lastmod values match what's already live in sitemap.xml today — this
// script did not previously emit lastmod/hreflang at all (it had drifted
// out of sync with the hand-maintained live file, which already had both
// plus /analytics and /careers, missing here before this fix).
const ROUTES = [
  { path: '/', changefreq: 'daily', priority: '1.0', lastmod: '2026-07-21', hreflang: true },
  { path: '/listings', changefreq: 'hourly', priority: '0.9', lastmod: '2026-07-21' },
  { path: '/analytics', changefreq: 'daily', priority: '0.7', lastmod: '2026-07-21' },
  { path: '/agents', changefreq: 'daily', priority: '0.7', lastmod: '2026-07-21' },
  { path: '/about', changefreq: 'monthly', priority: '0.6', lastmod: '2026-07-21' },
  { path: '/careers', changefreq: 'weekly', priority: '0.5', lastmod: '2026-07-21' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3', lastmod: '2026-07-21' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3', lastmod: '2026-07-21' },
];

function routeUrlXml(r) {
  var hreflangXml = '';
  if (r.hreflang) {
    hreflangXml =
      '    <xhtml:link rel="alternate" hreflang="rw" href="' + DOMAIN + '/?lang=rw"/>\n' +
      '    <xhtml:link rel="alternate" hreflang="en" href="' + DOMAIN + '/?lang=en"/>\n' +
      '    <xhtml:link rel="alternate" hreflang="x-default" href="' + DOMAIN + '/"/>\n';
  }
  return (
    '  <url>\n' +
    '    <loc>' + DOMAIN + r.path + '</loc>\n' +
    hreflangXml +
    '    <lastmod>' + r.lastmod + '</lastmod>\n' +
    '    <changefreq>' + r.changefreq + '</changefreq>\n' +
    '    <priority>' + r.priority + '</priority>\n' +
    '  </url>'
  );
}

// Matches _propShareUrl(prop.id)'s format in index.html exactly.
function propertyUrlXml(prop, today) {
  return (
    '  <url>\n' +
    '    <loc>' + DOMAIN + '/property/' + encodeURIComponent(prop.id) + '</loc>\n' +
    '    <lastmod>' + (prop.lastmod || today) + '</lastmod>\n' +
    '    <changefreq>weekly</changefreq>\n' +
    '    <priority>0.8</priority>\n' +
    '  </url>'
  );
}

function buildSitemap(routes, properties) {
  var today = new Date().toISOString().slice(0, 10);
  var urls = routes.map(routeUrlXml)
    .concat(properties.map(function (p) { return propertyUrlXml(p, today); }))
    .join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n' +
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    urls + '\n' +
    '</urlset>\n';
}

function fetchProperties() {
  const admin = require('firebase-admin');
  const args = process.argv.slice(2);
  const projectArg = args.find(function (a) { return a.startsWith('--project='); });
  const projectId = projectArg ? projectArg.split('=')[1] : undefined;

  admin.initializeApp(projectId ? { projectId: projectId } : {});
  const db = admin.firestore();

  return db.collection('properties')
    .where('status', 'in', ['approved', 'Approved'])
    .get()
    .then(function (snap) {
      var out = [];
      snap.forEach(function (doc) {
        var data = doc.data();
        if (data.isActive === false) return;
        var ts = data.updatedAt || data.createdAt;
        out.push({
          id: doc.id,
          lastmod: ts && ts.toDate ? ts.toDate().toISOString().slice(0, 10) : null
        });
      });
      return out;
    });
}

function writeSitemap(properties) {
  const outPath = path.join(__dirname, '..', 'sitemap.xml');
  fs.writeFileSync(outPath, buildSitemap(ROUTES, properties));
  console.log('sitemap.xml regenerated with ' + ROUTES.length + ' static routes + ' +
    properties.length + ' propert' + (properties.length === 1 ? 'y' : 'ies') +
    ' at ' + outPath);
}

if (require.main === module) {
  if (process.argv.slice(2).includes('--static-only')) {
    writeSitemap([]);
  } else {
    fetchProperties()
      .then(writeSitemap)
      .catch(function (err) {
        console.error('ABORTED: could not fetch properties from Firestore — sitemap.xml left untouched.');
        console.error('Pass --static-only to regenerate the 8 marketing routes without Firestore access.');
        console.error(err.message || err);
        process.exitCode = 1;
      });
  }
}

module.exports = { buildSitemap, ROUTES };
