import { motion } from 'framer-motion';
import { useState } from 'react';

const CourseCard = ({ id, title, lastAccessed, materialCount, mastery, image, onOpen, onSelect, isActive }) => {
  const [imgError, setImgError] = useState(false);
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -5 }}
      onClick={() => onSelect && onSelect(id)}
      className={`group bg-surface-container-low rounded-2xl p-6 ghost-border transition-all duration-500 relative flex flex-col aura-glow overflow-hidden cursor-pointer ${
        isActive 
          ? 'ring-2 ring-secondary bg-secondary/5 border-secondary/40' 
          : 'hover:border-primary/40 hover:bg-surface-container-high'
      }`}
    >
      {isActive && (
        <div className="absolute top-0 left-0 bg-secondary text-on-secondary px-3 py-1 rounded-br-xl text-[10px] font-black uppercase tracking-widest z-20 shadow-lg">
          Active Course
        </div>
      )}
      <div className="h-48 mb-6 rounded-xl overflow-hidden relative">
        {image && !imgError ? (
          <img
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80 group-hover:opacity-100"
            src={image}
            alt={title}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full signature-gradient opacity-40 group-hover:opacity-60 transition-opacity"></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low to-transparent"></div>
        
        {/* Progress Ring */}
        <div className="absolute top-4 right-4 w-12 h-12">
          <svg className="w-full h-full -rotate-90">
            <circle className="text-surface-variant" cx="24" cy="24" fill="transparent" r="20" stroke="currentColor" strokeWidth="4"></circle>
            <motion.circle 
              initial={{ strokeDashoffset: 125.6 }}
              whileInView={{ strokeDashoffset: 125.6 - (125.6 * mastery) / 100 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="text-secondary" 
              cx="24" cy="24" fill="transparent" r="20" 
              stroke="currentColor" 
              strokeDasharray="125.6" 
              strokeWidth="4"
            ></motion.circle>
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-on-surface">{mastery}%</span>
        </div>
      </div>

      <div className="flex-1">
        <h3 className="text-2xl font-bold text-on-surface mb-2 leading-tight">{title}</h3>
        <div className="flex items-center gap-4 text-on-surface-variant text-sm mb-6">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">upload_file</span>
            {lastAccessed}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">layers</span>
            {materialCount} Materials
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-outline-variant/10 mt-auto">
        <div className="flex -space-x-2">
          <div className="w-8 h-8 rounded-full border-2 border-surface bg-surface-container-high"></div>
          <div className="w-8 h-8 rounded-full border-2 border-surface bg-surface-container-high"></div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="p-2 rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 transition-all hover:scale-110 active:scale-90"
          title="Launch Workspace"
        >

          <span className="material-symbols-outlined">rocket_launch</span>

        </button>
      </div>
    </motion.div>
  );
};

export default CourseCard;
