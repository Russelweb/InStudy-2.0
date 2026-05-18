import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { chatService } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ConfirmModal } from './Modal';
import { useAura } from '../context/AuraContext';

/**
 * Best-effort converter: wraps common plain-text math patterns in LaTeX delimiters
 * so KaTeX can render them even when the LLM forgets to use $...$.
 */
function preprocessMath(text) {
  if (!text) return text;

  // Already has LaTeX delimiters — leave it alone
  if (/\$/.test(text)) return text;

  return text
    // Fractions: a/b where a and b are expressions  e.g. d/dx, dy/dx, 1/2
    .replace(/\b(d\/d[a-z]|[a-z]\/[a-z]|\d+\/\d+)\b/g, (m) => `$${m}$`)
    // Superscripts: x^2, x^n, e^x, sin^2
    .replace(/([a-zA-Z\d]+)\^(\{[^}]+\}|[a-zA-Z\d]+)/g, (m) => `$${m}$`)
    // Common functions with args: sin(x), cos(x^2), ln(x), log(x), sqrt(x)
    .replace(/\b(sin|cos|tan|cot|sec|csc|ln|log|exp|sqrt|lim|sum|int)\s*\(([^)]+)\)/g, (m) => `$${m}$`)
    // Derivatives: f'(x), f''(x)
    .replace(/\b([a-zA-Z])'+'?\s*\([^)]+\)/g, (m) => `$${m}$`)
    // Greek letters written out: alpha, beta, theta, etc.
    .replace(/\b(alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|omega|phi|psi)\b/g, (m) => `$\\${m}$`)
    // Standalone equations with = sign containing math chars: f'(x) = 2x
    .replace(/([a-zA-Z][a-zA-Z0-9'_^()*/+\-\s]*=[a-zA-Z0-9'_^()*/+\-\s]+)/g, (m) => {
      // Only wrap if it looks like math (contains ^, *, or known functions)
      if (/[\^*]|sin|cos|tan|ln|sqrt|d\/d/.test(m)) return `$${m.trim()}$`;
      return m;
    });
}

