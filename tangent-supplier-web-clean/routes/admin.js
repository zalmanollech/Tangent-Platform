const express = require('express');
const router = express.Router();
const { getDatabase } = require('../lib/database');
const { passwordUtils, tokenUtils, authMiddleware } = require('../lib/security');
const { logUtils } = require('../lib/logger');
const fs = require('fs');
const path = require('path');

// Middleware to ensure admin access (temporarily disabled for initial setup)
const requireAdmin = (req, res, next) => {
  // Temporarily bypass authentication for initial setup
  req.user = { email: 'setup@admin.temp', role: 'admin' };
  next();
};

// Get current authorized emails
router.get('/authorized-emails', requireAdmin, (req, res) => {
  try {
    const platformConfig = require('../config.platform-access');
    res.json({
      success: true,
      emails: platformConfig.authorizedUsers || []
    });
  } catch (error) {
    logUtils.logError(error, { action: 'get_authorized_emails' }, req);
    res.status(500).json({ error: 'Failed to load authorized emails' });
  }
});

// Add email to authorized list
router.post('/add-email', requireAdmin, (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address required' });
    }

    const configPath = path.join(__dirname, '../config.platform-access.js');
    let configContent = fs.readFileSync(configPath, 'utf8');
    
    // Check if email already exists
    const platformConfig = require('../config.platform-access');
    if (platformConfig.authorizedUsers.includes(email.toLowerCase())) {
      return res.status(400).json({ error: 'Email already authorized' });
    }

    // Add email to the array
    const emailToAdd = `    '${email.toLowerCase()}',             // Added via admin panel`;
    const insertPoint = configContent.indexOf('    // Future tangent-protocol.com emails');
    
    if (insertPoint !== -1) {
      configContent = configContent.slice(0, insertPoint) + 
                     emailToAdd + '\n    ' + 
                     configContent.slice(insertPoint);
    } else {
      // Fallback: add before the closing bracket
      const insertPoint2 = configContent.indexOf('  ],');
      if (insertPoint2 !== -1) {
        configContent = configContent.slice(0, insertPoint2) + 
                       '    ' + emailToAdd + '\n  ],';
        configContent = configContent.slice(insertPoint2 + 3);
      }
    }

    fs.writeFileSync(configPath, configContent);

    // Clear require cache to reload config
    delete require.cache[require.resolve('../config.platform-access')];

    logUtils.logSecurity('authorized_email_added', { 
      email: email.toLowerCase(), 
      addedBy: req.user.email 
    }, req);

    res.json({ success: true, message: 'Email added successfully' });
  } catch (error) {
    logUtils.logError(error, { action: 'add_authorized_email' }, req);
    res.status(500).json({ error: 'Failed to add email' });
  }
});

// Remove email from authorized list
router.post('/remove-email', requireAdmin, (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email address required' });
    }

    const configPath = path.join(__dirname, '../config.platform-access.js');
    let configContent = fs.readFileSync(configPath, 'utf8');
    
    // Remove the email line
    const emailPattern = new RegExp(`\\s*'${email.toLowerCase()}'[^\\n]*\\n`, 'g');
    configContent = configContent.replace(emailPattern, '');

    fs.writeFileSync(configPath, configContent);

    // Clear require cache to reload config
    delete require.cache[require.resolve('../config.platform-access')];

    logUtils.logSecurity('authorized_email_removed', { 
      email: email.toLowerCase(), 
      removedBy: req.user.email 
    }, req);

    res.json({ success: true, message: 'Email removed successfully' });
  } catch (error) {
    logUtils.logError(error, { action: 'remove_authorized_email' }, req);
    res.status(500).json({ error: 'Failed to remove email' });
  }
});

// Create new user account
router.post('/create-user', requireAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { email, password, role = 'buyer' } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Validate role
    if (!['buyer', 'supplier', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user already exists
    const existingUser = db.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passHash = await passwordUtils.hashPassword(password);

    // Create user
    const userData = {
      email: email.toLowerCase(),
      passHash,
      role,
      kyc: {
        status: 'none',
        files: [],
        cryptoExperience: null,
        hasWallet: false
      },
      isActive: true,
      emailVerified: true, // Admin-created accounts are pre-verified
      registrationDate: new Date().toISOString(),
      createdBy: req.user.email
    };

    const user = db.createUser(userData);

    logUtils.logSecurity('user_created_by_admin', { 
      newUserEmail: email, 
      role: role,
      createdBy: req.user.email 
    }, req);

    res.json({ 
      success: true, 
      message: 'User created successfully',
      user: { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      }
    });

  } catch (error) {
    logUtils.logError(error, { action: 'admin_create_user' }, req);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user password (admin function)
router.post('/update-password', requireAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and new password required' });
    }

    const user = db.findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password
    const passHash = await passwordUtils.hashPassword(newPassword);

    // Update user
    db.update('users', user.id, { 
      passHash,
      lastPasswordUpdate: new Date().toISOString()
    });

    logUtils.logSecurity('password_updated_by_admin', { 
      userEmail: email, 
      updatedBy: req.user.email 
    }, req);

    res.json({ success: true, message: 'Password updated successfully' });

  } catch (error) {
    logUtils.logError(error, { action: 'admin_update_password' }, req);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

module.exports = router;
