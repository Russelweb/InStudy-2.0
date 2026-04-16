import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { quizService, flashcardService } from '../services/api';

const QuizSetup = ({ onStart, availableCourses }) => {
  const [selectedCourse, setSelectedCourse] = useState(availableCourses[0]?.id);
  const [difficulty, setDifficulty] = useState('Elite');
  const [count, setCount] = useState(10);
  const [quizType, setQuizType] = useState('multiple_choice');

  // Sync course selection if data loads later
  useEffect(() => {
    if (availableCourses.length > 0 && !selectedCourse) {
      setSelectedCourse(availableCourses[0].id);
    }
  }, [availableCourses, selectedCourse]);

  return (
    <motion.section 
      key="setup"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative w-full max-w-4xl"
    >
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="relative bg-surface-container/40 backdrop-blur-xl border border-outline-variant/15 rounded-2xl md:rounded-3xl p-5 sm:p-8 md:p-10 shadow-2xl overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 group-hover:opacity-100 transition-opacity opacity-0 pointer-events-none"></div>
        
        <div className="relative text-center mb-6 md:mb-10">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter mb-2 md:mb-3 bg-[#551a8b] bg-clip-text text-transparent uppercase italic">Instudent Assessment Lab</h1>
          <p className="text-on-surface-variant text-xs sm:text-sm font-medium">Customize Your Smart Quiz.</p>
        </div>

        <div className="relative space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Target Course/Module</label>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto custom-scrollbar p-1">
              {availableCourses.map(course => (
                <button 
                  key={course.id}
                  onClick={() => setSelectedCourse(course.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${selectedCourse === course.id ? 'bg-primary/10 border-primary text-on-surface' : 'bg-surface-container-low border-outline-variant/15 text-on-surface-variant hover:border-primary/50'}`}
                >
                  <div className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-60">Module</div>
                  <div className="font-bold truncate text-sm">{course.name}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Number Of Questions</label>
              <div className="flex gap-3">
                {[5, 10, 20].map(num => (
                  <button 
                    key={num} 
                    onClick={() => setCount(num)}
                    className={`flex-1 py-3 rounded-xl border text-xs font-bold transition-all ${count === num ? 'border-primary text-primary bg-primary/10 shadow-[0_0_15px_rgba(189,157,255,0.2)]' : 'border-outline-variant/15 text-on-surface-variant hover:bg-primary/10 hover:text-primary'}`}
                  >
                    {num} Units
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Difficulty</label>
              <div className="flex gap-3">
                {['Easy', 'Moderate', 'Extreme'].map(diff => (
                  <button 
                    key={diff} 
                    onClick={() => setDifficulty(diff)}
                    className={`flex-1 py-3 rounded-xl border text-xs font-bold transition-all ${difficulty === diff ? 'border-secondary text-secondary bg-secondary/10 shadow-[0_0_15px_rgba(105,246,184,0.2)]' : 'border-outline-variant/15 text-on-surface-variant hover:bg-secondary/10 hover:text-secondary'}`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Question Format</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { id: 'multiple_choice', label: 'MCQ' },
                  { id: 'true_false', label: 'True/False' },
                  { id: 'short_answer', label: 'Short' },
                  { id: 'mixed', label: 'Mixed Mode' }
                ].map(type => (
                  <button 
                    key={type.id}
                    onClick={() => setQuizType(type.id)}
                    className={`py-3 rounded-xl border text-xs font-bold transition-all ${quizType === type.id ? 'border-primary text-primary bg-primary/10' : 'border-outline-variant/15 text-on-surface-variant hover:bg-primary/10 hover:text-primary'}`}
                  >
                    {type.label}
                  </button>
                ))}
            </div>
          </div>

          <button 
            onClick={() => onStart(selectedCourse, difficulty, count, quizType)}
            disabled={!selectedCourse}
            className="w-full mt-4 py-5 rounded-2xl bg-[#551a8b] text-on-white font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            Synthesize Assessment
          </button>
        </div>
      </div>
    </motion.section>
  );
};

const QuizAssessment = ({ questions, onComplete, onAbort }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [userAnswers, setUserAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(questions.length * 60); // 1 minute per question

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto-submit all collected answers when time runs out
          onComplete(userAnswers);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onComplete, userAnswers]);

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
      className="w-full max-w-4xl space-y-8"
    >
      <div className="flex justify-between items-end px-4">
        <div className="space-y-1">
          <span className="text-xs text-secondary font-bold uppercase tracking-[0.3em]">Smart Assessment</span>
          <h2 className="text-3xl font-black text-on-surface">Question {String(currentIndex + 1).padStart(2, '0')}<span className="text-on-surface-variant/40 ml-2 text-xl font-normal">/ {questions.length}</span></h2>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className={`text-[10px] uppercase tracking-widest font-bold ${timeLeft <= 60 ? 'text-error animate-pulse' : 'text-on-surface-variant'}`}>Timer</div>
            <div className={`text-2xl font-mono tracking-tighter ${timeLeft <= 60 ? 'text-error animate-pulse' : 'text-primary'}`}>{formatTime(timeLeft)}</div>
          </div>
          <div className="w-12 h-12 rounded-full border-2 border-surface-container-highest flex items-center justify-center relative">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle className="text-secondary/20" cx="24" cy="24" fill="transparent" r="20" stroke="currentColor" strokeWidth="2"></circle>
              <circle className="text-secondary" cx="24" cy="24" fill="transparent" r="20" stroke="currentColor" strokeDasharray="125.6" strokeDashoffset={125.6 - (125.6 * (currentIndex / questions.length))} strokeWidth="2"></circle>
            </svg>
            <span className="text-[10px] font-black">{Math.round((currentIndex / questions.length) * 100)}%</span>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-outline-variant/10 shadow-2xl relative">
        <div className="absolute top-0 left-0 w-full h-1 signature-gradient opacity-50"></div>
        <div className="p-12 space-y-12">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-secondary/10 text-[10px] text-secondary font-bold uppercase tracking-wider">{currentQ.category || 'Smart'}</span>
              <span className="px-2 py-0.5 rounded bg-primary/10 text-[10px] text-primary font-bold uppercase tracking-wider">Focus</span>
            </div>
            <p className="text-2xl font-medium leading-relaxed text-on-surface">
              {currentQ.question}
            </p>
          </div>
          <div className="w-full">
            {(currentQ.type === 'multiple_choice' || currentQ.type === 'true_false') && currentQ.options?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {currentQ.options.map((opt, i) => {
                  const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
                  return (
                    <button 
                      key={ids[i] || i}
                      onClick={() => setSelected(opt)}
                      className={`group p-6 rounded-xl border text-left transition-all duration-300 relative ${
                        selected === opt 
                          ? 'bg-secondary/10 border-secondary scale-[1.02] shadow-[0_0_20px_rgba(105,246,184,0.2)]' 
                          : 'bg-surface-container-low border-outline-variant/10 hover:bg-surface-container-highest hover:border-secondary/50'
                      }`}
                    >
                      <span className={`absolute top-4 right-4 text-[10px] font-mono ${selected === opt ? 'text-secondary' : 'text-on-surface-variant/20 group-hover:text-secondary/40'}`}>{ids[i]}</span>
                      <p className={`${selected === opt ? 'text-on-surface font-bold' : 'text-on-surface-variant group-hover:text-on-surface'}`}>{opt}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="w-full relative">
                <textarea
                  value={selected || ''}
                  onChange={(e) => setSelected(e.target.value)}
                  placeholder="Answer here..."
                  className="w-full h-40 bg-surface-container-low border border-outline-variant/20 rounded-xl p-6 text-on-surface focus:ring-1 focus:ring-secondary/50 focus:border-secondary transition-all resize-none custom-scrollbar"
                />
                <span className="absolute bottom-4 right-4 material-symbols-outlined text-secondary opacity-20 pointer-events-none">memory</span>
              </div>
            )}
          </div>
        </div>
        <div className="bg-black/40 px-12 py-6 flex justify-between items-center border-t border-outline-variant/5">
          <div className="flex gap-6">
            <button 
              onClick={onAbort}
              className="flex items-center gap-2 text-on-surface-variant hover:text-error transition-colors"
            >
              <span className="material-symbols-outlined text-sm">cancel</span>
              <span className="text-xs font-bold uppercase tracking-widest">Abort Session</span>
            </button>
            <button 
              onClick={handleBack}
              disabled={currentIndex === 0}
              className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span className="text-xs font-bold uppercase tracking-widest">Previous</span>
            </button>
          </div>
          <button 
            onClick={handleNext}
            disabled={!selected}
            className={`px-8 py-3 rounded-lg bg-[#551a8b] text-on-white font-black text-xs uppercase tracking-widest scale-100 active:scale-95 text-white opacity-100 transition-transform ${!selected ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {currentIndex === questions.length - 1 ? 'Finalize Submission' : 'Next Question'}
          </button>
        </div>
      </div>
    </motion.section>
  );
};

const QuizEvaluation = ({ results, onRestart }) => (
  <motion.section 
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="w-full max-w-5xl"
  >
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 glass-panel rounded-2xl p-8 flex flex-col items-center text-center border border-outline-variant/10 shadow-2xl">
        <h3 className="text-xs text-on-surface-variant font-black uppercase tracking-[0.4em] mb-12">Quiz Summary</h3>
        <div className="relative w-48 h-48 mb-8">
          <div className="absolute inset-0 rounded-full border-8 border-surface-container-highest"></div>
          <div className="absolute inset-0 rounded-full border-8 border-primary border-t-transparent shadow-[0_0_30px_rgba(189,157,255,0.3)]" style={{ transform: `rotate(${Math.min(results?.score_percentage || 0, 100) * 3.6 - 90}deg)` }}></div>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-black text-on-surface tracking-tighter">{Math.round(results?.score_percentage || 0)}<span className="text-2xl text-primary">%</span></span>
            <span className="text-[10px] text-on-surface-variant font-bold uppercase">Mastery percentage</span>
          </div>
        </div>
        <div className="space-y-4">
           <h4 className="text-secondary font-bold text-lg uppercase tracking-tighter">{results?.score_percentage >= 80 ? 'Elite Proficiency' : (results?.score_percentage >= 50 ? 'Standard Proficiency' : 'Requires Training')}</h4>
           <p className="text-sm text-on-surface-variant font-medium">You correctly answered {results?.correct_answers || 0} out of {results?.total_questions || 0} questions.</p>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <h3 className="text-xl font-black text-on-surface mb-2">Quiz Evaluation and Correction</h3>
        <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2 h-[500px]">
          {results?.question_results?.map((q, idx) => (
            <div key={idx} className={`p-6 rounded-xl border ${q.is_correct ? 'border-secondary/30 bg-secondary/5' : 'border-error/30 bg-error/5'} relative`}>
              <div className="absolute top-4 right-4 flex items-center gap-1">
                <span className={`material-symbols-outlined text-xl ${q.is_correct ? 'text-secondary' : 'text-error'}`}>
                  {q.is_correct ? 'check_circle' : 'cancel'}
                </span>
              </div>
              <div className="space-y-3 pr-8">
                <p className="text-xs font-bold uppercase tracking-widest opacity-60">Question {q.question_number} • {q.concept}</p>
                <p className="text-sm font-medium text-on-surface">{q.question}</p>
                
                <div className="mt-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant w-16 shrink-0 mt-1">You:</span>
                    <span className={`text-sm ${q.is_correct ? 'text-secondary' : 'text-error'} font-medium`}>{q.user_answer || '(No answer provided)'}</span>
                  </div>
                  {!q.is_correct && (
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant w-16 shrink-0 mt-1">Truth:</span>
                      <span className="text-sm text-secondary font-medium">{q.correct_answer}</span>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 pt-4 border-t border-outline-variant/10 text-sm text-on-surface-variant leading-relaxed">
                  <span className="font-bold text-primary mr-1">Tutor Insight:</span>
                  {q.explanation}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex gap-4 mt-4 w-full">
          <button onClick={onRestart} className="flex-1 py-4 bg-surface-container-highest border border-outline-variant/20 text-on-surface rounded-xl font-bold shadow-lg hover:bg-surface-variant active:scale-95 transition-all text-xs uppercase tracking-widest">
            Recustomize
          </button>
          <button onClick={onRestart} className="flex-1 py-4 rounded-xl bg-[#551a8b] text-on-white font-black shadow-lg hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-widest text-white opacity-90">
            Restart Quiz
          </button>
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
  const isInitialized = useRef(false);

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

    // Load persisted state
    const savedPhase = localStorage.getItem('quiz_phase');
    const savedQuestions = localStorage.getItem('quiz_questions');
    const savedCourseId = localStorage.getItem('quiz_selected_course');
    const savedResults = localStorage.getItem('quiz_results');

    if (savedPhase) setPhase(savedPhase);
    if (savedQuestions) setCurrentQuestions(JSON.parse(savedQuestions));
    if (savedCourseId) setSelectedCourse(savedCourseId);
    if (savedResults) setEvaluationResults(JSON.parse(savedResults));

    setTimeout(() => { isInitialized.current = true; }, 100);
  }, []);

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

  const handleStartQuiz = async (courseId, difficulty, count, quizType) => {
    setSelectedCourse(courseId);
    setIsGenerating(true);
    try {
      const response = await quizService.generate(courseId, count, difficulty.toLowerCase(), quizType);
      setCurrentQuestions(response.data.questions || response.data.quiz?.questions || []);
      setPhase('assessment');
    } catch (error) {
      alert("Failed to generate quiz. Please check you have uploaded documents.");
      setPhase('setup');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCompleteQuiz = async (userAnswersMap) => {
    setIsGenerating(true);
    try {
      // Backend evaluate_quiz expects keys to be stringified indices corresponding to the questions array
      const answersDict = {};
      currentQuestions.forEach((q, idx) => {
        answersDict[idx.toString()] = userAnswersMap[idx];
      });

      const response = await quizService.submit({
        course_id: selectedCourse,
        questions: currentQuestions,
        user_answers: answersDict
      });

      setEvaluationResults(response.data);
      setPhase('evaluation');
    } catch (error) {
      console.error("Failed to evaluate quiz", error);
      alert("Evaluation failed.");
      setPhase('setup');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAbortQuiz = () => {
    if (window.confirm("Are you sure you want to abort the current quiz? Progress will not be saved.")) {
      handleRestart();
    }
  };

  const handleRestart = () => {
    clearPersistence();
    setPhase('setup');
    setCurrentQuestions([]);
    setEvaluationResults(null);
  };

  return (
    <div className="p-4 md:p-8 min-h-screen flex flex-col items-center justify-center relative bg-background overflow-hidden">
      {isGenerating ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-primary font-bold tracking-widest uppercase animate-pulse">Forging Smart Assessment...</p>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          {phase === 'setup' && <QuizSetup key="setup" availableCourses={courses} onStart={handleStartQuiz} />}
          {phase === 'assessment' && <QuizAssessment key="assessment" questions={currentQuestions} onComplete={handleCompleteQuiz} onAbort={handleAbortQuiz} />}
          {phase === 'evaluation' && <QuizEvaluation key="evaluation" results={evaluationResults} onRestart={handleRestart} />}
        </AnimatePresence>
      )}

      <div className="fixed top-1/4 -left-32 w-96 h-96 bg-[#581c87]/10 blur-[120px] rounded-full -z-20"></div>
      <div className="fixed bottom-1/4 -right-32 w-96 h-96 bg-[#064e3b]/10 blur-[120px] rounded-full -z-20"></div>
    </div>
  );
};

export default Quiz;
