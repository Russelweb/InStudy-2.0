import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Dashboard from './pages/Dashboard'
import KnowledgeBase from './pages/KnowledgeBase'
import Workspace from './pages/Workspace'
import Flashcards from './pages/Flashcards'
import Quiz from './pages/Quiz'
import AITutor from './pages/AITutor'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Planner from './pages/Planner'
import AdminDashboard from './pages/AdminDashboard'
import Settings from './pages/Settings'
import SavedAssets from './pages/SavedAssets'

const ProtectedRoute = () => {
  const token = localStorage.getItem('auth_token');
  return token ? <Outlet /> : <Navigate to="/login" replace />;
};

function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background relative">
      {/* Sidebar - Desktop */}
      <div className="hidden md:block w-64 shrink-0">
        <Sidebar />
      </div>

      {/* Sidebar - Mobile Drawer */}
      {isSidebarOpen && (
        <>
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden"
          />
          <div className="fixed left-0 top-0 h-full w-72 z-[70] md:hidden bg-background">
            <Sidebar mobile onLinkClick={() => setIsSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 md:px-8 pt-20 pb-20">
          <Outlet />
        </main>
      </div>
      
{/*        */}{/* Floating Action Button */}
{/*       <div className="fixed bottom-6 right-6 z-50 md:bottom-8 md:right-8"> */}
{/*         <button className="w-12 h-12 md:w-14 md:h-14 rounded-full signature-gradient shadow-lg flex items-center justify-center hover:scale-110 transition-transform active:scale-95 group"> */}
{/*           <span className="material-symbols-outlined text-white text-xl md:text-2xl group-hover:rotate-12 transition-transform">terminal</span> */}
{/*         </button> */}
{/*       </div> */}
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background text-on-surface">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected Area */}
          <Route element={<ProtectedRoute />}>
            {/* Main App Layout */}
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="knowledge" element={<KnowledgeBase />} />
              <Route path="courses" element={<KnowledgeBase />} />
              <Route path="flashcards" element={<Flashcards />} />
              <Route path="quiz" element={<Quiz />} />
              <Route path="ai-tutor" element={<AITutor />} />
              <Route path="planner"  element={<Planner />} />
              <Route path="saved-assets" element={<SavedAssets />} />
              <Route path="admin"    element={<AdminDashboard />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            
            {/* Workspace Mode (Full Screen) */}
            <Route path="/workspace" element={<Workspace />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
