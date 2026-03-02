// server.js - COMPLETE FIXED VERSION
// MUST be first - load env vars before any other imports
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

// Import all routes AFTER dotenv.config()
const subjectRoutes = require('./routes/subjectRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const materialRoutes = require('./routes/materialRoutes');
const adminRoutes = require('./routes/adminRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const deadlineRoutes = require('./routes/deadlineRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// ============================================
// FIXED: Rate limiting - More lenient for development
// ============================================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 1000,                  // 1000 requests per window (was 100)
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,  // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,   // Disable the `X-RateLimit-*` headers
  
  // Optional: Skip rate limiting for development
  skip: (req) => {
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      console.log(`[DEV] Rate limit skipped for ${req.path}`);
    }
    return isDev; // Skip rate limiting in development
  }
});

app.use(limiter);

// Body parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'E-tab API Documentation'
}));

// ============================================
// ADDED: Request logging for debugging
// ============================================
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'E-tab API',
    timestamp: new Date().toISOString() 
  });
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working', timestamp: new Date() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/deadlines', deadlineRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found',
    path: req.path 
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
  🎓 E-tab Server Running
  =======================
  Port: ${PORT}
  Environment: ${process.env.NODE_ENV || 'development'}
  JWT Secret: ${process.env.JWT_SECRET ? '✅ Loaded' : '❌ MISSING!'}
  Database: ${process.env.DB_NAME || 'Not configured'}
  Rate Limit: ${process.env.NODE_ENV === 'development' ? '⚠️ SKIPPED (DEV)' : '✅ 1000 req/15min'}
  =======================
  API: http://localhost:${PORT}/api
  Docs: http://localhost:${PORT}/api-docs
  =======================
  `);
});