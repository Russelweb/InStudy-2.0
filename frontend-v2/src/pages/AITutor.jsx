import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { flashcardService } from '../services/api';

const AITutor = () => {
  const [courses, setCourses] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await flashcardService.getDecks();
        const available = response.data.courses || [];
        setCourses(available);
      } catch (error) {
        console.error("Failed to fetch courses:", error);
      }
    };
    fetchCourses();
  }, []);

  return (
    <div className="flex-1 min-h-screen p-8 relative bg-background flex flex-col items-center justify-center">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-secondary/5 rounded-full blur-[120px] pointer-events-none"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
      >
        <div className="w-20 h-20 mx-auto rounded-3xl signature-gradient flex items-center justify-center shadow-[0_0_40px_rgba(105,246,184,0.3)] mb-6">
          <span className="material-symbols-outlined text-4xl text-on-white">computer</span>
        </div>
        <h1 className="text-4xl font-black tracking-tighter text-on-surface mb-4">AI Tutor Interface</h1>
        <p className="text-sm font-medium text-on-surface-variant max-w-lg mx-auto leading-relaxed">
          Select an active course to launch the complete dual-pane Workspace. You will have full access to your original documents while conversing with the AI.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl z-10">
        {courses.map(course => (
          <button
            key={course.id}
            onClick={() => navigate(`/workspace?id=${course.id}`)}
            className="p-6 rounded-2xl bg-surface-container-high border border-outline-variant/10 text-left hover:border-secondary/40 hover:bg-surface-variant transition-all hover:scale-105 active:scale-95 group"
          >
            <div className="flex justify-between items-start mb-4">
               <span className="material-symbols-outlined text-secondary opacity-60 group-hover:opacity-100 transition-opacity">folder</span>
               <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary uppercase tracking-widest">{course.document_count || 0} Docs</span>
            </div>
            <h3 className="text-lg font-bold text-on-surface truncate">{course.name}</h3>
            <p className="text-xs text-on-surface-variant mt-2 tracking-wide uppercase font-bold group-hover:text-secondary transition-colors">Launch Workspace →</p>
          </button>
        ))}
      </div>
      
      {courses.length === 0 && (
         <div className="text-center p-8 bg-surface-container-low rounded-2xl border border-outline-variant/10 border-dashed max-w-md w-full">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4 opacity-50">inventory_2</span>
            <p className="text-sm font-bold text-on-surface">No Courses available.</p>
            <p className="text-xs text-on-surface-variant mt-2">Go to Knowledge Base to create a course and upload documents first.</p>
         </div>
      )}
    </div>
  );
};

export default AITutor;
