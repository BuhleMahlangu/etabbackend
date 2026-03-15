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
const teacherRoutes = require('./routes/teacherRoutes');
const teacherLearnerRoutes = require('./routes/teacherLearnerRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const quizRoutes = require('./routes/quizRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const progressRoutes = require('./routes/progressRoutes');
const supportRoutes = require('./routes/supportRoutes');
const subjectMessageRoutes = require('./routes/subjectMessageRoutes');

const app = express();

// Security middleware
app.use(helmet());

// CORS - Support multiple origins
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (corsOrigins.indexOf(origin) !== -1 || corsOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.log('[CORS] Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
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

// ============================================
// ADDED: Cloudinary configuration check
// ============================================
const checkCloudinaryConfig = () => {
  const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn(`⚠️  Missing Cloudinary config: ${missing.join(', ')}`);
    return false;
  }
  return true;
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'E-tab API',
    timestamp: new Date().toISOString() 
  });
});

// ============================================
// ADDED: Cloudinary status check endpoint
// ============================================
app.get('/api/health/cloudinary', (req, res) => {
  const isConfigured = checkCloudinaryConfig();
  res.json({ 
    status: isConfigured ? 'OK' : 'WARNING', 
    cloudinary: isConfigured ? 'Configured' : 'Missing environment variables',
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || null
  });
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working', timestamp: new Date() });
});

// ============================================
// ADDED: Database connection test
// ============================================
const db = require('./config/database');
app.get('/api/health/db', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ 
      status: 'OK', 
      database: 'Connected',
      serverTime: result.rows[0].now 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      database: 'Disconnected',
      error: error.message 
    });
  }
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
app.use('/api/teachers', teacherRoutes);
app.use('/api/teacher-learners', teacherLearnerRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/subject-messages', subjectMessageRoutes);

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

// Check Cloudinary on startup
const cloudinaryReady = checkCloudinaryConfig();

app.listen(PORT, () => {
  console.log(`
  🎓 E-tab Server Running
  =======================
  Port: ${PORT}
  Environment: ${process.env.NODE_ENV || 'development'}
  JWT Secret: ${process.env.JWT_SECRET ? '✅ Loaded' : '❌ MISSING!'}
  Database: ${process.env.DB_NAME || 'Not configured'}
  Cloudinary: ${cloudinaryReady ? '✅ Configured' : '⚠️  Check config'}
  Rate Limit: ${process.env.NODE_ENV === 'development' ? '⚠️ SKIPPED (DEV)' : '✅ 1000 req/15min'}
  =======================
  API: http://localhost:${PORT}/api
  Docs: http://localhost:${PORT}/api-docs
  =======================
  `);
});