const winston = require('winston');
const path = require('path');

// Log levels and configuration
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
const fs = require('fs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return msg;
  })
);

// Create logger transports
const transports = [];

// Console transport for development
if (NODE_ENV === 'development') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: LOG_LEVEL
    })
  );
}

// File transports for all environments
transports.push(
  // Combined log (all levels)
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format: logFormat,
    level: LOG_LEVEL,
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    tailable: true
  }),
  
  // Error log (error level only)
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    format: logFormat,
    level: 'error',
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    tailable: true
  }),
  
  // Security log for auth and security events
  new winston.transports.File({
    filename: path.join(logsDir, 'security.log'),
    format: logFormat,
    level: 'info',
    maxsize: 5242880, // 5MB
    maxFiles: 10,
    tailable: true
  })
);

// Create the main logger
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: logFormat,
  transports,
  exitOnError: false
});

// Create specialized loggers
const securityLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      maxsize: 5242880,
      maxFiles: 10,
      tailable: true
    })
  ]
});

const auditLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      maxsize: 10485760,
      maxFiles: 20,
      tailable: true
    })
  ]
});

const blockchainLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'blockchain.log'),
      maxsize: 10485760,
      maxFiles: 10,
      tailable: true
    })
  ]
});

// Utility functions for structured logging
const logUtils = {
  // Log API requests
  logAPIRequest: (req, res, responseTime) => {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id || null
    };

    if (res.statusCode >= 400) {
      logger.warn('API Request Failed', logData);
    } else {
      logger.info('API Request', logData);
    }
  },

  // Log authentication events
  logAuth: (event, userId, email, ip, details = {}) => {
    const logData = {
      event,
      userId,
      email,
      ip,
      timestamp: new Date().toISOString(),
      ...details
    };

    securityLogger.info(`Auth Event: ${event}`, logData);
    
    // Also log to audit trail
    auditLogger.info('Authentication Event', logData);
  },

  // Log security events
  logSecurity: (event, details, req = null) => {
    const logData = {
      event,
      timestamp: new Date().toISOString(),
      ip: req?.ip || req?.connection?.remoteAddress || null,
      userAgent: req?.get('User-Agent') || null,
      userId: req?.user?.id || null,
      ...details
    };

    securityLogger.warn(`Security Event: ${event}`, logData);
    logger.warn('Security Alert', logData);
  },

  // Log blockchain transactions
  logBlockchain: (action, details, userId = null) => {
    const logData = {
      action,
      userId,
      timestamp: new Date().toISOString(),
      ...details
    };

    blockchainLogger.info(`Blockchain Action: ${action}`, logData);
  },

  // Log business events
  logBusiness: (event, details, userId = null) => {
    const logData = {
      event,
      userId,
      timestamp: new Date().toISOString(),
      ...details
    };

    logger.info(`Business Event: ${event}`, logData);
    auditLogger.info('Business Event', logData);
  },

  // Log errors with context
  logError: (error, context = {}, req = null) => {
    const logData = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString(),
      ip: req?.ip || req?.connection?.remoteAddress || null,
      userId: req?.user?.id || null,
      url: req?.originalUrl || null,
      method: req?.method || null,
      ...context
    };

    logger.error('Application Error', logData);
  },

  // Log performance metrics
  logPerformance: (operation, duration, details = {}) => {
    const logData = {
      operation,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      ...details
    };

    if (duration > 5000) { // Log slow operations (>5s)
      logger.warn('Slow Operation', logData);
    } else {
      logger.debug('Performance Metric', logData);
    }
  }
};

// Express middleware for request logging
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log the request
  logger.debug('Incoming Request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || null
  });

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;
    logUtils.logAPIRequest(req, res, responseTime);
    originalEnd.apply(this, args);
  };

  next();
};

// Error handling middleware
const errorLogger = (err, req, res, next) => {
  logUtils.logError(err, {
    body: req.body,
    params: req.params,
    query: req.query
  }, req);
  
  next(err);
};

// Graceful shutdown handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  
  // Give logger time to write, then exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString(),
    timestamp: new Date().toISOString()
  });
});

module.exports = {
  logger,
  securityLogger,
  auditLogger,
  blockchainLogger,
  logUtils,
  requestLogger,
  errorLogger
};

