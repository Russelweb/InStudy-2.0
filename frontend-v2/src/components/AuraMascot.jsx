/**
 * AuraMascot — the visual Aura companion.
 * Mounted once in MainLayout. Reads from AuraContext.
 *
 * Sits fixed bottom-right. The orb animates based on mode.
 * Speech bubble appears above the orb when there's a message.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useAura } from '../context/AuraContext';
import AuraQuickChat from './AuraQuickChat';
import TextSelectionMenu from './TextSelectionMenu';

// ── Orb animation variants per mode ──────────────────────────────────────
const orbVariants = {
  idle: {
    y: [0, -6, 0],
    scale: 1,
    rotate: 0,
    transition: { y: { repeat: Infinity, duration: 3, ease: 'easeInOut' }, scale: { duration: 0.3 } }
  },
  pointing: {
    y: -10,
    scale: 1.08,
    rotate: -14,
    transition: { duration: 0.4, ease: 'easeOut' }
  },
  thinking: {
    scale: [1, 1.05, 1],
    rotate: [0, 360],
    transition: {
      scale: { repeat: Infinity, duration: 1.8, ease: 'easeInOut' },
      rotate: { repeat: Infinity, duration: 2.5, ease: 'linear' }
    }
  },
  celebrating: {
    y: [0, -18, 0, -10, 0],
    scale: [1, 1.2, 1, 1.1, 1],
    rotate: [0, 8, -8, 4, 0],
    transition: { duration: 0.7, ease: 'easeOut' }
  },
  concerned: {
    x: [0, -4, 4, -3, 3, 0],
    scale: 0.95,
    rotate: 0,
    transition: { x: { duration: 0.4, ease: 'easeOut' }, scale: { duration: 0.3 } }
  },
  nudge: {
    y: [0, -8, 0],
    scale: [1, 1.06, 1],
    rotate: [0, -6, 6, 0],
    transition: { duration: 0.6, ease: 'easeOut' }
  },
};

// ── Orb glow color per mode ───────────────────────────────────────────────
const orbGlow = {
  idle:        'rgba(189,157,255,0.35)',
  pointing:    'rgba(189,157,255,0.55)',
  thinking:    'rgba(189,157,255,0.4)',
  celebrating: 'rgba(105,246,184,0.6)',
  concerned:   'rgba(215,51,87,0.4)',
  nudge:       'rgba(189,157,255,0.45)',
};

const orbInner = {
  idle:        ['#7c3aed', '#4f1d96'],
  pointing:    ['#9333ea', '#6b21a8'],
  thinking:    ['#7c3aed', '#4f1d96'],
  celebrating: ['#059669', '#065f46'],
  concerned:   ['#be123c', '#881337'],
  nudge:       ['#7c3aed', '#4f1d96'],
};

// ── Upward pointer arrow (for onboarding/guide) ───────────────────────────
const PointerArrow = () => (
  <motion.div
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: [0, 1, 1, 0], y: [4, 0, 0, -4] }}
    transition={{ duration: 1.6, repeat: 2, ease: 'easeInOut' }}
    className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5"
  >
    <span className="material-symbols-outlined text-primary text-lg">keyboard_arrow_up</span>
  </motion.div>
);

// ── Speech bubble ─────────────────────────────────────────────────────────
const SpeechBubble = ({ message, action, mode, onDismiss }) => {
  const borderColor = {
    celebrating: 'border-secondary/30',
    concerned:   'border-error-dim/30',
    nudge:       'border-primary/30',
    pointing:    'border-primary/30',
    guide:       'border-primary/30',
  }[mode] || 'border-outline-variant/20';

  const iconColor = {
    celebrating: 'text-secondary',
    concerned:   'text-error',
    nudge:       'text-primary',
  }[mode] || 'text-primary';

  const icon = {
    celebrating: 'celebration',
    concerned:   'warning',
    nudge:       'schedule',
    pointing:    'arrow_upward',
    guide:       'lightbulb',
  }[mode] || 'auto_awesome';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.94 }}
      transition={{ duration: 0.2 }}
      className={`absolute bottom-16 right-0 w-64 sm:w-72 bg-surface-container border ${borderColor} rounded-2xl shadow-2xl p-4 backdrop-blur-xl`}
      style={{ background: 'rgba(24,32,25,0.95)' }}
    >
      {/* Tail */}
      <div className="absolute -bottom-2 right-5 w-4 h-4 bg-surface-container border-r border-b border-outline-variant/20 rotate-45"
           style={{ background: 'rgba(24,32,25,0.95)' }} />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-base ${iconColor}`}>{icon}</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Aura</span>
        </div>
        <button
          onClick={onDismiss}
          className="text-on-surface-variant/40 hover:text-on-surface-variant transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>

      {/* Message */}
      <p className="text-sm text-on-surface leading-snug mb-3">{message}</p>

      {/* Action button */}
      {action && (
        <button
          onClick={() => { action.onClick(); onDismiss(); }}
          className="w-full py-2 px-3 bg-primary/10 border border-primary/20 text-primary rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center justify-center gap-1.5"
        >
          {action.label}
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      )}
    </motion.div>
  );
};

// ── Main component ────────────────────────────────────────────────────────
const AuraMascot = () => {
  const { auraState, dismissAura, handleOrbClick, toggleQuickChat } = useAura();
  const { mode, message, action, visible } = auraState;

  const glow   = orbGlow[mode]  || orbGlow.idle;
  const colors = orbInner[mode] || orbInner.idle;
  const showArrow = (mode === 'pointing' || mode === 'guide') && visible;

  return (
    <>
      {/* Global Text Selection Listener for Aura */}
      <TextSelectionMenu />

      <div className="fixed bottom-6 right-5 z-[110] flex flex-col items-end select-none">
        {/* Quick Chat Popover */}
      <AuraQuickChat />

      {/* Speech bubble */}
      <AnimatePresence>
        {visible && message && (
          <SpeechBubble
            key="bubble"
            message={message}
            action={action}
            mode={mode}
            onDismiss={dismissAura}
          />
        )}
      </AnimatePresence>

      {/* Orb */}
      <motion.button
        onClick={() => {
          if (visible) {
            dismissAura();
          } else {
            toggleQuickChat();
          }
        }}
        aria-label="Aura — click to chat"
        className="relative w-12 h-12 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        variants={orbVariants}
        animate={mode}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.92 }}
      >
        {/* Pointer arrow */}
        <AnimatePresence>
          {showArrow && <PointerArrow key="arrow" />}
        </AnimatePresence>

        {/* Outer glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{ boxShadow: `0 0 20px 6px ${glow}` }}
          transition={{ duration: 0.4 }}
        />

        {/* Orb body — SVG gradient sphere */}
        <svg viewBox="0 0 48 48" className="w-full h-full" aria-hidden="true">
          <defs>
            <radialGradient id="aura-grad" cx="35%" cy="30%" r="65%">
              <stop offset="0%"   stopColor={colors[0]} stopOpacity="1" />
              <stop offset="100%" stopColor={colors[1]} stopOpacity="1" />
            </radialGradient>
            <radialGradient id="aura-shine" cx="30%" cy="25%" r="40%">
              <stop offset="0%"   stopColor="white" stopOpacity="0.25" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Base sphere */}
          <circle cx="24" cy="24" r="22" fill="url(#aura-grad)" />
          {/* Shine highlight */}
          <circle cx="24" cy="24" r="22" fill="url(#aura-shine)" />
          {/* Inner symbol — changes by mode */}
          {mode === 'thinking' && (
            <motion.circle
              cx="24" cy="24" r="8"
              fill="none"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="2"
              strokeDasharray="16 32"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
              style={{ transformOrigin: '24px 24px' }}
            />
          )}
          {mode === 'celebrating' && (
            <>
              <circle cx="18" cy="22" r="2.5" fill="rgba(255,255,255,0.7)" />
              <circle cx="24" cy="18" r="2.5" fill="rgba(255,255,255,0.7)" />
              <circle cx="30" cy="22" r="2.5" fill="rgba(255,255,255,0.7)" />
            </>
          )}
          {(mode === 'idle' || mode === 'pointing' || mode === 'nudge' || mode === 'guide') && (
            /* Subtle inner glow dot */
            <circle cx="24" cy="24" r="6" fill="rgba(255,255,255,0.15)" />
          )}
          {mode === 'concerned' && (
            /* Dimmed inner */
            <circle cx="24" cy="24" r="6" fill="rgba(0,0,0,0.2)" />
          )}
        </svg>
      </motion.button>
    </div>
    </>
  );
};

export default AuraMascot;
