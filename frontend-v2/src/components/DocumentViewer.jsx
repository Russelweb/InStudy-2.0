import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import API, { documentService } from '../services/api';

const ANNOTATION_TYPES = [
  { id: 'note', icon: 'edit_note', label: 'Note', color: 'text-tertiary-fixed border-tertiary-fixed bg-tertiary-fixed/10', line: 'border-tertiary-fixed' },
  { id: 'summary', icon: 'format_align_left', label: 'Summary', color: 'text-secondary border-secondary bg-secondary/10', line: 'border-secondary' },
  { id: 'key_point', icon: 'stars', label: 'Key Point', color: 'text-primary border-primary bg-primary/10', line: 'border-primary' },
  { id: 'question', icon: 'help_center', label: 'Question', color: 'text-error border-error bg-error/10', line: 'border-error' }
];

const DocumentViewer = ({ courseId, refreshTick = 0, onAnnotationsLoaded }) => {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  
  const [docContent, setDocContent] = useState(null); 
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Annotation state
  const [activeParaIndex, setActiveParaIndex] = useState(null);
  const [annotationType, setAnnotationType] = useState('note');
  const [annotationText, setAnnotationText] = useState('');

  // 1. Fetch document list
  const fetchDocs = useCallback(async () => {
    if (!courseId) return;
    setError('');
    try {
      const res = await documentService.listByCourse(courseId);
      const files = res.data.documents || [];
      setDocuments(files);
      if (files.length > 0) {
        // Restore last selected document for this course if available
        const savedDoc = localStorage.getItem(`last_doc_${courseId}`);
        if (savedDoc && files.indexOf(savedDoc) !== -1) {
          setSelectedDoc(savedDoc);
        } else {
          setSelectedDoc(files[0]);
        }
      } else {
        setSelectedDoc(null);
        setDocContent(null);
        setPdfUrl(null);
      }
    } catch (err) {
      console.error('Failed to list documents:', err);
      setError('Could not load document list.');
    }
  }, [courseId, refreshTick]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  // 2. Fetch parsed paragraphs and annotations OR PDF Blob
  useEffect(() => {
    if (!courseId || !selectedDoc) {
      setDocContent(null);
      setPdfUrl(null);
      return;
    }
    
    const ext = selectedDoc.split('.').pop().toLowerCase();
    
    if (ext === 'pdf') {
      setDocContent(null);
      let objectUrl = null;
      const loadPdfBlob = async () => {
        setLoading(true);
        setError('');
        try {
          const response = await API.get(
            `/documents/raw/${courseId}/${encodeURIComponent(selectedDoc)}`,
            { responseType: 'blob' }
          );
          objectUrl = URL.createObjectURL(response.data);
          setPdfUrl(objectUrl);
        } catch (err) {
          console.error('Failed to load PDF:', err);
          setError('Could not load this PDF document.');
          setPdfUrl(null);
        } finally {
          setLoading(false);
        }
      };
      
      loadPdfBlob();
      return () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
      
    } else {
      setPdfUrl(null);
      const loadContent = async () => {
        setLoading(true);
        setError('');
        try {
          const res = await documentService.getParagraphs(courseId, selectedDoc);
          setDocContent(res.data);
        } catch (err) {
          console.error('Failed to parse document:', err);
          setError('Could not parse this document correctly.');
          setDocContent(null);
        } finally {
          setLoading(false);
        }
      };
      loadContent();
    }
  }, [courseId, selectedDoc]);

  const fetchAnnotations = async () => {
    try {
      const res = await documentService.getAnnotations(courseId, selectedDoc);
      setDocContent(prev => prev ? { ...prev, annotations: res.data.annotations } : prev);
      if (onAnnotationsLoaded) onAnnotationsLoaded(res.data.annotations);
    } catch(err) {
      console.error("Failed fetching annotations", err);
    }
  };

  useEffect(() => {
    if (docContent && docContent.annotations && onAnnotationsLoaded) {
       onAnnotationsLoaded(docContent.annotations);
    }
  }, [docContent, onAnnotationsLoaded]);

  const handleSaveAnnotation = async () => {
    if(!annotationText.trim()) return;
    try {
       await documentService.saveAnnotation(courseId, selectedDoc, {
          paragraph_index: activeParaIndex,
          page_index: -1,
          content: annotationText,
          annotation_type: annotationType
       });
       setAnnotationText('');
       setActiveParaIndex(null);
       fetchAnnotations();
    } catch(err) {
       console.error("Failed to save annotation", err);
    }
  };

  const handleDeleteAnnotation = async (id) => {
    try {
       await documentService.deleteAnnotation(courseId, selectedDoc, id);
       fetchAnnotations();
    } catch(err) {
       console.error("Delete failed", err);
    }
  };

  const ext = selectedDoc ? selectedDoc.split('.').pop().toLowerCase() : '';

  return (
    <section className="w-[55%] h-full p-6 flex flex-col gap-4 relative border-r border-outline-variant/10 min-w-0 shrink-0">
      {/* Reader Toolbar */}
      <div className="glass-panel rounded-xl p-3 flex justify-between items-center border border-primary/10 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          {documents.length > 0 ? (
            <select
              value={selectedDoc || ''}
              onChange={(e) => {
                const newDoc = e.target.value;
                setSelectedDoc(newDoc);
                localStorage.setItem(`last_doc_${courseId}`, newDoc);
              }}
              className="text-xs font-bold tracking-widest text-on-surface-variant uppercase bg-transparent border-none focus:ring-0 cursor-pointer max-w-[200px] truncate"
            >
              {documents.map((doc) => (
                <option key={doc} value={doc}>{doc}</option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">
              {courseId ? 'No documents yet' : 'No course selected'}
            </span>
          )}
          <div className="h-4 w-[1px] bg-outline-variant/30 shrink-0"></div>
          <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${loading ? 'text-yellow-400' : error ? 'text-error' : 'text-secondary'}`}>
            {loading ? 'Decrypting Secure File...' : error ? 'Error' : documents.length > 0 ? 'Neural Reader Active' : 'Awaiting Input'}
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {ext === 'pdf' && (
            <button 
              onClick={() => { setActiveParaIndex(-1); setAnnotationText(''); }}
              className="px-4 py-1.5 bg-secondary/10 text-secondary border border-secondary/20 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-secondary/20 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">edit_note</span>
              Add Insight
            </button>
          )}
          {pdfUrl && (
            <a
              href={pdfUrl}
              download={selectedDoc}
              className="text-on-surface-variant hover:text-secondary transition-colors"
              title="Download"
            >
              <span className="material-symbols-outlined">download</span>
            </a>
          )}
          <button className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">more_vert</span>
          </button>
        </div>
      </div>

      {/* Document Content Area */}
      <div className="flex-grow glass-panel rounded-xl overflow-y-auto custom-scrollbar border border-primary/5 shadow-2xl relative p-8">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs uppercase tracking-widest text-primary font-bold animate-pulse">Initializing Data Stream...</p>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-error opacity-60">error</span>
            <p className="text-error text-sm font-bold">{error}</p>
            <button onClick={() => fetchDocs()} className="text-xs text-on-surface-variant hover:text-primary transition-colors underline underline-offset-4">
              Try again
            </button>
          </div>
        ) : pdfUrl ? (
          <>
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0`}
              className="w-full h-full border-none"
              title="Document Viewer"
            ></iframe>

            {/* Floating Global Annotation Form for PDFs */}
            <AnimatePresence>
              {activeParaIndex === -1 && ext === 'pdf' && (
                <motion.div 
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  className="absolute top-4 right-4 w-96 p-5 bg-[#0a0f0bd0] backdrop-blur-2xl border border-secondary/30 rounded-2xl space-y-4 shadow-2xl z-50"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-secondary">New PDF Insight</span>
                    <button onClick={() => setActiveParaIndex(null)} className="text-on-surface-variant hover:text-error transition-colors">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                  <div className="flex gap-2 mb-2">
                    {ANNOTATION_TYPES.map(t => (
                      <button 
                        key={t.id} 
                        onClick={() => setAnnotationType(t.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border transition-all ${annotationType === t.id ? t.color : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-variant'}`}
                      >
                        <span className="material-symbols-outlined text-[10px]">{t.icon}</span>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <textarea 
                     value={annotationText}
                     onChange={(e) => setAnnotationText(e.target.value)}
                     className="w-full bg-surface-container/50 border border-secondary/20 rounded-xl p-3 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50 focus:border-secondary transition-all resize-none custom-scrollbar"
                     rows={4}
                     placeholder="Type your generic document insight here..."
                  />
                  <div className="flex justify-end gap-3 mt-2">
                    <button onClick={handleSaveAnnotation} disabled={!annotationText.trim()} className="w-full text-secondary bg-secondary/10 px-4 py-3 rounded-xl border border-secondary/30 hover:bg-secondary/20 transition-colors disabled:opacity-50 text-xs font-black uppercase tracking-widest">Store Insight</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : docContent && docContent.paragraphs ? (
          <div className="max-w-3xl mx-auto space-y-2 pb-24">
            {docContent.paragraphs.map((para, i) => {
              const style = docContent.styles[i] || 'body';
              const parasAnns = (docContent.annotations || []).filter(a => a.paragraph_index === i);
              
              let cssClass = "text-on-surface-variant text-sm";
              if(style === 'heading1') cssClass = "text-3xl font-black text-on-surface mt-12 mb-6 tracking-tight";
              else if(style === 'heading2') cssClass = "text-xl font-bold text-primary mt-8 mb-4";
              else if(style === 'page_break') cssClass = "text-[10px] uppercase tracking-widest text-on-surface-variant/40 text-center py-8 border-b border-outline-variant/5";
              else if(style === 'list') cssClass = "text-sm text-on-surface pl-4 border-l-2 border-primary/30";
              
              if (style === 'page_break') {
                 return <div key={i} className={cssClass}>{para}</div>;
              }

              return (
                <div key={i} className="group relative pl-8 py-1 hover:bg-surface-container-high/30 rounded-r-xl transition-colors">
                  {/* Floating Action */}
                  <button 
                    onClick={() => { setActiveParaIndex(i); setAnnotationText(''); }}
                    className="absolute left-0 top-1 opacity-0 group-hover:opacity-100 p-1 bg-surface-container-highest rounded-lg text-secondary border border-secondary/20 transition-all hover:scale-110 active:scale-95"
                    title="Add Insight"
                  >
                    <span className="material-symbols-outlined text-sm">edit_note</span>
                  </button>

                  <div className={`${cssClass} leading-relaxed`}>{para}</div>

                  {/* Inline Annotation Form */}
                  <AnimatePresence>
                    {activeParaIndex === i && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 mb-6 p-4 bg-[#0a0f0b] border border-primary/20 rounded-xl space-y-4 shadow-xl overflow-hidden"
                      >
                        <div className="flex gap-2">
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
                           onChange={(e) => setAnnotationText(e.target.value)}
                           className="w-full bg-surface-container border border-outline-variant/20 rounded-lg p-3 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50 focus:border-secondary/50 transition-all resize-none custom-scrollbar"
                           rows={3}
                           placeholder="Type your neural insight here... (e.g., 'This connects with Chapter 2...')"
                        />
                        <div className="flex justify-end gap-3 text-xs uppercase tracking-widest font-bold">
                          <button onClick={() => setActiveParaIndex(null)} className="text-on-surface-variant hover:text-error transition-colors px-2">Cancel</button>
                          <button onClick={handleSaveAnnotation} disabled={!annotationText.trim()} className="text-secondary bg-secondary/10 px-4 py-2 rounded border border-secondary/20 hover:bg-secondary/20 transition-colors disabled:opacity-50">Save Node</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Render Existing Annotations */}
                  {parasAnns.length > 0 && (
                     <div className="mt-3 space-y-2">
                       {parasAnns.map(ann => {
                         const currentType = ANNOTATION_TYPES.find(t => t.id === ann.type) || ANNOTATION_TYPES[0];
                         return (
                           <motion.div 
                             initial={{ opacity: 0, x: -10 }}
                             animate={{ opacity: 1, x: 0 }}
                             key={ann.id} 
                             className={`ml-4 p-3 rounded-r-xl border-l-2 bg-surface-container/50 relative group/ann ${currentType.line}`}
                           >
                             <div className="flex items-center justify-between mb-1">
                               <div className={`flex items-center gap-1 flex-row ${currentType.line.replace('border-', 'text-')}`}>
                                 <span className="material-symbols-outlined text-xs">{currentType.icon}</span>
                                 <span className="text-[10px] uppercase font-bold tracking-widest">{currentType.label}</span>
                               </div>
                               <button 
                                 onClick={() => handleDeleteAnnotation(ann.id)} 
                                 className="opacity-0 group-hover/ann:opacity-100 text-error/60 hover:text-error transition-opacity"
                                 title="Delete insight"
                               >
                                 <span className="material-symbols-outlined text-sm">delete</span>
                               </button>
                             </div>
                             <p className="text-sm text-on-surface/90 font-medium whitespace-pre-wrap">{ann.content}</p>
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
              {courseId ? 'Upload a document to begin analysis.' : 'Select a course to load documents.'}
            </p>
          </div>
        )}
      </div>

      {/* Resizer Handle */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-32 bg-primary/10 rounded-full cursor-col-resize hover:bg-primary/30 transition-colors z-20"></div>
    </section>
  );
};

export default DocumentViewer;
