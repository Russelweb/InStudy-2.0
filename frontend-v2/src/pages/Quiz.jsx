import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { quizService, flashcardService, assetService } from '../services/api';
import { InputModal, ConfirmModal } from '../components/Modal';
import { showToast } from '../components/Toast';
import { useAura, useAuraHelp } from '../context/AuraContext';
import EmptyState from '../components/EmptyState';
import ScrollToTopButton from '../components/ScrollToTopButton';
import { useHeartbeat } from '../hooks/useHeartbeat';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

function preprocessMath(text) {
  if (!text) return text;
  if (/\$/.test(text)) return text;
  return text
    .replace(/\b(d\/d[a-z]|[a-z]\/[a-z]|\d+\/\d+)\b/g, (m) => `$${m}$`)
    .replace(/([a-zA-Z\d]+)\^(\{[^}]+\}|[a-zA-Z\d]+)/g, (m) => `$${m}$`)
    .replace(/\b(sin|cos|tan|cot|sec|csc|ln|log|exp|sqrt|lim|sum|int)\s*\(([^)]+)\)/g, (m) => `$${m}$`)
    .replace(/\b([a-zA-Z])'+'?\s*\([^)]+\)/g, (m) => `$${m}$`)
    .replace(/\b(alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|omega|phi|psi)\b/g, (m) => `$\\${m}$`)
    .replace(/([a-zA-Z][a-zA-Z0-9'_^()*/+\-\s]*=[a-zA-Z0-9'_^()*/+\-\s]+)/g, (m) => {
      if (/[\^*]|sin|cos|tan|ln|sqrt|d\/d/.test(m)) return `$${m.trim()}$`;
      return m;
    });
}

// ── Helper Components for Quiz Setup ──

const QuizStepHeading = ({ eyebrow, title, description }) => (
  <div className="mb-6">
    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-1 block">{eyebrow}</span>
    <h2 className="text-xl md:text-2xl font-black text-on-surface tracking-tight uppercase italic">{title}</h2>
    <p className="text-on-surface-variant text-xs mt-1 font-medium">{description}</p>
  </div>
);

const QuizActions = ({ children }) => (
  <div className="flex gap-3 mt-8 pt-6 border-t border-outline-variant/10">
    {children}
  </div>
);

const QuizPrimaryButton = ({ children, onClick, disabled, icon }) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className="flex-1 h-14 bg-primary text-on-primary rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
  >
    {children}
    {icon && <span className="material-symbols-outlined text-lg">{icon}</span>}
  </button>
);

const QuizBackButton = ({ onClick }) => (
  <button
    onClick={onClick}
    className="px-6 h-14 bg-surface-container-highest text-on-surface rounded-xl font-black text-xs uppercase tracking-widest border border-outline-variant/10 hover:bg-surface-variant transition-all flex items-center justify-center gap-2"
  >
    <span className="material-symbols-outlined text-lg">arrow_back</span>
    Back
  </button>
);

const QuizOptionCard = ({ label, children }) => (
  <div className="bg-surface-container border border-outline-variant/15 rounded-xl p-4 space-y-3">
    <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">{label}</p>
    {children}
  </div>
);

const QuizSegment = ({ values, value, onChange, accent = 'primary' }) => (
  <div className="flex gap-2">
    {values.map((v) => (
      <button
        key={v}
        onClick={() => onChange(v)}
        className={`flex-1 py-3 rounded-xl border text-sm font-black transition-all ${
          value === v
            ? accent === 'primary' 
              ? 'bg-primary/20 border-primary text-primary' 
              : 'bg-secondary/20 border-secondary text-secondary'
            : 'border-outline-variant/20 text-on-surface-variant hover:border-primary/40 hover:text-on-surface'
        }`}
      >
        {v}
      </button>
    ))}
  </div>
);

const QuizSectionLabel = ({ icon, label }) => (
  <div className="flex items-center gap-2 mb-1">
    <span className="material-symbols-outlined text-base text-primary">{icon}</span>
    <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{label}</span>
  </div>
);

const QuizReviewItem = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant/5">
    <span className="material-symbols-outlined text-lg text-primary/60 shrink-0">{icon}</span>
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-tighter leading-none mb-1">{label}</p>
      <p className="text-xs font-black text-on-surface truncate">{value}</p>
    </div>
  </div>
);

