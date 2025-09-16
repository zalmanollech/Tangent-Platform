const express = require('express');
const router = express.Router();
const { getDatabase } = require('../lib/database');
const { passwordUtils, tokenUtils } = require('../lib/security');
const { logUtils } = require('../lib/logger');

// Emergency admin creation endpoint with secret key
router.post('/create-admin', async (req, res) => {
  try {
    const { secretKey, name, email, password } = req.body;
    
    // Secret key for emergency access (change this!)
    const EMERGENCY_KEY = 'tangent-emergency-2024-setup';
    
    if (secretKey !== EMERGENCY_KEY) {
      return res.status(403).json({ error: 'Invalid secret key' });
    }

    const db = getDatabase();
    
    // Initialize users array if it doesn't exist
    if (!db.data.users) {
      db.data.users = [];
    }

    // Check if user already exists
    const existingUser = db.data.users.find(user => user.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passHash = await passwordUtils.hashPassword(password);

    // Create admin user
    const user = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passHash,
      role: 'admin',
      kyc: {
        status: 'verified',
        files: [],
        cryptoExperience: null,
        hasWallet: false
      },
      isActive: true,
      emailVerified: true,
      registrationDate: new Date().toISOString(),
      createdVia: 'emergency_setup'
    };

    db.data.users.push(user);
    db.save();

    // Generate JWT token
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role
    };
    const token = tokenUtils.generateToken(tokenPayload);

    logUtils.logInfo('Emergency admin account created', {
      userId: user.id,
      email: user.email,
      role: user.role
    }, req);

    const { passHash: _, ...safeUser } = user;
    res.json({
      success: true,
      message: 'Emergency admin account created successfully',
      token,
      user: safeUser
    });

  } catch (error) {
    logUtils.logError(error, { action: 'emergency_admin_creation' }, req);
    res.status(500).json({ error: 'Failed to create emergency admin account' });
  }
});

// Emergency user update endpoint
router.post('/update-user', async (req, res) => {
  try {
    const { secretKey, email, newEmail, newPassword } = req.body;
    
    const EMERGENCY_KEY = 'tangent-emergency-2024-setup';
    
    if (secretKey !== EMERGENCY_KEY) {
      return res.status(403).json({ error: 'Invalid secret key' });
    }

    const db = getDatabase();
    
    if (!db.data.users) {
      return res.status(404).json({ error: 'No users found' });
    }

    // Find user by current email
    const user = db.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update email if provided
    if (newEmail && newEmail !== email) {
      // Check if new email already exists
      const emailExists = db.data.users.find(u => u.email.toLowerCase() === newEmail.toLowerCase());
      if (emailExists) {
        return res.status(400).json({ error: 'New email already in use' });
      }
      user.email = newEmail.toLowerCase().trim();
    }

    // Update password if provided
    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      user.passHash = await passwordUtils.hashPassword(newPassword);
    }

    user.updatedAt = new Date().toISOString();
    db.save();

    logUtils.logInfo('Emergency user update completed', {
      userId: user.id,
      email: user.email,
      updatedEmail: !!newEmail,
      updatedPassword: !!newPassword
    }, req);

    const { passHash: _, ...safeUser } = user;
    res.json({
      success: true,
      message: 'User updated successfully',
      user: safeUser
    });

  } catch (error) {
    logUtils.logError(error, { action: 'emergency_user_update' }, req);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

module.exports = router;
