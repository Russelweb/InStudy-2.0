import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { summaryService, documentService, statService, assetService } from '../services/api';
import { InputModal } from '../components/Modal';
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
  const [topic, setTopic] = useState(''); // New: specific topic focus
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summaryData, setSummaryData] = useState(null);
  const [previousSummary, setPreviousSummary] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showMindMap, setShowMindMap] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const summaryRef = useRef(null);

  // Fetch courses and restore state
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

    // Check for loaded asset from Saved Assets page FIRST
    const loadedAsset = localStorage.getItem('load_asset_summary');
    if (loadedAsset) {
      try {
        const asset = JSON.parse(loadedAsset);
        console.log('Loading saved summary:', asset.title);
        setSummaryData(asset.data);
        setSelectedCourse(asset.course_id);
        setStyle(asset.data.style || 'detailed');
        localStorage.removeItem('load_asset_summary');
        return; // Skip restoring from session storage
      } catch (e) {
        console.error('Failed to load asset:', e);
      }
    }

    // Restore from session storage (persists across page navigation)
    const savedSummary = sessionStorage.getItem('summary_data');
    const savedCourse = sessionStorage.getItem('summary_course');
    const savedStyle = sessionStorage.getItem('summary_style');
    const savedDoc = sessionStorage.getItem('summary_document');

    if (savedSummary) {
      try {
        setSummaryData(JSON.parse(savedSummary));
      } catch (e) {
        console.error('Failed to restore summary:', e);
      }
    }
    if (savedCourse) setSelectedCourse(savedCourse);
    if (savedStyle) setStyle(savedStyle);
    if (savedDoc) setSelectedDocument(savedDoc);
  }, []);

  // Persist state to session storage whenever it changes
  useEffect(() => {
    if (summaryData) {
      sessionStorage.setItem('summary_data', JSON.stringify(summaryData));
    } else {
      sessionStorage.removeItem('summary_data');
    }
  }, [summaryData]);

  useEffect(() => {
    if (selectedCourse) {
      sessionStorage.setItem('summary_course', selectedCourse);
    }
  }, [selectedCourse]);

  useEffect(() => {
    sessionStorage.setItem('summary_style', style);
  }, [style]);

  useEffect(() => {
    if (selectedDocument) {
      sessionStorage.setItem('summary_document', selectedDocument);
    } else {
      sessionStorage.removeItem('summary_document');
    }
  }, [selectedDocument]);

  // Fetch documents when course changes
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
    
    // Save current summary before generating new one
    if (summaryData) {
      setPreviousSummary(summaryData);
    }
    
    setIsGenerating(true);
    setProgress(0);
    setSummaryData(null);
    
    // Simulate progress
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
      setSummaryData(result);
      triggerAura('celebrating', `Summary ready — ${result.courseName} distilled into ${style} format.`);
      setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
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

  const handleSave = async () => {
    if (!summaryData) return;
    setSaveModalOpen(true);
  };

  const handleSaveConfirm = async (title) => {
    setSaveModalOpen(false);
    setIsSaving(true);
    try {
      await assetService.save(
        selectedCourse,
        'summary',
        title,
        summaryData,
        { style, document: selectedDocument }
      );
      showToast('Summary saved successfully!', 'success');
    } catch (error) {
      console.error('Save failed:', error);
      showToast('Failed to save summary. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    if (!summaryData) return;
    
    const text = `${summaryData.courseName} - Summary\n${'='.repeat(50)}\n\nStyle: ${summaryData.style}\n${summaryData.document ? `Document: ${summaryData.document}\n` : ''}\n${'='.repeat(50)}\n\n${summaryData.summary}\n\n${summaryData.mind_map ? `\nConceptual Map:\n${summaryData.mind_map}` : ''}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Summary_${summaryData.courseName}_${style}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    if (!summaryData) return;
    const text = `${summaryData.courseName} - Summary\n\n${summaryData.summary.substring(0, 200)}...`;
    if (navigator.share) {
      navigator.share({ title: `${summaryData.courseName} - Summary`, text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Summary copied to clipboard!', 'success');
      });
    }
  };

  const handleClear = () => {
    setSummaryData(null);
    setPreviousSummary(null);
    sessionStorage.removeItem('summary_data');
  };

  const currentCourse = courses.find(c => c.id === selectedCourse);

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
                  className={`shrink-0 min-w-[160px] p-5 rounded-2xl border text-left transition-all duration-200 ${
                    selectedCourse === course.id
                      ? 'bg-secondary/10 border-secondary shadow-[0_0_20px_rgba(105,246,184,0.1)]'
                      : 'bg-surface-container-low border-outline-variant/15 hover:border-secondary/40'
                  }`}
                >
                  <span className={`material-symbols-outlined text-2xl mb-3 block ${selectedCourse === course.id ? 'text-secondary' : 'text-on-surface-variant'}`}>biotech</span>
                  <p className={`font-bold text-sm truncate ${selectedCourse === course.id ? 'text-on-surface' : 'text-on-surface-variant'}`}>{course.name}</p>
                  <p className="text-[10px] text-on-surface-variant mt-1">{course.document_count} docs</p>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Document */}
              <div className="bg-surface-container-low border border-outline-variant/15 rounded-2xl p-5 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Source Document</p>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  <button
                    onClick={() => setSelectedDocument(null)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all text-sm font-bold ${
                      !selectedDocument
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'border-outline-variant/10 text-on-surface-variant hover:border-primary/30'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">layers</span>
                    All Documents
                  </button>
                  {documents.map((doc) => (
                    <button
                      key={doc}
                      onClick={() => setSelectedDocument(selectedDocument === doc ? null : doc)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all text-sm ${
                        selectedDocument === doc
                          ? 'bg-primary/10 border-primary text-primary font-bold'
                          : 'border-outline-variant/10 text-on-surface-variant hover:border-primary/30'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">description</span>
                      <span className="truncate">{doc}</span>
                    </button>
                  ))}
                  {documents.length === 0 && selectedCourse && (
                    <p className="text-xs text-on-surface-variant/60 italic p-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">info</span>
                      No documents in this course yet — upload one in Knowledge Base.
                    </p>
                  )}
                </div>
              </div>

              {/* Style */}
              <div className="bg-surface-container-low border border-outline-variant/15 rounded-2xl p-5 space-y-3">
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
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                        style === s.id
                          ? 'bg-secondary/10 border-secondary'
                          : 'border-outline-variant/10 hover:border-secondary/30'
                      }`}
                    >
                      <span className={`text-sm font-bold ${style === s.id ? 'text-secondary' : 'text-on-surface-variant'}`}>{s.label}</span>
                      <span className="text-[10px] text-on-surface-variant">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic + Generate */}
              <div className="flex flex-col gap-4">
                <div className="bg-surface-container-low border border-outline-variant/15 rounded-2xl p-5 space-y-3 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Focus Topic <span className="font-normal">— optional</span></p>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. photosynthesis, neural networks..."
                    className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl py-3 px-4 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:ring-1 focus:ring-primary/50 transition-all"
                  />
                  <p className="text-[9px] text-on-surface-variant/40 italic">Leave blank to summarize all content</p>
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
              {summaryData && (
                <span className="text-xs text-secondary font-bold uppercase tracking-widest flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Summary Ready
                </span>
              )}
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleGenerate}
                disabled={!selectedCourse || isGenerating}
                className="flex-1 py-5 rounded-2xl bg-[#551a8b] text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {isGenerating ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                      className="material-symbols-outlined"
                    >auto_awesome</motion.span>
                    Generating...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">auto_awesome</span>
                    Generate Summary
                  </>
                )}
              </button>
              {summaryData && (
                <button
                  onClick={handleClear}
                  className="px-6 py-5 rounded-2xl bg-error-container/10 border border-error-dim/20 text-error-dim font-bold text-xs uppercase tracking-widest hover:bg-error-container/20 transition-all"
                >
                  Clear
                </button>
              )}
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
                <p className="text-[10px] text-primary/60 font-mono tracking-widest uppercase mt-2">{Math.round(progress)}% — Extracting core concepts...</p>
              </div>
            )}
          </motion.div>

          {/* Summary Output Section */}
          <AnimatePresence>
            {summaryData && (
              <motion.div
                ref={summaryRef}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                className="mt-20"
              >
                <div className="glass-card rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 md:p-10 border border-primary/15 relative overflow-hidden shadow-[0px_40px_80px_rgba(0,0,0,0.5)]">
                  {/* Accent light */}
                  <div className="absolute -top-24 -right-24 h-64 w-64 bg-secondary/10 blur-[80px] rounded-full"></div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-secondary text-xs font-bold uppercase tracking-[0.2em] mb-2">
                        <span className="material-symbols-outlined text-sm">verified</span>
                        Verified Analysis
                      </div>
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-on-surface">
                        {summaryData.courseName} - Course
                      </h2>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (confirm('Generate a new summary? Current summary will be saved in history.')) {
                            handleGenerate();
                          }
                        }}
                        className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">refresh</span>
                        Regenerate
                      </button>
                      <button
                        onClick={handleExport}
                        className="p-3 bg-surface-container-highest rounded-xl text-on-surface-variant hover:text-on-surface transition-colors border border-outline-variant/15"
                        title="Download as text file"
                      >
                        <span className="material-symbols-outlined">download</span>
                      </button>
                      <button
                        onClick={handleShare}
                        className="p-3 bg-surface-container-highest rounded-xl text-on-surface-variant hover:text-on-surface transition-colors border border-outline-variant/15"
                        title="Share summary"
                      >
                        <span className="material-symbols-outlined">share</span>
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="p-3 bg-surface-container-highest rounded-xl text-on-surface-variant hover:text-on-surface transition-colors border border-outline-variant/15 disabled:opacity-50"
                        title="Save to assets"
                      >
                        <span className="material-symbols-outlined">save</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6 md:gap-12">
                    <div className="md:col-span-2 space-y-8">
                      <div>
                        <h5 className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-4 border-b border-outline-variant/10 pb-2">
                          Core Concept
                        </h5>
                        <div className="ai-content text-on-surface text-base prose prose-invert max-w-none prose-headings:text-on-surface prose-p:text-on-surface-variant prose-strong:text-on-surface prose-ul:text-on-surface-variant prose-ol:text-on-surface-variant prose-li:text-on-surface-variant">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {summaryData.summary}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-8">
                      <div>
                        <h5 className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-4 border-b border-outline-variant/10 pb-2">
                          Summary Metadata
                        </h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-on-surface-variant">Style:</span>
                            <span className="text-on-surface font-bold capitalize">{summaryData.style}</span>
                          </div>
                          {summaryData.document && (
                            <div className="flex justify-between">
                              <span className="text-on-surface-variant">Document:</span>
                              <span className="text-on-surface font-bold text-xs">{summaryData.document}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-surface-container-highest/50 p-6 rounded-2xl border border-outline-variant/10">
                        <h6 className="text-xs font-bold text-on-surface mb-3">Suggested Study Paths</h6>
                        <div className="space-y-4">
                          <div 
                            onClick={() => navigate(`/flashcards?id=${selectedCourse}`)}
                            className="flex items-center gap-3 cursor-pointer group"
                          >
                            <div className="h-8 w-8 rounded-lg bg-surface-container-highest flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                              <span className="material-symbols-outlined text-sm text-secondary">flash_on</span>
                            </div>
                            <span className="text-[11px] font-medium text-on-surface-variant group-hover:text-on-surface transition-colors">
                              Generate Flashcards
                            </span>
                          </div>
                          <div 
                            onClick={() => navigate(`/quiz?id=${selectedCourse}`)}
                            className="flex items-center gap-3 cursor-pointer group"
                          >
                            <div className="h-8 w-8 rounded-lg bg-surface-container-highest flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                              <span className="material-symbols-outlined text-sm text-secondary">quiz</span>
                            </div>
                            <span className="text-[11px] font-medium text-on-surface-variant group-hover:text-on-surface transition-colors">
                              Take a Quiz
                            </span>
                          </div>
                          <div 
                            onClick={() => navigate(`/ai-tutor?id=${selectedCourse}`)}
                            className="flex items-center gap-3 cursor-pointer group"
                          >
                            <div className="h-8 w-8 rounded-lg bg-surface-container-highest flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                              <span className="material-symbols-outlined text-sm text-secondary">smart_toy</span>
                            </div>
                            <span className="text-[11px] font-medium text-on-surface-variant group-hover:text-on-surface transition-colors">
                              Ask AI Tutor
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mind Map Section */}
                  {!summaryData.mind_map && (
                    <div className="mt-12 pt-8 border-t border-outline-variant/10">
                      <div className="flex items-center justify-between mb-6">
                        <h5 className="text-on-surface-variant text-xs font-bold uppercase tracking-widest">
                          Conceptual Trace Map
                        </h5>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowMindMap(!showMindMap)}
                            className="text-xs text-primary hover:text-secondary transition-colors flex items-center gap-1 px-3 py-2 bg-primary/10 rounded-lg"
                          >
                            <span className="material-symbols-outlined text-sm">
                              {showMindMap ? 'visibility_off' : 'visibility'}
                            </span>
                            {showMindMap ? 'Hide' : 'Show'} Graph
                          </button>
                          <button
                            onClick={() => {
                              const blob = new Blob([summaryData.mind_map], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `mindmap_${Date.now()}.dot`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            className="text-xs text-primary hover:text-secondary transition-colors flex items-center gap-1 px-3 py-2 bg-surface-container-highest rounded-lg border border-outline-variant/15"
                          >
                            <span className="material-symbols-outlined text-sm">download</span>
                            Export DOT
                          </button>
                          <button
                            onClick={() => {
                              window.open(`https://dreampuf.github.io/GraphvizOnline/#${encodeURIComponent(summaryData.mind_map)}`, '_blank');
                            }}
                            className="text-xs text-secondary hover:text-primary transition-colors flex items-center gap-1 px-3 py-2 bg-secondary/10 rounded-lg border border-secondary/20"
                          >
                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                            Visualize Online
                          </button>
                        </div>
                      </div>
                      
                      {showMindMap && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mb-4"
                        >
                          <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10">
                            <iframe
                              src={`https://dreampuf.github.io/GraphvizOnline/#${encodeURIComponent(summaryData.mind_map)}`}
                              className="w-full h-[500px] rounded-lg border border-outline-variant/10"
                              title="Mind Map Visualization"
                            />
                          </div>
                        </motion.div>
                      )}
                      
{/*                       <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10 overflow-x-auto"> */}
{/*                         <div className="flex items-center justify-between mb-3"> */}
{/*                           <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold"> */}
{/*                             DOT Source Code */}
{/*                           </span> */}
{/*                           <button */}
{/*                             onClick={() => { */}
{/*                               navigator.clipboard.writeText(summaryData.mind_map); */}
{/*                               alert('Mind map code copied to clipboard!'); */}
{/*                             }} */}
{/*                             className="text-[10px] text-primary hover:text-secondary transition-colors flex items-center gap-1" */}
{/*                           > */}
{/*                             <span className="material-symbols-outlined text-xs">content_copy</span> */}
{/*                             Copy */}
{/*                           </button> */}
{/*                         </div> */}
{/*                         <pre className="text-xs text-on-surface-variant font-mono whitespace-pre-wrap"> */}
{/*                           {summaryData.mind_map} */}
{/*                         </pre> */}
{/*                       </div> */}
{/*                       <div className="mt-3 flex items-start gap-2 text-[10px] text-on-surface-variant/60 italic"> */}
{/*                         <span className="material-symbols-outlined text-sm text-primary/40">info</span> */}
{/*                         <p> */}
{/*                           This Graphviz DOT format can be visualized using the "Visualize Online" button above,  */}
{/*                           or with local tools like Graphviz, VS Code extensions, or online editors. */}
{/*                         </p> */}
{/*                       </div> */}
                    </div>
                  )} 
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
      <ScrollToTopButton />

      {/* Save summary modal */}
      <InputModal
        open={saveModalOpen}
        title="Save Summary"
        description="Give this summary a name so you can find it later in Saved Assets."
        placeholder="e.g. Chapter 5 — Nervous System"
        confirmLabel="Save Summary"
        onConfirm={handleSaveConfirm}
        onCancel={() => setSaveModalOpen(false)}
      />
    </div>
  );
};

export default Summary;
