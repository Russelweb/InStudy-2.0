import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAura } from '../context/AuraContext';
import { chatService } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ---------------------------------------------------------------------------
// Renders Aura's markdown response with clean, readable formatting
// ---------------------------------------------------------------------------
const AuraMessage = ({ content }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      p: ({ children }) => (
        <p className="text-sm text-on-surface leading-relaxed mb-2 last:mb-0">{children}</p>
      ),
      strong: ({ children }) => (
        <strong className="font-black text-primary">{children}</strong>
      ),
      em: ({ children }) => (
        <em className="italic text-on-surface-variant">{children}</em>
      ),
      h1: ({ children }) => (
        <h1 className="text-sm font-black text-primary uppercase tracking-wider mb-2 mt-3 first:mt-0">{children}</h1>
      ),
      h2: ({ children }) => (
        <h2 className="text-sm font-black text-primary mb-1.5 mt-3 first:mt-0">{children}</h2>
      ),
      h3: ({ children }) => (
        <h3 className="text-xs font-black text-primary/80 uppercase tracking-wide mb-1 mt-2 first:mt-0">{children}</h3>
      ),
      ul: ({ children }) => (
        <ul className="space-y-1.5 my-2 pl-0">{children}</ul>
      ),
      ol: ({ children }) => (
        <ol className="space-y-1.5 my-2 pl-4 list-decimal">{children}</ol>
      ),
      li: ({ children }) => (
        <li className="text-sm text-on-surface leading-snug flex gap-2">
          <span className="text-primary shrink-0 mt-0.5 select-none">•</span>
          <span>{children}</span>
        </li>
      ),
      code: ({ inline, children }) =>
        inline ? (
          <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
        ) : (
          <pre className="bg-surface-container-highest rounded-xl p-3 overflow-x-auto my-2 border border-outline-variant/10">
            <code className="text-xs text-secondary font-mono leading-relaxed">{children}</code>
          </pre>
        ),
      blockquote: ({ children }) => (
        <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-on-surface-variant italic text-sm rounded-r-lg bg-primary/5 py-2 pr-2">
          {children}
        </blockquote>
      ),
      hr: () => <hr className="border-outline-variant/20 my-3" />,
      a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer"
          className="text-secondary underline decoration-secondary/30 underline-offset-2 hover:text-secondary-dim transition-colors text-sm">
          {children}
        </a>
      ),
      table: ({ children }) => (
        <div className="my-2 overflow-x-auto rounded-lg border border-outline-variant/15">
          <table className="w-full text-xs border-collapse">{children}</table>
        </div>
      ),
      th: ({ children }) => (
        <th className="px-3 py-2 text-left font-black text-primary bg-primary/8 border-b border-outline-variant/15 uppercase tracking-wider text-[10px]">
          {children}
        </th>
      ),
      td: ({ children }) => (
        <td className="px-3 py-2 border-b border-outline-variant/8 text-on-surface-variant leading-snug">{children}</td>
      ),
    }}
  >
    {content}
  </ReactMarkdown>
);

