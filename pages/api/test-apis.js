export default async function handler(req, res) {
  const results = {};

  // Test ElevenLabs
  try {
    const elRes = await fetch('https://api.elevenlabs.io/v1/text-to-speech/9BWtsMINqrJLrRacOk9x', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: 'Hello test.',
        model_id: 'eleven_turbo_v2',
        voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.6 },
      }),
    });
    const body = elRes.ok ? 'OK - audio received' : await elRes.text();
    results.elevenlabs = { status: elRes.status, body: body.slice(0, 300) };
  } catch (e) {
    results.elevenlabs = { error: e.message };
  }

  // Test Stability AI
  try {
    const form = new FormData();
    form.append('prompt', 'a cute cat in a garden, watercolor illustration');
    form.append('aspect_ratio', '4:3');
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
