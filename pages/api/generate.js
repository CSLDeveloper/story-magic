import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { heroName, gender, heroType, sidekick, setting, power, villain, lesson } = req.body;

  if (!heroName || !gender || !heroType || !sidekick || !setting || !power || !villain || !lesson) {
    return res.status(400).json({ error: 'All story variables are required' });
  }

  const pronoun = gender === 'Girl' ? 'she/her' : 'he/him';

  const prompt = `Write an exciting, imaginative children's short story that is exactly 12 pages long.
Use "--- Page X ---" as a header for each of the 12 pages (where X is the page number).

Story details:
- Hero's name: ${heroName}
- Hero's gender: ${gender} (use pronouns: ${pronoun})
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
- Use the correct gender pronouns throughout

Format: Start with a creative story title on its own line, then write all 12 pages.
After the last page, on a new line write "--- END ---"
Then on the next line, for each page write a SHORT image description (10 words max) perfect for illustration.
Format each as: "IMG1: description" "IMG2: description" etc. all on separate lines.
These descriptions will be used to generate illustrations so make them vivid and child-friendly.`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    // Split story from image descriptions
    const parts = text.split('--- END ---');
    const storyText = parts[0].trim();

    // Parse image descriptions
    const imgDescriptions = [];
    if (parts[1]) {
      const imgLines = parts[1].trim().split('\n').filter(l => l.trim());
      imgLines.forEach(line => {
        const match = line.match(/IMG\d+:\s*(.+)/);
        if (match) imgDescriptions.push(match[1].trim());
      });
    }

    return res.status(200).json({ story: storyText, images: imgDescriptions });
  } catch (error) {
    console.error('Anthropic API error:', error);
    return res.status(500).json({ error: 'Failed to generate story. Please try again.' });
  }
}
