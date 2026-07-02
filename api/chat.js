// KOMISIYONERI — NOHERI AI Chat Backend
// Vercel serverless function: proxies messages to Anthropic Claude API
// Environment variable required: ANTHROPIC_API_KEY

const ALLOWED_ORIGINS = [
  'https://komisiyoneri.co.rw',
  'https://komisyoneri-platform-nu.vercel.app',
  'https://komisyoneri-platform.vercel.app'
];

// Best-effort, in-memory per-IP rate limit. NOTE: Vercel serverless functions
// are stateless across cold starts and spread across concurrent instances, so
// this only throttles bursts hitting the same warm instance — it is not a
// substitute for real distributed rate limiting (e.g. Vercel KV / Upstash
// Redis), which needs infra this deployment doesn't have provisioned yet.
const _rateLimitBuckets = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;

function isRateLimited(ip) {
  const now = Date.now();
  const bucket = _rateLimitBuckets.get(ip);
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    _rateLimitBuckets.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  bucket.count++;
  return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const origin = req.headers.origin || req.headers.referer || '';
  const isKnownOrigin = ALLOWED_ORIGINS.some(function(o) { return origin.indexOf(o) === 0; });
  const isLocalDev = /^https?:\/\/localhost(:\d+)?/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?/.test(origin);
  if (origin && !isKnownOrigin && !isLocalDev) {
    return res.status(403).json({ error: { message: 'Forbidden origin' } });
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: { message: 'Too many requests — please slow down' } });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'AI service not configured' } });
  }

  const body = req.body || {};
  const { system, messages } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { message: 'messages array is required' } });
  }

  // Sanitize: only allow role/content string pairs
  const safeMessages = messages
    .filter(function(m) {
      return (m.role === 'user' || m.role === 'assistant') &&
             typeof m.content === 'string' &&
             m.content.trim().length > 0;
    })
    .map(function(m) {
      return { role: m.role, content: m.content.slice(0, 4000) };
    });

  if (safeMessages.length === 0) {
    return res.status(400).json({ error: { message: 'No valid messages' } });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: typeof system === 'string' ? system.slice(0, 8000) : '',
        messages: safeMessages
      })
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[NOHERI] Anthropic API error:', err.message);
    return res.status(502).json({ error: { message: 'AI service temporarily unavailable' } });
  }
};
