import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { heroName, heroType, sidekick, setting, power, villain, lesson } = req.body;

  if (!heroName || !heroType || !sidekick || !setting || !power || !villain || !lesson) {
    return res.status(400).json({ error: 'All story variables are required' });
  }

  const prompt = `Write an exciting, imaginative children's short story that is exactly 12 pages long.
Use "--- Page X ---" as a header for each of the 12 pages (where X is the page number).

Story details:
- Hero's name: ${heroName}
- Hero type: ${heroType}
- Sidekick/best friend: ${sidekick}
- Setting/world: ${setting}
- Special power: ${power}
- Villain: ${villain}
- Lesson/moral: ${lesson}

Requirements:
- Write for children ages 6-10
- Each page should be 3-5 sentences, vivid and fun
- Include exciting action, humor, and heart
- The hero uses their special power cleverly to help defeat the villain
- The sidekick helps the hero at a key moment
- End with the lesson learned naturally, not preachy
- Use simple, wonderful language that paints pictures in the imagination
- Make it feel like a real published children's book

Format: Start with a creative story title on its own line, then write all 12 pages.`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    return res.status(200).json({ story: text });
  } catch (error) {
    console.error('Anthropic API error:', error);
    return res.status(500).json({ error: 'Failed to generate story. Please try again.' });
  }
}
