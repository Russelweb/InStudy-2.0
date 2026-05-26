import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { summaryService, documentService, statService } from '../services/api';
import { showToast } from '../components/Toast';
import { useAura, useAuraHelp } from '../context/AuraContext';
import EmptyState from '../components/EmptyState';
import ScrollToTopButton from '../components/ScrollToTopButton';

const Summary = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { triggerAura } = useAura();
  useAuraHelp('Select a course, pick a style (Short, Detailed, or Exam Ready), then click Generate Summary. You can also focus on a specific topic.');
  const urlCourseId = searchParams.get('id');

  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(urlCourseId || localStorage.getItem('activeCourse') || null);
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [style, setStyle] = useState('detailed');
  const [topic, setTopic] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

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
  }, [selectedCourse]);

  useEffect(() => {
    if (!selectedCourse) return;
    
    const fetchDocuments = async () => {
      try {
        const response = await documentService.listByCourse(selectedCourse);
        setDocuments(response.data.documents || []);
        setSelectedDocument(null);
      } catch (error) {
        console.error('Failed to fetch documents:', error);
        setDocuments([]);
      }
    };
    fetchDocuments();
  }, [selectedCourse]);

const handleGenerate = async () => {
    if (!selectedCourse) return;
    
    setIsGenerating(true);
    setProgress(0);
    
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 15, 90));
    }, 500);
    
    try {
      const response = await summaryService.generate(
        selectedCourse,
        selectedDocument,
        style,
        topic || null
      );
      
      setProgress(100);
      const result = {
        ...response.data,
        style,
        document: selectedDocument,
        courseName: courses.find(c => c.id === selectedCourse)?.name || 'Unknown Course'
      };
      // Store summary data for persistence
      const viewData = {
        ...result,
        course_id: selectedCourse
      };
      localStorage.setItem('load_asset_summary', JSON.stringify({ data: viewData, course_id: selectedCourse, title: result.courseName }));
      localStorage.setItem('summary_view_data', JSON.stringify(viewData));
      navigate('/summary-view');
      triggerAura('celebrating', `Summary ready — ${result.courseName} distilled into ${style} format.`);
    } catch (error) {
      console.error('Failed to generate summary:', error);
      const msg = error.response?.data?.detail || '';
      if (msg.includes('No documents')) {
        triggerAura('concerned', 'This course has no documents yet. Upload one in Knowledge Base first.',
          { label: 'Go to Knowledge Base', onClick: () => navigate('/knowledge') });
      } else if (msg.includes('API key') || error.response?.status === 401) {
        triggerAura('concerned', 'No API key configured. Add your Groq key in Settings.',
          { label: 'Open Settings', onClick: () => navigate('/settings') });
      } else {
        showToast('Something went wrong generating the summary. Please try again.', 'error');
      }
    } finally {
clearInterval(progressInterval);
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-background p-4 md:p-8 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="fixed top-1/4 -right-64 h-[600px] w-[600px] bg-primary/5 blur-[150px] rounded-full pointer-events-none z-0"></div>
      <div className="absolute -top-24 -left-24 h-64 w-64 bg-secondary/10 blur-[80px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Page Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter text-on-surface mb-2">
            Summary Generation
          </h1>
          <p className="text-on-surface-variant max-w-2xl leading-relaxed">
            Transform massive documents into comprehensive summaries. Select your course and course material to begin summarization.
          </p>
        </motion.header>

        {/* Selection Flow */}
        <section className="space-y-10">
          {/* Step 1: Course */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="flex items-center gap-3 mb-5">
              <span className="h-6 w-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-black shrink-0">01</span>
              <h3 className="text-sm font-black uppercase tracking-widest text-on-surface-variant">Choose Your Course</h3>
              <span className="flex-1 h-px bg-outline-variant/20"></span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
              {courses.length === 0 ? (
                <EmptyState
                  icon="auto_awesome"
                  title="No courses yet"
                  description="Create a course and upload a document before generating a summary."
                  action={{ label: 'Go to Knowledge Base', onClick: () => navigate('/knowledge') }}
                />
              ) : courses.map((course) => (
                <motion.button
                  key={course.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedCourse(course.id)}
                  className={`shrink-0 min-w-[140px] max-w-[200px] p-4 md:p-5 rounded-2xl border text-left transition-all duration-200 ${
                    selectedCourse === course.id
                      ? 'bg-secondary/10 border-secondary shadow-[0_0_20px_rgba(105,246,184,0.1)]'
                      : 'bg-surface-container-low border-outline-variant/15 hover:border-secondary/40'
                  }`}
                >
                  <span className={`material-symbols-outlined text-xl md:text-2xl mb-2 md:mb-3 block ${selectedCourse === course.id ? 'text-secondary' : 'text-on-surface-variant'}`}>biotech</span>
                  <p className={`font-bold text-xs md:text-sm truncate ${selectedCourse === course.id ? 'text-on-surface' : 'text-on-surface-variant'}`}>{course.name}</p>
                  <p className="text-[9px] md:text-[10px] text-on-surface-variant mt-1">{course.document_count} docs</p>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Step 2: Configure */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="flex items-center gap-3 mb-5">
              <span className="h-6 w-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-black shrink-0">02</span>
              <h3 className="text-sm font-black uppercase tracking-widest text-on-surface-variant">Configure Your Summary</h3>
              <span className="flex-1 h-px bg-outline-variant/20"></span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {/* Document */}
              <div className="bg-surface-container-low border border-outline-variant/15 rounded-2xl p-4 md:p-5 space-y-3 sm:col-span-1 md:col-span-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Source Document</p>
                <div className="space-y-2 max-h-40 md:max-h-48 overflow-y-auto custom-scrollbar">
                  <button
                    onClick={() => setSelectedDocument(null)}
                    className={`w-full flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-xl border text-left transition-all text-xs md:text-sm font-bold ${
                      !selectedDocument
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'border-outline-variant/10 text-on-surface-variant hover:border-primary/30'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm md:text-base">layers</span>
                    All Documents
                  </button>
                  {documents.map((doc) => (
                    <button
                      key={doc}
                      onClick={() => setSelectedDocument(selectedDocument === doc ? null : doc)}
                      className={`w-full flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-xl border text-left transition-all text-xs md:text-sm ${
                        selectedDocument === doc
                          ? 'bg-primary/10 border-primary text-primary font-bold'
                          : 'border-outline-variant/10 text-on-surface-variant hover:border-primary/30'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm md:text-base">description</span>
                      <span className="truncate">{doc}</span>
                    </button>
                  ))}
                  {documents.length === 0 && selectedCourse && (
                    <p className="text-[10px] md:text-xs text-on-surface-variant/60 italic p-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">info</span>
                      No documents in this course yet — upload one in Knowledge Base.
                    </p>
                  )}
                </div>
              </div>

              {/* Style */}
              <div className="bg-surface-container-low border border-outline-variant/15 rounded-2xl p-4 md:p-5 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Summary Style</p>
                <div className="space-y-2">
                  {[
                    { id: 'short', label: 'Short', desc: 'Key points only' },
                    { id: 'detailed', label: 'Detailed', desc: 'Full breakdown' },
                    { id: 'exam', label: 'Exam Ready', desc: 'Exam-focused' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setStyle(s.id)}
                      className={`w-full flex items-center justify-between p-2 md:p-3 rounded-xl border text-left transition-all ${
                        style === s.id
                          ? 'bg-secondary/10 border-secondary'
                          : 'border-outline-variant/10 hover:border-secondary/30'
                      }`}
                    >
                      <span className={`text-xs md:text-sm font-bold ${style === s.id ? 'text-secondary' : 'text-on-surface-variant'}`}>{s.label}</span>
                      <span className="text-[9px] md:text-[10px] text-on-surface-variant">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic */}
              <div className="flex flex-col gap-3 sm:col-span-2 md:col-span-1">
                <div className="bg-surface-container-low border border-outline-variant/15 rounded-2xl p-4 md:p-5 space-y-3 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Focus Topic <span className="font-normal">— optional</span></p>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. photosynthesis, neural networks..."
                    className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:ring-1 focus:ring-primary/50 transition-all"
                  />
                  <p className="text-[8px] md:text-[9px] text-on-surface-variant/40 italic">Leave blank to summarize all content</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Step 3: Generate */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center gap-3 mb-5">
              <span className="h-6 w-6 rounded-full bg-secondary/20 text-secondary text-xs flex items-center justify-center font-black shrink-0">03</span>
              <h3 className="text-sm font-black uppercase tracking-widest text-on-surface-variant">Generate</h3>
              <span className="flex-1 h-px bg-outline-variant/20"></span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={handleGenerate}
                disabled={!selectedCourse || isGenerating}
                className="flex-1 py-4 sm:py-5 rounded-xl sm:rounded-2xl bg-[#551a8b] text-white font-black text-xs sm:text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3"
              >
                {isGenerating ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                      className="material-symbols-outlined text-sm sm:text-base"
                    >auto_awesome</motion.span>
                    Generating...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm sm:text-base">auto_awesome</span>
                    Generate Summary
                  </>
                )}
              </button>
            </div>

            {/* Progress bar while generating */}
            {isGenerating && (
              <div className="mt-4">
                <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-primary shadow-[0_0_10px_#bd9dff] rounded-full"
                  />
                </div>
                <p className="text-[9px] sm:text-[10px] text-primary/60 font-mono tracking-widest uppercase mt-2">{Math.round(progress)}% — Extracting core concepts...</p>
              </div>
            )}
          </motion.div>
        </section>
      </div>
      <ScrollToTopButton />
    </div>
  );
};

export default Summary;