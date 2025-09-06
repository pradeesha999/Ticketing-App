const Logger = require('../services/logger');

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  Logger.log({
    level: 'error',
    category: 'system',
    action: 'server_error',
    description: err.message,
    userId: req.user?.id || null,
    userRole: req.user?.role || null,
    userEmail: req.user?.email || null,
    ipAddress: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.get('User-Agent') || null,
    requestMethod: req.method || null,
    requestUrl: req.originalUrl || req.url || null,
    requestBody: req.body || null,
    errorMessage: err.message,
    errorStack: err.stack,
    metadata: {
      timestamp: new Date().toISOString(),
      errorType: err.constructor.name
    }
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate field value: ${field}`;
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large';
    error = { message, statusCode: 400 };
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    const message = 'Too many files';
    error = { message, statusCode: 400 };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field';
    error = { message, statusCode: 400 };
  }

  // Rate limit errors
  if (err.status === 429) {
    const message = 'Too many requests';
    error = { message, statusCode: 429 };
  }

  // Default error
  const statusCode = error.statusCode || err.statusCode || 500;
  const message = error.message || 'Server Error';

  // Don't leak error details in production
  const response = {
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err
    })
  };

  res.status(statusCode).json(response);
};

// 404 handler
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Request timeout middleware
const timeout = (timeoutMs = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      res.status(408).json({
        error: 'Request timeout',
        message: 'The request took too long to process'
      });
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timer);
    });

    next();
  };
};

// Request size limit middleware
const requestSizeLimit = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxBytes = parseSize(maxSize);
    
    if (contentLength > maxBytes) {
      return res.status(413).json({
        error: 'Request entity too large',
        maxSize: maxSize,
        receivedSize: `${(contentLength / 1024 / 1024).toFixed(2)}MB`
      });
    }
    
    next();
  };
};

// Parse size string to bytes
const parseSize = (size) => {
  const units = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };
  
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/);
  if (!match) return 10 * 1024 * 1024; // Default 10MB
  
  const [, value, unit] = match;
  return parseFloat(value) * units[unit];
};

// CORS error handler
const corsErrorHandler = (err, req, res, next) => {
  if (err.message === 'CORS') {
    return res.status(403).json({
      error: 'CORS error',
      message: 'Not allowed by CORS'
    });
  }
  next(err);
};

// Database connection error handler
const dbErrorHandler = (err, req, res, next) => {
  if (err.name === 'MongoNetworkError' || err.name === 'MongoServerSelectionError') {
    Logger.log({
      level: 'error',
      category: 'system',
      action: 'connection_error',
      description: 'Database connection failed',
      errorMessage: err.message,
      errorStack: err.stack
    });
    
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Database connection failed. Please try again later.'
    });
  }
  next(err);
};

module.exports = {
  errorHandler,
  notFound,
  asyncHandler,
  timeout,
  requestSizeLimit,
  corsErrorHandler,
  dbErrorHandler
};
