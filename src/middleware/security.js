const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Security middleware configuration
const securityConfig = {
  // Helmet configuration for security headers
  helmet: helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.web3.storage", "https://sepolia.infura.io"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false, // Disable for Web3 compatibility
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }),

  // Rate limiting configurations
  rateLimits: {
    // General API rate limit
    general: rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
    }),

    // Strict rate limit for auth endpoints
    auth: rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // Limit each IP to 5 auth requests per windowMs
      message: {
        error: 'Too many authentication attempts, please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
    }),

    // File upload rate limit
    upload: rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // Limit each IP to 10 uploads per hour
      message: {
        error: 'Too many file uploads, please try again later.',
        retryAfter: '1 hour'
      },
      standardHeaders: true,
      legacyHeaders: false,
    }),

    // Blockchain transaction rate limit
    blockchain: rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 20, // Limit each IP to 20 blockchain requests per 5 minutes
      message: {
        error: 'Too many blockchain requests, please try again later.',
        retryAfter: '5 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
    })
  },

  // Input validation rules
  validation: {
    // User registration/login validation
    auth: [
      body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
      body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
    ],

    // Trade creation validation
    trade: [
      body('supplier')
        .isEthereumAddress()
        .withMessage('Invalid supplier address'),
      body('buyer')
        .isEthereumAddress()
        .withMessage('Invalid buyer address'),
      body('amount')
        .isNumeric()
        .isFloat({ min: 0.01 })
        .withMessage('Amount must be a positive number'),
      body('depositPct')
        .isInt({ min: 1, max: 99 })
        .withMessage('Deposit percentage must be between 1 and 99'),
      body('financePct')
        .isInt({ min: 1, max: 99 })
        .withMessage('Finance percentage must be between 1 and 99')
    ],

    // Document upload validation
    document: [
      body('orderId')
        .isInt({ min: 1 })
        .withMessage('Order ID must be a positive integer'),
      body('docType')
        .isInt({ min: 0, max: 4 })
        .withMessage('Document type must be between 0 and 4'),
      body('hash')
        .matches(/^0x[a-fA-F0-9]{64}$/)
        .withMessage('Invalid SHA-256 hash format'),
      body('uri')
        .isURL()
        .withMessage('Invalid URI format')
    ]
  }
};

// Validation result handler
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

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Additional custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  next();
};

// IP whitelist middleware (for admin endpoints)
const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (allowedIPs.length === 0 || allowedIPs.includes(clientIP)) {
      next();
    } else {
      res.status(403).json({
        error: 'Access denied',
        message: 'Your IP address is not authorized to access this endpoint'
      });
    }
  };
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  console.log(`[${timestamp}] ${method} ${url} - IP: ${ip} - UA: ${userAgent}`);
  
  next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Security Error:', err);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: isDevelopment ? err.message : 'Something went wrong',
    ...(isDevelopment && { stack: err.stack })
  });
};

module.exports = {
  securityConfig,
  handleValidationErrors,
  securityHeaders,
  ipWhitelist,
  requestLogger,
  errorHandler
};
