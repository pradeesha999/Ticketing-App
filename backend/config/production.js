module.exports = {
  // Server Configuration
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'production',
  
  // Database Configuration
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/ticketing-system',
  
  // JWT Configuration
  jwtSecret: process.env.JWT_SECRET || 'change-this-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  
  // Security Configuration
  allowedOrigins: process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : 
    ['https://yourdomain.com'],
  corsCredentials: process.env.CORS_CREDENTIALS === 'true',
  
  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  authRateLimitMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 5,
  
  // File Upload Configuration
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880, // 5MB
  allowedFileTypes: process.env.ALLOWED_FILE_TYPES ? 
    process.env.ALLOWED_FILE_TYPES.split(',') : 
    ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'],
  uploadPath: process.env.UPLOAD_PATH || './uploads',
  
  // Request Configuration
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS) || 30000,
  maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
  
  // Logging Configuration
  logLevel: process.env.LOG_LEVEL || 'info',
  logFilePath: process.env.LOG_FILE_PATH || './logs/app.log',
  
  // Session Configuration
  sessionSecret: process.env.SESSION_SECRET || 'change-this-in-production',
  sessionMaxAge: parseInt(process.env.SESSION_MAX_AGE) || 1800000, // 30 minutes
  
  // API Configuration
  apiVersion: process.env.API_VERSION || 'v1',
  apiPrefix: process.env.API_PREFIX || '/api',
  
  // Monitoring Configuration
  enableMonitoring: process.env.ENABLE_MONITORING === 'true',
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
  
  // Security Headers
  securityHeaders: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  },
  
  // CORS Configuration
  cors: {
    origin: process.env.ALLOWED_ORIGINS ? 
      process.env.ALLOWED_ORIGINS.split(',') : 
      ['https://yourdomain.com'],
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400 // 24 hours
  },
  
  // Rate Limiting Configuration
  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: 900
    },
    standardHeaders: true,
    legacyHeaders: false
  },
  
  // File Upload Limits
  fileUpload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880,
    maxFiles: 5,
    allowedMimeTypes: process.env.ALLOWED_FILE_TYPES ? 
      process.env.ALLOWED_FILE_TYPES.split(',') : 
      ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
  },
  
  // Request Validation
  validation: {
    maxTitleLength: 200,
    maxDescriptionLength: 2000,
    maxMessageLength: 1000,
    maxNotesLength: 500,
    maxNameLength: 50,
    maxEmailLength: 100,
    minPasswordLength: 8
  },
  
  // Database Connection Options
  database: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    bufferMaxEntries: 0,
    bufferCommands: false
  }
};
