import { useState, useEffect } from 'react';
import { authService } from '../services/api';

const TopBar = () => {
  const [user, setUser] = useState(null);
  const [auraMessage, setAuraMessage] = useState('System performance: Normal.');

  useEffect(() => {
    // Try to load user from cache, then refresh from backend
    const cached = authService.getCurrentUser();
    if (cached) setUser(cached);

    authService.getMe()
      .then((res) => {
        setUser(res.data);
        localStorage.setItem('user_info', JSON.stringify(res.data));
      })
      .catch(() => {}); // Silently fail — token stays valid via interceptor
  }, []);

  const displayName = user?.email?.split('@')[0] || 'Architect';

  return (
    <header className="fixed top-0 right-0 left-64 h-16 bg-[#202821]/60 backdrop-blur-3xl flex justify-between items-center px-8 z-40 border-b border-white/5">
      {/* Left: Aura Pill */}
      <div className="flex items-center gap-4">
        <div className="glass px-4 py-1.5 rounded-full flex items-center gap-3 border border-secondary/20 group hover:scale-105 transition-transform duration-300">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
          </span>
          <span className="text-secondary text-xs font-bold tracking-tight">
            🔥 Aura: <span className="text-on-surface font-normal">{auraMessage}</span>
          </span>
        </div>
      </div>

      {/* Right: User + Actions */}
      <div className="flex items-center gap-6">
        <div className="relative group">
          <span className="material-symbols-outlined text-[#f8fef6]/60 group-hover:text-secondary cursor-pointer transition-colors">notifications</span>
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-secondary rounded-full animate-pulse"></span>
        </div>

        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="w-8 h-8 rounded-full signature-gradient flex items-center justify-center shadow-[0_0_12px_rgba(105,246,184,0.3)] group-hover:scale-110 transition-transform">
            <span className="text-on-primary text-xs font-black uppercase">
              {displayName.charAt(0)}
            </span>
          </div>
          <span className="text-[#f8fef6]/80 font-medium text-sm hidden md:block">
            {displayName}
          </span>
        </div>

        <button
          onClick={authService.logout}
          title="Logout"
          className="text-on-surface-variant/50 hover:text-error transition-colors"
        >
          <span className="material-symbols-outlined">logout</span>
        </button>
      </div>
    </header>
  );
};

export default TopBar;
