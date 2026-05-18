import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Flashcard from '../components/Flashcard';
import EmptyState from '../components/EmptyState';
import { InputModal } from '../components/Modal';
import { showToast } from '../components/Toast';
import { useAura, useAuraHelp } from '../context/AuraContext';
import { flashcardService, masteryService, documentService, assetService } from '../services/api';
import ScrollToTopButton from '../components/ScrollToTopButton';

const TUTORIAL_KEY = 'instudy_flashcard_tutorial_seen';

// One-time tutorial overlay explaining the 5 control buttons
const FlashcardTutorial = ({ onDismiss }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
    onClick={onDismiss}
  >
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-surface-container border border-outline-variant/20 rounded-2xl p-6 w-full max-w-lg shadow-2xl"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-black text-on-surface">How the controls work</h3>
        <button onClick={onDismiss} className="text-on-surface-variant hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-5">
        {[
          { icon: 'arrow_back',    label: 'Prev',       color: 'text-on-surface-variant', desc: 'Go back one card' },
          { icon: 'close',         label: 'Unfamiliar', color: 'text-error',              desc: "Don't know it yet" },
          { icon: 'check',         label: 'Familiar',   color: 'text-tertiary-fixed',     desc: 'Getting there' },
          { icon: 'auto_awesome',  label: 'Mastered',   color: 'text-secondary',          desc: 'Fully know it' },
          { icon: 'double_arrow',  label: 'Skip',       color: 'text-on-surface-variant', desc: 'Skip for now' },
        ].map((btn, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 text-center">
            <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center">
              <span className={`material-symbols-outlined text-sm ${btn.color}`}>{btn.icon}</span>
            </div>
            <span className={`text-[9px] font-black uppercase tracking-wider ${btn.color}`}>{btn.label}</span>
            <span className="text-[9px] text-on-surface-variant leading-tight">{btn.desc}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
        Your ratings update your <span className="text-primary font-bold">Mastery score</span> automatically — so the more you rate, the smarter your study plan gets.
      </p>

      <button
        onClick={onDismiss}
        className="w-full py-3 bg-[#551a8b] text-white font-black text-xs uppercase tracking-widest rounded-xl hover:scale-[1.01] active:scale-95 transition-all"
      >
        Got it — let's study
      </button>
    </motion.div>
  </motion.div>
);

const Flashcards = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { triggerAura, askAuraBackground } = useAura();
  useAuraHelp(
    'Rate each card using the buttons below — Unfamiliar, Familiar, or Mastered. Your ratings update your Mastery score automatically.',
    { label: 'View Mastery', onClick: () => navigate('/mastery') }
  );
  const urlCourseId = searchParams.get('id');

  const [decks, setDecks] = useState([]);
  const [currentDeckId, setCurrentDeckId] = useState(urlCourseId || localStorage.getItem('activeCourse') || null);
  const [courseDocuments, setCourseDocuments] = useState([]);
  
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessionStats, setSessionStats] = useState({ learned: 0, remaining: 0, correct: 0, total: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // Settings State
  const [showSettings, setShowSettings] = useState(true);
  const [settings, setSettings] = useState({
    numCards: 10,
    explanationLevel: 'detailed',
    targetDocument: 'all',
    topic: '' // New: specific topic focus
  });
  const isInitialized = useRef(false);

  // ---------- Idle / Stuck Nudge ----------
  useEffect(() => {
    if (cards.length === 0 || isGenerating || showSettings || (cards.length > 0 && currentIndex >= cards.length)) return;

    const currentCard = cards[currentIndex];
    if (!currentCard) return;

    const idleTimer = setTimeout(() => {
      triggerAura(
        'concerned', 
        "Stuck on this flashcard? I can help break down this concept for you.", 
        { 
          label: 'Explain it', 
          onClick: () => askAuraBackground(`Give me a subtle hint or simple breakdown for this concept: "${currentCard.front || currentCard.concept || currentCard.question}". Do not give the direct answer if it's a question. End by encouraging me to try again.`) 
        },
        10000
      );
    }, 30000); // 30 seconds

    return () => clearTimeout(idleTimer);
  }, [currentIndex, cards, isGenerating, showSettings, triggerAura, askAuraBackground]);

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
    setSaveModalOpen(true);
  };

  const handleSaveConfirm = async (title) => {
    setSaveModalOpen(false);
    setIsSaving(true);
    try {
      await assetService.save(
        currentDeckId,
        'flashcards',
        title,
        { cards, settings },
        { card_count: cards.length }
      );
      showToast('Flashcard deck saved successfully!', 'success');
    } catch (error) {
      console.error('Save failed:', error);
      showToast('Failed to save deck. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- Fetch Documents for active course ----------
  useEffect(() => {
    // Only reset if the deck actually changed AND we're already initialized
    if (isInitialized.current && currentDeckId !== localStorage.getItem('flashcards_deck_id')) {
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
        filenameStr,
        settings.topic || null
      );
      const newCards = response.data.flashcards || [];
      setCards(newCards);
      setSessionStats({ learned: 0, remaining: newCards.length, correct: 0, total: newCards.length });
      // Show tutorial on first ever session
      if (newCards.length > 0 && localStorage.getItem(TUTORIAL_KEY) !== 'true') {
        setShowTutorial(true);
      }
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
    } catch (error) {
      console.error('Failed to generate cards:', error);
      const msg = error.response?.data?.detail || '';
      if (msg.includes('No documents')) {
        triggerAura('concerned', 'This course has no documents yet. Upload one in Knowledge Base first.',
          { label: 'Go to Knowledge Base', onClick: () => navigate('/knowledge') });
      } else if (msg.includes('API key') || error.response?.status === 401) {
        triggerAura('concerned', 'No API key configured. Add your Groq key in Settings to enable AI features.',
          { label: 'Open Settings', onClick: () => navigate('/settings') });
      } else {
        showToast('Something went wrong generating flashcards. Please try again.', 'error');
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
      // Prioritize the concept field, fallback to extracting from front
      let conceptId = card.concept;
      
      // If no concept field, try to extract a short concept from the question
      if (!conceptId) {
        // Extract first few meaningful words from the question
        const question = card.front || card.question || '';
        const words = question.replace(/[?.,!]/g, '').split(' ').filter(w => w.length > 3);
        conceptId = words.slice(0, 3).join(' ') || 'unknown_concept';
      }
      
      console.log(`Updating mastery for concept: "${conceptId}" with value: ${value}`);
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
      triggerAura('celebrating', `Session complete — ${accuracy}% accuracy across ${sessionStats.total + 1} cards.`);
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

      <div className="max-w-5xl mx-auto h-full flex flex-col items-center bg-surface-container-lower">
        {/* HUD Stats */}
        <div className="w-full flex justify-between items-center mb-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-1"
          >
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-on-surface uppercase italic">Flashcard <span className="text-primary">Lab</span></h1>
            <div className="flex items-center gap-2 text-on-surface-variant text-[9px] sm:text-[10px] uppercase tracking-wider font-bold">
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
          <div className="flex gap-2 sm:gap-3 flex-wrap justify-end">
              <button
                onClick={handleSave}
                disabled={cards.length === 0 || isSaving}
                className="px-3 sm:px-4 py-2 rounded-xl bg-secondary/10 text-secondary border border-secondary/20 font-bold text-[10px] sm:text-xs uppercase tracking-widest hover:bg-secondary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">save</span>
                <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save Deck'}</span>
              </button>
              {hudStats.map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-surface-container-low px-3 sm:px-4 py-2 rounded-xl border border-outline-variant/10 text-center min-w-[70px] sm:min-w-[90px]"
                >
                  <p className="text-[7px] sm:text-[8px] uppercase tracking-widest text-on-surface-variant mb-0.5 font-bold">{stat.label}</p>
                  <p className={`text-base sm:text-lg font-black ${stat.color}`}>{stat.value}</p>
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
              className="w-full max-w-4xl space-y-0"
            >
              {/* Page title */}
              <div className="mb-10 text-center">
                <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-on-surface uppercase italic">
                  Flashcard <span className="text-primary">Lab</span>
                </h2>
                <p className="text-on-surface-variant text-sm mt-2">Configure your deck and generate cards from your course material.</p>
              </div>

              {/* ── Step 1: Course ── */}
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <span className="h-6 w-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-black shrink-0">01</span>
                  <h3 className="text-sm font-black uppercase tracking-widest text-on-surface-variant">Choose Your Course</h3>
                  <span className="flex-1 h-px bg-outline-variant/20"></span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                  {decks.length === 0 ? (
                    <EmptyState
                      icon="style"
                      title="No courses yet"
                      description="Create a course and upload a document before generating flashcards."
                      action={{ label: 'Go to Knowledge Base', onClick: () => navigate('/knowledge') }}
                    />
                  ) : decks.map(deck => (
                    <button
                      key={deck.id}
                      onClick={() => setCurrentDeckId(deck.id)}
                      className={`shrink-0 min-w-[160px] p-5 rounded-2xl border text-left transition-all duration-200 group ${
                        currentDeckId === deck.id
                          ? 'bg-primary/15 border-primary shadow-[0_0_20px_rgba(189,157,255,0.15)]'
                          : 'bg-surface-container-low border-outline-variant/40 hover:border-primary/40'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-2xl mb-3 block ${currentDeckId === deck.id ? 'text-primary' : 'text-on-surface-variant'}`}>folder</span>
                      <p className={`font-bold text-sm truncate ${currentDeckId === deck.id ? 'text-on-surface' : 'text-on-surface-variant'}`}>{deck.name}</p>
                      <p className="text-[10px] text-on-surface-variant mt-1">{deck.document_count} docs</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Step 2: Configure ── */}
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-5 mt-2">
                  <span className="h-6 w-6 rounded-full bg-surface-container-low text-primary text-xs flex items-center justify-center font-black shrink-0">02</span>
                  <h3 className="text-sm font-black uppercase tracking-widest text-on-surface-variant">Configure Your Deck</h3>
                  <span className="flex-1 h-px bg-outline-variant/20"></span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Deck Size */}
                  <div className="bg-surface-container-low border border-outline-variant/15 rounded-2xl p-5 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">Deck Size</p>
                    <div className="flex gap-2">
                      {[5, 10, 20].map(num => (
                        <button
                          key={num}
                          onClick={() => setSettings({...settings, numCards: num})}
                          className={`flex-1 py-3 rounded-xl border text-sm font-black transition-all ${
                            settings.numCards === num
                              ? 'bg-primary/20 border-primary text-primary'
                              : 'border-outline-variant/20 text-on-surface-variant hover:border-primary/40 hover:text-on-surface'
                          }`}
                        >{num}</button>
                      ))}
                    </div>
                  </div>

                  {/* Detail Level */}
                  <div className="bg-surface-container-low border border-outline-variant/15 rounded-2xl p-5 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">Detail Level</p>
                    <div className="flex gap-2">
                      {['brief', 'detailed'].map(lvl => (
                        <button
                          key={lvl}
                          onClick={() => setSettings({...settings, explanationLevel: lvl})}
                          className={`flex-1 py-3 rounded-xl border text-xs font-black capitalize transition-all ${
                            settings.explanationLevel === lvl
                              ? 'bg-secondary/20 border-secondary text-secondary'
                              : 'border-outline-variant/20 text-on-surface-variant hover:border-secondary/40 hover:text-on-surface'
                          }`}
                        >{lvl}</button>
                      ))}
                    </div>
                  </div>

                  {/* Document Focus */}
                  <div className="bg-surface-container-low border border-outline-variant/15 rounded-2xl p-5 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">Document Focus</p>
                    <div className="relative">
                      <select
                        value={settings.targetDocument}
                        onChange={(e) => setSettings({...settings, targetDocument: e.target.value})}
                        className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl px-3 py-3 text-sm text-on-surface focus:border-primary transition-all appearance-none font-bold"
                      >
                        <option value="all">All Documents</option>
                        {courseDocuments.map(doc => (
                          <option key={doc} value={doc}>{doc}</option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-3 text-on-surface-variant pointer-events-none text-sm">expand_more</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Step 3: Topic (optional) ── */}
              <div className="mb-10">
                <div className="flex items-center gap-3 mt-3 mb-3">
                  <span className="h-6 w-6 rounded-full bg-outline-variant/30 text-on-surface-variant text-xs flex items-center justify-center font-black shrink-0">03</span>
                  <h3 className="text-sm font-black uppercase tracking-widest text-on-surface-variant">Focus Topic <span className="text-on-surface-variant/40 font-normal normal-case tracking-normal">— optional</span></h3>
                  <span className="flex-1 h-px bg-outline-variant/20"></span>
                </div>
                <input
                  type="text"
                  value={settings.topic || ''}
                  onChange={(e) => setSettings({...settings, topic: e.target.value})}
                  placeholder="e.g. photosynthesis, k-nearest neighbors — leave blank to cover all topics"
                  className="w-full mb-2 bg-surface-container-low border border-outline-variant/15 rounded-2xl py-4 px-5 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:ring-1 focus:ring-primary/50 transition-all"
                />
              </div>

              {/* ── Generate ── */}
              <button
                onClick={generateCards}
                disabled={!currentDeckId}
                className="w-full py-5 rounded-2xl bg-[#551a8b] text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <span className="material-symbols-outlined">auto_awesome</span>
                Generate Flashcards
              </button>
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
                <h2 className="text-4xl font-black text-on-surface tracking-tighter uppercase italic">Session <span className="text-secondary">Complete</span></h2>
                <p className="text-on-surface-variant font-medium">
                  You achieved <span className="text-secondary font-bold">{accuracy}%</span> accuracy across <span className="text-primary font-bold">{sessionStats.total}</span> cards.
                </p>
              </div>
              <div className="flex gap-4 justify-center mt-6">
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-8 py-4 bg-surface-container-highest border border-outline-variant/20 rounded-xl font-bold text-on-surface hover:bg-surface-variant transition-all text-xs uppercase tracking-widest"
                >
                  New Deck
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
              <p className="font-bold uppercase tracking-widest text-xs">Configure your deck to get started</p>
              <button onClick={() => setShowSettings(true)} className="text-primary font-black text-xs uppercase tracking-[0.3em] hover:text-secondary transition-colors">Start →</button>
            </div>
          )}
          </AnimatePresence>
        </div>

        {/* Training Controls */}
        {!showSettings && !isGenerating && !isComplete && cards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 w-full max-w-2xl grid grid-cols-5 gap-1.5 sm:gap-3 pb-8"
          >
            <button
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="group flex flex-col items-center gap-1 sm:gap-2 p-1.5 sm:p-3 rounded-xl bg-surface-container-low border border-outline-variant/10 hover:bg-surface-variant transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant transition-all">
                <span className="material-symbols-outlined font-bold text-sm">arrow_back</span>
              </div>
              <span className="text-[7px] sm:text-[9px] font-bold uppercase tracking-tighter sm:tracking-widest text-on-surface-variant">Prev</span>
            </button>

            <button
              onClick={() => handleMasteryUpdate(-1)}
              className="group flex flex-col items-center gap-1 sm:gap-2 p-1.5 sm:p-3 rounded-xl bg-error-container/10 border border-error-dim/20 hover:bg-error-container/20 transition-all active:scale-90"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-error-container flex items-center justify-center text-on-error shadow-lg transition-all">
                <span className="material-symbols-outlined font-bold text-sm">close</span>
              </div>
              <span className="text-[7px] sm:text-[9px] font-bold uppercase tracking-tighter sm:tracking-widest text-error-dim">Unfamiliar</span>
            </button>

            <button
              onClick={() => handleMasteryUpdate(0)}
              className="group flex flex-col items-center gap-1 sm:gap-2 p-1.5 sm:p-3 rounded-xl bg-surface-container-highest border border-outline-variant/20 hover:bg-surface-variant transition-all shadow-xl active:scale-95"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#b8f9de] flex items-center justify-center text-[#074e3b] shadow-lg transition-all">
                <span className="material-symbols-outlined font-bold text-sm">check</span>
              </div>
              <span className="text-[7px] sm:text-[9px] font-bold uppercase tracking-tighter sm:tracking-widest text-tertiary-fixed">Familiar</span>
            </button>

            <button
              onClick={() => handleMasteryUpdate(1)}
              className="group flex flex-col items-center gap-1 sm:gap-2 p-1.5 sm:p-3 rounded-xl bg-secondary-container/10 border border-secondary/20 hover:bg-secondary-container/20 transition-all active:scale-90"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-secondary flex items-center justify-center text-on-secondary shadow-lg transition-all">
                <span className="material-symbols-outlined font-bold text-sm">auto_awesome</span>
              </div>
              <span className="text-[7px] sm:text-[9px] font-bold uppercase tracking-tighter sm:tracking-widest text-secondary">Mastered</span>
            </button>

            <button
               onClick={handleSkip}
               className="group flex flex-col items-center gap-1 sm:gap-2 p-1.5 sm:p-3 rounded-xl bg-surface-container-low border border-outline-variant/10 hover:bg-surface-variant transition-all active:scale-90"
             >
               <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant transition-all">
                 <span className="material-symbols-outlined font-bold text-sm">double_arrow</span>
               </div>
               <span className="text-[7px] sm:text-[9px] font-bold uppercase tracking-tighter sm:tracking-widest text-on-surface-variant">Skip</span>
             </button>
          </motion.div>
        )}
      </div>
      <ScrollToTopButton />

      {/* First-use tutorial overlay */}
      <AnimatePresence>
        {showTutorial && (
          <FlashcardTutorial onDismiss={() => {
            localStorage.setItem(TUTORIAL_KEY, 'true');
            setShowTutorial(false);
          }} />
        )}
      </AnimatePresence>

      {/* Save deck modal */}
      <InputModal
        open={saveModalOpen}
        title="Save Flashcard Deck"
        description="Give this deck a name so you can find it later in Saved Assets."
        placeholder="e.g. Chapter 3 — Cell Biology"
        confirmLabel="Save Deck"
        onConfirm={handleSaveConfirm}
        onCancel={() => setSaveModalOpen(false)}
      />
    </div>
  );
};

export default Flashcards;
