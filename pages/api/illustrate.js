// In-memory portrait cache per story session
// Key: storyId, Value: { hero: Buffer, sidekick: Buffer, timestamp: number }
const portraitCache = new Map();

// Clean up entries older than 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, val] of portraitCache.entries()) {
    if (val.timestamp < cutoff) portraitCache.delete(key);
  }
}, 10 * 60 * 1000);

const STABILITY_URL = 'https://api.stability.ai/v2beta/stable-image/generate/sd3';

const NEGATIVE_PROMPT = [
  'text', 'words', 'letters', 'numbers', 'watermark',
  'scary', 'violent', 'realistic', 'photo', 'blurry',
  'deformed', 'extra limbs', 'dragon head on human',
  'animal head on human body', 'mutant', 'ugly', 'bad anatomy',
  'wrong species', 'mismatched character', 'inconsistent character',
].join(', ');

// Single Stability AI call — text-to-image or image-to-image
async function generateImage(apiKey, prompt, referenceBuffer = null, strength = 0.60) {
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('negative_prompt', NEGATIVE_PROMPT);
  form.append('model', 'sd3.5-medium');
  form.append('output_format', 'jpeg');

  if (referenceBuffer) {
    form.append('mode', 'image-to-image');
    form.append('strength', String(strength));
    form.append('image', new Blob([referenceBuffer], { type: 'image/jpeg' }), 'reference.jpg');
  } else {
    form.append('aspect_ratio', '3:2');
    form.append('seed', '42');
  }

  const res = await fetch(STABILITY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'image/*',
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Stability AI error ${res.status}: ${err.slice(0, 200)}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { description, pageNum, storyId, heroPortraitPrompt, sidekickPortraitPrompt } = req.body;

  if (!description) return res.status(400).json({ error: 'Description required' });
  if (!storyId)     return res.status(400).json({ error: 'storyId required' });

  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Stability API key not configured' });

  try {
    let imageBuffer;

    if (pageNum === 1) {
      // Page 1 — generate hero and sidekick portraits in parallel (text-to-image)
      const [heroBuffer, sidekickBuffer] = await Promise.all([
        generateImage(apiKey, heroPortraitPrompt || description),
        sidekickPortraitPrompt
          ? generateImage(apiKey, sidekickPortraitPrompt)
          : Promise.resolve(null),
      ]);

      // Cache both portraits for the rest of the story
      portraitCache.set(storyId, {
        hero: heroBuffer,
        sidekick: sidekickBuffer,
        timestamp: Date.now(),
      });

      // Page 1 shows the hero portrait
      imageBuffer = heroBuffer;

    } else {
      // Pages 2+ — ONE image-to-image call anchored to the hero portrait
      // The sidekick is included via the scene description text prompt,
      // not as a second reference image (which caused the overwrite bug)
      const cached = portraitCache.get(storyId);

      if (cached?.hero) {
        // Build an enriched prompt that explicitly names both characters' appearances
        // so the model knows what both should look like even though we only
        // pass the hero image as the visual anchor
        let enrichedPrompt = description;

        if (cached.sidekick && sidekickPortraitPrompt) {
          // Extract the core sidekick description from the portrait prompt
          // (strip the "full body portrait, neutral pose..." suffix)
          const sidekickDesc = sidekickPortraitPrompt
            .replace(/, full body character portrait.*$/i, '')
            .trim();
          enrichedPrompt = `${description} The sidekick companion looks like: ${sidekickDesc}.`;
        }

        imageBuffer = await generateImage(apiKey, enrichedPrompt, cached.hero, 0.60);
      } else {
        // No cache — plain text-to-image fallback
        imageBuffer = await generateImage(apiKey, description);
      }
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(imageBuffer);

  } catch (error) {
    console.error('Illustration error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