const QuizSetup = ({ onStart, availableCourses }) => {
  const navigate = useNavigate();
  const [selectedCourse, setSelectedCourse] = useState(availableCourses[0]?.id);
  const [difficulty, setDifficulty] = useState('Elite');
  const [count, setCount] = useState(10);
  const [quizType, setQuizType] = useState('multiple_choice');
  const [topic, setTopic] = useState('');
  const [timedMode, setTimedMode] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [courseQuery, setCourseQuery] = useState('');

  useEffect(() => {
    if (availableCourses.length > 0 && !selectedCourse) {
      setSelectedCourse(availableCourses[0].id);
    }
  }, [availableCourses, selectedCourse]);

  const selectedCourseData = availableCourses.find((course) => course.id === selectedCourse);
  const filteredCourses = useMemo(() => {
    const query = courseQuery.trim().toLowerCase();
    if (!query) return availableCourses;
    return availableCourses.filter((course) => course.name.toLowerCase().includes(query));
  }, [availableCourses, courseQuery]);

  return (
    <motion.section
      key="setup"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full max-w-4xl"
    >
      <div className="mb-6 text-center">
        <h1 className="text-2xl md:text-4xl font-black tracking-tight text-on-surface uppercase italic">
          Smart <span className="text-primary">Quiz</span>
        </h1>
        <p className="text-on-surface-variant text-sm mt-2">Set up a focused practice quiz without the clutter.</p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: 'Course', helper: 'Pick source' },
          { label: 'Quiz', helper: 'Set rules' },
          { label: 'Start', helper: 'Review' },
        ].map((step, index) => {
          const active = activeStep === index;
          const done = activeStep > index;
          return (
            <button
              key={step.label}
              onClick={() => (index === 0 || selectedCourse) && setActiveStep(index)}
              disabled={index > 0 && !selectedCourse}
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

      <div className="bg-surface-container-low/70 border border-outline-variant/15 rounded-2xl p-4 sm:p-5 md:p-6 mt-5">
        <AnimatePresence mode="wait">
          {activeStep === 0 && (
            <motion.div key="course" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <QuizStepHeading eyebrow="Step 1" title="Choose a Course" description="Pick the course you want to test yourself on." />
              {availableCourses.length === 0 ? (
                <EmptyState
                  icon="quiz"
                  title="No courses yet"
                  description="Create a course and upload a document before generating a quiz."
                  action={{ label: 'Go to Knowledge Base', onClick: () => navigate('/knowledge') }}
                />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.2fr] gap-4 mt-5">
                  <div className="bg-surface-container border border-secondary/25 rounded-xl p-4 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="h-11 w-11 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-xl">quiz</span>
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-1">Selected Course</p>
                        <h4 className="text-base font-black text-on-surface truncate">{selectedCourseData?.name || 'Choose a course'}</h4>
                        <p className="text-xs text-on-surface-variant mt-1">{selectedCourseData ? `${selectedCourseData.document_count || 0} documents ready` : 'Select a course to continue'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-surface-container border border-outline-variant/15 rounded-xl p-3">
                    <div className="flex items-center gap-2 bg-surface-container-high rounded-lg px-3 py-2 border border-outline-variant/15">
                      <span className="material-symbols-outlined text-base text-on-surface-variant">search</span>
                      <input value={courseQuery} onChange={(e) => setCourseQuery(e.target.value)} placeholder="Search courses" className="w-full bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none" />
                    </div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[210px] overflow-y-auto custom-scrollbar pr-1">
                      {filteredCourses.map((course) => {
                        const active = selectedCourse === course.id;
                        return (
                          <button key={course.id} onClick={() => setSelectedCourse(course.id)} className={`h-14 px-3 rounded-lg border text-left transition-all flex items-center gap-3 min-w-0 ${active ? 'bg-secondary/10 border-secondary text-secondary' : 'bg-surface-container-low border-outline-variant/10 text-on-surface-variant hover:border-secondary/35 hover:text-on-surface'}`}>
                            <span className="material-symbols-outlined text-lg shrink-0">{active ? 'check_circle' : 'school'}</span>
                            <span className="min-w-0">
                              <span className="block text-sm font-black truncate">{course.name}</span>
                              <span className="block text-[10px] opacity-75">{course.document_count || 0} documents</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              <QuizActions>
                <QuizPrimaryButton disabled={!selectedCourse} onClick={() => setActiveStep(1)} icon="arrow_forward">Next: Quiz Rules</QuizPrimaryButton>
              </QuizActions>
            </motion.div>
          )}

          {activeStep === 1 && (
            <motion.div key="rules" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <QuizStepHeading eyebrow="Step 2" title="Set Quiz Rules" description="Choose the length, difficulty, and question format." />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
                <QuizOptionCard label="Questions"><QuizSegment values={[5, 10, 20]} value={count} onChange={setCount} /></QuizOptionCard>
                <QuizOptionCard label="Difficulty"><QuizSegment values={['Easy', 'Moderate', 'Extreme']} value={difficulty} onChange={setDifficulty} accent="secondary" /></QuizOptionCard>
                <QuizOptionCard label="Format">
                  <div className="grid grid-cols-2 gap-2">
                    {[{ id: 'multiple_choice', label: 'MCQ' }, { id: 'true_false', label: 'True/False' }, { id: 'short_answer', label: 'Short' }, { id: 'mixed', label: 'Mixed' }].map(type => (
                      <button key={type.id} onClick={() => setQuizType(type.id)} className={`py-2.5 rounded-xl border text-xs font-black transition-all ${quizType === type.id ? 'bg-primary/20 border-primary text-primary' : 'border-outline-variant/20 text-on-surface-variant hover:border-primary/40 hover:text-on-surface'}`}>{type.label}</button>
                    ))}
                  </div>
                </QuizOptionCard>
              </div>
              <QuizActions>
                <QuizBackButton onClick={() => setActiveStep(0)} />
                <QuizPrimaryButton onClick={() => setActiveStep(2)} icon="arrow_forward">Next: Start</QuizPrimaryButton>
              </QuizActions>
            </motion.div>
          )}

          {activeStep === 2 && (
            <motion.div key="start" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <QuizStepHeading eyebrow="Step 3" title="Review and Start" description="Add an optional focus topic and choose whether to use a timer." />
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.85fr] gap-4 mt-5">
                <div className="space-y-4">
                  <div className="bg-surface-container border border-outline-variant/15 rounded-xl p-4">
                    <QuizSectionLabel icon="center_focus_strong" label="Focus Topic (optional)" />
                    <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. photosynthesis, vectors, contract law" className="mt-3 w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl py-3 px-4 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary/50 transition-all" />
                  </div>
                  <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${timedMode ? 'bg-primary/5 border-primary/20' : 'bg-surface-container border-outline-variant/15'}`}>
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${timedMode ? 'bg-primary/15 text-primary' : 'bg-surface-container-highest text-on-surface-variant'}`}><span className="material-symbols-outlined text-lg">timer</span></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-on-surface">{timedMode ? `${count} minute timed quiz` : 'Untimed quiz'}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">{timedMode ? 'One minute per question.' : 'Take as long as you need.'}</p>
                    </div>
                    <button onClick={() => setTimedMode(v => !v)} className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-primary/30 text-primary hover:bg-primary/10 transition-all">{timedMode ? 'Disable' : 'Enable'}</button>
                  </div>
                </div>
                <div className="bg-surface-container-high/60 border border-outline-variant/15 rounded-xl p-4 space-y-2">
                  <QuizReviewItem icon="menu_book" label="Course" value={selectedCourseData?.name || 'No course selected'} />
                  <QuizReviewItem icon="quiz" label="Questions" value={`${count} questions`} />
                  <QuizReviewItem icon="speed" label="Difficulty" value={difficulty} />
                  <QuizReviewItem icon="category" label="Format" value={quizType.replace('_', ' ')} />
                </div>
              </div>
              <QuizActions>
                <QuizBackButton onClick={() => setActiveStep(1)} />
                <QuizPrimaryButton disabled={!selectedCourse} onClick={() => onStart(selectedCourse, difficulty, count, quizType, topic, timedMode)} icon="quiz">Generate Quiz</QuizPrimaryButton>
              </QuizActions>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
};

const QuizAssessment = ({ questions, timedMode = true, onComplete, onAbort }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { triggerAura, askAuraBackground } = useAura();
  const [selected, setSelected] = useState(null);
  const [userAnswers, setUserAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(questions.length * 60);

  useEffect(() => {
    if (!timedMode) return; // no timer in untimed mode
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onComplete(userAnswers);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onComplete, userAnswers, timedMode]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentQ = questions[currentIndex] || { 
    question: "Loading neural pathways...", 
    options: ["Alpha", "Beta", "Gamma", "Delta"],
    id: "0"
  };

  useEffect(() => {
    const idleTimer = setTimeout(() => {
      triggerAura(
        'concerned', 
        "You've been on this question for a while. Need a subtle hint?", 
        { 
          label: 'Get a Hint', 
          onClick: () => askAuraBackground(`Give me a subtle hint for this question without giving away the answer. End by encouraging me to try again. Question: "${currentQ.question}"`) 
        },
        10000
      );
    }, 30000); // 30 seconds of inactivity triggers a hint

    return () => clearTimeout(idleTimer);
  }, [currentIndex, currentQ, triggerAura, askAuraBackground]);

  const handleNext = () => {
    // Save current answer
    const updatedAnswers = { ...userAnswers, [currentIndex]: selected };
    setUserAnswers(updatedAnswers);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      // Check if next question already has an answer saved
      setSelected(updatedAnswers[currentIndex + 1] || null);
    } else {
      // Completed, push all answers
      onComplete(updatedAnswers);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      // Save current answer before going back
      const updatedAnswers = { ...userAnswers, [currentIndex]: selected };
      setUserAnswers(updatedAnswers);
      
      setCurrentIndex(prev => prev - 1);
      setSelected(updatedAnswers[currentIndex - 1] || null);
    }
  };

  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-4xl mx-auto space-y-8 px-4"
    >
      {/* Top Header & Progress */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              <span className="text-[10px] text-secondary font-black uppercase tracking-[0.3em]">Active Quiz</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-on-surface tracking-tighter">
              Question {String(currentIndex + 1).padStart(2, '0')}
              <span className="text-on-surface-variant/30 ml-2 font-normal">/ {questions.length}</span>
            </h2>
          </div>

          <div className="flex items-center gap-4 sm:gap-8 w-full sm:w-auto justify-between sm:justify-end">
            {timedMode && (
              <div className="text-right">
                <div className={`text-[10px] uppercase tracking-[0.2em] font-bold ${timeLeft <= 60 ? 'text-error animate-pulse' : 'text-on-surface-variant/60'}`}>Time Left</div>
                <div className={`text-2xl font-mono tracking-tighter tabular-nums ${timeLeft <= 60 ? 'text-error animate-pulse' : 'text-primary'}`}>{formatTime(timeLeft)}</div>
              </div>
            )}
            <div className="relative group">
              <div className="w-14 h-14 rounded-full border-2 border-surface-container-highest flex items-center justify-center relative bg-surface-container/30 backdrop-blur-sm">
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
                  <circle className="text-surface-container-highest" cx="28" cy="28" fill="transparent" r="24" stroke="currentColor" strokeWidth="3"></circle>
                  <motion.circle 
                    className="text-secondary" 
                    cx="28" cy="28" 
                    fill="transparent" r="24" 
                    stroke="currentColor" 
                    strokeDasharray="150.8" 
                    initial={{ strokeDashoffset: 150.8 }}
                    animate={{ strokeDashoffset: 150.8 - (150.8 * ((currentIndex + 1) / questions.length)) }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    strokeWidth="3"
                    strokeLinecap="round"
                  ></motion.circle>
                </svg>
                <span className="text-[10px] font-black text-on-surface">{Math.round(((currentIndex + 1) / questions.length) * 100)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Linear Progress bar at the top */}
        <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden flex gap-0.5">
          {questions.map((_, i) => (
            <div 
              key={i} 
              className={`h-full flex-1 transition-all duration-500 ${
                i < currentIndex 
                  ? 'bg-secondary' 
                  : i === currentIndex 
                    ? 'bg-primary' 
                    : 'bg-surface-container-highest'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="relative">
        <div className="glass-panel rounded-3xl overflow-hidden border border-outline-variant/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative z-10">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-primary opacity-30"></div>
          
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="p-8 sm:p-12 md:p-16 space-y-10 sm:space-y-12"
            >
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-[10px] text-secondary font-black uppercase tracking-widest">
                      {currentQ.category || 'Topic'}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] text-primary font-black uppercase tracking-widest">
                      {currentQ.type?.replace('_', ' ') || 'Quiz'}
                    </span>
                  </div>
                  {timedMode && timeLeft <= 60 && (
                    <span className="flex items-center gap-1 text-error text-[10px] font-black uppercase tracking-widest animate-pulse">
                      <span className="material-symbols-outlined text-xs">timer</span>
                      Low Time
                    </span>
                  )}
                </div>
                
                <div className="relative">
                  <span className="absolute -left-8 sm:-left-12 top-0 text-4xl sm:text-6xl font-black text-primary/5 select-none leading-none">Q</span>
                  <p className="text-xl sm:text-2xl md:text-3xl font-medium leading-tight sm:leading-relaxed text-on-surface tracking-tight">
                    {currentQ.question}
                  </p>
                </div>
              </div>

              <div className="w-full">
                {(currentQ.type === 'multiple_choice' || currentQ.type === 'true_false') && currentQ.options?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    {currentQ.options.map((opt, i) => {
                      const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
                      const isSelected = selected === opt;
                      return (
                        <motion.button 
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          key={ids[i] || i}
                          onClick={() => setSelected(opt)}
                          className={`group p-5 sm:p-6 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden ${
                            isSelected 
                              ? 'bg-secondary/10 border-secondary ring-1 ring-secondary/30 shadow-[0_0_20px_rgba(105,246,184,0.1)]' 
                              : 'bg-surface-container-low border-outline-variant/10 hover:bg-surface-container-high hover:border-secondary/40'
                          }`}
                        >
                          <div className="flex items-start gap-4 relative z-10">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-black transition-colors ${
                              isSelected ? 'bg-secondary text-background' : 'bg-surface-container-highest text-on-surface-variant group-hover:bg-secondary/20 group-hover:text-secondary'
                            }`}>
                              {ids[i]}
                            </span>
                            <p className={`text-sm sm:text-base leading-snug flex-1 ${isSelected ? 'text-on-surface font-bold' : 'text-on-surface-variant group-hover:text-on-surface'}`}>
                              {opt}
                            </p>
                            {isSelected && (
                              <motion.span 
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="material-symbols-outlined text-secondary text-xl"
                              >
                                check_circle
                              </motion.span>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="w-full relative group">
                    <textarea
                      value={selected || ''}
                      onChange={(e) => setSelected(e.target.value)}
                      placeholder="Write your answer here..."
                      className="w-full h-48 bg-surface-container-low border border-outline-variant/20 rounded-2xl p-6 text-on-surface text-base sm:text-lg focus:ring-1 focus:ring-secondary/50 focus:border-secondary transition-all resize-none custom-scrollbar relative z-10 placeholder:text-on-surface-variant/30"
                    />
                    <div className="absolute bottom-4 right-4 flex items-center gap-2 opacity-30 group-focus-within:opacity-100 transition-opacity z-10">
                      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Typing...</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Action Footer */}
          <div className="px-8 sm:px-12 py-8 bg-surface-container/50 backdrop-blur-md flex flex-col sm:flex-row justify-between items-center gap-6 border-t border-outline-variant/10">
            <div className="flex items-center gap-8 w-full sm:w-auto justify-center sm:justify-start">
              <button 
                onClick={onAbort}
                className="group flex items-center gap-2 text-on-surface-variant hover:text-error transition-all"
              >
                <span className="material-symbols-outlined text-lg">close</span>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Exit Quiz</span>
              </button>
              <div className="h-4 w-px bg-outline-variant/20"></div>
              <button 
                onClick={handleBack}
                disabled={currentIndex === 0}
                className="group flex items-center gap-2 text-on-surface-variant hover:text-primary transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">arrow_back</span>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Previous</span>
              </button>
            </div>
            
            <button 
              onClick={handleNext}
              disabled={!selected}
              className={`w-full sm:w-auto px-10 py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all relative overflow-hidden group ${
                !selected 
                  ? 'bg-surface-container-highest text-on-surface-variant opacity-50 cursor-not-allowed' 
                  : 'bg-primary text-on-primary hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              <span className="relative z-10 flex items-center justify-center gap-3">
                {currentIndex === questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">
                  {currentIndex === questions.length - 1 ? 'check' : 'arrow_forward'}
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Helper text */}
      <p className="text-center text-[10px] text-on-surface-variant/40 font-medium uppercase tracking-[0.2em]">
        Your progress is automatically saved.
      </p>
    </motion.section>
  );
};

const QuizEvaluation = ({ results, onRestart, onSave, isSaving }) => (
  <motion.section 
    initial={{ opacity: 0, scale: 0.98, y: 10 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    className="w-full max-w-7xl mx-auto px-4 py-6 lg:py-10 h-full"
  >
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 h-full">
      {/* Left Sidebar: Summary - Desktop only */}
      <div className="hidden lg:flex lg:w-1/3 lg:flex-col lg:h-full">
        <div className="glass-panel rounded-3xl p-8 flex flex-col items-center text-center border border-outline-variant/10 shadow-2xl relative overflow-hidden group">
          <h3 className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.4em] mb-12">Quiz Summary</h3>
          
          <div className="relative w-56 h-56 mb-10 flex items-center justify-center mx-auto">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 224 224">
              <circle 
                className="text-surface-container-highest" 
                cx="112" 
                cy="112" 
                fill="transparent" 
                r="90" 
                stroke="currentColor" 
                strokeWidth="12"
              ></circle>
              <motion.circle 
                className={results?.score_percentage >= 80 ? 'text-secondary' : results?.score_percentage >= 50 ? 'text-primary' : 'text-error'}
                cx="112" 
                cy="112" 
                fill="transparent" 
                r="90" 
                stroke="currentColor" 
                strokeDasharray="565.5" 
                initial={{ strokeDashoffset: 565.5 }}
                animate={{ strokeDashoffset: 565.5 - (565.5 * (Math.min(results?.score_percentage || 0, 100) / 100)) }}
                transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                strokeWidth="12"
                strokeLinecap="round"
              ></motion.circle>
            </svg>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-5xl font-black text-on-surface tracking-tighter"
              >
                {Math.round(results?.score_percentage || 0)}
                <span className="text-2xl text-on-surface-variant/40 ml-1">%</span>
              </motion.span>
              <span className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-widest">Score</span>
            </div>
          </div>

          <div className="space-y-4 relative z-10 w-full">
            <h4 className={`font-black text-xl uppercase tracking-tighter ${results?.score_percentage >= 80 ? 'text-secondary' : results?.score_percentage >= 50 ? 'text-primary' : 'text-error'}`}>
              {results?.score_percentage >= 80 ? 'Excellent' : results?.score_percentage >= 50 ? 'Good' : 'Needs Practice'}
            </h4>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-center gap-3 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span className="font-bold text-on-surface">{results?.correct_answers || 0}</span>
                <span>Correct</span>
              </div>
              <div className="flex items-center justify-center gap-3 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-base">quiz</span>
                <span className="font-bold text-on-surface">{results?.total_questions || 0}</span>
                <span>Total</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Evaluation Actions - Always at bottom on desktop */}
        <div className="flex flex-col gap-3 mt-6">
          <button onClick={onSave} disabled={isSaving} className="w-full py-4 bg-secondary/10 border border-secondary/20 text-secondary rounded-2xl font-black shadow-lg hover:bg-secondary/20 active:scale-[0.98] transition-all text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 disabled:opacity-50 group">
            <span className="material-symbols-outlined text-lg">{isSaving ? 'sync' : 'bookmark'}</span>
            {isSaving ? 'Saving...' : 'Save Quiz'}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={onRestart} className="py-4 bg-surface-container-highest border border-outline-variant/10 text-on-surface rounded-2xl font-black hover:bg-surface-variant active:scale-[0.98] transition-all text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-lg">add</span>
              New
            </button>
            <button onClick={onRestart} className="py-4 bg-primary text-on-primary rounded-2xl font-black shadow-xl hover:shadow-primary/20 active:scale-[0.98] transition-all text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 group">
              <span className="material-symbols-outlined text-lg group-hover:rotate-180 transition-transform">restart_alt</span>
              Retry
            </button>
          </div>
        </div>
      </div>

      {/* Right Content: Question Breakdown - Scrollable (both mobile & desktop) */}
      <div className="lg:w-2/3 w-full flex flex-col h-full">
        {/* Mobile-only: Summary at top for small screens */}
        <div className="lg:hidden mb-6">
           <div className="glass-panel rounded-2xl p-6 flex flex-col items-center text-center border border-outline-variant/10 shadow-2xl relative overflow-hidden group">
              <h3 className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.4em] mb-6">Quiz Summary</h3>
              
              <div className="relative w-36 h-36 mb-6 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 224 224">
                  <circle 
                    className="text-surface-container-highest" 
                    cx="112" 
                    cy="112" 
                    fill="transparent" 
                    r="90" 
                    stroke="currentColor" 
                    strokeWidth="12"
                  ></circle>
                  <motion.circle 
                    className={results?.score_percentage >= 80 ? 'text-secondary' : results?.score_percentage >= 50 ? 'text-primary' : 'text-error'}
                    cx="112" 
                    cy="112" 
                    fill="transparent" 
                    r="90" 
                    stroke="currentColor" 
                    strokeDasharray="565.5" 
                    initial={{ strokeDashoffset: 565.5 }}
                    animate={{ strokeDashoffset: 565.5 - (565.5 * (Math.min(results?.score_percentage || 0, 100) / 100)) }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                    strokeWidth="12"
                    strokeLinecap="round"
                  ></motion.circle>
                </svg>
                
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="text-3xl font-black text-on-surface tracking-tighter"
                  >
                    {Math.round(results?.score_percentage || 0)}
                    <span className="text-lg text-on-surface-variant/40 ml-1">%</span>
                  </motion.span>
                  <span className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-widest">Score</span>
                </div>
              </div>

              <div className="space-y-3 relative z-10 w-full">
                <h4 className={`font-black text-lg uppercase tracking-tighter ${results?.score_percentage >= 80 ? 'text-secondary' : results?.score_percentage >= 50 ? 'text-primary' : 'text-error'}`}>
                  {results?.score_percentage >= 80 ? 'Excellent' : results?.score_percentage >= 50 ? 'Good' : 'Needs Practice'}
                </h4>
                <div className="flex justify-center gap-6">
                   <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    <span className="font-bold text-on-surface">{results?.correct_answers || 0}</span>
                    <span>Correct</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-base">quiz</span>
                    <span className="font-bold text-on-surface">{results?.total_questions || 0}</span>
                    <span>Total</span>
                  </div>
                </div>
              </div>
            </div>
        </div>

        {/* Answers Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-black text-on-surface tracking-tight">Answers</h3>
          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary"></span> Correct
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-error"></span> Incorrect
            </div>
          </div>
        </div>

        {/* Scrollable Answers */}
        <div className="max-h-[calc(1.7*30rem)] lg:max-h-[calc(1.7*34rem)] overflow-y-auto custom-scrollbar pb-4">
          <div className="flex flex-col gap-4">
            {results?.question_results?.map((q, idx) => (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                key={idx} 
                className={`group p-6 rounded-3xl border transition-all hover:shadow-xl ${
                  q.is_correct 
                    ? 'border-secondary/20 bg-secondary/[0.02] hover:bg-secondary/[0.04]' 
                    : 'border-error/20 bg-error/[0.02] hover:bg-error/[0.04]'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
                      Question {q.question_number} • {q.concept}
                    </p>
                    <p className="text-base font-bold text-on-surface leading-snug">
                      {q.question}
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${q.is_correct ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'}`}>
                    <span className="material-symbols-outlined text-2xl font-bold">
                      {q.is_correct ? 'check' : 'close'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className={`p-4 rounded-2xl border ${q.is_correct ? 'bg-secondary/5 border-secondary/10' : 'bg-error/5 border-error/10'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Your Answer</span>
                      {q.is_correct && <span className="text-[9px] font-black uppercase text-secondary">Correct</span>}
                    </div>
                    <p className={`text-sm font-bold ${q.is_correct ? 'text-secondary' : 'text-error'}`}>
                      {q.user_answer || 'No answer'}
                    </p>
                  </div>

                  {!q.is_correct && (
                    <div className="p-4 rounded-2xl bg-secondary/5 border border-secondary/10">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-40 text-on-surface-variant">Correct Answer</span>
                      </div>
                      <p className="text-sm font-bold text-secondary">
                        {/* Resolve single-letter answers to full option text if possible */}
                        {(() => {
                          const ca = q.correct_answer || '';
                          if (ca.length <= 2 && /^[A-Fa-f]$/.test(ca) && q.options?.length > 0) {
                            const idx = ca.toUpperCase().charCodeAt(0) - 65;
                            return q.options[idx] ? `${ca.toUpperCase()}. ${q.options[idx]}` : ca;
                          }
                          return ca;
                        })()}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 p-5 rounded-2xl bg-surface-container-low border border-outline-variant/5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-sm">lightbulb</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Insight</span>
                  </div>
                  <div className="text-sm text-on-surface-variant leading-relaxed font-medium markdown-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        h1: ({children}) => <h1 className="text-base font-black text-secondary mt-4 mb-2 pb-1 border-b border-secondary/20">{children}</h1>,
                        h2: ({children}) => <h2 className="text-sm font-bold text-on-surface mt-3 mb-2">{children}</h2>,
                        h3: ({children}) => <h3 className="text-xs font-bold text-secondary/80 mt-2 mb-1">{children}</h3>,
                        p: ({children}) => <p className="my-2 leading-relaxed text-on-surface-variant/90">{children}</p>,
                        ul: ({children}) => <ul className="my-2 pl-4 space-y-1 list-disc text-on-surface-variant">{children}</ul>,
                        ol: ({children}) => <ol className="my-2 pl-4 space-y-1 list-decimal text-on-surface-variant">{children}</ol>,
                        li: ({children}) => <li className="leading-relaxed">{children}</li>,
                        strong: ({children}) => <strong className="font-bold text-secondary">{children}</strong>,
                        em: ({children}) => <em className="italic text-on-surface-variant">{children}</em>,
                        code: ({inline, children}) => inline
                          ? <code className="bg-secondary/10 px-1 py-0.5 rounded text-[12px] text-secondary font-mono font-medium">{children}</code>
                          : <div className="relative group my-3">
                              <pre className="bg-surface-container-highest/50 rounded-xl p-3 overflow-x-auto border border-outline-variant/10 shadow-inner">
                                <code className="text-xs text-secondary font-mono leading-normal">{children}</code>
                              </pre>
                            </div>,
                        pre: ({children}) => <>{children}</>,
                        blockquote: ({children}) => <blockquote className="border-l-4 border-secondary/30 bg-secondary/5 pl-3 py-1.5 my-3 text-on-surface-variant italic rounded-r-lg">{children}</blockquote>,
                        table: ({children}) => (
                          <div className="my-4 overflow-x-auto rounded-xl border border-outline-variant/20 shadow-sm bg-surface-container-low/50">
                            <table className="w-full text-xs border-collapse">{children}</table>
                          </div>
                        ),
                        thead: ({children}) => <thead className="bg-secondary/10">{children}</thead>,
                        th: ({children}) => <th className="px-3 py-2 text-left font-black text-secondary border-b border-outline-variant/20 uppercase tracking-wider text-[10px]">{children}</th>,
                        td: ({children}) => <td className="px-3 py-2 border-b border-outline-variant/10 text-on-surface-variant leading-relaxed">{children}</td>,
                        a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-secondary underline decoration-secondary/30 underline-offset-2 hover:text-secondary-fixed transition-colors font-medium">{children}</a>,
                        hr: () => <hr className="border-outline-variant/10 my-4" />,
                      }}
                    >
                      {preprocessMath(q.explanation)}
                    </ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        
        {/* Evaluation Actions - Always at bottom on mobile */}
        <div className="flex flex-col gap-3 pt-4 lg:hidden">
          <button onClick={onSave} disabled={isSaving} className="w-full py-4 bg-secondary/10 border border-secondary/20 text-secondary rounded-2xl font-black shadow-lg hover:bg-secondary/20 active:scale-[0.98] transition-all text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 disabled:opacity-50 group">
            <span className="material-symbols-outlined text-lg">{isSaving ? 'sync' : 'bookmark'}</span>
            {isSaving ? 'Saving...' : 'Save Quiz'}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={onRestart} className="py-4 bg-surface-container-highest border border-outline-variant/10 text-on-surface rounded-2xl font-black hover:bg-surface-variant active:scale-[0.98] transition-all text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-lg">add</span>
              New
            </button>
            <button onClick={onRestart} className="py-4 bg-primary text-on-primary rounded-2xl font-black shadow-xl hover:shadow-primary/20 active:scale-[0.98] transition-all text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 group">
              <span className="material-symbols-outlined text-lg group-hover:rotate-180 transition-transform">restart_alt</span>
              Retry
            </button>
          </div>
        </div>
      </div>
    </div>
  </motion.section>
);

const Quiz = () => {
  const [phase, setPhase] = useState('setup'); // 'setup' | 'assessment' | 'evaluation'
  const [courses, setCourses] = useState([]);
  const [currentQuestions, setCurrentQuestions] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [evaluationResults, setEvaluationResults] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [timedMode, setTimedMode] = useState(true);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [dupConfirmOpen, setDupConfirmOpen] = useState(false);
  const [pendingSaveTitle, setPendingSaveTitle] = useState('');
  const [abortModalOpen, setAbortModalOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { triggerAura } = useAura();
  useAuraHelp('Choose your course, set difficulty and question count, then click Generate Quiz. Your results update your Mastery score.');
  const isInitialized = useRef(false);

  // ── Productive study time tracking ───────────────────────────────────────
  const { recordInteraction } = useHeartbeat(selectedCourse, 'quiz');
  // Store difficulty so handleCompleteQuiz can pass it to the backend
  const [currentDifficulty, setCurrentDifficulty] = useState('medium');

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await flashcardService.getDecks();
        setCourses(response.data.courses || []);
      } catch (error) {
        console.error("Failed to fetch courses:", error);
      }
    };
    fetchCourses();

    // ── Primary: Router state handoff from SavedAssets (synchronous, no race conditions) ──
    const routerAsset = location.state?.loadedAsset;
    const loadMode = location.state?.loadMode || 'retake'; // 'retake' | 'results'

    // ── Fallback: legacy localStorage handoff ──────────────────────────────
    let legacyAssetRaw = null;
    try { legacyAssetRaw = localStorage.getItem('load_asset_quiz'); } catch (_) {}

    const assetToLoad = routerAsset || (legacyAssetRaw ? JSON.parse(legacyAssetRaw) : null);
    const effectiveMode = routerAsset ? loadMode : (assetToLoad?.data?.results ? 'results' : 'retake');

    if (assetToLoad) {
      try {
        console.log(`Loading saved quiz: "${assetToLoad.title}" in ${effectiveMode} mode`);
        setCurrentQuestions(assetToLoad.data.questions || []);
        setSelectedCourse(assetToLoad.course_id);

        if (effectiveMode === 'results' && assetToLoad.data.results) {
          // View previous results
          setEvaluationResults(assetToLoad.data.results);
          setPhase('evaluation');
        } else {
          // Retake: always clear old results and start fresh with the same questions
          setEvaluationResults(null);
          setPhase('assessment');
        }

        if (!routerAsset) localStorage.removeItem('load_asset_quiz');
        setTimeout(() => { isInitialized.current = true; }, 100);
        return; // Skip normal persistence loading
      } catch (e) {
        console.error('Failed to load quiz asset:', e);
      }
    }

    // Load persisted state (only if no asset was loaded)
    const savedPhase = localStorage.getItem('quiz_phase');
    const savedQuestions = localStorage.getItem('quiz_questions');
    const savedCourseId = localStorage.getItem('quiz_selected_course');
    const savedResults = localStorage.getItem('quiz_results');

    if (savedPhase) setPhase(savedPhase);
    if (savedQuestions) setCurrentQuestions(JSON.parse(savedQuestions));
    if (savedCourseId) setSelectedCourse(savedCourseId);
    if (savedResults) setEvaluationResults(JSON.parse(savedResults));

    setTimeout(() => { isInitialized.current = true; }, 100);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Only persist after loading is done
    if (!isInitialized.current) return;
    
    localStorage.setItem('quiz_phase', phase);
    localStorage.setItem('quiz_questions', JSON.stringify(currentQuestions));
    if (selectedCourse) localStorage.setItem('quiz_selected_course', selectedCourse);
    if (evaluationResults) localStorage.setItem('quiz_results', JSON.stringify(evaluationResults));
  }, [phase, currentQuestions, selectedCourse, evaluationResults]);

  const clearPersistence = () => {
    localStorage.removeItem('quiz_phase');
    localStorage.removeItem('quiz_questions');
    localStorage.removeItem('quiz_results');
  };

  const handleStartQuiz = async (courseId, difficulty, count, quizType, topic, timed = true) => {
    setSelectedCourse(courseId);
    setTimedMode(timed);
    setCurrentDifficulty(difficulty.toLowerCase()); // store for evaluate step
    setIsGenerating(true);
    try {
      const response = await quizService.generate(courseId, count, difficulty.toLowerCase(), quizType, topic);
      setCurrentQuestions(response.data.questions || response.data.quiz?.questions || []);
      setPhase('assessment');
    } catch (error) {
      triggerAura('concerned', 'Couldn\'t generate the quiz. Make sure this course has documents uploaded.',
        { label: 'Go to Knowledge Base', onClick: () => navigate('/knowledge') });
      setPhase('setup');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCompleteQuiz = async (userAnswersMap) => {
    setIsGenerating(true);

    // ── Record productive interaction for heartbeat ───────────────────────
    recordInteraction();

    try {
      const answersDict = {};
      currentQuestions.forEach((q, idx) => {
        answersDict[idx.toString()] = userAnswersMap[idx];
      });

      const response = await quizService.submit({
        course_id: selectedCourse,
        questions: currentQuestions,   // includes subtopic_id/doc_id tags if present
        user_answers: answersDict,
        difficulty: currentDifficulty, // needed for XP rate calculation
      });

      setEvaluationResults(response.data);
      setPhase('evaluation');

      // ── XP toast from mastery engine response ─────────────────────────
      const masteryUpdate = response.data?.mastery_update;
      if (masteryUpdate?.total_xp > 0) {
        showToast(`+${masteryUpdate.total_xp} XP earned this quiz`, 'success');
      }

      const score = response.data?.score_percentage || 0;
      const msg = score >= 80
        ? `Strong result — ${Math.round(score)}%. Your mastery scores have been updated.`
        : score >= 50
        ? `${Math.round(score)}% — decent run. Review the weak areas and try again.`
        : `${Math.round(score)}% this time. Check the corrections below — they'll help.`;
      triggerAura('celebrating', msg);
    } catch (error) {
      console.error("Failed to evaluate quiz", error);
      showToast('Quiz evaluation failed. Please try again.', 'error');
      setPhase('setup');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAbortQuiz = () => {
    setAbortModalOpen(true);
  };

  const handleRestart = () => {
    clearPersistence();
    setPhase('setup');
    setCurrentQuestions([]);
    setEvaluationResults(null);
  };

  const handleSaveQuiz = async () => {
    if (!evaluationResults) return;
    setSaveModalOpen(true);
  };

  const handleSaveQuizConfirm = async (title) => {
    setSaveModalOpen(false);
    setIsSaving(true);
    try {
      const res = await assetService.save(
        selectedCourse,
        'quiz',
        title,
        { questions: currentQuestions, results: evaluationResults },
        { score: evaluationResults.score_percentage, total_questions: evaluationResults.total_questions }
      );
      if (res.data && res.data.duplicate) {
        setPendingSaveTitle(title);
        setDupConfirmOpen(true);
      } else {
        showToast('Quiz saved successfully!', 'success');
      }
    } catch (error) {
      console.error('Save failed:', error);
      showToast('Failed to save quiz. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveQuizDuplicate = async () => {
    setDupConfirmOpen(false);
    setIsSaving(true);
    try {
      await assetService.save(
        selectedCourse,
        'quiz',
        pendingSaveTitle,
        { questions: currentQuestions, results: evaluationResults },
        { score: evaluationResults.score_percentage, total_questions: evaluationResults.total_questions },
        true
      );
      showToast('Quiz saved successfully!', 'success');
    } catch (error) {
      console.error('Save failed:', error);
      showToast('Failed to save quiz. Please try again.', 'error');
    } finally {
      setIsSaving(false);
      setPendingSaveTitle('');
    }
  };

  return (
    <div className="p-4 md:p-8 min-h-screen flex flex-col relative bg-background overflow-hidden">
      {isGenerating ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center gap-6 h-full"
        >
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-primary font-bold tracking-widest uppercase animate-pulse">Generating Quiz...</p>
        </motion.div>
      ) : (
        <div className="h-full flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            {phase === 'setup' && <QuizSetup key="setup" availableCourses={courses} onStart={handleStartQuiz} />}
            {phase === 'assessment' && <QuizAssessment key="assessment" questions={currentQuestions} timedMode={timedMode} onComplete={handleCompleteQuiz} onAbort={handleAbortQuiz} />}
            {phase === 'evaluation' && <QuizEvaluation key="evaluation" results={evaluationResults} onRestart={handleRestart} onSave={handleSaveQuiz} isSaving={isSaving} />}
          </AnimatePresence>
        </div>
      )}

      {/* Save quiz modal */}
      <InputModal
        open={saveModalOpen}
        title="Save Quiz"
        description="Give this quiz a name so you can find it later in Saved Assets."
        placeholder="e.g. Midterm Practice — Chapter 4"
        confirmLabel="Save Quiz"
        onConfirm={handleSaveQuizConfirm}
        onCancel={() => setSaveModalOpen(false)}
      />

      <ConfirmModal
        open={dupConfirmOpen}
        title="Duplicate Quiz"
        description={`An asset with the title "${pendingSaveTitle}" already exists. Do you want to save a new duplicate copy anyway?`}
        confirmLabel="Save Duplicate"
        cancelLabel="Cancel"
        onConfirm={handleSaveQuizDuplicate}
        onCancel={() => { setDupConfirmOpen(false); setPendingSaveTitle(''); }}
      />

      {/* Abort confirm modal */}
      <ConfirmModal
        open={abortModalOpen}
        title="Abort Quiz?"
        description="Your progress on this quiz will not be saved. Are you sure you want to quit?"
        confirmLabel="Yes, Abort"
        cancelLabel="Keep Going"
        danger
        onConfirm={() => { setAbortModalOpen(false); handleRestart(); }}
        onCancel={() => setAbortModalOpen(false)}
      />

      <div className="fixed top-1/4 -left-32 w-96 h-96 bg-[#581c87]/10 blur-[120px] rounded-full -z-20"></div>
      <div className="fixed bottom-1/4 -right-32 w-96 h-96 bg-[#064e3b]/10 blur-[120px] rounded-full -z-20"></div>
      <ScrollToTopButton />
    </div>
  );
};

export default Quiz;
