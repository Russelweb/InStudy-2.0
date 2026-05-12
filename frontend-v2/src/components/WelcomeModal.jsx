import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '../services/api';

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  // ── INTRO SLIDES (platform briefing) ──────────────────────────────────────
  {
    type: 'intro',
    emoji: '👋',
    accent: 'text-yellow-400',
    bg: 'from-yellow-400/10 to-transparent',
    title: "Hey there, welcome to InStudy 2.0!",
    body: "We're genuinely excited you're here. You just joined a platform built for one thing — making studying feel less like a chore and more like a superpower. Let us show you around real quick.",
    cta: "Ooh, tell me more →",
  },
  {
    type: 'intro',
    emoji: '🤖',
    accent: 'text-primary',
    bg: 'from-primary/10 to-transparent',
    title: "Your personal AI tutor — always on call",
    body: "Upload any PDF, textbook, or notes and ask it anything. \"Explain page 12 like I'm 12.\" \"What's the difference between autotrophic and heterotrophic nutrition?\" It answers in seconds, with examples, exam tips, and summaries. No judgment. No waiting.",
    cta: "That sounds amazing →",
  },
  {
    type: 'intro',
    emoji: '🃏',
    accent: 'text-secondary',
    bg: 'from-secondary/10 to-transparent',
    title: "Flashcards & Quizzes  auto-generated",
    body: "Stop spending hours making study cards. InStudy reads your documents and generates flashcards and practice quizzes for you in seconds. You just study. We do the prep work.",
    cta: "Wait, seriously? →",
  },
  {
    type: 'intro',
    emoji: '📝',
    accent: 'text-orange-400',
    bg: 'from-orange-400/10 to-transparent',
    title: "Instant Summaries Cut through the noise",
    body: "Tired of reading 50-page chapters? InStudy generates high-level summaries and key takeaway points from any document. Get the core concepts in seconds, then dive deeper whenever you're ready.",
    cta: "Summarize it all! →",
  },
  {
    type: 'intro',
    emoji: '📅',
    accent: 'text-purple-400',
    bg: 'from-purple-400/10 to-transparent',
    title: "A study plan that actually fits your life",
    body: "Tell InStudy your exam date and the topics you need to cover. It builds you a day-by-day study schedule balanced, realistic, and smart. No more cramming the night before.",
    cta: "I need this in my life →",
  },
  {
    type: 'intro',
    emoji: '📊',
    accent: 'text-green-400',
    bg: 'from-green-400/10 to-transparent',
    title: "Track your progress like a pro",
    body: "Your dashboard shows exactly how many hours you've studied, which courses you're crushing, and which concepts need more love. Watch your mastery grow in real time. Studying has never felt this satisfying.",
    cta: "Ok I'm hooked. What's next? →",
  },
  // ── API KEY SLIDES ─────────────────────────────────────────────────────────
  {
    type: 'key_intro',
    emoji: '⚡',
    accent: 'text-primary',
    bg: 'from-primary/10 to-transparent',
    title: "One last thing — power up your AI",
    body: "All those features run on Groq's lightning-fast AI. To use it, you need a personal API key. It takes about 2 minutes to get one, and it means your AI is private, fast, and all yours.",
    cta: "Let's get my key →",
    skip: true,
  },
  {
    type: 'key_step',
    emoji: '🌐',
    accent: 'text-secondary',
    bg: 'from-secondary/10 to-transparent',
    title: "Step 1 — Create a free Groq account",
    body: "Head to console.groq.com and sign up with your email. No credit card. No catch. Groq's free tier is more than enough for daily studying.",
    link: 'https://console.groq.com',
    linkLabel: 'Open console.groq.com',
    cta: "Done! Next step →",
    skip: true,
  },
  {
    type: 'key_step',
    emoji: '🔑',
    accent: 'text-yellow-400',
    bg: 'from-yellow-400/10 to-transparent',
    title: "Step 2 — Generate your API key",
    body: 'In the Groq console, click your profile icon → "API Keys" → "Create API Key". Name it "InStudy". Your key starts with "gsk_"  copy it the moment it appears. It\'s only shown once!',
    cta: "Got my key! →",
    skip: true,
  },
  {
    type: 'key_input',
    emoji: '🔒',
    accent: 'text-secondary',
    bg: 'from-secondary/10 to-transparent',
    title: "Step 3 — Paste it here & you're done",
    body: "Paste your key below. It's encrypted with AES-256 before being saved completely private. You can always update or remove it later in Settings.",
    cta: "Save & Start Exploring 🚀",
    skip: true,
  },
];

