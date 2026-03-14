import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Progress API
export const progressAPI = {
  getMyProgress: () => api.get('/progress/my-progress').then(r => r.data),
  getSubjectProgress: (subjectId) => api.get(`/progress/subject/${subjectId}`).then(r => r.data),
  getProgressHistory: (months = 6) => api.get(`/progress/history?months=${months}`).then(r => r.data),
};

// Assignment API
export const assignmentAPI = {
  getMyAssignments: () => api.get('/assignments/my-assignments').then(r => r.data),
  getUpcomingDeadlines: () => api.get('/assignments/upcoming-deadlines').then(r => r.data),
  submit: (assignmentId, formData) => api.post(`/assignments/${assignmentId}/submit`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data),
};

// Quiz API
export const quizAPI = {
  getMyQuizzes: () => api.get('/quizzes/my-quizzes').then(r => r.data),
  getQuiz: (id) => api.get(`/quizzes/${id}`).then(r => r.data),
  startAttempt: (quizId) => api.post(`/quizzes/${quizId}/attempt`).then(r => r.data),
  submitAttempt: (attemptId, answers) => api.post(`/quizzes/attempts/${attemptId}/submit`, { answers }).then(r => r.data),
};

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials).then(r => r.data),
  register: (data) => api.post('/auth/register', data).then(r => r.data),
  getMe: () => api.get('/auth/me').then(r => r.data),
};

// Subject API
export const subjectAPI = {
  getMySubjects: () => api.get('/subjects/my-subjects').then(r => r.data),
  getMaterials: (subjectId) => api.get(`/subjects/${subjectId}/materials`).then(r => r.data),
};

// Notification API
export const notificationAPI = {
  getMyNotifications: () => api.get('/notifications/my-notifications').then(r => r.data),
  markAsRead: (id) => api.put(`/notifications/${id}/read`).then(r => r.data),
};

export default api;
