import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AGE_CONFIGS = {
  'Ages 3–6': {
    pages: 12,
    linesPerPage: '3-5 very short, simple sentences',
    vocabulary: 'Use only very simple words a 3-6 year old would know. Short sentences. Lots of repetition and rhythm. Very clear cause and effect. Think Dr. Seuss or The Very Hungry Caterpillar.',
    complexity: 'Single simple plot: hero has a problem, tries something, succeeds with help from sidekick. No subplots.',
    tone: 'Warm, playful, reassuring. Lots of sound words like "CRASH!", "WHOOSH!", "YAY!"',
    maxTokens: 2500,
  },
  'Ages 7–9': {
    pages: 15,
    linesPerPage: '5-8 sentences with some descriptive detail',
    vocabulary: 'Use age-appropriate vocabulary for 7-9 year olds. Can introduce a few interesting words but explain them in context. Think Magic Tree House or Captain Underpants.',
    complexity: 'Main plot with one small subplot. The hero faces a challenge, makes a mistake, learns something, and succeeds. The sidekick has a meaningful role.',
    tone: 'Fun, adventurous, and humorous. Some suspense and exciting moments. Heroes can feel scared or unsure but push through.',
    maxTokens: 3500,
  },
  'Ages 10–12': {
    pages: 22,
    linesPerPage: '8-12 sentences with rich description and detail',
    vocabulary: 'Use rich, expressive vocabulary appropriate for 10-12 year olds. Introduce vivid adjectives, metaphors, and descriptive language. Think Percy Jackson or Harry Potter chapter books.',
    complexity: 'Multi-layered plot with a clear beginning, rising action, climax, falling action, and resolution. Include character development, emotional depth, and meaningful conflict. The villain should have a believable motivation. The hero should grow and change.',
    tone: 'Engaging and immersive. Include internal thoughts and feelings of the hero. Build genuine suspense. The lesson should feel earned through the story rather than stated.',
    maxTokens: 5000,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ageGroup, heroName, gender, heroType, sidekick, setting, power, villain, lesson } = req.body;

  if (!ageGroup || !heroName || !gender || !heroType || !sidekick || !setting || !power || !villain || !lesson) {
    return res.status(400).json({ error: 'All story variables are required' });
  }

  const config = AGE_CONFIGS[ageGroup] || AGE_CONFIGS['Ages 7–9'];
  const pronoun = gender === 'Girl' ? 'she/her' : 'he/him';

  const prompt = `Write an exciting, imaginative children's story perfectly suited for ${ageGroup}.

Story details:
- Hero's name: ${heroName}
- Hero's gender: ${gender} (use pronouns: ${pronoun})
- Hero type: ${heroType}
- Sidekick/best friend: ${sidekick}
- Setting/world: ${setting}
- Special power: ${power}
- Villain: ${villain}
- Lesson/moral: ${lesson}

AGE GROUP REQUIREMENTS (${ageGroup}):
- Number of pages: exactly ${config.pages} pages
- Length per page: ${config.linesPerPage}
- Vocabulary and style: ${config.vocabulary}
- Story complexity: ${config.complexity}
- Tone: ${config.tone}

FORMATTING RULES:
- Start with a creative story title on its own line
- Use "--- Page X ---" as a header for each page (where X is the page number)
- After the last page write "--- END ---" on its own line
- Then write image descriptions: one per page, format as "IMG1: description" through "IMG${config.pages}: description"
- Each image description should be 8-12 words, vivid, child-friendly, and capture the key moment of that page

Write the complete story now:`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: config.maxTokens,
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
