/**
 * Modal — replaces prompt() and window.confirm()
 *
 * Two variants:
 *
 * 1. <InputModal> — replaces prompt()
 *    Props: open, title, description, placeholder, confirmLabel,
 *           onConfirm(value), onCancel, danger
 *
 * 2. <ConfirmModal> — replaces window.confirm()
 *    Props: open, title, description, confirmLabel, cancelLabel,
 *           onConfirm, onCancel, danger
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Shared backdrop + card shell ──────────────────────────────────────────
const ModalShell = ({ open, onCancel, children }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[150] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      >
        <motion.div
          initial={{ scale: 0.93, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.93, opacity: 0, y: 12 }}
          transition={{ duration: 0.18 }}
          className="bg-surface-container border border-outline-variant/15 rounded-2xl shadow-2xl w-full max-w-md p-7"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ── InputModal ────────────────────────────────────────────────────────────
export const InputModal = ({
  open,
  title = 'Enter a name',
  description = '',
  placeholder = '',
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  danger = false,
}) => {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setValue('');
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  const handleConfirm = () => {
    if (!value.trim()) return;
    onConfirm(value.trim());
    setValue('');
  };

  return (
    <ModalShell open={open} onCancel={onCancel}>
      <h2 className="text-xl font-black text-on-surface mb-1">{title}</h2>
      {description && <p className="text-sm text-on-surface-variant mb-5">{description}</p>}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') onCancel(); }}
        placeholder={placeholder}
        className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl py-3 px-4 text-sm text-on-surface focus:ring-1 focus:ring-primary/50 transition-all mb-6 placeholder:text-on-surface-variant/30"
      />
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-outline-variant/20 text-on-surface-variant text-sm font-bold hover:bg-surface-variant transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!value.trim()}
          className={`flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            danger
              ? 'bg-error text-on-error hover:opacity-90'
              : 'bg-[#551a8b] text-white hover:scale-[1.02] active:scale-95'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
};

// ── ConfirmModal ──────────────────────────────────────────────────────────
export const ConfirmModal = ({
  open,
  title = 'Are you sure?',
  description = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
}) => (
  <ModalShell open={open} onCancel={onCancel}>
    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${danger ? 'bg-error/15' : 'bg-primary/15'}`}>
      <span className={`material-symbols-outlined ${danger ? 'text-error' : 'text-primary'}`}>
        {danger ? 'warning' : 'help'}
      </span>
    </div>
    <h2 className="text-xl font-black text-on-surface mb-2">{title}</h2>
    {description && <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">{description}</p>}
    <div className="flex gap-3">
      <button
        onClick={onCancel}
        className="flex-1 py-3 rounded-xl border border-outline-variant/20 text-on-surface-variant text-sm font-bold hover:bg-surface-variant transition-colors"
      >
        {cancelLabel}
      </button>
      <button
        onClick={onConfirm}
        className={`flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
          danger
            ? 'bg-error text-on-error hover:opacity-90 active:scale-95'
            : 'bg-[#551a8b] text-white hover:scale-[1.02] active:scale-95'
        }`}
      >
        {confirmLabel}
      </button>
    </div>
  </ModalShell>
);
