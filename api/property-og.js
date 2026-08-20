// KOMISIYONERI — Property Open Graph preview
//
// Vercel serverless function: serves a minimal, server-rendered HTML page
// with Open Graph / Twitter Card meta tags for a single property. Link-
// preview crawlers (facebookexternalhit, WhatsApp, Twitterbot, LinkedInBot,
// etc.) generally don't execute JavaScript — they read only the initial
// HTML response — so the SPA's client-side-injected meta tags (see
// _updatePropertyMeta() in index.html) are invisible to them. vercel.json
// rewrites /property/:id here ONLY when the request's User-Agent matches a
// known crawler; every other visitor gets the normal index.html SPA, which
// opens the same property client-side via openPropDetail().
//
// Reads straight from Firestore's REST API using the same public web API
// key the client SDK itself uses in index.html — no service-account
// credentials needed, since rules/firestore.rules already allows
// unconditional public read on properties/{id}.

const PROJECT_ID = 'komisyoneri-platform-prod';
const API_KEY = 'AIzaSyCw9NYlw0XLC26Di-nFCNOuL7D6RX8k820';
const SITE_URL = 'https://komisiyoneri.co.rw';
const DEFAULT_IMAGE = SITE_URL + '/images/kigali-skyline.jpg';

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Unwraps a Firestore REST API typed field into a plain JS value — the
// REST API returns { fields: { key: { stringValue: '...' } , ... } }
// instead of plain JSON, unlike the Admin/client SDKs.
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

// Matches fmtPriceSh() in index.html so shared links describe price the
// same way the app itself does (e.g. "40M RWF").
function fmtPrice(n) {
  n = parseInt(n, 10) || 0;
  if (!n) return '';
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace('.0', '') + 'B RWF';
  if (n >= 1e6) return Math.round(n / 1e6) + 'M RWF';
  return n.toLocaleString('en-US') + ' RWF';
}

// Cloudinary serves any size on demand via URL transformation params —
// inject a fill/crop to the ~1200x630 size platforms want for a link-
// preview card. Falls through untouched for any non-Cloudinary URL (e.g.
// legacy Firebase Storage images on older listings).
function cloudinaryPreviewUrl(url) {
  if (typeof url !== 'string' || url.indexOf('res.cloudinary.com') === -1) return url;
  return url.replace('/upload/', '/upload/c_fill,w_1200,h_630,q_auto,f_auto/');
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

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end('Method not allowed');
  }

  var id = req.query && req.query.id;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!id || typeof id !== 'string') {
    return res.status(400).end(renderHtml({
      title: 'KOMISIYONERI', desc: 'Rwanda Real Estate', image: DEFAULT_IMAGE, url: SITE_URL
    }));
  }

  var propUrl = SITE_URL + '/property/' + encodeURIComponent(id);

  try {
    var apiUrl = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID
      + '/databases/(default)/documents/properties/' + encodeURIComponent(id)
      + '?key=' + API_KEY;
    var resp = await fetch(apiUrl);

    if (!resp.ok) {
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.status(resp.status === 404 ? 404 : 502).end(renderHtml({
        title: 'KOMISIYONERI', desc: 'Property not found — view all listings on KOMISIYONERI.',
        image: DEFAULT_IMAGE, url: propUrl
      }));
    }

    var doc = await resp.json();
    var fields = doc.fields || {};

    var district = fv(fields, 'district') || '';
    var sector = fv(fields, 'sector') || '';
    var type = fv(fields, 'type') || '';
    // Matches _propShareText()'s fallback in index.html — when a listing has
    // no explicit title, use "Type — District" (the same string
    // renderUserPropCard()'s propName falls back to for its own p-title).
    var title = fv(fields, 'title') || fv(fields, 'titleRW')
      || ((type || 'Imitungo') + (district ? ' — ' + district : ''));
    var price = fmtPrice(fv(fields, 'price'));
    var loc = [district, sector].filter(Boolean).join(', ');
    var bedrooms = fv(fields, 'bedrooms');
    var area = fv(fields, 'area');
    var images = fv(fields, 'images') || [];
    var isActive = fv(fields, 'isActive');
    var status = String(fv(fields, 'status') || 'approved').toLowerCase();

    var descParts = [price, loc].filter(Boolean);
    if (bedrooms) descParts.push(bedrooms + (parseInt(bedrooms, 10) === 1 ? ' bedroom' : ' bedrooms'));
    if (area) descParts.push(area + 'm²');
    var desc = descParts.join(' · ').slice(0, 200);
    if (!desc) desc = 'View this property on KOMISIYONERI — Rwanda Real Estate.';

    var image = cloudinaryPreviewUrl(images[0]) || DEFAULT_IMAGE;

    // A pending/rejected/deactivated listing is still reachable by direct
    // doc ID under the current public-read rule, but it isn't meant to be
    // publicly promoted — don't let a link preview amplify an unapproved
    // or removed listing's photo/price to whoever it gets shared to.
    var isPublic = isActive !== false && (status === 'approved' || status === 'sold');

    res.setHeader('Cache-Control', isPublic
      ? 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600'
      : 'public, max-age=60');

    if (!isPublic) {
      return res.status(200).end(renderHtml({
        title: 'KOMISIYONERI', desc: 'Rwanda Real Estate — Buy, sell or rent verified property.',
        image: DEFAULT_IMAGE, url: propUrl
      }));
    }

    return res.status(200).end(renderHtml({
      title: title + ' | KOMISIYONERI', desc: desc, image: image, url: propUrl
    }));
  } catch (err) {
    console.error('[property-og] error:', err.message);
    return res.status(502).end(renderHtml({
      title: 'KOMISIYONERI', desc: 'Rwanda Real Estate', image: DEFAULT_IMAGE, url: propUrl
    }));
  }
};
