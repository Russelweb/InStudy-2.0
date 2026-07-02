import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import './AuthPages.css';

/* ── Animation Variants ─────────────────────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.15 },
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

/* ── Password Strength Helper ───────────────────────────────────────────── */
function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: '' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score: 1, label: 'Weak', level: 'weak' };
  if (score === 2) return { score: 2, label: 'Fair', level: 'fair' };
  if (score === 3) return { score: 3, label: 'Good', level: 'good' };
  return { score: 4, label: 'Strong', level: 'strong' };
}

/* ── Component ──────────────────────────────────────────────────────────── */
const Signup = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirm_password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const strength = useMemo(
    () => getPasswordStrength(formData.password),
    [formData.password]
  );

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
      // The session_token cookie is now set by the backend
      if (!res.data?.success) {
        // Fallback: log them in manually if signup succeeded but no session
        await authService.login(formData.email, formData.password);
      }
      // Mark as new user so Dashboard shows the welcome modal
      localStorage.setItem('is_new_user', 'true');
      navigate('/');
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail[0].msg);
      } else {
        setError(detail || 'Registration failed. User may already exist.');
      }
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (e) =>
    setFormData({ ...formData, [field]: e.target.value });

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
            Create Your Account
          </motion.h1>
          <motion.p variants={itemVariants} className="auth-subtext">
            Begin your learning journey
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
          <form onSubmit={handleSignup}>
            {/* Email */}
            <motion.div variants={itemVariants} style={{ marginBottom: '1.25rem' }}>
              <label className="auth-field-label">Email</label>
              <div className="auth-input-wrapper">
                <span className="material-symbols-outlined auth-input-icon">mail</span>
                <input
                  id="signup-email"
                  required
                  type="email"
                  value={formData.email}
                  onChange={update('email')}
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
                  id="signup-password"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={update('password')}
                  className="auth-input"
                  placeholder="••••••••••••"
                  autoComplete="new-password"
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

              {/* Password Strength */}
              {formData.password && (
                <div className="auth-strength-container">
                  <div className="auth-strength-bar">
                    {[1, 2, 3, 4].map((seg) => (
                      <div
                        key={seg}
                        className={`auth-strength-segment ${
                          seg <= strength.score
                            ? `auth-strength-segment--active auth-strength--${strength.level}`
                            : ''
                        }`}
                      />
                    ))}
                  </div>
                  <div className={`auth-strength-label auth-strength-label--${strength.level}`}>
                    {strength.label}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Confirm Password */}
            <motion.div variants={itemVariants} style={{ marginBottom: '1.75rem', marginTop: '1.25rem' }}>
              <label className="auth-field-label">Confirm Password</label>
              <div className="auth-input-wrapper">
                <span className="material-symbols-outlined auth-input-icon">lock_reset</span>
                <input
                  id="signup-confirm-password"
                  required
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirm_password}
                  onChange={update('confirm_password')}
                  className="auth-input"
                  placeholder="••••••••••••"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="auth-toggle-pw"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>
                    {showConfirmPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </motion.div>

            {/* Submit */}
            <motion.div variants={itemVariants}>
              <button
                id="signup-submit"
                type="submit"
                disabled={loading}
                className="auth-btn"
              >
                {loading ? (
                  <span className="material-symbols-outlined auth-spinner">sync</span>
                ) : (
                  'Create Account'
                )}
              </button>
            </motion.div>
          </form>

          {/* Divider + Login link */}
          <motion.div variants={itemVariants}>
            <div className="auth-divider">
              <div className="auth-divider-line" />
              <span className="auth-divider-text">or</span>
              <div className="auth-divider-line" />
            </div>

            <p className="auth-footer">
              Already have an account?{' '}
              <Link to="/login">Log in</Link>
            </p>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Signup;