// ---------------------------------------------------------------------------
// AuraQuickChat component
// ---------------------------------------------------------------------------
const AuraQuickChat = () => {
  const { isQuickChatOpen, toggleQuickChat, triggerAura, quickChatQuery, setQuickChatQuery, personality } = useAura();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isQuickChatOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isQuickChatOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle pre-filled query (e.g. from Aura proactive suggestions)
  useEffect(() => {
    if (quickChatQuery && isQuickChatOpen && !isLoading) {
      const handleInitialQuery = async () => {
        const queryText = quickChatQuery;
        setQuickChatQuery(null);

        setMessages(prev => [...prev, { role: 'user', content: queryText }]);
        setIsLoading(true);
        triggerAura('thinking');

        try {
          const res = await chatService.sendMessage(`[QUICK_CHAT] ${queryText}`, 'general', false, personality);
          setMessages(prev => [...prev, { role: 'assistant', content: res.data.answer }]);
          triggerAura('idle');
        } catch {
          setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting. Give me a moment and try again." }]);
          triggerAura('concerned');
        } finally {
          setIsLoading(false);
        }
      };
      handleInitialQuery();
    }
  }, [quickChatQuery, isQuickChatOpen, isLoading, setQuickChatQuery, triggerAura, personality]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const text = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsLoading(true);
    triggerAura('thinking');

    try {
      const res = await chatService.sendMessage(`[QUICK_CHAT] ${text}`, 'general', false, personality);
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.answer }]);
      triggerAura('idle');
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting. Give me a moment and try again." }]);
      triggerAura('concerned');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isQuickChatOpen && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="absolute bottom-16 right-0 w-[340px] sm:w-[420px] rounded-2xl shadow-2xl overflow-hidden flex flex-col mb-4 border border-outline-variant/25"
          style={{
            height: '480px',
            background: 'rgba(20, 28, 21, 0.95)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container/40 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-sm">auto_awesome</span>
              </div>
              <div>
                <p className="text-xs font-black text-on-surface leading-none">Aura</p>
                <p className="text-[9px] text-on-surface-variant/60 uppercase tracking-widest mt-0.5">Quick Chat</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="text-on-surface-variant/50 hover:text-error transition-colors p-1.5 rounded-lg hover:bg-error/10"
                  title="Clear conversation"
                >
                  <span className="material-symbols-outlined text-sm">delete_sweep</span>
                </button>
              )}
              <button
                onClick={toggleQuickChat}
                className="text-on-surface-variant/50 hover:text-on-surface transition-colors p-1.5 rounded-lg hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-8 px-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-2xl">forum</span>
                </div>
                <div>
                  <p className="text-sm font-black text-on-surface mb-1.5">Ask me anything</p>
                  <p className="text-xs text-on-surface-variant/70 leading-relaxed max-w-[240px]">
                    Quick explanations, concept breakdowns, study tips — without leaving your workflow.
                  </p>
                </div>
                {/* Suggested prompts */}
                <div className="w-full space-y-2 mt-2">
                  {[
                    'Explain this in simple terms',
                    'Give me a quick summary',
                    'What should I study next?',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="w-full text-left px-3 py-2 rounded-xl bg-surface-container/50 border border-outline-variant/15 text-xs text-on-surface-variant hover:text-on-surface hover:border-primary/30 hover:bg-primary/5 transition-all"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-1 ${
                    msg.role === 'user' ? 'text-primary/40' : 'text-secondary/40'
                  }`}>
                    {msg.role === 'user' ? 'You' : 'Aura'}
                  </span>
                  <div className={`max-w-[90%] px-4 py-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-primary/12 border border-primary/18 rounded-tr-sm'
                      : 'bg-surface-container border border-outline-variant/15 rounded-tl-sm'
                  }`}>
                    {msg.role === 'user' ? (
                      <p className="text-sm text-on-surface leading-relaxed">{msg.content}</p>
                    ) : (
                      <AuraMessage content={msg.content} />
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex flex-col items-start gap-1">
                <span className="text-[9px] font-black uppercase tracking-widest px-1 text-secondary/40">Aura</span>
                <div className="bg-surface-container border border-outline-variant/15 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '160ms' }} />
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '320ms' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-outline-variant/20 bg-surface-container/20 shrink-0">
            <form onSubmit={handleSubmit}>
              <div className="relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Aura anything..."
                  disabled={isLoading}
                  className="w-full bg-surface-container text-on-surface placeholder:text-on-surface-variant/40 border border-outline-variant/25 rounded-xl py-2.5 pl-4 pr-11 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-1.5 p-1.5 bg-primary text-on-primary rounded-lg disabled:opacity-30 transition-all hover:bg-primary-fixed flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                </button>
              </div>
            </form>
            <p className="text-[9px] text-on-surface-variant/25 text-center mt-2 leading-none">
              Aura can make mistakes — verify important information
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AuraQuickChat;
