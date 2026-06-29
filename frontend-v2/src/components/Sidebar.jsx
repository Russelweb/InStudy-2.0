import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { authService } from "../services/api";

// ---------------------------------------------------------------------------
// Avatar — generates initials + a stable color from the email, no external deps
// ---------------------------------------------------------------------------
const AVATAR_COLORS = [
  {
    bg: "rgba(189,157,255,0.2)",
    text: "#bd9dff",
    border: "rgba(189,157,255,0.35)",
  }, // purple
  {
    bg: "rgba(105,246,184,0.15)",
    text: "#69f6b8",
    border: "rgba(105,246,184,0.3)",
  }, // emerald
  {
    bg: "rgba(184,249,222,0.15)",
    text: "#b8f9de",
    border: "rgba(184,249,222,0.3)",
  }, // mint
  {
    bg: "rgba(164,127,239,0.2)",
    text: "#a47fef",
    border: "rgba(164,127,239,0.35)",
  }, // violet
  {
    bg: "rgba(88,231,171,0.15)",
    text: "#58e7ab",
    border: "rgba(88,231,171,0.3)",
  }, // teal
];

function getAvatarProps(email = "") {
  // Initials: up to 2 chars from the part before @
  const name = email.split("@")[0] || "?";
  const parts = name.split(/[._\-\s]+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();

  // Deterministic color from email char codes
  const hash = email.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length];

  return { initials, color };
}

const UserAvatar = ({ email, size = "md" }) => {
  const { initials, color } = getAvatarProps(email);
  const dim = size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs";
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center font-black shrink-0 select-none`}
      style={{
        background: color.bg,
        color: color.text,
        border: `1.5px solid ${color.border}`,
      }}
    >
      {initials}
    </div>
  );
};

const Sidebar = ({
  mobile,
  onLinkClick,
  collapsed,
  onToggleCollapse,
  isStatic,
  extraHeader,
  children,
}) => {
  const location = useLocation();
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.is_admin;

  const handleLogout = () => {
    authService.logout();
  };

  const menuItems = [
    { icon: "home", label: "Dashboard", path: "/" },
    { icon: "database", label: "Knowledge Base", path: "/knowledge" },
    { icon: "space_dashboard", label: "InSpace", path: "/inspace" },
    { icon: "menu_book", label: "Reader", path: "/workspace" },
    { icon: "style", label: "Flashcards", path: "/flashcards" },
    { icon: "quiz", label: "Smart Quiz", path: "/quiz" },
    { icon: "auto_awesome", label: "AI Summarizer", path: "/summary" },
    { icon: "event_note", label: "Study Planner", path: "/planner" },
    { icon: "psychology", label: "Mastery Tracker", path: "/mastery" },
    { icon: "smart_toy", label: "AI Tutor", path: "/ai-tutor" },
    { icon: "bookmarks", label: "Saved Assets", path: "/saved-assets" },
  ];

  if (isAdmin)
    menuItems.push({
      icon: "admin_panel_settings",
      label: "Admin Hub",
      path: "/admin",
    });
  menuItems.push({ icon: "settings", label: "Settings", path: "/settings" });

  const isCollapsed = !mobile && collapsed;

  return (
    <aside
      className={`
        ${mobile ? "w-full shadow-2xl" : isCollapsed ? "w-16" : "w-64"}
        ${!isStatic && !mobile ? "fixed left-0 top-0" : ""}
        h-full bg-[#141f16] flex flex-col z-50 transition-all duration-300
        shadow-[0px_20px_40px_rgba(189,157,255,0.04)]
        overflow-hidden
      `}
    >
      {/* Header */}
      <div
        className={`flex items-center ${isCollapsed ? "justify-center px-2 py-6" : "justify-between px-4 py-8"} shrink-0`}
      >
        {!isCollapsed && (
          <div>
            <h1 className="text-2xl font-black text-[#bd9dff] tracking-tighter">
              InStudy 2.0
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/60 mt-1">
              Study Smarter Not Harder
            </p>
          </div>
        )}
        {!mobile && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-colors shrink-0"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="material-symbols-outlined text-lg">
              {isCollapsed ? "chevron_right" : "chevron_left"}
            </span>
          </button>
        )}
      </div>

      {/* Extra Header (e.g. Workspace info) */}
      {!isCollapsed && extraHeader && (
        <div className="px-4 mb-4">{extraHeader}</div>
      )}

      {/* Nav - scrollable */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 space-y-1 custom-scrollbar">
        {menuItems.map((item, idx) => {
          const isActive = location.pathname === item.path;
          let targetPath = item.path;

          // For Reader, if we are in workspace, we use current URL or just keep /workspace
          // But usually we need the ?id=...
          if (item.path === "/workspace") {
            const activeCourse = localStorage.getItem("activeCourse");
            if (activeCourse) targetPath = `/workspace?id=${activeCourse}`;
            else return null; // Don't show Reader if no active course
          } else if (
            [
              "/flashcards",
              "/quiz",
              "/ai-tutor",
              "/summary",
              "/mastery",
            ].includes(item.path)
          ) {
            const activeCourse = localStorage.getItem("activeCourse");
            if (activeCourse) targetPath = `${item.path}?id=${activeCourse}`;
          }
          return (
            <motion.div key={idx} whileHover={{ x: isCollapsed ? 0 : 4 }}>
              <Link
                to={targetPath}
                onClick={() => onLinkClick && onLinkClick()}
                title={isCollapsed ? item.label : undefined}
                className={`flex items-center gap-4 px-3 py-3 rounded-lg transition-all duration-200 ${
                  isCollapsed ? "justify-center" : ""
                } ${
                  isActive
                    ? "relative text-[#bd9dff] bg-[#242e25]/60 font-bold after:absolute after:right-0 after:top-1/2 after:-translate-y-1/2 after:h-8 after:w-0.5 after:bg-[#bd9dff] after:rounded-full"
                    : "text-[#d8e8d6]/60 hover:text-[#bd9dff] hover:bg-[#242e25]/40"
                }`}
              >
                <span className="material-symbols-outlined shrink-0">
                  {item.icon}
                </span>
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
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

      {/* Children (e.g. New Research button) */}
      {children && <div className="px-3 mb-4 shrink-0">{children}</div>}

      {/* User footer */}
      <div
        className={`mt-auto shrink-0 border-t border-outline-variant/10 pt-4 pb-6 px-3 flex items-center ${isCollapsed ? "justify-center" : "justify-between gap-3"}`}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar email={currentUser?.email || ""} size="md" />
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-on-surface truncate max-w-[110px]">
                {currentUser?.email?.split("@")[0] || "Scholar"}
              </p>
              <p className="text-[10px] text-on-surface-variant tracking-widest">
                {isAdmin ? "System Admin" : "InStudent"}
              </p>
            </div>
          </div>
        )}

        {/* Collapsed: show avatar only, no text */}
        {isCollapsed && (
          <UserAvatar email={currentUser?.email || ""} size="sm" />
        )}

        <button
          onClick={handleLogout}
          className="p-2 rounded-lg text-error hover:bg-error/10 transition-colors shrink-0"
          title="Log Out"
        >
          <span className="material-symbols-outlined">logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
