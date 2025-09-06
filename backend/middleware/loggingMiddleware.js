const Logger = require('../services/logger');

// Middleware to log all requests
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request start
  Logger.logSystem({
    action: 'request_started',
    description: `${req.method} ${req.originalUrl}`,
    ...Logger.extractUserInfo(req),
    requestBody: req.body,
    metadata: {
      query: req.query,
      params: req.params
    }
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Log response
    Logger.logPerformance({
      action: 'request_completed',
      description: `${req.method} ${req.originalUrl} - ${res.statusCode}`,
      ...Logger.extractUserInfo(req),
      responseStatus: res.statusCode,
      responseTime,
      metadata: {
        responseSize: chunk ? chunk.length : 0,
        responseHeaders: res.getHeaders()
      }
    });

    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Middleware to log errors
const errorLogger = (err, req, res, next) => {
  Logger.logError({
    category: 'system',
    action: 'error_occurred',
    description: err.message || 'Unknown error',
    ...Logger.extractUserInfo(req),
    errorMessage: err.message,
    errorStack: err.stack,
    responseStatus: err.status || 500,
    metadata: {
      errorName: err.name,
      errorCode: err.code
    }
  });

  next(err);
};

// Middleware to log authentication attempts
const authLogger = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (req.originalUrl.includes('/auth/login')) {
      try {
        const responseData = JSON.parse(data);
        
        if (responseData.token) {
          // Successful login
          Logger.logAuth({
            action: 'login_success',
            description: `User logged in successfully`,
            userEmail: req.body.email,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            responseStatus: res.statusCode,
            metadata: {
              loginMethod: 'email_password'
            }
          });
        } else if (responseData.error) {
          // Failed login
          Logger.logSecurity({
            action: 'login_failed',
            description: `Failed login attempt for ${req.body.email}`,
            userEmail: req.body.email,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            responseStatus: res.statusCode,
            errorMessage: responseData.error,
            metadata: {
              loginMethod: 'email_password',
              reason: responseData.error
            }
          });
        }
      } catch (e) {
        // If response is not JSON, still log the attempt
        Logger.logAuth({
          action: 'login_attempt',
          description: `Login attempt for ${req.body.email}`,
          userEmail: req.body.email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          responseStatus: res.statusCode
        });
      }
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  requestLogger,
  errorLogger,
  authLogger
};

