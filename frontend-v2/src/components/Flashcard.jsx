import { useState } from 'react';
import { motion } from 'framer-motion';

const Flashcard = ({ question, answer, category, front, back, concept }) => {
  const displayQuestion = question || front || 'No question provided';
  const displayAnswer = answer || back || 'No answer provided';
  const displayCategory = category || concept || 'Concept';
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className="relative w-full max-w-full sm:max-w-[520px] md:max-w-[580px] h-[260px] sm:h-[300px] lg:h-[350px] cursor-pointer perspective-1000 mx-auto"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
        className="w-full h-full relative group"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front Face */}
        <div
          className="absolute inset-0 glass-card rounded-2xl sm:rounded-[1.5rem] p-4 sm:p-6 md:p-8 flex flex-col justify-between aura-glow-purple"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
        >
          <div className="flex justify-between items-start shrink-0">
            <span className="material-symbols-outlined text-primary-dim text-2xl sm:text-3xl md:text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
            <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.15em] font-bold text-primary/60 border border-primary/20 px-2 sm:px-3 py-1 rounded-full truncate max-w-[120px] sm:max-w-none">{displayCategory}</span>
          </div>
          <div className="overflow-y-auto custom-scrollbar pr-1 my-2 flex-1 flex items-center">
            <h3 className="text-base sm:text-lg lg:text-xl font-bold leading-snug text-on-surface w-full">{displayQuestion}</h3>
          </div>
          <div className="text-on-surface-variant text-[10px] sm:text-xs italic opacity-50 flex items-center gap-1.5 shrink-0">
            <span className="material-symbols-outlined text-sm">touch_app</span>
            Tap to reveal...
          </div>
        </div>

        {/* Back Face */}
        <div
          className="absolute inset-0 glass-card rounded-2xl sm:rounded-[1.5rem] p-4 sm:p-6 md:p-8 flex flex-col justify-between aura-glow-emerald"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="flex justify-between items-start shrink-0">
            <span className="flex items-center gap-1.5 text-secondary bg-secondary/10 px-3 py-1 rounded-full border border-secondary/20">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold">Context</span>
            </span>
          </div>
          <div className="overflow-y-auto custom-scrollbar pr-1 my-2 flex-1">
            <p className="text-xs sm:text-sm lg:text-base leading-relaxed text-emerald-100/90 font-medium">
              {displayAnswer}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_#69f6b8]"></div>
            <span className="text-[9px] sm:text-[10px] text-secondary font-medium tracking-widest uppercase">InStudy 2.0 Can make mistakes please verify</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Flashcard;
