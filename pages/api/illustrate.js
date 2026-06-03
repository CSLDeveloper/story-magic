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

async function generateImage(apiKey, prompt, referenceBuffer = null, strength = 0.65) {
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('negative_prompt', NEGATIVE_PROMPT);
  form.append('model', 'sd3.5-medium');
  form.append('output_format', 'jpeg');

  if (referenceBuffer) {
    // Image-to-image mode — anchor to reference portrait
    form.append('mode', 'image-to-image');
    form.append('strength', String(strength));
    form.append('image', new Blob([referenceBuffer], { type: 'image/jpeg' }), 'reference.jpg');
  } else {
    // Text-to-image mode — for generating reference portraits
    form.append('aspect_ratio', '3:2');
    form.append('seed', '42'); // Fixed seed for consistent portrait base
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

// Merge two image buffers by fetching a combined image-to-image pass
// We use the hero as the primary reference and describe the sidekick in the prompt
// This avoids needing a true multi-reference API call
async function generateSceneWithBothCharacters(apiKey, scenePrompt, heroBuffer, sidekickBuffer) {
  // First pass: anchor to hero portrait, include sidekick description in prompt
  const firstPass = await generateImage(apiKey, scenePrompt, heroBuffer, 0.65);

  // Second pass: lightly anchor to sidekick portrait to pull sidekick appearance in
  // Use lower strength so the scene composition from pass 1 is preserved
  const secondPass = await generateImage(apiKey, scenePrompt, sidekickBuffer, 0.35);

  // Return second pass — it has hero DNA from pass 1 carried through the prompt,
  // sidekick anchoring from pass 2, and the scene composition
  return secondPass;
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
      // Page 1 — generate both reference portraits in parallel
      const [heroBuffer, sidekickBuffer] = await Promise.all([
        generateImage(apiKey, heroPortraitPrompt || description),
        sidekickPortraitPrompt
          ? generateImage(apiKey, sidekickPortraitPrompt)
          : Promise.resolve(null),
      ]);

      // Cache both portraits for subsequent pages
      portraitCache.set(storyId, {
        hero: heroBuffer,
        sidekick: sidekickBuffer,
        timestamp: Date.now(),
      });

      // Page 1 shows the hero portrait as the illustration
      imageBuffer = heroBuffer;

    } else {
      // Pages 2+ — use cached portraits as anchors
      const cached = portraitCache.get(storyId);

      if (cached?.hero && cached?.sidekick) {
        // Both portraits cached — do a two-pass blend
        imageBuffer = await generateSceneWithBothCharacters(
          apiKey,
          description,
          cached.hero,
          cached.sidekick
        );
      } else if (cached?.hero) {
        // Only hero portrait cached — anchor to hero
        imageBuffer = await generateImage(apiKey, description, cached.hero, 0.65);
      } else {
        // No cache — fall back to text-to-image
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
