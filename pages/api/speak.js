export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd',       // High quality model
        voice: 'nova',            // Nova: warm, expressive, great for storytelling
        input: text,
        speed: 0.92,              // Slightly slower for children
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI TTS error ${response.status}: ${err}`);
    }

    const audioBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: error.message });
  }
}
