// KOMISIYONERI — Site (New Development) Open Graph preview
//
// Vercel serverless function: serves a minimal, server-rendered HTML page
// with Open Graph / Twitter Card meta tags for a single site/{id}
// ("New Development") document. Sibling to api/property-og.js — same
// reasoning, same structure, same crawler-detection and Cache-Control
// rules — deliberately kept as its own file rather than folding a `type`
// branch into property-og.js: sites and properties have different
// Firestore schemas (bedrooms/area/category vs. totalPlots/
// pricePerSqm/status values 'active'/'pending_review') and different
// public-visibility rules, so a shared `type` switch would just relocate
// that divergence into one more-tangled file instead of removing it.
// property-og.js itself is intentionally left untouched by this change.
//
// Before this, sites had NO server-rendered route at all — only a
// client-side hash deep link (#site={id}, see index.html's
// _siteShareUrl()) — so a shared WhatsApp/Facebook link could never show
// that site's own photo/name/price: URL fragments are never sent to the
// server, so any OG function only ever sees the bare domain and falls
// back to the generic homepage tags.
//
// vercel.json rewrites EVERY /site/:id request here — unconditionally,
// for crawlers and humans alike, exactly like /property/:id.
//
// CRITICAL — mirrors the fix in PR #189 (api/property-og.js, "stop
// edge-caching bot OG preview responses"): every Cache-Control below is
// `private`, never `public`/`s-maxage`. There is no Vary: User-Agent on
// this response, so a `public` Cache-Control would let Vercel's shared
// edge cache store one requester's response (e.g. a bot's tiny OG-tag
// shell) and replay it to a completely different requester (e.g. the
// human who taps the link a moment later) for the same URL — which is
// exactly the bug that PR fixed for properties. `private` still lets each
// requester's own client cache its own response; it just never becomes
// one shared answer for everyone hitting this same /site/:id URL.
//
// Reads straight from Firestore's REST API using the same public web API
// key the client SDK itself uses in index.html — no service-account
// credentials needed, since rules/firestore.rules already allows
// unconditional public read on sites/{id}.

const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'komisyoneri-platform-prod';
const API_KEY = 'AIzaSyCw9NYlw0XLC26Di-nFCNOuL7D6RX8k820';
const SITE_URL = 'https://komisiyoneri.co.rw';
const DEFAULT_IMAGE = SITE_URL + '/images/kigali-skyline.jpg';

// Identical to api/property-og.js's own list/logic — see that file's
// comment for why each part exists (in particular, why WhatsApp's own
// in-app browser UA must NOT match this despite containing "WhatsApp").
const LIGHTWEIGHT_BOT_RE = /facebookexternalhit|Facebot|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|redditbot|Pinterest|Applebot|SkypeUriPreview|vkShare|W3C_Validator/i;
const GOOGLE_BOT_RE = /Googlebot|Google-InspectionTool|GoogleOther/i;
const REAL_BROWSER_ENGINE_RE = /Chrome\/|CriOS\/|FxiOS\/|Firefox\//i;

