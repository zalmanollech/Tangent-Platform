// Bulletproof Authentication and Database System
// This module ensures admin accounts always exist and work correctly

const { getDatabase } = require('./database');
const { passwordUtils } = require('./security');

// Admin accounts configuration
const ADMIN_ACCOUNTS = [
  {
    id: 'admin_ollech',
    email: 'ollech@gmail.com',
    password: 'admin123',
    name: 'Shmaya Ollech',
    company: 'Sadot group inc'
  },
  {
    id: 'admin_dudi',
    email: 'dudiollech@gmail.com', 
    password: 'admin123',
    name: 'Dudi Ollech',
    company: 'Sadot group inc'
  }
];

/**
 * Ensures admin accounts exist and are properly configured
 * This runs on every server startup to guarantee admin access
 */
async function ensureAdminAccounts() {
  try {
    console.log('🔧 Bulletproof Auth: Ensuring admin accounts...');
    const db = getDatabase();
    
    for (const adminConfig of ADMIN_ACCOUNTS) {
      const { id, email, password, name, company } = adminConfig;
      
      // Find existing user
      let user = db.findUserByEmail(email);
      
      // Generate correct password hash
      const passHash = await passwordUtils.hashPassword(password);
      
      const userData = {
        email: email.toLowerCase(),
        passHash,
        role: 'admin',
        isActive: true,
        emailVerified: true,
        registrationDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        kyc: {
          status: 'verified',
          company,
          country: 'Israel',
          regNumber: 'a2345',
          fullName: name,
          cryptoExperience: 'expert',
          hasWallet: true,
          understoodRisks: true,
          files: [],
          submittedAt: new Date().toISOString(),
          verifiedAt: new Date().toISOString()
        }
      };
      
      if (user) {
        // Update existing user with bulletproof settings
        console.log(`✅ Updating admin account: ${email}`);
        db.update('users', user.id, {
          ...userData,
          id: user.id, // Keep original ID
          updatedBy: 'bulletproof-auth'
        });
      } else {
        // Create new admin user
        console.log(`➕ Creating admin account: ${email}`);
        userData.id = id;
        userData.createdBy = 'bulletproof-auth';
        db.create('users', userData);
      }
    }
    
    console.log('✅ Bulletproof Auth: Admin accounts secured');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Bulletproof Auth failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Enhanced login function that auto-fixes admin accounts if needed
 */
async function bulletproofLogin(email, password) {
  try {
    const db = getDatabase();
    
    // Check if this is an admin email
    const adminConfig = ADMIN_ACCOUNTS.find(admin => 
      admin.email.toLowerCase() === email.toLowerCase()
    );
    
    if (adminConfig) {
      // For admin accounts, ensure they exist and are correct
      await ensureAdminAccounts();
    }
    
    // Find user after potential auto-fix
    const user = db.findUserByEmail(email);
    
    if (!user) {
      return { success: false, error: 'Invalid credentials' };
    }
    
    // For admin accounts, verify against known password
    if (adminConfig) {
      const isCorrectAdminPassword = password === adminConfig.password;
      if (!isCorrectAdminPassword) {
        return { success: false, error: 'Invalid credentials' };
      }
    } else {
      // For non-admin accounts, verify against stored hash
      const isValidPassword = await passwordUtils.comparePassword(password, user.passHash);
      if (!isValidPassword) {
        return { success: false, error: 'Invalid credentials' };
      }
    }
    
    // Check if account is active
    if (!user.isActive) {
      return { success: false, error: 'Account is deactivated' };
    }
    
    return { 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        emailVerified: user.emailVerified
      }
    };
    
  } catch (error) {
    console.error('Bulletproof login error:', error);
    return { success: false, error: 'Login failed' };
  }
}

/**
 * Check if user is admin (for access control)
 */
function isAdminUser(email) {
  return ADMIN_ACCOUNTS.some(admin => 
    admin.email.toLowerCase() === email.toLowerCase()
  );
}

/**
 * Initialize bulletproof authentication system
 */
async function initializeBulletproofAuth() {
  console.log('🚀 Initializing Bulletproof Authentication System...');
  
  // Ensure admin accounts on startup
  await ensureAdminAccounts();
  
  // Set up periodic checks (every hour)
  setInterval(async () => {
    await ensureAdminAccounts();
  }, 60 * 60 * 1000);
  
  console.log('🔒 Bulletproof Authentication System initialized');
}

module.exports = {
  ensureAdminAccounts,
  bulletproofLogin,
  isAdminUser,
  initializeBulletproofAuth,
  ADMIN_ACCOUNTS
};
