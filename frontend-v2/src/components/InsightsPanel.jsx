import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { documentService } from '../services/api';

const ANNOTATION_TYPES = [
  { id: 'note',      icon: 'edit_note',        label: 'Note',      colorClass: 'text-tertiary-fixed border-tertiary-fixed bg-tertiary-fixed/10', lineClass: 'border-tertiary-fixed', dotClass: 'bg-tertiary-fixed' },
  { id: 'summary',   icon: 'format_align_left', label: 'Summary',   colorClass: 'text-secondary border-secondary bg-secondary/10',               lineClass: 'border-secondary',       dotClass: 'bg-secondary' },
  { id: 'key_point', icon: 'stars',             label: 'Key Point', colorClass: 'text-primary border-primary bg-primary/10',                     lineClass: 'border-primary',         dotClass: 'bg-primary' },
  { id: 'question',  icon: 'help_center',       label: 'Question',  colorClass: 'text-error border-error bg-error/10',                           lineClass: 'border-error',           dotClass: 'bg-error' },
];

const TYPE_ICONS = Object.fromEntries(ANNOTATION_TYPES.map(t => [t.id, t]));

function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

const InsightsPanel = ({ courseId, selectedDoc }) => {
  const [annotations, setAnnotations]     = useState([]);
  const [loading, setLoading]             = useState(false);
  const [saving, setSaving]               = useState(false);
  const [saveError, setSaveError]         = useState('');
  const [successFlash, setSuccessFlash]   = useState(false);

  // Form state
  const [type, setType]         = useState('note');
  const [pageNum, setPageNum]   = useState('');
  const [text, setText]         = useState('');

  // ── Load annotations whenever doc changes ────────────────────────────────
  const loadAnnotations = useCallback(async () => {
    if (!courseId || !selectedDoc) { setAnnotations([]); return; }
    setLoading(true);
    try {
      const res = await documentService.getAnnotations(courseId, selectedDoc);
      const anns = res.data.annotations || [];
      // Newest first
      setAnnotations([...anns].reverse());
    } catch (err) {
      console.error('InsightsPanel: failed to load annotations', err);
    } finally {
      setLoading(false);
    }
  }, [courseId, selectedDoc]);

  useEffect(() => {
    loadAnnotations();
    // Reset form when doc changes
    setText('');
    setPageNum('');
    setType('note');
  }, [loadAnnotations]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!text.trim() || !courseId || !selectedDoc) return;
    setSaving(true);
    setSaveError('');
    try {
      const pageIndex = pageNum !== '' ? parseInt(pageNum, 10) - 1 : -1;
      await documentService.saveAnnotation(courseId, selectedDoc, {
        paragraph_index: -1,
        page_index: pageIndex >= 0 ? pageIndex : -1,
        content: text.trim(),
        annotation_type: type,
      });
      setText('');
      setPageNum('');
      setSuccessFlash(true);
      setTimeout(() => setSuccessFlash(false), 1800);
      await loadAnnotations();
    } catch (err) {
      setSaveError('Failed to save. Please try again.');
      console.error('InsightsPanel: save failed', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!courseId || !selectedDoc) return;
    try {
      await documentService.deleteAnnotation(courseId, selectedDoc, id);
      setAnnotations(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('InsightsPanel: delete failed', err);
    }
  };

  const selectedType = TYPE_ICONS[type] || ANNOTATION_TYPES[0];

  return (
    <section className="flex flex-col h-full w-full min-w-0 overflow-hidden border-l border-outline-variant/10">

      {/* ── Header ── */}
      <div className="shrink-0 px-5 py-4 border-b border-outline-variant/10 bg-[#0f1a10]/60 backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="material-symbols-outlined text-secondary text-lg">lightbulb</span>
          <h2 className="text-sm font-black tracking-widest uppercase text-on-surface">Insights</h2>
          {annotations.length > 0 && (
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
              {annotations.length}
            </span>
          )}
        </div>
        <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-wider">
          {selectedDoc ? selectedDoc : 'Select a document to add insights'}
        </p>
      </div>

      {/* ── Write Form ── */}
      <div className="shrink-0 p-4 border-b border-outline-variant/10 space-y-3 bg-[#0f1a10]/30">

        {/* Type pills */}
        <div className="flex flex-wrap gap-1.5">
          {ANNOTATION_TYPES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all duration-200 ${
                type === t.id
                  ? t.colorClass
                  : 'border-outline-variant/20 text-on-surface-variant/60 hover:border-outline-variant/50 hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[11px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          disabled={!selectedDoc}
          placeholder={selectedDoc ? `Write a ${selectedType.label.toLowerCase()} about this document…` : 'No document selected'}
          rows={3}
          className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:ring-1 focus:ring-secondary/50 focus:border-secondary/50 transition-all resize-none custom-scrollbar disabled:opacity-40 disabled:cursor-not-allowed"
        />

        {/* Page number + Save row */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-surface-container border border-outline-variant/20 rounded-lg px-2.5 py-1.5 flex-shrink-0">
            <span className="material-symbols-outlined text-on-surface-variant/50 text-sm">menu_book</span>
            <span className="text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-wider">p.</span>
            <input
              type="number"
              min="1"
              value={pageNum}
              onChange={e => setPageNum(e.target.value)}
              disabled={!selectedDoc}
              placeholder="—"
              className="w-10 bg-transparent text-xs font-bold text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none disabled:opacity-40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>

          <AnimatePresence mode="wait">
            {successFlash ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-secondary/10 text-secondary border border-secondary/20 text-[10px] font-bold uppercase tracking-widest"
              >
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Saved!
              </motion.div>
            ) : (
              <motion.button
                key="save"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                type="button"
                onClick={handleSave}
                disabled={!text.trim() || !selectedDoc || saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20 transition-all text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              >
                {saving ? (
                  <span className="w-3 h-3 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-sm">save</span>
                )}
                {saving ? 'Saving…' : 'Save Insight'}
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {saveError && (
          <p className="text-error text-[10px] font-bold">{saveError}</p>
        )}
      </div>

      {/* ── Insights Feed ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/40 font-bold">Loading insights…</p>
          </div>
        ) : !selectedDoc ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/20">lightbulb</span>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/30 font-bold max-w-[160px]">
              Open a document to start capturing insights
            </p>
          </div>
        ) : annotations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/20">edit_note</span>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/30 font-bold max-w-[180px]">
              No insights yet — write your first one above
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {annotations.map(ann => {
              const t = TYPE_ICONS[ann.type] || ANNOTATION_TYPES[0];
              const pageLabel = (ann.page_index != null && ann.page_index >= 0)
                ? `p.${ann.page_index + 1}`
                : null;

              return (
                <motion.div
                  key={ann.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`relative group/ann rounded-xl border-l-4 border bg-surface-container/60 p-3 pr-8 ${t.lineClass} hover:bg-surface-container transition-colors`}
                >
                  {/* Header row */}
                  <div className="flex items-center gap-2 mb-2">
                    {/* Type badge */}
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${t.colorClass}`}>
                      <span className="material-symbols-outlined text-[10px]">{t.icon}</span>
                      {t.label}
                    </div>

                    {/* Page badge */}
                    {pageLabel && (
                      <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-surface-container-high border border-outline-variant/20 text-[9px] font-bold text-on-surface-variant/70 uppercase tracking-wider">
                        <span className="material-symbols-outlined text-[10px]">menu_book</span>
                        {pageLabel}
                      </span>
                    )}

                    {/* Timestamp */}
                    <span className="ml-auto text-[9px] text-on-surface-variant/30 font-medium shrink-0">
                      {formatRelativeTime(ann.created_at)}
                    </span>
                  </div>

                  {/* Content */}
                  <p className="text-sm text-on-surface/85 leading-relaxed whitespace-pre-wrap">
                    {ann.content}
                  </p>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(ann.id)}
                    className="absolute top-3.5 right-2.5 opacity-0 group-hover/ann:opacity-100 p-0.5 text-error/50 hover:text-error transition-all rounded"
                    title="Delete insight"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
};

export default InsightsPanel;
