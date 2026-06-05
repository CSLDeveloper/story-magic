// In-memory portrait cache per story session
const portraitCache = new Map();

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, val] of portraitCache.entries()) {
    if (val.timestamp < cutoff) portraitCache.delete(key);
  }
}, 10 * 60 * 1000);

// Call fal.ai synchronously using fal.run (direct, no queue polling)
async function falRun(falKey, endpointId, input) {
  const res = await fetch(`https://fal.run/${endpointId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`fal.ai ${endpointId} error ${res.status}: ${body.slice(0, 300)}`);

  let data;
  try { data = JSON.parse(body); }
  catch(e) { throw new Error(`fal.ai bad JSON: ${body.slice(0, 200)}`); }

  const imageUrl = data?.images?.[0]?.url;
  if (!imageUrl) throw new Error(`No image URL in response: ${JSON.stringify(data).slice(0, 200)}`);

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Image download failed: ${imgRes.status}`);

  return {
    buffer: Buffer.from(await imgRes.arrayBuffer()),
    url: imageUrl,
  };
}

// Page 1: Generate the reference portrait using FLUX Pro (high quality, fixed seed)
async function generatePortrait(falKey, prompt) {
  return falRun(falKey, 'fal-ai/flux-pro', {
    prompt: `${prompt}, full body, neutral standing pose, plain white background, children's book watercolor illustration, soft pastel colors, cute expressive face, friendly art style, no text`,
    image_size: 'portrait_4_3',
    num_inference_steps: 35,
    guidance_scale: 3.5,
    num_images: 1,
    output_format: 'jpeg',
    seed: 42,
  });
}

// Pages 2+: Use InstantCharacter to place the character consistently into each scene
// InstantCharacter is purpose-built for consistent characters across multiple images
async function generateScene(falKey, scenePrompt, portraitUrl, scale = 0.9) {
  return falRun(falKey, 'fal-ai/instant-character', {
    prompt: scenePrompt,
    image_url: portraitUrl,
    image_size: 'landscape_4_3',
    scale: scale,              // 0.9 = strong identity preservation, scene still varies
    guidance_scale: 3.5,
    num_inference_steps: 28,
    num_images: 1,
    output_format: 'jpeg',
    negative_prompt: 'wrong head, mismatched body, deformed, ugly, bad anatomy, extra limbs, text, watermark, realistic photo, scary, violent',
    enable_safety_checker: true,
  });
}

export const config = { maxDuration: 300 };

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
      // Generate hero portrait (text-to-image, fixed seed for consistency)
      // Also generate sidekick portrait in parallel
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

      // Page 1 shows the hero portrait
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(heroResult.buffer);
    }

    // Pages 2+: wait up to 40s for page 1 portrait cache
    let cached = portraitCache.get(storyId);
    if (!cached?.heroUrl) {
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 1000));
        cached = portraitCache.get(storyId);
        if (cached?.heroUrl) break;
      }
    }

    if (!cached?.heroUrl) {
      return res.status(503).json({ error: 'Portrait not ready — please tap Try Again' });
    }

    // Build scene prompt — include sidekick description in text
    // since InstantCharacter takes one reference image
    let scenePrompt = description;
    if (sidekickPortraitPrompt) {
      const sidekickDesc = sidekickPortraitPrompt
        .replace(/, full body character portrait.*$/i, '')
        .replace(/, full body, neutral.*$/i, '')
        .trim();
      scenePrompt = `${description} The sidekick companion in this scene is: ${sidekickDesc}.`;
    }

    // Use InstantCharacter for consistent character across all pages
    const sceneResult = await generateScene(falKey, scenePrompt, cached.heroUrl);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(sceneResult.buffer);

  } catch (error) {
    console.error('Illustration error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
