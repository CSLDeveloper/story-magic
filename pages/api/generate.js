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

  // Pick unique story elements — assigned to specific story beats so they land correctly
  const openingHook   = pick(randomSeeds.openingHook);
  const twist         = pick(randomSeeds.twist);
  const settingDetail = pick(randomSeeds.setting_detail);

  // Build a story beat outline proportional to page count
  // This keeps the narrative on track across longer stories
  const third  = Math.floor(config.pages / 3);
  const two3rd = Math.floor(config.pages * 2 / 3);

  const outlinePrompt = `Plan a ${config.pages}-page children's story with these details:
- Hero: ${heroName}, ${heroDesc}, ${heroType}
- Sidekick: ${sidekick}
- Setting: ${setting}
- Power: ${power}
- Villain: ${villain}
- Lesson: ${lesson}
- Opening: ${openingHook}
- Twist (around page ${two3rd}): ${twist}
- Setting detail to use: ${settingDetail}

Write a tight story outline with exactly ${config.pages} numbered beats, one sentence each.
Every beat must follow logically from the previous one.
The story must have a clear arc: Setup (pages 1-${third}), Conflict (pages ${third+1}-${two3rd}), Resolution (pages ${two3rd+1}-${config.pages}).
Format: "1. [beat]" through "${config.pages}. [beat]"
Write ONLY the numbered beats, nothing else.`;

  try {
    // --- PASS 0: Generate story outline for narrative coherence ---
    const outlineMessage = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      temperature: 0.85,
      messages: [{ role: 'user', content: outlinePrompt }],
    });

    const outline = outlineMessage.content
      .filter(b => b.type === 'text').map(b => b.text).join('');

    const storyPrompt = `Write an exciting, imaginative children's story perfectly suited for ${ageGroup}.

Story details:
- Hero's name: ${heroName} — ${heroDesc}, ${heroType}
- Hero's gender: ${gender} (use pronouns: ${pronoun})
- Sidekick/best friend: ${sidekick}
- Setting/world: ${setting}
- Special power: ${power}
- Villain: ${villain}
- Lesson/moral: ${lesson}

STORY OUTLINE — follow this beat-by-beat, one beat per page, in order:
${outline}

AGE GROUP REQUIREMENTS (${ageGroup}):
- Number of pages: exactly ${config.pages} pages
- Length per page: ${config.linesPerPage}
- Vocabulary and style: ${config.vocabulary}
- Story complexity: ${config.complexity}
- Tone: ${config.tone}

CRITICAL NARRATIVE RULES:
- Every page must follow directly and logically from the previous page
- Each page covers exactly ONE beat from the outline above — do not skip or combine beats
- The hero, sidekick and villain must behave consistently throughout
- The lesson must emerge naturally from events — never state it directly until the final page
- Do NOT introduce new characters or locations not in the outline

FORMATTING RULES:
- Start with a creative story title on its own line
- Use "--- Page X ---" as a header for each page
- Write ONLY the story text — no image descriptions
- Keep story text clean and focused on the narrative

Write the complete story now, following the outline beat by beat:`;

    // --- PASS 1: Write the story (guided by outline) ---
    const storyMessage = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: config.maxTokens,
      temperature: 0.85,
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

    // Determine which pages need illustrations (age-based scheme)
    const illustratedPages = pages.filter(p => {
      if (ageGroup === 'Ages 3–6') return true;
      if (ageGroup === 'Ages 7–9') return p.pageNum % 2 !== 0;
      if (ageGroup === 'Ages 10–12') return p.pageNum === 1;
      return false;
    });

    // --- PASS 2: Kontext scene prompts (pages 2+) ---
    // Page 1 IS the template (hero + sidekick), so only later pages need scene prompts
    const scenePagesNeedingPrompts = illustratedPages.filter(p => p.pageNum !== 1);

    const imagePromptRequest = scenePagesNeedingPrompts.map(p =>
      `PAGE ${p.pageNum}: ${p.text}`
    ).join('\n\n');

    let imgPromptMap = {};

    if (scenePagesNeedingPrompts.length > 0) {
      const imagePrompt = `You are a children's book illustrator writing scene instructions for FLUX Kontext, an AI image editor.

HOW KONTEXT WORKS (critical — this shapes how you write):
- Kontext receives a TEMPLATE IMAGE showing the two main characters standing together in the story setting: the hero and their sidekick.
- Your prompt tells Kontext how to TRANSFORM that template into each page's scene: SAME two characters, SAME watercolor art style, new action and background.
- Kontext only sees the template image and your prompt — never the story. Every scene must be completely self-contained.
- Kontext weights the START of the prompt most heavily. Lead with the action.

CHARACTERS:
- HERO (already in the template): ${bible.hero}
- SIDEKICK (already in the template): ${bible.partner}
- VILLAIN (NOT in the template — paste this locked description word-for-word every time the villain appears): ${bible.baddie}
- ANY OTHER NEW CHARACTER: the FIRST time they appear in the story, invent a short locked visual description (12-18 words). Then repeat that exact description WORD-FOR-WORD on every later page where that character appears, so they look identical on every page.

STORY SETTING: ${setting}

For EACH story page below, write ONE flowing prompt (60-100 words) on a SINGLE LINE, in this order:

1. ACTION FIRST: The most vivid frozen moment from this page — what the hero ${heroName} is doing right now. Strong specific verb, body position, facial expression.
2. SIDEKICK: What the sidekick is doing in the scene. If the page text clearly excludes them, write "the sidekick is not in this scene".
3. OTHER CHARACTERS: If the villain or any other character appears in the page text, include their locked description word-for-word plus what they are doing. If not present, leave them out.
4. BACKGROUND: The environment in concrete visual detail pulled from the page text — specific colors, objects, time of day, weather. "deep emerald leaves", "cobalt twilight sky" — never just "green" or "blue".
5. MOOD LAST: One short phrase for lighting and emotional tone.

CRITICAL RULES:
- Keep the same watercolor children's book art style as the template
- Each prompt must directly depict what happens in that page's text — a parent comparing image to page should instantly see the match
- Every prompt on ONE line only, no line breaks inside a prompt
- Never invent characters, objects, or places not in the page text

STORY PAGES:

${imagePromptRequest}

Format exactly as:
PAGE X: [your complete scene prompt on one line]

Write ONLY the prompts. Nothing else.`;

      const imgMessage = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 6000,
        temperature: 0.7,
        messages: [{ role: 'user', content: imagePrompt }],
      });

      const imgText = imgMessage.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');

      // Parse image prompts keyed by page number (multi-line safe)
      let currentImgPage = null;
      for (const line of imgText.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/^PAGE\s+(\d+):\s*(.*)/i);
        if (match) {
          currentImgPage = parseInt(match[1]);
          imgPromptMap[currentImgPage] = match[2].trim();
        } else if (currentImgPage !== null) {
          imgPromptMap[currentImgPage] += ' ' + trimmed;
        }
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

      if (!includeIllustration) {
        images.push(null);
      } else if (p.pageNum === 1) {
        // Page 1 displays the template itself (hero + sidekick) — truthy marker
        images.push('template');
      } else if (imgPromptMap[p.pageNum]) {
        images.push(`${imgPromptMap[p.pageNum]}, watercolor children's book illustration matching the reference style, no text, no words`);
      } else {
        // Fallback if a scene prompt wasn't generated for this page
        images.push(`The characters from the reference image exploring ${setting}, watercolor children's book illustration matching the reference style, no text, no words`);
      }
    });

    return res.status(200).json({
      story: finalStory.trim(),
      images,
      storyId: `story_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      heroPortraitPrompt: `${bible.hero} standing side by side with their best friend, ${bible.partner}, both characters fully visible head to toe, in ${setting}, children's book watercolor illustration, soft pastel colors, warm and friendly, no text`,
      sidekickPortraitPrompt: '',  // No longer generated — sidekick portrait was never displayed
    });

  } catch (error) {
    console.error('Anthropic API error:', error);
    return res.status(500).json({ error: 'Failed to generate story. Please try again.' });
  }
}
