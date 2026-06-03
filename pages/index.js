import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

const STEPS = [
  { id: 'heroName',  emoji: '🧒', label: 'Your Hero',     question: "What's your hero's name?",            type: 'text',   placeholder: 'e.g. Luna, Max, Zara...' },
  { id: 'heroType',  emoji: '🦸', label: 'Hero Type',     question: 'What kind of hero are they?',          type: 'choice', choices: ['A brave knight', 'A clever wizard', 'A space explorer', 'A magical fairy', 'A talking animal', 'A superhero kid'] },
  { id: 'sidekick',  emoji: '🐾', label: 'Sidekick',      question: "What's their sidekick?",               type: 'choice', choices: ['A talking dragon', 'A robot dog', 'A tiny unicorn', 'A wise old owl', 'A mischievous cat', 'A friendly giant'] },
  { id: 'setting',   emoji: '🌍', label: 'World',         question: 'Where does the story take place?',     type: 'choice', choices: ['An enchanted forest', 'Outer space', 'An underwater kingdom', 'A candy land', "A giant's castle", 'A secret underground city'] },
  { id: 'power',     emoji: '✨', label: 'Special Power', question: "What's your hero's special power?",    type: 'choice', choices: ['Can talk to animals', 'Can fly super fast', 'Has super strength', 'Can turn invisible', 'Controls the weather', 'Can shrink or grow'] },
  { id: 'villain',   emoji: '😈', label: 'The Baddie',    question: 'Who is the villain they must defeat?', type: 'choice', choices: ['An evil shadow queen', 'A grumpy troll king', 'A sneaky sorcerer', 'A robot overlord', 'A mean sea monster', 'A jealous witch'] },
  { id: 'lesson',    emoji: '💡', label: 'Story Lesson',  question: 'What lesson should the story teach?',  type: 'choice', choices: ['Friendship is powerful', 'Be brave, not perfect', 'Kindness always wins', 'Never give up', 'Everyone belongs', "It's okay to ask for help"] },
];

const LOADING_MSGS = [
  '🌟 Sprinkling magic dust...',
  '📖 Writing your adventure...',
  '🎨 Painting the world...',
  '🐉 Waking up your sidekick...',
  '✨ Adding extra sparkle...',
  '🚀 Launching the story...',
  '🌈 Almost ready!',
];

const EMOJIS = { heroName:'🧒', heroType:'🦸', sidekick:'🐾', setting:'🌍', power:'✨', villain:'😈', lesson:'💡' };
const LABELS = { heroName:'Hero', heroType:'Type', sidekick:'Sidekick', setting:'World', power:'Power', villain:'Villain', lesson:'Lesson' };

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

export default function Home() {
  const [screen, setScreen]       = useState('intro');
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers]     = useState({});
  const [textInput, setTextInput] = useState('');
  const [story, setStory]         = useState('');
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0]);
  const [errorMsg, setErrorMsg]   = useState('');
  const inputRef = useRef(null);

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
      setStory(data.story);
      setScreen('story');
    } catch (err) {
      setErrorMsg(err.message);
      setScreen('error');
    }
  };

  const restart = () => {
    setScreen('intro');
    setStepIndex(0);
    setAnswers({});
    setTextInput('');
    setStory('');
    setErrorMsg('');
  };

  const formatStory = (text) => {
    return text.split('\n').filter(l => l.trim()).map((line, i) => {
      if (i === 0) return <h2 key={i} style={styles.storyTitle}>{line}</h2>;
      if (line.startsWith('--- Page')) return <div key={i} style={styles.pageHead}>{line.replace(/---/g, '').trim()}</div>;
      return <p key={i} style={styles.storyP}>{line}</p>;
    });
  };

  const currentStep = STEPS[stepIndex];

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
        .choice-btn:hover { background: rgba(192,132,252,0.25) !important; border-color: #c084fc !important; transform: translateY(-2px); }
        .choice-btn:active { transform: scale(0.97) !important; }
        .main-btn:hover { transform: translateY(-2px); filter: brightness(1.08); }
        .back-btn:hover { color: white !important; border-color: rgba(255,255,255,0.4) !important; }
        input.text-inp:focus { border-color: #c084fc !important; box-shadow: 0 0 0 3px rgba(192,132,252,0.15); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(192,132,252,0.4); border-radius: 3px; }
      `}</style>

      <div style={styles.app}>
        <StarField />

        {/* INTRO */}
        {screen === 'intro' && (
          <div style={styles.card}>
            <span style={styles.bigEmoji}>📚</span>
            <h1 style={styles.h1}>Story Magic!</h1>
            <p style={styles.sub}>Answer 7 fun questions and I&apos;ll write YOUR very own magical adventure story — just for you! 🌟</p>
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
            ) : (
              <div style={styles.choices}>
                {currentStep.choices.map(choice => (
                  <button key={choice} className="choice-btn" style={styles.choiceBtn} onClick={() => handleAnswer(choice)}>
                    {choice}
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
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem' }}>Writing your special story...</div>
            </div>
          </div>
        )}

        {/* STORY */}
        {screen === 'story' && (
          <div style={styles.storyWrap}>
            <div style={styles.storyHead}>
              <span style={{ fontFamily: "'Fredoka One', cursive", fontSize: '1.15rem', color: 'white' }}>📖 Your Magical Story!</span>
              <span style={{ fontFamily: "'Fredoka One', cursive", fontSize: '1.15rem', color: 'white' }}>🌟</span>
            </div>
            <div style={styles.storyBody}>
              {formatStory(story)}
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="main-btn" style={styles.btn} onClick={restart}>✨ Write Another Story!</button>
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
  storyWrap: {
    position: 'relative', zIndex: 10,
    maxWidth: 760, width: '100%',
    animation: 'cardIn 0.4s ease',
  },
  storyHead: {
    background: 'linear-gradient(135deg,#c084fc,#818cf8)',
    borderRadius: '24px 24px 0 0', padding: '20px 28px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  storyBody: {
    background: '#fefce8', borderRadius: '0 0 24px 24px',
    padding: '36px 36px', maxHeight: '70vh', overflowY: 'auto',
    border: '2px solid rgba(192,132,252,0.3)', borderTop: 'none',
  },
  storyTitle: {
    fontFamily: "'Fredoka One', cursive",
    fontSize: 'clamp(1.7rem,4vw,2.2rem)',
    color: '#6d28d9', textAlign: 'center', marginBottom: 24, lineHeight: 1.2,
  },
  pageHead: {
    fontFamily: "'Fredoka One', cursive", fontSize: '0.92rem',
    color: '#c084fc', background: '#f3e8ff',
    borderLeft: '4px solid #c084fc', padding: '7px 12px',
    borderRadius: '0 8px 8px 0', margin: '24px 0 12px',
  },
  storyP: {
    color: '#1e1b4b', fontSize: '1rem', lineHeight: 1.8,
    marginBottom: 8, fontWeight: 600,
  },
};
