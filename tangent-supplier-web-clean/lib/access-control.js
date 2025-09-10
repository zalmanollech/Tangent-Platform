// Enhanced Access Control System
// Prevents public access to platform while allowing team development

const { tokenUtils } = require('./security');
const { logUtils } = require('./logger');

// Load platform access configuration
const platformConfig = require('../config.platform-access');

const AUTHORIZED_USERS = {
  emails: platformConfig.authorizedUsers,
  domains: platformConfig.authorizedDomains,
  adminKey: platformConfig.adminOverrideKey
};

// Check if user is authorized to access platform
const isAuthorizedUser = (email, userRole = null) => {
  // Admin override always authorized
  if (userRole === 'admin-override' || email === 'admin-override') {
    return true;
  }
  
  // Check direct email whitelist
  if (AUTHORIZED_USERS.emails.includes(email.toLowerCase())) {
    return true;
  }
  
  // Check domain whitelist
  const emailDomain = email.split('@')[1];
  if (AUTHORIZED_USERS.domains.includes(emailDomain)) {
    return true;
  }
  
  // Admin users always authorized (for existing admin accounts)
  if (userRole === 'admin') {
    return true;
  }
  
  return false;
};

// Middleware to protect platform routes
const requirePlatformAccess = (req, res, next) => {
  try {
    // Check for admin override key in headers, query, or session
    const overrideKey = req.headers['x-platform-key'] || req.query.platformKey || req.session?.platformKey;
    if (overrideKey === AUTHORIZED_USERS.adminKey) {
      // Store override key in session for subsequent requests
      if (req.session) {
        req.session.platformKey = overrideKey;
      }
      // Set override in user context
      req.user = req.user || { email: 'admin-override', role: 'admin-override' };
      return next();
    }
    
    // Extract and verify JWT token
    const token = tokenUtils.extractToken(req);
    if (!token) {
      return redirectToLanding(res, 'Authentication required');
    }

    const decoded = tokenUtils.verifyToken(token);
    req.user = decoded;
    
    // Check if user is authorized - admin users are always allowed
    if (decoded.role === 'admin') {
      // Admin users always have access
      return next();
    }
    
    if (!isAuthorizedUser(decoded.email, decoded.role)) {
      logUtils.logSecurity('unauthorized_platform_access_attempt', {
        email: decoded.email,
        role: decoded.role,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }, req);
      
      return redirectToLanding(res, 'Access not authorized for this email: ' + decoded.email);
    }
    
    // User is authorized, continue
    next();
    
  } catch (error) {
    logUtils.logSecurity('platform_access_token_error', {
      error: error.message,
      ip: req.ip
    }, req);
    
    return redirectToLanding(res, 'Invalid authentication');
  }
};

// Redirect unauthorized users to landing page
const redirectToLanding = (res, reason) => {
  // For API requests, return JSON error
  if (res.req.path.startsWith('/api/') || res.req.headers.accept?.includes('application/json')) {
    return res.status(403).json({
      error: 'Platform access not authorized',
      message: 'Please contact support for platform access',
      redirectTo: '/'
    });
  }
  
  // For web requests, redirect to landing page
  return res.redirect('/?access=denied&reason=' + encodeURIComponent(reason));
};

// Check if request is for platform routes
const isPlatformRoute = (path) => {
  const platformPaths = [
    '/portal',
    '/admin',
    '/api/trades',
    '/api/kyc', 
    '/api/users',
    '/api/auth/me',
    '/api/admin', // Admin API requires authentication
    '/uploads'
  ];
  
  return platformPaths.some(platformPath => path.startsWith(platformPath));
};

// Middleware to handle all routing logic
const routeHandler = (req, res, next) => {
  const path = req.path;
  
  // Public routes - always accessible
  if (path === '/' || path === '/health' || path.startsWith('/public/')) {
    return next();
  }
  
  // Auth routes - allow all authentication operations
  if (path.startsWith('/auth/')) {
    return next(); // Allow all auth routes including login and register
  }
  
  // TGT and unified registration routes - public access
  if (path.startsWith('/api/tgt') || path.startsWith('/api/unified-register')) {
    return next();
  }
  
  // Emergency and setup routes - public access (temporary for initial setup)
  if (path.startsWith('/emergency') || path.startsWith('/admin-setup') || path.startsWith('/setup') || path === '/activate-admin') {
    return next();
  }
  
  // Platform routes - require authorization
  if (isPlatformRoute(path)) {
    return requirePlatformAccess(req, res, next);
  }
  
  // All other routes continue normally
  next();
};

// Add authorized user (for runtime management)
const addAuthorizedUser = (email, adminKey) => {
  if (adminKey !== AUTHORIZED_USERS.adminKey) {
    throw new Error('Invalid admin key');
  }
  
  if (!AUTHORIZED_USERS.emails.includes(email.toLowerCase())) {
    AUTHORIZED_USERS.emails.push(email.toLowerCase());
    logUtils.logSecurity('authorized_user_added', { email });
    return true;
  }
  
  return false; // Already exists
};

// Remove authorized user
const removeAuthorizedUser = (email, adminKey) => {
  if (adminKey !== AUTHORIZED_USERS.adminKey) {
    throw new Error('Invalid admin key');
  }
  
  const index = AUTHORIZED_USERS.emails.indexOf(email.toLowerCase());
  if (index > -1) {
    AUTHORIZED_USERS.emails.splice(index, 1);
    logUtils.logSecurity('authorized_user_removed', { email });
    return true;
  }
  
  return false; // Not found
};

module.exports = {
  requirePlatformAccess,
  routeHandler,
  isAuthorizedUser,
  addAuthorizedUser,
  removeAuthorizedUser,
  AUTHORIZED_USERS
};
