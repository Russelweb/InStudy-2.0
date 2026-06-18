import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAura } from '../context/AuraContext';
import { chatService } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

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

const AuraQuickChat = () => {
  const { isQuickChatOpen, toggleQuickChat, triggerAura, quickChatQuery, setQuickChatQuery, personality } = useAura();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isQuickChatOpen) {
      inputRef.current?.focus();
    }
  }, [isQuickChatOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (quickChatQuery && isQuickChatOpen && !isLoading) {
      const handleInitialQuery = async () => {
        const queryText = quickChatQuery;
        setQuickChatQuery(null); // Clear it immediately to prevent loops

        const userMessage = { role: 'user', content: queryText };
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        triggerAura('thinking');

        try {
          const apiQuery = `[QUICK_CHAT] ${queryText}`;
          const res = await chatService.sendMessage(apiQuery, 'general', false, personality);
          const data = res.data;
          setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
          triggerAura('idle');
        } catch (error) {
          setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting to my neural core. Give me a moment and try again!" }]);
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

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    triggerAura('thinking');

    try {
      // Use 'general' course_id for quick chat without a specific context
      const apiQuery = `[QUICK_CHAT] ${userMessage.content}`;
      const res = await chatService.sendMessage(apiQuery, 'general', false, personality);
      const data = res.data;

      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
      triggerAura('idle');
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting to my neural core. Give me a moment and try again!" }]);
      triggerAura('concerned');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isQuickChatOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-16 right-0 w-80 sm:w-96 glass rounded-3xl shadow-2xl overflow-hidden flex flex-col mb-4 border border-outline-variant/30"
          style={{ height: '400px', background: 'rgba(24,32,25,0.85)', backdropFilter: 'blur(20px)' }}
        >
          {/* Header */}
          <div className="p-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container/50">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">auto_awesome</span>
              <span className="text-sm font-black uppercase tracking-widest text-on-surface">Aura Quick Chat</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMessages([])}
                className="text-on-surface-variant hover:text-error transition-colors p-1 rounded-full hover:bg-error/10"
                title="Clear Chat"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
              <button
                onClick={toggleQuickChat}
                className="text-on-surface-variant hover:text-primary transition-colors p-1 rounded-full hover:bg-primary/10"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                <span className="material-symbols-outlined text-4xl mb-2 text-primary">forum</span>
                <p className="text-sm text-on-surface-variant">Ask me anything without leaving your workflow!</p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed overflow-x-auto ${msg.role === 'user'
                      ? 'bg-primary/20 text-on-surface self-end rounded-br-sm'
                      : 'bg-surface-container-high border border-outline-variant/10 text-on-surface self-start rounded-bl-sm'
                    }`}
                >
                  {msg.role === 'user' ? (
                    msg.content
                  ) : (
                    <div className="markdown-content text-on-surface-variant/90 space-y-1">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          h1: ({children}) => <h1 className="text-sm font-black text-secondary mt-2 mb-1 pb-0.5 border-b border-secondary/20">{children}</h1>,
                          h2: ({children}) => <h2 className="text-xs font-bold text-on-surface mt-2 mb-1">{children}</h2>,
                          h3: ({children}) => <h3 className="text-[11px] font-bold text-secondary/80 mt-1.5 mb-0.5">{children}</h3>,
                          p: ({children}) => <p className="my-1 leading-relaxed text-on-surface-variant/90">{children}</p>,
                          ul: ({children}) => <ul className="my-1 pl-4 space-y-0.5 list-disc text-on-surface-variant">{children}</ul>,
                          ol: ({children}) => <ol className="my-1 pl-4 space-y-0.5 list-decimal text-on-surface-variant">{children}</ol>,
                          li: ({children}) => <li className="leading-relaxed">{children}</li>,
                          strong: ({children}) => <strong className="font-bold text-secondary">{children}</strong>,
                          em: ({children}) => <em className="italic text-on-surface-variant">{children}</em>,
                          code: ({inline, children}) => inline
                            ? <code className="bg-secondary/10 px-1 py-0.5 rounded text-[11px] text-secondary font-mono font-medium">{children}</code>
                            : <div className="relative group my-1.5">
                                <pre className="bg-surface-container-highest/50 rounded-lg p-2 overflow-x-auto border border-outline-variant/10 shadow-inner">
                                  <code className="text-[10px] text-secondary font-mono leading-normal">{children}</code>
                                </pre>
                              </div>,
                          pre: ({children}) => <>{children}</>,
                          blockquote: ({children}) => <blockquote className="border-l-2 border-secondary/30 bg-secondary/5 pl-2 py-0.5 my-1.5 text-on-surface-variant italic rounded-r">{children}</blockquote>,
                          table: ({children}) => (
                            <div className="my-2 overflow-x-auto rounded-lg border border-outline-variant/20 shadow-sm bg-surface-container-low/50">
                              <table className="w-full text-[10px] border-collapse">{children}</table>
                            </div>
                          ),
                          thead: ({children}) => <thead className="bg-secondary/10">{children}</thead>,
                          th: ({children}) => <th className="px-1.5 py-1 text-left font-black text-secondary border-b border-outline-variant/20 uppercase tracking-wider text-[8px]">{children}</th>,
                          td: ({children}) => <td className="px-1.5 py-1 border-b border-outline-variant/10 text-on-surface-variant leading-relaxed">{children}</td>,
                          a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-secondary underline decoration-secondary/30 underline-offset-2 hover:text-secondary-fixed transition-colors font-medium">{children}</a>,
                          hr: () => <hr className="border-outline-variant/10 my-2" />,
                        }}
                      >
                        {preprocessMath(msg.content)}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="bg-surface-container-high border border-outline-variant/10 text-on-surface self-start rounded-bl-sm rounded-2xl p-3 max-w-[85%] flex gap-1 items-center">
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-outline-variant/20 bg-surface-container/30">
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Aura..."
                className="w-full bg-surface text-on-surface placeholder:text-on-surface-variant/50 border border-outline-variant/30 rounded-xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-1.5 bg-primary text-on-primary rounded-lg disabled:opacity-30 disabled:hover:bg-primary transition-all hover:bg-primary-hover flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-sm">send</span>
              </button>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AuraQuickChat;
