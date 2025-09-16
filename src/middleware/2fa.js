const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { v4: uuid } = require('uuid');

// 2FA configuration
const twoFactorConfig = {
  // TOTP configuration
  totp: {
    issuer: 'Tangent Platform',
    algorithm: 'sha1',
    digits: 6,
    period: 30,
    window: 1 // Allow 1 time step tolerance
  },

  // Backup codes configuration
  backupCodes: {
    count: 10,
    length: 8
  }
};

// Generate 2FA secret for a user
const generate2FASecret = (userEmail) => {
  const secret = speakeasy.generateSecret({
    name: `${twoFactorConfig.totp.issuer} (${userEmail})`,
    issuer: twoFactorConfig.totp.issuer,
    length: 32
  });

  return {
    secret: secret.base32,
    qrCodeUrl: secret.otpauth_url,
    manualEntryKey: secret.base32
  };
};

// Generate QR code for 2FA setup
const generateQRCode = async (otpauthUrl) => {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(otpauthUrl);
    return qrCodeDataURL;
  } catch (error) {
    throw new Error('Failed to generate QR code');
  }
};

// Verify 2FA token
const verify2FAToken = (secret, token) => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: twoFactorConfig.totp.window
  });
};

// Generate backup codes
const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < twoFactorConfig.backupCodes.count; i++) {
    const code = Math.random().toString(36).substring(2, 2 + twoFactorConfig.backupCodes.length).toUpperCase();
    codes.push(code);
  }
  return codes;
};

// Verify backup code
const verifyBackupCode = (userBackupCodes, providedCode) => {
  const index = userBackupCodes.findIndex(code => code === providedCode.toUpperCase());
  if (index !== -1) {
    // Remove used backup code
    userBackupCodes.splice(index, 1);
    return true;
  }
  return false;
};

// 2FA middleware for protecting routes
const require2FA = (req, res, next) => {
  const user = req.session?.user;
  
  if (!user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in first'
    });
  }

  // Check if user has 2FA enabled
  if (!user.twoFactorEnabled) {
    return res.status(403).json({
      error: '2FA required',
      message: 'Two-factor authentication is required for this action',
      requires2FA: true
    });
  }

  // Check if 2FA is verified in this session
  if (!req.session.twoFactorVerified) {
    return res.status(403).json({
      error: '2FA verification required',
      message: 'Please verify your 2FA token',
      requires2FAVerification: true
    });
  }

  next();
};

// 2FA setup endpoint handler
const setup2FA = async (req, res) => {
  try {
    const user = req.session?.user;
    
    if (!user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({
        error: '2FA already enabled',
        message: 'Two-factor authentication is already enabled for this account'
      });
    }

    const { secret, qrCodeUrl, manualEntryKey } = generate2FASecret(user.email);
    
    // Store secret temporarily in session (should be stored securely in production)
    req.session.twoFactorSecret = secret;
    
    // Generate QR code
    const qrCodeDataURL = await generateQRCode(qrCodeUrl);
    
    res.json({
      success: true,
      secret: manualEntryKey,
      qrCode: qrCodeDataURL,
      backupCodes: generateBackupCodes()
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({
      error: 'Failed to setup 2FA',
      message: 'An error occurred while setting up two-factor authentication'
    });
  }
};

// 2FA verification endpoint handler
const verify2FA = (req, res) => {
  try {
    const { token, backupCode } = req.body;
    const user = req.session?.user;
    
    if (!user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    let isValid = false;

    if (backupCode) {
      // Verify backup code
      if (user.backupCodes && verifyBackupCode(user.backupCodes, backupCode)) {
        isValid = true;
        // Update user's backup codes (remove used one)
        // In production, this should be saved to database
      }
    } else if (token && user.twoFactorSecret) {
      // Verify TOTP token
      isValid = verify2FAToken(user.twoFactorSecret, token);
    }

    if (isValid) {
      // Mark 2FA as verified in session
      req.session.twoFactorVerified = true;
      
      res.json({
        success: true,
        message: '2FA verification successful'
      });
    } else {
      res.status(400).json({
        error: 'Invalid 2FA token',
        message: 'The provided token or backup code is invalid'
      });
    }
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({
      error: '2FA verification failed',
      message: 'An error occurred during verification'
    });
  }
};

// Enable 2FA endpoint handler
const enable2FA = (req, res) => {
  try {
    const { token } = req.body;
    const user = req.session?.user;
    
    if (!user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (!req.session.twoFactorSecret) {
      return res.status(400).json({
        error: '2FA setup required',
        message: 'Please complete 2FA setup first'
      });
    }

    // Verify the token before enabling
    if (!verify2FAToken(req.session.twoFactorSecret, token)) {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'The provided token is invalid'
      });
    }

    // Enable 2FA for user
    user.twoFactorEnabled = true;
    user.twoFactorSecret = req.session.twoFactorSecret;
    user.backupCodes = req.body.backupCodes || [];
    
    // Clear temporary secret from session
    delete req.session.twoFactorSecret;
    
    res.json({
      success: true,
      message: '2FA enabled successfully'
    });
  } catch (error) {
    console.error('Enable 2FA error:', error);
    res.status(500).json({
      error: 'Failed to enable 2FA',
      message: 'An error occurred while enabling two-factor authentication'
    });
  }
};

// Disable 2FA endpoint handler
const disable2FA = (req, res) => {
  try {
    const { token } = req.body;
    const user = req.session?.user;
    
    if (!user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        error: '2FA not enabled',
        message: 'Two-factor authentication is not enabled for this account'
      });
    }

    // Verify the token before disabling
    if (!verify2FAToken(user.twoFactorSecret, token)) {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'The provided token is invalid'
      });
    }

    // Disable 2FA for user
    user.twoFactorEnabled = false;
    delete user.twoFactorSecret;
    delete user.backupCodes;
    
    // Clear 2FA verification from session
    delete req.session.twoFactorVerified;
    
    res.json({
      success: true,
      message: '2FA disabled successfully'
    });
  } catch (error) {
    console.error('Disable 2FA error:', error);
    res.status(500).json({
      error: 'Failed to disable 2FA',
      message: 'An error occurred while disabling two-factor authentication'
    });
  }
};

module.exports = {
  twoFactorConfig,
  generate2FASecret,
  generateQRCode,
  verify2FAToken,
  generateBackupCodes,
  verifyBackupCode,
  require2FA,
  setup2FA,
  verify2FA,
  enable2FA,
  disable2FA
};
