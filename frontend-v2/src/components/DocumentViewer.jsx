import { useState, useEffect, useCallback, useRef } from 'react';
import { documentService } from '../services/api';

const DataTable = ({ data, filename }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const columns = data.columns || [];
  const rows = data.rows || [];
  const totalRows = data.total_rows || rows.length;

  const filteredRows = rows.filter(row => 
    row.some(cell => String(cell).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-4 w-full select-text animate-fade-in">
      {/* Table Controls / Info Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface-container-low border border-outline-variant/15 p-4 rounded-xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">table_chart</span>
            <h4 className="text-sm font-black tracking-wide text-on-surface">{filename}</h4>
          </div>
          <p className="text-[10px] text-on-surface-variant/80 font-bold uppercase tracking-wider">
            {totalRows > 150 ? `Previewing first 150 of ${totalRows} rows` : `Showing all ${totalRows} rows`} · {columns.length} columns
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant/60 text-sm">search</span>
          <input
            type="text"
            placeholder="Search columns & rows..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-surface-container border border-outline-variant/20 rounded-lg pl-9 pr-4 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-secondary/50 focus:border-secondary transition-all"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-3 top-2 text-on-surface-variant/60 hover:text-error text-xs"
            >
              clear
            </button>
          )}
        </div>
      </div>

      {/* Actual Data Table grid */}
      <div className="border border-outline-variant/15 rounded-2xl overflow-hidden shadow-xl bg-surface-container-low max-w-full">
        <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-surface-container-high border-b border-outline-variant/20 z-10">
              <tr>
                <th className="p-3 text-[10px] font-black uppercase tracking-wider text-primary border-r border-outline-variant/10 text-center w-12 bg-primary/5">#</th>
                {columns.map((col, idx) => (
                  <th key={idx} className="p-3 text-[10px] font-black uppercase tracking-wider text-primary border-r border-outline-variant/10 min-w-[120px] bg-primary/5">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {filteredRows.length > 0 ? (
                filteredRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-primary/5 transition-colors group/row odd:bg-surface-container-low even:bg-surface-container-low/50">
                    <td className="p-3 font-mono text-[10px] text-on-surface-variant/50 text-center border-r border-outline-variant/10 bg-surface-container-high/20">{rIdx + 1}</td>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="p-3 text-on-surface-variant font-medium border-r border-outline-variant/10 max-w-[250px] truncate" title={cell}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length + 1} className="p-8 text-center text-on-surface-variant/60 italic">
                    No matching rows found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


const DocumentViewer = ({ courseId, refreshTick = 0, onAnnotationsLoaded, onUploadClick, onPageChange, onDocChange }) => {
  const [documents,    setDocuments]    = useState([]);
  const [selectedDoc,  setSelectedDoc]  = useState(null);
  const [docContent,   setDocContent]   = useState(null);   // for docx/txt
  const [pdfPages,     setPdfPages]     = useState([]);     // blob URLs indexed by page
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [pdfAnnotations, setPdfAnnotations] = useState([]); // annotations for PDF docs (for AI Tutor context)
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const loadingRef = useRef(false);                         // prevent duplicate loads

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
        const initialDoc = saved && files.includes(saved) ? saved : files[0];
        setSelectedDoc(initialDoc);
        if (onDocChange) onDocChange(initialDoc);
      } else {
        setSelectedDoc(null);
        if (onDocChange) onDocChange(null);
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
      const loadImage = async () => {
        try {
          const imageRes = await documentService.getRawBlob(courseId, selectedDoc);
          const imageUrl = URL.createObjectURL(imageRes.data);
          setDocContent({ isImage: true, url: imageUrl });

          const annRes = await documentService.getAnnotations(courseId, selectedDoc);
          const anns = annRes.data.annotations || [];
          setDocContent(prev => ({ ...prev, annotations: anns }));
          if (onAnnotationsLoaded) onAnnotationsLoaded(anns);
        } catch (err) {
          console.error('Failed to load image:', err);
          setError('Could not load this image document.');
        }
      };
      loadImage();

    } else if (ext === 'pdf') {
      setDocContent(null);
      setPdfPages([]);
      setPdfPageCount(0);
      setPdfAnnotations([]);
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
            // Fire heartbeat: each page load counts as reading interaction
            if (onPageChange) onPageChange();
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

  const ext = selectedDoc ? selectedDoc.split('.').pop().toLowerCase() : '';

  return (
    <section className="w-full h-full p-3 md:p-6 flex flex-col gap-4 relative border-b md:border-b-0 md:border-r border-outline-variant/10 min-w-0 shrink-0">

      {/* Toolbar */}
      <div className="glass-panel rounded-xl p-3 flex justify-between items-center border border-primary/10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {documents.length > 0 ? (
            <select
              value={selectedDoc || ''}
              onChange={e => {
                const doc = e.target.value;
                setSelectedDoc(doc);
                localStorage.setItem(`last_doc_${courseId}`, doc);
                if (onDocChange) onDocChange(doc);
              }}
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
        <div className="flex items-center gap-2 shrink-0">
          {courseId && onUploadClick && (
            <button
              onClick={onUploadClick}
              className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">upload_file</span>
              <span className="hidden sm:inline">Upload</span>
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
             <img 
               src={docContent.url} 
               alt={selectedDoc} 
               className="max-w-full rounded-2xl shadow-2xl border border-primary/10" 
             />
          </div>

        ) : docContent?.data_table ? (
          /* ── DATA TABLE: Excel / CSV preview ── */
          <div className="space-y-4 pb-8 w-full max-w-full">
            <DataTable data={docContent.data_table} filename={selectedDoc} />
          </div>

        ) : docContent?.paragraphs ? (
          /* ── DOCX / TXT: paragraph view ── */
          <div className="max-w-3xl mx-auto space-y-2 pb-24">
            {docContent.paragraphs.map((para, i) => {
              const style = docContent.styles?.[i] || 'body';

              let cssClass = 'text-on-surface-variant text-sm';
              if (style === 'heading1')      cssClass = 'text-3xl font-black text-on-surface mt-12 mb-6 tracking-tight';
              else if (style === 'heading2') cssClass = 'text-xl font-bold text-primary mt-8 mb-4';
              else if (style === 'page_break') cssClass = 'text-[10px] uppercase tracking-widest text-on-surface-variant/40 text-center py-8 border-b border-outline-variant/5';
              else if (style === 'list')     cssClass = 'text-sm text-on-surface pl-4 border-l-2 border-primary/30';

              if (style === 'page_break') return <div key={i} className={cssClass}>{para}</div>;

              return (
                <div key={i} className="py-1">
                  <div className={`${cssClass} leading-relaxed`}>{para}</div>
                </div>
              );
            })}
          </div>

        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 text-center p-8">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30">menu_book</span>
            <p className="text-on-surface-variant text-sm font-bold uppercase tracking-widest mb-2">
              {courseId ? 'Upload a document to begin.' : 'Select a course to load documents.'}
            </p>
            {courseId && onUploadClick && (
              <button
                onClick={onUploadClick}
                className="px-6 py-3 bg-secondary/10 text-secondary border border-secondary/20 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-secondary/20 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">upload_file</span>
                Upload Material
              </button>
            )}
          </div>
        )}
      </div>

      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-32 bg-primary/10 rounded-full cursor-col-resize hover:bg-primary/30 transition-colors z-20" />
    </section>
  );
};

export default DocumentViewer;
