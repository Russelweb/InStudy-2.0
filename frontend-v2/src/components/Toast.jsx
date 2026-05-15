/**
 * Toast — lightweight in-app notification (replaces alert())
 * Usage:
 *   import { showToast } from './Toast';
 *   showToast('Saved successfully!', 'success');
 *   showToast('Something went wrong.', 'error');
 *   showToast('No documents found.', 'warning');
 *
 * Also exports <ToastContainer /> — mount once in App.jsx or MainLayout.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Global event bus ──────────────────────────────────────────────────────
let _dispatch = null;

export function showToast(message, type = 'info', duration = 4000) {
  if (_dispatch) _dispatch({ message, type, duration, id: Date.now() });
}

// ── Individual toast ──────────────────────────────────────────────────────
const ICONS = {
  success: { icon: 'check_circle', color: 'text-secondary', border: 'border-secondary/30', bg: 'bg-secondary/10' },
  error:   { icon: 'cancel',       color: 'text-error',     border: 'border-error/30',     bg: 'bg-error/10'     },
  warning: { icon: 'warning',      color: 'text-primary',   border: 'border-primary/30',   bg: 'bg-primary/10'   },
  info:    { icon: 'info',         color: 'text-on-surface-variant', border: 'border-outline-variant/30', bg: 'bg-surface-container-high' },
};

const ToastItem = ({ toast, onDismiss }) => {
  const style = ICONS[toast.type] || ICONS.info;

  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-xl max-w-sm w-full ${style.bg} ${style.border}`}
    >
      <span className={`material-symbols-outlined text-xl shrink-0 mt-0.5 ${style.color}`}>{style.icon}</span>
      <p className="text-sm text-on-surface leading-snug flex-1">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-on-surface-variant hover:text-on-surface transition-colors shrink-0 mt-0.5"
      >
        <span className="material-symbols-outlined text-base">close</span>
      </button>
    </motion.div>
  );
};

// ── Container — mount once in MainLayout ─────────────────────────────────
export const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    _dispatch = (toast) => setToasts(prev => [...prev.slice(-4), toast]); // max 5
    return () => { _dispatch = null; };
  }, []);

  return (
    <div className="fixed bottom-6 right-4 z-[200] flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};
