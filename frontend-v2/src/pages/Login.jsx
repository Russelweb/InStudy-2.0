import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import './AuthPages.css';

/* ── Animation Variants ─────────────────────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

/* ── Particles Array ────────────────────────────────────────────────────── */
const particles = Array.from({ length: 12 }, (_, i) => i + 1);

/* ── Component ──────────────────────────────────────────────────────────── */
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail[0].msg);
      } else {
        setError(detail || 'User authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* ── Animated Background ── */}
      <div className="auth-bg-mesh">
        <div className="auth-orb auth-orb--1" />
        <div className="auth-orb auth-orb--2" />
        <div className="auth-orb auth-orb--3" />
      </div>
      <div className="auth-grid-overlay" />
      <div className="auth-particles">
        {particles.map((n) => (
          <div key={n} className={`auth-particle auth-particle--${n}`} />
        ))}
      </div>

      {/* ── Card ── */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="auth-glass-card"
      >
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Logo */}
          <motion.div variants={itemVariants} className="auth-logo-ring">
            <div className="auth-logo-inner">In</div>
          </motion.div>

          {/* Heading */}
          <motion.h1 variants={itemVariants} className="auth-heading">
            Welcome Back
          </motion.h1>
          <motion.p variants={itemVariants} className="auth-subtext">
            Sign in to continue learning
          </motion.p>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              className="auth-error"
              style={{ marginBottom: '1.25rem' }}
            >
              <span className="material-symbols-outlined auth-error-icon">error</span>
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin}>
            {/* Email */}
            <motion.div variants={itemVariants} style={{ marginBottom: '1.25rem' }}>
              <label className="auth-field-label">Email</label>
              <div className="auth-input-wrapper">
                <span className="material-symbols-outlined auth-input-icon">mail</span>
                <input
                  id="login-email"
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
            </motion.div>

            {/* Password */}
            <motion.div variants={itemVariants} style={{ marginBottom: '0.25rem' }}>
              <label className="auth-field-label">Password</label>
              <div className="auth-input-wrapper">
                <span className="material-symbols-outlined auth-input-icon">lock</span>
                <input
                  id="login-password"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input"
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="auth-toggle-pw"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </motion.div>

            {/* Forgot Password */}
            <motion.div variants={itemVariants}>
              <Link to="/forgot-password" className="auth-forgot-link">
                Forgot password?
              </Link>
            </motion.div>

            {/* Submit */}
            <motion.div variants={itemVariants} style={{ marginTop: '1.75rem' }}>
              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="auth-btn"
              >
                {loading ? (
                  <span className="material-symbols-outlined auth-spinner">sync</span>
                ) : (
                  'Log In'
                )}
              </button>
            </motion.div>
          </form>

          {/* Divider + Signup link */}
          <motion.div variants={itemVariants}>
            <div className="auth-divider">
              <div className="auth-divider-line" />
              <span className="auth-divider-text">or</span>
              <div className="auth-divider-line" />
            </div>

            <p className="auth-footer">
              Don't have an account?{' '}
              <Link to="/signup">Create one</Link>
            </p>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Login;
