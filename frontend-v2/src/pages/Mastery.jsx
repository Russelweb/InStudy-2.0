import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { masteryService, statService } from '../services/api';
import ScrollToTopButton from '../components/ScrollToTopButton';

const Mastery = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlCourseId = searchParams.get('id');

  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(urlCourseId || localStorage.getItem('activeCourse') || null);
  const [masteryProfile, setMasteryProfile] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const statsRef = useRef(null);
  const [overallMastery, setOverallMastery] = useState(0);
  const [chartData, setChartData] = useState([]);
  const [staleConcepts, setStaleConcepts] = useState([]);
  const [reviewSchedule, setReviewSchedule] = useState(null);
  const [stats, setStats] = useState(null);
  // Fetch courses
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await statService.getCourses();
        const courseList = response.data.courses || [];
        setCourses(courseList);
        
        if (courseList.length > 0 && !selectedCourse) {
          const id = courseList[0].id;
          setSelectedCourse(id);
          localStorage.setItem('activeCourse', id);
        }
      } catch (error) {
        console.error('Failed to fetch courses:', error);
      }
    };
    fetchCourses();
  }, []);

  // Fetch mastery profile when course changes
  useEffect(() => {
    if (!selectedCourse) return;
    
    const fetchMasteryProfile = async () => {
      setIsLoading(true);
      try {
        const response = await masteryService.getProfile(selectedCourse);
        const profile = response.data.profile || [];
        setMasteryProfile(profile);
        
        // Calculate overall mastery
        if (profile.length > 0) {
          const avgScore = profile.reduce((sum, item) => {
            // Map familiarity: -1 -> 0%, 0 -> 50%, 1 -> 100%
            const percentage = (item.familiarity_score + 1) * 50;
            return sum + percentage;
          }, 0) / profile.length;
          setOverallMastery(Math.round(avgScore));
        } else {
          setOverallMastery(0);
        }
        
        // Fetch real historical data
        await fetchHistoricalData(selectedCourse);
        
        // Fetch stale concepts
        await fetchStaleConcepts(selectedCourse);
        
        // Fetch review schedule
        await fetchReviewSchedule(selectedCourse);
        
        // Fetch stats
        await fetchStats(selectedCourse);
      } catch (error) {
        console.error('Failed to fetch mastery profile:', error);
        setMasteryProfile([]);
        setOverallMastery(0);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMasteryProfile();
  }, [selectedCourse]);

  const fetchHistoricalData = async (courseId) => {
    try {
      const response = await masteryService.getHistory(courseId, 30);
      const history = response.data.history || [];
      
      if (history.length > 0) {
        // Transform backend data to chart format
        const chartData = history.map(item => ({
          date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          mastery: Math.round(item.avg_mastery || 0)
        }));
        setChartData(chartData);
      } else {
        // No historical data yet, show current state
        setChartData([{
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          mastery: overallMastery
        }]);
      }
    } catch (error) {
      console.error('Failed to fetch mastery history:', error);
      // Fallback to empty chart
      setChartData([]);
    }
  };

  const fetchStaleConcepts = async (courseId) => {
    try {
      const response = await masteryService.getStale(courseId, 14);
      setStaleConcepts(response.data.stale_concepts || []);
    } catch (error) {
      console.error('Failed to fetch stale concepts:', error);
      setStaleConcepts([]);
    }
  };

  const fetchReviewSchedule = async (courseId) => {
    try {
      const response = await masteryService.getReviewSchedule(courseId);
      setReviewSchedule(response.data.schedule || null);
    } catch (error) {
      console.error('Failed to fetch review schedule:', error);
      setReviewSchedule(null);
    }
  };

  const fetchStats = async (courseId) => {
    try {
      const response = await masteryService.getStats(courseId);
      setStats(response.data.stats || null);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setStats(null);
    }
  };

  const getCategorizedConcepts = () => {
    // Use more nuanced thresholds based on continuous scores
    const unfamiliar = masteryProfile.filter(item => item.familiarity_score < -0.3);
    const familiar = masteryProfile.filter(item => item.familiarity_score >= -0.3 && item.familiarity_score <= 0.5);
    const mastered = masteryProfile.filter(item => item.familiarity_score > 0.5);
    
    return { unfamiliar, familiar, mastered };
  };

  const getConceptPercentage = (familiarityScore) => {
    return (familiarityScore + 1) * 50;
  };

  const handleCourseSelect = (courseId) => {
    setSelectedCourse(courseId);
    localStorage.setItem('activeCourse', courseId);
    navigate(`/mastery?id=${courseId}`);
    setTimeout(() => statsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  };

  const currentCourse = courses.find(c => c.id === selectedCourse);
  const { unfamiliar, familiar, mastered } = getCategorizedConcepts();

  // Sort concepts by interaction count for topic breakdown
  const topConcepts = [...masteryProfile]
    .sort((a, b) => b.interaction_count - a.interaction_count)
    .slice(0, 6);

  return (
    <div className="flex-1 min-h-screen bg-background p-4 md:p-10 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="fixed top-1/4 -right-64 h-[600px] w-[600px] bg-primary/5 blur-[150px] rounded-full pointer-events-none z-0"></div>

      <div className="max-w-[1600px] mx-auto relative z-10 space-y-12">
        {/* Hero Header Section */}
        <motion.section
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-end gap-6"
        >
          <div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-black tracking-[-0.04em] text-on-surface">
              Learning Mastery
            </h2>
            <p className="text-on-surface-variant mt-2 max-w-md leading-relaxed">
              Your mastery progress across all your created courses.
            </p>
          </div>
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-4 px-8 py-4 bg-secondary/10 border border-secondary/20 rounded-full shadow-[0px_0px_30px_rgba(105,246,184,0.1)]"
          >
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-widest text-secondary font-bold">
                Overall Mastery
              </span>
              <span className="text-2xl sm:text-3xl font-black text-secondary">{overallMastery}%</span>
            </div>
            <div className="h-10 w-10 bg-secondary rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-background font-bold">bolt</span>
            </div>
          </motion.div>
        </motion.section>

        {/* Course Grid */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8"
        >
          {courses.map((course, index) => {
            const isSelected = course.id === selectedCourse;
            const masteryPercent = course.mastery || 0;
            const circumference = 2 * Math.PI * 28;
            const offset = circumference - (masteryPercent / 100) * circumference;
            
            return (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleCourseSelect(course.id)}
                className={`group relative bg-surface-container-low p-6 rounded-xl border transition-all duration-300 cursor-pointer ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-[0px_0px_30px_rgba(189,157,255,0.1)]'
                    : 'border-outline-variant/15 hover:border-white/20'
                }`}
              >
                {isSelected && (
                  <div className="absolute -top-3 -right-3 h-6 w-6 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/40">
                    <span className="material-symbols-outlined text-[14px] text-on-primary font-bold">
                      check
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1">
                    <span className="text-xs text-secondary font-mono tracking-widest uppercase">
                      Research {String.fromCharCode(65 + index)}
                    </span>
                    <h3 className="text-2xl font-bold text-on-surface">{course.name}</h3>
                  </div>
                  
                  <div className="relative w-16 h-16">
                    <svg className="w-full h-full -rotate-90">
                      <circle
                        className="text-surface-variant"
                        cx="32"
                        cy="32"
                        fill="transparent"
                        r="28"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <circle
                        className="text-primary transition-all duration-500"
                        cx="32"
                        cy="32"
                        fill="transparent"
                        r="28"
                        stroke="currentColor"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeWidth="4"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                      {masteryPercent}%
                    </span>
                  </div>
                </div>
                
                <div className="mt-auto pt-6 border-t border-white/5 flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant italic">
                    {course.document_count} documents
                  </span>
                  {isSelected ? (
                    <span className="text-primary text-[10px] font-semibold uppercase tracking-wider">
                      Active Course
                    </span>
                  ) : (
                    <span className="text-zinc-500 hover:text-primary text-sm font-semibold transition-colors">
                      Select Course
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.section>

        {/* Course Specific Data Header */}
        {selectedCourse && currentCourse && (
          <>
            <div className="flex items-center gap-4 pt-4">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></span>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/50">
                Course mastery Details for {currentCourse.name}
              </span>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></span>
            </div>

            {/* Reset Progress Row */}
            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (window.confirm(`Are you absolutely sure you want to reset all mastery progress for "${currentCourse.name}"? This will delete all your learning history and cannot be undone.`)) {
                    masteryService.reset(selectedCourse)
                      .then(() => {
                        // Refresh data
                        window.location.reload();
                      })
                      .catch(err => alert('Failed to reset progress: ' + err.message));
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-error hover:bg-error/10 border border-error/20 rounded-lg transition-all"
              >
                <span className="material-symbols-outlined text-sm">restart_alt</span>
                Reset Course Progress
              </button>
            </div>

            {/* Neural Concept Status Section */}
            <motion.section
              ref={statsRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-6"
            >
              <h3 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">hub</span>
                Course Concept Status
              </h3>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
                    <p className="text-on-surface-variant text-sm">Loading mastery data...</p>
                  </div>
                </div>
              ) : masteryProfile.length === 0 ? (
                <div className="bg-surface-container-low p-12 rounded-xl border border-outline-variant/15 text-center">
                  <span className="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-4">
                    psychology
                  </span>
                  <h4 className="text-lg font-bold text-on-surface mb-2">No Mastery Data Yet</h4>
                  < p className="text-on-surface-variant mb-6">
                    Start learning by generating flashcards or taking quizzes to build your mastery profile.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => navigate(`/flashcards?id=${selectedCourse}`)}
                      className="px-6 py-3 bg-primary/10 text-primary border border-primary/20 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary/20 transition-all"
                    >
                      Generate Flashcards
                    </button>
                    <button
                      onClick={() => navigate(`/quiz?id=${selectedCourse}`)}
                      className="px-6 py-3 bg-secondary/10 text-secondary border border-secondary/20 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-secondary/20 transition-all"
                    >
                      Take Quiz
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                  {/* Unfamiliar */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-error-container/5 border border-error-dim/20 p-5 rounded-xl"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2 h-2 rounded-full bg-error-dim animate-pulse"></div>
                      <span className="text-xs font-bold text-error uppercase tracking-widest">
                        Unfamiliar
                      </span>
                      <span className="ml-auto text-xs text-error-dim font-mono">
                        {unfamiliar.length}
                      </span>
                    </div>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {unfamiliar.length === 0 ? (
                        <p className="text-xs text-on-surface-variant italic">No weak concepts</p>
                      ) : (
                        unfamiliar.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center p-3 glass border border-outline-variant/10 rounded-lg"
                          >
                            <span className="text-sm font-medium truncate">{item.concept_id}</span>
                            <span className="text-xs text-error font-mono">
                              {getConceptPercentage(item.familiarity_score)}%
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>

                  {/* Familiar */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-primary/5 border border-primary/20 p-5 rounded-xl"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <span className="text-xs font-bold text-primary uppercase tracking-widest">
                        Familiar
                      </span>
                      <span className="ml-auto text-xs text-primary font-mono">
                        {familiar.length}
                      </span>
                    </div>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {familiar.length === 0 ? (
                        <p className="text-xs text-on-surface-variant italic">No familiar concepts</p>
                      ) : (
                        familiar.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center p-3 glass border border-outline-variant/10 rounded-lg"
                          >
                            <span className="text-sm font-medium truncate">{item.concept_id}</span>
                            <span className="text-xs text-primary font-mono">
                              {getConceptPercentage(item.familiarity_score)}%
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>

                  {/* Mastered */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                    className="bg-secondary/5 border border-secondary/20 p-5 rounded-xl"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2 h-2 rounded-full bg-secondary"></div>
                      <span className="text-xs font-bold text-secondary uppercase tracking-widest">
                        Mastered
                      </span>
                      <span className="ml-auto text-xs text-secondary font-mono">
                        {mastered.length}
                      </span>
                    </div>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {mastered.length === 0 ? (
                        <p className="text-xs text-on-surface-variant italic">No mastered concepts yet</p>
                      ) : (
                        mastered.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center p-3 glass border border-outline-variant/10 rounded-lg"
                          >
                            <span className="text-sm font-medium truncate">{item.concept_id}</span>
                            <span className="text-xs text-secondary font-mono">
                              {getConceptPercentage(item.familiarity_score)}%
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.section>

            {/* Two-Column Layout */}
            {masteryProfile.length > 0 && (
              <>
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="grid grid-cols-1 lg:grid-cols-10 gap-8"
                >
                  {/* Topic Breakdown */}
                  <div className="lg:col-span-6 bg-surface-container-low p-8 rounded-xl border border-outline-variant/15 shadow-[0px_20px_40px_rgba(189,157,255,0.02)]">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-xl font-extrabold tracking-tight">Topic Breakdown</h3>
                      <div className="flex items-center gap-2 text-on-surface-variant text-sm">
                        <span>Selected:</span>
                        <span className="text-primary font-bold">{currentCourse.name}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-8">
                      {topConcepts.map((concept, idx) => {
                        const percentage = getConceptPercentage(concept.familiarity_score);
                        const confidence = concept.confidence_score || 0;
                        const color = percentage >= 75 ? 'secondary' : percentage >= 50 ? 'primary' : 'error-dim';
                        
                        return (
                          <div key={idx} className="space-y-3">
                            <div className="flex justify-between items-center text-sm font-medium">
                              <div className="flex items-center gap-2">
                                <span className="text-on-surface truncate">{concept.concept_id}</span>
                                {confidence > 0 && (
                                  <span 
                                    className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant"
                                    title={`Confidence: ${Math.round(confidence * 100)}%`}
                                  >
                                    {Math.round(confidence * 100)}% confident
                                  </span>
                                )}
                              </div>
                              <span className={`text-${color}`}>{percentage}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 1, delay: 0.1 * idx }}
                                className={`h-full bg-${color}`}
                                style={{
                                  backgroundColor: percentage >= 75 ? '#69f6b8' : percentage >= 50 ? '#bd9dff' : '#d73357'
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* AI Attention */}
                  <div className="lg:col-span-4 flex flex-col">
                    <div className="bg-error-container/10 border border-error-dim/30 p-8 rounded-xl flex-1 shadow-[0px_0px_50px_rgba(215,51,87,0.05)]">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-full bg-error-dim/20 flex items-center justify-center text-error">
                          <span className="material-symbols-outlined">warning</span>
                        </div>
                        <h3 className="text-xl font-extrabold text-on-surface">AI Attention Needed</h3>
                      </div>
                      
                      {unfamiliar.length === 0 ? (
                        <div className="text-center py-8">
                          <span className="material-symbols-outlined text-6xl text-secondary/20 mb-4">
                            check_circle
                          </span>
                          <p className="text-sm text-on-surface-variant">
                            Great job! No critical gaps detected.
                          </p>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-on-surface-variant mb-8 leading-relaxed">
                            Critical mastery gaps detected in <strong>{currentCourse.name}</strong> foundational modules. 
                            Immediate intervention recommended.
                          </p>
                          
                          <ul className="space-y-4 mb-10">
                            {unfamiliar.slice(0, 3).map((item, idx) => (
                              <li
                                key={idx}
                                className="flex items-center gap-3 p-3 bg-error-dim/5 rounded-lg border-l-2 border-error-dim"
                              >
                                <span className="text-sm font-bold text-on-surface truncate flex-1">
                                  {item.concept_id}
                                </span>
                                <span className="text-xs font-mono text-error">
                                  {getConceptPercentage(item.familiarity_score)}%
                                </span>
                              </li>
                            ))}
                          </ul>
                          
                          <button
                            onClick={() => navigate(`/flashcards?id=${selectedCourse}`)}
                            className="w-full bg-primary text-on-primary py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-primary-fixed transition-colors shadow-lg shadow-primary/20"
                          >
                            Address weak areas now
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.section>

                {/* Stale Concepts Section */}
                {staleConcepts.length > 0 && (
                  <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.75 }}
                    className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/15"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="material-symbols-outlined text-primary">schedule</span>
                        </div>
                        <div>
                          <h3 className="text-xl font-extrabold tracking-tight">Concepts Needing Review</h3>
                          <p className="text-xs text-on-surface-variant">
                            Haven't been studied in 14+ days - forgetting curve applied
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-primary font-mono">
                        {staleConcepts.length} concepts
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {staleConcepts.slice(0, 6).map((concept, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.8 + idx * 0.05 }}
                          className="p-4 bg-surface-container-highest rounded-lg border border-outline-variant/10"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-bold text-on-surface truncate flex-1">
                              {concept.concept_id}
                            </span>
                            <span className="text-xs text-on-surface-variant ml-2">
                              {concept.days_since_update}d ago
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-on-surface-variant">Was:</span>
                            <span className="text-primary font-mono">
                              {Math.round((concept.familiarity_score + 1) * 50)}%
                            </span>
                            <span className="text-on-surface-variant">→</span>
                            <span className="text-error-dim font-mono">
                              {Math.round((concept.predicted_current_score + 1) * 50)}%
                            </span>
                            <span className="text-error-dim">
                              (↓{Math.abs(Math.round(concept.decay_amount * 50))}%)
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    
                    {staleConcepts.length > 6 && (
                      <p className="text-xs text-on-surface-variant text-center mt-4">
                        + {staleConcepts.length - 6} more concepts need review
                      </p>
                    )}
                  </motion.section>
                )}
              </>
            )}

            {/* Mastery Growth Chart */}
            {masteryProfile.length > 0 && chartData.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="bg-surface-container-low p-8 rounded-xl overflow-hidden relative border border-outline-variant/15"
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6 sm:mb-10">
                  <div>
                    <h3 className="text-xl font-extrabold tracking-tight">
                      Mastery Growth: <span className="text-primary">{currentCourse.name}</span>
                    </h3>
                    <p className="text-sm text-on-surface-variant mt-1">
                      Curve describing periodic growth in this course over time.
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <button className="px-4 py-2 text-xs font-bold text-primary bg-primary/10 rounded-lg">
                      30 Days
                    </button>
{/*                     <button className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors"> */}
{/*                       90 Days */}
{/*                     </button> */}
                  </div>
                </div>
                
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="masteryGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#bd9dff" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#bd9dff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis
                        dataKey="date"
                        stroke="rgba(255,255,255,0.2)"
                        tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                      />
                      <YAxis
                        stroke="rgba(255,255,255,0.2)"
                        tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#141b16',
                          border: '1px solid rgba(189,157,255,0.2)',
                          borderRadius: '8px',
                          color: '#f8fef6'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="mastery"
                        stroke="#bd9dff"
                        strokeWidth={3}
                        fill="url(#masteryGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.section>
            )}
          </>
        )}
      </div>
      <ScrollToTopButton />
    </div>
  );
};

export default Mastery;
