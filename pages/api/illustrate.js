export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { description, pageNum } = req.body;
  if (!description) return res.status(400).json({ error: 'Description required' });

  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Stability API key not configured' });
  }

  const prompt = `Children's book illustration, watercolor style, soft colors, cute and friendly, ${description}. No text, no words, storybook art.`;

  try {
    const response = await fetch(
      'https://api.stability.ai/v2beta/stable-image/generate/core',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'image/*',
        },
        body: (() => {
          const form = new FormData();
          form.append('prompt', prompt);
          form.append('negative_prompt', 'text, words, letters, scary, dark, violent, ugly, realistic, photo');
          form.append('aspect_ratio', '3:2');
          form.append('style_preset', 'fantasy-art');
          form.append('seed', String((pageNum * 7919) % 4294967295));
          form.append('output_format', 'jpeg');
          return form;
        })(),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Stability API error ${response.status}: ${errText}`);
    }

    const imageBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(imageBuffer));

  } catch (error) {
    console.error('Stability AI error:', error);
    res.status(500).json({ error: error.message });
  }
}
