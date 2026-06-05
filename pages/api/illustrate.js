export const config = { maxDuration: 300 };

// In-memory portrait cache per story session
const portraitCache = new Map();

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, val] of portraitCache.entries()) {
    if (val.timestamp < cutoff) portraitCache.delete(key);
  }
}, 10 * 60 * 1000);

// Universal fal.ai caller — tries sync first, falls back to queue polling
async function falCall(falKey, endpointId, input, timeoutMs = 120000) {
  // Step 1: Submit job to queue
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
    throw new Error(`fal submit error ${submitRes.status}: ${err.slice(0, 300)}`);
  }

  const { request_id } = await submitRes.json();
  if (!request_id) throw new Error('No request_id returned from fal submit');

  // Step 2: Poll for result
  const statusUrl = `https://queue.fal.run/${endpointId}/requests/${request_id}`;
  const resultUrl = `https://queue.fal.run/${endpointId}/requests/${request_id}/result`;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 3000));

    const statusRes = await fetch(statusUrl, {
      headers: { 'Authorization': `Key ${falKey}` },
    });

    if (!statusRes.ok) continue;

    const status = await statusRes.json();

    if (status.status === 'COMPLETED') {
      // Fetch result
      const resultRes = await fetch(resultUrl, {
        headers: { 'Authorization': `Key ${falKey}` },
      });
      if (!resultRes.ok) throw new Error(`Result fetch failed: ${resultRes.status}`);
      const result = await resultRes.json();

      const imageUrl = result?.images?.[0]?.url || result?.image?.url;
      if (!imageUrl) throw new Error(`No image URL in result: ${JSON.stringify(result).slice(0, 200)}`);

      // Download image buffer
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error(`Image download failed: ${imgRes.status}`);

      return {
        buffer: Buffer.from(await imgRes.arrayBuffer()),
        url: imageUrl,
      };
    }

    if (status.status === 'FAILED') {
      throw new Error(`fal job failed: ${JSON.stringify(status.error || status).slice(0, 200)}`);
    }
    // PENDING or IN_PROGRESS — keep polling
  }

  throw new Error(`fal job timed out after ${timeoutMs / 1000}s`);
}

// Page 1: Generate reference portrait via FLUX Pro (high quality, fixed seed)
async function generatePortrait(falKey, prompt) {
  return falCall(falKey, 'fal-ai/flux-pro', {
    prompt: `${prompt}, full body, neutral standing pose, plain white background, children's book watercolor illustration, soft pastel colors, cute expressive face, no text`,
    image_size: 'portrait_4_3',
    num_inference_steps: 28,
    guidance_scale: 3.5,
    num_images: 1,
    output_format: 'jpeg',
    seed: 42,
  });
}

// Pages 2+: InstantCharacter — purpose-built for consistent characters across scenes
async function generateScene(falKey, scenePrompt, portraitUrl) {
  return falCall(falKey, 'fal-ai/instant-character', {
    prompt: scenePrompt,
    image_url: portraitUrl,
    image_size: 'landscape_4_3',
    scale: 0.9,
    guidance_scale: 3.5,
    num_inference_steps: 28,
    num_images: 1,
    output_format: 'jpeg',
    negative_prompt: 'wrong head, mismatched body, deformed, ugly, bad anatomy, extra limbs, text, watermark, scary, violent',
    enable_safety_checker: true,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { description, pageNum, storyId, heroPortraitPrompt, sidekickPortraitPrompt } = req.body;
  if (!description) return res.status(400).json({ error: 'Description required' });
  if (!storyId)     return res.status(400).json({ error: 'storyId required' });

  const falKey = process.env.FAL_KEY;
  if (!falKey) return res.status(500).json({ error: 'FAL_KEY not configured' });

  try {
    if (pageNum === 1) {
      // Generate hero and sidekick portraits in parallel
      const [heroResult, sidekickResult] = await Promise.all([
        generatePortrait(falKey, heroPortraitPrompt || description),
        sidekickPortraitPrompt
          ? generatePortrait(falKey, sidekickPortraitPrompt).catch(e => {
              console.warn('Sidekick portrait failed (non-fatal):', e.message);
              return null;
            })
          : Promise.resolve(null),
      ]);

      // Cache portrait URLs for subsequent pages
      portraitCache.set(storyId, {
        heroUrl: heroResult.url,
        sidekickUrl: sidekickResult?.url || null,
        timestamp: Date.now(),
      });

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(heroResult.buffer);
    }

    // Pages 2+: wait up to 60s for page 1 portrait to be cached
    let cached = portraitCache.get(storyId);
    if (!cached?.heroUrl) {
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 1000));
        cached = portraitCache.get(storyId);
        if (cached?.heroUrl) break;
      }
    }

    if (!cached?.heroUrl) {
      return res.status(503).json({ error: 'Portrait not ready — please tap Try Again' });
    }

    // Build enriched prompt with sidekick description in text
    let scenePrompt = description;
    if (sidekickPortraitPrompt) {
      const sidekickDesc = sidekickPortraitPrompt
        .replace(/, full body.*$/i, '')
        .trim();
      scenePrompt = `${description} The sidekick companion looks like: ${sidekickDesc}.`;
    }

    const sceneResult = await generateScene(falKey, scenePrompt, cached.heroUrl);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(sceneResult.buffer);

  } catch (error) {
    console.error('Illustration error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
