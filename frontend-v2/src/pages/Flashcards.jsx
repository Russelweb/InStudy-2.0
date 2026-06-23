import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import Flashcard from '../components/Flashcard';
import EmptyState from '../components/EmptyState';
import { InputModal, ConfirmModal } from '../components/Modal';
import { showToast } from '../components/Toast';
import { useAura, useAuraHelp } from '../context/AuraContext';
import { flashcardService, masteryService, documentService, assetService } from '../services/api';
import ScrollToTopButton from '../components/ScrollToTopButton';
import { useHeartbeat } from '../hooks/useHeartbeat';

const TUTORIAL_KEY = 'instudy_flashcard_tutorial_seen';
const setupSteps = [
  { label: 'Course', helper: 'Pick source' },
  { label: 'Deck', helper: 'Set cards' },
  { label: 'Create', helper: 'Review' },
];

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
  const location = useLocation();
  const { triggerAura, askAuraBackground } = useAura();
  useAuraHelp(
    'Rate each card using the buttons below — Unfamiliar, Familiar, or Mastered. Your ratings update your Mastery score automatically.',
    { label: 'View Mastery', onClick: () => navigate('/mastery') }
  );
  const urlCourseId = searchParams.get('id');
  const urlFocus    = searchParams.get('focus');   // subtopic name passed from Mastery

  const [decks, setDecks] = useState([]);
  const [currentDeckId, setCurrentDeckId] = useState(urlCourseId || localStorage.getItem('activeCourse') || null);
  const [courseDocuments, setCourseDocuments] = useState([]);

  // ── Productive study time tracking ─────────────────────────────────────
  const { recordInteraction } = useHeartbeat(currentDeckId, 'flashcard');
  
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessionStats, setSessionStats] = useState({ learned: 0, remaining: 0, correct: 0, total: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [dupConfirmOpen, setDupConfirmOpen] = useState(false);
  const [pendingSaveTitle, setPendingSaveTitle] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  // If a focus topic was passed via URL, jump straight to Step 3 (Review & Create)
  const [setupStep, setSetupStep] = useState(urlFocus ? 2 : 0);
  const [deckQuery, setDeckQuery] = useState('');

  // Settings State — initialise topic from URL focus param immediately
  const [showSettings, setShowSettings] = useState(true);
  const [settings, setSettings] = useState({
    numCards: 10,
    explanationLevel: 'detailed',
    targetDocument: 'all',
    topic: urlFocus ? decodeURIComponent(urlFocus) : ''
  });
  const isInitialized = useRef(false);
  // Flag: true when page was opened by clicking a saved asset — prevents
  // fetchDecks and deck-change effects from wiping the loaded cards.
  const loadedFromAssetRef = useRef(false);

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

      // ⚠️ Don't overwrite the course set by a saved-asset load.
      // loadedFromAssetRef is already true by the time this async call resolves.
      if (courses.length > 0 && !loadedFromAssetRef.current && !currentDeckId) {
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

    // ── Primary: Router state handoff (synchronous, no race conditions) ────
    const routerAsset = location.state?.loadedAsset;

    // ── Fallback: legacy localStorage handoff ──────────────────────────
    let legacyAssetRaw = null;
    try { legacyAssetRaw = localStorage.getItem('load_asset_flashcards'); } catch (_) {}

    const assetToLoad = routerAsset || (legacyAssetRaw ? JSON.parse(legacyAssetRaw) : null);

    if (assetToLoad) {
      try {
        console.log('Loading saved flashcard deck:', assetToLoad.title);
        loadedFromAssetRef.current = true; // block fetchDecks & deck-change reset
        setCards(assetToLoad.data.cards || []);
        setSettings(assetToLoad.data.settings || settings);
        setCurrentDeckId(assetToLoad.course_id);
        setShowSettings(false);
        setCurrentIndex(0);
        setSessionStats({
          learned: 0,
          remaining: assetToLoad.data.cards?.length || 0,
          correct: 0,
          total: assetToLoad.data.cards?.length || 0
        });
        if (!routerAsset) localStorage.removeItem('load_asset_flashcards');
        setTimeout(() => { isInitialized.current = true; }, 100);
        return;
      } catch (e) {
        console.error('Failed to load flashcard asset:', e);
      }
    }

    // If a focus param was in the URL we already initialised state above — skip persistence restore
    if (urlFocus) {
      setTimeout(() => { isInitialized.current = true; }, 100);
      return;
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      const res = await assetService.save(
        currentDeckId,
        'flashcards',
        title,
        { cards, settings },
        { card_count: cards.length }
      );
      if (res.data && res.data.duplicate) {
        setPendingSaveTitle(title);
        setDupConfirmOpen(true);
      } else {
        showToast('Flashcard deck saved successfully!', 'success');
      }
    } catch (error) {
      console.error('Save failed:', error);
      showToast('Failed to save deck. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDuplicate = async () => {
    setDupConfirmOpen(false);
    setIsSaving(true);
    try {
      await assetService.save(
        currentDeckId,
        'flashcards',
        pendingSaveTitle,
        { cards, settings },
        { card_count: cards.length },
        true
      );
      showToast('Flashcard deck saved successfully!', 'success');
    } catch (error) {
      console.error('Save failed:', error);
      showToast('Failed to save deck. Please try again.', 'error');
    } finally {
      setIsSaving(false);
      setPendingSaveTitle('');
    }
  };

  // ---------- Fetch Documents for active course ----------
  useEffect(() => {
    // Skip reset if the page was opened to show a saved asset
    if (loadedFromAssetRef.current) return;

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

    // ── Record productive interaction for heartbeat ─────────────────────
    recordInteraction();

    // ── Rating label mapping ─────────────────────────────────────────────
    const ratingMap = { 1: 'mastered', 0: 'familiar', '-1': 'unfamiliar', [-1]: 'unfamiliar' };
    const rating = ratingMap[value] ?? 'familiar';

    try {
      // Use card.concept (LLM-assigned topic label like "Photosynthesis")
      // Never use words from the question — they won't match subtopic names
      const conceptId  = card.concept || card.topic || null;
      const subtopicId = card.subtopic_id || null;
      const docId      = card.doc_id      || null;

      // Only call V2 if we have a real concept label to work with
      if (conceptId) {
        const res = await masteryService.v2.rateFlashcard(
          currentDeckId, rating, conceptId, subtopicId, docId
        );
        if (res.data?.xp_earned > 0) {
          const conceptLabel = res.data.concept_name || conceptId;
          showToast(`+${res.data.xp_earned} XP · ${conceptLabel}`, 'success');
        }
      } else {
        // No concept label at all — use legacy
        await masteryService.update(currentDeckId, 'general', value);
      }
    } catch (error) {
      // Non-fatal fallback
      try {
        await masteryService.update(currentDeckId, card.concept || 'general', value);
      } catch { /* ignore */ }
    }

    // Update session stats
    const isCorrect = value >= 0;
    setSessionStats((prev) => ({
      ...prev,
      learned: prev.learned + 1,
      remaining: Math.max(0, prev.remaining - 1),
      correct: isCorrect ? prev.correct + 1 : prev.correct,
    }));

    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
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
  const filteredDecks = useMemo(() => {
    const query = deckQuery.trim().toLowerCase();
    if (!query) return decks;
    return decks.filter((deck) => deck.name.toLowerCase().includes(query));
  }, [decks, deckQuery]);

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
              <div className="mb-6 text-center">
                <h2 className="text-2xl md:text-4xl font-black tracking-tight text-on-surface uppercase italic">
                  Flashcard <span className="text-primary">Lab</span>
                </h2>
                <p className="text-on-surface-variant text-sm mt-2">Build a focused deck from your course material.</p>
              </div>

              <SetupStepper steps={setupSteps} activeStep={setupStep} setActiveStep={setSetupStep} canAdvance={Boolean(currentDeckId)} />

              <div className="bg-surface-container-low/70 border border-outline-variant/15 rounded-2xl p-4 sm:p-5 md:p-6 mt-5">
                <AnimatePresence mode="wait">
                  {setupStep === 0 && (
                    <SetupPanel key="course">
                      <StepHeading eyebrow="Step 1" title="Choose a Course" description="Pick the course that will supply your flashcard material." />
                      {decks.length === 0 ? (
                        <EmptyState
                          icon="style"
                          title="No courses yet"
                          description="Create a course and upload a document before generating flashcards."
                          action={{ label: 'Go to Knowledge Base', onClick: () => navigate('/knowledge') }}
                        />
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.2fr] gap-4 mt-5">
                          <SelectedCourseCard icon="style" title="Selected Deck Source" course={currentDeck} countLabel={`${currentDeck?.document_count || 0} documents ready`} />
                          <CoursePicker courses={filteredDecks} selectedCourse={currentDeckId} query={deckQuery} setQuery={setDeckQuery} onSelect={setCurrentDeckId} icon="folder" />
                        </div>
                      )}
                      <StepActions>
                        <PrimaryButton disabled={!currentDeckId} onClick={() => setSetupStep(1)} icon="arrow_forward">Next: Deck Settings</PrimaryButton>
                      </StepActions>
                    </SetupPanel>
                  )}

                  {setupStep === 1 && (
                    <SetupPanel key="deck">
                      <StepHeading eyebrow="Step 2" title="Set Up Your Deck" description="Choose how many cards you want and how detailed the answers should be." />
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
                        <OptionCard label="Cards">
                          <SegmentedValue values={[5, 10, 20]} value={settings.numCards} onChange={(num) => setSettings({ ...settings, numCards: num })} />
                        </OptionCard>
                        <OptionCard label="Answer Detail">
                          <SegmentedValue values={['brief', 'detailed']} value={settings.explanationLevel} onChange={(lvl) => setSettings({ ...settings, explanationLevel: lvl })} accent="secondary" />
                        </OptionCard>
                        <OptionCard label="Document">
                          <select
                            value={settings.targetDocument}
                            onChange={(e) => setSettings({ ...settings, targetDocument: e.target.value })}
                            className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl px-3 py-3 text-sm text-on-surface focus:border-primary transition-all font-bold"
                          >
                            <option value="all">All Documents</option>
                            {courseDocuments.map(doc => <option key={doc} value={doc}>{doc}</option>)}
                          </select>
                        </OptionCard>
                      </div>
                      <StepActions>
                        <BackButton onClick={() => setSetupStep(0)} />
                        <PrimaryButton onClick={() => setSetupStep(2)} icon="arrow_forward">Next: Review</PrimaryButton>
                      </StepActions>
                    </SetupPanel>
                  )}

                  {setupStep === 2 && (
                    <SetupPanel key="create">
                      <StepHeading eyebrow="Step 3" title="Review and Create" description="Add an optional topic, then generate your flashcards." />
                      <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.8fr] gap-4 mt-5">
                        <div className="bg-surface-container border border-outline-variant/15 rounded-xl p-4">
                          <SectionLabel icon="center_focus_strong" label="Focus Topic (optional)" />
                          {settings.topic && (
                            <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg">
                              <span className="material-symbols-outlined text-primary text-sm">auto_awesome</span>
                              <span className="text-[10px] text-primary font-black uppercase tracking-wider">Auto-focused from Review Queue</span>
                              <button
                                onClick={() => setSettings(s => ({ ...s, topic: '' }))}
                                className="ml-auto text-on-surface-variant/50 hover:text-error transition-colors"
                                title="Clear focus"
                              >
                                <span className="material-symbols-outlined text-sm">close</span>
                              </button>
                            </div>
                          )}
                          <input
                            type="text"
                            value={settings.topic || ''}
                            onChange={(e) => setSettings({ ...settings, topic: e.target.value })}
                            placeholder="e.g. photosynthesis, vectors, contract law"
                            className="mt-3 w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl py-3 px-4 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary/50 transition-all"
                          />
                          <p className="text-xs text-on-surface-variant mt-2">Leave empty to cover everything selected.</p>
                        </div>
                        <div className="bg-surface-container-high/60 border border-outline-variant/15 rounded-xl p-4 space-y-2">
                          <ReviewItem icon="menu_book" label="Course" value={currentDeck?.name || 'No course selected'} />
                          <ReviewItem icon="style" label="Cards" value={`${settings.numCards} cards`} />
                          <ReviewItem icon="article" label="Source" value={settings.targetDocument === 'all' ? 'All documents' : settings.targetDocument} />
                        </div>
                      </div>
                      <StepActions>
                        <BackButton onClick={() => setSetupStep(1)} />
                        <PrimaryButton disabled={!currentDeckId} onClick={generateCards} icon="auto_awesome">Generate Flashcards</PrimaryButton>
                      </StepActions>
                    </SetupPanel>
                  )}
                </AnimatePresence>
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

      <ConfirmModal
        open={dupConfirmOpen}
        title="Duplicate Asset"
        description={`An asset with the title "${pendingSaveTitle}" already exists. Do you want to save a new duplicate copy anyway?`}
        confirmLabel="Save Duplicate"
        cancelLabel="Cancel"
        onConfirm={handleSaveDuplicate}
        onCancel={() => { setDupConfirmOpen(false); setPendingSaveTitle(''); }}
      />
    </div>
  );
};

const SetupStepper = ({ steps, activeStep, setActiveStep, canAdvance }) => (
  <div className="grid grid-cols-3 gap-2 sm:gap-4">
    {steps.map((step, index) => {
      const active = activeStep === index;
      const done = activeStep > index;
      return (
        <button
          key={step.label}
          onClick={() => (index === 0 || canAdvance) && setActiveStep(index)}
          disabled={index > 0 && !canAdvance}
          className="text-left disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-2">
            <span className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-black border ${done ? 'bg-secondary text-on-secondary border-secondary' : active ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-high text-on-surface-variant border-outline-variant/15'}`}>
              {done ? <span className="material-symbols-outlined text-base">check</span> : index + 1}
            </span>
            <span className="min-w-0">
              <span className={`block text-[10px] font-black uppercase tracking-widest ${active || done ? 'text-secondary' : 'text-on-surface-variant'}`}>{step.label}</span>
              <span className="hidden sm:block text-[10px] text-on-surface-variant/70 truncate">{step.helper}</span>
            </span>
          </div>
          <div className="mt-2 h-1 rounded-full bg-surface-container-highest overflow-hidden">
            <div className={`h-full rounded-full transition-all ${active || done ? 'w-full bg-secondary' : 'w-0 bg-secondary'}`} />
          </div>
        </button>
      );
    })}
  </div>
);

const SetupPanel = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.22 }}
  >
    {children}
  </motion.div>
);

