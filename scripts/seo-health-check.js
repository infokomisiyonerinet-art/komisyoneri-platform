#!/usr/bin/env node
// Lightweight SEO health check — run manually or wire into CI.
// Verifies robots.txt, sitemap.xml, and index.html's SEO tags all agree
// on the same production domain, and that no stale placeholder domains
// have crept back in. Exits non-zero on failure so it can gate a deploy.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOMAIN = 'https://komisiyoneri.co.rw';
const STALE_DOMAINS = ['komisyoneri-platform-nu.vercel.app', 'www.komisiyoneri.com'];

let failures = 0;
function check(label, condition) {
  if (condition) {
    console.log('  [OK] ' + label);
  } else {
    console.log('  [FAIL] ' + label);
    failures++;
  }
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

console.log('KOMISIYONERI SEO health check\n');

const robots = read('robots.txt');
console.log('robots.txt:');
check('Sitemap directive points at production domain', robots.includes('Sitemap: ' + DOMAIN + '/sitemap.xml'));
check('No stale placeholder domains present', !STALE_DOMAINS.some(function (d) { return robots.includes(d); }));

const sitemap = read('sitemap.xml');
console.log('sitemap.xml:');
check('Contains at least one <loc> on the production domain', sitemap.includes('<loc>' + DOMAIN));
check('No stale placeholder domains present', !STALE_DOMAINS.some(function (d) { return sitemap.includes(d); }));
check('Well-formed XML (has matching <urlset> tags)', /<urlset[\s\S]*<\/urlset>/.test(sitemap));

const html = read('index.html');
console.log('index.html:');
check('Canonical link points at production domain', html.includes('<link rel="canonical" href="' + DOMAIN + '/">'));
check('Open Graph og:url points at production domain', html.includes('<meta property="og:url" content="' + DOMAIN + '/">'));
check('JSON-LD structured data present', html.includes('application/ld+json'));
check('FAQPage structured data present', html.includes('"@type": "FAQPage"'));
check('No stale placeholder domains present', !STALE_DOMAINS.some(function (d) { return html.includes(d); }));

const llms = fs.existsSync(path.join(ROOT, 'llms.txt'));
console.log('llms.txt:');
check('File exists for AI/LLM discoverability', llms);

console.log('\n' + (failures === 0 ? 'All checks passed.' : failures + ' check(s) failed.'));
process.exit(failures === 0 ? 0 : 1);
