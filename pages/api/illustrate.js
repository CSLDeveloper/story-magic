export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { description, pageNum, attempt = 0 } = req.body;
  if (!description) return res.status(400).json({ error: 'Description required' });

  const style = 'childrens book illustration colorful watercolor cute friendly';
  const fullPrompt = `${description}, ${style}`;
  const encoded = encodeURIComponent(fullPrompt);
  const seed = (pageNum * 7) + (attempt * 31);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=512&height=384&seed=${seed}&nologo=true&enhance=false&model=flux`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 40000);

    const imgRes = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!imgRes.ok) throw new Error(`Pollinations returned ${imgRes.status}`);

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await imgRes.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(buffer));

  } catch (err) {
    console.error('Illustration error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
