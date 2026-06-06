// Simple test - calls fal.ai directly from server with raw fetch
// Visit /api/test-fal to see exactly what happens
export default async function handler(req, res) {
  const falKey = process.env.FAL_KEY;
  const log = [];

  if (!falKey) {
    return res.status(200).json({ error: 'FAL_KEY missing' });
  }

  log.push('FAL_KEY is set');

  try {
    // Test 1: Submit a simple FLUX job (synchronous via fal.run)
    log.push('Submitting FLUX schnell job via fal.run (synchronous)...');
    
    const startTime = Date.now();
    const resp = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'a red circle on white background',
        image_size: 'square',
        num_inference_steps: 1,
        num_images: 1,
      }),
    });

    const elapsed = Date.now() - startTime;
    log.push(`Response status: ${resp.status} (took ${elapsed}ms)`);

    const body = await resp.text();
    log.push(`Response body (first 300 chars): ${body.slice(0, 300)}`);

    if (resp.ok) {
      const data = JSON.parse(body);
      const imageUrl = data?.images?.[0]?.url;
      log.push(`Image URL: ${imageUrl ? imageUrl.slice(0, 80) : 'NOT FOUND'}`);
      log.push('SUCCESS - fal.run synchronous works!');
    }
  } catch(e) {
    log.push(`ERROR: ${e.message}`);
  }

  return res.status(200).json({ log });
}