const StepHeading = ({ eyebrow, title, description }) => (
  <div>
    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary mb-2">{eyebrow}</p>
    <h3 className="text-xl md:text-2xl font-black text-on-surface tracking-tight">{title}</h3>
    <p className="text-sm text-on-surface-variant leading-relaxed mt-1.5">{description}</p>
  </div>
);

const SelectedCourseCard = ({ icon, title, course, countLabel }) => (
  <div className="bg-surface-container border border-secondary/25 rounded-xl p-4 min-w-0">
    <div className="flex items-center gap-3">
      <span className="h-11 w-11 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-1">{title}</p>
        <h4 className="text-base font-black text-on-surface truncate">{course?.name || 'Choose a course'}</h4>
        <p className="text-xs text-on-surface-variant mt-1">{course ? countLabel : 'Select a course to continue'}</p>
      </div>
    </div>
  </div>
);

const CoursePicker = ({ courses, selectedCourse, query, setQuery, onSelect, icon }) => (
  <div className="bg-surface-container border border-outline-variant/15 rounded-xl p-3">
    <div className="flex items-center gap-2 bg-surface-container-high rounded-lg px-3 py-2 border border-outline-variant/15">
      <span className="material-symbols-outlined text-base text-on-surface-variant">search</span>
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search courses"
        className="w-full bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
      />
    </div>
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[210px] overflow-y-auto custom-scrollbar pr-1">
      {courses.map((course) => {
        const selected = selectedCourse === course.id;
        return (
          <button
            key={course.id}
            onClick={() => onSelect(course.id)}
            className={`h-14 px-3 rounded-lg border text-left transition-all flex items-center gap-3 min-w-0 ${selected ? 'bg-secondary/10 border-secondary text-secondary' : 'bg-surface-container-low border-outline-variant/10 text-on-surface-variant hover:border-secondary/35 hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined text-lg shrink-0">{selected ? 'check_circle' : icon}</span>
            <span className="min-w-0">
              <span className="block text-sm font-black truncate">{course.name}</span>
              <span className="block text-[10px] opacity-75">{course.document_count || 0} documents</span>
            </span>
          </button>
        );
      })}
      {courses.length === 0 && (
        <div className="sm:col-span-2 h-20 rounded-lg border border-dashed border-outline-variant/20 flex items-center justify-center text-sm text-on-surface-variant">
          No matching courses
        </div>
      )}
    </div>
  </div>
);

const OptionCard = ({ label, children }) => (
  <div className="bg-surface-container border border-outline-variant/15 rounded-xl p-4 space-y-3">
    <p className="text-[10px] font-black uppercase tracking-widest text-primary">{label}</p>
    {children}
  </div>
);

const SegmentedValue = ({ values, value, onChange, accent = 'primary' }) => (
  <div className="flex gap-2">
    {values.map((item) => {
      const active = value === item;
      return (
        <button
          key={item}
          onClick={() => onChange(item)}
          className={`flex-1 py-3 rounded-xl border text-xs font-black capitalize transition-all ${active ? (accent === 'secondary' ? 'bg-secondary/20 border-secondary text-secondary' : 'bg-primary/20 border-primary text-primary') : 'border-outline-variant/20 text-on-surface-variant hover:border-primary/40 hover:text-on-surface'}`}
        >
          {item}
        </button>
      );
    })}
  </div>
);

const SectionLabel = ({ icon, label }) => (
  <div className="flex items-center gap-2">
    <span className="material-symbols-outlined text-base text-secondary">{icon}</span>
    <p className="text-xs font-black uppercase tracking-widest text-on-surface">{label}</p>
  </div>
);

const StepActions = ({ children }) => (
  <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 mt-5">
    {children}
  </div>
);

const BackButton = ({ onClick }) => (
  <button onClick={onClick} className="w-full sm:w-auto px-5 py-3 rounded-xl border border-outline-variant/20 text-on-surface-variant font-black text-xs uppercase tracking-widest hover:border-primary/40 hover:text-primary transition-all flex items-center justify-center gap-2">
    <span className="material-symbols-outlined text-base">arrow_back</span>
    Back
  </button>
);

const PrimaryButton = ({ children, icon, disabled, onClick }) => (
  <button onClick={onClick} disabled={disabled} className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#551a8b] text-white font-black text-xs uppercase tracking-widest hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
    <span className="material-symbols-outlined text-base">{icon}</span>
    {children}
  </button>
);

const ReviewItem = ({ icon, label, value }) => (
  <div className="bg-surface-container-high/70 border border-outline-variant/10 rounded-xl p-3 min-w-0">
    <div className="flex items-center gap-2 text-on-surface-variant mb-1.5">
      <span className="material-symbols-outlined text-base">{icon}</span>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </div>
    <p className="text-sm font-bold text-on-surface truncate">{value}</p>
  </div>
);

export default Flashcards;
