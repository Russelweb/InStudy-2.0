import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await authService.login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Neural authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#040805] relative overflow-hidden">
      {/* Dynamic Background Auras */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md px-4 z-10"
      >
        <div className="glass-panel p-10 rounded-2xl border border-outline-variant/10 shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-1 signature-gradient opacity-50 rounded-t-2xl"></div>
          
          <div className="text-center mb-10">
            <h1 className="text-4xl font-black tracking-tighter text-on-surface mb-2">InStudy 2.0</h1>
            <p className="text-xs text-on-surface-variant uppercase tracking-[0.4em] font-bold">Neural Entry Point</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }}
                className="p-3 rounded bg-error/10 border border-error/20 text-error text-xs font-medium"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#69f6b8]/60 ml-1">Identity (Email)</label>
              <input 
                required
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-container-high border-none rounded-xl py-4 px-4 text-sm text-on-surface focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-on-surface-variant/30"
                placeholder="architect@instudy.ai"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#bd9dff]/60 ml-1">Access Protocol (Password)</label>
              <input 
                required
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-container-high border-none rounded-xl py-4 px-4 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50 transition-all placeholder:text-on-surface-variant/30"
                placeholder="••••••••••••"
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl signature-gradient text-on-primary font-black text-sm uppercase tracking-widest shadow-lg scale-100 hover:scale-[1.02] active:scale-95 transition-transform relative overflow-hidden group"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin">sync</span>
              ) : (
                'Initialize Session'
              )}
            </button>
          </form>

          <div className="mt-8 text-center space-y-4">
            <p className="text-xs text-on-surface-variant">
              New to the system? <Link to="/signup" className="text-secondary font-bold hover:underline underline-offset-4">Register Neural ID</Link>
            </p>
            <Link to="#" className="block text-[10px] text-on-surface-variant/40 hover:text-on-surface-variant transition-colors uppercase tracking-widest">Forgot Access Protocol?</Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
