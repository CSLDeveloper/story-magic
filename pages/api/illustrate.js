export const config = { maxDuration: 60 };

const FAL_HEADERS = (key) => ({
  'Authorization': `Key ${key}`,
  'Content-Type': 'application/json',
});

// Simple synchronous fal.run call — no SDK, no queue, no proxy
async function falRun(falKey, modelId, input) {
  const res = await fetch(`https://fal.run/${modelId}`, {
    method: 'POST',
    headers: FAL_HEADERS(falKey),
    body: JSON.stringify(input),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`fal.run ${modelId} failed ${res.status}: ${text.slice(0, 200)}`);
  }

  let data;
  try { data = JSON.parse(text); }
  catch(e) { throw new Error(`Bad JSON from fal: ${text.slice(0, 100)}`); }

  const url = data?.images?.[0]?.url;
  if (!url) throw new Error(`No image URL in response: ${text.slice(0, 200)}`);
  return url;
}

// Download a fal.media image URL and return a buffer
async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { heroPortraitPrompt, sidekickPortraitPrompt, description, pageNum, heroPortraitUrl } = req.body;
  const falKey = process.env.FAL_KEY;
  if (!falKey) return res.status(500).json({ error: 'FAL_KEY not configured' });

  try {
    // ── PAGE 1: Generate portrait ──────────────────────────────
    if (pageNum === 1) {
      if (!heroPortraitPrompt) return res.status(400).json({ error: 'heroPortraitPrompt required' });

      // Generate the TEMPLATE image: hero + sidekick together in the setting
      // (heroPortraitPrompt arrives fully styled from generate.js)
      // Landscape to match scene pages — Kontext keeps the template's framing
      const heroUrl = await falRun(falKey, 'fal-ai/flux-pro', {
        prompt: heroPortraitPrompt,
        image_size: 'landscape_4_3',
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        output_format: 'jpeg',
        seed: 42,
      });

      // Return portrait URLs as JSON — browser stores them for pages 2+
      return res.status(200).json({ heroPortraitUrl: heroUrl, sidekickPortraitUrl: null });
    }

    // ── PAGES 2+: Generate scene with FLUX Kontext ─────────
    if (!description) return res.status(400).json({ error: 'description required' });
    if (!heroPortraitUrl) return res.status(400).json({ error: 'heroPortraitUrl required for pages 2+' });

    let sceneUrl;
    try {
      // FLUX Kontext: transforms the template image into each page's scene
      // (same characters, same style, new action + background)
      sceneUrl = await falRun(falKey, 'fal-ai/flux-pro/kontext', {
        prompt: description,
        image_url: heroPortraitUrl,  // the page-1 template (hero + sidekick)
        aspect_ratio: '4:3',
        guidance_scale: 3.5,
        num_images: 1,
        output_format: 'jpeg',
      });
    } catch(e) {
      console.error('Kontext failed, falling back to FLUX Pro:', e.message);
      // Fallback: plain FLUX Pro text-to-image
      sceneUrl = await falRun(falKey, 'fal-ai/flux-pro', {
        prompt: `${description}, children's book watercolor illustration, soft pastel colors, no text`,
        image_size: 'landscape_4_3',
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        output_format: 'jpeg',
      });
    }

    // Download and return image buffer
    const buffer = await downloadImage(sceneUrl);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);

  } catch(error) {
    console.error('Illustration error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
