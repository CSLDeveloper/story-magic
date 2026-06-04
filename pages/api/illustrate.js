// Extend Next.js API route timeout to 5 minutes
export const config = {
  maxDuration: 300,
};

// In-memory portrait cache per story session
const portraitCache = new Map();

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, val] of portraitCache.entries()) {
    if (val.timestamp < cutoff) portraitCache.delete(key);
  }
}, 10 * 60 * 1000);

// Call fal.ai synchronously — waits for result in one request
// Uses fal.run (not queue.fal.run) for direct synchronous response
async function falRequest(falKey, endpointId, input) {
  const res = await fetch(`https://fal.run/${endpointId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`fal.ai error ${res.status}: ${body.slice(0, 300)}`);
  }

  let data;
  try { data = JSON.parse(body); }
  catch (e) { throw new Error(`fal.ai bad JSON: ${body.slice(0, 200)}`); }

  const imageUrl = data?.images?.[0]?.url;
  if (!imageUrl) throw new Error(`No image URL in response: ${JSON.stringify(data).slice(0, 200)}`);

  // Download the image and return both buffer and URL
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Image download failed: ${imgRes.status}`);

  return {
    buffer: Buffer.from(await imgRes.arrayBuffer()),
    url: imageUrl,
  };
}

// Generate a portrait — text to image using FLUX Pro
async function generatePortrait(falKey, prompt) {
  return falRequest(falKey, 'fal-ai/flux-pro', {
    prompt: `${prompt}, children's book watercolor illustration, soft pastel colors, cute friendly art style, no text, no words`,
    image_size: 'landscape_4_3',
    num_inference_steps: 25,
    guidance_scale: 3.5,
    num_images: 1,
    output_format: 'jpeg',
    seed: 42,
  });
}

// Generate a scene — image to image using FLUX Kontext Pro
async function generateScene(falKey, scenePrompt, portraitUrl) {
  return falRequest(falKey, 'fal-ai/flux-pro/kontext', {
    prompt: `Keep the exact same character — identical face, hair color, clothing, and body proportions. Place them in this new scene: ${scenePrompt}. Children's book watercolor illustration, soft pastel colors, no text, no words.`,
    image_url: portraitUrl,
    guidance_scale: 3.5,
    num_inference_steps: 25,
    num_images: 1,
    output_format: 'jpeg',
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
      // Page 1 — generate hero portrait via text-to-image
      const heroResult = await generatePortrait(falKey, heroPortraitPrompt || description);

      // Generate sidekick portrait in parallel (best effort, non-blocking)
      let sidekickResult = null;
      if (sidekickPortraitPrompt) {
        try {
          sidekickResult = await generatePortrait(falKey, sidekickPortraitPrompt);
        } catch (e) {
          console.warn('Sidekick portrait failed (non-fatal):', e.message);
        }
      }

      // Cache portrait URLs — Kontext needs a public URL not a buffer
      portraitCache.set(storyId, {
        heroUrl: heroResult.url,
        sidekickUrl: sidekickResult?.url || null,
        timestamp: Date.now(),
      });

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(heroResult.buffer);
    }

    // Pages 2+ — wait up to 30s for page 1 portrait to be cached
    let cached = portraitCache.get(storyId);
    if (!cached?.heroUrl) {
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000));
        cached = portraitCache.get(storyId);
        if (cached?.heroUrl) break;
      }
    }

    if (!cached?.heroUrl) {
      return res.status(503).json({ error: 'Portrait not ready — please tap Try Again' });
    }

    // Build enriched scene prompt with sidekick description in text
    let scenePrompt = description;
    if (sidekickPortraitPrompt) {
      const sidekickDesc = sidekickPortraitPrompt
        .replace(/, full body character portrait.*$/i, '')
        .trim();
      scenePrompt = `${description} The sidekick companion looks like: ${sidekickDesc}.`;
    }

    // Use FLUX Kontext to place the character into the new scene
    const sceneResult = await generateScene(falKey, scenePrompt, cached.heroUrl);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(sceneResult.buffer);

  } catch (error) {
    console.error('Illustration error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
