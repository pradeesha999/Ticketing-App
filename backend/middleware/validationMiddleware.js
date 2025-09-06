const { body, validationResult, param, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const xss = require('xss-clean');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');

// Rate limiting middleware
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      // Ensure CORS headers are sent even when rate limited
      const origin = req.headers.origin;
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,X-API-Key');
      }
      
      res.status(429).json({
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// General rate limiter
const generalLimiter = createRateLimiter(15 * 60 * 1000, 1000); // 1000 requests per 15 minutes

// Rate limiter for auth endpoints (more reasonable for development)
const authLimiter = createRateLimiter(15 * 60 * 1000, 100); // 100 requests per 15 minutes

// API rate limiter
const apiLimiter = createRateLimiter(15 * 60 * 1000, 500); // 500 requests per 15 minutes

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Sanitize body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
  }
  
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key].trim();
      }
    });
  }
  
  next();
};

// Request size validation
const validateRequestSize = (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (contentLength > maxSize) {
    return res.status(413).json({
      error: 'Request entity too large',
      maxSize: '10MB'
    });
  }
  
  next();
};

// File upload validation
const validateFileUpload = (req, res, next) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({
      error: 'No files were uploaded'
    });
  }
  
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  const maxFileSize = 5 * 1024 * 1024; // 5MB
  
  for (const fieldName in req.files) {
    const file = req.files[fieldName];
    
    if (Array.isArray(file)) {
      for (const singleFile of file) {
        if (!allowedTypes.includes(singleFile.mimetype)) {
          return res.status(400).json({
            error: `File type not allowed: ${singleFile.name}`,
            allowedTypes: allowedTypes
          });
        }
        
        if (singleFile.size > maxFileSize) {
          return res.status(400).json({
            error: `File too large: ${singleFile.name}`,
            maxSize: '5MB'
          });
        }
      }
    } else {
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          error: `File type not allowed: ${file.name}`,
          allowedTypes: allowedTypes
        });
      }
      
      if (file.size > maxFileSize) {
        return res.status(400).json({
          error: `File too large: ${file.name}`,
          maxSize: '5MB'
        });
      }
    }
  }
  
  next();
};

