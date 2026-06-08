import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { InputModal } from '../components/Modal';
import { showToast } from '../components/Toast';
import { useAura, useAuraHelp } from '../context/AuraContext';
import { assetService } from '../services/api';
import ScrollToTopButton from '../components/ScrollToTopButton';

const SummaryView = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { triggerAura } = useAura();
  useAuraHelp('Your summary is displayed below. Use the actions to save, share, or export it.');

  const [summaryData, setSummaryData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [showMindMap, setShowMindMap] = useState(false);

  // Persist summary data to localStorage
  useEffect(() => {
    if (summaryData) {
      localStorage.setItem('summary_view_data', JSON.stringify(summaryData));
    }
  }, [summaryData]);

  useEffect(() => {
    // Check for loaded asset from Saved Assets page first
    const savedSummary = localStorage.getItem('load_asset_summary');
    if (savedSummary) {
      try {
        const asset = JSON.parse(savedSummary);
        setSummaryData(asset.data);
        localStorage.removeItem('load_asset_summary');
        return;
      } catch (e) {
        console.error('Failed to load summary:', e);
      }
    }

    // Check for persisted view data (localStorage)
    const viewSummary = localStorage.getItem('summary_view_data');
    if (viewSummary) {
      try {
        const data = JSON.parse(viewSummary);
        // Keep it in localStorage for persistence (don't remove)
        setSummaryData(data);
      } catch (e) {
        console.error('Failed to restore summary view:', e);
      }
    }
  }, []);

  const handleSave = () => {
    if (!summaryData) return;
    setSaveModalOpen(true);
  };

  const handleSaveConfirm = async (title) => {
    setSaveModalOpen(false);
    setIsSaving(true);
    try {
      const data = {
        ...summaryData,
        saved_at: new Date().toISOString(),
      };
      await assetService.save(
        summaryData.course_id,
        'summary',
        title,
        data,
        {
          style: summaryData.style,
          document: summaryData.document || 'All documents',
          course_name: summaryData.courseName,
        }
      );
      const updated = { ...summaryData, saved: true, savedTitle: title };
      setSummaryData(updated);
      localStorage.setItem('summary_view_data', JSON.stringify(updated));
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
    a.download = `Summary_${summaryData.courseName}_${summaryData.style}_${Date.now()}.txt`;
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

  if (!summaryData) {
    return (
      <div className="flex-1 min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-on-surface-variant">No summary data found. <button onClick={() => navigate('/summary')} className="text-primary hover:underline">Generate a summary</button></p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-4 sm:p-6 md:p-8 border border-primary/15 relative overflow-hidden shadow-[0px_40px_80px_rgba(0,0,0,0.5)]"
        >
          {/* Accent light */}
          <div className="absolute -top-16 -right-16 sm:-top-24 sm:-right-24 h-48 sm:h-64 w-48 sm:w-64 bg-secondary/10 blur-[60px] sm:blur-[80px] rounded-full"></div>

          {/* Back button */}
          <button
            onClick={() => navigate('/summary')}
            className="mb-4 flex items-center gap-2 text-xs text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to Generator
          </button>

          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 md:mb-10 gap-3 md:gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-secondary text-xs font-bold uppercase tracking-[0.2em] mb-2">
                <span className="material-symbols-outlined text-sm">verified</span>
                Verified Analysis
              </div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-black tracking-tight text-on-surface break-words">
                {summaryData.courseName} - Course
              </h2>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <button
                onClick={handleExport}
                className="p-2 md:p-3 bg-surface-container-highest rounded-xl text-on-surface-variant hover:text-on-surface transition-colors border border-outline-variant/15"
                title="Download as text file"
              >
                <span className="material-symbols-outlined">download</span>
              </button>
              <button
                onClick={handleShare}
                className="p-2 md:p-3 bg-surface-container-highest rounded-xl text-on-surface-variant hover:text-on-surface transition-colors border border-outline-variant/15"
                title="Share summary"
              >
                <span className="material-symbols-outlined">share</span>
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-2 md:px-4 md:py-3 bg-[#551a8b] rounded-xl text-white hover:scale-[1.01] active:scale-[0.98] transition-all border border-primary/15 disabled:opacity-50 flex items-center gap-2"
                title="Save to assets"
              >
                <span className="material-symbols-outlined text-base">{summaryData.saved ? 'bookmark_added' : 'save'}</span>
                <span className="text-xs font-black uppercase tracking-widest">{summaryData.saved ? 'Saved' : 'Save'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-6 md:space-y-8 min-w-0 overflow-hidden">
            <div>
              <h5 className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-3 md:mb-4 border-b border-outline-variant/10 pb-2">
                Core Concept
              </h5>
              <div className="ai-content text-on-surface text-sm sm:text-base prose prose-invert max-w-none prose-headings:text-on-surface prose-p:text-on-surface-variant prose-strong:text-on-surface prose-ul:text-on-surface-variant prose-ol:text-on-surface-variant prose-li:text-on-surface-variant prose-code:text-on-surface prose-pre:text-on-surface break-words overflow-wrap-anywhere">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {summaryData.summary}
                </ReactMarkdown>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="sm:col-span-1 space-y-2 text-sm bg-surface-container-low p-4 rounded-xl border border-outline-variant/10">
                <div className="flex justify-between py-1">
                  <span className="text-on-surface-variant">Style:</span>
                  <span className="text-on-surface font-bold capitalize">{summaryData.style}</span>
                </div>
                {summaryData.document && (
                  <div className="flex justify-between py-1">
                    <span className="text-on-surface-variant">Document:</span>
                    <span className="text-on-surface font-bold text-xs truncate max-w-[120px]">{summaryData.document}</span>
                  </div>
                )}
              </div>

              <div className="sm:col-span-2 bg-surface-container-highest/50 p-4 md:p-6 rounded-2xl border border-outline-variant/10">
                <h6 className="text-xs font-bold text-on-surface mb-3">Next Steps</h6>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button 
                    onClick={() => navigate(`/flashcards?id=${summaryData.course_id || ''}`)}
                    className="flex items-center gap-3 cursor-pointer group p-3 rounded-xl bg-surface-container-low hover:bg-secondary/20 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-lg bg-surface-container-highest flex items-center justify-center group-hover:bg-secondary/20 transition-colors shrink-0">
                      <span className="material-symbols-outlined text-sm text-secondary">flash_on</span>
                    </div>
                    <span className="text-[11px] font-medium text-on-surface-variant group-hover:text-on-surface transition-colors truncate">Generate Flashcards</span>
                  </button>
                  <button 
                    onClick={() => navigate(`/quiz?id=${summaryData.course_id || ''}`)}
                    className="flex items-center gap-3 cursor-pointer group p-3 rounded-xl bg-surface-container-low hover:bg-secondary/20 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-lg bg-surface-container-highest flex items-center justify-center group-hover:bg-secondary/20 transition-colors shrink-0">
                      <span className="material-symbols-outlined text-sm text-secondary">quiz</span>
                    </div>
                    <span className="text-[11px] font-medium text-on-surface-variant group-hover:text-on-surface transition-colors truncate">Take a Quiz</span>
                  </button>
                  <button 
                    onClick={() => navigate(`/ai-tutor?id=${summaryData.course_id || ''}`)}
                    className="flex items-center gap-3 cursor-pointer group p-3 rounded-xl bg-surface-container-low hover:bg-secondary/20 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-lg bg-surface-container-highest flex items-center justify-center group-hover:bg-secondary/20 transition-colors shrink-0">
                      <span className="material-symbols-outlined text-sm text-secondary">smart_toy</span>
                    </div>
                    <span className="text-[11px] font-medium text-on-surface-variant group-hover:text-on-surface transition-colors truncate">Ask AI Tutor</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Mind Map Section */}
            {summaryData.mind_map && (
              <div className="mt-8 pt-6 border-t border-outline-variant/10">
                <div className="flex items-center justify-between mb-6">
                  <h5 className="text-on-surface-variant text-xs font-bold uppercase tracking-widest">
                    Conceptual Trace Map
                  </h5>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setShowMindMap(!showMindMap)}
                      className="text-xs text-primary hover:text-secondary transition-colors flex items-center gap-1 px-2 md:px-3 py-2 bg-primary/10 rounded-lg"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {showMindMap ? 'visibility_off' : 'visibility'}
                      </span>
                      <span className="hidden sm:inline">{showMindMap ? 'Hide' : 'Show'} Graph</span>
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
                      className="text-xs text-primary hover:text-secondary transition-colors flex items-center gap-1 px-2 md:px-3 py-2 bg-surface-container-highest rounded-lg border border-outline-variant/15"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                      <span className="hidden sm:inline">Export DOT</span>
                    </button>
                    <button
                      onClick={() => {
                        window.open(`https://dreampuf.github.io/GraphvizOnline/#${encodeURIComponent(summaryData.mind_map)}`, '_blank');
                      }}
                      className="text-xs text-secondary hover:text-primary transition-colors flex items-center gap-1 px-2 md:px-3 py-2 bg-secondary/10 rounded-lg border border-secondary/20"
                    >
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      <span className="hidden sm:inline">Visualize</span>
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
                    <div className="bg-surface-container-low p-4 md:p-6 rounded-2xl border border-outline-variant/10">
                      <div className="w-full overflow-x-auto">
                        <iframe
                          src={`https://dreampuf.github.io/GraphvizOnline/#${encodeURIComponent(summaryData.mind_map)}`}
                          className="w-full h-64 sm:h-80 md:h-[400px] rounded-lg border border-outline-variant/10 min-w-[300px]"
                          title="Mind Map Visualization"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </motion.div>
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

export default SummaryView;
