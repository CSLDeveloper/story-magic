export default function handler(req, res) {
  res.status(200).json({
    anthropic:  process.env.ANTHROPIC_API_KEY  ? 'SET' : 'MISSING',
    fal_ai:     process.env.FAL_KEY            ? 'SET' : 'MISSING',
    openai:     process.env.OPENAI_API_KEY     ? 'SET' : 'MISSING',
  });
}
