import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { chatService } from '../services/api';

const AITutorChat = ({ courseId }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [useEli12, setUseEli12] = useState(false);
  const scrollRef = useRef(null);
  const abortRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Add a welcome message when a course is loaded
  useEffect(() => {
    if (courseId) {
      setMessages([{
        type: 'ai',
        text: `Neural link established for this course. Ask me anything about your documents.`,
      }]);
    }
  }, [courseId]);

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
      const fetchResponse = await chatService.streamMessage(question, courseId, useEli12);

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
    <div className="glass-panel rounded-xl w-[45%] flex flex-col border border-secondary/10 overflow-hidden min-w-0 shrink-0">
      {/* Chat Header */}
      <div className="px-6 py-4 flex justify-between items-center bg-surface-container-low shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-yellow-400 animate-ping' : 'bg-secondary animate-pulse'} shadow-[0_0_8px_#69f6b8]`}></div>
          <span className="text-xs font-bold tracking-tighter uppercase text-secondary">
            {isStreaming ? 'Aether Processing...' : 'Neural Analyst Live'}
          </span>
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
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ms.type === 'ai' ? 'signature-gradient shadow-lg shadow-primary/20' : 'bg-primary/20 border border-primary/40'}`}>
              <span className="material-symbols-outlined text-sm text-on-surface">
                {ms.type === 'ai' ? 'psychology' : 'person'}
              </span>
            </div>
            <div className={`backdrop-blur-md rounded-2xl p-4 border ${
              ms.type === 'ai'
                ? `bg-secondary/5 border-secondary/20 rounded-tl-none ${ms.isError ? 'border-error/30 bg-error/5' : ''}`
                : 'bg-primary/10 border-primary/20 rounded-tr-none'
            }`}>
              <p className={`text-sm leading-relaxed whitespace-pre-wrap ${ms.type === 'ai' ? 'text-on-surface' : 'text-primary-fixed-dim'}`}>
                {ms.text}
                {ms.streaming && <span className="inline-block w-1.5 h-4 bg-secondary ml-0.5 animate-pulse rounded-sm align-middle" />}
              </p>
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
      <div className="p-4 bg-surface-container-lowest border-t border-outline-variant/10 shrink-0 space-y-2">
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
    </div>
  );
};

export default AITutorChat;
