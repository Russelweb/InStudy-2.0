import { motion, AnimatePresence } from "framer-motion";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import DocumentViewer from "../components/DocumentViewer";
import AITutorChat from "../components/AITutorChat";
import InsightsPanel from "../components/InsightsPanel";
import UploadZone from "../components/UploadZone";
import Sidebar from "../components/Sidebar";
import { documentService, statService, masteryService } from "../services/api";
import { useHeartbeat } from "../hooks/useHeartbeat";
import { useAura } from "../context/AuraContext";

const Workspace = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseId = searchParams.get("id");

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [courseName, setCourseName] = useState("");
  const [courses, setCourses] = useState([]);
  const [isCourseSelectorOpen, setIsCourseSelectorOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [docRefreshTick, setDocRefreshTick] = useState(0);
  const [activeAnnotations, setActiveAnnotations] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth < 768);
  const [activeMobileTab, setActiveMobileTab]   = useState('reader'); // 'reader' or 'chat'
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Right panel: 'tutor' or 'insights'
  const [activePanel, setActivePanel] = useState('tutor');
  // Currently viewed document (lifted from DocumentViewer so InsightsPanel can sync)
  const [currentDoc, setCurrentDoc] = useState(null);

  // ── Productive study time tracking ───────────────────────────────────────
  const { recordInteraction: recordTutorInteraction }   = useHeartbeat(courseId, 'tutor');
  const { recordInteraction: recordReadingInteraction } = useHeartbeat(courseId, 'reading');

  // ── Proactive Aura suggestion (Task 6.7) ─────────────────────────────────
  // When the workspace opens, check for weak/decaying subtopics and suggest one
  const { triggerAura, openQuickChatWithQuery } = useAura();
  useEffect(() => {
    if (!courseId) return;
    const nudgeKey = `aura_workspace_nudge_${courseId}`;
    if (sessionStorage.getItem(nudgeKey)) return;

    masteryService.v2.getWeakest(courseId, 3)
      .then(res => {
        const subtopics = res.data?.subtopics || [];
        // Only suggest if there are genuinely weak subtopics (< 40% mastery)
        const weak = subtopics.filter(s => (s.mastery_pct || 0) < 40);
        if (weak.length > 0) {
          sessionStorage.setItem(nudgeKey, 'true');
          const top = weak[0];
          const label = top.concept_name;
          setTimeout(() => {
            triggerAura(
              'pointing',
              `You haven't fully covered "${label}" yet. Want to work through it now?`,
              {
                label: `Ask about ${label.split(' ').slice(0, 2).join(' ')}`,
                onClick: () => openQuickChatWithQuery(
                  `Explain "${label}" to me in detail with examples.`
                )
              },
              10000
            );
          }, 3000); // wait 3s after page load
        }
      })
      .catch(() => {}); // non-fatal
  }, [courseId]);

  // Resolve human-readable course name & fetch all courses
  useEffect(() => {
    statService
      .getCourses()
      .then((res) => {
        const available = res.data.courses || [];
        setCourses(available);
        if (courseId) {
          const course = available.find((c) => c.id === courseId);
          setCourseName(course?.name || courseId.replace(/_/g, " "));
        }
      })
      .catch(() => {
        if (courseId) setCourseName(courseId.replace(/_/g, " "));
      });
  }, [courseId]);

  const switchCourse = (id) => {
    setIsCourseSelectorOpen(false);
    navigate(`/workspace?id=${id}`);
  };

  const handleUpload = async (file) => {
    if (!courseId) {
      setUploadError("No course selected.");
      return;
    }
    setUploadError("");
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
      setUploadError(
        "Upload failed: " + (error.response?.data?.detail || error.message),
      );
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
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors shrink-0"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors shrink-0 group"
            title="Go back"
          >
            <span className="material-symbols-outlined text-lg group-hover:-translate-x-0.5 transition-transform">
              arrow_back
            </span>
          </button>
          <span className="text-on-surface-variant/30 hidden sm:block">|</span>
          {/* Breadcrumb trail & Course Switcher — desktop */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-on-surface-variant min-w-0">
            <Link
              to="/"
              className="hover:text-primary transition-colors shrink-0"
            >
              Dashboard
            </Link>
            <span className="material-symbols-outlined text-sm opacity-40">
              chevron_right
            </span>

            <div className="relative">
              <button
                onClick={() => setIsCourseSelectorOpen(!isCourseSelectorOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 hover:border-primary/40 transition-all text-primary font-bold group"
              >
                <span className="truncate max-w-[120px] md:max-w-[200px]">
                  {courseName || "Select Course"}
                </span>
                <span
                  className={`material-symbols-outlined text-sm transition-transform duration-300 ${isCourseSelectorOpen ? "rotate-180" : ""}`}
                >
                  expand_more
                </span>
              </button>

              <AnimatePresence>
                {isCourseSelectorOpen && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40"
                      onClick={() => setIsCourseSelectorOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full left-0 mt-2 w-64 bg-surface-container-high border border-outline-variant/10 rounded-xl shadow-2xl z-50 overflow-hidden py-2"
                    >
                      <p className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40 border-b border-outline-variant/10 mb-1">
                        Switch Active Course
                      </p>
                      <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        {courses.map((course) => (
                          <button
                            key={course.id}
                            onClick={() => switchCourse(course.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary/10 transition-colors group ${String(course.id) === String(courseId) ? "bg-primary/5" : ""}`}
                          >
                            <span
                              className={`material-symbols-outlined text-sm ${String(course.id) === String(courseId) ? "text-primary" : "text-on-surface-variant/40"}`}
                            >
                              {String(course.id) === String(courseId)
                                ? "check_circle"
                                : "folder"}
                            </span>
                            <div className="min-w-0">
                              <p
                                className={`text-xs font-bold truncate ${String(course.id) === String(courseId) ? "text-primary" : "text-on-surface"}`}
                              >
                                {course.name}
                              </p>
                              <p className="text-[10px] text-on-surface-variant/60 truncate">
                                {course.document_count || 0} Documents
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                      <Link
                        to="/knowledge"
                        className="flex items-center gap-2 px-4 py-3 mt-1 border-t border-outline-variant/10 text-secondary hover:bg-secondary/10 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">
                          add_circle
                        </span>
                        <span className="text-xs font-bold tracking-tight">
                          Create New Course
                        </span>
                      </Link>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
          {/* Mobile — compact course selector */}
          <div className="sm:hidden flex items-center min-w-0">
            <div className="relative">
              <button
                onClick={() => setIsCourseSelectorOpen(!isCourseSelectorOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 hover:border-primary/40 transition-all group max-w-[150px]"
              >
                <span className="material-symbols-outlined text-primary text-sm shrink-0">folder</span>
                <span className="truncate text-xs font-black text-primary">
                  {courseName || "Course"}
                </span>
                <span className={`material-symbols-outlined text-primary text-sm shrink-0 transition-transform duration-300 ${isCourseSelectorOpen ? "rotate-180" : ""}`}>
                  expand_more
                </span>
              </button>

              <AnimatePresence>
                {isCourseSelectorOpen && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40"
                      onClick={() => setIsCourseSelectorOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className="absolute top-full left-0 mt-2 w-64 bg-surface-container-high border border-outline-variant/10 rounded-xl shadow-2xl z-50 overflow-hidden py-2"
                    >
                      <p className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40 border-b border-outline-variant/10 mb-1">
                        Switch Course
                      </p>
                      <div className="max-h-[280px] overflow-y-auto custom-scrollbar">
                        {courses.map((course) => (
                          <button
                            key={course.id}
                            onClick={() => switchCourse(course.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary/10 transition-colors ${String(course.id) === String(courseId) ? "bg-primary/5" : ""}`}
                          >
                            <span className={`material-symbols-outlined text-sm ${String(course.id) === String(courseId) ? "text-primary" : "text-on-surface-variant/40"}`}>
                              {String(course.id) === String(courseId) ? "check_circle" : "folder"}
                            </span>
                            <p className={`text-xs font-bold truncate ${String(course.id) === String(courseId) ? "text-primary" : "text-on-surface"}`}>
                              {course.name}
                            </p>
                          </button>
                        ))}
                      </div>
                      <Link
                        to="/knowledge"
                        onClick={() => setIsCourseSelectorOpen(false)}
                        className="flex items-center gap-2 px-4 py-3 mt-1 border-t border-outline-variant/10 text-secondary hover:bg-secondary/10 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">add_circle</span>
                        <span className="text-xs font-bold">New Course</span>
                      </Link>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Center — nav links (desktop) */}
        <div className="hidden lg:flex items-center gap-6">
          <Link
            className="text-on-surface-variant/60 hover:text-on-surface text-sm tracking-tight transition-all"
            to="/knowledge"
          >
            Library
          </Link>
          <span className="text-primary border-b-2 border-primary pb-1 text-sm tracking-tight whitespace-nowrap">
            Workspace
          </span>
          <button
            onClick={() => setActivePanel(p => p === 'insights' ? 'tutor' : 'insights')}
            className={`text-sm tracking-tight transition-all pb-1 ${
              activePanel === 'insights'
                ? 'text-secondary border-b-2 border-secondary'
                : 'text-on-surface-variant/60 hover:text-on-surface'
            }`}
          >
            Insights
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <Link to="/">
            <span className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors cursor-pointer text-xl">
              home
            </span>
          </Link>
        </div>
      </motion.nav>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar - Mobile Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] md:hidden"
              />
              <motion.div 
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed left-0 top-0 h-full w-72 z-[80] md:hidden"
              >
                <Sidebar mobile onLinkClick={() => setIsMobileMenuOpen(false)}>
                  <button
                    onClick={() => { setIsMobileMenuOpen(false); setIsUploadOpen(true); }}
                    disabled={!courseId}
                    className="w-full signature-gradient text-on-surface py-3 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg shadow-primary/10"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    <span>New Research</span>
                  </button>
                </Sidebar>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Workspace Side Nav (Desktop Static) */}
        <div className="hidden md:block h-full shrink-0">
          <Sidebar 
            isStatic 
            collapsed={sidebarCollapsed} 
            onToggleCollapse={() => setSidebarCollapsed(v => !v)}
            extraHeader={
              <div className="px-2 mb-2 hidden md:block">
                <p className="text-[10px] font-black tracking-[0.2em] uppercase text-secondary/40">AI Workspace</p>
                <p className="text-[11px] text-primary/60 font-medium truncate">{courseName || 'Syncing...'}</p>
              </div>
            }
          >
            <button
              onClick={() => setIsUploadOpen(true)}
              disabled={!courseId}
              className={`w-full signature-gradient text-on-surface py-3 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/10 ${sidebarCollapsed ? 'px-0' : 'px-4'}`}
              title="Initialize Data Stream"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              {!sidebarCollapsed && <span className="hidden md:block">New Research</span>}
            </button>
          </Sidebar>
        </div>

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
                    onClick={() => {
                      setIsUploadOpen(false);
                      setUploadError("");
                    }}
                    className="absolute top-4 right-4 text-on-surface-variant hover:text-error transition-colors"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                  <div className="p-8 pb-4 border-b border-outline-variant/10">
                    <h2 className="text-xl font-black text-on-surface">
                      Initialize Data Stream
                    </h2>
                    <p className="text-sm text-on-surface-variant mt-1.5">
                      Upload research documents into{" "}
                      <span className="text-secondary font-bold">
                        {courseName || courseId}
                      </span>
                      .
                    </p>
                    {uploadError && (
                      <p className="text-error text-xs mt-3 font-bold">
                        {uploadError}
                      </p>
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
              onClick={() => setActiveMobileTab("reader")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeMobileTab === "reader" ? "bg-primary/20 text-primary border border-primary/20 shadow-[0_0_20px_rgba(189,157,255,0.1)]" : "text-on-surface-variant hover:text-white border border-transparent"}`}
            >
              <span className="material-symbols-outlined text-lg">
                menu_book
              </span>
              Reader
            </button>
            <button
              onClick={() => { setActiveMobileTab("chat"); setActivePanel('tutor'); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeMobileTab === "chat" && activePanel === 'tutor' ? "bg-secondary/20 text-secondary border border-secondary/20 shadow-[0_0_20px_rgba(105,246,184,0.1)]" : "text-on-surface-variant hover:text-white border border-transparent"}`}
            >
              <span className="material-symbols-outlined text-lg">
                psychology
              </span>
              AI Tutor
            </button>
            <button
              onClick={() => { setActiveMobileTab("chat"); setActivePanel('insights'); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeMobileTab === "chat" && activePanel === 'insights' ? "bg-secondary/20 text-secondary border border-secondary/20 shadow-[0_0_20px_rgba(105,246,184,0.1)]" : "text-on-surface-variant hover:text-white border border-transparent"}`}
            >
              <span className="material-symbols-outlined text-lg">
                lightbulb
              </span>
              Insights
            </button>
          </div>

          {/* Split Pane — stacked on mobile (now tabbed), side-by-side on desktop */}
          <main className="flex flex-1 flex-col md:flex-row overflow-hidden">
            <div
              className={`${activeMobileTab === "reader" ? "flex" : "hidden"} md:flex flex-col w-full md:w-[55%] h-full min-w-0`}
            >
              <DocumentViewer
                courseId={courseId}
                refreshTick={docRefreshTick}
                onAnnotationsLoaded={setActiveAnnotations}
                onUploadClick={() => setIsUploadOpen(true)}
                onPageChange={recordReadingInteraction}
                onDocChange={setCurrentDoc}
              />
            </div>
            <div
              className={`${activeMobileTab === "chat" ? "flex" : "hidden"} md:flex flex-col w-full md:w-[45%] h-full min-w-0`}
            >
              {activePanel === 'insights' ? (
                <InsightsPanel courseId={courseId} selectedDoc={currentDoc} />
              ) : (
                <AITutorChat courseId={courseId} onMessageSent={recordTutorInteraction} />
              )}
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
