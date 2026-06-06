export default async function handler(req, res) {
  const falKey = process.env.FAL_KEY;
  const log = [];

  if (!falKey) return res.status(200).json({ error: 'FAL_KEY missing' });
  log.push('FAL_KEY is set');

  try {
    // Test 1: FLUX schnell synchronous (fastest/cheapest test)
    log.push('Test 1: fal.run FLUX schnell...');
    const r1 = await fetch('https://fal.run/fal-ai/flux/schnell', {
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
    const b1 = await r1.text();
    log.push(`Status: ${r1.status}`);
    log.push(`Body: ${b1.slice(0, 200)}`);

    if (r1.ok) {
      const d1 = JSON.parse(b1);
      log.push(`Image URL: ${d1?.images?.[0]?.url?.slice(0, 80) || 'NONE'}`);

      // Test 2: InstantCharacter synchronous
      log.push('Test 2: fal.run instant-character...');
      const r2 = await fetch('https://fal.run/fal-ai/instant-character', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'a child running in a sunny park, watercolor illustration',
          image_url: d1.images[0].url,
          image_size: 'landscape_4_3',
          scale: 0.9,
          num_images: 1,
          output_format: 'jpeg',
        }),
      });
      const b2 = await r2.text();
      log.push(`Status: ${r2.status}`);
      log.push(`Body: ${b2.slice(0, 300)}`);
      if (r2.ok) {
        const d2 = JSON.parse(b2);
        log.push(`Image URL: ${d2?.images?.[0]?.url?.slice(0, 80) || 'NONE'}`);
        log.push('SUCCESS - both models work synchronously!');
      }
    }
  } catch(e) {
    log.push(`ERROR: ${e.message}`);
  }

  return res.status(200).json({ log });
}