const WelcomeModal = ({ onClose }) => {
  const [step,    setStep]    = useState(0);
  const [key,     setKey]     = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const current  = STEPS[step];
  const isLast   = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  const dismiss = () => {
    localStorage.removeItem('is_new_user');
    onClose();
  };

  const handleNext = async () => {
    if (isLast) {
      if (key.trim()) {
        if (!key.trim().startsWith('gsk_')) {
          setError('That doesn\'t look right  Groq keys start with "gsk_". Check and try again.');
          return;
        }
        setSaving(true);
        try {
          await authService.saveGroqKey(key.trim());
          localStorage.setItem('groq_api_key', key.trim());
        } catch {
          setError('Could not save key right now. You can add it later in Settings.');
        } finally {
          setSaving(false);
        }
      }
      dismiss();
    } else {
      setStep(s => s + 1);
      setError('');
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(s => s - 1);
      setError('');
    }
  };

  // Colour of the progress bar changes as we move from intro → key setup
  const isKeySection = ['key_intro', 'key_step', 'key_input'].includes(current.type);

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0,  scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.96 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="w-full max-w-lg bg-[#080c10] border border-white/8 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Progress bar */}
        <div className="h-1 bg-white/5">
          <motion.div
            className={`h-full ${isKeySection ? 'bg-primary' : 'bg-secondary'}`}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        {/* Gradient header band */}
        <div className={`bg-gradient-to-br ${current.bg} px-8 pt-8 pb-6`}>
          {/* Emoji + step counter */}
          <div className="flex items-center justify-between mb-5">
            <span className="text-4xl">{current.emoji}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
              {step + 1} / {STEPS.length}
            </span>
          </div>

          <h2 className={`text-2xl font-black tracking-tight leading-snug ${current.accent}`}>
            {current.title}
          </h2>
        </div>

        <div className="px-8 pb-8 space-y-6">
          {/* Body text */}
          <p className="text-sm text-white/70 leading-relaxed">{current.body}</p>

          {/* External link (key steps) */}
          {current.link && (
            <a
              href={current.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary/10 border border-secondary/20 text-secondary text-sm font-bold hover:bg-secondary/20 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              {current.linkLabel}
            </a>
          )}

          {/* Key input */}
          {current.type === 'key_input' && (
            <div className="space-y-2">
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={key}
                  onChange={e => { setKey(e.target.value); setError(''); }}
                  placeholder="gsk_..."
                  autoFocus
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-4 pr-12 text-sm font-mono text-white focus:ring-1 focus:ring-secondary/60 transition-all placeholder:text-white/20"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">
                    {showKey ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {error && (
                <p className="text-error text-xs font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">error</span>
                  {error}
                </p>
              )}
              <p className="text-[11px] text-white/30 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">shield</span>
                AES-256 encrypted before storage. Never shared.
              </p>
            </div>
          )}

          {/* Feature highlights for intro slides */}
          {current.type === 'intro' && step === 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: 'auto_stories', label: 'AI Tutor' },
                { icon: 'style',        label: 'Flashcards' },
                { icon: 'quiz',         label: 'Smart Quiz' },
                { icon: 'summarize',    label: 'Summaries' },
                { icon: 'event_note',   label: 'Planner' },
                { icon: 'insights',     label: 'Progress' },
              ].map(f => (
                <div key={f.label} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/3 border border-white/5">
                  <span className="material-symbols-outlined text-secondary text-xl">{f.icon}</span>
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">{f.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-4">
              {step > 0 && !saving && (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 text-xs text-secondary font-black uppercase tracking-widest hover:text-primary transition-colors hover:underline underline-offset-4"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Back
                </button>
              )}
              
              {current.skip && (
                <button
                  onClick={dismiss}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors underline underline-offset-4"
                >
                  Skip for now
                </button>
              )}
            </div>

            <button
              onClick={handleNext}
              disabled={saving}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60 text-white
                ${isKeySection
                  ? 'bg-gradient-to-r from-primary to-secondary shadow-lg shadow-primary/20'
                  : 'bg-gradient-to-r from-secondary to-primary shadow-lg shadow-secondary/20'
                }`}
            >
              {saving ? (
                <span className="material-symbols-outlined animate-spin text-sm">sync</span>
              ) : current.cta}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default WelcomeModal;
