const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import middleware
const { requestLogger, errorLogger, authLogger } = require('./middleware/loggingMiddleware');
// Validation middleware removed - keeping only rate limiting
const { 
  generalLimiter, 
  authLimiter
} = require('./middleware/validationMiddleware');
const { 
  errorHandler, 
  notFound, 
  timeout, 
  corsErrorHandler,
  dbErrorHandler 
} = require('./middleware/errorMiddleware');
const Logger = require('./services/logger');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const ticketRoutes = require('./routes/tickets');
const departmentRoutes = require('./routes/departments');
const analyticsRoutes = require('./routes/analytics');
const categoryRoutes = require('./routes/categories');

// Examination Resit System Routes
const courseRoutes = require('./routes/courses');
const batchRoutes = require('./routes/batches');
const moduleRoutes = require('./routes/modules');
const resitFormRoutes = require('./routes/resit-forms');

// Medical Submission System Routes
const medicalSubmissionRoutes = require('./routes/medical-submissions');
const examinationMedicalRoutes = require('./routes/examination-medical-submissions');

// Logging System Routes
const logsRoutes = require('./routes/logs');

const app = express();

// Security middleware removed

// Apply rate limiting
app.use('/api/auth', authLimiter);
app.use('/api', generalLimiter);

// Apply logging middleware
app.use(requestLogger);
app.use(authLogger);

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  optionsSuccessStatus: 200
}));

// Additional CORS preflight handling
app.options('*', cors());

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files statically (for development)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request size validation removed

// Request timeout - increased for file uploads and complex operations
app.use(timeout(120000)); // 2 minutes

// Check required environment variables
if (!process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET environment variable is required');
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error('ERROR: MONGO_URI environment variable is required');
  process.exit(1);
}

// MongoDB connection with better error handling
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });

// Original ticketing system routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/analytics', analyticsRoutes);

// Examination Resit System routes
app.use('/api/courses', courseRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/resit-forms', resitFormRoutes);

// Medical Submission System routes
app.use('/api/medical-submissions', medicalSubmissionRoutes);
app.use('/api/examination/medical-submissions', examinationMedicalRoutes);

// Logging System routes
app.use('/api/logs', logsRoutes);

// Health check routes
const healthRoutes = require('./routes/health');
app.use('/health', healthRoutes);

// Apply error logging middleware
app.use(errorLogger);

// Apply error handlers last
app.use(corsErrorHandler);
app.use(dbErrorHandler);
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Log server startup
  try {
    Logger.logSystem({
      action: 'server_started',
      description: `Server started on port ${PORT}`,
      metadata: {
        port: PORT,
        environment: process.env.NODE_ENV || 'development'
      }
    });
  } catch (error) {
    console.error('Failed to log server startup:', error.message);
  }
});