// Security middleware
const securityMiddleware = [
  helmet(),
  xss(),
  hpp(),
  mongoSanitize(),
  (req, res, next) => {
    // Additional security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  }
];

// Validation schemas
const userValidation = {
  create: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters')
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage('Name can only contain letters and spaces'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Must be a valid email address'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    body('role')
      .isIn(['superadmin', 'student', 'party'])
      .withMessage('Invalid role specified'),
    body('department')
      .optional()
      .isMongoId()
      .withMessage('Invalid department ID'),
    body('isAdmin')
      .optional()
      .isBoolean()
      .withMessage('isAdmin must be a boolean'),
    handleValidationErrors
  ],
  
  update: [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters')
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage('Name can only contain letters and spaces'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Must be a valid email address'),
    body('role')
      .optional()
      .isIn(['superadmin', 'student', 'party'])
      .withMessage('Invalid role specified'),
    body('department')
      .optional()
      .isMongoId()
      .withMessage('Invalid department ID'),
    body('isAdmin')
      .optional()
      .isBoolean()
      .withMessage('isAdmin must be a boolean'),
    handleValidationErrors
  ]
};

const ticketValidation = {
  create: [
    body('title')
      .trim()
      .isLength({ min: 5, max: 200 })
      .withMessage('Title must be between 5 and 200 characters'),
    body('description')
      .trim()
      .isLength({ min: 10, max: 2000 })
      .withMessage('Description must be between 10 and 2000 characters'),
    body('categoryId')
      .isMongoId()
      .withMessage('Invalid category ID'),
    body('priority')
      .optional()
      .isIn(['Low', 'Medium', 'High', 'Critical'])
      .withMessage('Invalid priority level'),
    handleValidationErrors
  ],
  
  updateStatus: [
    body('status')
      .isIn(['Issued', 'Seen', 'In Progress', 'Resolved', 'Denounced'])
      .withMessage('Invalid status'),
    body('resolution')
      .optional()
      .trim()
      .isLength({ min: 5, max: 1000 })
      .withMessage('Resolution must be between 5 and 1000 characters'),
    handleValidationErrors
  ],
  
  addMessage: [
    body('message')
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Message must be between 1 and 1000 characters'),
    handleValidationErrors
  ],
  
  requestApproval: [
    body('adminId')
      .isMongoId()
      .withMessage('Invalid admin ID'),
    body('notes')
      .optional()
      .trim()
      .isLength({ min: 5, max: 500 })
      .withMessage('Notes must be between 5 and 500 characters'),
    handleValidationErrors
  ],
  
  approve: [
    body('notes')
      .trim()
      .isLength({ min: 5, max: 500 })
      .withMessage('Approval notes must be between 5 and 500 characters'),
    handleValidationErrors
  ]
};

const medicalSubmissionValidation = {
  create: [
    body('medicalCondition')
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage('Medical condition must be between 3 and 100 characters'),
    body('startDate')
      .isISO8601()
      .withMessage('Start date must be a valid date'),
    body('endDate')
      .isISO8601()
      .withMessage('End date must be a valid date')
      .custom((endDate, { req }) => {
        if (new Date(endDate) <= new Date(req.body.startDate)) {
          throw new Error('End date must be after start date');
        }
        return true;
      }),
    handleValidationErrors
  ],
  
  review: [
    body('status')
      .isIn(['approved', 'rejected'])
      .withMessage('Status must be either approved or rejected'),
    body('reviewNotes')
      .trim()
      .isLength({ min: 5, max: 500 })
      .withMessage('Review notes must be between 5 and 500 characters'),
    handleValidationErrors
  ]
};

const resitFormValidation = {
  create: [
    body('course')
      .isMongoId()
      .withMessage('Invalid course ID'),
    body('batch')
      .isMongoId()
      .withMessage('Invalid batch ID'),
    body('module')
      .isMongoId()
      .withMessage('Invalid module ID'),
    body('examType')
      .isIn(['Coursework', 'Exam'])
      .withMessage('Exam type must be either Coursework or Exam'),
    body('pastExamDates')
      .isArray({ min: 1, max: 3 })
      .withMessage('Must provide 1-3 past exam dates'),
    body('pastExamDates.*')
      .isISO8601()
      .withMessage('Past exam dates must be valid dates'),
    body('phoneNumber')
      .matches(/^\d{10}$/)
      .withMessage('Phone number must be exactly 10 digits (numbers only)'),
    body('isMedical')
      .isBoolean()
      .withMessage('isMedical must be a boolean'),
    body('medicalSubmission')
      .optional()
      .isMongoId()
      .withMessage('Invalid medical submission ID'),
    handleValidationErrors
  ],
  
  approve: [
    body('reviewNotes')
      .trim()
      .isLength({ min: 5, max: 500 })
      .withMessage('Review notes must be between 5 and 500 characters'),
    handleValidationErrors
  ]
};

const courseValidation = {
  create: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Course name must be between 2 and 100 characters'),
    body('code')
      .trim()
      .isLength({ min: 2, max: 20 })
      .withMessage('Course code must be between 2 and 20 characters')
      .matches(/^[A-Z0-9]+$/)
      .withMessage('Course code must contain only uppercase letters and numbers'),
    body('description')
      .optional()
      .trim()
      .isLength({ min: 5, max: 500 })
      .withMessage('Description must be between 5 and 500 characters'),
    body('courseDirector')
      .isMongoId()
      .withMessage('Invalid course director ID'),
    handleValidationErrors
  ]
};

const batchValidation = {
  create: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Batch name must be between 2 and 50 characters'),
    body('code')
      .trim()
      .isLength({ min: 2, max: 20 })
      .withMessage('Batch code must be between 2 and 20 characters'),
    body('course')
      .isMongoId()
      .withMessage('Invalid course ID'),
    body('startYear')
      .isInt({ min: 2000, max: 2030 })
      .withMessage('Start year must be between 2000 and 2030'),
    body('endYear')
      .isInt({ min: 2000, max: 2030 })
      .withMessage('End year must be between 2000 and 2030')
      .custom((endYear, { req }) => {
        if (endYear <= req.body.startYear) {
          throw new Error('End year must be after start year');
        }
        return true;
      }),
    handleValidationErrors
  ]
};

const moduleValidation = {
  create: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Module name must be between 2 and 100 characters'),
    body('code')
      .trim()
      .isLength({ min: 2, max: 20 })
      .withMessage('Module code must be between 2 and 20 characters'),
    body('batch')
      .isMongoId()
      .withMessage('Invalid batch ID'),
    body('course')
      .isMongoId()
      .withMessage('Invalid course ID'),
    body('credits')
      .isInt({ min: 1, max: 30 })
      .withMessage('Credits must be between 1 and 30'),
    handleValidationErrors
  ]
};

const departmentValidation = {
  create: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Department name must be between 2 and 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ min: 5, max: 500 })
      .withMessage('Description must be between 5 and 500 characters'),
    body('assignedParty')
      .optional()
      .isMongoId()
      .withMessage('Invalid assigned party ID'),
    handleValidationErrors
  ]
};

const categoryValidation = {
  create: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Category name must be between 2 and 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ min: 5, max: 500 })
      .withMessage('Description must be between 5 and 500 characters'),
    body('department')
      .isMongoId()
      .withMessage('Invalid department ID'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
    handleValidationErrors
  ]
};

// ID validation middleware
const validateId = [
  param('id').isMongoId().withMessage('Invalid ID format'),
  handleValidationErrors
];

// Pagination validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

module.exports = {
  // Rate limiters
  generalLimiter,
  authLimiter,
  apiLimiter,
  
  // Security middleware
  securityMiddleware,
  
  // Input sanitization
  sanitizeInput,
  
  // Request validation
  validateRequestSize,
  validateFileUpload,
  
  // Validation schemas
  userValidation,
  ticketValidation,
  medicalSubmissionValidation,
  resitFormValidation,
  courseValidation,
  batchValidation,
  moduleValidation,
  departmentValidation,
  categoryValidation,
  
  // Common validations
  validateId,
  validatePagination,
  
  // Error handler
  handleValidationErrors
};
