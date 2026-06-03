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
      body: JSON.stringify({
        model: 'tts-1-hd',
        voice: 'nova',
        input: 'Hello test.',
        speed: 0.92,
      }),
    });
    const body = ttsRes.ok ? 'OK - audio received' : await ttsRes.text();
    results.openai_tts = { status: ttsRes.status, body: body.slice(0, 300) };
  } catch (e) {
    results.openai_tts = { error: e.message };
  }

  // Test Stability AI
  try {
    const form = new FormData();
    form.append('prompt', 'a cute cat in a garden, watercolor illustration');
    form.append('aspect_ratio', '3:2');
    form.append('output_format', 'jpeg');

    const stRes = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
        'Accept': 'image/*',
      },
      body: form,
    });
    const body = stRes.ok ? 'OK - image received' : await stRes.text();
    results.stability = { status: stRes.status, body: body.slice(0, 300) };
  } catch (e) {
    results.stability = { error: e.message };
  }

  res.status(200).json(results);
}
