export const config = { maxDuration: 300 };

// Submit to fal queue and poll until complete
// Correct URLs per fal docs:
//   Status: queue.fal.run/{endpoint}/requests/{id}/status
//   Result: queue.fal.run/{endpoint}/requests/{id}  (no /result suffix)
async function falQueue(falKey, endpointId, input, timeoutMs = 180000) {
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
    throw new Error(`Submit failed ${submitRes.status}: ${err.slice(0, 300)}`);
  }

  const submitData = await submitRes.json();
  const requestId = submitData.request_id;
  if (!requestId) throw new Error(`No request_id: ${JSON.stringify(submitData).slice(0, 200)}`);

  const statusUrl = `https://queue.fal.run/${endpointId}/requests/${requestId}/status`;
  const resultUrl = `https://queue.fal.run/${endpointId}/requests/${requestId}`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000));

    const statusRes = await fetch(statusUrl, {
      headers: { 'Authorization': `Key ${falKey}` },
    });
    if (!statusRes.ok) continue;

    const statusData = await statusRes.json();

    if (statusData.status === 'COMPLETED') {
      const resultRes = await fetch(resultUrl, {
        headers: { 'Authorization': `Key ${falKey}` },
      });
      if (!resultRes.ok) throw new Error(`Result fetch failed: ${resultRes.status}`);
      const result = await resultRes.json();

      const imageUrl = result?.images?.[0]?.url || result?.image?.url;
      if (!imageUrl) throw new Error(`No image URL: ${JSON.stringify(result).slice(0, 200)}`);

      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error(`Image download failed: ${imgRes.status}`);
      return { buffer: Buffer.from(await imgRes.arrayBuffer()), url: imageUrl };
    }

    if (statusData.status === 'FAILED') {
      throw new Error(`fal job failed: ${String(statusData.error || statusData).slice(0, 200)}`);
    }
  }

  throw new Error(`fal timed out after ${timeoutMs / 1000}s`);
}

async function generatePortrait(falKey, prompt) {
  return falQueue(falKey, 'fal-ai/flux-pro', {
    prompt: `${prompt}, full body, neutral standing pose, plain white background, children's book watercolor illustration, soft pastel colors, cute expressive face, no text`,
    image_size: 'portrait_4_3',
    num_inference_steps: 28,
    guidance_scale: 3.5,
    num_images: 1,
    output_format: 'jpeg',
    seed: 42,
  });
}

async function generateScene(falKey, scenePrompt, portraitUrl) {
  return falQueue(falKey, 'fal-ai/instant-character', {
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    description, pageNum, storyId,
    heroPortraitPrompt, sidekickPortraitPrompt,
    heroPortraitUrl  // passed by browser for pages 2+ — no server cache needed
  } = req.body;

  if (!description) return res.status(400).json({ error: 'Description required' });

  const falKey = process.env.FAL_KEY;
  if (!falKey) return res.status(500).json({ error: 'FAL_KEY not configured' });

  try {
    if (pageNum === 1) {
      // Generate hero portrait (and optionally sidekick) via text-to-image
      const [heroResult, sidekickResult] = await Promise.all([
        generatePortrait(falKey, heroPortraitPrompt || description),
        sidekickPortraitPrompt
          ? generatePortrait(falKey, sidekickPortraitPrompt).catch(e => {
              console.warn('Sidekick portrait failed:', e.message);
              return null;
            })
          : Promise.resolve(null),
      ]);

      // Return portrait URL in header so browser can store it
      // Browser passes this back for all subsequent pages — no server memory needed
      res.setHeader('x-portrait-url', heroResult.url);
      if (sidekickResult?.url) res.setHeader('x-sidekick-url', sidekickResult.url);
      res.setHeader('Access-Control-Expose-Headers', 'x-portrait-url, x-sidekick-url');
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(heroResult.buffer);
    }

    // Pages 2+: browser sends back the portrait URL it received from page 1
    if (!heroPortraitUrl) {
      return res.status(400).json({ error: 'heroPortraitUrl required for pages 2+' });
    }

    // Build enriched scene prompt with sidekick description in text
    let scenePrompt = description;
    if (sidekickPortraitPrompt) {
      const sidekickDesc = sidekickPortraitPrompt.replace(/, full body.*$/i, '').trim();
      scenePrompt = `${description} The sidekick companion looks like: ${sidekickDesc}.`;
    }

    const sceneResult = await generateScene(falKey, scenePrompt, heroPortraitUrl);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(sceneResult.buffer);

  } catch (error) {
    console.error('Illustration error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
