import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import Flashcard from '../components/Flashcard';
import { flashcardService, masteryService, documentService } from '../services/api';

const Flashcards = () => {
  const [searchParams] = useSearchParams();
  const urlCourseId = searchParams.get('id');

  const [decks, setDecks] = useState([]);
  const [currentDeckId, setCurrentDeckId] = useState(urlCourseId || localStorage.getItem('activeCourse') || null);
  const [courseDocuments, setCourseDocuments] = useState([]);
  
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessionStats, setSessionStats] = useState({ learned: 0, remaining: 0, correct: 0, total: 0 });

  // Settings State
  const [showSettings, setShowSettings] = useState(true);
  const [settings, setSettings] = useState({
    numCards: 10,
    explanationLevel: 'detailed',
    targetDocument: 'all'
  });

  // ---------- Fetch courses as decks ----------
  const fetchDecks = async () => {
    try {
      const response = await flashcardService.getDecks();
      const courses = response.data.courses || [];
      setDecks(courses);
      
      if (courses.length > 0 && !currentDeckId) {
        const id = courses[0].id;
        setCurrentDeckId(id);
        localStorage.setItem('activeCourse', id);
      }
    } catch (error) {
      console.error('Failed to fetch decks:', error);
    }
  };

  useEffect(() => { fetchDecks(); }, []);

  // ---------- Fetch Documents for active course ----------
  useEffect(() => {
    if (!currentDeckId) return;
    
    // Always show settings when deck changes
    setShowSettings(true);
    setCards([]);
    
    documentService.listByCourse(currentDeckId)
      .then(res => {
        setCourseDocuments(res.data.documents || []);
        setSettings(s => ({ ...s, targetDocument: 'all' }));
      })
      .catch(err => {
        console.error('Failed to list docs:', err);
        setCourseDocuments([]);
      });
  }, [currentDeckId]);

  // ---------- Generate cards explicitly ----------
  const generateCards = async () => {
    if (!currentDeckId) return;
    setIsGenerating(true);
    setShowSettings(false);
    setCards([]);
    setCurrentIndex(0);
    try {
      const filenameStr = settings.targetDocument === 'all' ? null : settings.targetDocument;
      
      const response = await flashcardService.generate(
        currentDeckId, 
        settings.numCards, 
        settings.explanationLevel, 
        filenameStr
      );
      const newCards = response.data.flashcards || [];
      setCards(newCards);
      setSessionStats({ learned: 0, remaining: newCards.length, correct: 0, total: newCards.length });
    } catch (error) {
      console.error('Failed to generate cards:', error);
      alert('Failed to generate flashcards. Please check if documents exist in this module.');
      setShowSettings(true); // show settings again on failure
    } finally {
      setIsGenerating(false);
    }
  };

  // ---------- Mastery rating ----------
  const handleMasteryUpdate = async (value) => {
    const card = cards[currentIndex];
    if (!card) return;

    try {
      const conceptId = card.id || card.front || card.question || 'unknown_concept';
      await masteryService.update(currentDeckId, conceptId, value);
    } catch (error) {
      console.error('Mastery update failed:', error);
    }

    // Update session stats
    const isCorrect = value >= 0; // 0 (Familiar) or 1 (Mastered) count as correct
    setSessionStats((prev) => ({
      ...prev,
      learned: prev.learned + 1,
      remaining: Math.max(0, prev.remaining - 1),
      correct: isCorrect ? prev.correct + 1 : prev.correct,
    }));

    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Deck complete — show completion card
      setCurrentIndex(cards.length);
    }
  };

  const handleSkip = () => {
    setSessionStats((prev) => ({
      ...prev,
      remaining: Math.max(0, prev.remaining - 1),
    }));

    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(cards.length);
    }
  };

  const handleAbort = () => {
    setShowSettings(true);
    setCards([]);
    setCurrentIndex(0);
  };

  const isComplete = cards.length > 0 && currentIndex >= cards.length;
  const progress = cards.length > 0 ? Math.min(100, Math.round((currentIndex / cards.length) * 100)) : 0;
  const accuracy = sessionStats.total > 0
    ? Math.round((sessionStats.correct / Math.max(sessionStats.learned, 1)) * 100)
    : 0;

  const currentDeck = decks.find((d) => d.id === currentDeckId);

  const hudStats = [
    { label: 'Learned',   value: sessionStats.learned,   color: 'text-secondary' },
    { label: 'Remaining', value: sessionStats.remaining,  color: 'text-primary' },
    { label: 'Accuracy',  value: `${accuracy}%`,          color: 'text-tertiary-dim' },
  ];

  return (
    <div className="flex-1 ml-72 pt-20 h-screen overflow-hidden relative bg-background">
      {/* Central Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto h-full p-12 flex flex-col items-center">
        {/* HUD Stats */}
        <div className="w-full flex justify-between items-end mb-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-2"
          >
            <h1 className="text-4xl font-black tracking-tight text-on-surface">Flashcard Generator</h1>
            <div className="flex items-center gap-4 text-on-surface-variant text-sm font-medium">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">school</span>
                Module: {currentDeck ? currentDeck.name : 'Select a deck'}
              </span>
              {cards.length > 0 && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-outline-variant"></span>
                  <span className="text-primary font-bold">{cards.length} Cards Deep</span>
                </>
              )}
            </div>
          </motion.div>

          {!showSettings && (
            <div className="flex gap-6">
              {hudStats.map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-surface-container-low px-6 py-4 rounded-2xl border border-outline-variant/10 text-center min-w-[120px]"
                >
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 font-bold">{stat.label}</p>
                  <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Progress Bar & Abort */}
        {!showSettings && !isGenerating && (
          <div className="w-full flex items-center gap-6 mb-12">
            <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-primary shadow-[0_0_20px_#bd9dff]"
              ></motion.div>
            </div>
            <button 
              onClick={handleAbort} 
              className="text-error-dim/80 hover:text-error text-xs uppercase tracking-widest font-bold flex items-center gap-1 transition-colors group px-4 py-2 rounded-full hover:bg-error-container/10 border border-transparent hover:border-error-dim/20"
            >
              <span className="material-symbols-outlined text-sm group-hover:-rotate-90 transition-transform">close</span>
              Abort
            </button>
          </div>
        )}

        {/* Card Area */}
        <div className="flex-1 w-full flex items-center justify-center">
          <AnimatePresence mode="wait">
          {showSettings ? (
            <motion.div 
               key="settings"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               className="bg-surface-container-low w-full max-w-xl p-8 rounded-2xl border border-outline-variant/10 shadow-2xl"
            >
               <h2 className="text-2xl font-bold text-on-surface mb-6">Deck Configuration</h2>
               
               <div className="space-y-6">
                  {/* Number of Cards */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3 block">Deck Size</label>
                    <div className="flex gap-3">
                       {[5, 10, 20].map(num => (
                         <button 
                           key={num}
                           onClick={() => setSettings({...settings, numCards: num})}
                           className={`flex-1 py-3 rounded-xl border font-bold transition-all ${settings.numCards === num ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(189,157,255,0.2)]' : 'border-outline-variant/20 text-on-surface hover:bg-surface-variant'}`}
                         >
                            {num} Cards
                         </button>
                       ))}
                    </div>
                  </div>

                  {/* Explanation Level */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3 block">Detail Level</label>
                    <div className="flex gap-3">
                       {['brief', 'detailed', 'comprehensive'].map(lvl => (
                         <button 
                           key={lvl}
                           onClick={() => setSettings({...settings, explanationLevel: lvl})}
                           className={`flex-1 py-3 rounded-xl border font-bold capitalize transition-all ${settings.explanationLevel === lvl ? 'bg-secondary/20 border-secondary text-secondary shadow-[0_0_15px_rgba(105,246,184,0.2)]' : 'border-outline-variant/20 text-on-surface hover:bg-surface-variant'}`}
                         >
                            {lvl}
                         </button>
                       ))}
                    </div>
                  </div>

                  {/* Document Target */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3 block">Target Material</label>
                    <select 
                      value={settings.targetDocument}
                      onChange={(e) => setSettings({...settings, targetDocument: e.target.value})}
                      className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl py-3 px-4 text-sm text-on-surface focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer"
                    >
                      <option value="all">All Documents in Module</option>
                      {courseDocuments.map(doc => (
                        <option key={doc} value={doc}>{doc}</option>
                      ))}
                    </select>
                  </div>

                  <button 
                    onClick={generateCards}
                    disabled={!currentDeckId}
                    className="w-full mt-4 py-4 rounded-xl signature-gradient text-on-primary font-black text-sm uppercase tracking-widest shadow-lg scale-100 hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-50"
                  >
                    Generate
                  </button>
               </div>
            </motion.div>

          ) : isGenerating ? (
            <motion.div key="generating" className="flex flex-col items-center gap-6 animate-pulse">
              <div className="w-16 h-16 signature-gradient rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(189,157,255,0.4)]">
                <span className="material-symbols-outlined text-white text-3xl animate-spin">memory</span>
              </div>
              <p className="text-secondary font-bold tracking-widest uppercase">Synthesizing Flashcards...</p>
            </motion.div>
          ) : isComplete ? (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6"
            >
              <div className="w-24 h-24 mx-auto rounded-full signature-gradient flex items-center justify-center shadow-[0_0_40px_rgba(105,246,184,0.4)]">
                <span className="material-symbols-outlined text-white text-4xl">Congratulations</span>
              </div>
              <h2 className="text-3xl font-black text-on-surface">Deck Complete!</h2>
              <p className="text-on-surface-variant">
                You scored <span className="text-secondary font-bold">{accuracy}%</span> accuracy across {sessionStats.total} cards.
              </p>
              <button
                onClick={() => setShowSettings(true)}
                className="px-8 py-4 signature-gradient rounded-xl font-bold text-on-primary hover:scale-105 transition-transform mt-4"
              >
                Configure New Deck
              </button>
            </motion.div>
          ) : cards.length > 0 ? (
            <Flashcard key="flashcard" {...cards[currentIndex]} />
          ) : (
            <div key="empty" className="text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-5xl mb-4 block opacity-40">style</span>
              <p className="font-bold">Select a deck from the sidebar to start training.</p>
            </div>
          )}
          </AnimatePresence>
        </div>

        {/* Training Controls */}
        {!showSettings && !isGenerating && !isComplete && cards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-auto w-full max-w-3xl grid grid-cols-4 gap-4 pb-12"
          >
            <button
              onClick={() => handleMasteryUpdate(-1)}
              className="group flex flex-col items-center gap-3 p-4 rounded-2xl bg-error-container/10 border border-error-dim/20 hover:bg-error-container/20 transition-all scale-95 hover:scale-100 active:scale-90"
            >
              <div className="w-12 h-12 rounded-full bg-error-container flex items-center justify-center text-on-error shadow-[0_0_20px_rgba(215,51,87,0.3)] group-hover:shadow-[0_0_30px_rgba(215,51,87,0.5)] transition-all">
                <span className="material-symbols-outlined font-bold">close</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-error-dim">Unfamiliar</span>
            </button>

            <button
              onClick={() => handleMasteryUpdate(0)}
              className="group flex flex-col items-center gap-3 p-4 rounded-2xl bg-surface-container-highest border border-outline-variant/20 hover:bg-surface-variant transition-all shadow-xl scale-100 active:scale-95"
            >
              <div className="w-12 h-12 rounded-full bg-[#b8f9de] flex items-center justify-center text-[#074e3b] shadow-[0_0_20px_rgba(184,249,222,0.3)] group-hover:shadow-[0_0_30px_rgba(184,249,222,0.5)] transition-all">
                <span className="material-symbols-outlined font-bold">check</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-tertiary-fixed">Familiar</span>
            </button>

            <button
              onClick={() => handleMasteryUpdate(1)}
              className="group flex flex-col items-center gap-3 p-4 rounded-2xl bg-secondary-container/10 border border-secondary/20 hover:bg-secondary-container/20 transition-all scale-95 hover:scale-100 active:scale-90"
            >
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-on-secondary shadow-[0_0_20px_rgba(105,246,184,0.3)] group-hover:shadow-[0_0_30px_rgba(105,246,184,0.5)] transition-all">
                <span className="material-symbols-outlined font-bold">auto_awesome</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Mastered</span>
            </button>

            <button
               onClick={handleSkip}
               className="group flex flex-col items-center gap-3 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/10 hover:bg-surface-variant transition-all scale-95 hover:scale-100 active:scale-90"
             >
               <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant group-hover:text-on-surface transition-all">
                 <span className="material-symbols-outlined font-bold">double_arrow</span>
               </div>
               <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Skip</span>
             </button>
          </motion.div>
        )}
      </div>

      {/* Sidebar — deck list */}
      <aside className="fixed left-0 top-0 h-full w-72 z-40 bg-[#0a0f0b] flex flex-col py-24 px-6 space-y-6 border-r border-white/5 bg-[#0f1510]">
        <div className="px-2">
          <h2 className="text-lg font-bold text-purple-400 font-headline">Neuro-Sync</h2>
          <p className="text-xs text-emerald-100/40 uppercase tracking-widest font-medium mt-1">Flashcard Decks</p>
        </div>

        <button
          onClick={() => setShowSettings(true)}
          disabled={!currentDeckId || isGenerating || showSettings}
          className="w-full signature-gradient py-3 rounded-xl font-bold text-on-primary shadow-lg flex items-center justify-center gap-2 group hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined group-hover:rotate-90 transition-transform">settings</span>
          Configure Deck
        </button>

        <nav className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
          {decks.length === 0 ? (
            <p className="text-center text-on-surface-variant text-xs py-8 px-2">
              No courses found. Create a course in the Knowledge Base first.
            </p>
          ) : (
            decks.map((deck) => (
              <button
                key={deck.id}
                onClick={() => {
                  setCurrentDeckId(deck.id);
                  localStorage.setItem('activeCourse', deck.id);
                }}
                className={`w-full text-left flex items-center gap-4 px-4 py-3 rounded-lg transition-all ${
                  currentDeckId === deck.id
                    ? 'text-emerald-400 font-bold border-r-4 border-emerald-500 bg-emerald-500/5'
                    : 'text-emerald-100/40 hover:bg-purple-500/10 hover:text-purple-300'
                }`}
              >
                <span className="material-symbols-outlined shrink-0">layers</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{deck.name}</p>
                  <p className="text-[10px] opacity-60">{deck.document_count} docs</p>
                </div>
              </button>
            ))
          )}
        </nav>

        {/* Mastery summary per deck */}
        <div className="mt-auto space-y-1">
          {decks.slice(0, 3).map((deck, i) => (
            <div key={i} className="flex justify-between items-center group cursor-pointer px-4 py-2 hover:bg-white/5 rounded-lg transition-colors">
              <span className="text-xs text-on-surface-variant group-hover:text-primary transition-colors truncate pr-2">{deck.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${deck.mastery > 0 ? 'border-primary/20 text-primary bg-primary/10' : 'border-outline-variant/20 text-on-surface-variant'}`}>
                {deck.mastery || 0}%
              </span>
            </div>
          ))}
        </div>
      </aside>

      {/* Status Chips */}
      <div className="fixed bottom-8 left-80 flex gap-4 z-30">
        <div className="flex items-center gap-2 bg-surface-container-low/60 backdrop-blur-md px-4 py-2 rounded-full border border-primary/20 text-xs">
          <div className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_#bd9dff]"></div>
          <span className="text-on-surface-variant">Focus Mode: <span className="text-primary font-bold">{showSettings ? 'Configuration' : 'Deep Study'}</span></span>
        </div>
        <div className="flex items-center gap-2 bg-surface-container-low/60 backdrop-blur-md px-4 py-2 rounded-full border border-secondary/20 text-xs">
          <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_#69f6b8] ${isGenerating ? 'bg-yellow-400 animate-pulse' : 'bg-secondary'}`}></div>
          <span className="text-on-surface-variant">Sync: <span className="text-secondary font-bold">{isGenerating ? 'Processing' : 'Active'}</span></span>
        </div>
      </div>
    </div>
  );
};

export default Flashcards;
