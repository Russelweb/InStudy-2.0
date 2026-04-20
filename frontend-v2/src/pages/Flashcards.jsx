import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import Flashcard from '../components/Flashcard';
import { flashcardService, masteryService, documentService, assetService } from '../services/api';

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
  const [isSaving, setIsSaving] = useState(false);

  // Settings State
  const [showSettings, setShowSettings] = useState(true);
  const [settings, setSettings] = useState({
    numCards: 10,
    explanationLevel: 'detailed',
    targetDocument: 'all'
  });
  const isInitialized = useRef(false);

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

  useEffect(() => { 
    fetchDecks(); 
    
    // Check for loaded asset from Saved Assets page FIRST
    const loadedAsset = localStorage.getItem('load_asset_flashcards');
    if (loadedAsset) {
      try {
        const asset = JSON.parse(loadedAsset);
        console.log('Loading saved flashcard deck:', asset.title);
        setCards(asset.data.cards || []);
        setSettings(asset.data.settings || settings);
        setCurrentDeckId(asset.course_id);
        setShowSettings(false); // Force hide settings
        setCurrentIndex(0);
        setSessionStats({ 
          learned: 0, 
          remaining: asset.data.cards?.length || 0, 
          correct: 0, 
          total: asset.data.cards?.length || 0 
        });
        localStorage.removeItem('load_asset_flashcards');
        setTimeout(() => { isInitialized.current = true; }, 100);
        return; // Skip normal persistence loading
      } catch (e) {
        console.error('Failed to load asset:', e);
      }
    }
    
    // Load persisted state (only if no asset was loaded)
    const savedDeckId = localStorage.getItem('flashcards_deck_id');
    const savedCards = localStorage.getItem('flashcards_cards');
    const savedIndex = localStorage.getItem('flashcards_index');
    const savedShowSettings = localStorage.getItem('flashcards_show_settings');
    const savedSettings = localStorage.getItem('flashcards_settings');

    if (savedDeckId) setCurrentDeckId(savedDeckId);
    if (savedCards) setCards(JSON.parse(savedCards));
    if (savedIndex) setCurrentIndex(parseInt(savedIndex));
    if (savedShowSettings) setShowSettings(savedShowSettings === 'true');
    if (savedSettings) setSettings(JSON.parse(savedSettings));

    setTimeout(() => { isInitialized.current = true; }, 100);
  }, []);

  useEffect(() => {
    // Only persist after init
    if (!isInitialized.current) return;
    
    if (currentDeckId) localStorage.setItem('flashcards_deck_id', currentDeckId);
    localStorage.setItem('flashcards_cards', JSON.stringify(cards));
    localStorage.setItem('flashcards_index', currentIndex.toString());
    localStorage.setItem('flashcards_show_settings', showSettings.toString());
    localStorage.setItem('flashcards_settings', JSON.stringify(settings));
  }, [currentDeckId, cards, currentIndex, showSettings, settings]);

  const clearPersistence = () => {
    localStorage.removeItem('flashcards_cards');
    localStorage.removeItem('flashcards_index');
    localStorage.removeItem('flashcards_show_settings');
  };

  const handleSave = async () => {
    if (cards.length === 0) return;
    
    const title = prompt('Name this flashcard deck:');
    if (!title) return;
    
    setIsSaving(true);
    try {
      await assetService.save(
        currentDeckId,
        'flashcards',
        title,
        { cards, settings },
        { card_count: cards.length }
      );
      alert('✅ Flashcard deck saved successfully!');
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save deck. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- Fetch Documents for active course ----------
  useEffect(() => {
    // Always show settings when deck changes manually
    // but only if it's a NEW deck, otherwise we might be restoring session
    // Actually, let's keep it simple: if the user clicks a new deck, clear current session
    if (currentDeckId !== localStorage.getItem('flashcards_deck_id')) {
        clearPersistence();
        setShowSettings(true);
        setCards([]);
    }
    
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
      const msg = error.response?.data?.detail || '';
      if (msg.includes('No documents')) {
        alert('📂 No documents found in this course.\n\nGo to Knowledge Base → select this course → upload a PDF or document first, then come back to generate flashcards.');
      } else if (msg.includes('API key') || error.response?.status === 401) {
        alert('🔑 No AI key configured.\n\nGo to Settings and paste your Groq API key to enable AI features.');
      } else {
        alert('Something went wrong generating flashcards. Please try again.');
      }
      setShowSettings(true);
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
    clearPersistence();
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
    <div className="flex-1 min-h-screen relative bg-background overflow-hidden p-4 md:p-8">
      {/* Central Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-5xl mx-auto h-full flex flex-col items-center">
        {/* HUD Stats */}
        <div className="w-full flex justify-between items-center mb-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-1"
          >
            <h1 className="text-2xl font-black tracking-tight text-on-surface uppercase italic">Flashcard <span className="text-primary">Lab</span></h1>
            <div className="flex items-center gap-3 text-on-surface-variant text-[10px] uppercase tracking-wider font-bold">
               <span className="text-secondary">Repetitive learning Engine</span>
               {cards.length > 0 && (
                <>
                   <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
                   <span className="text-primary">{cards.length} Cards Active</span>
                </>
              )}
            </div>
          </motion.div>

          {!showSettings && (
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={cards.length === 0 || isSaving}
                className="px-4 py-2 rounded-xl bg-secondary/10 text-secondary border border-secondary/20 font-bold text-xs uppercase tracking-widest hover:bg-secondary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">save</span>
                {isSaving ? 'Saving...' : 'Save Deck'}
              </button>
              {hudStats.map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-surface-container-low px-4 py-2 rounded-xl border border-outline-variant/10 text-center min-w-[90px]"
                >
                  <p className="text-[8px] uppercase tracking-widest text-on-surface-variant mb-0.5 font-bold">{stat.label}</p>
                  <p className={`text-lg font-black ${stat.color}`}>{stat.value}</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Progress Bar & Abort */}
        {!showSettings && !isGenerating && (
          <div className="w-full flex items-center gap-4 mb-6">
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
        <div className="flex-1 w-full flex items-center justify-center overflow-hidden py-2 px-2">
          <AnimatePresence mode="wait">
          {showSettings ? (
            <motion.div 
               key="settings"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="relative w-full max-w-2xl"
            >
               <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/10 blur-[100px] rounded-full pointer-events-none"></div>
               <div className="relative bg-surface-container/40 backdrop-blur-xl border border-outline-variant/15 rounded-2xl md:rounded-3xl p-5 sm:p-8 md:p-10 shadow-2xl overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 group-hover:opacity-100 transition-opacity opacity-0 pointer-events-none"></div>
                  
                  <div className="relative text-center mb-6 md:mb-10">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter mb-2 md:mb-3 bg-[#551a8b] bg-clip-text text-transparent italic uppercase">Deck Configuration</h2>
                    <p className="text-on-surface-variant text-xs sm:text-sm font-medium">Customize Your Flashcard Deck.</p>
                  </div>
                  
                  <div className="relative space-y-8">
                      {/* Course Selector */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Course/Module Source</label>
                        <div className="relative">
                          <select
                            value={currentDeckId || ''}
                            onChange={(e) => setCurrentDeckId(e.target.value)}
                            className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-4 text-on-surface focus:border-primary transition-all appearance-none text-sm font-bold"
                          >
                            <option value="" disabled>SELECT COURSE</option>
                            {decks.map(deck => (
                              <option key={deck.id} value={deck.id}>{deck.name} ({deck.document_count} docs)</option>
                            ))}
                          </select>
                          <span className="material-symbols-outlined absolute right-4 top-4 text-on-surface-variant pointer-events-none">expand_more</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Number of Cards */}
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Deck Size</label>
                          <div className="flex gap-2">
                            {[5, 10, 20].map(num => (
                              <button 
                                key={num}
                                onClick={() => setSettings({...settings, numCards: num})}
                                className={`flex-1 py-3 rounded-xl border text-xs font-bold transition-all ${settings.numCards === num ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(189,157,255,0.2)]' : 'border-outline-variant/20 text-on-surface/60 hover:bg-white/5'}`}
                              >
                                  {num}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Explanation Level */}
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Detail Intensity</label>
                          <div className="flex gap-2">
                            {['brief', 'detailed'].map(lvl => (
                              <button 
                                key={lvl}
                                onClick={() => setSettings({...settings, explanationLevel: lvl})}
                                className={`flex-1 py-3 rounded-xl border text-xs font-bold capitalize transition-all ${settings.explanationLevel === lvl ? 'bg-secondary/20 border-secondary text-secondary shadow-[0_0_15px_rgba(105,246,184,0.2)]' : 'border-outline-variant/20 text-on-surface/60 hover:bg-white/5'}`}
                              >
                                  {lvl}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Document Target */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Specific Document Focus</label>
                        <div className="relative">
                          <select 
                            value={settings.targetDocument}
                            onChange={(e) => setSettings({...settings, targetDocument: e.target.value})}
                            className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-4 text-sm text-on-surface focus:border-primary transition-all appearance-none font-bold"
                          >
                            <option value="all">Total Material Usage (All docs)</option>
                            {courseDocuments.map(doc => (
                              <option key={doc} value={doc}>{doc}</option>
                            ))}
                          </select>
                          <span className="material-symbols-outlined absolute right-4 top-4 text-on-surface-variant pointer-events-none">expand_more</span>
                        </div>
                      </div>

                      <button 
                        onClick={generateCards}
                        disabled={!currentDeckId}
                        className="relative z-10 w-full mt-4 py-5 rounded-2xl bg-[#551a8b] text-on-white font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        Synthesize Deck
                      </button>
                  </div>
               </div>
            </motion.div>

          ) : isGenerating ? (
            <motion.div
  key="generating"
  className="flex flex-col items-center gap-6 text-center mt-40"
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
>
  {/* Core AI Orb */}
  <div className="relative w-20 h-20">

    {/* Glow */}
    <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-2xl animate-pulse"></div>

    {/* Rotating ring */}
    <motion.div
      className="absolute inset-0 rounded-full border-2 border-purple-400/40"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
    />

    {/* Inner core */}
    <div className="w-full h-full rounded-full bg-[#551a8b] flex items-center justify-center shadow-[0_0_60px_rgba(189,157,255,0.6)]">
      <motion.span
        className="material-symbols-outlined text-white text-3xl"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
      >
        auto_awesome
      </motion.span>
    </div>
  </div>

  {/* Dynamic AI Text */}
  <motion.p
    className="text-secondary font-black tracking-[0.3em] uppercase text-xs"
    animate={{ opacity: [0.4, 1, 0.4] }}
    transition={{ repeat: Infinity, duration: 2 }}
  >
    Generating Knowledge Graph...
  </motion.p>

  {/* Sub-steps (THIS is the magic) */}
  <div className="text-[10px] text-white/60 space-y-1">
    <p>• Parsing content</p>
    <p>• Extracting key concepts</p>
    <p>• Structuring flashcards</p>
  </div>
</motion.div>
          ) : isComplete ? (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-8 mt-40"

            >
              <div className="w-24 h-24 mx-auto rounded-full bg-[#551a8b] flex items-center justify-center shadow-[0_0_40px_rgba(105,246,184,0.4)]">
                <span className="material-symbols-outlined text-white text-4xl">celebration</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-4xl font-black text-on-surface tracking-tighter uppercase italic">Flashcard assimilation <span className="text-secondary">Complete</span></h2>
                <p className="text-on-surface-variant font-medium">
                  You achieved <span className="text-secondary font-bold">{accuracy}%</span> accuracy across <span className="text-primary font-bold">{sessionStats.total}</span> cards.
                </p>
              </div>
              <div className="flex gap-4 justify-center mt-6">
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-8 py-4 bg-surface-container-highest border border-outline-variant/20 rounded-xl font-bold text-on-surface hover:bg-surface-variant transition-all text-xs uppercase tracking-widest"
                >
                  Configure New deck
                </button>
                <button
                  onClick={generateCards}
                  className="px-8 py-4 bg-[#551a8b] rounded-xl font-black text-on-primary hover:scale-105 transition-transform text-xs uppercase tracking-widest shadow-lg shadow-primary/20 text-white opacity-90"
                >
                  Restart Deck
                </button>
              </div>
            </motion.div>
          ) : cards.length > 0 ? (
            <Flashcard key="flashcard" {...cards[currentIndex]} />
          ) : (
            <div key="empty" className="text-center text-on-surface-variant space-y-4">
              <span className="material-symbols-outlined text-6xl opacity-20">style</span>
              <p className="font-bold uppercase tracking-widest text-xs">Initialization required</p>
              <button onClick={() => setShowSettings(true)} className="text-primary font-black text-xs uppercase tracking-[0.3em] hover:text-secondary transition-colors">Start Training →</button>
            </div>
          )}
          </AnimatePresence>
        </div>

        {/* Training Controls */}
        {!showSettings && !isGenerating && !isComplete && cards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 w-full max-w-2xl grid grid-cols-4 gap-3 pb-8"
          >
            <button
              onClick={() => handleMasteryUpdate(-1)}
              className="group flex flex-col items-center gap-2 p-3 rounded-xl bg-error-container/10 border border-error-dim/20 hover:bg-error-container/20 transition-all active:scale-90"
            >
              <div className="w-10 h-10 rounded-full bg-error-container flex items-center justify-center text-on-error shadow-lg transition-all">
                <span className="material-symbols-outlined font-bold text-sm">close</span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-error-dim">Unfamiliar</span>
            </button>

            <button
              onClick={() => handleMasteryUpdate(0)}
              className="group flex flex-col items-center gap-2 p-3 rounded-xl bg-surface-container-highest border border-outline-variant/20 hover:bg-surface-variant transition-all shadow-xl active:scale-95"
            >
              <div className="w-10 h-10 rounded-full bg-[#b8f9de] flex items-center justify-center text-[#074e3b] shadow-lg transition-all">
                <span className="material-symbols-outlined font-bold text-sm">check</span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-tertiary-fixed">Familiar</span>
            </button>

            <button
              onClick={() => handleMasteryUpdate(1)}
              className="group flex flex-col items-center gap-2 p-3 rounded-xl bg-secondary-container/10 border border-secondary/20 hover:bg-secondary-container/20 transition-all active:scale-90"
            >
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-on-secondary shadow-lg transition-all">
                <span className="material-symbols-outlined font-bold text-sm">auto_awesome</span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-secondary">Mastered</span>
            </button>

            <button
               onClick={handleSkip}
               className="group flex flex-col items-center gap-2 p-3 rounded-xl bg-surface-container-low border border-outline-variant/10 hover:bg-surface-variant transition-all active:scale-90"
             >
               <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant transition-all">
                 <span className="material-symbols-outlined font-bold text-sm">double_arrow</span>
               </div>
               <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Skip</span>
             </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Flashcards;
