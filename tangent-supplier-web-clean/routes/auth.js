const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getDatabase } = require('../lib/database');
const { passwordUtils, tokenUtils, validationRules, handleValidationErrors, authMiddleware } = require('../lib/security');
const { logUtils } = require('../lib/logger');
const emailService = require('../lib/email');

// User registration
router.post('/register', validationRules.auth, handleValidationErrors, async (req, res) => {
  try {
    const db = getDatabase();
    const { email, password, role = 'buyer' } = req.body;

    // Validate role
    if (!['buyer', 'supplier', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user already exists
    const existingUser = db.findUserByEmail(email);
    if (existingUser) {
      logUtils.logSecurity('registration_attempt_existing_email', { email }, req);
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passHash = await passwordUtils.hashPassword(password);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const userData = {
      email,
      passHash,
      role,
      kyc: {
        status: 'none',
        files: [],
        cryptoExperience: null,
        hasWallet: false
      },
      isActive: true,
      emailVerified: false,
      verificationToken,
      verificationTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      registrationDate: new Date().toISOString()
    };

    const user = db.createUser(userData);

    // Send verification email
    try {
      await emailService.sendVerificationEmail(email, verificationToken, email.split('@')[0]);
    } catch (emailError) {
      logUtils.logError(emailError, { action: 'send_verification_email', userId: user.id }, req);
    }

    // Generate JWT token
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role
    };
    const token = tokenUtils.generateToken(tokenPayload);

    // Log successful registration
    logUtils.logAuth('user_registered', user.id, email, req.ip);
    logUtils.logBusiness('user_registration', { userId: user.id, role }, user.id);

    // Return success response (don't include password hash)
    const { passHash: _, ...safeUser } = user;
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: safeUser
    });

  } catch (error) {
    logUtils.logError(error, { action: 'user_registration' }, req);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User login
router.post('/login', validationRules.auth, handleValidationErrors, async (req, res) => {
  try {
    const db = getDatabase();
    const { email, password } = req.body;

    // Find user
    const user = db.findUserByEmail(email);
    if (!user) {
      logUtils.logSecurity('login_attempt_invalid_email', { email }, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // TEMPORARILY DISABLE ACTIVE CHECK FOR REBUILD
    // if (!user.isActive) {
    //   logUtils.logSecurity('login_attempt_inactive_user', { email, userId: user.id }, req);
    //   return res.status(401).json({ error: 'Account is deactivated' });
    // }

    // Verify password
    const isValidPassword = await passwordUtils.comparePassword(password, user.passHash);
    if (!isValidPassword) {
      logUtils.logSecurity('login_attempt_invalid_password', { email, userId: user.id }, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role
    };
    const token = tokenUtils.generateToken(tokenPayload);

    // Update last login
    db.update('users', user.id, {
      lastLoginAt: new Date().toISOString(),
      lastLoginIp: req.ip
    });

    // Log successful login
    logUtils.logAuth('user_login', user.id, email, req.ip);

    // Return success response
    const { passHash: _, ...safeUser } = user;
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: safeUser
    });

  } catch (error) {
    logUtils.logError(error, { action: 'user_login' }, req);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout (optional - mainly for logging)
router.post('/logout', authMiddleware.optionalAuth, (req, res) => {
  try {
    if (req.user) {
      logUtils.logAuth('user_logout', req.user.id, req.user.email, req.ip);
    }
    
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    logUtils.logError(error, { action: 'user_logout' }, req);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user profile
router.get('/profile', authMiddleware.requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const user = db.findById('users', req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user profile without sensitive data
    const { passHash: _, ...safeUser } = user;
    res.json({
      success: true,
      user: safeUser
    });

  } catch (error) {
    logUtils.logError(error, { action: 'get_profile' }, req);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/profile', authMiddleware.requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const { fullName, company, country, phone } = req.body;

    // Validate inputs
    const updates = {};
    if (fullName) updates.fullName = fullName.trim();
    if (company) updates.company = company.trim();
    if (country) updates.country = country.trim();
    if (phone) updates.phone = phone.trim();

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    // Update user
    const updatedUser = db.update('users', req.user.id, updates);

    // Log profile update
    logUtils.logBusiness('profile_updated', { updates }, req.user.id);

    const { passHash: _, ...safeUser } = updatedUser;
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: safeUser
    });

  } catch (error) {
    logUtils.logError(error, { action: 'update_profile' }, req);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.post('/change-password', authMiddleware.requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password required' });
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    // Get current user
    const user = db.findById('users', req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await passwordUtils.comparePassword(currentPassword, user.passHash);
    if (!isValidPassword) {
      logUtils.logSecurity('password_change_invalid_current', { userId: user.id }, req);
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPassHash = await passwordUtils.hashPassword(newPassword);

    // Update password
    db.update('users', user.id, {
      passHash: newPassHash,
      passwordChangedAt: new Date().toISOString()
    });

    // Log password change
    logUtils.logAuth('password_changed', user.id, user.email, req.ip);
    logUtils.logSecurity('password_changed', { userId: user.id }, req);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    logUtils.logError(error, { action: 'change_password' }, req);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Verify token (for client-side token validation)
router.post('/verify-token', (req, res) => {
  try {
    const token = tokenUtils.extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = tokenUtils.verifyToken(token);
    
    res.json({
      success: true,
      valid: true,
      user: decoded
    });

  } catch (error) {
    res.status(401).json({
      success: false,
      valid: false,
      error: 'Invalid token'
    });
  }
});

// Email verification
router.get('/verify', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    const db = getDatabase();
    const users = db.getTable('users');
    const user = users.find(u => u.verificationToken === token);

    if (!user) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    if (new Date() > new Date(user.verificationTokenExpiry)) {
      return res.status(400).json({ error: 'Verification token has expired' });
    }

    // Mark email as verified
    db.update('users', user.id, {
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpiry: null,
      verifiedAt: new Date().toISOString()
    });

    logUtils.logAuth('email_verified', user.id, user.email, req.ip);
    logUtils.logBusiness('email_verification', { userId: user.id }, user.id);

    res.json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    logUtils.logError(error, { action: 'email_verification' }, req);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const db = getDatabase();
    const user = db.findUserByEmail(email);

    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    db.update('users', user.id, {
      verificationToken,
      verificationTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    // Send verification email
    await emailService.sendVerificationEmail(email, verificationToken, user.fullName || email.split('@')[0]);

    logUtils.logAuth('verification_resent', user.id, email, req.ip);

    res.json({
      success: true,
      message: 'Verification email sent'
    });

  } catch (error) {
    logUtils.logError(error, { action: 'resend_verification' }, req);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const db = getDatabase();
    const user = db.findUserByEmail(email);

    if (!user) {
      // Don't reveal whether user exists
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    db.update('users', user.id, {
      resetToken,
      resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
    });

    // Send password reset email
    await emailService.sendPasswordResetEmail(email, resetToken, user.fullName || email.split('@')[0]);

    logUtils.logAuth('password_reset_requested', user.id, email, req.ip);
    logUtils.logSecurity('password_reset_token_generated', { userId: user.id }, req);

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent'
    });

  } catch (error) {
    logUtils.logError(error, { action: 'forgot_password' }, req);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const db = getDatabase();
    const users = db.getTable('users');
    const user = users.find(u => u.resetToken === token);

    if (!user) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    if (new Date() > new Date(user.resetTokenExpiry)) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    // Hash new password
    const newPassHash = await passwordUtils.hashPassword(newPassword);

    // Update password and clear reset token
    db.update('users', user.id, {
      passHash: newPassHash,
      resetToken: null,
      resetTokenExpiry: null,
      passwordChangedAt: new Date().toISOString()
    });

    logUtils.logAuth('password_reset_completed', user.id, user.email, req.ip);
    logUtils.logSecurity('password_reset_completed', { userId: user.id }, req);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    logUtils.logError(error, { action: 'reset_password' }, req);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
