import { useState, useEffect } from 'react';
import { authService } from '../services/api';

const TopBar = ({ onMenuClick, sidebarCollapsed }) => {
  const [user, setUser] = useState(null);
  const [auraMessage, setAuraMessage] = useState('System performance: Normal.');

  useEffect(() => {
    const cached = authService.getCurrentUser();
    if (cached) setUser(cached);

    authService.getMe()
      .then((res) => {
        setUser(res.data);
        localStorage.setItem('user_info', JSON.stringify(res.data));
      })
      .catch(() => {});
  }, []);

  const displayName = user?.email?.split('@')[0] || 'Architect';

  return (
    <header className={`fixed top-0 right-0 left-0 ${sidebarCollapsed ? 'md:left-16' : 'md:left-64'} h-16 bg-[#0c1410]/80 backdrop-blur-3xl flex justify-between items-center px-3 md:px-8 z-40 border-b border-white/5 transition-all duration-300`}>
      {/* Left Area */}
      <div className="flex items-center gap-2 md:gap-4">
        <button 
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        
        <div className="glass px-3 py-1.5 rounded-full flex items-center gap-2 border border-secondary/20 hidden sm:flex group hover:scale-105 transition-transform duration-300">
          <span className="flex h-2 w-2 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
          </span>
          <span className="text-secondary text-[10px] font-bold tracking-tight truncate max-w-[140px] md:max-w-none">
            🔥 Aura: <span className="text-on-surface font-normal">{auraMessage}</span>
          </span>
        </div>
      </div>

      {/* Right Area */}
      <div className="flex items-center gap-2 md:gap-4">
        <div className="relative group hidden md:block">
          <span className="material-symbols-outlined text-on-surface/60 group-hover:text-secondary cursor-pointer transition-colors">notifications</span>
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-secondary rounded-full animate-pulse"></span>
        </div>

        <div className="flex items-center gap-2 cursor-pointer group">
          <div className="w-8 h-8 rounded-full signature-gradient flex items-center justify-center shadow-[0_0_12px_rgba(189,157,255,0.3)] group-hover:scale-110 transition-transform shrink-0">
            <span className="text-white text-xs font-black uppercase">
              {displayName.charAt(0)}
            </span>
          </div>
          <span className="text-on-surface font-medium text-sm hidden lg:block">
            {displayName}
          </span>
        </div>

        <button
          onClick={() => authService.logout()}
          className="p-2 rounded-lg text-error/60 hover:text-error hover:bg-error/10 transition-all"
          title="Logout"
        >
          <span className="material-symbols-outlined text-xl">logout</span>
        </button>
      </div>
    </header>
  );
};

export default TopBar;
