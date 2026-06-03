export default function handler(req, res) {
  const stability = process.env.STABILITY_API_KEY ? 'SET' : 'MISSING';
  const elevenlabs = process.env.ELEVENLABS_API_KEY ? 'SET' : 'MISSING';
  const anthropic = process.env.ANTHROPIC_API_KEY ? 'SET' : 'MISSING';
  res.status(200).json({ stability, elevenlabs, anthropic });
}
