import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { inSpaceService, statService } from "../services/api";
import { showToast } from "../components/Toast";
import { ConfirmModal } from "../components/Modal";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

/**
 * Best-effort converter: wraps common plain-text math patterns in LaTeX delimiters
 * so KaTeX can render them even when the LLM forgets to use $...$.
 */
function preprocessMath(text) {
  if (!text) return text;
  if (/\$/.test(text)) return text;
  return text
    .replace(/\b(d\/d[a-z]|[a-z]\/[a-z]|\d+\/\d+)\b/g, (m) => `$${m}$`)
    .replace(/([a-zA-Z\d]+)\^(\{[^}]+\}|[a-zA-Z\d]+)/g, (m) => `$${m}$`)
    .replace(/\b(sin|cos|tan|cot|sec|csc|ln|log|exp|sqrt|lim|sum|int)\s*\(([^)]+)\)/g, (m) => `$${m}$`)
    .replace(/\b([a-zA-Z])'+'?\s*\([^)]+\)/g, (m) => `$${m}$`)
    .replace(/\b(alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|omega|phi|psi)\b/g, (m) => `$\\${m}$`)
    .replace(/([a-zA-Z][a-zA-Z0-9'_^()*/+\-\s]*=[a-zA-Z0-9'_^()*/+\-\s]+)/g, (m) => {
      if (/[\^*]|sin|cos|tan|ln|sqrt|d\/d/.test(m)) return `$${m.trim()}$`;
      return m;
    });
}