const AITutorChat = ({ courseId }) => {
  const { personality } = useAura();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [useEli12, setUseEli12] = useState(false);
  const scrollRef = useRef(null);
  const abortRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Load persisted chat history
  useEffect(() => {
    if (courseId) {
      const savedMessages = localStorage.getItem(`chat_history_${courseId}`);
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      } else {
        setMessages([{
          type: 'ai',
          text: `Neural link established for this course. Ask me anything about your documents.`,
        }]);
      }
    }
  }, [courseId]);

  // Persist messages on change
  useEffect(() => {
    if (courseId && messages.length > 0) {
      localStorage.setItem(`chat_history_${courseId}`, JSON.stringify(messages));
    }
  }, [messages, courseId]);

  const appendChunkToLast = (chunk) => {
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last && last.type === 'ai' && last.streaming) {
        updated[updated.length - 1] = { ...last, text: last.text + chunk };
      }
      return updated;
    });
  };

  const finalizeLastMessage = (sources = []) => {
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last && last.streaming) {
        updated[updated.length - 1] = { ...last, streaming: false, sources };
      }
      return updated;
    });
  };

  const handleSend = async () => {
    const question = input.trim();
    if (!question || isStreaming) return;
    if (!courseId) {
      setMessages((prev) => [...prev, { type: 'ai', text: 'No course selected. Please open a workspace first.', isError: true }]);
      return;
    }

    setInput('');
    setMessages((prev) => [...prev, { type: 'user', text: question }]);
    setIsStreaming(true);

    // Add a streaming placeholder
    setMessages((prev) => [...prev, { type: 'ai', text: '', streaming: true, sources: [] }]);

    try {
      const fetchResponse = await chatService.streamMessage(question, courseId, useEli12, personality);

      if (!fetchResponse.ok) {
        throw new Error(`Server error: ${fetchResponse.status}`);
      }

      const reader = fetchResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let collectedSources = [];

      abortRef.current = () => reader.cancel();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'metadata') {
              collectedSources = data.sources || [];
            } else if (data.type === 'content') {
              appendChunkToLast(data.text);
            } else if (data.type === 'done') {
              finalizeLastMessage(collectedSources);
            } else if (data.type === 'error') {
              appendChunkToLast(`\n\n⚠️ ${data.message}`);
              finalizeLastMessage([]);
            }
          } catch { /* Ignore malformed JSON */ }
        }
      }
      finalizeLastMessage(collectedSources);
    } catch (error) {
      if (error.name !== 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.streaming) {
            updated[updated.length - 1] = {
              type: 'ai',
              text: `Connection error: ${error.message}`,
              streaming: false,
              isError: true,
            };
          }
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current();
      finalizeLastMessage([]);
      setIsStreaming(false);
    }
  };

  return (
    <div className="glass-panel rounded-xl w-full h-full flex flex-col border border-secondary/10 overflow-hidden min-w-0 shrink-0">
      {/* Chat Header */}
      <div className="px-6 py-4 flex justify-between items-center bg-surface-container-low shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-yellow-400 animate-ping' : 'bg-secondary animate-pulse'} shadow-[0_0_8px_#69f6b8]`}></div>
          <span className="text-xs font-bold tracking-tighter text-secondary">
            {isStreaming ? 'InStudy is Processing...' : 'InTeacher is LIVE'}
          </span>
          <button 
            onClick={() => setClearModalOpen(true)}
            className="text-[10px] text-on-surface-variant hover:text-error transition-colors"
            title="Clear Chat History"
          >
            <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
          </button>
        </div>
        {/* ELI12 Toggle */}
        <button
          onClick={() => setUseEli12((v) => !v)}
          className={`flex items-center gap-2 bg-black/40 rounded-full px-3 py-1 border transition-colors ${useEli12 ? 'border-secondary/40 text-secondary' : 'border-outline-variant/20 text-on-surface-variant'}`}
          title="Toggle Simple Mode (Explain Like I'm 12)"
        >
          <span className="text-[9px] uppercase tracking-widest font-bold">Simple Mode</span>
          <div className={`w-8 h-4 rounded-full relative transition-colors ${useEli12 ? 'bg-secondary/40' : 'bg-surface-variant'}`}>
            <div className={`absolute top-1 w-2 h-2 rounded-full transition-all ${useEli12 ? 'bg-secondary right-1' : 'bg-on-surface-variant/40 left-1'}`}></div>
          </div>
        </button>
      </div>

      {/* Chat Thread */}
      <div
        ref={scrollRef}
        className="flex-grow overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar"
      >
        {messages.map((ms, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`flex gap-4 max-w-[90%] ${ms.type === 'user' ? 'self-end flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ms.type === 'ai' ? 'bg-secondary-container/40 shadow-lg shadow-primary/20' : 'bg-primary/20 border border-primary/40'}`}>
              <span className="material-symbols-outlined text-sm text-on-surface">
                {ms.type === 'ai' ? 'psychology' : 'person'}
              </span>
            </div>
            <div className={`backdrop-blur-md rounded-2xl p-4 border ${
              ms.type === 'ai'
                ? `bg-secondary/5 border-secondary/20 rounded-tl-none ${ms.isError ? 'border-error/30 bg-error/5' : ''}`
                : 'bg-primary/10 border-primary/20 rounded-tr-none'
            }`}>
              {ms.type === 'ai' ? (
                <div className="text-sm leading-relaxed text-on-surface">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      h1: ({children}) => <h1 className="text-base font-bold text-on-surface mt-3 mb-1">{children}</h1>,
                      h2: ({children}) => <h2 className="text-sm font-bold text-on-surface mt-3 mb-1">{children}</h2>,
                      h3: ({children}) => <h3 className="text-sm font-semibold text-secondary mt-2 mb-1">{children}</h3>,
                      p: ({children}) => <p className="my-1 leading-relaxed">{children}</p>,
                      ul: ({children}) => <ul className="my-1 pl-4 space-y-0.5 list-disc">{children}</ul>,
                      ol: ({children}) => <ol className="my-1 pl-4 space-y-0.5 list-decimal">{children}</ol>,
                      li: ({children}) => <li className="text-on-surface-variant">{children}</li>,
                      strong: ({children}) => <strong className="font-bold text-secondary">{children}</strong>,
                      em: ({children}) => <em className="italic text-on-surface-variant">{children}</em>,
                      code: ({inline, children}) => inline
                        ? <code className="bg-surface-container-highest px-1 py-0.5 rounded text-xs text-secondary font-mono">{children}</code>
                        : <pre className="bg-surface-container-highest rounded-xl p-3 overflow-x-auto my-2"><code className="text-xs text-secondary font-mono">{children}</code></pre>,
                      pre: ({children}) => <>{children}</>,
                      blockquote: ({children}) => <blockquote className="border-l-2 border-secondary/40 pl-3 my-2 text-on-surface-variant italic">{children}</blockquote>,
                      table: ({children}) => <div className="overflow-x-auto my-2"><table className="w-full text-xs border-collapse">{children}</table></div>,
                      thead: ({children}) => <thead className="bg-surface-container-highest">{children}</thead>,
                      th: ({children}) => <th className="px-3 py-2 text-left font-bold text-on-surface border border-outline-variant/20">{children}</th>,
                      td: ({children}) => <td className="px-3 py-2 border border-outline-variant/10 text-on-surface-variant">{children}</td>,
                      a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-secondary underline hover:opacity-80">{children}</a>,
                      hr: () => <hr className="border-outline-variant/20 my-3" />,
                    }}
                  >
                    {preprocessMath(ms.text)}
                  </ReactMarkdown>
                  {ms.streaming && <span className="inline-block w-1.5 h-4 bg-secondary ml-0.5 animate-pulse rounded-sm align-middle" />}
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-primary-fixed-dim whitespace-pre-wrap">
                  {ms.text}
                </p>
              )}
              {/* Sources */}
              {ms.sources && ms.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-secondary/10 flex flex-wrap gap-2">
                  {ms.sources.map((src, si) => (
                    <span key={si} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/10 text-secondary font-bold">
                      📄 {src}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-surface-container-low border-t border-outline-variant/10 shrink-0 space-y-2">
        {isStreaming && (
          <button
            onClick={handleStop}
            className="w-full py-2 text-xs font-bold uppercase tracking-widest text-error border border-error/20 rounded-lg hover:bg-error/5 transition-colors"
          >
            ⏹ Stop Generation
          </button>
        )}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="relative"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isStreaming}
            className="w-full bg-surface-container-high border-none rounded-xl py-4 pl-4 pr-14 text-sm text-on-surface focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-on-surface-variant/40 disabled:opacity-50"
            placeholder={isStreaming ? 'Aether is responding...' : 'Inquire with the Neural Interface...'}
            type="text"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-primary hover:scale-110 transition-transform disabled:opacity-40"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </form>
      </div>

      {/* Clear chat confirm modal */}
      <ConfirmModal
        open={clearModalOpen}
        title="Clear Chat History?"
        description="All messages in this conversation will be removed. Your mastery data is not affected."
        confirmLabel="Clear History"
        cancelLabel="Keep It"
        danger
        onConfirm={() => {
          setClearModalOpen(false);
          setMessages([{ type: 'ai', text: 'Chat cleared. How can I help you?' }]);
          localStorage.removeItem(`chat_history_${courseId}`);
        }}
        onCancel={() => setClearModalOpen(false)}
      />
    </div>
  );
};

export default AITutorChat;
