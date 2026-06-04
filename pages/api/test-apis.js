export default async function handler(req, res) {
  const results = {};

  // Test OpenAI TTS
  try {
    const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: 'Hello test.', speed: 0.92 }),
    });
    const body = ttsRes.ok ? 'OK - audio received' : await ttsRes.text();
    results.openai_tts = { status: ttsRes.status, body: body.slice(0, 200) };
  } catch (e) {
    results.openai_tts = { error: e.message };
  }

  // Test fal.ai key validity
  try {
    const falRes = await fetch('https://fal.ai/api/me', {
      headers: { 'Authorization': `Key ${process.env.FAL_KEY}` },
    });
    const body = await falRes.text();
    results.fal_ai = { status: falRes.status, body: body.slice(0, 200) };
  } catch (e) {
    results.fal_ai = { error: e.message };
  }

  // Test Anthropic
  results.anthropic = { key: process.env.ANTHROPIC_API_KEY ? 'SET' : 'MISSING' };
  results.fal_key   = { key: process.env.FAL_KEY          ? 'SET' : 'MISSING' };
  results.openai    = { key: process.env.OPENAI_API_KEY    ? 'SET' : 'MISSING' };

  res.status(200).json(results);
}
