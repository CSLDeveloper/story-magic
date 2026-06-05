// This route now only handles page 1 portrait generation
// Pages 2+ are handled entirely client-side via the fal proxy
// This bypasses Render's 30-second HTTP timeout completely

export const config = { maxDuration: 120 };

async function submitAndPoll(falKey, endpointId, input, timeoutMs = 90000) {
  const submitRes = await fetch(`https://queue.fal.run/${endpointId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!submitRes.ok) {
    const err = await submitRes.text();
    throw new Error(`Submit failed ${submitRes.status}: ${err.slice(0, 200)}`);
  }
  const { request_id } = await submitRes.json();
  if (!request_id) throw new Error('No request_id from fal');

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(
      `https://queue.fal.run/${endpointId}/requests/${request_id}/status`,
      { headers: { 'Authorization': `Key ${falKey}` } }
    );
    if (!statusRes.ok) continue;
    const { status } = await statusRes.json();

    if (status === 'COMPLETED') {
      const resultRes = await fetch(
        `https://queue.fal.run/${endpointId}/requests/${request_id}`,
        { headers: { 'Authorization': `Key ${falKey}` } }
      );
      if (!resultRes.ok) throw new Error(`Result fetch failed: ${resultRes.status}`);
      const result = await resultRes.json();
      const url = result?.images?.[0]?.url || result?.image?.url;
      if (!url) throw new Error(`No image URL in result`);
      const imgRes = await fetch(url);
      return { buffer: Buffer.from(await imgRes.arrayBuffer()), url };
    }
    if (status === 'FAILED') throw new Error('fal job failed');
  }
  throw new Error('fal timed out');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { heroPortraitPrompt, sidekickPortraitPrompt } = req.body;
  const falKey = process.env.FAL_KEY;
  if (!falKey) return res.status(500).json({ error: 'FAL_KEY not configured' });
  if (!heroPortraitPrompt) return res.status(400).json({ error: 'heroPortraitPrompt required' });

  try {
    // Generate both portraits in parallel — only called once per story (page 1)
    const [heroResult, sidekickResult] = await Promise.all([
      submitAndPoll(falKey, 'fal-ai/flux-pro', {
        prompt: `${heroPortraitPrompt}, full body, neutral pose, plain white background, children's book watercolor illustration, soft pastel colors, no text`,
        image_size: 'portrait_4_3',
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        output_format: 'jpeg',
        seed: 42,
      }),
      sidekickPortraitPrompt
        ? submitAndPoll(falKey, 'fal-ai/flux-pro', {
            prompt: `${sidekickPortraitPrompt}, full body, neutral pose, plain white background, children's book watercolor illustration, soft pastel colors, no text`,
            image_size: 'portrait_4_3',
            num_inference_steps: 28,
            guidance_scale: 3.5,
            num_images: 1,
            output_format: 'jpeg',
            seed: 99,
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

    // Return portrait URLs so browser can use them for pages 2+
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      heroPortraitUrl: heroResult.url,
      sidekickPortraitUrl: sidekickResult?.url || null,
    });

  } catch (error) {
    console.error('Portrait generation error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
