/**
 * EmptyState — consistent empty state component used across all feature pages.
 *
 * Props:
 *   icon        — material symbol name
 *   title       — main heading
 *   description — supporting text explaining why it's empty
 *   action      — { label, onClick } primary CTA button
 *   secondaryAction — { label, onClick } optional secondary link
 */
import { motion } from 'framer-motion';

const EmptyState = ({ icon = 'inventory_2', title, description, action, secondaryAction }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center text-center py-16 px-6 border border-dashed border-outline-variant/20 rounded-2xl bg-surface-container-low/40 max-w-md mx-auto"
  >
    <div className="w-16 h-16 rounded-2xl bg-surface-container-highest flex items-center justify-center mb-5">
      <span className="material-symbols-outlined text-3xl text-on-surface-variant opacity-50">{icon}</span>
    </div>

    <h3 className="text-base font-black text-on-surface mb-2 tracking-tight">{title}</h3>
    <p className="text-sm text-on-surface-variant leading-relaxed mb-6">{description}</p>

    {action && (
      <button
        onClick={action.onClick}
        className="px-6 py-3 bg-[#551a8b] text-white font-black text-xs uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
        {action.label}
      </button>
    )}

    {secondaryAction && (
      <button
        onClick={secondaryAction.onClick}
        className="mt-3 text-xs text-on-surface-variant hover:text-primary transition-colors font-bold uppercase tracking-widest"
      >
        {secondaryAction.label}
      </button>
    )}
  </motion.div>
);

export default EmptyState;
