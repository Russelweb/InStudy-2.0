import { motion } from 'framer-motion';
import { useState, useEffect, useCallback, useRef } from 'react';
import { documentService } from '../services/api';

const ANNOTATION_TYPES = [
  { id: 'note',      icon: 'edit_note',        label: 'Note',      color: 'text-tertiary-fixed border-tertiary-fixed bg-tertiary-fixed/10', line: 'border-tertiary-fixed' },
  { id: 'summary',   icon: 'format_align_left', label: 'Summary',   color: 'text-secondary border-secondary bg-secondary/10',               line: 'border-secondary' },
  { id: 'key_point', icon: 'stars',             label: 'Key Point', color: 'text-primary border-primary bg-primary/10',                     line: 'border-primary' },
  { id: 'question',  icon: 'help_center',       label: 'Question',  color: 'text-error border-error bg-error/10',                           line: 'border-error' },
];

const DocumentViewer = ({ courseId, refreshTick = 0, onAnnotationsLoaded }) => {
  const [documents,    setDocuments]    = useState([]);
  const [selectedDoc,  setSelectedDoc]  = useState(null);
  const [docContent,   setDocContent]   = useState(null);   // for docx/txt
  const [pdfPages,     setPdfPages]     = useState([]);     // blob URLs indexed by page
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [pdfAnnotations, setPdfAnnotations] = useState([]); // annotations for PDF docs
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const loadingRef = useRef(false);                         // prevent duplicate loads

  // Annotation state
  const [activeParaIndex, setActiveParaIndex] = useState(null);
  const [annotationType,  setAnnotationType]  = useState('note');
  const [annotationText,  setAnnotationText]  = useState('');

  // ── 1. Fetch document list ────────────────────────────────────────────────
  const fetchDocs = useCallback(async () => {
    if (!courseId) return;
    setError('');
    try {
      const res   = await documentService.listByCourse(courseId);
      const files = res.data.documents || [];
      setDocuments(files);
      if (files.length > 0) {
        const saved = localStorage.getItem(`last_doc_${courseId}`);
        setSelectedDoc(saved && files.includes(saved) ? saved : files[0]);
      } else {
        setSelectedDoc(null);
        setDocContent(null);
        setPdfPages([]);
        setPdfPageCount(0);
      }
    } catch (err) {
      console.error('Failed to list documents:', err);
      setError('Could not load document list.');
    }
  }, [courseId, refreshTick]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  // ── 2. Load document when selection changes ───────────────────────────────
  useEffect(() => {
    if (!courseId || !selectedDoc) {
      setDocContent(null); setPdfPages([]); setPdfPageCount(0); setPdfAnnotations([]);
      return;
    }
    const ext = selectedDoc.split('.').pop().toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png'].includes(ext);

    if (isImage) {
      setPdfPages([]);
      setPdfPageCount(0);
      setPdfAnnotations([]);
      setDocContent(null);
      // For images, we just use the raw serving URL
      const imageUrl = documentService.getRawUrl(courseId, selectedDoc);
      setDocContent({ isImage: true, url: imageUrl });
      
      // Load annotations
      const loadAnns = async () => {
        try {
          const annRes = await documentService.getAnnotations(courseId, selectedDoc);
          const anns = annRes.data.annotations || [];
          setDocContent(prev => ({ ...prev, annotations: anns }));
          if (onAnnotationsLoaded) onAnnotationsLoaded(anns);
        } catch (err) {
          console.error('Failed to load image annotations:', err);
        }
      };
      loadAnns();

    } else if (ext === 'pdf') {
      setDocContent(null);
      setPdfPages([]);
      setPdfPageCount(0);
      setPdfAnnotations([]);
      setActiveParaIndex(null);
      loadingRef.current = false;

      const loadPdf = async () => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        setError('');
        try {
          // Get total pages
          const countRes = await documentService.getPageCount(courseId, selectedDoc);
          const total    = countRes.data.page_count || 1;
          setPdfPageCount(total);

          // Load all pages sequentially, updating state as each arrives
          for (let i = 0; i < total; i++) {
            const res = await documentService.getPageImage(courseId, selectedDoc, i);
            const url = URL.createObjectURL(res.data);
            setPdfPages(prev => {
              const next = [...prev];
              next[i] = url;
              return next;
            });
            if (i === 0) setLoading(false); // show first page immediately
          }

          // Load annotations
          const annRes = await documentService.getAnnotations(courseId, selectedDoc);
          const anns   = annRes.data.annotations || [];
          setPdfAnnotations(anns);
          if (onAnnotationsLoaded) onAnnotationsLoaded(anns);
        } catch (err) {
          console.error('Failed to load PDF:', err);
          setError('Could not load this PDF document.');
          setLoading(false);
        }
        loadingRef.current = false;
      };
      loadPdf();

    } else {
      setPdfPages([]); setPdfPageCount(0); setPdfAnnotations([]);
      const loadContent = async () => {
        setLoading(true);
        setError('');
        try {
          const res = await documentService.getParagraphs(courseId, selectedDoc);
          setDocContent(res.data);
        } catch (err) {
          console.error('Failed to parse document:', err);
          setError('Could not parse this document.');
          setDocContent(null);
        } finally {
          setLoading(false);
        }
      };
      loadContent();
    }
  }, [courseId, selectedDoc]);

  // Sync docContent annotations to parent
  useEffect(() => {
    if (docContent?.annotations && onAnnotationsLoaded) {
      onAnnotationsLoaded(docContent.annotations);
    }
  }, [docContent, onAnnotationsLoaded]);

  // ── Annotation helpers ────────────────────────────────────────────────────
  const refreshAnnotations = async () => {
    if (!courseId || !selectedDoc) return;
    try {
      const res  = await documentService.getAnnotations(courseId, selectedDoc);
      const anns = res.data.annotations || [];
      const ext  = selectedDoc.split('.').pop().toLowerCase();
      if (ext === 'pdf') {
        setPdfAnnotations(anns);
        if (onAnnotationsLoaded) onAnnotationsLoaded(anns);
      } else {
        setDocContent(prev => prev ? { ...prev, annotations: anns } : prev);
        if (onAnnotationsLoaded) onAnnotationsLoaded(anns);
      }
    } catch (err) {
      console.error('Failed fetching annotations', err);
    }
  };

  const handleSaveAnnotation = async () => {
    if (!annotationText.trim()) return;
    try {
      await documentService.saveAnnotation(courseId, selectedDoc, {
        paragraph_index: activeParaIndex ?? -1,
        page_index:      -1,
        content:         annotationText,
        annotation_type: annotationType,
      });
      setAnnotationText('');
      setActiveParaIndex(null);
      refreshAnnotations();
    } catch (err) {
      console.error('Failed to save annotation', err);
    }
  };

  const handleDeleteAnnotation = async (id) => {
    try {
      await documentService.deleteAnnotation(courseId, selectedDoc, id);
      refreshAnnotations();
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const ext = selectedDoc ? selectedDoc.split('.').pop().toLowerCase() : '';

  // ── Annotation form (shared between PDF and DOCX) ─────────────────────────
  const AnnotationForm = ({ paraIndex }) => (
    <div className="mt-4 mb-6 p-4 bg-[#0a0f0b] border border-primary/20 rounded-xl space-y-4 shadow-xl">
      <div className="flex flex-wrap gap-2">
        {ANNOTATION_TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => setAnnotationType(t.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-all ${annotationType === t.id ? t.color : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-[12px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        value={annotationText}
        onChange={e => setAnnotationText(e.target.value)}
        className="w-full bg-surface-container border border-outline-variant/20 rounded-lg p-3 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50 transition-all resize-none custom-scrollbar"
        rows={3}
        placeholder="Type your insight here..."
        autoFocus
      />
      <div className="flex justify-end gap-3 text-xs uppercase tracking-widest font-bold">
        <button onClick={() => setActiveParaIndex(null)} className="text-on-surface-variant hover:text-error transition-colors px-2">Cancel</button>
        <button
          onClick={handleSaveAnnotation}
          disabled={!annotationText.trim()}
          className="text-secondary bg-secondary/10 px-4 py-2 rounded border border-secondary/20 hover:bg-secondary/20 transition-colors disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );

  return (
    <section className="w-full h-full p-3 md:p-6 flex flex-col gap-4 relative border-b md:border-b-0 md:border-r border-outline-variant/10 min-w-0 shrink-0">

      {/* Toolbar */}
      <div className="glass-panel rounded-xl p-3 flex justify-between items-center border border-primary/10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {documents.length > 0 ? (
            <select
              value={selectedDoc || ''}
              onChange={e => { setSelectedDoc(e.target.value); localStorage.setItem(`last_doc_${courseId}`, e.target.value); }}
              className="text-xs font-bold tracking-widest text-on-surface-variant uppercase bg-transparent border-none focus:ring-0 cursor-pointer max-w-[120px] md:max-w-[180px] truncate"
            >
              {documents.map(doc => <option key={doc} value={doc}>{doc}</option>)}
            </select>
          ) : (
            <span className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">
              {courseId ? 'No documents yet' : 'No course selected'}
            </span>
          )}
          <div className="h-4 w-px bg-outline-variant/30 shrink-0" />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${loading ? 'text-yellow-400' : error ? 'text-error' : 'text-secondary'}`}>
            {loading ? 'Loading...' : error ? 'Error' : documents.length > 0 ? 'Reader Active' : 'Awaiting Input'}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {selectedDoc && (
            <button
              onClick={() => { setActiveParaIndex(-1); setAnnotationText(''); }}
              className="px-3 py-1.5 bg-secondary/10 text-secondary border border-secondary/20 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-secondary/20 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">edit_note</span>
              <span className="hidden sm:inline">Add Insight</span>
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-grow glass-panel rounded-xl overflow-y-auto custom-scrollbar border border-primary/5 shadow-2xl relative p-4 md:p-8">

        {loading && pdfPages.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs uppercase tracking-widest text-primary font-bold animate-pulse">Loading document...</p>
          </div>

        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-error opacity-60">error</span>
            <p className="text-error text-sm font-bold">{error}</p>
            <button onClick={fetchDocs} className="text-xs text-on-surface-variant hover:text-primary underline underline-offset-4">Try again</button>
          </div>

        ) : pdfPages.length > 0 ? (
          /* ── PDF: all pages stacked, scrollable ── */
          <div className="space-y-4 pb-8">
            {/* Global annotation form (for PDFs) */}
            {activeParaIndex === -1 && <AnnotationForm paraIndex={-1} />}

            {/* Existing PDF annotations */}
            {pdfAnnotations.length > 0 && (
              <div className="space-y-2 mb-4">
                {pdfAnnotations.map(ann => {
                  const t = ANNOTATION_TYPES.find(x => x.id === ann.type) || ANNOTATION_TYPES[0];
                  return (
                    <div key={ann.id} className={`p-3 rounded-xl border-l-2 bg-surface-container/50 relative group/ann ${t.line}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] uppercase font-bold tracking-widest ${t.line.replace('border-', 'text-')}`}>{t.label}</span>
                        <button onClick={() => handleDeleteAnnotation(ann.id)} className="opacity-0 group-hover/ann:opacity-100 text-error/60 hover:text-error transition-opacity">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                      <p className="text-sm text-on-surface/90 whitespace-pre-wrap">{ann.content}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Page images */}
            {Array.from({ length: pdfPageCount }).map((_, i) => (
              <div key={i} className="relative">
                <div className="text-[9px] text-on-surface-variant/40 uppercase tracking-widest text-center mb-1">Page {i + 1}</div>
                {pdfPages[i] ? (
                  <img src={pdfPages[i]} alt={`Page ${i + 1}`} className="w-full rounded-lg shadow-lg" />
                ) : (
                  <div className="w-full h-64 flex items-center justify-center bg-surface-container/30 rounded-lg">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            ))}
          </div>

        ) : docContent?.isImage ? (
          /* ── IMAGE: direct preview ── */
          <div className="space-y-4 pb-8 flex flex-col items-center">
             {activeParaIndex === -1 && <AnnotationForm paraIndex={-1} />}
             
             {/* Image Annotations */}
             {docContent.annotations?.length > 0 && (
              <div className="w-full space-y-2 mb-4">
                {docContent.annotations.map(ann => {
                  const t = ANNOTATION_TYPES.find(x => x.id === ann.type) || ANNOTATION_TYPES[0];
                  return (
                    <div key={ann.id} className={`p-3 rounded-xl border-l-2 bg-surface-container/50 relative group/ann ${t.line}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] uppercase font-bold tracking-widest ${t.line.replace('border-', 'text-')}`}>{t.label}</span>
                        <button onClick={() => handleDeleteAnnotation(ann.id)} className="opacity-0 group-hover/ann:opacity-100 text-error/60 hover:text-error transition-opacity">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                      <p className="text-sm text-on-surface/90 whitespace-pre-wrap">{ann.content}</p>
                    </div>
                  );
                })}
              </div>
            )}

             <img 
               src={docContent.url} 
               alt={selectedDoc} 
               className="max-w-full rounded-2xl shadow-2xl border border-primary/10" 
             />
          </div>

        ) : docContent?.paragraphs ? (
          /* ── DOCX / TXT: paragraph view ── */
          <div className="max-w-3xl mx-auto space-y-2 pb-24">
            {/* Global annotation form */}
            {activeParaIndex === -1 && <AnnotationForm paraIndex={-1} />}

            {docContent.paragraphs.map((para, i) => {
              const style    = docContent.styles?.[i] || 'body';
              const parasAnns = (docContent.annotations || []).filter(a => a.paragraph_index === i);

              let cssClass = 'text-on-surface-variant text-sm';
              if (style === 'heading1')   cssClass = 'text-3xl font-black text-on-surface mt-12 mb-6 tracking-tight';
              else if (style === 'heading2') cssClass = 'text-xl font-bold text-primary mt-8 mb-4';
              else if (style === 'page_break') cssClass = 'text-[10px] uppercase tracking-widest text-on-surface-variant/40 text-center py-8 border-b border-outline-variant/5';
              else if (style === 'list')   cssClass = 'text-sm text-on-surface pl-4 border-l-2 border-primary/30';

              if (style === 'page_break') return <div key={i} className={cssClass}>{para}</div>;

              return (
                <div key={i} className="group relative pl-8 py-1 hover:bg-surface-container-high/30 rounded-r-xl transition-colors">
                  <button
                    onClick={() => { setActiveParaIndex(i); setAnnotationText(''); }}
                    className="absolute left-0 top-1 opacity-0 group-hover:opacity-100 p-1 bg-surface-container-highest rounded-lg text-secondary border border-secondary/20 transition-all hover:scale-110 active:scale-95"
                    title="Add Insight"
                  >
                    <span className="material-symbols-outlined text-sm">edit_note</span>
                  </button>

                  <div className={`${cssClass} leading-relaxed`}>{para}</div>

                  {activeParaIndex === i && <AnnotationForm paraIndex={i} />}

                  {parasAnns.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {parasAnns.map(ann => {
                        const t = ANNOTATION_TYPES.find(x => x.id === ann.type) || ANNOTATION_TYPES[0];
                        return (
                          <motion.div
                            key={ann.id}
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                            className={`ml-4 p-3 rounded-r-xl border-l-2 bg-surface-container/50 relative group/ann ${t.line}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className={`flex items-center gap-1 ${t.line.replace('border-', 'text-')}`}>
                                <span className="material-symbols-outlined text-xs">{t.icon}</span>
                                <span className="text-[10px] uppercase font-bold tracking-widest">{t.label}</span>
                              </div>
                              <button onClick={() => handleDeleteAnnotation(ann.id)} className="opacity-0 group-hover/ann:opacity-100 text-error/60 hover:text-error transition-opacity">
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            </div>
                            <p className="text-sm text-on-surface/90 whitespace-pre-wrap">{ann.content}</p>
                            <div className="text-[9px] text-on-surface-variant/40 mt-2 uppercase tracking-wider">{new Date(ann.created_at).toLocaleString()}</div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 text-center p-8">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30">menu_book</span>
            <p className="text-on-surface-variant text-sm font-bold uppercase tracking-widest">
              {courseId ? 'Upload a document to begin.' : 'Select a course to load documents.'}
            </p>
          </div>
        )}
      </div>

      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-32 bg-primary/10 rounded-full cursor-col-resize hover:bg-primary/30 transition-colors z-20" />
    </section>
  );
};

export default DocumentViewer;
