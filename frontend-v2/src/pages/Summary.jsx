import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { summaryService, documentService, statService, assetService } from '../services/api';
import ScrollToTopButton from '../components/ScrollToTopButton';

const Summary = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
      setSummaryData({
        ...response.data,
        style,
        document: selectedDocument,
        courseName: courses.find(c => c.id === selectedCourse)?.name || 'Unknown Course'
      });
      // Scroll to summary result
      setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (error) {
      console.error('Failed to generate summary:', error);
      const msg = error.response?.data?.detail || '';
      if (msg.includes('No documents')) {
        alert('📂 No documents found in this course.\n\nGo to Knowledge Base → select this course → upload a PDF or document first.');
      } else if (msg.includes('API key') || error.response?.status === 401) {
        alert('🔑 No AI key configured.\n\nGo to Settings and paste your Groq API key to enable AI features.');
      } else {
        alert('Something went wrong generating the summary. Please try again.');
      }
    } finally {
      clearInterval(progressInterval);
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!summaryData) return;
    
    const title = prompt('Name this summary:');
    if (!title) return;
    
    setIsSaving(true);
    try {
      await assetService.save(
        selectedCourse,
        'summary',
        title,
        summaryData,
        { style, document: selectedDocument }
      );
      alert('✅ Summary saved successfully!');
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save summary. Please try again.');
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
      navigator.share({
        title: `${summaryData.courseName} - Summary`,
        text: text,
      }).catch(() => {});
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(text).then(() => {
        alert('Summary copied to clipboard!');
      });
    }
  };

  const handleClear = () => {
    if (confirm('Clear the current summary? This cannot be undone.')) {
      setSummaryData(null);
      setPreviousSummary(null);
      sessionStorage.removeItem('summary_data');
    }
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
        <section className="space-y-12">
          {/* Step 1: Select Neural Circuit */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <span className="h-6 w-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">
                01
              </span>
              <h3 className="text-lg font-bold tracking-tight">Select Course</h3>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {courses.map((course) => (
                <motion.div
                  key={course.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedCourse(course.id)}
                  className={`w-full sm:min-w-[200px] glass-card p-4 sm:p-6 rounded-2xl border cursor-pointer group transition-all duration-300 ${
                    selectedCourse === course.id
                      ? 'border-secondary/40 ring-2 ring-secondary/20 shadow-[0px_0px_30px_rgba(105,246,184,0.05)]'
                      : 'border-outline-variant/15 hover:border-primary/40'
                  }`}
                >
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${
                    selectedCourse === course.id ? 'bg-secondary/10' : 'bg-surface-container-highest'
                  }`}>
                    <span className={`material-symbols-outlined ${
                      selectedCourse === course.id ? 'text-secondary' : 'text-on-surface-variant'
                    }`}>
                      biotech
                    </span>
                  </div>
                  <p className={`font-bold ${
                    selectedCourse === course.id ? 'text-on-surface' : 'text-on-surface-variant group-hover:text-on-surface'
                  } transition-colors`}>
                    {course.name}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    {course.document_count} Documents
                  </p>
                  {selectedCourse === course.id && (
                    <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-secondary animate-pulse"></div>
                  )}
                </motion.div>
              ))}
              
              {courses.length === 0 && (
                <div className="w-full sm:min-w-[200px] glass-card p-4 sm:p-6 rounded-2xl border border-outline-variant/15 text-center">
                  <p className="text-on-surface-variant text-sm">No courses found. Upload documents first.</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Step 2: Select Source Material & Generate */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8"
          >
            {/* Left: Configuration */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="h-6 w-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">
                  02
                </span>
                <h3 className="text-lg font-bold tracking-tight">Select Course Material</h3>
                {summaryData && (
                  <span className="ml-auto text-xs text-secondary font-bold uppercase tracking-widest flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Summary Ready
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {/* Document Selection */}
                {documents.map((doc) => (
                  <motion.div
                    key={doc}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => setSelectedDocument(selectedDocument === doc ? null : doc)}
                    className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedDocument === doc
                        ? 'bg-surface-container-low border-primary/30'
                        : 'bg-surface-container-lowest border-outline-variant/10 hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        selectedDocument === doc ? 'bg-primary/10' : 'bg-surface-variant'
                      }`}>
                        <span className={`material-symbols-outlined ${
                          selectedDocument === doc ? 'text-primary' : 'text-on-surface-variant'
                        }`}>
                          description
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-on-surface">{doc}</p>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-tighter">
                          Document
                        </p>
                      </div>
                    </div>
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                      selectedDocument === doc ? 'border-primary/40' : 'border-outline-variant/20'
                    }`}>
                      {selectedDocument === doc && (
                        <div className="h-2.5 w-2.5 rounded-full bg-primary"></div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {documents.length === 0 && selectedCourse && (
                  <div className="p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/10 text-center">
                    <p className="text-on-surface-variant text-sm">No documents in this course yet.</p>
                  </div>
                )}

                {/* Style Selection */}
                <div className="pt-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3 block">
                    Summary Style
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['short', 'detailed', 'exam'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setStyle(s)}
                        className={`py-3 rounded-xl border text-xs font-bold capitalize transition-all ${
                          style === s
                            ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(189,157,255,0.2)]'
                            : 'border-outline-variant/20 text-on-surface/60 hover:bg-white/5'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Topic Focus */}
                <div className="pt-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3 block">
                    Specific Topic (Optional)
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., k-nearest neighbors, photosynthesis, etc."
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl py-3 px-4 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary/50 transition-all"
                  />
                  <p className="text-[9px] text-on-surface-variant/60 italic mt-2">Leave blank to summarize all course content</p>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!selectedCourse || isGenerating}
                className="w-full mt-6 py-5 bg-[#551a8b] rounded-2xl font-black text-on-white opacity-90 uppercase tracking-widest glow-purple group transition-all duration-500 overflow-hidden relative disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                    auto_awesome
                  </span>
                  {isGenerating ? 'Synthesizing...' : 'Synthesize Summary'}
                </span>
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>

              {summaryData && (
                <button
                  onClick={handleClear}
                  className="w-full mt-3 py-3 bg-error-container/10 border border-error-dim/20 rounded-xl text-error-dim font-bold text-xs uppercase tracking-widest hover:bg-error-container/20 transition-all"
                >
                  Clear Summary
                </button>
              )}
            </div>

            {/* Right: Neural Distillation Status */}
            <div className="glass-card rounded-3xl p-8 border border-primary/10 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[400px]">
              <div className="absolute inset-0 bg-primary/5 blur-[100px] rounded-full scale-50"></div>
              
              <AnimatePresence mode="wait">
                {isGenerating ? (
                  <motion.div
                    key="generating"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="relative z-10"
                  >
                    <div className="mb-8 relative">
                      <div className="h-24 w-24 rounded-full bg-primary/20 flex items-center justify-center relative">
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                          className="material-symbols-outlined text-primary text-4xl"
                        >
                hub

                        </motion.span>
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute inset-0 border border-primary/30 rounded-full"
                        ></motion.div>
                      </div>
                    </div>
                    <h4 className="text-xl font-bold text-primary mb-2">Course Summarization In Progress</h4>
                    <p className="text-sm text-on-surface-variant mb-8 max-w-[240px] mx-auto">
                      Extracting core semantic structures from your documents...
                    </p>
                    <div className="w-full max-w-[280px] bg-surface-container-highest h-1.5 rounded-full overflow-hidden mb-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-primary shadow-[0_0_10px_#bd9dff] rounded-full"
                      ></motion.div>
                    </div>
                    <div className="flex justify-between text-[10px] text-primary/60 font-mono tracking-widest uppercase">
                      <span>summarizing</span>
                      <span>{Math.round(progress)}% Complete</span>
                    </div>
                  </motion.div>
                ) : summaryData ? (
                  <motion.div
                    key="ready"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative z-10"
                  >
                    <div className="h-20 w-20 rounded-full bg-secondary/20 flex items-center justify-center mb-6">
                      <span className="material-symbols-outlined text-secondary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                        verified
                      </span>
                    </div>
                    <h4 className="text-xl font-bold text-secondary mb-2">Summarization Complete</h4>
                    <p className="text-sm text-on-surface-variant mb-6">
                      Your summary is ready for review.
                    </p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-secondary/10 text-secondary border border-secondary/20 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-secondary/20 transition-all disabled:opacity-50"
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleExport}
                        className="px-4 py-2 bg-surface-container-highest text-on-surface border border-outline-variant/20 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-surface-variant transition-all"
                      >
                        Export
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative z-10"
                  >
                    <div className="h-20 w-20 rounded-full bg-surface-container-highest flex items-center justify-center mb-6 opacity-40">
                      <span className="material-symbols-outlined text-on-surface-variant text-3xl">
                        psychology
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-on-surface-variant mb-2">Awaiting Input</h4>
                    <p className="text-sm text-on-surface-variant/60">
                      Select a course and configure your summary parameters to begin.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Decorative Binary Flow */}
              <div className="absolute bottom-4 left-0 right-0 opacity-10 font-mono text-[8px] flex justify-center gap-4 select-none">
                <span>01011001</span>
                <span>11001010</span>
                <span>10101111</span>
                <span>00011001</span>
              </div>
            </div>
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
                  {summaryData.mind_map && (
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
    </div>
  );
};

export default Summary;
