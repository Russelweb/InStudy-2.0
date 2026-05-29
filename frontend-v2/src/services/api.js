import axios from 'axios';

// Helper to determine the best API base URL
const getBaseURL = () => {
  // Explicit override via env var (set VITE_API_BASE_URL in .env for production)
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;

  // In dev, Vite proxies /api → localhost:8000, so use a relative path.
  // This works on any device (phone, tablet, PC) because the request goes to
  // whatever host is serving the frontend, and Vite forwards it to the backend.
  return '/api';
};

// Create base instance
const API = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor — attach auth token and Groq key to every request
API.interceptors.request.use((config) => {
  const groqKey = localStorage.getItem('groq_api_key');
  const token = localStorage.getItem('auth_token');

  if (groqKey) config.headers['X-Groq-API-Key'] = groqKey;
  if (token)   config.headers['Authorization'] = `Bearer ${token}`;

  return config;
}, (error) => Promise.reject(error));

// Response Interceptor — redirect to login on 401
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_info');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------------------
// Auto-Save Timer - Saves unsaved work 10 minutes after logout
// ---------------------------------------------------------------------------
let autoSaveTimer = null;

const startAutoSaveTimer = async () => {
  // Clear any existing timer
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  
  console.log('Auto-save timer started (10 minutes)...');
  
  // Set 10-minute timer
  autoSaveTimer = setTimeout(async () => {
    console.log('Auto-saving session data...');
    
    try {
      // Check for unsaved flashcards
      const flashcardCards = localStorage.getItem('flashcards_cards');
      const flashcardDeck = localStorage.getItem('flashcards_deck_id');
      if (flashcardCards && flashcardDeck) {
        try {
          const cards = JSON.parse(flashcardCards);
          if (cards.length > 0) {
            const settings = JSON.parse(localStorage.getItem('flashcards_settings') || '{}');
            await assetService.save(
              flashcardDeck,
              'flashcards',
              `Auto-saved ${new Date().toLocaleString()}`,
              { cards, settings, auto_saved: true },
              { card_count: cards.length }
            );
            console.log('✅ Auto-saved flashcards');
          }
        } catch (e) {
          console.error('Auto-save flashcards failed:', e);
        }
      }
      
      // Check for unsaved quiz
      const quizQuestions = localStorage.getItem('quiz_questions');
      const quizCourse = localStorage.getItem('quiz_selected_course');
      const quizResults = localStorage.getItem('quiz_results');
      if (quizQuestions && quizCourse) {
        try {
          const questions = JSON.parse(quizQuestions);
          const results = quizResults ? JSON.parse(quizResults) : null;
          if (questions.length > 0) {
            await assetService.save(
              quizCourse,
              'quiz',
              `Auto-saved ${new Date().toLocaleString()}`,
              { questions, results, auto_saved: true },
              { total_questions: questions.length }
            );
            console.log('✅ Auto-saved quiz');
          }
        } catch (e) {
          console.error('Auto-save quiz failed:', e);
        }
      }
      
      // Check for unsaved study plan
      const planData = localStorage.getItem('planner_plan');
      const planCourse = localStorage.getItem('planner_course');
      if (planData && planCourse) {
        try {
          const plan = JSON.parse(planData);
          const examDate = localStorage.getItem('planner_date');
          const topics = JSON.parse(localStorage.getItem('planner_topics') || '[]');
          const completedTasks = JSON.parse(localStorage.getItem('planner_completed_tasks') || '{}');
          
          await assetService.save(
            planCourse,
            'study_plan',
            `Auto-saved ${new Date().toLocaleString()}`,
            { plan, examDate, topics, completedTasks, auto_saved: true },
            { exam_date: examDate }
          );
          console.log('✅ Auto-saved study plan');
        } catch (e) {
          console.error('Auto-save plan failed:', e);
        }
      }
      
      console.log('Auto-save complete. Clearing localStorage...');
      localStorage.clear();
    } catch (error) {
      console.error('Auto-save error:', error);
    }
  }, 10 * 60 * 1000); // 10 minutes
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const authService = {
  login: async (email, password) => {
    const response = await API.post('/auth/login', { email, password });
    if (response.data.success && response.data.session_token) {
      const newUser = response.data.user;
      const oldUserRaw = localStorage.getItem('user_info');
      
      // If a different user was logged in previously on this browser, purge session state
      if (oldUserRaw) {
        try {
          const oldUser = JSON.parse(oldUserRaw);
          if (oldUser.id !== newUser?.id) {
            localStorage.clear();
          }
        } catch (e) {
          localStorage.clear();
        }
      }

      localStorage.setItem('auth_token', response.data.session_token);
      if (newUser) {
        localStorage.setItem('user_info', JSON.stringify(newUser));
      }
      return response;
    }
    throw new Error(response.data.error_message || 'Authentication failed');
  },

  signup: async (userData) => {
    // Backend's RegisterRequest requires: email, password, confirm_password
    const payload = {
      email: userData.email,
      password: userData.password,
      confirm_password: userData.confirm_password || userData.password,
    };
    return API.post('/auth/register', payload);
  },

  getMe: () => API.get('/auth/me'),

  logout: () => {
    console.log('Logout initiated. Starting auto-save timer...');
    startAutoSaveTimer(); // Start the 10-minute timer
    API.post('/auth/logout').catch(() => {});
    // Redirect immediately but don't clear localStorage yet (auto-save will do it)
    window.location.href = '/login';
  },

  getCurrentUser: () => {
    const raw = localStorage.getItem('user_info');
    if (raw) {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return null;
  },

  saveGroqKey: (key) => API.post('/auth/groq-key', { groq_api_key: key }),
  getGroqKey:  ()    => API.get('/auth/groq-key'),
  deleteGroqKey: ()  => API.post('/auth/groq-key', { groq_api_key: '' }),
  acceptPolicy: ()   => API.post('/auth/accept-policy'),
};

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
export const documentService = {
  upload: (file, courseId) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('course_id', courseId || 'default');
    return API.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  listByCourse: (courseId) => API.get(`/documents/list/${courseId}`),

  listAll: () => API.get('/documents/'),

  delete: (docId) => API.delete(`/documents/${docId}`),

  getRawBlob: (courseId, filename) =>
    API.get(`/documents/raw/${courseId}/${encodeURIComponent(filename)}`, {
      responseType: 'blob',
    }),

  getThumbnailBlob: (courseId) =>
    API.get(`/documents/thumbnail/${courseId}`, {
      responseType: 'blob',
    }),

  getParagraphs: (courseId, filename) =>
    API.get(`/documents/paragraphs/${courseId}/${encodeURIComponent(filename)}`),

  getPageCount: (courseId, filename) =>
    API.get(`/documents/pagecount/${courseId}/${encodeURIComponent(filename)}`),

  getPageImage: (courseId, filename, pageNum) =>
    API.get(`/documents/page/${courseId}/${encodeURIComponent(filename)}/${pageNum}`, {
      responseType: 'blob',
    }),

  saveAnnotation: (courseId, filename, data) =>
    API.post(`/documents/annotations/${courseId}/${encodeURIComponent(filename)}`, data),

  getAnnotations: (courseId, filename) =>
    API.get(`/documents/annotations/${courseId}/${encodeURIComponent(filename)}`),

  deleteAnnotation: (courseId, filename, annotationId) =>
    API.delete(`/documents/annotations/${courseId}/${encodeURIComponent(filename)}/${annotationId}`),
};

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
export const chatService = {
  sendMessage: (message, courseId, useEli12 = false, personality = 'strict') =>
    API.post('/chat/ask', { course_id: courseId, question: message, use_eli12: useEli12, personality }),

  getHistory: (courseId) => API.get(`/chat/history/${courseId}`),

  clearMemory: (courseId) => API.delete('/chat/memory/clear', { params: { course_id: courseId } }),

  // Streaming — returns a native fetch Response so the caller can iterate SSE chunks
  streamMessage: async (message, courseId, useEli12 = false, personality = 'strict') => {
    const token = localStorage.getItem('auth_token');
    const groqKey = localStorage.getItem('groq_api_key');

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (groqKey) headers['X-Groq-API-Key'] = groqKey;

    return fetch(`/api/chat/ask-stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ course_id: courseId, question: message, use_eli12: useEli12, personality }),
    });
  },
};

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------
export const quizService = {
  generate: (courseId, numQuestions = 5, difficulty = 'easy', quizType = 'mixed', topic = null) =>
    API.post('/quiz/generate', {
      course_id: courseId,
      num_questions: numQuestions,
      difficulty: difficulty.toLowerCase(),
      quiz_type: quizType,
      topic: topic || null,
    }),

  submit: (quizData) => API.post('/quiz/evaluate', quizData),
};

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------
export const flashcardService = {
  generate: (courseId, numCards = 10, explanationLevel = 'detailed', filename = null, topic = null) =>
    API.post('/flashcards/generate', {
      course_id: courseId,
      num_cards: numCards,
      include_images: true,
      explanation_level: explanationLevel,
      filename: filename || null,
      topic: topic || null,
    }),

  // Use the /stats/courses endpoint which returns all user courses
  getDecks: () => API.get('/stats/courses'),
};

// ---------------------------------------------------------------------------
// Mastery
// ---------------------------------------------------------------------------
export const masteryService = {
  update: (courseId, conceptId, familiarity) =>
    API.post('/mastery/update', { course_id: courseId, concept_id: conceptId, familiarity }),

  getProfile: (courseId) => API.get(`/mastery/profile/${courseId}`),
  
  getHistory: (courseId, days = 30) => API.get(`/mastery/history/${courseId}`, { params: { days } }),
  
  getStats: (courseId) => API.get(`/mastery/stats/${courseId}`),
  
  getStale: (courseId, days = 14) => API.get(`/mastery/stale/${courseId}`, { params: { days } }),
  
  getReviewSchedule: (courseId) => API.get(`/mastery/review-schedule/${courseId}`),
  
  applyDecay: (courseId) => API.post(`/mastery/apply-decay/${courseId}`),
  
  reset: (courseId) => API.post(`/mastery/reset/${courseId}`),
};

// ---------------------------------------------------------------------------
// Stats / Dashboard
// ---------------------------------------------------------------------------
export const statService = {
  // Full stats payload used by the dashboard
  getOverview: () => API.get('/stats/stats'),

  // Just the course list
  getCourses: () => API.get('/stats/courses'),

  logActivity: (activityType, data) =>
    API.post('/stats/activity', data, { params: { activity_type: activityType } }),
};

// ---------------------------------------------------------------------------
// Summary & Planner  (bonus endpoints wired for future use)
// ---------------------------------------------------------------------------
export const summaryService = {
  generate: (courseId, documentName = null, style = 'detailed', topic = null) => 
    API.post('/summary/generate', { 
      course_id: courseId, 
      document_name: documentName,
      style: style,
      topic: topic || null,
    }),
};

export const plannerService = {
  create: (courseId, courseName, examDate, topics, focusTopic = null) => 
    API.post('/planner/create', { 
      course_id: courseId, 
      course_name: courseName, 
      exam_date: examDate, 
      topics,
      focus_topic: focusTopic || null,
    }),
  discoverTopics: (courseId) =>
    API.get(`/planner/discover/${courseId}`),
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export const adminService = {
  getStats: () => API.get('/admin/stats'),
  getUsers: () => API.get('/admin/users'),
  getUserCourses: (userId) => API.get(`/admin/users/${userId}/courses`),
  deleteUser: (userId) => API.delete(`/admin/users/${userId}`),
  makeAdmin: (userId) => API.post(`/admin/users/${userId}/make-admin`),
  revokeAdmin: (userId) => API.post(`/admin/users/${userId}/revoke-admin`),
  deleteCourse: (userId, courseId) => API.delete(`/admin/courses/${userId}/${courseId}`),
  getAllCourses: () => API.get('/admin/courses/all'),
  getInteractions: (limit = 100) => API.get('/admin/interactions', { params: { limit } }),
  deleteDocument: (userId, courseId, filename) => API.delete(`/admin/documents/${userId}/${courseId}/${encodeURIComponent(filename)}`),
};

// ---------------------------------------------------------------------------
// Saved Assets
// ---------------------------------------------------------------------------
export const assetService = {
  save: (courseId, assetType, title, data, metadata = null) =>
    API.post('/assets/save', { course_id: courseId, asset_type: assetType, title, data, metadata }),
  
  list: (assetType = null, courseId = null) => {
    const params = {};
    if (assetType) params.asset_type = assetType;
    if (courseId) params.course_id = courseId;
    return API.get('/assets/list', { params });
  },
  
  get: (assetId) => API.get(`/assets/get/${assetId}`),
  
  update: (assetId, updates) => API.put(`/assets/update/${assetId}`, updates),
  
  delete: (assetId) => API.delete(`/assets/delete/${assetId}`),
  
  getStats: () => API.get('/assets/stats'),
};

// ---------------------------------------------------------------------------
// InSpace (Canvas)
// ---------------------------------------------------------------------------
export const inSpaceService = {
  generate: (topic, documentId = null) =>
    API.post('/inspace/generate', { topic, document_id: documentId }),

  list: () => API.get('/inspace/list'),

  getCanvas: (canvasId) => API.get(`/inspace/canvas/${canvasId}`),

  getNodeDetails: (canvasId, nodeId, label, topic, documentId = null) =>
    API.get(`/inspace/canvas/${canvasId}/node/${nodeId}/details`, {
      params: { label, topic, document_id: documentId }
    }),

  updateNodeMastery: (canvasId, nodeId, mastery, confidence, attemptsIncrement = 1, timeIncrement = 0) =>
    API.put(`/inspace/canvas/${canvasId}/node/${nodeId}/mastery`, {
      mastery,
      confidence,
      attempts_increment: attemptsIncrement,
      time_increment: timeIncrement
    }),

  updateNodeNotes: (canvasId, nodeId, notes, isBookmarked) =>
    API.put(`/inspace/canvas/${canvasId}/node/${nodeId}/notes`, {
      notes,
      is_bookmarked: isBookmarked ? 1 : 0
    }),

  askNodeQuestion: (canvasId, nodeId, label, question) =>
    API.post(`/inspace/canvas/${canvasId}/ask`, {
      node_id: nodeId,
      label,
      question
    }),

  deleteCanvas: (canvasId) => API.delete(`/inspace/canvas/${canvasId}`),
};

export default API;
