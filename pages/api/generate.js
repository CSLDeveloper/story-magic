import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AGE_CONFIGS = {
  'Ages 3–6': {
    pages: 12,
    linesPerPage: '3-5 very short, simple sentences',
    vocabulary: 'Use only very simple words a 3-6 year old would know. Short sentences. Lots of repetition and rhythm. Very clear cause and effect. Think Dr. Seuss or The Very Hungry Caterpillar.',
    complexity: 'Single simple plot: hero has a problem, tries something, succeeds with help from sidekick. No subplots.',
    tone: 'Warm, playful, reassuring. Lots of sound words like "CRASH!", "WHOOSH!", "YAY!"',
    maxTokens: 3000,
  },
  'Ages 7–9': {
    pages: 15,
    linesPerPage: '5-8 sentences with some descriptive detail',
    vocabulary: 'Use age-appropriate vocabulary for 7-9 year olds. Can introduce a few interesting words but explain them in context. Think Magic Tree House or Captain Underpants.',
    complexity: 'Main plot with one small subplot. The hero faces a challenge, makes a mistake, learns something, and succeeds. The sidekick has a meaningful role.',
    tone: 'Fun, adventurous, and humorous. Some suspense and exciting moments. Heroes can feel scared or unsure but push through.',
    maxTokens: 4500,
  },
  'Ages 10–12': {
    pages: 22,
    linesPerPage: '8-12 sentences with rich description and detail',
    vocabulary: 'Use rich, expressive vocabulary appropriate for 10-12 year olds. Introduce vivid adjectives, metaphors, and descriptive language. Think Percy Jackson or Harry Potter chapter books.',
    complexity: 'Multi-layered plot with a clear beginning, rising action, climax, falling action, and resolution. Include character development, emotional depth, and meaningful conflict. The villain should have a believable motivation. The hero should grow and change.',
    tone: 'Engaging and immersive. Include internal thoughts and feelings of the hero. Build genuine suspense. The lesson should feel earned through the story rather than stated.',
    maxTokens: 6000,
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
  const heroDesc = gender === 'Girl' ? 'young girl hero' : 'young boy hero';

  const prompt = `Write an exciting, imaginative children's story perfectly suited for ${ageGroup}.

Story details:
- Hero's name: ${heroName} — ${heroDesc}, ${heroType}
- Hero's gender: ${gender} (use pronouns: ${pronoun})
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

FORMATTING RULES — follow exactly:
- Start with a creative story title on its own line
- For each page use this exact format:

--- Page X ---
[story text for this page]
IMG: [illustration prompt for this page]

CRITICAL RULES FOR IMG PROMPTS:
- Write the IMG line immediately after each page's story text
- The IMG must describe ONLY what is literally happening in the text just above it
- Identify the KEY ACTION verb from the page (running, hiding, fighting, crying, laughing) and put it in the IMG
- Name EVERY character who appears on that page by their role (young girl hero, talking dragon, troll king, etc)
- Describe their facial expression and body language (smiling, terrified, arms raised, crouching)
- Name the exact location from the page text (inside the dark cave, on top of the castle tower, underwater palace throne room)
- Describe the time of day or lighting if mentioned (glowing moonlight, bright sunny meadow, dark stormy sky)
- Format: [characters + expressions + action] + [exact location] + [lighting/mood] + "children's book watercolor illustration"
- Length: 20-25 words minimum
- NEVER write a generic or vague prompt — every word must come directly from what just happened on that page

Example of WRONG IMG (too vague):
IMG: hero and dragon in forest, watercolor

Example of CORRECT IMG (specific to the page):
IMG: young girl hero Luna laughing with arms wide open, tiny purple dragon Spark doing backflips, sunlit enchanted forest clearing, children's book watercolor illustration

Do NOT write a separate image section at the end — every IMG goes inline after its page.

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

    // Parse story pages and inline IMG prompts together
    const lines = text.split('\n');
    let title = '';
    let titleFound = false;
    const pages = [];
    let currentPageNum = null;
    let currentText = [];
    let currentImg = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Grab title (first non-page line)
      if (!titleFound && !trimmed.startsWith('---')) {
        title = trimmed;
        titleFound = true;
        continue;
      }

      // Page header
      const pageMatch = trimmed.match(/^---\s*Page\s*(\d+)\s*---/i);
      if (pageMatch) {
        // Save previous page
        if (currentPageNum !== null) {
          pages.push({ pageNum: currentPageNum, text: currentText.join(' '), img: currentImg });
        }
        currentPageNum = parseInt(pageMatch[1]);
        currentText = [];
        currentImg = null;
        continue;
      }

      // Inline IMG prompt
      const imgMatch = trimmed.match(/^IMG:\s*(.+)/i);
      if (imgMatch) {
        currentImg = imgMatch[1].trim();
        continue;
      }

      // Story text
      if (currentPageNum !== null) {
        currentText.push(trimmed);
      }
    }

    // Push last page
    if (currentPageNum !== null) {
      pages.push({ pageNum: currentPageNum, text: currentText.join(' '), img: currentImg });
    }

    // Build storyText for display and images array
    let storyText = title + '\n';
    const images = [];

    pages.forEach(p => {
      storyText += `\n--- Page ${p.pageNum} ---\n${p.text}\n`;
      // Enrich img prompt with consistent style — keep style suffix short so scene detail dominates
      const enrichedImg = p.img
        ? `${p.img}, no text, no words`
        : `${heroName} the ${heroType} in ${setting}, children's book watercolor illustration, soft pastel colors, no text`;
      images.push(enrichedImg);
    });

    return res.status(200).json({ story: storyText.trim(), images });

  } catch (error) {
    console.error('Anthropic API error:', error);
    return res.status(500).json({ error: 'Failed to generate story. Please try again.' });
  }
}
