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
    API.post('/auth/logout').catch(() => {});
    localStorage.clear();
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

  // Signed URL to view raw file inside an <iframe>
  getRawUrl: (courseId, filename) => {
    const token = localStorage.getItem('auth_token');
    return `/api/documents/raw/${courseId}/${encodeURIComponent(filename)}?token=${token}`;
  },

  getThumbnailUrl: (courseId) => {
    const token = localStorage.getItem('auth_token');
    return `/api/documents/thumbnail/${courseId}?token=${token}`;
  },

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
  sendMessage: (message, courseId, useEli12 = false) =>
    API.post('/chat/ask', { course_id: courseId, question: message, use_eli12: useEli12 }),

  getHistory: (courseId) => API.get(`/chat/history/${courseId}`),

  clearMemory: (courseId) => API.delete('/chat/memory/clear', { params: { course_id: courseId } }),

  // Streaming — returns a native fetch Response so the caller can iterate SSE chunks
  streamMessage: async (message, courseId, useEli12 = false) => {
    const token = localStorage.getItem('auth_token');
    const groqKey = localStorage.getItem('groq_api_key');

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (groqKey) headers['X-Groq-API-Key'] = groqKey;

    return fetch(`/api/chat/ask-stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ course_id: courseId, question: message, use_eli12: useEli12 }),
    });
  },
};

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------
export const quizService = {
  generate: (courseId, numQuestions = 5, difficulty = 'easy', quizType = 'mixed') =>
    API.post('/quiz/generate', {
      course_id: courseId,
      num_questions: numQuestions,
      difficulty: difficulty.toLowerCase(),
      quiz_type: quizType,
    }),

  submit: (quizData) => API.post('/quiz/evaluate', quizData),
};

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------
export const flashcardService = {
  generate: (courseId, numCards = 10, explanationLevel = 'detailed', filename = null) =>
    API.post('/flashcards/generate', {
      course_id: courseId,
      num_cards: numCards,
      include_images: true,
      explanation_level: explanationLevel,
      filename: filename || null,
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
  generate: (courseId) => API.post('/summary/generate', { course_id: courseId }),
};

export const plannerService = {
  create: (courseId, courseName, examDate, topics) => 
    API.post('/planner/create', { course_id: courseId, course_name: courseName, exam_date: examDate, topics }),
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
};

export default API;
