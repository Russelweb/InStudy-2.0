import { motion, AnimatePresence } from 'framer-motion';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import DocumentViewer from '../components/DocumentViewer';
import AITutorChat from '../components/AITutorChat';
import UploadZone from '../components/UploadZone';
import { documentService, statService } from '../services/api';

const Workspace = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseId = searchParams.get('id');

  const [isUploadOpen, setIsUploadOpen]     = useState(false);
  const [isUploading, setIsUploading]       = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [courseName, setCourseName]         = useState('');
  const [uploadError, setUploadError]       = useState('');
  const [docRefreshTick, setDocRefreshTick] = useState(0);
  const [activeAnnotations, setActiveAnnotations] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth < 768);
  const [activeMobileTab, setActiveMobileTab]   = useState('reader'); // 'reader' or 'chat'

  // Resolve human-readable course name
  useEffect(() => {
    if (!courseId) return;
    statService.getCourses()
      .then((res) => {
        const course = (res.data.courses || []).find((c) => c.id === courseId);
        setCourseName(course?.name || courseId.replace(/_/g, ' '));
      })
      .catch(() => setCourseName(courseId.replace(/_/g, ' ')));
  }, [courseId]);

  const handleUpload = async (file) => {
    if (!courseId) {
      setUploadError('No course selected.');
      return;
    }
    setUploadError('');
    setIsUploading(true);
    setUploadProgress(10);

    const interval = setInterval(() => {
      setUploadProgress((prev) => (prev < 90 ? prev + 8 : prev));
    }, 600);

    try {
      await documentService.upload(file, courseId);
      clearInterval(interval);
      setUploadProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        setIsUploadOpen(false);
        setUploadProgress(0);
        // Trigger document viewer to refresh
        setDocRefreshTick((t) => t + 1);
      }, 1000);
    } catch (error) {
      clearInterval(interval);
      setIsUploading(false);
      setUploadProgress(0);
      setUploadError('Upload failed: ' + (error.response?.data?.detail || error.message));
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden text-on-background">
      {/* Top Workspace Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="shrink-0 w-full z-50 bg-[#141f16]/80 backdrop-blur-3xl flex justify-between items-center px-4 md:px-8 h-16 shadow-[0px_20px_40px_rgba(189,157,255,0.05)] border-b border-primary/10"
      >
        {/* Left — back breadcrumb */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors shrink-0 group"
            title="Go back"
          >
            <span className="material-symbols-outlined text-lg group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
          </button>
          <span className="text-on-surface-variant/30 hidden sm:block">|</span>
          {/* Breadcrumb trail */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-on-surface-variant min-w-0">
            <Link to="/" className="hover:text-primary transition-colors shrink-0">Dashboard</Link>
            <span className="material-symbols-outlined text-sm opacity-40">chevron_right</span>
            <span className="text-primary font-bold truncate max-w-[120px] md:max-w-[200px]">
              {courseName || 'Workspace'}
            </span>
          </div>
          {/* Mobile — just the brand */}
          <Link to="/" className="text-lg font-black tracking-tighter text-[#bd9dff] sm:hidden shrink-0">InStudy</Link>
        </div>

        {/* Center — nav links (desktop) */}
        <div className="hidden lg:flex items-center gap-6">
          <Link className="text-on-surface-variant/60 hover:text-on-surface text-sm tracking-tight transition-all" to="/knowledge">Library</Link>
          <span className="text-primary border-b-2 border-primary pb-1 text-sm tracking-tight whitespace-nowrap">Workspace</span>
          <Link className="text-on-surface-variant/60 hover:text-on-surface text-sm tracking-tight transition-all" to="/flashcards">Flashcards</Link>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <Link to="/"><span className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors cursor-pointer text-xl">home</span></Link>
        </div>
      </motion.nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Workspace Side Nav */}
        <aside className={`${sidebarCollapsed ? 'w-16' : 'w-20 md:w-64'} bg-[#141f16] flex flex-col py-8 px-2 gap-6 shrink-0 border-r border-outline-variant/10 transition-all duration-300 overflow-y-auto`}>
          {!sidebarCollapsed && (
            <div className="px-2 mb-4 hidden md:block">
              <p className="text-xs font-bold tracking-widest uppercase text-secondary/40">AI Tutor Workspace</p>
              <p className="text-[10px] text-primary/60">{courseId ? 'Bio-Sync Active' : 'No course selected'}</p>
            </div>
          )}
          <div className="flex flex-col gap-1" >
            <button
              onClick={() => setSidebarCollapsed(v => !v)}
              className="flex items-center justify-center p-1 mt-0 text-on-surface-variant hover:text-primary hover:bg-surface-container-highest rounded-lg transition-all"
              title={sidebarCollapsed ? 'Expand' : 'Collapse'}
            >
              <span className="material-symbols-outlined text-lg">{sidebarCollapsed ? 'chevron_right' : 'chevron_left'}</span>
            </button>
            <button className="flex items-center gap-4 p-3 text-secondary bg-secondary/10 rounded-lg transition-all duration-200" title="Reader">
              <span className="material-symbols-outlined">menu_book</span>
              {!sidebarCollapsed && <span className="hidden md:block text-sm font-medium">Reader</span>}
            </button>
            <Link to="/" className="flex items-center gap-4 p-3 text-[#d8e8d6]/40 hover:bg-primary/5 hover:text-primary rounded-lg transition-all duration-200" title="Dashboard">
              <span className="material-symbols-outlined">home</span>
              {!sidebarCollapsed && <span className="hidden md:block text-sm font-medium">Dashboard</span>}
            </Link>
            <Link to="/knowledge" className="flex items-center gap-4 p-3 text-[#d8e8d6]/40 hover:bg-primary/5 hover:text-primary rounded-lg transition-all duration-200" title="Knowledge Base">
              <span className="material-symbols-outlined">database</span>
              {!sidebarCollapsed && <span className="hidden md:block text-sm font-medium">Knowledge Base</span>}
            </Link>
            <Link to="/flashcards" className="flex items-center gap-4 p-3 text-[#d8e8d6]/40 hover:bg-primary/5 hover:text-primary rounded-lg transition-all duration-200" title="Flashcards">
              <span className="material-symbols-outlined">style</span>
              {!sidebarCollapsed && <span className="hidden md:block text-sm font-medium">Flashcards</span>}
            </Link>
            <Link to="/quiz" className="flex items-center gap-4 p-3 text-[#d8e8d6]/40 hover:bg-primary/5 hover:text-primary rounded-lg transition-all duration-200" title="Smart Quiz">
              <span className="material-symbols-outlined">quiz</span>
              {!sidebarCollapsed && <span className="hidden md:block text-sm font-medium">Smart Quiz</span>}
            </Link>
            <Link to="/summary" className="flex items-center gap-4 p-3 text-[#d8e8d6]/40 hover:bg-primary/5 hover:text-primary rounded-lg transition-all duration-200" title="Smart Quiz">
              <span className="material-symbols-outlined">auto_awesome</span>
              {!sidebarCollapsed && <span className="hidden md:block text-sm font-medium">AI Summarizer</span>}
            </Link>
            <Link to="/planner" className="flex items-center gap-4 p-3 text-[#d8e8d6]/40 hover:bg-primary/5 hover:text-primary rounded-lg transition-all duration-200" title="Study Planner">
              <span className="material-symbols-outlined">event_note</span>
              {!sidebarCollapsed && <span className="hidden md:block text-sm font-medium">Study Planner</span>}
            </Link>
            <Link to="/mastery" className="flex items-center gap-4 p-3 text-[#d8e8d6]/40 hover:bg-primary/5 hover:text-primary rounded-lg transition-all duration-200" title="Study Planner">
              <span className="material-symbols-outlined">psychology</span>
              {!sidebarCollapsed && <span className="hidden md:block text-sm font-medium">Mastery Tracker</span>}
            </Link>
            
            <Link to="/ai-tutor" className="flex items-center gap-4 p-3 text-[#d8e8d6]/40 hover:bg-primary/5 hover:text-primary rounded-lg transition-all duration-200" title="AI Tutor">
              <span className="material-symbols-outlined">smart_toy</span>
              {!sidebarCollapsed && <span className="hidden md:block text-sm font-medium">AI Tutor</span>}
            </Link>
          </div>
          <div className="mt-auto px-1">
            <button
              onClick={() => setIsUploadOpen(true)}
              disabled={!courseId}
              className="w-full signature-gradient text-on-surface py-3 rounded-xl font-bold text-xs tracking-widest uppercase transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="New Research"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              {!sidebarCollapsed && <span className="hidden md:block">New Research</span>}
            </button>
          </div>
        </aside>

        {/* Workspace Canvas */}
        <div className="flex flex-1 flex-col overflow-hidden relative">
          {/* Upload Modal */}
          <AnimatePresence>
            {isUploadOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-8"
              >
                <div className="relative w-full max-w-2xl bg-surface-container shadow-2xl rounded-2xl border border-outline-variant/10">
                  <button
                    onClick={() => { setIsUploadOpen(false); setUploadError(''); }}
                    className="absolute top-4 right-4 text-on-surface-variant hover:text-error transition-colors"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                  <div className="p-8 pb-4 border-b border-outline-variant/10">
                    <h2 className="text-xl font-black text-on-surface">Initialize Data Stream</h2>
                    <p className="text-sm text-on-surface-variant mt-1.5">
                      Upload research documents into <span className="text-secondary font-bold">{courseName || courseId}</span>.
                    </p>
                    {uploadError && (
                      <p className="text-error text-xs mt-3 font-bold">{uploadError}</p>
                    )}
                  </div>
                  <div className="p-8">
                    <UploadZone
                      courseId={courseId}
                      onFileSelected={handleUpload}
                      isUploading={isUploading}
                      progress={uploadProgress}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile Tab Switcher */}
          <div className="flex md:hidden bg-[#141f16]/50 backdrop-blur-3xl p-1.5 rounded-2xl mx-4 my-2 border border-outline-variant/10 shadow-2xl shrink-0">
            <button 
              onClick={() => setActiveMobileTab('reader')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeMobileTab === 'reader' ? 'bg-primary/20 text-primary border border-primary/20 shadow-[0_0_20px_rgba(189,157,255,0.1)]' : 'text-on-surface-variant hover:text-white border border-transparent'}`}
            >
              <span className="material-symbols-outlined text-lg">menu_book</span>
              Reader
            </button>
            <button 
              onClick={() => setActiveMobileTab('chat')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeMobileTab === 'chat' ? 'bg-secondary/20 text-secondary border border-secondary/20 shadow-[0_0_20px_rgba(105,246,184,0.1)]' : 'text-on-surface-variant hover:text-white border border-transparent'}`}
            >
              <span className="material-symbols-outlined text-lg">psychology</span>
              AI Tutor
            </button>
          </div>

          {/* Split Pane — stacked on mobile (now tabbed), side-by-side on desktop */}
          <main className="flex flex-1 flex-col md:flex-row overflow-hidden">
            <div className={`${activeMobileTab === 'reader' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[55%] h-full min-w-0`}>
              <DocumentViewer courseId={courseId} refreshTick={docRefreshTick} onAnnotationsLoaded={setActiveAnnotations} onUploadClick={() => setIsUploadOpen(true)}/>
            </div>
            <div className={`${activeMobileTab === 'chat' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[45%] h-full min-w-0`}>
              <AITutorChat courseId={courseId} />
            </div>
          </main>
        </div>
      </div>
      
      {/* Persistent AI Disclaimer */}
      <div className="fixed bottom-1 left-1/2 -translate-x-1/2 text-[11px] text-on-surface-variant/50 pointer-events-none z-[60] whitespace-nowrap hidden lg:block">
        InStudy AI can make mistakes. Please verify important information.
      </div>
    </div>
  );
};

export default Workspace;
