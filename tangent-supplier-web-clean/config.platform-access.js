// Platform Access Configuration
// Configure who can access the platform vs. who sees the public landing page

module.exports = {
  // IMPORTANT: Add your team member emails here
  // Only these users will be able to access /portal, /admin, and other platform features
  authorizedUsers: [
    // Current team emails (temporary)
    'ollech@gmail.com',             // Your current email
    'dudiollech@gmail.com',         // Your son's current email
    
    // Future tangent-protocol.com emails (add when domain is ready)
    // 'admin@tangent-protocol.com',
    // 'dudi@tangent-protocol.com',
    // 'support@tangent-protocol.com',
  ],

  // Optional: Allow entire domains (be careful with this)
  authorizedDomains: [
    // 'yourcompany.com',           // Uncomment to allow all emails from your company
  ],

  // Admin override key for emergency access
  // Set this as environment variable: PLATFORM_ACCESS_KEY=your-secret-key
  adminOverrideKey: process.env.PLATFORM_ACCESS_KEY || 'change-this-secret-key-123',

  // Routes that require platform access (in addition to /portal, /admin)
  protectedRoutes: [
    '/api/trades',
    '/api/kyc', 
    '/api/users',
    '/uploads',
    '/portal',
    '/admin'
  ],

  // Public routes (accessible to everyone)
  publicRoutes: [
    '/',                    // Landing page
    '/health',             // Health check
    '/public',             // Static files
    '/auth/login',         // Allow login attempts
    // '/auth/register'    // Uncomment to allow public registration
  ],

  // Settings
  settings: {
    // Redirect unauthorized users to landing page instead of showing error
    redirectUnauthorized: true,
    
    // Log unauthorized access attempts
    logUnauthorizedAttempts: true,
    
    // Show access denied message on landing page
    showAccessDeniedMessage: true
  }
};
