#!/usr/bin/env node
// Regenerates sitemap.xml from the canonical list of public, crawlable
// routes. Run manually (`node scripts/generate-sitemap.js`) after adding
// or removing a public marketing page. Pure Node, no dependencies —
// matches the project's no-bundler constraint.

const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://komisiyoneri.co.rw';

// Keep this in sync with the CLEAN_PATHS map in index.html's go() function.
const ROUTES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/listings', changefreq: 'hourly', priority: '0.9' },
  { path: '/agents', changefreq: 'daily', priority: '0.7' },
  { path: '/about', changefreq: 'monthly', priority: '0.6' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
];

function buildSitemap(routes) {
  const urls = routes.map(function (r) {
    return (
      '  <url>\n' +
      '    <loc>' + DOMAIN + r.path + '</loc>\n' +
      '    <changefreq>' + r.changefreq + '</changefreq>\n' +
      '    <priority>' + r.priority + '</priority>\n' +
      '  </url>'
    );
  }).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls + '\n' +
    '</urlset>\n';
}

const outPath = path.join(__dirname, '..', 'sitemap.xml');
fs.writeFileSync(outPath, buildSitemap(ROUTES));
console.log('sitemap.xml regenerated with ' + ROUTES.length + ' URLs at ' + outPath);
