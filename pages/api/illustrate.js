// In-memory portrait cache per story session
const portraitCache = new Map();

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, val] of portraitCache.entries()) {
    if (val.timestamp < cutoff) portraitCache.delete(key);
  }
}, 10 * 60 * 1000);

const NEGATIVE_PROMPT = [
  'text', 'words', 'letters', 'numbers', 'watermark',
  'scary', 'violent', 'realistic photo', 'blurry',
  'deformed', 'extra limbs', 'bad anatomy', 'ugly',
  'wrong species', 'inconsistent character',
].join(', ');

// Text-to-image using SD3.5 — for generating the reference portrait
async function textToImage(apiKey, prompt) {
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('negative_prompt', NEGATIVE_PROMPT);
  form.append('model', 'sd3.5-medium');
  form.append('aspect_ratio', '1:1'); // Square for portrait
  form.append('output_format', 'jpeg');
  form.append('seed', '42');

  const res = await fetch('https://api.stability.ai/v2beta/stable-image/generate/sd3', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'image/*' },
    body: form,
  });

  if (!res.ok) throw new Error(`Portrait generation failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

// Style Transfer — applies the character portrait's visual style to a new scene
// This is fundamentally different from image-to-image:
// instead of modifying the portrait, it uses the portrait as a style reference
// and generates a completely new scene with that character's visual DNA
async function styleTransfer(apiKey, scenePrompt, portraitBuffer, fidelity = 0.7) {
  const form = new FormData();
  form.append('prompt', scenePrompt);
  form.append('negative_prompt', NEGATIVE_PROMPT);
  form.append('fidelity', String(fidelity));
  form.append('output_format', 'jpeg');
  // The portrait is the style reference, not the scene base
  form.append('image', new Blob([portraitBuffer], { type: 'image/jpeg' }), 'style_reference.jpg');

  const res = await fetch('https://api.stability.ai/v2beta/stable-image/edit/style', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'image/*' },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    // If style transfer endpoint fails, fall back to text-to-image
    console.warn(`Style transfer failed (${res.status}), falling back to text-to-image: ${err.slice(0, 100)}`);
    return null;
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
      // Page 1: generate hero portrait (text-to-image, fixed seed for consistency)
      // Also generate sidekick portrait in parallel
      const [heroBuffer, sidekickBuffer] = await Promise.all([
        textToImage(apiKey, heroPortraitPrompt || description),
        sidekickPortraitPrompt
          ? textToImage(apiKey, sidekickPortraitPrompt)
          : Promise.resolve(null),
      ]);

      portraitCache.set(storyId, {
        hero: heroBuffer,
        sidekick: sidekickBuffer,
        timestamp: Date.now(),
      });

      // Return hero portrait as page 1 illustration
      imageBuffer = heroBuffer;

    } else {
      // Pages 2+: wait up to 30s for page 1 portrait to be cached
      let cached = portraitCache.get(storyId);
      if (!cached?.hero) {
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 1000));
          cached = portraitCache.get(storyId);
          if (cached?.hero) break;
        }
      }

      if (cached?.hero) {
        // Build scene prompt with both character descriptions embedded
        let scenePrompt = description;
        if (cached.sidekick && sidekickPortraitPrompt) {
          const sidekickDesc = sidekickPortraitPrompt
            .replace(/, full body character portrait.*$/i, '')
            .trim();
          scenePrompt = `${description} Sidekick is: ${sidekickDesc}.`;
        }

        // Use style transfer with hero portrait as the style reference
        // fidelity 0.7 = strong character style carried through, scene still varies
        imageBuffer = await styleTransfer(apiKey, scenePrompt, cached.hero, 0.7);

        // If style transfer failed, fall back to plain text-to-image
        if (!imageBuffer) {
          const form = new FormData();
          form.append('prompt', scenePrompt);
          form.append('negative_prompt', NEGATIVE_PROMPT);
          form.append('model', 'sd3.5-medium');
          form.append('aspect_ratio', '3:2');
          form.append('output_format', 'jpeg');
          const fallback = await fetch('https://api.stability.ai/v2beta/stable-image/generate/sd3', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'image/*' },
            body: form,
          });
          imageBuffer = Buffer.from(await fallback.arrayBuffer());
        }
      } else {
        // Portrait never arrived — plain text-to-image
        const form = new FormData();
        form.append('prompt', description);
        form.append('negative_prompt', NEGATIVE_PROMPT);
        form.append('model', 'sd3.5-medium');
        form.append('aspect_ratio', '3:2');
        form.append('output_format', 'jpeg');
        const fallback = await fetch('https://api.stability.ai/v2beta/stable-image/generate/sd3', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'image/*' },
          body: form,
        });
        imageBuffer = Buffer.from(await fallback.arrayBuffer());
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
