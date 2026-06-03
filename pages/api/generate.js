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

// Build locked visual descriptions for each character type
// These stay identical in every IMG prompt so the AI sees the same character every time
function buildCharacterBible(heroName, gender, heroType, sidekick, villain) {

  const heroLook = {
    'A brave knight':    gender === 'Girl'
      ? `${heroName}, young girl with bright determined eyes, shiny silver armor with pink trim, long hair tucked under a helmet`
      : `${heroName}, young boy with bright determined eyes, shiny silver armor, short hair under a silver helmet`,
    'A clever wizard':   gender === 'Girl'
      ? `${heroName}, young girl with curious sparkling eyes, long purple star-covered robe, pointed purple hat, carrying a glowing wand`
      : `${heroName}, young boy with curious sparkling eyes, long blue star-covered robe, pointed blue hat, carrying a glowing wand`,
    'A space explorer':  gender === 'Girl'
      ? `${heroName}, young girl with ponytail, white space suit with orange stripe, clear bubble helmet, backpack with wings`
      : `${heroName}, young boy with messy hair, white space suit with blue stripe, clear bubble helmet, jet backpack`,
    'A magical fairy':   gender === 'Girl'
      ? `${heroName}, small girl fairy with rainbow butterfly wings, sparkly pink dress, rosy cheeks, golden wand with a star`
      : `${heroName}, small boy fairy with green dragonfly wings, sparkly green tunic, freckles, silver wand with a star`,
    'A talking animal':  gender === 'Girl'
      ? `${heroName}, small girl fox with bright amber eyes, fluffy orange tail with white tip, wearing a tiny red scarf`
      : `${heroName}, small boy fox with bright amber eyes, fluffy orange tail with white tip, wearing a tiny blue scarf`,
    'A superhero kid':   gender === 'Girl'
      ? `${heroName}, young girl with confident smile, bright red cape, yellow lightning bolt on chest, red boots, dark curly hair`
      : `${heroName}, young boy with confident smile, bright red cape, yellow lightning bolt on chest, red boots, dark spiky hair`,
  };

  const sidekickLook = {
    'A talking dragon':    'small friendly purple dragon with big yellow eyes, tiny wings, round belly, always smiling',
    'A robot dog':         'shiny silver robot dog with big round blue LED eyes, wagging antenna tail, four sturdy legs',
    'A tiny unicorn':      'palm-sized white unicorn with pastel rainbow mane, tiny golden horn, big gentle brown eyes',
    'A wise old owl':      'round fluffy brown owl with large gold spectacles, white eyebrows, perched with wings folded',
    'A mischievous cat':   'orange tabby cat with bright green eyes, striped tail always curled up, wide grin',
    'A friendly giant':    'enormous gentle giant with bushy red hair, kind blue eyes, patched overalls, always crouching to be at eye level',
  };

  const villainLook = {
    'An evil shadow queen':  'tall woman in flowing black gown, silver crown, pale face, dark swirling shadows around her hands',
    'A grumpy troll king':   'stocky green troll with a lopsided crown, big warty nose, crossed arms, permanent frown',
    'A sneaky sorcerer':     'thin sly man in dark green robes, pointed grey beard, shifty narrow eyes, crooked wooden staff',
    'A robot overlord':      'towering silver robot with red glowing eyes, claw hands, spinning gears on chest, loud clanking steps',
    'A mean sea monster':    'huge purple sea serpent with yellow eyes, jagged fins, dripping seaweed, enormous open mouth',
    'A jealous witch':       'hunched woman in tattered purple dress, wild green hair, crooked black hat, clutching a bubbling cauldron',
  };

  const hero    = heroLook[heroType]    || `${heroName}, young ${gender === 'Girl' ? 'girl' : 'boy'} hero in adventure clothing`;
  const partner = sidekickLook[sidekick] || 'small friendly magical creature companion';
  const baddie  = villainLook[villain]   || 'dark menacing villain';

  return { hero, partner, baddie };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ageGroup, heroName, gender, heroType, sidekick, setting, power, villain, lesson } = req.body;

  if (!ageGroup || !heroName || !gender || !heroType || !sidekick || !setting || !power || !villain || !lesson) {
    return res.status(400).json({ error: 'All story variables are required' });
  }

  const config  = AGE_CONFIGS[ageGroup] || AGE_CONFIGS['Ages 7–9'];
  const pronoun = gender === 'Girl' ? 'she/her' : 'he/him';
  const heroDesc = gender === 'Girl' ? 'young girl hero' : 'young boy hero';
  const bible   = buildCharacterBible(heroName, gender, heroType, sidekick, villain);

  // This block is prepended to every IMG prompt so every page has the same character anchor
  const characterAnchor = `HERO always looks like: ${bible.hero}. SIDEKICK always looks like: ${bible.partner}. VILLAIN always looks like: ${bible.baddie}.`;

  const prompt = `Write an exciting, imaginative children's story perfectly suited for ${ageGroup}.

Story details:
- Hero's name: ${heroName} — ${heroDesc}, ${heroType}
- Hero's gender: ${gender} (use pronouns: ${pronoun})
- Sidekick/best friend: ${sidekick}
- Setting/world: ${setting}
- Special power: ${power}
- Villain: ${villain}
- Lesson/moral: ${lesson}

CHARACTER APPEARANCE (use these exact descriptions whenever writing IMG prompts):
- HERO: ${bible.hero}
- SIDEKICK: ${bible.partner}
- VILLAIN: ${bible.baddie}

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
- Begin EVERY IMG with the exact character appearance description above for whichever characters appear on that page — copy it word for word
- Then describe the KEY ACTION happening on that page (the specific moment, expression, body language)
- Then name the exact location and lighting from the page text
- End with: children's book watercolor illustration, soft pastel colors, no text
- Length: 25-35 words
- The character descriptions must be IDENTICAL across every page they appear on — never vary hair, clothing, or features

Example of CORRECT IMG:
IMG: ${bible.hero}, grinning and jumping with fists raised in triumph, ${setting}, golden afternoon sunlight, children's book watercolor illustration, soft pastel colors, no text

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
    let currentText  = [];
    let currentImg   = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (!titleFound && !trimmed.startsWith('---')) {
        title = trimmed;
        titleFound = true;
        continue;
      }

      const pageMatch = trimmed.match(/^---\s*Page\s*(\d+)\s*---/i);
      if (pageMatch) {
        if (currentPageNum !== null) {
          pages.push({ pageNum: currentPageNum, text: currentText.join(' '), img: currentImg });
        }
        currentPageNum = parseInt(pageMatch[1]);
        currentText = [];
        currentImg  = null;
        continue;
      }

      const imgMatch = trimmed.match(/^IMG:\s*(.+)/i);
      if (imgMatch) {
        currentImg = imgMatch[1].trim();
        continue;
      }

      if (currentPageNum !== null) {
        currentText.push(trimmed);
      }
    }

    if (currentPageNum !== null) {
      pages.push({ pageNum: currentPageNum, text: currentText.join(' '), img: currentImg });
    }

    let storyText = title + '\n';
    const images  = [];

    pages.forEach(p => {
      storyText += `\n--- Page ${p.pageNum} ---\n${p.text}\n`;
      // Prepend the character anchor to every image prompt so Stability AI sees it every time
      const enrichedImg = p.img
        ? `${p.img} | ${characterAnchor} | no text, no words`
        : `${bible.hero}, ${setting}, children's book watercolor illustration, soft pastel colors, no text | ${characterAnchor}`;
      images.push(enrichedImg);
    });

    return res.status(200).json({
      story: storyText.trim(),
      images,
      storyId: `story_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      heroPortraitPrompt: `${bible.hero}, full body character portrait, neutral pose, plain simple background, children's book watercolor illustration, soft pastel colors, cute and friendly, no text`,
      sidekickPortraitPrompt: `${bible.partner}, full body character portrait, neutral pose, plain simple background, children's book watercolor illustration, soft pastel colors, cute and friendly, no text`,
    });

  } catch (error) {
    console.error('Anthropic API error:', error);
    return res.status(500).json({ error: 'Failed to generate story. Please try again.' });
  }
}
