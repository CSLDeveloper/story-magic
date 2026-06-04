// In-memory portrait cache per story session
const portraitCache = new Map();

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, val] of portraitCache.entries()) {
    if (val.timestamp < cutoff) portraitCache.delete(key);
  }
}, 10 * 60 * 1000);

// Upload a buffer to fal.ai storage and return a public URL
// Kontext requires a URL, not raw bytes
async function uploadToFal(falKey, imageBuffer, filename = 'image.jpg') {
  const res = await fetch('https://fal.ai/api/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'image/jpeg',
      'x-file-name': filename,
    },
    body: imageBuffer,
  });
  if (!res.ok) throw new Error(`fal upload failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.url;
}

// Generate a portrait using fal.ai FLUX Kontext text-to-image
async function generatePortrait(falKey, prompt) {
  const res = await fetch('https://queue.fal.run/fal-ai/flux-pro', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: `${prompt}, children's book watercolor illustration, soft pastel colors, cute friendly art style, no text, no words`,
      image_size: 'landscape_4_3',
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      output_format: 'jpeg',
    }),
  });
  if (!res.ok) throw new Error(`FLUX portrait failed ${res.status}: ${(await res.text()).slice(0, 200)}`);

  // fal queue — poll for result
  const queue = await res.json();
  return await pollFalQueue(falKey, queue.request_id, 'fal-ai/flux-pro');
}

// Use FLUX Kontext to edit the portrait into a new scene while preserving character
async function generateScene(falKey, scenePrompt, portraitUrl) {
  const res = await fetch('https://queue.fal.run/fal-ai/flux-pro/kontext', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: `Keep the exact same character appearance — same face, hair, outfit, and proportions. Change the scene to: ${scenePrompt}. Children's book watercolor illustration, soft pastel colors, cute friendly art, no text, no words.`,
      image_url: portraitUrl,
      guidance_scale: 3.5,
      num_inference_steps: 28,
      num_images: 1,
      output_format: 'jpeg',
    }),
  });
  if (!res.ok) throw new Error(`Kontext scene failed ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const queue = await res.json();
  return await pollFalQueue(falKey, queue.request_id, 'fal-ai/flux-pro/kontext');
}

// Poll fal.ai queue until result is ready
async function pollFalQueue(falKey, requestId, endpointId, maxWait = 120000) {
  const start = Date.now();
  const statusUrl = `https://queue.fal.run/${endpointId}/requests/${requestId}`;

  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 2000));

    const statusRes = await fetch(statusUrl, {
      headers: { 'Authorization': `Key ${falKey}` },
    });

    if (!statusRes.ok) continue;
    const status = await statusRes.json();

    if (status.status === 'COMPLETED') {
      // Fetch actual result
      const resultRes = await fetch(`${statusUrl}/result`, {
        headers: { 'Authorization': `Key ${falKey}` },
      });
      if (!resultRes.ok) throw new Error('Failed to fetch result');
      const result = await resultRes.json();
      const imageUrl = result.images?.[0]?.url;
      if (!imageUrl) throw new Error('No image in result');
      // Download image and return as buffer
      const imgRes = await fetch(imageUrl);
      return {
        buffer: Buffer.from(await imgRes.arrayBuffer()),
        url: imageUrl,
      };
    }

    if (status.status === 'FAILED') {
      throw new Error(`fal job failed: ${JSON.stringify(status.error || status)}`);
    }
    // PENDING or IN_PROGRESS — keep polling
  }
  throw new Error('fal job timed out after 2 minutes');
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
      // Generate hero portrait — text-to-image via FLUX Pro
      const heroResult = await generatePortrait(falKey, heroPortraitPrompt || description);

      // Optionally generate sidekick portrait in parallel (best effort)
      let sidekickResult = null;
      if (sidekickPortraitPrompt) {
        try {
          sidekickResult = await generatePortrait(falKey, sidekickPortraitPrompt);
        } catch (e) {
          console.warn('Sidekick portrait failed:', e.message);
        }
      }

      // Cache portrait URLs for Kontext (needs URL not buffer)
      portraitCache.set(storyId, {
        heroUrl: heroResult.url,
        sidekickUrl: sidekickResult?.url || null,
        timestamp: Date.now(),
      });

      // Return hero portrait as page 1 image
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(heroResult.buffer);
    }

    // Pages 2+ — wait up to 30s for page 1 portrait cache
    let cached = portraitCache.get(storyId);
    if (!cached?.heroUrl) {
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000));
        cached = portraitCache.get(storyId);
        if (cached?.heroUrl) break;
      }
    }

    if (!cached?.heroUrl) {
      return res.status(503).json({ error: 'Portrait not ready yet — please retry' });
    }

    // Build scene prompt including sidekick description if available
    let scenePrompt = description;
    if (sidekickPortraitPrompt) {
      const sidekickDesc = sidekickPortraitPrompt
        .replace(/, full body character portrait.*$/i, '')
        .trim();
      scenePrompt = `${description} The sidekick companion in this scene looks like: ${sidekickDesc}.`;
    }

    // Use FLUX Kontext to generate scene anchored to hero portrait
    const sceneResult = await generateScene(falKey, scenePrompt, cached.heroUrl);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(sceneResult.buffer);

  } catch (error) {
    console.error('Illustration error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
