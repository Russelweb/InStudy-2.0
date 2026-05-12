import { motion, AnimatePresence } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import DocumentViewer from '../components/DocumentViewer';
import AITutorChat from '../components/AITutorChat';
import NeuralControlDeck from '../components/NeuralControlDeck';
import UploadZone from '../components/UploadZone';
import { documentService, statService } from '../services/api';

const Workspace = () => {
  const [searchParams] = useSearchParams();
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
      <nav className="shrink-0 w-full z-50 bg-[#0c1410]/80 backdrop-blur-3xl flex justify-between items-center px-4 md:px-8 h-16 shadow-[0px_20px_40px_rgba(189,157,255,0.05)] border-b border-primary/10">
        <Link to="/" className="text-xl md:text-2xl font-black tracking-tighter text-[#bd9dff] shrink-0">InStudy 2.0</Link>
        <div className="hidden sm:flex items-center gap-4 md:gap-6 overflow-hidden">
          {courseName && (
            <span className="text-on-surface-variant text-[10px] md:text-sm font-medium truncate max-w-[150px] md:max-w-none">
              Course: <span className="text-secondary font-bold">{courseName}</span>
            </span>
          )}
          <div className="h-4 w-px bg-outline-variant/20 hidden md:block"></div>
          <Link className="text-[#d8e8d6]/60 hover:text-[#d8e8d6] text-xs md:text-sm tracking-tight transition-all hidden lg:block" to="/knowledge">Library</Link>
          <span className="text-[#bd9dff] border-b-2 border-[#bd9dff] pb-1 text-xs md:text-sm tracking-tight whitespace-nowrap">Workspace</span>
          <Link className="text-[#d8e8d6]/60 hover:text-[#d8e8d6] text-xs md:text-sm tracking-tight transition-all hidden lg:block" to="/flashcards">Flashcards</Link>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
{/*           <span className="material-symbols-outlined text-[#bd9dff] cursor-pointer text-xl md:text-2xl">settings</span> */}
          <Link to="/"><span className="material-symbols-outlined text-[#bd9dff] cursor-pointer text-xl md:text-2xl">home</span></Link>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Workspace Side Nav */}
        <aside className={`${sidebarCollapsed ? 'w-16' : 'w-20 md:w-64'} bg-[#0c1410] flex flex-col py-8 px-2 gap-6 shrink-0 border-r border-outline-variant/10 transition-all duration-300 overflow-y-auto`}>
          {!sidebarCollapsed && (
            <div className="px-2 mb-4 hidden md:block">
              <p className="text-xs font-bold tracking-widest uppercase text-secondary/40">AI Tutor Workspace</p>
              <p className="text-[10px] text-primary/60">{courseId ? 'Bio-Sync Active' : 'No course selected'}</p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setSidebarCollapsed(v => !v)}
              className="flex items-center justify-center p-3 text-on-surface-variant hover:text-primary hover:bg-surface-container-highest rounded-lg transition-all"
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
            <Link to="/ai-tutor" className="flex items-center gap-4 p-3 text-[#d8e8d6]/40 hover:bg-primary/5 hover:text-primary rounded-lg transition-all duration-200" title="AI Tutor">
              <span className="material-symbols-outlined">smart_toy</span>
              {!sidebarCollapsed && <span className="hidden md:block text-sm font-medium">AI Tutor</span>}
            </Link>
            <Link to="/planner" className="flex items-center gap-4 p-3 text-[#d8e8d6]/40 hover:bg-primary/5 hover:text-primary rounded-lg transition-all duration-200" title="Study Planner">
              <span className="material-symbols-outlined">event_note</span>
              {!sidebarCollapsed && <span className="hidden md:block text-sm font-medium">Study Planner</span>}
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
          <div className="flex md:hidden bg-[#0c1410]/50 backdrop-blur-3xl p-1.5 rounded-2xl mx-4 my-2 border border-outline-variant/10 shadow-2xl shrink-0">
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
          <main className="flex flex-1 flex-col md:flex-row overflow-hidden md:pb-[120px]">
            <div className={`${activeMobileTab === 'reader' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[55%] h-full min-w-0`}>
              <DocumentViewer courseId={courseId} refreshTick={docRefreshTick} onAnnotationsLoaded={setActiveAnnotations}/>
            </div>
            <div className={`${activeMobileTab === 'chat' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[45%] h-full min-w-0`}>
              <AITutorChat courseId={courseId} />
            </div>
          </main>
        </div>
      </div>

      <NeuralControlDeck annotations={activeAnnotations} />
      
      {/* Persistent AI Disclaimer */}
      <div className="fixed bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-on-surface-variant/30 pointer-events-none z-[60] whitespace-nowrap hidden lg:block">
        InStudy AI can make mistakes. Please verify important information.
      </div>
    </div>
  );
};

export default Workspace;
