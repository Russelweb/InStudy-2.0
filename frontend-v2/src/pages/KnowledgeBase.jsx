import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import UploadZone from '../components/UploadZone';
import CourseCard from '../components/CourseCard';
import { documentService, statService } from '../services/api';

const KnowledgeBase = () => {
  const [courses, setCourses] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedCourseForUpload, setSelectedCourseForUpload] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [filter, setFilter] = useState('all');
  const [activeCourseId, setActiveCourseId] = useState(localStorage.getItem('activeCourse'));
  const navigate = useNavigate();

  const fetchDocuments = async () => {
    try {
      const response = await statService.getOverview();
      const transformed = (response.data.courses || []).map((course) => ({
        id: course.id,
        title: course.name,
        lastAccessed: course.upload_date || new Date().toLocaleDateString(),
        materialCount: course.document_count,
        mastery: course.mastery || 0,
        image: documentService.getThumbnailUrl(course.id),
      }));
      setCourses(transformed);
      // Auto-select first course for uploads if none selected
      if (!selectedCourseForUpload && transformed.length > 0) {
        setSelectedCourseForUpload(transformed[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch dimensions:', error);
    }
  };

  useEffect(() => { fetchDocuments(); }, []);

  // Create a new course — the backend creates it on first document upload,
  // but we can also create it by uploading a placeholder or just tracking it client-side.
  // Here we take the user's chosen name and make it the course_id slug.
  const handleCreateCourse = async () => {
    const name = newCourseName.trim();
    if (!name) return;
    setIsCreating(true);
    try {
      // The backend creates course directories on first upload.
      // We store the slug as the selected course and close the modal.
      const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      setSelectedCourseForUpload(slug);
      // Optimistically add to list so user sees it immediately
      setCourses((prev) => [
        ...prev,
        { id: slug, title: name, lastAccessed: new Date().toLocaleDateString(), materialCount: 0, mastery: 0 },
      ]);
      setNewCourseName('');
      setShowCreateModal(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpload = async (file) => {
    if (!selectedCourseForUpload) {
      setUploadError('Please select or create a course before uploading.');
      return;
    }
    setUploadError('');
    setIsUploading(true);
    setUploadProgress(10);

    const interval = setInterval(() => {
      setUploadProgress((prev) => (prev < 90 ? prev + 8 : prev));
    }, 600);

    try {
      await documentService.upload(file, selectedCourseForUpload);
      clearInterval(interval);
      setUploadProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        fetchDocuments();
      }, 1200);
    } catch (error) {
      clearInterval(interval);
      setIsUploading(false);
      setUploadProgress(0);
      setUploadError('Upload failed: ' + (error.response?.data?.detail || error.message));
    }
  };

  const filteredCourses = courses.filter((c) => {
    if (filter === 'completed') return c.mastery >= 80;
    if (filter === 'in-progress') return c.mastery > 0 && c.mastery < 80;
    return true;
  });

  return (
    <div className="flex-1 min-h-screen pb-20 p-4 md:p-8">
      {/* Create Course Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-8"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface-container shadow-2xl rounded-2xl border border-outline-variant/10 w-full max-w-md p-8"
            >
              <h2 className="text-2xl font-black text-on-surface mb-2">New Course</h2>
              <p className="text-sm text-on-surface-variant mb-6">
                Give your course a name. Documents uploaded here will be grouped under this course.
              </p>
              <input
                type="text"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCourse()}
                placeholder="e.g. Quantum Physics"
                autoFocus
                className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl py-3 px-4 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50 transition-all mb-6"
              />
              <div className="flex gap-4">
                <button
                  onClick={() => { setShowCreateModal(false); setNewCourseName(''); }}
                  className="flex-1 py-3 rounded-xl border border-outline-variant/20 text-on-surface-variant text-sm font-bold hover:bg-surface-variant transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCourse}
                  disabled={!newCourseName.trim() || isCreating}
                  className="flex-1 py-3 rounded-xl signature-gradient text-on-primary font-black text-sm uppercase tracking-widest scale-100 hover:scale-[1.02] active:scale-95 text-primary transition-transform disabled:text-white opacity-90"
                >
                  {isCreating ? 'Creating...' : 'Create Course'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Header */}
      <section className="px-4 md:px-12 mt-8 md:mt-12 mb-8 max-w-screen-2xl mx-auto flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-on-surface mb-2">Knowledge Base</h2>
          <p className="text-sm md:text-lg text-on-surface-variant font-light tracking-wide">Manage and access your courses and study materials.</p>
        </motion.div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full md:w-auto px-8 py-4 bg-[#551a8b]/90 rounded-full font-bold text-on-surface aura-glow flex items-center justify-center gap-3 transition-transform hover:scale-105 active:scale-95 whitespace-nowrap"
        >
          <span className="material-symbols-outlined">add</span>
          Create New Course
        </button>
      </section>

      {/* Upload Zone */}
      <section className="px-4 md:px-12 mb-4 max-w-screen-2xl mx-auto">
        {/* Course selector for upload */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
          <label className="text-[10px] md:text-xs font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Upload to course:</label>
          <select
            value={selectedCourseForUpload}
            onChange={(e) => setSelectedCourseForUpload(e.target.value)}
            className="bg-surface-container-high border border-outline-variant/20 text-on-surface text-sm rounded-lg px-3 py-2 focus:ring-1 focus:ring-secondary/50 cursor-pointer"
          >
            {courses.length === 0 && <option value="">— Create a course first —</option>}
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          {uploadError && (
            <span className="text-error text-xs font-bold">{uploadError}</span>
          )}
        </div>
        <UploadZone
          onFileSelected={handleUpload}
          isUploading={isUploading}
          progress={uploadProgress}
        />
      </section>

      {/* Content Area */}
      <section className="px-4 md:px-12 max-w-screen-2xl mx-auto">
        {/* Filter Tabs */}
        <div className="flex items-center gap-3 mb-10 overflow-x-auto pb-4 custom-scrollbar">
          {[
            { label: 'All Circuits', value: 'all' },
            { label: 'In Progress', value: 'in-progress' },
            { label: 'Completed',   value: 'completed' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-6 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-colors ${
                filter === tab.value
                  ? 'bg-secondary text-on-secondary font-bold shadow-lg shadow-secondary/10'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-variant border border-outline-variant/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Course Grid */}
        {filteredCourses.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block opacity-40">school</span>
            <p className="text-on-surface-variant font-bold">No courses found. Create a course and upload documents to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {filteredCourses.map((course, idx) => (
              <CourseCard
                key={course.id}
                {...course}
                isActive={activeCourseId === course.id}
                onSelect={(id) => {
                  setActiveCourseId(id);
                  localStorage.setItem('activeCourse', id);
                }}
                onOpen={() => {
                  localStorage.setItem('activeCourse', course.id);
                  navigate(`/workspace?id=${course.id}`);
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default KnowledgeBase;
