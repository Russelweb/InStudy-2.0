import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '../services/api';

// ── Step-by-step guide content ────────────────────────────────────────────────
const STEPS = [
  {
    num: '01',
    title: 'Create a free Groq account',
    desc: 'Go to console.groq.com and sign up with your email. Groq is free — no credit card needed for the free tier.',
    icon: 'person_add',
    link: 'https://console.groq.com',
    linkLabel: 'Open console.groq.com →',
  },
  {
    num: '02',
    title: 'Navigate to API Keys',
    desc: 'Once logged in, click your profile icon in the top-right corner, then select "API Keys" from the dropdown menu.',
    icon: 'manage_accounts',
  },
  {
    num: '03',
    title: 'Create a new key',
    desc: 'Click the "Create API Key" button. Give it a name like "InStudy" so you can identify it later. Then click "Submit".',
    icon: 'add_circle',
  },
  {
    num: '04',
    title: 'Copy your key',
    desc: 'Your key will be shown ONCE — it starts with "gsk_". Copy it immediately. You cannot view it again after closing the dialog.',
    icon: 'content_copy',
    highlight: true,
  },
  {
    num: '05',
    title: 'Paste it below',
    desc: 'Paste your key into the field below and click "Save Key". It is encrypted before being stored — nobody else can read it.',
    icon: 'lock',
  },
];

