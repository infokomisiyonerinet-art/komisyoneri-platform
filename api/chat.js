// KOMISIYONERI — NOHERI AI Chat Backend
// Vercel serverless function: proxies messages to Anthropic Claude API
// Environment variable required: ANTHROPIC_API_KEY

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
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
