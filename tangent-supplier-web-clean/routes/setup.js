const express = require('express');
const router = express.Router();
const { getDatabase } = require('../lib/database');
const { passwordUtils, tokenUtils } = require('../lib/security');

// Simple setup page to create admin account
router.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Platform Setup</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        input { width: 100%; padding: 10px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        .success { color: green; }
        .error { color: red; }
    </style>
</head>
<body>
    <h2>🚀 Platform Initial Setup</h2>
    <p>Create your admin account to access the platform.</p>
    
    <form id="setupForm">
        <div class="form-group">
            <input type="email" id="email" placeholder="Your Email" required value="ollech@gmail.com">
        </div>
        <div class="form-group">
            <input type="password" id="password" placeholder="Your Password" required value="admin123">
        </div>
        <div class="form-group">
            <button type="submit">Create Admin Account</button>
        </div>
    </form>
    
    <div id="result"></div>
    
    <script>
        document.getElementById('setupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const resultDiv = document.getElementById('result');
            
            try {
                const response = await fetch('/setup/create-admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    resultDiv.innerHTML = '<div class="success">✅ Admin account created successfully!<br><br><strong>Next steps:</strong><br>1. Go to <a href="/">landing page</a><br>2. Click "Team Portal"<br>3. Login with: ' + email + ' / ' + password + '<br>4. Access <a href="/admin">Admin Panel</a></div>';
                } else {
                    resultDiv.innerHTML = '<div class="error">❌ Error: ' + data.error + '</div>';
                }
            } catch (error) {
                resultDiv.innerHTML = '<div class="error">❌ Network error: ' + error.message + '</div>';
            }
        });
    </script>
</body>
</html>
  `);
});

// Create admin account
router.post('/create-admin', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const db = getDatabase();
    
    // Check if user already exists
    const existingUser = db.findUserByEmail(email);
    if (existingUser) {
      // Update existing user
      const passHash = await passwordUtils.hashPassword(password);
      db.update('users', existingUser.id, {
        passHash,
        role: 'admin',
        isActive: true,
        emailVerified: true
      });
      
      return res.json({ 
        success: true, 
        message: 'Admin account updated successfully',
        action: 'updated'
      });
    }
    
    // Create new admin user
    const passHash = await passwordUtils.hashPassword(password);
    
    const userData = {
      email: email.toLowerCase(),
      passHash,
      role: 'admin',
      kyc: {
        status: 'verified',
        files: [],
        cryptoExperience: 'expert',
        hasWallet: true
      },
      isActive: true,
      emailVerified: true,
      registrationDate: new Date().toISOString()
    };
    
    const user = db.createUser(userData);
    
    res.json({ 
      success: true, 
      message: 'Admin account created successfully',
      action: 'created',
      user: { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      }
    });
    
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Failed to create admin account: ' + error.message });
  }
});

module.exports = router;
