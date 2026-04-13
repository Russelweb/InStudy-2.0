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

const ProtectedRoute = () => {
  const token = localStorage.getItem('auth_token');
  return token ? <Outlet /> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background text-on-background">
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

function MainLayout() {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 min-h-screen">
        <TopBar />
        <main>
          <Outlet />
        </main>
      </div>
      
      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-8 z-50">
        <button className="w-14 h-14 rounded-full signature-gradient shadow-[0_0_20px_rgba(105,246,184,0.3)] flex items-center justify-center hover:scale-110 transition-transform active:scale-95 group">
          <span className="material-symbols-outlined text-on-primary-fixed text-2xl group-hover:rotate-12 transition-transform">terminal</span>
        </button>
      </div>
    </div>
  )
}


export default App
