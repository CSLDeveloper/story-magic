import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';

const STEPS = [
  { id: 'ageGroup',  emoji: '🎂', label: 'Age Group',    question: 'How old is the reader?',               type: 'choice', choices: ['Ages 3–6', 'Ages 7–9', 'Ages 10–12'] },
  { id: 'heroName',  emoji: '🧒', label: 'Your Hero',    question: "What's your hero's name?",             type: 'text',   placeholder: 'e.g. Luna, Max, Zara...' },
  { id: 'gender',    emoji: '⭐', label: 'Hero Gender',  question: 'Is your hero a boy or a girl?',        type: 'choice', choices: ['Boy', 'Girl'] },
  { id: 'heroType',  emoji: '🦸', label: 'Hero Type',    question: 'What kind of hero are they?',          type: 'choice', choices: ['A brave knight', 'A clever wizard', 'A space explorer', 'A magical fairy', 'A talking animal', 'A superhero kid'] },
  { id: 'sidekick',  emoji: '🐾', label: 'Sidekick',     question: "What's their sidekick?",               type: 'choice', choices: ['A talking dragon', 'A robot dog', 'A tiny unicorn', 'A wise old owl', 'A mischievous cat', 'A friendly giant'] },
  { id: 'setting',   emoji: '🌍', label: 'World',        question: 'Where does the story take place?',     type: 'choice', choices: ['An enchanted forest', 'Outer space', 'An underwater kingdom', 'A candy land', "A giant's castle", 'A secret underground city'] },
  { id: 'power',     emoji: '✨', label: 'Special Power',question: "What's your hero's special power?",    type: 'choice', choices: ['Can talk to animals', 'Can fly super fast', 'Has super strength', 'Can turn invisible', 'Controls the weather', 'Can shrink or grow'] },
  { id: 'villain',   emoji: '😈', label: 'The Baddie',   question: 'Who is the villain they must defeat?', type: 'choice', choices: ['An evil shadow queen', 'A grumpy troll king', 'A sneaky sorcerer', 'A robot overlord', 'A mean sea monster', 'A jealous witch'] },
  { id: 'lesson',    emoji: '💡', label: 'Story Lesson', question: 'What lesson should the story teach?',  type: 'choice', choices: ['Friendship is powerful', 'Be brave, not perfect', 'Kindness always wins', 'Never give up', 'Everyone belongs', "It's okay to ask for help"] },
];

const LOADING_MSGS = [
  '🌟 Sprinkling magic dust...',
  '📖 Writing your adventure...',
  '🎨 Painting the world...',
  '🐉 Waking up your sidekick...',
  '✨ Adding extra sparkle...',
  '🖼️ Creating illustrations...',
  '🌈 Almost ready!',
];

const EMOJIS = { ageGroup:'🎂', heroName:'🧒', gender:'⭐', heroType:'🦸', sidekick:'🐾', setting:'🌍', power:'✨', villain:'😈', lesson:'💡' };
const LABELS = { ageGroup:'Age Group', heroName:'Hero', gender:'Gender', heroType:'Type', sidekick:'Sidekick', setting:'World', power:'Power', villain:'Villain', lesson:'Lesson' };

function StarField() {
  const stars = Array.from({ length: 35 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    size: Math.random() * 3.5 + 1.5,
    delay: Math.random() * 3,
    duration: 2 + Math.random() * 2,
  }));
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      {stars.map(s => (
        <div key={s.id} style={{
          position: 'absolute', left: s.left, top: s.top,
          width: s.size, height: s.size,
          background: 'white', borderRadius: '50%',
          animation: `twinkle ${s.duration}s ${s.delay}s infinite alternate`,
        }} />
      ))}
    </div>
  );
}