const Settings = () => {
  const [key,        setKey]        = useState('');
  const [hasKey,     setHasKey]     = useState(false);
  const [showKey,    setShowKey]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [status,     setStatus]     = useState(null); // {type:'success'|'error', msg}
  const [activeStep, setActiveStep] = useState(null);

  // Check if user already has a key stored
  useEffect(() => {
    authService.getGroqKey()
      .then(res => { if (res.data?.groq_api_key) { setHasKey(true); setKey(res.data.groq_api_key); } })
      .catch(() => setHasKey(false));
  }, []);

  const handleSave = async () => {
    if (!key.trim()) return;
    if (!key.trim().startsWith('gsk_')) {
      setStatus({ type: 'error', msg: 'That doesn\'t look like a valid Groq key. It should start with "gsk_".' });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      await authService.saveGroqKey(key.trim());
      // Also cache in localStorage so it's sent on every request immediately
      localStorage.setItem('groq_api_key', key.trim());
      setHasKey(true);
      setStatus({ type: 'success', msg: 'Key saved and encrypted successfully. InStudy will now use your personal Groq account.' });
    } catch {
      setStatus({ type: 'error', msg: 'Failed to save key. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await authService.deleteGroqKey();
      localStorage.removeItem('groq_api_key');
      setKey('');
      setHasKey(false);
      setStatus({ type: 'success', msg: 'Key removed. InStudy will fall back to the shared model.' });
    } catch {
      setStatus({ type: 'error', msg: 'Failed to remove key.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter text-on-surface">Settings</h1>
        <p className="text-on-surface-variant mt-1">Manage your personal AI configuration.</p>
      </div>

      {/* ── AI Engine Card ─────────────────────────────────────────────────── */}
      <div className="bg-surface-container rounded-2xl border border-outline-variant/10 overflow-hidden">
        <div className="p-6 border-b border-outline-variant/10 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary">psychology</span>
          </div>
          <div>
            <h2 className="font-bold text-on-surface">Personal AI Engine</h2>
            <p className="text-xs text-on-surface-variant">Connect your own Groq API key for faster, private AI responses.</p>
          </div>
          {hasKey && (
            <span className="ml-auto flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-secondary bg-secondary/10 border border-secondary/20 px-3 py-1 rounded-full">
              <span className="material-symbols-outlined text-sm">check_circle</span> Active
            </span>
          )}
        </div>

        {/* Why use your own key */}
        <div className="px-6 py-4 bg-surface-container-low/50 border-b border-outline-variant/10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: 'bolt',    title: 'Faster responses',  desc: 'Your own quota means no shared rate limits.' },
              { icon: 'lock',    title: 'Private',           desc: 'Your conversations stay on your account.' },
              { icon: 'savings', title: 'Free tier available', desc: 'Groq offers a generous free tier — no card needed.' },
            ].map(b => (
              <div key={b.title} className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary mt-0.5">{b.icon}</span>
                <div>
                  <p className="text-xs font-bold text-on-surface">{b.title}</p>
                  <p className="text-[11px] text-on-surface-variant">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step-by-step guide */}
        <div className="px-6 py-5 border-b border-outline-variant/10">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">How to get your key</p>
          <div className="space-y-3">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className={`rounded-xl border transition-all cursor-pointer ${
                  activeStep === i
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-outline-variant/10 bg-surface-container-high/30 hover:border-outline-variant/30'
                }`}
                onClick={() => setActiveStep(activeStep === i ? null : i)}
              >
                <div className="flex items-center gap-4 p-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${step.highlight ? 'bg-yellow-400/20 text-yellow-400' : 'bg-primary/10 text-primary'}`}>
                    <span className="material-symbols-outlined text-sm">{step.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-on-surface-variant/40 tracking-widest">STEP {step.num}</span>
                      {step.highlight && <span className="text-[9px] bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Important</span>}
                    </div>
                    <p className="text-sm font-bold text-on-surface">{step.title}</p>
                  </div>
                  <span className={`material-symbols-outlined text-on-surface-variant transition-transform ${activeStep === i ? 'rotate-180' : ''}`}>expand_more</span>
                </div>
                <AnimatePresence>
                  {activeStep === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pl-16 space-y-2">
                        <p className="text-sm text-on-surface-variant leading-relaxed">{step.desc}</p>
                        {step.link && (
                          <a
                            href={step.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline underline-offset-4"
                          >
                            {step.linkLabel}
                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                          </a>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        {/* Key input */}
        <div className="p-6 space-y-4">
          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            {hasKey ? 'Your stored key (click to update)' : 'Paste your Groq API key'}
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="gsk_..."
              className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl py-4 pl-4 pr-24 text-sm text-on-surface font-mono focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-on-surface-variant/30"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="text-on-surface-variant hover:text-on-surface transition-colors"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                <span className="material-symbols-outlined text-sm">{showKey ? 'visibility_off' : 'visibility'}</span>
              </button>
              {key && (
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(key); }}
                  className="text-on-surface-variant hover:text-on-surface transition-colors"
                  title="Copy"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                </button>
              )}
            </div>
          </div>

          {/* Status message */}
          <AnimatePresence>
            {status && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex items-start gap-2 p-3 rounded-xl text-sm ${
                  status.type === 'success'
                    ? 'bg-secondary/10 border border-secondary/20 text-secondary'
                    : 'bg-error/10 border border-error/20 text-error'
                }`}
              >
                <span className="material-symbols-outlined text-sm mt-0.5">
                  {status.type === 'success' ? 'check_circle' : 'error'}
                </span>
                {status.msg}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !key.trim()}
              className="flex-1 py-3 rounded-xl bg-[#551a8b] text-white font-bold text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <span className="material-symbols-outlined animate-spin text-sm">sync</span>
              ) : (
                <span className="material-symbols-outlined text-sm">lock</span>
              )}
              {saving ? 'Encrypting...' : 'Save Key'}
            </button>
            {hasKey && (
              <button
                onClick={handleRemove}
                disabled={saving}
                className="px-5 py-3 rounded-xl border border-error/20 text-error hover:bg-error/10 transition-colors text-sm font-bold disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>

          <p className="text-[11px] text-on-surface-variant/60 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">shield</span>
            Your key is encrypted with AES-256 (Fernet) before being stored. It is never logged or shared.
          </p>
        </div>
      </div>

      {/* ── AI Usage Policy Card ─────────────────────────────────────────── */}
      <div className="bg-surface-container rounded-2xl border border-outline-variant/10 overflow-hidden">
        <div className="p-6 border-b border-outline-variant/10 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary">verified_user</span>
          </div>
          <div>
            <h2 className="font-bold text-on-surface">AI Usage & Privacy Policy</h2>
            <p className="text-xs text-on-surface-variant">Terms established for responsible neural interaction.</p>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <section>
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                Accuracy Disclaimer
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                InStudy 2.0 uses Large Language Models to assist your studies. AI can make mistakes (hallucinations). Always verify critical information with your official study materials. This platform is an assistive tool, not a replacement for primary source materials.
              </p>
            </section>

            <section>
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                Data & Privacy
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Your documents are indexed locally for your account. If you use personal API keys, your queries are processed by the respective provider (e.g., Groq). We do not sell your study data or use private documents for global model training.
              </p>
            </section>

            <section>
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                Academic Integrity
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Use InStudy 2.0 to deepen your understanding. You are responsible for ensuring your use of this platform complies with your school or university's academic honesty policies.
              </p>
            </section>
          </div>

          <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10 flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary">check_circle</span>
            <div className="flex-1">
              <p className="text-[11px] font-bold text-on-surface">Policy Accepted</p>
              <p className="text-[10px] text-on-surface-variant">You have officially agreed to these terms.</p>
            </div>
            <span className="text-[10px] text-on-surface-variant italic">Active Session</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
