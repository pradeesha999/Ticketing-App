const crypto = require('crypto');

// Generate nonce for CSP
const generateNonce = () => {
  return crypto.randomBytes(16).toString('base64');
};

// Content Security Policy middleware
const cspMiddleware = (req, res, next) => {
  const nonce = generateNonce();
  res.locals.nonce = nonce;
  
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'nonce-" + nonce + "' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', csp);
  next();
};

// Prevent parameter pollution
const preventParameterPollution = (req, res, next) => {
  // Check for duplicate parameters
  const queryKeys = Object.keys(req.query);
  const bodyKeys = Object.keys(req.body);
  
  const hasDuplicates = (keys) => {
    const seen = new Set();
    for (const key of keys) {
      if (seen.has(key)) return true;
      seen.add(key);
    }
    return false;
  };
  
  if (hasDuplicates(queryKeys) || hasDuplicates(bodyKeys)) {
    return res.status(400).json({
      error: 'Parameter pollution detected',
      message: 'Duplicate parameters are not allowed'
    });
  }
  
  next();
};

// SQL injection prevention (for MongoDB, but good practice)
const preventInjection = (req, res, next) => {
  const dangerousPatterns = [
    /(\$where|\$ne|\$gt|\$lt|\$gte|\$lte|\$in|\$nin|\$regex|\$options)/i,
    /javascript:/i,
    /vbscript:/i,
    /onload/i,
    /onerror/i,
    /onclick/i,
    /<script/i,
    /<\/script/i
  ];
  
  const checkValue = (value) => {
    if (typeof value === 'string') {
      return dangerousPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkValue);
    }
    return false;
  };
  
  if (checkValue(req.body) || checkValue(req.query)) {
    return res.status(400).json({
      error: 'Potentially dangerous input detected',
      message: 'Input contains potentially harmful content'
    });
  }
  
  next();
};

// Request method validation
const validateMethod = (allowedMethods) => {
  return (req, res, next) => {
    if (!allowedMethods.includes(req.method)) {
      return res.status(405).json({
        error: 'Method not allowed',
        message: `Method ${req.method} is not allowed for this endpoint`,
        allowedMethods
      });
    }
    next();
  };
};

// API key validation (if needed)
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      message: 'Please provide a valid API key'
    });
  }
  
  // In production, validate against stored API keys
  // For now, just check if it exists
  if (apiKey.length < 10) {
    return res.status(401).json({
      error: 'Invalid API key',
      message: 'API key format is invalid'
    });
  }
  
  next();
};

// IP whitelist middleware
const ipWhitelist = (allowedIPs) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;
    
    if (!allowedIPs.includes(clientIP)) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Your IP address is not authorized to access this resource'
      });
    }
    
    next();
  };
};

// Request frequency limiting per IP
const requestFrequencyLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const clientIP = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;
    const now = Date.now();
    
    if (!requests.has(clientIP)) {
      requests.set(clientIP, { count: 1, resetTime: now + windowMs });
    } else {
      const clientData = requests.get(clientIP);
      
      if (now > clientData.resetTime) {
        clientData.count = 1;
        clientData.resetTime = now + windowMs;
      } else {
        clientData.count++;
        
        if (clientData.count > maxRequests) {
          return res.status(429).json({
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
          });
        }
      }
    }
    
    next();
  };
};

// User agent validation
const validateUserAgent = (req, res, next) => {
  const userAgent = req.get('User-Agent');
  
  if (!userAgent) {
    return res.status(400).json({
      error: 'User agent required',
      message: 'User agent header is required'
    });
  }
  
  // Block suspicious user agents
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /java/i
  ];
  
  if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Automated access is not allowed'
    });
  }
  
  next();
};

// Referrer validation
const validateReferrer = (allowedDomains) => {
  return (req, res, next) => {
    const referrer = req.get('Referrer');
    
    if (!referrer) {
      return res.status(400).json({
        error: 'Referrer required',
        message: 'Referrer header is required'
      });
    }
    
    const referrerDomain = new URL(referrer).hostname;
    
    if (!allowedDomains.includes(referrerDomain)) {
      return res.status(403).json({
        error: 'Invalid referrer',
        message: 'Request must come from an authorized domain'
      });
    }
    
    next();
  };
};

// Session validation (if using sessions)
const validateSession = (req, res, next) => {
  if (req.session && req.session.userId) {
    // Check if session is expired
    if (req.session.expiresAt && Date.now() > req.session.expiresAt) {
      req.session.destroy();
      return res.status(401).json({
        error: 'Session expired',
        message: 'Please log in again'
      });
    }
    
    // Extend session
    req.session.expiresAt = Date.now() + (30 * 60 * 1000); // 30 minutes
  }
  
  next();
};

module.exports = {
  cspMiddleware,
  preventParameterPollution,
  preventInjection,
  validateMethod,
  validateApiKey,
  ipWhitelist,
  requestFrequencyLimit,
  validateUserAgent,
  validateReferrer,
  validateSession
};