// Scene elements keyed to story variables
// Fetch one illustration and return a blob URL
async function fetchIllustration(description, pageNum, storyId, heroPortraitPrompt, sidekickPortraitPrompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch('/api/illustrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, pageNum, storyId, heroPortraitPrompt, sidekickPortraitPrompt }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

function IllustrationBlock({ cachedSrc, description, pageNum, storyId, heroPortraitPrompt, sidekickPortraitPrompt, onRetry }) {
  const [retrying, setRetrying] = useState(false);
  const [retrySrc, setRetrySrc] = useState(null);

  const src = retrySrc || cachedSrc;
  // 'none' means this page intentionally has no illustration
  if (cachedSrc === 'none') return null;
  const status = retrying ? 'loading' : src ? 'loaded' : cachedSrc === null ? 'error' : 'loading';

  const handleRetry = async () => {
    setRetrying(true);
    setRetrySrc(null);
    const newSrc = await fetchIllustration(description, pageNum, storyId, heroPortraitPrompt, sidekickPortraitPrompt);
    setRetrySrc(newSrc);
    setRetrying(false);
    if (newSrc && onRetry) onRetry(pageNum, newSrc);
  };

  if (!description) return null;

  return (
    <div style={{ marginBottom: 20, borderRadius: 16, overflow: 'hidden', background: 'linear-gradient(135deg,#ede9fe,#fce7f3)', minHeight: 200, position: 'relative' }}>
      {status === 'loading' && (
        <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <div style={{ position: 'relative', width: 60, height: 60 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid #c084fc', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>🎨</span>
          </div>
          <span style={{ color: '#7c3aed', fontSize: '0.85rem', fontWeight: 700 }}>Painting illustration...</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#c084fc', animation: `bounce 1.2s ${i*0.2}s infinite alternate` }} />
            ))}
          </div>
        </div>
      )}
      {status === 'error' && (
        <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span style={{ fontSize: '2rem' }}>😕</span>
          <span style={{ color: '#7c3aed', fontSize: '0.85rem', fontWeight: 700 }}>Could not load illustration</span>
          <button onClick={handleRetry} style={{ background: 'linear-gradient(135deg,#c084fc,#818cf8)', border: 'none', borderRadius: 10, padding: '7px 18px', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
            🔄 Try Again
          </button>
        </div>
      )}
      {status === 'loaded' && src && (
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 16 }}>
          <img
            src={src}
            alt={`Illustration for page ${pageNum}`}
            style={{
              width: '100%', display: 'block', maxHeight: 290, objectFit: 'cover',
              animation: 'illReveal 0.8s ease forwards',
            }}
          />
          {/* Subtle shimmer overlay */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 16,
            background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)',
            animation: 'shimmer 4s 1s infinite',
            pointerEvents: 'none',
          }} />
          {/* Gentle float effect via transform on parent */}
          <div style={{
            position: 'absolute', bottom: 8, right: 10,
            background: 'rgba(255,255,255,0.75)', borderRadius: 20,
            padding: '2px 10px', fontSize: '0.72rem', color: '#7c3aed', fontWeight: 700,
          }}>
            ✨ illustrated
          </div>
        </div>
      )}
    </div>
  );
}


// Parse story into pages: [{pageNum, text}]
function parsePages(storyText) {
  const lines = storyText.split('\n');
  const pages = [];
  let title = '';
  let currentPage = null;
  let currentText = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (!title && !trimmed.startsWith('---')) {
      title = trimmed;
      return;
    }

    const pageMatch = trimmed.match(/^---\s*Page\s*(\d+)\s*---/i);
    if (pageMatch) {
      if (currentPage !== null) {
        pages.push({ pageNum: currentPage, text: currentText.join(' ') });
      }
      currentPage = parseInt(pageMatch[1]);
      currentText = [];
    } else if (currentPage !== null) {
      currentText.push(trimmed);
    }
  });

  if (currentPage !== null && currentText.length > 0) {
    pages.push({ pageNum: currentPage, text: currentText.join(' ') });
  }

  return { title, pages };
}

