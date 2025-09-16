const express = require('express');
const router = express.Router();
const { getDatabase } = require('../lib/database');
const { passwordUtils, tokenUtils } = require('../lib/security');
const { logUtils } = require('../lib/logger');

// One-time admin setup page
router.get('/', (req, res) => {
  const db = getDatabase();
  
  // Check if admin already exists
  const adminExists = db.data.users && db.data.users.some(user => user.role === 'admin');
  
  if (adminExists) {
    return res.status(403).send(`
      <html>
        <head><title>Setup Complete</title></head>
        <body style="font-family: Arial, sans-serif; background: #0f172a; color: #f1f5f9; padding: 40px; text-align: center;">
          <h1 style="color: #ef4444;">⚠️ Setup Already Complete</h1>
          <p>Admin accounts have already been created.</p>
          <p><a href="/portal" style="color: #3b82f6;">Go to Platform</a></p>
        </body>
      </html>
    `);
  }

  res.send(`
    <html>
      <head>
        <title>Tangent Platform - Admin Setup</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #f1f5f9; min-height: 100vh; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px;">
          
          <header style="text-align: center; margin-bottom: 40px;">
            <h1 style="color: #3b82f6; margin-bottom: 10px;">🔧 Tangent Platform Setup</h1>
            <p style="color: #cbd5e1;">Create your initial admin accounts</p>
          </header>

          <div style="background: rgba(30, 41, 59, 0.8); padding: 40px; border-radius: 16px; border: 1px solid #334155;">
            <h2 style="color: #f1f5f9; margin-bottom: 30px;">Create Admin Account</h2>
            
            <form id="setupForm">
              <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; color: #cbd5e1;">Full Name</label>
                <input type="text" id="name" required style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
              </div>
              
              <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; color: #cbd5e1;">Email Address</label>
                <input type="email" id="email" value="ollech@gmail.com" required style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
              </div>
              
              <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; color: #cbd5e1;">Password</label>
                <input type="password" id="password" required style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
              </div>
              
              <div style="margin-bottom: 30px;">
                <label style="display: block; margin-bottom: 5px; color: #cbd5e1;">Confirm Password</label>
                <input type="password" id="confirmPassword" required style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
              </div>
              
              <button type="submit" style="width: 100%; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; border: none; padding: 16px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                🚀 Create Admin Account
              </button>
            </form>
            
            <div id="message" style="margin-top: 20px; padding: 15px; border-radius: 8px; display: none;"></div>
          </div>

          <div style="background: rgba(30, 41, 59, 0.8); padding: 30px; border-radius: 16px; border: 1px solid #334155; margin-top: 30px;">
            <h3 style="color: #f1f5f9; margin-bottom: 20px;">Add Team Member</h3>
            
            <form id="teamForm">
              <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; color: #cbd5e1;">Team Member Name</label>
                <input type="text" id="teamName" placeholder="e.g., Dudi" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
              </div>
              
              <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; color: #cbd5e1;">Team Member Email</label>
                <input type="email" id="teamEmail" value="dudiollech@gmail.com" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
              </div>
              
              <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; color: #cbd5e1;">Password</label>
                <input type="password" id="teamPassword" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
              </div>
              
              <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; color: #cbd5e1;">Role</label>
                <select id="teamRole" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
                  <option value="admin">Admin</option>
                  <option value="supplier">Supplier</option>
                  <option value="buyer">Buyer</option>
                </select>
              </div>
              
              <button type="submit" style="width: 100%; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 16px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                👥 Add Team Member
              </button>
            </form>
            
            <div id="teamMessage" style="margin-top: 20px; padding: 15px; border-radius: 8px; display: none;"></div>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #64748b; font-size: 14px;">
              After setup, this page will be automatically disabled for security.
            </p>
          </div>
        </div>

        <script>
          document.getElementById('setupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (password !== confirmPassword) {
              showMessage('Passwords do not match!', 'error');
              return;
            }
            
            if (password.length < 6) {
              showMessage('Password must be at least 6 characters!', 'error');
              return;
            }
            
            try {
              const response = await fetch('/admin-setup/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role: 'admin' })
              });
              
              const result = await response.json();
              
              if (result.success) {
                showMessage('✅ Admin account created successfully!', 'success');
                setTimeout(() => {
                  window.location.href = '/portal';
                }, 2000);
              } else {
                showMessage('❌ ' + result.error, 'error');
              }
            } catch (error) {
              showMessage('❌ Setup failed: ' + error.message, 'error');
            }
          });
          
          document.getElementById('teamForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('teamName').value;
            const email = document.getElementById('teamEmail').value;
            const password = document.getElementById('teamPassword').value;
            const role = document.getElementById('teamRole').value;
            
            if (!name || !email || !password) {
              showTeamMessage('Please fill in all fields!', 'error');
              return;
            }
            
            try {
              const response = await fetch('/admin-setup/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role })
              });
              
              const result = await response.json();
              
              if (result.success) {
                showTeamMessage('✅ Team member added successfully!', 'success');
                // Clear form
                document.getElementById('teamName').value = '';
                document.getElementById('teamEmail').value = '';
                document.getElementById('teamPassword').value = '';
              } else {
                showTeamMessage('❌ ' + result.error, 'error');
              }
            } catch (error) {
              showTeamMessage('❌ Failed to add team member: ' + error.message, 'error');
            }
          });
          
          function showMessage(text, type) {
            const messageDiv = document.getElementById('message');
            messageDiv.textContent = text;
            messageDiv.style.display = 'block';
            messageDiv.style.background = type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
            messageDiv.style.border = type === 'success' ? '1px solid #10b981' : '1px solid #ef4444';
            messageDiv.style.color = type === 'success' ? '#10b981' : '#ef4444';
          }
          
          function showTeamMessage(text, type) {
            const messageDiv = document.getElementById('teamMessage');
            messageDiv.textContent = text;
            messageDiv.style.display = 'block';
            messageDiv.style.background = type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
            messageDiv.style.border = type === 'success' ? '1px solid #10b981' : '1px solid #ef4444';
            messageDiv.style.color = type === 'success' ? '#10b981' : '#ef4444';
          }
        </script>
      </body>
    </html>
  `);
});

// Create admin account endpoint
router.post('/create', async (req, res) => {
  try {
    const db = getDatabase();
    const { name, email, password, role = 'admin' } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

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

    // Create user
    const user = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passHash,
      role,
      kyc: {
        status: 'none',
        files: [],
        cryptoExperience: null,
        hasWallet: false
      },
      isActive: true,
      emailVerified: true, // Auto-verify for admin setup
      registrationDate: new Date().toISOString(),
      createdVia: 'admin_setup'
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

    logUtils.logInfo('Admin account created via setup', {
      userId: user.id,
      email: user.email,
      role: user.role
    }, req);

    // Return success with token
    const { passHash: _, ...safeUser } = user;
    res.json({
      success: true,
      message: 'Account created successfully',
      token,
      user: safeUser
    });

  } catch (error) {
    logUtils.logError(error, { action: 'admin_setup_create' }, req);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

module.exports = router;
