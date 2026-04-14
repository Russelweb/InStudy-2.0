import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { authService } from '../services/api';

const Sidebar = ({ mobile, onLinkClick }) => {
  const location = useLocation();
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.is_admin;
  
  const menuItems = [
    { icon: 'home', label: 'Dashboard', path: '/' },
    { icon: 'database', label: 'Knowledge Base', path: '/knowledge' },
    { icon: 'style', label: 'Flashcards', path: '/flashcards' },
    { icon: 'quiz', label: 'Smart Quiz', path: '/quiz' },
    { icon: 'event_note', label: 'Study Planner', path: '/planner' },
    { icon: 'smart_toy', label: 'AI Tutor', path: '/ai-tutor' },
  ];

  if (isAdmin) {
    menuItems.push({ icon: 'admin_panel_settings', label: 'Admin Hub', path: '/admin' });
  }

  menuItems.push({ icon: 'settings', label: 'Settings', path: '/settings' });

  return (
    <aside className={`${mobile ? 'w-full shadow-2xl' : 'fixed left-0 top-0 w-64 shadow-[0px_20px_40px_rgba(189,157,255,0.05)]'} h-full bg-[#0a0f0b] flex flex-col py-8 px-4 z-50`}>
      <div className="mb-12 px-4">
        <h1 className="text-2xl font-black text-[#bd9dff] tracking-tighter">InStudy 2.0</h1>
        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/60 mt-1">Study Smarter Not Harder</p>
      </div>

      <nav className="flex-1 space-y-2">
        {menuItems.map((item, idx) => {
          const isActive = location.pathname === item.path;
          let targetPath = item.path;
          if (['/flashcards', '/quiz', '/ai-tutor'].includes(item.path)) {
            const activeCourse = localStorage.getItem('activeCourse');
            if (activeCourse) {
              targetPath = `${item.path}?id=${activeCourse}`;
            }
          }
          return (
            <motion.div key={idx} whileHover={{ x: 5 }}>
              <Link
                to={targetPath}
                onClick={() => onLinkClick && onLinkClick()}
                className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-300 ${
                  isActive 
                    ? 'text-[#bd9dff] border-r-2 border-[#bd9dff] bg-[#202821]/50 font-bold' 
                    : 'text-[#f8fef6]/60 hover:text-[#bd9dff] hover:bg-[#202821]/50'
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </Link>
            </motion.div>
          );
        })}
      </nav>

{/*       <button className="mt-8 mb-10 w-full py-4 rounded-xl signature-gradient text-on-surface font-bold text-sm hover:opacity-90 transition-opacity"> */}
{/*         Upload Material */}
{/*       </button> */}

      <div className="mt-auto px-4 flex items-center justify-between gap-3 border-t border-outline-variant/10 pt-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-primary/20 p-0.5 overflow-hidden">
            <img 
              alt="User profile" 
              className="w-full h-full object-cover rounded-full" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDQVbPjTFstZg2xuiXl6JZO1xrhTzTb_pLHPOM3Zz5z__fFrm4qIdkjQNc4oYi1sbI89gkCGMMQC6NxmXIeeo28iZ3xOdVa1ir68WakWZdaDp_eBoS5BwPwzXOO4jSruYI-6L4dDVywzQOxqg86iaBMmHzVktWeSJZgyjn_c5x6X1Y5sQ7S8T1MI9ZcsMpsgTiqmBljsBAc5VW22v9mzUA2JvRdWhguP0Oho-PjPt_IypvBguC62bp6iJaIMcTWA5ugAEpz2NvPxQ" 
            />
          </div>
          <div className="hidden md:block overflow-hidden">
            <p className="text-sm font-bold text-on-surface truncate max-w-[120px]">{currentUser?.email?.split('@')[0] || 'Scholar'}</p>
            <p className="text-[10px] text-on-surface-variant tracking-widest">{isAdmin ? 'System Admin' : 'InStudent'}</p>
          </div>
        </div>
        <button 
          onClick={() => authService.logout()}
          className="p-2 rounded-lg text-error hover:bg-error/10 transition-colors"
          title="Terminate Session"
        >
          <span className="material-symbols-outlined">logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
