import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { plannerService, statService, assetService, masteryService } from '../services/api';
import { useLocation } from 'react-router-dom';
import { InputModal, ConfirmModal } from '../components/Modal';
import { showToast } from '../components/Toast';
import { useAura, useAuraHelp } from '../context/AuraContext';
import ScrollToTopButton from '../components/ScrollToTopButton';

const Planner = () => {
  const location = useLocation();
  const [step, setStep] = useState('setup'); // 'setup' | 'loading' | 'timeline'
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [examDate, setExamDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [topics, setTopics] = useState([]);
  const [newTopic, setNewTopic] = useState('');
  const [focusTopic, setFocusTopic] = useState('');
  const [plan, setPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [completedTasks, setCompletedTasks] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [dupConfirmOpen, setDupConfirmOpen] = useState(false);
  const [pendingSaveTitle, setPendingSaveTitle] = useState('');
  const [masteryInsight, setMasteryInsight] = useState(null);
  const isInitialized = useRef(false);
  const { triggerAura } = useAura();
  useAuraHelp(
    'Your study plan is weighted by your mastery scores — weak topics get more days. Add your exam date and topics, then click Generate.'
  );

  useEffect(() => {
    // ── Primary: Router state handoff from SavedAssets ─────────────────────
    const routerAsset = location.state?.loadedAsset;

    // ── Fallback: legacy localStorage handoff ──────────────────────────
    let legacyAssetRaw = null;
    try { legacyAssetRaw = localStorage.getItem('load_asset_study_plan'); } catch (_) {}

    const assetToLoad = routerAsset || (legacyAssetRaw ? JSON.parse(legacyAssetRaw) : null);

    if (assetToLoad) {
      try {
        console.log('Loading saved study plan:', assetToLoad.title);
        setPlan(assetToLoad.data.plan || null);
        setExamDate(assetToLoad.data.examDate || examDate);
        setTopics(assetToLoad.data.topics || []);
        setCompletedTasks(assetToLoad.data.completedTasks || {});
        setSelectedCourse(assetToLoad.course_id);
        setStep('timeline');
        if (!routerAsset) localStorage.removeItem('load_asset_study_plan');
        setTimeout(() => { isInitialized.current = true; }, 100);
        return;
      } catch (e) {
        console.error('Failed to load study plan asset:', e);
      }
    }

    // Load persisted state (only if no asset was loaded)
    const savedPlan = localStorage.getItem('planner_plan');
    const savedCourse = localStorage.getItem('planner_course');
    const savedDate = localStorage.getItem('planner_date');
    const savedTopics = localStorage.getItem('planner_topics');
    const savedStep = localStorage.getItem('planner_step');
    const savedCompletedTasks = localStorage.getItem('planner_completed_tasks');

    // IMPORTANT: Don't restore 'loading' state - always go to setup or timeline
    let restoredStep = savedStep;
    if (restoredStep === 'loading') {
      console.warn('Detected stuck loading state, resetting to setup');
      restoredStep = 'setup';
    }

    if (savedPlan) setPlan(JSON.parse(savedPlan));
    if (savedCourse) setSelectedCourse(savedCourse);
    if (savedDate) setExamDate(savedDate);
    if (savedTopics) setTopics(JSON.parse(savedTopics));
    if (restoredStep) setStep(restoredStep);
    if (savedCompletedTasks) setCompletedTasks(JSON.parse(savedCompletedTasks));

    console.log('Planner Initialized. Persisted state loaded.');
    setTimeout(() => { isInitialized.current = true; }, 100);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Only persist after initialization and if state is valid
    if (!isInitialized.current) return;
    
    console.log('Persisting Planner State...');
    if (plan) localStorage.setItem('planner_plan', JSON.stringify(plan));
    else localStorage.removeItem('planner_plan');
    
    localStorage.setItem('planner_course', selectedCourse);
    localStorage.setItem('planner_date', examDate);
    localStorage.setItem('planner_topics', JSON.stringify(topics));
    localStorage.setItem('planner_step', step);
    localStorage.setItem('planner_completed_tasks', JSON.stringify(completedTasks));
  }, [plan, selectedCourse, examDate, topics, step, completedTasks]);

  useEffect(() => {
    console.log('Planner Step changed to:', step);
  }, [step]);

  useEffect(() => {
    statService.getCourses().then(res => {
      const coursesList = res.data.courses || [];
      setCourses(coursesList);
      
      // Only auto-select if nothing is currently selected (neither from state nor persistence)
      if (coursesList.length > 0 && !selectedCourse && !localStorage.getItem('planner_course')) {
        console.log('Auto-selecting course:', coursesList[0].id);
        setSelectedCourse(coursesList[0].id || coursesList[0].name);
      }
    });
  }, []);

  // Fetch mastery insight when course changes
  useEffect(() => {
    if (!selectedCourse) return;
    masteryService.getProfile(selectedCourse)
      .then(res => {
        const profile = res.data.profile || [];
        if (profile.length === 0) { setMasteryInsight(null); return; }
        const urgent = profile.filter(p => p.familiarity_score < -0.2).map(p => p.concept_id);
        const review = profile.filter(p => p.familiarity_score >= -0.2 && p.familiarity_score <= 0.4).map(p => p.concept_id);
        const solid  = profile.filter(p => p.familiarity_score > 0.4).map(p => p.concept_id);
        setMasteryInsight({ urgent, review, solid });
      })
      .catch(() => setMasteryInsight(null));
  }, [selectedCourse]);

  const addTopic = () => {
    if (newTopic.trim()) {
      setTopics([...topics, newTopic.trim()]);
      setNewTopic('');
    }
  };

  const removeTopic = (index) => {
    setTopics(topics.filter((_, i) => i !== index));
  };

  const toggleTask = (wIdx, dIdx, tsIndex) => {
    const key = `${wIdx}-${dIdx}-${tsIndex}`;
    setCompletedTasks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSavePlan = async () => {
    if (!plan) return;
    setSaveModalOpen(true);
  };

  const handleSavePlanConfirm = async (title) => {
    setSaveModalOpen(false);
    setIsSaving(true);
    try {
      const res = await assetService.save(
        selectedCourse,
        'study_plan',
        title,
        { plan, examDate, topics, completedTasks },
        { exam_date: examDate, topic_count: topics.length }
      );
      if (res.data && res.data.duplicate) {
        setPendingSaveTitle(title);
        setDupConfirmOpen(true);
      } else {
        showToast('Study plan saved successfully!', 'success');
      }
    } catch (error) {
      console.error('Save failed:', error);
      showToast('Failed to save plan. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePlanDuplicate = async () => {
    setDupConfirmOpen(false);
    setIsSaving(true);
    try {
      await assetService.save(
        selectedCourse,
        'study_plan',
        pendingSaveTitle,
        { plan, examDate, topics, completedTasks },
        { exam_date: examDate, topic_count: topics.length },
        true
      );
      showToast('Study plan saved successfully!', 'success');
    } catch (error) {
      console.error('Save failed:', error);
      showToast('Failed to save plan. Please try again.', 'error');
    } finally {
      setIsSaving(false);
      setPendingSaveTitle('');
    }
  };

  const discoverTopics = async () => {
    if (!selectedCourse) return;
    setIsDiscovering(true);
    try {
      const res = await plannerService.discoverTopics(selectedCourse);
      const newTopics = res.data.topics || [];
      if (newTopics.length === 0) {
        showToast('No clear topics found in documents. Try adding them manually.', 'warning');
      } else {
        // Add only unique new topics
        setTopics(prev => [...new Set([...prev, ...newTopics])]);
      }
    } catch (err) {
      console.error('Discovery failed:', err);
    } finally {
      setIsDiscovering(false);
    }
  };

  const synthesizePlan = async () => {
    console.log('Synthesize Clicked. State:', { selectedCourse, examDate, topics });
    if (!selectedCourse || !examDate) {
      console.warn('Synthesis aborted: Missing selection or date');
      return;
    }
    setIsLoading(true);
    setStep('loading');
    
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error('Plan synthesis timed out after 60 seconds');
      showToast('Plan generation timed out. Check your API key in Settings and try again.', 'error');
      setIsLoading(false);
      setStep('setup');
    }, 60000); // 60 second timeout
    
    try {
      // Find course name if selectedCourse is an ID
      const courseObj = courses.find(c => c.id === selectedCourse || c.name === selectedCourse);
      const courseName = courseObj?.name || selectedCourse;

      console.log('Synthesizing plan for:', { courseName, examDate, topics, focusTopic });
      const res = await plannerService.create(selectedCourse, courseName, examDate, topics, focusTopic || null);
      console.log('Plan received:', res.data);
      
      clearTimeout(timeoutId); // Clear timeout on success
      
      if (res.data?.plan) {
        setPlan(res.data.plan);
        setStep('timeline');
        triggerAura('celebrating', `Your study plan is ready — mapped out and weighted to your mastery gaps.`);
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
      } else {
        throw new Error('Invalid plan format received from server');
      }
    } catch (err) {
      clearTimeout(timeoutId); // Clear timeout on error
      console.error('Failed to generate plan:', err);
      
      const errorMsg = err.response?.data?.detail || err.message || 'Unknown error';
      if (errorMsg.includes('API key') || err.response?.status === 401) {
        triggerAura('concerned', 'No API key configured. Add your Groq key in Settings to enable AI features.',
          { label: 'Open Settings', onClick: () => {} });
      } else if (errorMsg.includes('NO_DOCUMENTS')) {
        triggerAura('concerned', 'This course has no documents yet. Upload study material first.',
          { label: 'Go to Knowledge Base', onClick: () => {} });
      } else {
        showToast(`Plan generation failed: ${errorMsg}`, 'error');
      }
      setStep('setup');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-background text-on-surface p-4 md:p-8 pb-32">
      <div className="max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          {step === 'setup' && (
            <motion.section 
              key="setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative"
            >
              <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 blur-[120px] rounded-full pointer-events-none"></div>
              <div className="relative bg-surface-container/40 backdrop-blur-xl border border-outline-variant/15 rounded-2xl md:rounded-3xl p-5 sm:p-8 md:p-10 shadow-2xl overflow-hidden group">
                {/* Decorative background intensity */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 group-hover:opacity-100 transition-opacity opacity-0 pointer-events-none"></div>
                
                <div className="relative text-center mb-6 md:mb-10">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter mb-2 md:mb-3 bg-[#551a8b] bg-clip-text text-transparent">Study Planner</h1>
                  <p className="text-on-surface-variant text-xs sm:text-sm font-medium">Set your exam date, add your topics, and get a personalised day-by-day plan.</p>
                </div>

                <div className="relative grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Target Course</label>
                    <div className="relative">
                      <select 
                        value={selectedCourse}
                        onChange={(e) => setSelectedCourse(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-on-surface focus:border-primary transition-all appearance-none"
                      >
                        {courses.map(c => (
                          <option key={c.id || c.name} value={c.id || c.name}>{c.name}</option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-3 text-on-surface-variant pointer-events-none">expand_more</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Objective Deadline</label>
                    <input 
                      type="date"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-on-surface focus:border-primary transition-all"
                    />
                  </div>
                </div>

                <div className="relative mt-8 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Core Topics</label>
                    <button 
                      onClick={discoverTopics} 
                      disabled={!selectedCourse || isDiscovering}
                      className="text-[10px] font-bold text-secondary flex items-center gap-1.5 hover:opacity-80 transition-opacity disabled:opacity-30"
                    >
                      <span className={`material-symbols-outlined text-[14px] ${isDiscovering ? 'animate-spin' : ''}`}>psychology_alt</span>
                      {isDiscovering ? 'Discovering...' : 'Smart Topic Discovery'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 p-4 bg-surface-container-low border border-outline-variant/20 rounded-2xl min-h-[100px] flex-row items-center content-start">
                    {topics.map((t, i) => (
                      <motion.span 
                        layout
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        key={i} 
                        className="px-4 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-bold flex items-center gap-2 group/tag shadow-sm"
                      >
                        {t}
                        <button onClick={() => removeTopic(i)} className="material-symbols-outlined text-[14px] opacity-60 hover:opacity-100 hover:text-error transition-all">close</button>
                      </motion.span>
                    ))}
                    <input 
                      className="bg-transparent border-none focus:ring-0 text-sm text-on-surface min-w-[200px] py-1"
                      placeholder="Enter a central concept..."
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addTopic()}
                    />
                    {newTopic && (
                      <button onClick={addTopic} className="text-secondary hover:text-secondary-fixed text-xs font-black uppercase tracking-widest ml-auto">Add</button>
                    )}
                  </div>
                </div>

                {/* Focus Topic */}
                <div className="relative mt-6 space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Focus Topic (Optional)</label>
                  <input
                    type="text"
                    value={focusTopic}
                    onChange={(e) => setFocusTopic(e.target.value)}
                    placeholder="e.g. Photosynthesis- will be prioritized in the plan"
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl py-3 px-4 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary/50 transition-all"
                  />
                  <p className="text-[9px] text-on-surface-variant/60 italic">Leave blank to cover all topics equally</p>
                </div>

                {/* Mastery insight banner */}
                {masteryInsight && (masteryInsight.urgent.length > 0 || masteryInsight.review.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative mt-6 p-4 rounded-2xl border border-primary/20 bg-primary/5 overflow-hidden"
                  >
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary/10 blur-2xl rounded-full pointer-events-none" />
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">psychology</span>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-primary uppercase tracking-widest mb-2">Mastery-Aware Plan</p>
                        <p className="text-xs text-on-surface-variant mb-3 leading-relaxed">
                          Your plan will prioritise the topics you're weakest on based on your quiz and flashcard history.
                        </p>
                        {masteryInsight.urgent.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-1.5">
                            <span className="text-[9px] font-black text-error uppercase tracking-widest shrink-0 mt-0.5">Urgent:</span>
                            {masteryInsight.urgent.slice(0, 4).map((c, i) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-error/10 border border-error/20 text-error font-bold">{c}</span>
                            ))}
                            {masteryInsight.urgent.length > 4 && <span className="text-[10px] text-error/60">+{masteryInsight.urgent.length - 4} more</span>}
                          </div>
                        )}
                        {masteryInsight.review.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-[9px] font-black text-primary uppercase tracking-widest shrink-0 mt-0.5">Review:</span>
                            {masteryInsight.review.slice(0, 4).map((c, i) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold">{c}</span>
                            ))}
                            {masteryInsight.review.length > 4 && <span className="text-[10px] text-primary/60">+{masteryInsight.review.length - 4} more</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                <button 
                  onClick={synthesizePlan}
                  disabled={!selectedCourse || !examDate}
                  className="relative z-10 w-full mt-10 bg-[#551a8b] text-on-white font-black py-5 rounded-2xl shadow-xl shadow-primary/14 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale uppercase tracking-widest text-sm cursor-pointer"
                >
                  Generate Study Plan
                </button>
              </div>
            </motion.section>
          )}

          {step === 'loading' && (
            <motion.section 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-32 space-y-8"
            >
              <div className="relative">
                <div className="w-40 h-40 rounded-full border border-primary/20 flex items-center justify-center relative">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-t border-secondary border-transparent"
                  ></motion.div>
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-full h-full absolute inset-0 rounded-full bg-primary/5 blur-xl"
                  ></motion.div>
                  <span className="material-symbols-outlined text-6xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
                </div>
                {/* HUD Overlay Decorations from mockup */}
                <div className="absolute -right-32 top-8 space-y-2 opacity-50 font-mono text-[9px]">
                  <p className="text-secondary flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-secondary animate-pulse"></span>
                    PLAN: GENERATING
                  </p>
                  <p className="text-primary flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-primary animate-pulse"></span>
                    TOPICS: ANALYSING
                  </p>
                  <p className="text-on-surface-variant">SCHEDULE: BUILDING</p>
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black tracking-tight text-on-surface">Study Plan Synthesis in Progress</h3>
                <p className="text-sm text-on-surface-variant font-medium">Calibrating Study Topics for maximum retention...</p>
              </div>
            </motion.section>
          )}

          {step === 'timeline' && plan && (
            <motion.section 
              key="timeline"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-12"
            >
              {(() => {
                const allTasks = plan.weeks?.flatMap((w, wIdx) => w.days?.flatMap((d, dIdx) => d.tasks?.map((_, tsIndex) => `${wIdx}-${dIdx}-${tsIndex}`) || []) || []) || [];
                const doneCount = allTasks.filter(k => completedTasks[k]).length;
                const pct = allTasks.length > 0 ? Math.round((doneCount / allTasks.length) * 100) : 0;
                return (
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 border-b border-outline-variant/10 pb-6 sm:pb-8">
                    <div>
                      <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter">Your Study Plan</h2>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="px-3 py-1 bg-surface-container-highest rounded-full text-[10px] font-bold uppercase tracking-widest text-secondary border border-secondary/20 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                          Active Strategy
                        </span>
                        <p className="text-on-surface-variant text-xs sm:text-sm font-medium">Targeted for {examDate}</p>
                      </div>
                      {allTasks.length > 0 && (
                        <div className="mt-3 flex items-center gap-3">
                          <div className="w-32 sm:w-48 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              className="h-full bg-secondary rounded-full"
                            />
                          </div>
                          <span className="text-[10px] font-bold text-secondary">{doneCount}/{allTasks.length} · {pct}%</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={handleSavePlan}
                        disabled={isSaving}
                        className="px-5 py-3 rounded-xl bg-secondary/10 text-secondary border border-secondary/20 font-bold text-xs uppercase tracking-widest hover:bg-secondary/20 transition-all disabled:opacity-50"
                      >
                        {isSaving ? 'Saving...' : 'Save Plan'}
                      </button>                      <button
                        onClick={() => { setCompletedTasks({}); localStorage.removeItem('planner_completed_tasks'); }}
                        className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface-variant hover:text-error transition-colors shadow-sm"
                        title="Reset progress"
                      >
                        <span className="material-symbols-outlined">restart_alt</span>
                      </button>
                      <button onClick={() => window.print()} className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface-variant hover:text-on-surface transition-colors shadow-sm">
                        <span className="material-symbols-outlined">print</span>
                      </button>
                      <button onClick={() => setStep('setup')} className="px-5 py-3 rounded-xl bg-primary/10 text-primary border border-primary/20 font-bold text-xs uppercase tracking-widest hover:bg-primary/20 transition-all">
                        Modify Settings
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div className="relative border-l-2 border-outline-variant/10 ml-6 pl-12 space-y-12">
                {plan.weeks?.map((week, wIdx) => (
                  <div key={wIdx} className="space-y-8">
                    <div className="relative flex items-center gap-4 mb-4">
                        <div className="absolute -left-[54px] w-4 h-4 rounded-full bg-background border-2 border-primary ring-4 ring-primary/10 shadow-[0_0_15px_rgba(189,157,255,0.4)]"></div>
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary-fixed-dim bg-primary/5 px-4 py-1 rounded-full border border-primary/10 flex items-center gap-2">
                             <span className="material-symbols-outlined text-sm">hub</span>
                             Week {week.week_number}: {week.focus}
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      {week.days?.map((day, dIdx) => {
                        const dayTasksDone = day.tasks?.filter((_, tsIndex) => completedTasks[`${wIdx}-${dIdx}-${tsIndex}`]).length || 0;
                        const dayTasksTotal = day.tasks?.length || 0;
                        const dayComplete = dayTasksTotal > 0 && dayTasksDone === dayTasksTotal;
                        return (
                        <motion.div 
                          whileHover={{ x: 8 }}
                          key={dIdx} 
                          className="relative group lg:max-w-4xl"
                        >
                          {/* Day Marker */}
                          <div className={`absolute -left-[53px] top-6 w-3 h-3 rounded-full border transition-all shadow-[0_0_10px_rgba(105,246,184,0)] ${dayComplete ? 'bg-secondary border-secondary shadow-[0_0_15px_rgba(105,246,184,0.5)]' : 'bg-surface-container-highest border-outline-variant group-hover:bg-secondary group-hover:border-transparent group-hover:shadow-[0_0_15px_rgba(105,246,184,0.3)]'}`}></div>
                          
                          <div className={`backdrop-blur-md border p-6 rounded-2xl transition-all shadow-sm group-hover:shadow-xl ${dayComplete ? 'bg-secondary/5 border-secondary/30' : 'bg-surface-container-low/50 border-outline-variant/15 group-hover:border-secondary/30 group-hover:bg-surface-container-low'}`}>
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant group-hover:text-secondary transition-colors">{day.day}</span>
                                <h4 className="text-lg font-bold text-on-surface flex items-center gap-2">
                                  {day.tasks?.[0] || 'Core Reinforcement'}
                                  {day.duration && <span className="text-[10px] font-mono text-on-surface-variant/60 ml-2">({day.duration})</span>}
                                </h4>
                              </div>
                              <span className={`px-3 py-1 text-[9px] font-bold rounded-full border ${dayComplete ? 'bg-secondary/10 text-secondary border-secondary/30' : dayTasksDone > 0 ? 'bg-primary/10 text-primary border-primary/20' : 'bg-surface-variant/50 text-on-surface-variant border-outline-variant/10'}`}>
                                {dayComplete ? '✓ DONE' : dayTasksDone > 0 ? `${dayTasksDone}/${dayTasksTotal}` : 'PENDING'}
                              </span>
                            </div>
                            
                            <div className="flex flex-wrap gap-3">
                              {day.tasks?.map((task, tsIndex) => {
                                const taskKey = `${wIdx}-${dIdx}-${tsIndex}`;
                                const done = !!completedTasks[taskKey];
                                return (
                                  <button
                                    key={tsIndex}
                                    onClick={() => toggleTask(wIdx, dIdx, tsIndex)}
                                    className={`bg-surface-container-lowest/40 px-4 py-2 rounded-xl border flex items-center gap-3 transition-all text-left ${done ? 'border-secondary/30 bg-secondary/5' : 'border-outline-variant/10 hover:border-secondary/30'}`}
                                  >
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${done ? 'bg-secondary border-secondary' : 'border-outline-variant'}`}>
                                      {done && <span className="material-symbols-outlined text-[12px] text-on-secondary font-black">check</span>}
                                    </div>
                                    <p className={`text-xs font-medium transition-colors ${done ? 'line-through text-on-surface-variant/50' : 'text-on-surface-variant'}`}>{task}</p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tips Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 pt-8">
                <div className="bg-surface-container-low/30 border border-outline-variant/10 rounded-2xl md:rounded-3xl p-5 sm:p-8 space-y-4 sm:space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-3xl">psychology_alt</span>
                    <h3 className="text-xl font-bold">Revision Strategy</h3>
                  </div>
                  <ul className="space-y-3">
                    {plan.revision_plan?.map((tip, i) => (
                      <li key={i} className="flex items-start gap-4 text-sm text-on-surface-variant transition-colors hover:text-on-surface group">
                        <span className="material-symbols-outlined text-sm text-primary mt-0.5 group-hover:scale-125 transition-transform">star</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-surface-container-low/30 border border-outline-variant/10 rounded-3xl p-8 space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary text-3xl">bolt</span>
                    <h3 className="text-xl font-bold">Exam Edge</h3>
                  </div>
                  <ul className="space-y-3">
                    {plan.exam_tips?.map((tip, i) => (
                      <li key={i} className="flex items-start gap-4 text-sm text-on-surface-variant transition-colors hover:text-on-surface group">
                        <span className="material-symbols-outlined text-sm text-secondary mt-0.5 group-hover:scale-125 transition-transform">auto_awesome</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
      <ScrollToTopButton />

      {/* Save plan modal */}
      <InputModal
        open={saveModalOpen}
        title="Save Study Plan"
        description="Give this plan a name so you can find it later in Saved Assets."
        placeholder="e.g. Finals Week — Organic Chemistry"
        confirmLabel="Save Plan"
        onConfirm={handleSavePlanConfirm}
        onCancel={() => setSaveModalOpen(false)}
      />

      <ConfirmModal
        open={dupConfirmOpen}
        title="Duplicate Study Plan"
        description={`An asset with the title "${pendingSaveTitle}" already exists. Do you want to save a new duplicate copy anyway?`}
        confirmLabel="Save Duplicate"
        cancelLabel="Cancel"
        onConfirm={handleSavePlanDuplicate}
        onCancel={() => { setDupConfirmOpen(false); setPendingSaveTitle(''); }}
      />
    </div>
  );
};

export default Planner;
