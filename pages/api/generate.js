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

  // Random seed elements to guarantee a unique story every time
  const randomSeeds = {
    openingHook: [
      'Start with an unexpected discovery',
      'Start with a problem that appears out of nowhere',
      'Start on an ordinary day that suddenly changes',
      'Start with a mysterious message or sign',
      'Start with the hero making a mistake',
      'Start with something strange appearing in the sky',
      'Start with the hero overhearing a secret',
      'Start with an unusual gift or object appearing',
    ],
    twist: [
      'Include a surprising moment where the sidekick saves the day unexpectedly',
      'Include a moment where the villain almost wins',
      'Include a scene where the hero loses their special power temporarily',
      'Include a moment where the hero and villain have to work together briefly',
      'Include a surprising discovery about the villain\'s true motivation',
      'Include a moment where the hero doubts themselves before finding courage',
      'Include an unexpected character who helps at a critical moment',
      'Include a twist where things get worse before they get better',
    ],
    setting_detail: [
      'Feature a hidden location within the setting that only the hero discovers',
      'Feature an unusual weather event that affects the story',
      'Feature a specific time of day — dawn, dusk, midnight, or noon — as important to the plot',
      'Feature a celebration or festival happening in the background',
      'Feature a magical object found in the environment',
      'Feature an ancient or mysterious place within the setting',
    ],
  };

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const uniqueDirective = `
STORY UNIQUENESS REQUIREMENTS (these make your story different from any other):
- ${pick(randomSeeds.openingHook)}
- ${pick(randomSeeds.twist)}
- ${pick(randomSeeds.setting_detail)}
- Give the hero a specific name for their special power (invent something creative)
- The villain should have one unexpected personality quirk that makes them memorable
`;

  const storyPrompt = `Write an exciting, imaginative children's story perfectly suited for ${ageGroup}.

Story details:
- Hero's name: ${heroName} — ${heroDesc}, ${heroType}
- Hero's gender: ${gender} (use pronouns: ${pronoun})
- Sidekick/best friend: ${sidekick}
- Setting/world: ${setting}
- Special power: ${power}
- Villain: ${villain}
- Lesson/moral: ${lesson}

${uniqueDirective}

AGE GROUP REQUIREMENTS (${ageGroup}):
- Number of pages: exactly ${config.pages} pages
- Length per page: ${config.linesPerPage}
- Vocabulary and style: ${config.vocabulary}
- Story complexity: ${config.complexity}
- Tone: ${config.tone}

FORMATTING RULES:
- Start with a creative story title on its own line
- Use "--- Page X ---" as a header for each page
- Write ONLY the story text — no image descriptions, no IMG lines
- Keep the story text clean and focused on the narrative

Write the complete story now:`;

  try {
    // --- PASS 1: Write the story ---
    const storyMessage = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: config.maxTokens,
      temperature: 1.0,
      messages: [{ role: 'user', content: storyPrompt }],
    });

    const storyText = storyMessage.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    // Parse pages from the story text
    const lines = storyText.split('\n');
    let title = '';
    let titleFound = false;
    const pages = [];
    let currentPageNum = null;
    let currentText = [];

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
          pages.push({ pageNum: currentPageNum, text: currentText.join(' ') });
        }
        currentPageNum = parseInt(pageMatch[1]);
        currentText = [];
        continue;
      }

      if (currentPageNum !== null) {
        currentText.push(trimmed);
      }
    }
    if (currentPageNum !== null) {
      pages.push({ pageNum: currentPageNum, text: currentText.join(' ') });
    }

    // Determine which pages need illustrations
    const illustratedPages = pages.filter(p => {
      if (ageGroup === 'Ages 3–6') return true;
      if (ageGroup === 'Ages 7–9') return p.pageNum % 2 !== 0;
      if (ageGroup === 'Ages 10–12') return p.pageNum === 1;
      return false;
    });

    // --- PASS 2: Write rich art director image prompts ---
    // Only for pages that will actually be illustrated
    const imagePromptRequest = illustratedPages.map(p =>
      `PAGE ${p.pageNum}: ${p.text}`
    ).join('\n\n');

    const imagePrompt = `You are an art director briefing a professional children's book illustrator.

You have a story with these characters:
- HERO: ${bible.hero}
- SIDEKICK: ${bible.partner}  
- VILLAIN: ${bible.baddie}
- SETTING: ${setting}
- ART STYLE: Warm watercolor children's book illustration, soft pastel colors, expressive faces, cinematic lighting, storybook quality

Here are the story pages that need illustrations:

${imagePromptRequest}

For EACH page write a rich, detailed illustration prompt (40-60 words) that:
1. Starts with the exact character appearance (copy verbatim from above for any character on this page)
2. Describes the precise ACTION and EMOTION — what are they doing, what expression do they have, body language
3. Describes the BACKGROUND in detail — time of day, weather, specific environmental elements from the page text
4. Describes the LIGHTING and MOOD — magical glow, dramatic shadows, warm sunlight, etc.
5. Ends with the art style

Format each as:
PAGE X: [prompt]

Write ONLY the prompts, nothing else.`;

    const imgMessage = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      temperature: 0.7,
      messages: [{ role: 'user', content: imagePrompt }],
    });

    const imgText = imgMessage.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    // Parse image prompts keyed by page number
    const imgPromptMap = {};
    const imgLines = imgText.split('\n').filter(l => l.trim());
    for (const line of imgLines) {
      const match = line.match(/^PAGE\s+(\d+):\s*(.+)/i);
      if (match) {
        imgPromptMap[parseInt(match[1])] = match[2].trim();
      }
    }

    // Build final story text and images array
    let finalStory = title + '\n';
    const images = [];

    pages.forEach(p => {
      finalStory += `\n--- Page ${p.pageNum} ---\n${p.text}\n`;

      let includeIllustration = false;
      if (ageGroup === 'Ages 3–6') includeIllustration = true;
      else if (ageGroup === 'Ages 7–9') includeIllustration = p.pageNum % 2 !== 0;
      else if (ageGroup === 'Ages 10–12') includeIllustration = p.pageNum === 1;

      if (includeIllustration && imgPromptMap[p.pageNum]) {
        images.push(`${imgPromptMap[p.pageNum]}, no text, no words`);
      } else if (includeIllustration) {
        // Fallback if prompt wasn't generated for this page
        images.push(`${bible.hero}, ${setting}, children's book watercolor illustration, soft pastel colors, no text`);
      } else {
        images.push(null);
      }
    });

    return res.status(200).json({
      story: finalStory.trim(),
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