export default function Home() {
  const [screen, setScreen]         = useState('intro');
  const [stepIndex, setStepIndex]   = useState(0);
  const [answers, setAnswers]       = useState({});
  const [textInput, setTextInput]   = useState('');
  const [storyData, setStoryData]   = useState(null); // { title, pages, images }
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0]);
  const [errorMsg, setErrorMsg]     = useState('');
  const [currentPage, setCurrentPage] = useState(0); // 0 = title page
  const [isReading, setIsReading]     = useState(false);
  const [readLoading, setReadLoading] = useState(false);
  const audioRef  = useRef(null);
  const inputRef  = useRef(null);
  // Image cache: { [pageNum]: blobUrl | null }
  // null means fetch failed, undefined means not yet fetched
  const [imgCache, setImgCache]       = useState({});
  const fetchingRef = useRef(new Set()); // track in-flight fetches

  useEffect(() => {
    if (screen !== 'loading') return;
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % LOADING_MSGS.length;
      setLoadingMsg(LOADING_MSGS[i]);
    }, 2000);
    return () => clearInterval(interval);
  }, [screen]);

  useEffect(() => {
    if (screen === 'questions' && STEPS[stepIndex].type === 'text') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [screen, stepIndex]);

  // Stop reading when page changes
  useEffect(() => {
    stopReading();
  }, [currentPage]);

  // Background image preloader — fetch current + next 2 pages ahead
  // Pages 2+ wait until page 1 is cached (portrait must exist first)
  useEffect(() => {
    if (screen !== 'story' || !storyData) return;

    const pagesToFetch = [currentPage, currentPage + 1, currentPage + 2]
      .filter(p => p >= 1 && p <= storyData.pages.length)
      .filter(p => imgCache[p] === undefined && !fetchingRef.current.has(p));

    if (pagesToFetch.length === 0) return;

    pagesToFetch.forEach(async (p) => {
      const description = storyData.images[p - 1];

      // No illustration for this page — mark immediately and skip
      if (!description) {
        setImgCache(prev => ({ ...prev, [p]: 'none' }));
        return;
      }

      // Pages 2+ must wait for page 1 to finish so the portrait cache exists
      if (p > 1 && imgCache[1] === undefined) {
        // Page 1 not done yet — don't fetch yet, will retry when imgCache updates
        return;
      }

      fetchingRef.current.add(p);
      const src = await fetchIllustration(
        description,
        p,
        storyData.storyId,
        storyData.heroPortraitPrompt,
        storyData.sidekickPortraitPrompt
      );
      fetchingRef.current.delete(p);
      setImgCache(prev => ({ ...prev, [p]: src }));
    });
  // imgCache in deps so effect re-runs when page 1 finishes and unblocks pages 2+
  }, [currentPage, screen, storyData, imgCache]);

  const stopReading = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setIsReading(false);
    setReadLoading(false);
  };

  const toggleRead = useCallback(async () => {
    if (!storyData) return;

    // If already reading, stop
    if (isReading || readLoading) {
      stopReading();
      return;
    }

    // Build the text to read — no page numbers spoken
    let text = '';
    if (currentPage === 0) {
      text = `${storyData.title}. A story about ${answers.heroName}.`;
    } else if (storyData.pages[currentPage - 1]) {
      text = storyData.pages[currentPage - 1].text;
    }
    if (!text) return;

    setReadLoading(true);

    try {
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        // Fallback to browser TTS if ElevenLabs not configured
        const err = await res.json();
        console.warn('OpenAI TTS not available, falling back to browser TTS:', err.error);
        setReadLoading(false);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.88;
        utterance.pitch = 1.1;
        utterance.onend = () => setIsReading(false);
        window.speechSynthesis.speak(utterance);
        setIsReading(true);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsReading(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setIsReading(false);
        setReadLoading(false);
      };

      await audio.play();
      setReadLoading(false);
      setIsReading(true);

    } catch (err) {
      console.error('TTS error:', err);
      setReadLoading(false);
      setIsReading(false);
    }
  }, [isReading, readLoading, currentPage, storyData, answers]);

  const handleAnswer = (value) => {
    const newAnswers = { ...answers, [STEPS[stepIndex].id]: value };
    setAnswers(newAnswers);
    setTextInput('');
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      setScreen('loading');
      generateStory(newAnswers);
    }
  };

  const generateStory = async (vars) => {
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');

      const { title, pages } = parsePages(data.story);
      setStoryData({
        title, pages,
        images: data.images || [],
        storyId: data.storyId || `story_${Date.now()}`,
        heroPortraitPrompt: data.heroPortraitPrompt || '',
        sidekickPortraitPrompt: data.sidekickPortraitPrompt || '',
      });
      setCurrentPage(0);
      setScreen('story');
    } catch (err) {
      setErrorMsg(err.message);
      setScreen('error');
    }
  };

  const restart = () => {
    stopReading();
    setScreen('intro');
    setStepIndex(0);
    setAnswers({});
    setTextInput('');
    setStoryData(null);
    setErrorMsg('');
    setCurrentPage(0);
    setImgCache({});
    fetchingRef.current = new Set();
  };

  const currentStep = STEPS[stepIndex];
  const totalPages = storyData ? storyData.pages.length : 0;

  return (
    <>
      <Head>
        <title>Story Magic! ✨</title>
        <meta name="description" content="A magical AI story generator for children" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📚</text></svg>" />
      </Head>

      <style>{`
        @keyframes twinkle { 0%{opacity:.15} 100%{opacity:.95} }
        @keyframes bounce { from{transform:translateY(0)} to{transform:translateY(-8px)} }
        @keyframes cardIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes illReveal { from{opacity:0;transform:scale(1.03)} to{opacity:1;transform:scale(1)} }
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes floatIll { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-6px)} }
        @keyframes floatIllSlow { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-4px)} }
        @keyframes rockIll { 0%,100%{transform:rotate(0deg) translateY(0px)} 25%{transform:rotate(1deg) translateY(-3px)} 75%{transform:rotate(-1deg) translateY(-3px)} }
        @keyframes zoomBreath { 0%,100%{transform:scale(1)} 50%{transform:scale(1.025)} }
        .choice-btn:hover { background: rgba(192,132,252,0.25) !important; border-color: #c084fc !important; transform: translateY(-2px); }
        .choice-btn:active { transform: scale(0.97) !important; }
        .main-btn:hover { transform: translateY(-2px); filter: brightness(1.08); }
        .back-btn:hover { color: white !important; border-color: rgba(255,255,255,0.4) !important; }
        .nav-btn:hover { background: rgba(192,132,252,0.3) !important; border-color: #c084fc !important; }
        .read-btn:hover { filter: brightness(1.1); }
        input.text-inp:focus { border-color: #c084fc !important; box-shadow: 0 0 0 3px rgba(192,132,252,0.15); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(192,132,252,0.4); border-radius: 3px; }
        .img-placeholder { background: linear-gradient(135deg, #1a0a3e, #0a1a3e); border-radius: 12px; display:flex; align-items:center; justify-content:center; color: rgba(255,255,255,0.3); font-size: 2rem; }
      `}</style>

      <div style={styles.app}>
        <StarField />

        {/* INTRO */}
        {screen === 'intro' && (
          <div style={styles.card}>
            <span style={styles.bigEmoji}>📚</span>
            <h1 style={styles.h1}>Story Magic!</h1>
            <p style={styles.sub}>Answer 9 fun questions and I&apos;ll write YOUR very own magical illustrated adventure story — perfectly matched to your age! 🌟</p>
            <button className="main-btn" style={styles.btn} onClick={() => { setStepIndex(0); setAnswers({}); setScreen('questions'); }}>
              Start My Story! ✨
            </button>
          </div>
        )}

        {/* QUESTIONS */}
        {screen === 'questions' && (
          <div style={styles.card} key={stepIndex}>
            <div style={styles.pbar}><div style={{ ...styles.pfill, width: `${(stepIndex / STEPS.length) * 100}%` }} /></div>
            <span style={styles.bigEmoji}>{currentStep.emoji}</span>
            <div style={styles.stepLabel}>{currentStep.label}</div>
            <h2 style={styles.h2}>{currentStep.question}</h2>

            {Object.keys(answers).length > 0 && (
              <div style={styles.tags}>
                {Object.values(answers).map((v, i) => <span key={i} style={styles.tag}>✓ {v}</span>)}
              </div>
            )}

            {currentStep.type === 'text' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  ref={inputRef}
                  className="text-inp"
                  style={styles.textInput}
                  placeholder={currentStep.placeholder}
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && textInput.trim()) handleAnswer(textInput.trim()); }}
                />
                <button className="main-btn" style={styles.btn} onClick={() => { if (textInput.trim()) handleAnswer(textInput.trim()); }} disabled={!textInput.trim()}>
                  Next ➡️
                </button>
              </div>
            ) : currentStep.id === 'ageGroup' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                {[
                  { label: 'Ages 3–6', emoji: '🌟', desc: 'Simple words, short pages, 12 pages' },
                  { label: 'Ages 7–9', emoji: '📖', desc: 'Richer story, longer pages, 15 pages' },
                  { label: 'Ages 10–12', emoji: '🚀', desc: 'Full adventure, detailed, 20–25 pages' },
                ].map(opt => (
                  <button key={opt.label} className="choice-btn" onClick={() => handleAnswer(opt.label)}
                    style={{ ...styles.choiceBtn, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', textAlign: 'left' }}>
                    <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>{opt.emoji}</span>
                    <span>
                      <span style={{ display: 'block', fontSize: '1rem', fontWeight: 800 }}>{opt.label}</span>
                      <span style={{ display: 'block', fontSize: '0.78rem', opacity: 0.65, fontWeight: 400, marginTop: 2 }}>{opt.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : currentStep.id === 'gender' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                {['Boy', 'Girl'].map(choice => (
                  <button key={choice} className="choice-btn"
                    style={{ ...styles.choiceBtn, padding: '18px 12px', fontSize: '1.05rem' }}
                    onClick={() => handleAnswer(choice)}>
                    {choice === 'Boy' ? '👦 Boy' : '👧 Girl'}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{
                ...styles.choices,
                gridTemplateColumns: currentStep.choices.length === 2 ? '1fr 1fr' : '1fr 1fr',
              }}>
                {currentStep.choices.map(choice => (
                  <button key={choice} className="choice-btn" style={{
                    ...styles.choiceBtn,
                    ...(currentStep.choices.length === 2 ? { padding: '18px 12px', fontSize: '1.05rem' } : {}),
                  }} onClick={() => handleAnswer(choice)}>
                    {choice === 'Boy' ? '👦 Boy' : choice === 'Girl' ? '👧 Girl' : choice}
                  </button>
                ))}
              </div>
            )}

            {stepIndex > 0 && (
              <button className="back-btn" style={styles.backBtn} onClick={() => { setStepIndex(stepIndex - 1); setTextInput(''); }}>
                ← Go Back
              </button>
            )}
          </div>
        )}

        {/* LOADING */}
        {screen === 'loading' && (
          <div style={styles.card}>
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <span style={{ fontSize: '4.5rem', display: 'block', marginBottom: 18, animation: 'spin 2s linear infinite' }}>⭐</span>
              <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: '1.3rem', color: '#c084fc', marginBottom: 6 }}>{loadingMsg}</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem' }}>Creating your illustrated story...</div>
            </div>
          </div>
        )}

        {/* STORY */}
        {screen === 'story' && storyData && (
          <div style={styles.bookWrap}>

            {/* Book header */}
            <div style={styles.bookHeader}>
              <span style={{ fontFamily: "'Fredoka One', cursive", fontSize: '1.1rem', color: 'white' }}>
                📖 {storyData.title || 'Your Magical Story'}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
                {currentPage === 0 ? 'Cover' : `Page ${currentPage} of ${totalPages}`}
              </span>
            </div>

            {/* Page content */}
            <div style={styles.pageContent}>

              {/* Title / cover page */}
              {currentPage === 0 && (
                <div style={{ textAlign: 'center', padding: '20px 0', animation: 'fadeIn 0.4s ease' }}>
                  <div style={{ fontSize: '4rem', marginBottom: 16 }}>📚</div>
                  <h2 style={styles.storyTitle}>{storyData.title}</h2>
                  <p style={{ color: '#6d28d9', fontWeight: 700, fontSize: '0.95rem', marginBottom: 8 }}>
                    A story about {answers.heroName}
                  </p>
                  <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                    {answers.heroType} • {answers.setting}
                  </p>
                  <div style={{ marginTop: 24, padding: '12px 20px', background: '#f3e8ff', borderRadius: 12, display: 'inline-block' }}>
                    <p style={{ color: '#7c3aed', fontSize: '0.88rem', fontWeight: 700 }}>💡 {answers.lesson}</p>
                  </div>
                </div>
              )}

              {/* Story pages */}
              {currentPage > 0 && storyData.pages[currentPage - 1] && (
                <div style={{ animation: 'fadeIn 0.35s ease' }}>
                  {/* Illustration — varied animation per page */}
                  {(() => {
                    const animations = [
                      'floatIll 4s ease-in-out infinite',
                      'floatIllSlow 6s ease-in-out infinite',
                      'rockIll 5s ease-in-out infinite',
                      'zoomBreath 5s ease-in-out infinite',
                      'floatIll 3.5s ease-in-out infinite reverse',
                      'rockIll 7s ease-in-out infinite reverse',
                      'zoomBreath 6s 0.5s ease-in-out infinite',
                      'floatIllSlow 4.5s 1s ease-in-out infinite',
                    ];
                    const anim = (imgCache[currentPage] && imgCache[currentPage] !== 'none')
                      ? animations[currentPage % animations.length]
                      : 'none';
                    return (
                      <div style={{ animation: anim }}>
                        <IllustrationBlock
                          cachedSrc={imgCache[currentPage]}
                          description={storyData.images[currentPage - 1]}
                          pageNum={currentPage}
                          storyId={storyData.storyId}
                          heroPortraitPrompt={storyData.heroPortraitPrompt}
                          sidekickPortraitPrompt={storyData.sidekickPortraitPrompt}
                          onRetry={(p, src) => setImgCache(prev => ({ ...prev, [p]: src }))}
                        />
                      </div>
                    );
                  })()}

                  {/* Story text — no page number, already shown in header */}
                  <p style={styles.storyP}>{storyData.pages[currentPage - 1].text}</p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div style={styles.bookControls}>
              {/* Read aloud button */}
              <button
                className="read-btn"
                onClick={toggleRead}
                style={{
                  ...styles.readBtn,
                  background: isReading
                    ? 'linear-gradient(135deg,#f87171,#ef4444)'
                    : readLoading
                    ? 'linear-gradient(135deg,#fb923c,#f97316)'
                    : 'linear-gradient(135deg,#4ade80,#22c55e)',
                  opacity: readLoading ? 0.85 : 1,
                }}
              >
                {isReading ? '⏹ Stop' : readLoading ? '⏳ Loading...' : '🔊 Read Aloud'}
              </button>

              {/* Page navigation */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="nav-btn"
                  style={{ ...styles.navBtn, opacity: currentPage === 0 ? 0.4 : 1 }}
                  onClick={() => { if (currentPage > 0) setCurrentPage(currentPage - 1); }}
                  disabled={currentPage === 0}
                >
                  ← Prev
                </button>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', minWidth: 60, textAlign: 'center' }}>
                  {currentPage}/{totalPages}
                </span>
                <button
                  className="nav-btn"
                  style={{ ...styles.navBtn, opacity: currentPage === totalPages ? 0.4 : 1 }}
                  onClick={() => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); }}
                  disabled={currentPage === totalPages}
                >
                  Next →
                </button>
              </div>
            </div>

            {/* New story button */}
            <div style={{ marginTop: 12 }}>
              <button className="main-btn" style={{ ...styles.btn, fontSize: '1rem', padding: '12px 20px' }} onClick={restart}>
                ✨ Write Another Story!
              </button>
            </div>
          </div>
        )}

        {/* ERROR */}
        {screen === 'error' && (
          <div style={styles.card}>
            <span style={styles.bigEmoji}>😬</span>
            <h1 style={styles.h1}>Uh oh!</h1>
            <p style={{ ...styles.sub, color: '#fca5a5', background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: '0.88rem', textAlign: 'left' }}>{errorMsg}</p>
            <button className="main-btn" style={styles.btn} onClick={restart}>Try Again! 🔄</button>
          </div>
        )}
      </div>
    </>
  );
}

const styles = {
  app: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a2e, #1a0a3e, #0a1a3e)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20, position: 'relative', overflow: 'hidden',
  },
  card: {
    position: 'relative', zIndex: 10,
    background: 'rgba(255,255,255,0.07)',
    backdropFilter: 'blur(20px)',
    border: '1.5px solid rgba(255,255,255,0.15)',
    borderRadius: 28, padding: '40px 36px',
    maxWidth: 580, width: '100%',
    boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
    animation: 'cardIn 0.4s ease',
  },
  bookWrap: {
    position: 'relative', zIndex: 10,
    maxWidth: 620, width: '100%',
    animation: 'cardIn 0.4s ease',
  },
  bookHeader: {
    background: 'linear-gradient(135deg,#c084fc,#818cf8)',
    borderRadius: '24px 24px 0 0', padding: '18px 26px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  pageContent: {
    background: '#fefce8',
    padding: '28px 28px',
    minHeight: 420,
    border: '2px solid rgba(192,132,252,0.3)', borderTop: 'none',
  },
  bookControls: {
    background: '#f3e8ff',
    borderTop: '2px solid rgba(192,132,252,0.2)',
    padding: '14px 20px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    flexWrap: 'wrap', gap: 10,
    border: '2px solid rgba(192,132,252,0.3)', borderTop: 'none',
    borderRadius: '0 0 24px 24px',
  },
  bigEmoji: {
    fontSize: '3.2rem', display: 'block', textAlign: 'center',
    marginBottom: 10, animation: 'bounce 1s infinite alternate', lineHeight: 1,
  },
  h1: {
    fontFamily: "'Fredoka One', cursive",
    fontSize: 'clamp(1.9rem, 5vw, 2.6rem)',
    color: 'white', textAlign: 'center', marginBottom: 12,
  },
  h2: {
    fontFamily: "'Fredoka One', cursive",
    fontSize: 'clamp(1.2rem, 3.5vw, 1.6rem)',
    color: 'white', textAlign: 'center', marginBottom: 20, lineHeight: 1.3,
  },
  sub: {
    color: 'rgba(255,255,255,0.62)', textAlign: 'center',
    marginBottom: 28, lineHeight: 1.65, fontSize: '1.02rem',
  },
  stepLabel: {
    fontFamily: "'Fredoka One', cursive", fontSize: '0.76rem',
    letterSpacing: 3, textTransform: 'uppercase',
    color: '#c084fc', textAlign: 'center', marginBottom: 6,
  },
  pbar: { width: '100%', height: 7, background: 'rgba(255,255,255,0.1)', borderRadius: 4, marginBottom: 22, overflow: 'hidden' },
  pfill: { height: '100%', background: 'linear-gradient(90deg,#f9a8d4,#c084fc,#818cf8)', borderRadius: 4, transition: 'width .5s ease' },
  choices: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 12 },
  choiceBtn: {
    background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.15)',
    borderRadius: 13, padding: '12px 8px', color: 'white',
    fontFamily: "'Nunito', sans-serif", fontSize: '0.88rem', fontWeight: 700,
    cursor: 'pointer', transition: 'all .18s', textAlign: 'center',
  },
  textInput: {
    background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.2)',
    borderRadius: 13, padding: '13px 16px', color: 'white',
    fontFamily: "'Nunito', sans-serif", fontSize: '0.97rem', fontWeight: 700,
    outline: 'none', width: '100%', transition: 'border-color .2s',
  },
  btn: {
    background: 'linear-gradient(135deg,#c084fc,#818cf8)', border: 'none',
    borderRadius: 13, padding: '14px 24px', color: 'white',
    fontFamily: "'Fredoka One', cursive", fontSize: '1.1rem',
    cursor: 'pointer', width: '100%', transition: 'all .18s',
  },
  backBtn: {
    background: 'transparent', border: '1.5px solid rgba(255,255,255,0.18)',
    borderRadius: 13, padding: '10px 20px', color: 'rgba(255,255,255,0.52)',
    fontFamily: "'Nunito', sans-serif", fontSize: '0.88rem', fontWeight: 700,
    cursor: 'pointer', width: '100%', marginTop: 9, transition: 'all .18s',
  },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14, justifyContent: 'center' },
  tag: {
    background: 'rgba(192,132,252,0.15)', border: '1px solid rgba(192,132,252,0.28)',
    borderRadius: 20, padding: '2px 10px', fontSize: '0.74rem',
    color: 'rgba(255,255,255,0.65)', fontWeight: 700,
  },
  storyTitle: {
    fontFamily: "'Fredoka One', cursive",
    fontSize: 'clamp(1.6rem,4vw,2.1rem)',
    color: '#6d28d9', marginBottom: 12, lineHeight: 1.2,
  },
  storyP: {
    color: '#1e1b4b', fontSize: '1.05rem', lineHeight: 1.85,
    fontWeight: 600, fontFamily: "'Nunito', sans-serif",
  },
  navBtn: {
    background: 'rgba(192,132,252,0.12)', border: '1.5px solid rgba(192,132,252,0.25)',
    borderRadius: 10, padding: '8px 16px', color: '#6d28d9',
    fontFamily: "'Nunito', sans-serif", fontSize: '0.88rem', fontWeight: 800,
    cursor: 'pointer', transition: 'all .18s',
  },
  readBtn: {
    border: 'none', borderRadius: 10, padding: '9px 18px', color: 'white',
    fontFamily: "'Fredoka One', cursive", fontSize: '0.95rem',
    cursor: 'pointer', transition: 'all .18s',
  },
};
