const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Environment configuration
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

// Security headers middleware
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.web3.storage", "https://sepolia.infura.io", "https://mainnet.infura.io"],
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
});

// Rate limiting configurations
const createRateLimit = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: message });
  }
});

const rateLimits = {
  // General API rate limiting
  general: createRateLimit(
    15 * 60 * 1000, // 15 minutes
    100, // limit each IP to 100 requests per windowMs
    'Too many requests, please try again later'
  ),
  
  // Strict rate limiting for auth endpoints
  auth: createRateLimit(
    15 * 60 * 1000, // 15 minutes
    5, // limit each IP to 5 login attempts per windowMs
    'Too many authentication attempts, please try again later'
  ),
  
  // File upload rate limiting
  upload: createRateLimit(
    60 * 1000, // 1 minute
    10, // limit each IP to 10 uploads per minute
    'Too many file uploads, please try again later'
  ),
  
  // Blockchain transaction rate limiting
  blockchain: createRateLimit(
    60 * 1000, // 1 minute
    20, // limit each IP to 20 blockchain operations per minute
    'Too many blockchain requests, please try again later'
  )
};

// Slow down middleware for additional protection
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per windowMs without delay
  delayMs: () => 500, // add 500ms delay per request after delayAfter
  validate: { delayMs: false } // disable warning
});

// Input validation rules
const validationRules = {
  // User registration/login validation
  auth: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address')
      .isLength({ max: 100 })
      .withMessage('Email too long'),
    body('password')
      .isLength({ min: 6, max: 128 })
      .withMessage('Password must be between 6 and 128 characters')
  ],

  // Trade creation validation
  trade: [
    body('supplier')
      .isEthereumAddress()
      .withMessage('Invalid supplier Ethereum address'),
    body('buyer')
      .isEthereumAddress()
      .withMessage('Invalid buyer Ethereum address'),
    body('amount')
      .isFloat({ min: 0.01, max: 1000000 })
      .withMessage('Amount must be between 0.01 and 1,000,000'),
    body('depositPct')
      .isInt({ min: 10, max: 50 })
      .withMessage('Deposit percentage must be between 10 and 50'),
    body('financePct')
      .isInt({ min: 30, max: 80 })
      .withMessage('Finance percentage must be between 30 and 80'),
    body('commodity')
      .isLength({ min: 2, max: 100 })
      .withMessage('Commodity name must be between 2 and 100 characters')
      .isAlphanumeric('en-US', { ignore: ' -_' })
      .withMessage('Commodity name contains invalid characters'),
    body('quantity')
      .isFloat({ min: 0.01 })
      .withMessage('Quantity must be greater than 0.01')
  ],

  // KYC submission validation
  kyc: [
    body('company')
      .isLength({ min: 2, max: 200 })
      .withMessage('Company name must be between 2 and 200 characters')
      .matches(/^[a-zA-Z0-9\s\-&.,()]+$/)
      .withMessage('Company name contains invalid characters'),
    body('country')
      .isLength({ min: 2, max: 100 })
      .withMessage('Country must be between 2 and 100 characters')
      .isAlpha('en-US', { ignore: ' -' })
      .withMessage('Country name contains invalid characters'),
    body('regNumber')
      .isLength({ min: 1, max: 50 })
      .withMessage('Registration number must be between 1 and 50 characters')
      .isAlphanumeric('en-US', { ignore: '-_' })
      .withMessage('Registration number contains invalid characters'),
    body('fullName')
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be between 2 and 100 characters')
      .matches(/^[a-zA-Z\s\-']+$/)
      .withMessage('Full name contains invalid characters')
  ],

  // Document upload validation
  document: [
    body('tradeId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Trade ID must be a positive integer'),
    body('docType')
      .isIn(['invoice', 'bill_of_lading', 'certificate', 'contract', 'other'])
      .withMessage('Invalid document type'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description too long')
  ],

  // Admin operations validation
  admin: [
    body('action')
      .isIn(['update_settings', 'manage_user', 'export_data', 'system_config'])
      .withMessage('Invalid admin action'),
    body('data')
      .isObject()
      .withMessage('Data must be a valid object')
  ]
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

// JWT token utilities
const tokenUtils = {
  // Generate JWT token
  generateToken: (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  },

  // Verify JWT token
  verifyToken: (token) => {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  },

  // Extract token from request
  extractToken: (req) => {
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;
    
    return tokenFromHeader || req.headers['x-auth-token'] || req.query.token;
  }
};

// Password utilities
const passwordUtils = {
  // Hash password
  hashPassword: async (password) => {
    return await bcrypt.hash(password, BCRYPT_ROUNDS);
  },

  // Compare password
  comparePassword: async (password, hash) => {
    return await bcrypt.compare(password, hash);
  },

  // Generate secure random password
  generateSecurePassword: (length = 16) => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@$!%*?&';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }
};

// Authentication middleware
const authMiddleware = {
  // Require authentication
  requireAuth: (req, res, next) => {
    try {
      const token = tokenUtils.extractToken(req);
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const decoded = tokenUtils.verifyToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
  },

  // Require admin role
  requireAdmin: (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  },

  // Require specific role
  requireRole: (roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access requires one of these roles: ${roles.join(', ')}` });
    }
    next();
  },

  // Optional authentication (attach user if token present)
  optionalAuth: (req, res, next) => {
    try {
      const token = tokenUtils.extractToken(req);
      if (token) {
        const decoded = tokenUtils.verifyToken(token);
        req.user = decoded;
      }
    } catch (error) {
      // Ignore token errors for optional auth
    }
    next();
  }
};

// File upload security
const fileUploadSecurity = {
  // Allowed file types
  allowedTypes: {
    documents: ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'],
    images: ['.jpg', '.jpeg', '.png', '.gif'],
    all: ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif', '.txt']
  },

  // File size limits (in bytes)
  sizeLimits: {
    document: 10 * 1024 * 1024, // 10MB
    image: 5 * 1024 * 1024,     // 5MB
    default: 10 * 1024 * 1024   // 10MB
  },

  // Validate file upload
  validateFile: (file, type = 'documents') => {
    const errors = [];
    
    if (!file) {
      errors.push('No file provided');
      return { valid: false, errors };
    }

    // Check file extension
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (!fileUploadSecurity.allowedTypes[type].includes(ext)) {
      errors.push(`File type ${ext} not allowed. Allowed types: ${fileUploadSecurity.allowedTypes[type].join(', ')}`);
    }

    // Check file size
    const sizeLimit = fileUploadSecurity.sizeLimits[type] || fileUploadSecurity.sizeLimits.default;
    if (file.size > sizeLimit) {
      errors.push(`File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds limit of ${(sizeLimit / 1024 / 1024)}MB`);
    }

    // Check for suspicious file names
    if (/[<>:"\/\\|?*\x00-\x1f]/.test(file.originalname)) {
      errors.push('File name contains invalid characters');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};

module.exports = {
  securityHeaders,
  rateLimits,
  speedLimiter,
  validationRules,
  handleValidationErrors,
  tokenUtils,
  passwordUtils,
  authMiddleware,
  fileUploadSecurity
};