function isCrawlerRequest(ua) {
  ua = ua || '';
  if (GOOGLE_BOT_RE.test(ua)) return true;
  if (LIGHTWEIGHT_BOT_RE.test(ua)) return !REAL_BROWSER_ENGINE_RE.test(ua);
  return false;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Unwraps a Firestore REST API typed field into a plain JS value — see
// api/property-og.js's identical helper for why this is needed (the REST
// API's { fields: { key: { stringValue: '...' } } } shape, unlike the
// Admin/client SDKs).
function fv(fields, key) {
  var f = fields && fields[key];
  if (!f) return undefined;
  if ('stringValue' in f) return f.stringValue;
  if ('integerValue' in f) return parseInt(f.integerValue, 10);
  if ('doubleValue' in f) return f.doubleValue;
  if ('booleanValue' in f) return f.booleanValue;
  if ('arrayValue' in f) {
    var vals = (f.arrayValue && f.arrayValue.values) || [];
    return vals.map(function(v) {
      if ('stringValue' in v) return v.stringValue;
      if ('integerValue' in v) return parseInt(v.integerValue, 10);
      return null;
    }).filter(function(v) { return v !== null; });
  }
  return undefined;
}

// Matches renderSitesGrid()'s own priceRw computation in index.html: a
// per-m² range when both bounds are set, else the total site value, else
// "price on request" — never a fabricated number.
function fmtSitePrice(pricePerSqmMin, pricePerSqmMax, totalValueRWF) {
  var min = parseFloat(pricePerSqmMin) || 0;
  var max = parseFloat(pricePerSqmMax) || 0;
  if (min && max) {
    return 'RWF ' + Math.round(min / 1000) + 'K–' + Math.round(max / 1000) + 'K/m²';
  }
  var total = parseFloat(totalValueRWF) || 0;
  if (total) {
    if (total >= 1e9) return (total / 1e9).toFixed(1).replace('.0', '') + 'B RWF total';
    if (total >= 1e6) return Math.round(total / 1e6) + 'M RWF total';
    return total.toLocaleString('en-US') + ' RWF total';
  }
  return '';
}

// Identical to api/property-og.js's own helper — see that file's comment
// for why f_jpg (not f_auto) and why this only touches Cloudinary URLs.
function cloudinaryPreviewUrl(url) {
  if (typeof url !== 'string' || url.indexOf('res.cloudinary.com') === -1) return url;
  return url.replace('/upload/', '/upload/c_fill,w_1200,h_630,q_auto,f_jpg/');
}

function renderHtml(opts) {
  var title = escapeHtml(opts.title);
  var desc = escapeHtml(opts.desc);
  var image = escapeHtml(opts.image);
  var url = escapeHtml(opts.url);
  return '<!doctype html>\n<html lang="en"><head>\n'
    + '<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<title>' + title + '</title>\n'
    + '<meta name="description" content="' + desc + '">\n'
    + '<link rel="canonical" href="' + url + '">\n'
    + '<meta property="og:type" content="product">\n'
    + '<meta property="og:site_name" content="KOMISIYONERI Connectpro Services Ltd">\n'
    + '<meta property="og:title" content="' + title + '">\n'
    + '<meta property="og:description" content="' + desc + '">\n'
    + '<meta property="og:image" content="' + image + '">\n'
    + '<meta property="og:image:width" content="1200">\n'
    + '<meta property="og:image:height" content="630">\n'
    + '<meta property="og:url" content="' + url + '">\n'
    + '<meta name="twitter:card" content="summary_large_image">\n'
    + '<meta name="twitter:title" content="' + title + '">\n'
    + '<meta name="twitter:description" content="' + desc + '">\n'
    + '<meta name="twitter:image" content="' + image + '">\n'
    // Crawlers ignore this, but a human who follows a raw (non-JS) link to
    // this endpoint directly still lands on the real SPA page instead of
    // this bare preview shell.
    + '<meta http-equiv="refresh" content="0; url=' + url + '">\n'
    + '</head><body>\n'
    + '<p>' + title + ' — <a href="' + url + '">' + url + '</a></p>\n'
    + '</body></html>';
}

// Identical to api/property-og.js's own helper — reads index.html off disk
// (bundled via this function's own "includeFiles" entry in vercel.json)
// and serves it verbatim for a human visitor, so /site/{id} in the address
// bar is indistinguishable from Vercel's static hosting and the SPA's own
// router (checkUrlHash()) takes it from there via loadSitePlan().
var _indexHtmlCache = null;
function serveSpaShell(res) {
  try {
    if (!_indexHtmlCache) {
      _indexHtmlCache = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.status(200).end(_indexHtmlCache);
  } catch (err) {
    console.error('[site-og] failed to read index.html for a human visitor:', err.message);
    res.setHeader('Location', '/');
    return res.status(302).end();
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end('Method not allowed');
  }

  var ua = (req.headers && req.headers['user-agent']) || '';
  if (!isCrawlerRequest(ua)) {
    return serveSpaShell(res);
  }

  var id = req.query && req.query.id;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!id || typeof id !== 'string') {
    return res.status(400).end(renderHtml({
      title: 'KOMISIYONERI', desc: 'Rwanda Real Estate', image: DEFAULT_IMAGE, url: SITE_URL
    }));
  }

  var siteUrl = SITE_URL + '/site/' + encodeURIComponent(id);

  try {
    var apiUrl = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID
      + '/databases/(default)/documents/sites/' + encodeURIComponent(id)
      + '?key=' + API_KEY;
    var resp = await fetch(apiUrl);

    if (!resp.ok) {
      res.setHeader('Cache-Control', 'private, max-age=60');
      return res.status(resp.status === 404 ? 404 : 502).end(renderHtml({
        title: 'KOMISIYONERI', desc: 'Development site not found — view all new developments on KOMISIYONERI.',
        image: DEFAULT_IMAGE, url: siteUrl
      }));
    }

    var doc = await resp.json();
    var fields = doc.fields || {};

    var district = fv(fields, 'district') || '';
    var sector = fv(fields, 'sector') || '';
    // Matches _siteShareText()'s fallback in index.html — "New
    // Development" when a site has no explicit name.
    var title = fv(fields, 'name') || fv(fields, 'nameRW') || 'New Development';
    var price = fmtSitePrice(fv(fields, 'pricePerSqmMin'), fv(fields, 'pricePerSqmMax'), fv(fields, 'totalValueRWF'));
    var loc = [district, sector].filter(Boolean).join(', ');
    var availablePlots = fv(fields, 'availablePlots');
    var siteMapUrl = fv(fields, 'siteMapUrl');
    var isActive = fv(fields, 'isActive');
    var status = String(fv(fields, 'status') || 'pending_review').toLowerCase();

    var descParts = [price, loc].filter(Boolean);
    if (availablePlots) {
      descParts.push(availablePlots + (parseInt(availablePlots, 10) === 1 ? ' plot available' : ' plots available'));
    }
    var desc = descParts.join(' · ').slice(0, 200);
    if (!desc) desc = 'View this new development on KOMISIYONERI — Rwanda Real Estate.';

    var image = cloudinaryPreviewUrl(siteMapUrl) || DEFAULT_IMAGE;

    // Matches _fetchActiveSites()'s own public-visibility query in
    // index.html (status:'active' && isActive:true) — a pending_review or
    // rejected site is still reachable by direct doc ID under the current
    // public-read rule, but it isn't meant to be publicly promoted; don't
    // let a link preview amplify an unapproved/removed site's photo to
    // whoever it gets shared to.
    var isPublic = isActive !== false && status === 'active';

    res.setHeader('Cache-Control', isPublic
      ? 'private, max-age=300'
      : 'private, max-age=60');

    if (!isPublic) {
      return res.status(200).end(renderHtml({
        title: 'KOMISIYONERI', desc: 'Rwanda Real Estate — Buy, sell or rent verified property.',
        image: DEFAULT_IMAGE, url: siteUrl
      }));
    }

    return res.status(200).end(renderHtml({
      title: title + ' | KOMISIYONERI', desc: desc, image: image, url: siteUrl
    }));
  } catch (err) {
    console.error('[site-og] error:', err.message);
    return res.status(502).end(renderHtml({
      title: 'KOMISIYONERI', desc: 'Rwanda Real Estate', image: DEFAULT_IMAGE, url: siteUrl
    }));
  }
};
