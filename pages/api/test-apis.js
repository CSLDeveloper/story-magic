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

  // Test fal.ai by submitting a minimal FLUX Pro request
  try {
    const falRes = await fetch('https://queue.fal.run/fal-ai/flux-pro', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'a red circle on white background',
        num_images: 1,
        image_size: 'square_hd',
        num_inference_steps: 1,
      }),
    });
    const body = await falRes.text();
    // A 200 or 201 means the key is valid and job was queued
    if (falRes.status === 200 || falRes.status === 201) {
      results.fal_ai = { status: falRes.status, body: 'OK - job queued successfully' };
    } else {
      results.fal_ai = { status: falRes.status, body: body.slice(0, 300) };
    }
  } catch (e) {
    results.fal_ai = { error: e.message };
  }

  // Key presence checks
  results.keys = {
    anthropic: process.env.ANTHROPIC_API_KEY ? 'SET' : 'MISSING',
    fal:       process.env.FAL_KEY           ? 'SET' : 'MISSING',
    openai:    process.env.OPENAI_API_KEY    ? 'SET' : 'MISSING',
  };

  res.status(200).json(results);
}
