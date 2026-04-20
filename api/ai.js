export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // Always disable streaming — fetch full response, send as SSE manually
    const bodyWithoutStream = { ...req.body, stream: false };

    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://kaali-raat.vercel.app',
        'X-Title': 'Kaali Raat Studio',
      },
      body: JSON.stringify(bodyWithoutStream),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json(data);
    }

    const content = data.choices?.[0]?.message?.content || '';

    if (req.body?.stream) {
      // Simulate SSE streaming so HTML side works unchanged
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');

      // Send content in one SSE chunk
      const chunk = JSON.stringify({
        choices: [{ delta: { content }, finish_reason: null }]
      });
      res.write(`data: ${chunk}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      return res.status(200).json(data);
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
