import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { authService } from '../services/api';

const Sidebar = ({ mobile, onLinkClick, collapsed, onToggleCollapse }) => {
  const location = useLocation();
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.is_admin;

  const menuItems = [
    { icon: 'home', label: 'Dashboard', path: '/' },
    { icon: 'database', label: 'Knowledge Base', path: '/knowledge' },
    { icon: 'style', label: 'Flashcards', path: '/flashcards' },
    { icon: 'quiz', label: 'Smart Quiz', path: '/quiz' },
    { icon: 'auto_awesome', label: 'AI Summarizer', path: '/summary' },
    { icon: 'event_note', label: 'Study Planner', path: '/planner' },
    { icon: 'psychology', label: 'Mastery Tracker', path: '/mastery' },
    { icon: 'smart_toy', label: 'AI Tutor', path: '/ai-tutor' },
  ];

  if (isAdmin) menuItems.push({ icon: 'admin_panel_settings', label: 'Admin Hub', path: '/admin' });
  menuItems.push({ icon: 'settings', label: 'Settings', path: '/settings' });

  const isCollapsed = !mobile && collapsed;

  return (
    <aside
      className={`
        ${mobile ? 'w-full shadow-2xl' : isCollapsed ? 'fixed left-0 top-0 w-16' : 'fixed left-0 top-0 w-64'}
        h-full bg-[#0c1410] flex flex-col z-50 transition-all duration-300
        shadow-[0px_20px_40px_rgba(189,157,255,0.04)]
        overflow-hidden
      `}
    >
      {/* Header */}
      <div className={`flex items-center ${isCollapsed ? 'justify-center px-2 py-6' : 'justify-between px-4 py-8'} shrink-0`}>
        {!isCollapsed && (
          <div>
            <h1 className="text-2xl font-black text-[#bd9dff] tracking-tighter">InStudy 2.0</h1>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/60 mt-1">Study Smarter Not Harder</p>
          </div>
        )}
        {!mobile && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-colors shrink-0"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="material-symbols-outlined text-lg">
              {isCollapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        )}
      </div>

      {/* Nav - scrollable */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 space-y-1 custom-scrollbar">
        {menuItems.map((item, idx) => {
          const isActive = location.pathname === item.path;
          let targetPath = item.path;
          if (['/flashcards', '/quiz', '/ai-tutor', '/summary', '/mastery'].includes(item.path)) {
            const activeCourse = localStorage.getItem('activeCourse');
            if (activeCourse) targetPath = `${item.path}?id=${activeCourse}`;
          }
          return (
            <motion.div key={idx} whileHover={{ x: isCollapsed ? 0 : 4 }}>
              <Link
                to={targetPath}
                onClick={() => onLinkClick && onLinkClick()}
                title={isCollapsed ? item.label : undefined}
                className={`flex items-center gap-4 px-3 py-3 rounded-lg transition-all duration-200 ${
                  isCollapsed ? 'justify-center' : ''
                } ${
                  isActive
                    ? 'text-[#bd9dff] bg-[#202821]/60 font-bold border-r-2 border-[#bd9dff]'
                    : 'text-[#d8e8d6]/60 hover:text-[#bd9dff] hover:bg-[#202821]/40'
                }`}
              >
                <span className="material-symbols-outlined shrink-0">{item.icon}</span>
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-sm whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className={`mt-auto shrink-0 border-t border-outline-variant/10 pt-4 pb-6 px-3 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between gap-3'}`}>
        {!isCollapsed && (
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full border border-primary/20 p-0.5 overflow-hidden shrink-0">
              <img
                alt="User profile"
                className="w-full h-full object-cover rounded-full"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDQVbPjTFstZg2xuiXl6JZO1xrhTzTb_pLHPOM3Zz5z__fFrm4qIdkjQNc4oYi1sbI89gkCGMMQC6NxmXIeeo28iZ3xOdVa1ir68WakWZdaDp_eBoS5BwPwzXOO4jSruYI-6L4dDVywzQOxqg86iaBMmHzVktWeSJZgyjn_c5x6X1Y5sQ7S8T1MI9ZcsMpsgTiqmBljsBAc5VW22v9mzUA2JvRdWhguP0Oho-PjPt_IypvBguC62bp6iJaIMcTWA5ugAEpz2NvPxQ"
              />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-on-surface truncate max-w-[110px]">{currentUser?.email?.split('@')[0] || 'Scholar'}</p>
              <p className="text-[10px] text-on-surface-variant tracking-widest">{isAdmin ? 'System Admin' : 'InStudent'}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => authService.logout()}
          className="p-2 rounded-lg text-error hover:bg-error/10 transition-colors shrink-0"
          title="Terminate Session"
        >
          <span className="material-symbols-outlined">logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
