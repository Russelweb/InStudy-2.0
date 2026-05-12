import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '../services/api';

const PolicyOverlay = ({ user, onAccepted }) => {
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const handleAccept = async () => {
    if (!accepted) return;
    setLoading(true);
    try {
      await authService.acceptPolicy();
      // Update local storage
      const updatedUser = { ...user, policy_accepted: true };
      localStorage.setItem('user_info', JSON.stringify(updatedUser));
      onAccepted(updatedUser);
    } catch (err) {
      console.error('Failed to accept policy:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.policy_accepted) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-background/95 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-2xl glass-panel p-8 md:p-12 border border-primary/20 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 signature-gradient opacity-50"></div>
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <span className="material-symbols-outlined text-primary text-3xl">verified_user</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-on-surface">InStudy 2.0 Usage Policy</h2>
          <p className="text-xs text-primary/60 uppercase tracking-[0.3em] font-bold mt-1">Establishing Agreement</p>
        </div>

        <div className="space-y-6 max-h-[40vh] overflow-y-auto pr-4 custom-scrollbar text-sm text-on-surface-variant leading-relaxed">
          <section>
            <h3 className="text-on-surface font-bold mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              AI Accuracy & Hallucinations
            </h3>
            <p>
              InStudy 2.0 utilizes advanced Large Language Models (LLMs) to assist your studies. While highly capable, AI can occasionally generate incorrect, biased, or incomplete information ("hallucinations"). Always verify critical facts, formulas, and definitions with your original study materials.
            </p>
          </section>

          <section>
            <h3 className="text-on-surface font-bold mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              Data Privacy & Processing
            </h3>
            <p>
              Your uploaded documents are processed to create a semantic index for retrieval. If you use user-provided API keys (e.g., Groq), your queries are sent to those third-party providers. We do not use your private study materials to train global AI models without your explicit consent.
            </p>
          </section>

          <section>
            <h3 className="text-on-surface font-bold mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              Responsible Use
            </h3>
            <p>
              This platform is designed to enhance learning, not to facilitate academic dishonesty. Use the AI Tutor, Summaries, and Quizzes to deepen your understanding. You are responsible for ensuring your use of AI complies with your educational institution's policies.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-outline-variant/10">
          <label className="flex items-start gap-3 cursor-pointer group mb-8">
            <input 
              type="checkbox" 
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-outline-variant bg-surface-container text-primary focus:ring-primary/50 transition-all"
            />
            <span className="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">
              I have read and understood the InStudy 2.0 Usage Policy. I acknowledge that InStudy AI is an assistive tool and may occasionally produce inaccurate results.
            </span>
          </label>

          <button
            onClick={handleAccept}
            disabled={!accepted || loading}
            className="w-full py-4 rounded-xl bg-[#551a8b] text-on-white font-black text-sm uppercase tracking-widest shadow-lg scale-100 hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed disabled:scale-100"
          >
            {loading ? (
              <span className="material-symbols-outlined animate-spin">sync</span>
            ) : (
              'Accept & Initialize Platform'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default PolicyOverlay;