export default function InSpace() {
  const navigate = useNavigate();

  // ── Core States ──────────────────────────────────────────────────────────
  const [canvases, setCanvases] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [currentCanvas, setCurrentCanvas] = useState(null);
  const [loading, setLoading] = useState(false);
  const [topicInput, setTopicInput] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeDetails, setNodeDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [docsExpanded, setDocsExpanded] = useState(true);
  const [isLauncherCollapsed, setIsLauncherCollapsed] = useState(false);

  // ── Mobile Tab State ──────────────────────────────────────────────────────
  // 'launcher' | 'canvas' | 'details'
  const [mobileTab, setMobileTab] = useState("launcher");

  // ── Delete Confirm Modal ─────────────────────────────────────────────────
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [canvasToDelete, setCanvasToDelete] = useState(null);

  // ── Interactive Guide ────────────────────────────────────────────────────
  const HIDE_INSPACE_GUIDE_KEY = "inspace_guide_never_show";
  const [showGuide, setShowGuide] = useState(() => !localStorage.getItem(HIDE_INSPACE_GUIDE_KEY));
  const [confirmNeverShowOpen, setConfirmNeverShowOpen] = useState(false);

  const handleDismissGuide = (permanent = false) => {
    if (permanent) {
      localStorage.setItem(HIDE_INSPACE_GUIDE_KEY, "true");
      setShowGuide(false);
    } else {
      setShowGuide(false);
    }
    setConfirmNeverShowOpen(false);
  };

  // ── Quiz States ──────────────────────────────────────────────────────────
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  // ── Chat States ──────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // ── Canvas Pan / Zoom / Drag (mouse + touch) ─────────────────────────────
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoomScale, setZoomScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [nodePositions, setNodePositions] = useState({});

  const canvasRef = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const panStartPos = useRef({ x: 0, y: 0 });
  // Touch-specific refs
  const touchStartDist = useRef(null); // for pinch-zoom
  const touchStartZoom = useRef(1);
  const touchStartPan = useRef({ x: 0, y: 0 });
  const lastSingleTouch = useRef({ x: 0, y: 0 });

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchCanvases();
    fetchDocuments();
  }, []);

  const fetchCanvases = async () => {
    try {
      const res = await inSpaceService.list();
      setCanvases(res.data.canvases || []);
    } catch (e) {
      console.error(e);
      showToast("Failed to retrieve saved canvases", "error");
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await statService.getCourses();
      setDocuments(res.data.courses || []);
    } catch (e) {
      console.error("Failed to load courses:", e);
    }
  };

  // ── Generate / Load Canvas ───────────────────────────────────────────────
  const handleGenerate = async (topicStr) => {
    if (!topicStr.trim()) return;
    setLoading(true);
    setSelectedNode(null);
    setNodeDetails(null);
    try {
      showToast("AI is sketching your learning space...", "info");
      const groundingId = selectedDocumentId || null;
      const res = await inSpaceService.generate(topicStr, groundingId);
      showToast("Visual Canvas Created!", "success");
      setTopicInput("");
      fetchCanvases();
      loadCanvas(res.data.canvas_id);
      // Switch to canvas tab on mobile after generation
      setMobileTab("canvas");
    } catch (e) {
      console.error(e);
      showToast("Generation failed. Try another topic.", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadCanvas = async (canvasId) => {
    setLoading(true);
    setSelectedNode(null);
    setNodeDetails(null);
    setChatMessages([]);
    try {
      const res = await inSpaceService.getCanvas(canvasId);
      setCurrentCanvas(res.data);
      const positions = {};
      res.data.nodes.forEach((node) => {
        positions[node.id] = { x: node.x, y: node.y };
      });
      setNodePositions(positions);
      setPanOffset({ x: 0, y: 0 });
      setZoomScale(1);
      // Switch to canvas on mobile
      setMobileTab("canvas");
    } catch (e) {
      console.error(e);
      showToast("Failed to load canvas workspace", "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Delete Canvas ────────────────────────────────────────────────────────
  const triggerDeleteCanvas = (canvasId, e) => {
    e.stopPropagation();
    setCanvasToDelete(canvasId);
    setDeleteModalOpen(true);
  };

  const confirmDeleteCanvas = async () => {
    if (!canvasToDelete) return;
    try {
      await inSpaceService.deleteCanvas(canvasToDelete);
      showToast("Canvas removed", "success");
      if (currentCanvas?.id === canvasToDelete) setCurrentCanvas(null);
      fetchCanvases();
    } catch (e) {
      console.error(e);
      showToast("Failed to delete canvas", "error");
    } finally {
      setDeleteModalOpen(false);
      setCanvasToDelete(null);
    }
  };

  // ── Node Selection ────────────────────────────────────────────────────────
  const handleSelectNode = async (node) => {
    setSelectedNode(node);
    setDetailsLoading(true);
    setNodeDetails(null);
    setCurrentQuestionIndex(0);
    setSelectedOptionIndex(null);
    setQuizSubmitted(false);
    setQuizScore(0);
    setChatMessages([
      {
        sender: "ai",
        text: `Hi! I'm your AI tutor. Ask me anything about "${node.label}"!`,
      },
    ]);
    // Auto-switch to details tab on mobile when a node is tapped
    setMobileTab("details");
    try {
      const res = await inSpaceService.getNodeDetails(
        currentCanvas.id,
        node.id,
        node.label,
        currentCanvas.topic,
        currentCanvas.document_id,
      );
      setNodeDetails(res.data);
    } catch (e) {
      console.error(e);
      showToast("Failed to retrieve node contents", "error");
    } finally {
      setDetailsLoading(false);
    }
  };

  // ── Quiz ─────────────────────────────────────────────────────────────────
  const handleAnswerSubmit = () => {
    if (selectedOptionIndex === null || quizSubmitted) return;
    const currentQuiz = nodeDetails.quiz[currentQuestionIndex];
    const isCorrect = selectedOptionIndex === currentQuiz.answer;
    setQuizSubmitted(true);
    if (isCorrect) {
      setQuizScore((prev) => prev + 1);
      showToast("Correct! Nice job.", "success");
    } else {
      showToast("Incorrect. Check the explanation below.", "error");
    }
  };

  const handleNextQuizQuestion = async () => {
    const isLastQuestion = currentQuestionIndex >= nodeDetails.quiz.length - 1;
    if (isLastQuestion) {
      const finalScore =
        quizScore +
        (selectedOptionIndex === nodeDetails.quiz[currentQuestionIndex].answer
          ? 1
          : 0);
      const totalQuestions = nodeDetails.quiz.length;
      const masteryPercentage = finalScore / totalQuestions;
      try {
        await inSpaceService.updateNodeMastery(
          currentCanvas.id,
          selectedNode.id,
          masteryPercentage,
          0.8,
          1,
          120,
        );
        showToast(
          `Assessment complete! Mastery: ${Math.round(masteryPercentage * 100)}%`,
          "success",
        );
        const updatedCanvasRes = await inSpaceService.getCanvas(
          currentCanvas.id,
        );
        setCurrentCanvas(updatedCanvasRes.data);
      } catch (e) {
        console.error(e);
      }
      setCurrentQuestionIndex(0);
      setQuizSubmitted(false);
      setSelectedOptionIndex(null);
      setQuizScore(0);
    } else {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedOptionIndex(null);
      setQuizSubmitted(false);
    }
  };

  // ── Chat ──────────────────────────────────────────────────────────────────
  const handleSendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await inSpaceService.askNodeQuestion(
        currentCanvas.id,
        selectedNode.id,
        selectedNode.label,
        userMsg,
      );
      setChatMessages((prev) => [
        ...prev,
        { sender: "ai", text: res.data.answer },
      ]);
    } catch (e) {
      console.error(e);
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "Sorry, I couldn't answer that right now. Please try again!",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // ── Mouse Pan / Drag ─────────────────────────────────────────────────────
  const handleCanvasMouseDown = (e) => {
    // Start panning on left-click of the canvas container.
    // Nodes call `stopPropagation()` so this will not run when interacting with nodes.
    if (e.button !== 0) return;
    setIsPanning(true);
    panStartPos.current = {
      x: e.clientX - panOffset.x,
      y: e.clientY - panOffset.y,
    };
  };

  const handleCanvasMouseMove = (e) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStartPos.current.x,
        y: e.clientY - panStartPos.current.y,
      });
    } else if (draggedNodeId) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - panOffset.x) / zoomScale;
      const mouseY = (e.clientY - rect.top - panOffset.y) / zoomScale;
      const offset =
        dragStartPos.current && dragStartPos.current.offset
          ? dragStartPos.current.offset
          : { x: 0, y: 0 };
      setNodePositions((prev) => ({
        ...prev,
        [draggedNodeId]: { x: mouseX - offset.x, y: mouseY - offset.y },
      }));
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    setDraggedNodeId(null);
    dragStartPos.current = { x: 0, y: 0, offset: null };
  };

  // ── Touch Support for Canvas ──────────────────────────────────────────────
  const getTouchDist = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback(
    (e) => {
      if (e.touches.length === 1) {
        // Single finger: prepare to pan
        lastSingleTouch.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        touchStartPan.current = {
          x: e.touches[0].clientX - panOffset.x,
          y: e.touches[0].clientY - panOffset.y,
        };
        touchStartDist.current = null;
      } else if (e.touches.length === 2) {
        // Two fingers: prepare to pinch-zoom
        touchStartDist.current = getTouchDist(e.touches);
        touchStartZoom.current = zoomScale;
        // Also record pan center
        touchStartPan.current = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - panOffset.x,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - panOffset.y,
        };
      }
    },
    [panOffset, zoomScale],
  );

  const handleTouchMove = useCallback((e) => {
    e.preventDefault(); // prevent page scroll while panning canvas
    if (e.touches.length === 1 && touchStartDist.current === null) {
      // Single finger pan
      const newX = e.touches[0].clientX - touchStartPan.current.x;
      const newY = e.touches[0].clientY - touchStartPan.current.y;
      setPanOffset({ x: newX, y: newY });
    } else if (e.touches.length === 2 && touchStartDist.current !== null) {
      // Pinch-zoom
      const newDist = getTouchDist(e.touches);
      const ratio = newDist / touchStartDist.current;
      const newZoom = Math.max(
        0.3,
        Math.min(3, touchStartZoom.current * ratio),
      );
      setZoomScale(newZoom);
      // Pan so zoom stays centred on pinch midpoint
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setPanOffset({
        x: midX - touchStartPan.current.x,
        y: midY - touchStartPan.current.y,
      });
    }
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length < 2) touchStartDist.current = null;
  }, []);

  // ── Zoom Controls ─────────────────────────────────────────────────────────
  const handleZoom = (amount) =>
    setZoomScale((prev) => Math.max(0.4, Math.min(2.5, prev + amount)));

  // ── Node Colour by Mastery ────────────────────────────────────────────────
  const getNodeColorClass = (masteryVal) => {
    if (masteryVal >= 0.8)
      return "border-[#69f6b8] bg-[#69f6b8]/10 text-[#69f6b8] shadow-[0_0_15px_rgba(105,246,184,0.2)]";
    if (masteryVal >= 0.4)
      return "border-[#ffb74d] bg-[#ffb74d]/10 text-[#ffb74d] shadow-[0_0_15px_rgba(255,183,77,0.15)]";
    return "border-surface-variant/40 bg-surface/5 text-on-surface-variant";
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getDocLabel = (doc) => doc.name || doc.title || `Course ${doc.id}`;
  const selectedDoc = documents.find(
    (d) => String(d.id) === String(selectedDocumentId),
  );

  // ── Mobile Tab Config ─────────────────────────────────────────────────────
  const TABS = [
    { id: "launcher", icon: "rocket_launch", label: "Launcher" },
    { id: "canvas", icon: "space_dashboard", label: "Canvas" },
    {
      id: "details",
      icon: "psychology",
      label: "Node",
      disabled: !selectedNode,
    },
  ];

  // ── Shared Panel Renderers ────────────────────────────────────────────────

  const renderLauncherPanel = () => (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-4">
      <h2 className="text-lg font-black text-[#bd9dff] mb-4 tracking-tight">
        Launcher &amp; History
      </h2>

      {/* Document Grounding */}
      <div className="mb-4">
        <button
          onClick={() => setDocsExpanded((v) => !v)}
          className="w-full flex items-center justify-between mb-2 group"
        >
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-[#69f6b8]">
              description
            </span>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/50 font-bold group-hover:text-[#bd9dff] transition-colors">
              Ground to Course
            </p>
          </div>
          <span
            className={`material-symbols-outlined text-sm text-on-surface-variant/30 transition-transform duration-200 ${docsExpanded ? "rotate-180" : ""}`}
          >
            expand_more
          </span>
        </button>

        <AnimatePresence initial={false}>
          {docsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-1.5 pb-1">
                {/* Standalone */}
                <button
                  onClick={() => setSelectedDocumentId(null)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                    selectedDocumentId === null
                      ? "border-[#69f6b8]/50 bg-[#69f6b8]/8 text-[#69f6b8]"
                      : "border-outline-variant/10 hover:border-outline-variant/30 text-on-surface-variant/50"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm shrink-0">
                    public
                  </span>
                  <div className="overflow-hidden flex-1">
                    <p className="text-xs font-bold truncate">
                      Standalone (No Document)
                    </p>
                    <p className="text-[9px] opacity-60">
                      Free AI knowledge space
                    </p>
                  </div>
                  {selectedDocumentId === null && (
                    <span className="material-symbols-outlined text-xs shrink-0">
                      check_circle
                    </span>
                  )}
                </button>

                {documents.length === 0 ? (
                  <p className="text-[10px] text-on-surface-variant/30 italic px-2 py-1">
                    No courses uploaded yet
                  </p>
                ) : (
                  documents.map((doc) => {
                    const isSelected =
                      String(selectedDocumentId) === String(doc.id);
                    return (
                      <button
                        key={doc.id}
                        onClick={() =>
                          setSelectedDocumentId(
                            isSelected ? null : String(doc.id),
                          )
                        }
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                          isSelected
                            ? "border-[#bd9dff]/60 bg-[#bd9dff]/8 text-[#bd9dff]"
                            : "border-outline-variant/10 hover:border-[#bd9dff]/30 text-on-surface-variant/60"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm shrink-0">
                          {isSelected ? "folder_open" : "folder"}
                        </span>
                        <div className="overflow-hidden flex-1">
                          <p className="text-xs font-bold truncate">
                            {getDocLabel(doc)}
                          </p>
                          {doc.document_count !== undefined && (
                            <p className="text-[9px] opacity-50 truncate">
                              {doc.document_count} doc
                              {doc.document_count !== 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <span className="material-symbols-outlined text-xs shrink-0">
                            check_circle
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {selectedDocumentId && selectedDoc && (
          <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#bd9dff]/8 border border-[#bd9dff]/20">
            <span className="material-symbols-outlined text-xs text-[#bd9dff]">
              folder_open
            </span>
            <p className="text-[10px] text-[#bd9dff] font-bold truncate flex-1">
              {getDocLabel(selectedDoc)}
            </p>
            <button
              onClick={() => setSelectedDocumentId(null)}
              className="text-[#bd9dff]/50 hover:text-[#bd9dff] transition-colors"
            >
              <span className="material-symbols-outlined text-xs">close</span>
            </button>
          </div>
        )}
      </div>

      {/* Topic Launch */}
      <div className="flex flex-col gap-2 mb-6">
        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/40 font-bold">
          Topic to Explore
        </p>
        <input
          type="text"
          placeholder="e.g. Photosynthesis"
          value={topicInput}
          onChange={(e) => setTopicInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGenerate(topicInput)}
          disabled={loading}
          className="px-3 py-2 text-sm bg-surface-container rounded-lg border border-outline-variant/10 focus:outline-none focus:border-[#bd9dff] text-on-surface transition-colors placeholder:text-on-surface-variant/30"
        />
        <button
          onClick={() => handleGenerate(topicInput)}
          disabled={loading || !topicInput.trim()}
          className="w-full py-2.5 bg-[#bd9dff] text-background font-bold text-sm rounded-lg hover:bg-[#bd9dff]/80 transition-colors shadow-lg shadow-[#bd9dff]/10 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-sm">
            {loading ? "hourglass_empty" : "rocket_launch"}
          </span>
          {loading ? "Sketching..." : "Launch Learning Space"}
        </button>
        {selectedDocumentId && selectedDoc && (
          <p className="text-[9px] text-[#bd9dff]/60 text-center">
            📄 Grounded to:{" "}
            <span className="font-bold">{getDocLabel(selectedDoc)}</span>
          </p>
        )}
      </div>

      {/* Saved Canvases */}
      <div className="flex-1 flex flex-col gap-2">
        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/40 font-bold mb-1">
          Your Canvases
        </p>
        {canvases.length === 0 ? (
          <p className="text-xs text-on-surface-variant/40 italic p-3 text-center">
            No workspaces saved yet
          </p>
        ) : (
          canvases.map((c) => (
            <div
              key={c.id}
              onClick={() => loadCanvas(c.id)}
              className={`group flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                currentCanvas?.id === c.id
                  ? "border-[#bd9dff] bg-[#bd9dff]/5 text-on-surface"
                  : "border-outline-variant/10 hover:border-[#bd9dff]/40 text-on-surface-variant/70"
              }`}
            >
              <div className="overflow-hidden pr-2">
                <p className="text-xs font-bold truncate">{c.topic}</p>
                <p className="text-[9px] opacity-40 mt-0.5">
                  {c.document_id ? "📄 Grounded" : "🌐 Standalone"} ·{" "}
                  {c.node_count} concepts
                </p>
              </div>
              <button
                onClick={(e) => triggerDeleteCanvas(c.id, e)}
                className="opacity-0 group-hover:opacity-100 active:opacity-100 p-1 hover:text-error transition-all shrink-0"
                title="Delete canvas"
              >
                <span className="material-symbols-outlined text-sm">
                  delete
                </span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderCanvas = () => (
    <div className="relative w-full h-full flex flex-col overflow-hidden">
      {currentCanvas ? (
        <>
           {/* Header info bar */}
           <div className="absolute top-3 left-3 z-10 bg-[#141f16]/90 backdrop-blur-sm border border-outline-variant/10 rounded-xl px-3 py-1.5 flex items-center gap-2 max-w-[60%]">
             <div className="overflow-hidden">
               <h3 className="text-xs font-bold text-[#bd9dff] truncate">
                 {currentCanvas.topic}
               </h3>
               <p className="text-[8px] text-on-surface-variant/50 truncate">
                 {currentCanvas.document_id ? "📄 Grounded" : "🌐 Standalone"}
               </p>
             </div>
             <button
               onClick={() => setIsLauncherCollapsed(!isLauncherCollapsed)}
               className="p-1 rounded-lg bg-surface/90 backdrop-blur-sm border border-outline-variant/10 hover:text-[#bd9dff] transition-colors"
               title="Toggle Launcher Panel"
             >
               <span className="material-symbols-outlined text-sm">
                 {isLauncherCollapsed ? "menu_open" : "menu"}
               </span>
             </button>
           </div>

          {/* Zoom controls */}
          <div className="absolute top-3 right-3 z-10 flex gap-1.5">
            <button
              onClick={() => handleZoom(0.15)}
              className="w-8 h-8 rounded-lg bg-surface/90 backdrop-blur-sm border border-outline-variant/10 flex items-center justify-center hover:border-primary text-on-surface transition-colors shadow-md"
            >
              <span className="material-symbols-outlined text-sm">add</span>
            </button>
            <button
              onClick={() => handleZoom(-0.15)}
              className="w-8 h-8 rounded-lg bg-surface/90 backdrop-blur-sm border border-outline-variant/10 flex items-center justify-center hover:border-primary text-on-surface transition-colors shadow-md"
            >
              <span className="material-symbols-outlined text-sm">remove</span>
            </button>
            <button
              onClick={() => {
                setPanOffset({ x: 0, y: 0 });
                setZoomScale(1);
              }}
              className="w-8 h-8 rounded-lg bg-surface/90 backdrop-blur-sm border border-outline-variant/10 flex items-center justify-center hover:border-primary text-on-surface transition-colors shadow-md"
              title="Recenter"
            >
              <span className="material-symbols-outlined text-sm">
                restart_alt
              </span>
            </button>
          </div>

          {/* Touch hint — shown briefly on mobile */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none md:hidden">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#141f16]/80 backdrop-blur-sm border border-outline-variant/10">
              <span className="material-symbols-outlined text-xs text-[#bd9dff]">
                touch_app
              </span>
              <p className="text-[9px] text-on-surface-variant/60">
                Drag to pan · Pinch to zoom · Tap node to explore
              </p>
            </div>
          </div>

          {/* Canvas area */}
          <div
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="flex-1 cursor-grab active:cursor-grabbing relative overflow-hidden touch-none"
            style={{
              backgroundImage:
                "radial-gradient(rgba(189,157,255,0.06) 1.5px, transparent 1.5px)",
              backgroundSize: "24px 24px",
            }}
          >
            <div
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                transformOrigin: "0 0",
                pointerEvents: "none",
                position: "absolute",
                inset: 0,
              }}
            >
              <svg className="absolute inset-0 w-[4000px] h-[3000px] pointer-events-none overflow-visible">
                {currentCanvas.edges.map((edge) => {
                  const sourcePos = nodePositions[edge.source_id];
                  const targetPos = nodePositions[edge.target_id];
                  if (!sourcePos || !targetPos) return null;
                  const startX = sourcePos.x + 176;
                  const startY = sourcePos.y + 24;
                  const endX = targetPos.x;
                  const endY = targetPos.y + 24;
                  const controlX = (startX + endX) / 2;
                  return (
                    <g key={edge.id}>
                      <path
                        d={`M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`}
                        fill="none"
                        stroke="rgba(189,157,255,0.25)"
                        strokeWidth="2"
                        strokeDasharray="4"
                      />
                      <polygon
                        points={`${endX},${endY} ${endX - 8},${endY - 4} ${endX - 8},${endY + 4}`}
                        fill="rgba(189,157,255,0.3)"
                      />
                    </g>
                  );
                })}
              </svg>

              {currentCanvas.nodes.map((node) => {
                const pos = nodePositions[node.id] || { x: node.x, y: node.y };
                const isSelected = selectedNode?.id === node.id;
                return (
                  <div
                    key={node.id}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      if (!canvasRef.current) return;
                      const rect = canvasRef.current.getBoundingClientRect();
                      const mouseX =
                        (e.clientX - rect.left - panOffset.x) / zoomScale;
                      const mouseY =
                        (e.clientY - rect.top - panOffset.y) / zoomScale;
                      const pos = nodePositions[node.id] || {
                        x: node.x,
                        y: node.y,
                      };
                      dragStartPos.current = {
                        x: e.clientX,
                        y: e.clientY,
                        offset: { x: mouseX - pos.x, y: mouseY - pos.y },
                      };
                      setDraggedNodeId(node.id);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectNode(node);
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleSelectNode(node);
                    }}
                    className={`absolute px-3 py-2 rounded-xl border-2 cursor-pointer pointer-events-auto transition-all select-none flex flex-col justify-center items-center text-center overflow-hidden ${
                      isSelected
                        ? "border-[#bd9dff] bg-[#bd9dff]/15 text-white shadow-[0_0_20px_rgba(189,157,255,0.35)]"
                        : getNodeColorClass(node.mastery)
                    }`}
                    style={{ left: `${pos.x}px`, top: `${pos.y}px`, width: '160px', minHeight: '52px', maxHeight: '72px' }}
                  >
                    <p className="text-[10px] font-bold leading-tight line-clamp-2 w-full text-center break-words">
                      {node.label}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5 opacity-60 shrink-0">
                      <span className="text-[7px] uppercase tracking-wider font-semibold truncate max-w-[80px]">
                        {node.difficulty}
                      </span>
                      {node.mastery > 0 && (
                        <span className="text-[7px] px-1 rounded bg-surface text-white shrink-0">
                          {Math.round(node.mastery * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <span className="material-symbols-outlined text-5xl text-[#bd9dff] opacity-30 mb-4 animate-pulse">
            space_dashboard
          </span>
          <h3 className="text-sm font-bold text-on-surface-variant mb-1">
            No canvas loaded
          </h3>
          <p className="text-xs text-on-surface-variant/40 max-w-xs mb-4">
            Go to the <span className="text-[#bd9dff] font-bold">Launcher</span>{" "}
            tab to select a course and enter a topic.
          </p>
          {/* Quick shortcut on mobile */}
          <button
            onClick={() => setMobileTab("launcher")}
            className="md:hidden px-4 py-2 bg-[#bd9dff]/10 border border-[#bd9dff]/30 text-[#bd9dff] text-xs font-bold rounded-lg flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">
              rocket_launch
            </span>
            Open Launcher
          </button>
        </div>
      )}
    </div>
  );

  const renderDetails = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {selectedNode ? (
        <>
          {/* Node header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/10 shrink-0">
            <div className="overflow-hidden">
              <h2 className="text-[10px] font-black text-[#bd9dff] uppercase tracking-wider">
                Concept Node
              </h2>
              <h3 className="text-sm font-bold truncate text-on-surface">
                {selectedNode.label}
              </h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Back to canvas on mobile */}
              <button
                onClick={() => setMobileTab("canvas")}
                className="md:hidden p-1.5 rounded-lg bg-surface-container text-on-surface-variant hover:text-[#bd9dff] transition-colors"
                title="Back to canvas"
              >
                <span className="material-symbols-outlined text-base">
                  arrow_back
                </span>
              </button>
              <button
                onClick={() => {
                  setSelectedNode(null);
                  setMobileTab("canvas");
                }}
                className="p-1 hover:text-primary transition-colors text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          </div>

          {detailsLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-[#bd9dff] animate-pulse">
                AI is writing topic summaries...
              </p>
            </div>
          ) : nodeDetails ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
              {/* AI Explanation */}
              <div>
                <h4 className="text-xs font-bold text-[#bd9dff] uppercase tracking-wider mb-2">
                  AI Explanation
                </h4>
                <div className="p-4 bg-surface-container/50 border border-outline-variant/5 rounded-xl text-xs text-on-surface-variant/90 leading-relaxed">
                  {nodeDetails.explanation}
                </div>
              </div>

              {/* Key Takeaways */}
              {nodeDetails.key_points?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-[#bd9dff] uppercase tracking-wider mb-2">
                    Key Takeaways
                  </h4>
                  <ul className="space-y-2 pl-4 list-disc text-xs text-on-surface-variant/80">
                    {nodeDetails.key_points.map((pt, i) => (
                      <li key={i}>{pt}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Misconceptions */}
              {nodeDetails.common_mistakes?.length > 0 && (
                <div className="p-4 border border-error/20 bg-error/5 rounded-xl">
                  <h4 className="text-xs font-bold text-error uppercase tracking-wider mb-2">
                    Common Misconceptions
                  </h4>
                  <ul className="space-y-2 pl-4 list-disc text-xs text-error/80">
                    {nodeDetails.common_mistakes.map((pt, i) => (
                      <li key={i}>{pt}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Mini Quiz */}
              {nodeDetails.quiz?.length > 0 && (
                <div className="p-5 border border-primary/20 bg-primary/5 rounded-2xl space-y-4 relative overflow-hidden group/quiz">
                  <div className="flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                      <h4 className="text-[10px] font-black text-[#bd9dff] uppercase tracking-[0.2em]">
                        Quick Quiz
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1 bg-surface-container-highest rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-500" 
                          style={{ width: `${((currentQuestionIndex + 1) / nodeDetails.quiz.length) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] font-black text-on-surface-variant/40">
                        {currentQuestionIndex + 1}/{nodeDetails.quiz.length}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs font-bold text-on-surface leading-relaxed relative z-10">
                    {nodeDetails.quiz[currentQuestionIndex].question}
                  </p>

                  <div className="space-y-2 relative z-10">
                    {nodeDetails.quiz[currentQuestionIndex].options.map(
                      (opt, i) => {
                        const isSelected = selectedOptionIndex === i;
                        const isCorrect = i === nodeDetails.quiz[currentQuestionIndex].answer;
                        const showResult = quizSubmitted;

                        return (
                          <div
                            key={i}
                            onClick={() => !quizSubmitted && setSelectedOptionIndex(i)}
                            className={`p-3 rounded-xl border text-[11px] cursor-pointer transition-all relative overflow-hidden group/opt ${
                              showResult
                                ? isCorrect
                                  ? "border-secondary bg-secondary/10 text-secondary"
                                  : isSelected
                                    ? "border-error bg-error/10 text-error"
                                    : "border-outline-variant/10 opacity-50 text-on-surface-variant"
                                : isSelected
                                  ? "border-primary bg-primary/10 text-primary shadow-lg shadow-primary/10"
                                  : "border-outline-variant/10 hover:border-primary/40 text-on-surface-variant hover:bg-surface-container/50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="relative z-10">{opt}</span>
                              {showResult && (isCorrect || isSelected) && (
                                <span className="material-symbols-outlined text-sm font-bold relative z-10">
                                  {isCorrect ? "check" : "close"}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>

                  {quizSubmitted && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3.5 rounded-xl border leading-relaxed text-[11px] ${
                        selectedOptionIndex === nodeDetails.quiz[currentQuestionIndex].answer
                          ? "bg-secondary/5 border-secondary/20 text-secondary/90"
                          : "bg-error/5 border-error/20 text-error/90"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="material-symbols-outlined text-sm">
                          {selectedOptionIndex === nodeDetails.quiz[currentQuestionIndex].answer ? 'check_circle' : 'info'}
                        </span>
                        <p className="font-black uppercase tracking-widest text-[9px]">
                          {selectedOptionIndex === nodeDetails.quiz[currentQuestionIndex].answer
                            ? "Correct"
                            : "Incorrect"}
                        </p>
                      </div>
                      <p className="font-medium opacity-80">
                        {nodeDetails.quiz[currentQuestionIndex].explanation}
                      </p>
                    </motion.div>
                  )}

                  <div className="flex justify-end pt-1 relative z-10">
                    {!quizSubmitted ? (
                      <button
                        onClick={handleAnswerSubmit}
                        disabled={selectedOptionIndex === null}
                        className="w-full py-2.5 bg-[#bd9dff] text-background font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-[#bd9dff]/90 active:scale-[0.98] transition-all disabled:opacity-40 shadow-lg shadow-[#bd9dff]/20"
                      >
                        Submit Answer
                      </button>
                    ) : (
                      <button
                        onClick={handleNextQuizQuestion}
                        className="w-full py-2.5 bg-surface-container-highest text-on-surface font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-surface-variant active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        {currentQuestionIndex >= nodeDetails.quiz.length - 1
                          ? "Finish Quiz"
                          : "Next Question"}
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* AI Tutor Chat */}
              <div
                className="border-t border-outline-variant/10 pt-4 flex flex-col"
                style={{ minHeight: "280px" }}
              >
                <h4 className="text-xs font-bold text-[#bd9dff] uppercase tracking-wider mb-2">
                  Conceptual AI Tutor
                </h4>
                <div
                  className="flex-1 overflow-y-auto space-y-2.5 p-3 border border-outline-variant/5 rounded-xl bg-surface-container/30 custom-scrollbar mb-3 text-[11px]"
                  style={{ maxHeight: "240px" }}
                >
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-lg max-w-[92%] ${
                        msg.sender === "ai"
                          ? "bg-surface-container text-on-surface mr-auto border border-outline-variant/10"
                          : "bg-[#bd9dff] text-background font-medium ml-auto"
                      }`}
                    >
                      {msg.sender === "ai" ? (
                        <div className="markdown-content text-[11px] leading-relaxed">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              h1: ({children}) => <h1 className="text-sm font-black text-secondary mt-3 mb-1 border-b border-secondary/10 pb-1">{children}</h1>,
                              h2: ({children}) => <h2 className="text-xs font-bold text-on-surface mt-2 mb-1">{children}</h2>,
                              p: ({children}) => <p className="my-1.5">{children}</p>,
                              ul: ({children}) => <ul className="my-1.5 pl-4 list-disc space-y-0.5">{children}</ul>,
                              ol: ({children}) => <ol className="my-1.5 pl-4 list-decimal space-y-0.5">{children}</ol>,
                              code: ({inline, children}) => inline
                                ? <code className="bg-secondary/10 px-1 rounded text-[10px] text-secondary font-mono">{children}</code>
                                : <pre className="bg-black/20 rounded-lg p-2 overflow-x-auto my-2"><code className="text-[10px] text-secondary font-mono">{children}</code></pre>,
                              table: ({children}) => (
                                <div className="my-3 overflow-x-auto rounded-lg border border-outline-variant/10 bg-black/5">
                                  <table className="w-full text-[10px] border-collapse">{children}</table>
                                </div>
                              ),
                              th: ({children}) => <th className="px-2 py-1.5 text-left font-bold text-secondary border-b border-outline-variant/10">{children}</th>,
                              td: ({children}) => <td className="px-2 py-1.5 border-b border-outline-variant/5 text-on-surface-variant">{children}</td>,
                            }}
                          >
                            {preprocessMath(msg.text)}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        msg.text
                      )}
                    </div>
                  ))}
                  {chatLoading && (
                    <p className="text-[10px] text-[#bd9dff] animate-pulse italic">
                      Tutor is writing...
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <input
                    type="text"
                    placeholder="Ask the tutor..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    disabled={chatLoading}
                    className="flex-1 px-3 py-2.5 text-xs bg-surface-container rounded-lg border border-outline-variant/10 focus:outline-none focus:border-[#bd9dff] text-on-surface"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={chatLoading}
                    className="px-4 bg-[#bd9dff] text-background font-bold text-xs rounded-lg hover:bg-[#bd9dff]/80 transition-all flex items-center justify-center"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-on-surface-variant/40 italic">
                Unable to load node details.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <span className="material-symbols-outlined text-4xl text-[#bd9dff] opacity-30 mb-3">
            hub
          </span>
          <h3 className="text-sm font-bold text-on-surface-variant mb-1">
            No node selected
          </h3>
          <p className="text-xs text-on-surface-variant/40 max-w-xs mb-4">
            Go to the Canvas tab and tap any node to explore it.
          </p>
          <button
            onClick={() => setMobileTab("canvas")}
            className="md:hidden px-4 py-2 bg-[#bd9dff]/10 border border-[#bd9dff]/30 text-[#bd9dff] text-xs font-bold rounded-lg flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">
              space_dashboard
            </span>
            Go to Canvas
          </button>
        </div>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <ConfirmModal
        open={deleteModalOpen}
        title="Delete Canvas?"
        description="This will permanently remove this learning space and all its concept nodes. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        danger
        onConfirm={confirmDeleteCanvas}
        onCancel={() => {
          setDeleteModalOpen(false);
          setCanvasToDelete(null);
        }}
      />

      {/* ── Guide Confirmation Modal ── */}
      <ConfirmModal
        open={confirmNeverShowOpen}
        title="Never show this guide again?"
        description="You can always bring it back later from the menu if you need it."
        confirmLabel="Yes, never show"
        cancelLabel="Dismiss for now"
        danger={false}
        onConfirm={() => handleDismissGuide(true)}
        onCancel={() => handleDismissGuide(false)}
      />

      {/* ── Interactive InSpace Guide ── */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="mb-6 bg-surface-container-high border border-primary/30 rounded-2xl p-5 relative overflow-hidden"
          >
            {/* Background glow */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 blur-[60px] rounded-full pointer-events-none" />

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="material-symbols-outlined text-3xl text-primary">rocket_launch</span>
                  <h2 className="text-lg font-black text-on-surface tracking-tight">Welcome to InSpace! 🚀</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
                  <div className="p-3 rounded-xl bg-surface-container/60 border border-outline-variant/10">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-base text-secondary">folder_open</span>
                      <span className="text-[11px] font-black uppercase tracking-wider text-secondary">Step 1</span>
                    </div>
                    <h4 className="text-sm font-bold text-on-surface mb-1">Pick Your Course (Optional)</h4>
                    <p className="text-[11px] text-on-surface-variant/80">Select a course to ground the AI in your documents, or skip to use general knowledge.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container/60 border border-outline-variant/10">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-base text-secondary">edit_square</span>
                      <span className="text-[11px] font-black uppercase tracking-wider text-secondary">Step 2</span>
                    </div>
                    <h4 className="text-sm font-bold text-on-surface mb-1">Enter Any Topic</h4>
                    <p className="text-[11px] text-on-surface-variant/80">Tell InSpace what to learn—anything from "Quantum Physics" to "History of Art". No limits!</p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container/60 border border-outline-variant/10">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-base text-secondary">space_dashboard</span>
                      <span className="text-[11px] font-black uppercase tracking-wider text-secondary">Step 3</span>
                    </div>
                    <h4 className="text-sm font-bold text-on-surface mb-1">Explore the Canvas</h4>
                    <p className="text-[11px] text-on-surface-variant/80">Drag to pan, pinch to zoom, tap nodes to dive deeper into concepts.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container/60 border border-outline-variant/10">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-base text-secondary">psychology</span>
                      <span className="text-[11px] font-black uppercase tracking-wider text-secondary">Step 4</span>
                    </div>
                    <h4 className="text-sm font-bold text-on-surface mb-1">Master the Topic</h4>
                    <p className="text-[11px] text-on-surface-variant/80">Take quizzes, chat with the AI tutor, and build permanent mastery!</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <button
                  onClick={() => setShowGuide(false)}
                  className="text-on-surface-variant hover:text-on-surface-variant transition-colors"
                  title="Close guide"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setConfirmNeverShowOpen(true)}
                    className="text-[11px] font-semibold text-on-surface-variant/60 hover:text-error transition-colors"
                  >
                    Never show again
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Show Guide Button (only when guide is hidden, not permanently) ── */}
      {!showGuide && !localStorage.getItem(HIDE_INSPACE_GUIDE_KEY) && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setShowGuide(true)}
            className="px-4 py-2 bg-primary/10 border border-primary/30 text-primary text-[11px] font-bold rounded-xl flex items-center gap-2 hover:bg-primary/15 transition-colors"
          >
            <span className="material-symbols-outlined text-base">help</span>
            Show InSpace Guide
          </button>
        </div>
      )}

      {/* ── DESKTOP (md+): 3-column side-by-side layout ── */}
      <div className="hidden md:flex flex-row h-[calc(100vh-120px)] min-h-[750px] gap-6 overflow-hidden select-none">
          {/* Left */}
          <div className={`${isLauncherCollapsed ? "w-0" : "w-80"} bg-[#141f16] border border-outline-variant/10 rounded-2xl flex flex-col shrink-0 overflow-hidden transition-all duration-200`}>
           {renderLauncherPanel()}
         </div>

        {/* Centre canvas */}
        <div
          className="flex-1 bg-[#141f16]/40 border border-outline-variant/10 rounded-2xl overflow-hidden flex flex-col"
          style={{ backgroundImage: "none" }}
        >
          {renderCanvas()}
        </div>

        {/* Right — slides in when node selected */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 80 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="w-96 bg-[#141f16] border border-outline-variant/10 rounded-2xl flex flex-col shrink-0 overflow-hidden"
            >
              {renderDetails()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── MOBILE (< md): single-panel + bottom tab bar ── */}
      <div
        className="flex md:hidden flex-col select-none relative pb-24"
        style={{ height: "calc(100dvh - 120px)" }}
      >
        {/* Active panel — fills all available space above tab bar */}
        <div className="flex-1 overflow-hidden bg-[#141f16] border border-outline-variant/10 rounded-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={mobileTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="h-full"
            >
              {mobileTab === "launcher" && renderLauncherPanel()}
              {mobileTab === "canvas" && (
                <div
                  className="h-full bg-[#141f16]/40 border-0 rounded-2xl overflow-hidden flex flex-col"
                  style={{
                    backgroundImage:
                      "radial-gradient(rgba(189,157,255,0.06) 1.5px, transparent 1.5px)",
                    backgroundSize: "24px 24px",
                  }}
                >
                  {renderCanvas()}
                </div>
              )}
              {mobileTab === "details" && renderDetails()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Tab Bar — Fixed at bottom of screen on mobile */}
        <div className="fixed bottom-6 left-6 right-6 z-[100] flex items-center bg-surface-container/95 backdrop-blur-md border border-outline-variant/20 rounded-2xl px-2 py-2 gap-1 shadow-2xl">
          {TABS.map((tab) => {
            const isActive = mobileTab === tab.id;
            const isDisabled = tab.disabled;
            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && setMobileTab(tab.id)}
                disabled={isDisabled}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all relative ${
                  isActive
                    ? "bg-[#bd9dff]/10 text-primary"
                    : isDisabled
                      ? "text-on-surface-variant/20 cursor-not-allowed"
                      : "text-on-surface-variant/50 hover:text-primary active:bg-[#bd9dff]/5"
                }`}
              >
                <span className="material-symbols-outlined text-xl">
                  {tab.icon}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider">
                  {tab.label}
                </span>
                {tab.id === "details" && selectedNode && (
                  <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-[#bd9dff] mt-1 mr-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
