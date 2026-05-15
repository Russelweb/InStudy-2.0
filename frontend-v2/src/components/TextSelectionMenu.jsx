import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAura } from '../context/AuraContext';

const TextSelectionMenu = () => {
  const { openQuickChatWithQuery } = useAura();
  const [selection, setSelection] = useState({
    text: '',
    x: 0,
    y: 0,
    show: false
  });

  useEffect(() => {
    const handleMouseUp = (e) => {
      // Small timeout to allow double-click selection to resolve
      setTimeout(() => {
        const activeSelection = window.getSelection();
        const text = activeSelection.toString().trim();
        
        if (text.length > 5 && activeSelection.rangeCount > 0) {
          const range = activeSelection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          // Only show if the selection is visible on screen
          if (rect.width > 0 && rect.height > 0) {
            setSelection({
              text,
              // Center horizontally over selection, put slightly above
              x: rect.left + rect.width / 2,
              y: rect.top - 10,
              show: true
            });
          }
        } else {
          setSelection(prev => ({ ...prev, show: false }));
        }
      }, 50);
    };

    const handleMouseDown = (e) => {
      // Don't hide if clicking on the menu itself
      if (e.target.closest('#aura-selection-menu')) return;
      setSelection(prev => ({ ...prev, show: false }));
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  const handleExplain = () => {
    openQuickChatWithQuery(`Explain this concept: "${selection.text}"`);
    setSelection(prev => ({ ...prev, show: false }));
    window.getSelection()?.removeAllRanges();
  };

  return (
    <AnimatePresence>
      {selection.show && (
        <motion.div
          id="aura-selection-menu"
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 5, scale: 0.9 }}
          transition={{ duration: 0.15 }}
          className="fixed z-[9999] flex items-center gap-1 p-1 bg-surface-container-high/90 backdrop-blur-md border border-outline-variant/30 rounded-xl shadow-xl pointer-events-auto"
          style={{
            left: selection.x,
            top: selection.y,
            transform: 'translate(-50%, -100%)', // Center X, sit above Y
          }}
        >
          <button
            onClick={handleExplain}
            className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-primary/10 rounded-lg text-primary transition-colors whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
            <span className="text-xs font-bold tracking-wide">Explain with Aura</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TextSelectionMenu;
