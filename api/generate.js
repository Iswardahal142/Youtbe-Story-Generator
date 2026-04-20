export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });

  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Image generation failed' });
    }

    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(buffer));

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
