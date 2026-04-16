import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/api';

const Signup = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirm_password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.signup(formData);
      // Auto-login after signup so we can redirect straight to onboarding
      if (res.data?.success && res.data?.session_token) {
        localStorage.setItem('auth_token', res.data.session_token);
        if (res.data.user) localStorage.setItem('user_info', JSON.stringify(res.data.user));
      } else {
        // Fallback: log them in manually
        await authService.login(formData.email, formData.password);
      }
      // Mark as new user so Dashboard shows the welcome modal
      localStorage.setItem('is_new_user', 'true');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. User may already exist.');
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (e) => setFormData({ ...formData, [field]: e.target.value });

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#040805] relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-secondary/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md px-4 z-10"
      >
        <div className="glass-panel p-10 rounded-2xl border border-outline-variant/10 shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-1 signature-gradient opacity-50 rounded-t-2xl"></div>

          <div className="text-center mb-10">
            <h1 className="text-4xl font-black tracking-tighter text-on-surface mb-2">Join InStudy</h1>
            <p className="text-xs text-on-surface-variant uppercase tracking-[0.4em] font-bold">Forge Your Neural ID</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-6">
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
              <label className="text-[10px] font-black uppercase tracking-widest text-[#69f6b8]/60 ml-1">Email</label>
              <input
                required
                type="email"
                value={formData.email}
                onChange={update('email')}
                className="w-full bg-surface-container-high border-none rounded-xl py-4 px-4 text-sm text-on-surface focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-on-surface-variant/30"
                placeholder="architect@instudy.ai"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#bd9dff]/60 ml-1">Password</label>
              <input
                required
                type="password"
                value={formData.password}
                onChange={update('password')}
                className="w-full bg-surface-container-high border-none rounded-xl py-4 px-4 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50 transition-all placeholder:text-on-surface-variant/30"
                placeholder="••••••••••••"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#bd9dff]/60 ml-1">Confirm Password</label>
              <input
                required
                type="password"
                value={formData.confirm_password}
                onChange={update('confirm_password')}
                className="w-full bg-surface-container-high border-none rounded-xl py-4 px-4 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50 transition-all placeholder:text-on-surface-variant/30"
                placeholder="••••••••••••"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl signature-gradient text-on-primary font-black text-sm uppercase tracking-widest shadow-lg scale-100 hover:scale-[1.02] active:scale-95 transition-transform relative overflow-hidden group disabled:opacity-60 disabled:cursor-not-allowed text-white opacity-90"
            >
              {loading
                ? <span className="material-symbols-outlined animate-spin">sync</span>
                : 'Become An InStudent'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-xs text-on-surface-variant">
              Already have an ID?{' '}
              <Link to="/login" className="text-secondary font-bold hover:underline underline-offset-4">
                Login Here
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;
