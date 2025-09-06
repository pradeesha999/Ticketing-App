const Log = require('../models/Log');

class Logger {
  static async log(options) {
    try {
      const {
        level = 'info',
        category,
        action,
        description,
        userId = null,
        userRole = null,
        userEmail = null,
        ipAddress = null,
        userAgent = null,
        requestMethod = null,
        requestUrl = null,
        requestBody = null,
        responseStatus = null,
        responseTime = null,
        errorMessage = null,
        errorStack = null,
        metadata = {}
      } = options;

      // Ensure category is valid
      const validCategories = ['auth', 'ticket', 'medical', 'resit', 'system', 'security', 'performance'];
      const validCategory = category && validCategories.includes(category) ? category : 'system';

      const logEntry = new Log({
        timestamp: new Date(),
        level,
        category: validCategory,
        action,
        description,
        userId,
        userRole,
        userEmail,
        ipAddress,
        userAgent,
        requestMethod,
        requestUrl,
        requestBody: requestBody ? JSON.stringify(requestBody) : null,
        responseStatus,
        responseTime,
        errorMessage,
        errorStack,
        metadata
      });

      await logEntry.save();

      // Also log to console for development
      if (process.env.NODE_ENV !== 'production') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${category}] ${action}: ${description}`;
        
        switch (level) {
          case 'error':
            console.error(logMessage);
            break;
          case 'warn':
            console.warn(logMessage);
            break;
          case 'debug':
            console.debug(logMessage);
            break;
          default:
            console.log(logMessage);
        }
      }
    } catch (error) {
      console.error('Error saving log entry:', error);
    }
  }

  // Convenience methods for different log levels
  static async info(options) {
    return this.log({ ...options, level: 'info' });
  }

  static async warn(options) {
    return this.log({ ...options, level: 'warn' });
  }

  static async debug(options) {
    return this.log({ ...options, level: 'debug' });
  }

  // Specific logging methods for common actions
  static async logAuth(options) {
    return this.log({ ...options, category: 'auth' });
  }

  static async logTicket(options) {
    return this.log({ ...options, category: 'ticket' });
  }

  static async logMedical(options) {
    return this.log({ ...options, category: 'medical' });
  }

  static async logResit(options) {
    return this.log({ ...options, category: 'resit' });
  }

  static async logSystem(options) {
    return this.log({ ...options, category: 'system' });
  }

  static async logSecurity(options) {
    return this.log({ ...options, category: 'security' });
  }

  static async logPerformance(options) {
    return this.log({ ...options, category: 'performance' });
  }

  // Generic logging methods that automatically assign categories
  static async logError(options) {
    // Ensure category is not 'error' since that's not a valid enum value
    const { category, ...otherOptions } = options;
    const validCategory = category && category !== 'error' ? category : 'system';
    return this.log({ ...otherOptions, level: 'error', category: validCategory });
  }

  static async logWarn(options) {
    const { category, ...otherOptions } = options;
    const validCategory = category || 'system';
    return this.log({ ...otherOptions, level: 'warn', category: validCategory });
  }

  static async logInfo(options) {
    const { category, ...otherOptions } = options;
    const validCategory = category || 'system';
    return this.log({ ...otherOptions, level: 'info', category: validCategory });
  }

  static async logDebug(options) {
    const { category, ...otherOptions } = options;
    const validCategory = category || 'system';
    return this.log({ ...otherOptions, level: 'debug', category: validCategory });
  }

  // Helper method to extract user info from request
  static extractUserInfo(req) {
    return {
      userId: req.user?.id || null,
      userRole: req.user?.role || null,
      userEmail: req.user?.email || null,
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      userAgent: req.get('User-Agent') || null,
      requestMethod: req.method || null,
      requestUrl: req.originalUrl || req.url || null
    };
  }
}

module.exports = Logger;

