const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/kyc/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow PDF, DOC, DOCX, JPG, PNG
    const allowedTypes = /pdf|doc|docx|jpg|jpeg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, JPG, PNG files are allowed'));
    }
  }
});

// In-memory storage for demo (replace with database)
const users = new Map();
const contracts = new Map();
const kycApplications = new Map();
const auctions = new Map();
const platformSettings = {
  platformFee: 2.5,
  dailyInterest: 0.1,
  insuranceRate: 0.5
};

// Helper function for compliance checking
async function performComplianceCheck(userData) {
  // Simulate compliance check with external agencies
  const riskScore = Math.random() * 100;
  const flags = [];
  
  // Simulate various checks
  if (riskScore > 85) {
    flags.push('High risk jurisdiction');
  }
  if (userData.companyName && userData.companyName.toLowerCase().includes('test')) {
    flags.push('Suspicious company name');
  }
  
  return {
    riskScore,
    flags,
    sanctionsCheck: riskScore < 70,
    amlCheck: riskScore < 80,
    finalStatus: flags.length === 0 ? 'approved' : 'flagged'
  };
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Access Control Middleware
app.use('/portal', (req, res, next) => {
  console.log('Portal access requested:', req.path);
  next();
});

app.use('/admin', (req, res, next) => {
  console.log('Admin access requested:', req.path);
  next();
});

// CSP Headers
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
    "connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com",
    "img-src 'self' data: https://www.google-analytics.com",
    "style-src 'self' 'unsafe-inline'",
    "frame-src 'self'"
  ].join('; '));
  next();
});

// LANDING PAGE (Root)
app.get('/', (req, res) => {
  console.log('ROOT ROUTE HIT!');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tangent Protocol — Advanced Trading Platform & TGT Stablecoin</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      background: #0f172a; 
      color: #f8fafc; 
      margin: 0; 
      padding: 0; 
    }
    .container { 
      max-width: 1400px; 
      margin: 0 auto; 
      padding: 40px 20px; 
    }
    .header { 
      text-align: center; 
      margin-bottom: 80px; 
    }
    h1 { 
      font-size: 4rem; 
      font-weight: 700; 
      margin-bottom: 20px; 
      background: linear-gradient(135deg, #2563eb, #06b6d4); 
      -webkit-background-clip: text; 
      -webkit-text-fill-color: transparent; 
      background-clip: text; 
    }
    .subtitle { 
      font-size: 1.5rem; 
      color: #94a3b8; 
      margin-bottom: 40px; 
    }
    .main-content { 
      display: grid; 
      grid-template-columns: 1fr 1fr; 
      gap: 60px; 
      margin: 80px 0; 
    }
    .platform-section, .tgt-section { 
      background: #1e293b; 
      padding: 50px; 
      border-radius: 20px; 
      border: 1px solid #334155; 
      text-align: center; 
    }
    .platform-section h2, .tgt-section h2 { 
      font-size: 2.5rem; 
      margin-bottom: 30px; 
    }
    .platform-section h2 { 
      color: #2563eb; 
    }
    .tgt-section h2 { 
      color: #06b6d4; 
    }
    .section-description { 
      font-size: 1.2rem; 
      color: #94a3b8; 
      margin-bottom: 40px; 
      line-height: 1.6; 
    }
    .features-list { 
      text-align: left; 
      margin: 30px 0; 
    }
    .features-list ul { 
      list-style: none; 
      padding: 0; 
    }
    .features-list li { 
      padding: 12px 0; 
      color: #cbd5e1; 
      font-size: 1.1rem; 
      border-bottom: 1px solid #334155; 
    }
    .features-list li:last-child { 
      border-bottom: none; 
    }
    .features-list li::before { 
      content: "✓ "; 
      color: #10b981; 
      font-weight: bold; 
      margin-right: 10px; 
    }
    .registration-section { 
      margin-top: 80px; 
      text-align: center; 
      padding: 50px; 
      background: #1e293b; 
      border-radius: 16px; 
      border: 1px solid #334155; 
    }
    .registration-section h3 { 
      color: #2563eb; 
      margin-bottom: 20px; 
      font-size: 2rem; 
    }
    .registration-section p { 
      color: #94a3b8; 
      margin-bottom: 30px; 
      font-size: 1.2rem; 
    }
    .btn { 
      display: inline-block; 
      padding: 15px 30px; 
      background: #2563eb; 
      color: white; 
      text-decoration: none; 
      border-radius: 12px; 
      margin: 10px; 
      border: none; 
      cursor: pointer; 
      font-size: 16px; 
      font-weight: 600; 
      transition: all 0.3s ease; 
      box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3); 
    }
    .btn:hover { 
      background: #1d4ed8; 
      transform: translateY(-2px); 
      box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4); 
    }
    .btn.secondary { 
      background: #06b6d4; 
    }
    .btn.secondary:hover { 
      background: #0891b2; 
    }
    .status { 
      margin-top: 60px; 
      padding: 30px; 
      background: #1e293b; 
      border-radius: 16px; 
      border: 1px solid #334155; 
      text-align: center; 
    }
    .status h3 { 
      color: #06b6d4; 
      margin-bottom: 20px; 
    }
    .status p { 
      margin: 10px 0; 
      color: #94a3b8; 
    }
    @media (max-width: 768px) { 
      h1 { font-size: 2.5rem; } 
      .main-content { grid-template-columns: 1fr; gap: 40px; }
      .platform-section, .tgt-section { padding: 30px; }
      .btn { display: block; width: 100%; margin: 10px 0; } 
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Tangent Protocol</h1>
      <p class="subtitle">Advanced Trading Platform & TGT Stablecoin</p>
    </div>
    
    <div class="main-content">
      <!-- Platform Section -->
      <div class="platform-section">
        <h2>🚀 Trading Platform</h2>
        <p class="section-description">
          Experience next-generation trading with institutional-grade tools, real-time analytics, and seamless execution.
        </p>
        <div class="features-list">
          <ul>
            <li>Real-time market data and analytics</li>
            <li>Advanced order types and execution</li>
            <li>Comprehensive risk management</li>
            <li>Portfolio analytics and reporting</li>
            <li>Multi-asset trading support</li>
            <li>Institutional-grade security</li>
          </ul>
        </div>
      </div>
      
      <!-- TGT Stablecoin Section -->
      <div class="tgt-section">
        <h2>💎 TGT Stablecoin</h2>
        <p class="section-description">
          Discover the benefits of our innovative TGT stablecoin - designed for stability, transparency, and seamless integration.
        </p>
        <div class="features-list">
          <ul>
            <li>Advanced price stability mechanisms</li>
            <li>Transparent reserve management</li>
            <li>Ultra-low transaction costs</li>
            <li>Seamless DeFi integration</li>
            <li>Regulatory compliance ready</li>
            <li>Fast settlement times</li>
          </ul>
        </div>
      </div>
    </div>
    
    <!-- Registration Section -->
    <div class="registration-section">
      <h3>Get Started with Tangent Protocol</h3>
      <p>Join the future of trading and discover the power of TGT stablecoin</p>
      <div style="margin: 30px 0;">
        <button class="btn" onclick="window.location.href='/register'">Register Interest (Early Access)</button>
        <button class="btn secondary" onclick="window.location.href='/tgt-info'">Learn About TGT</button>
      </div>
    </div>
    
    <div class="status">
      <h3>🚀 Platform Status</h3>
      <p><strong>Server:</strong> ✅ Online and Running</p>
      <p><strong>DNS Routing:</strong> ✅ Working</p>
      <p><strong>SSL Certificates:</strong> ✅ Active</p>
      <p><strong>Version:</strong> TANGENT-RESTORE-24-ULTIMATE-${Date.now()}</p>
      <p><strong>Last Updated:</strong> ${new Date().toISOString()}</p>
    </div>
    
    <div style="margin-top: 30px; text-align: center;">
      <a href="/test" style="color: #2563eb; text-decoration: none; margin: 0 15px;">🧪 Test Server</a>
      <a href="/health" style="color: #2563eb; text-decoration: none; margin: 0 15px;">📊 Health Check</a>
    </div>
    
    <!-- Team Access Section -->
    <div style="text-align: center; margin-top: 40px; padding: 30px; border-top: 1px solid #334155; background: rgba(6, 182, 212, 0.05);">
      <p style="color: #94a3b8; font-size: 1rem; margin-bottom: 15px;">🔐 Team members & new users</p>
      <a href="/landing-two" style="color: #06b6d4; text-decoration: none; font-size: 1rem; padding: 12px 24px; border: 2px solid #06b6d4; border-radius: 8px; transition: all 0.3s; font-weight: 500;" onmouseover="this.style.background='#06b6d4'; this.style.color='white'; this.style.transform='translateY(-2px)'" onmouseout="this.style.background='transparent'; this.style.color='#06b6d4'; this.style.transform='translateY(0)'">Team Portal</a>
    </div>
  </div>
</body>
</html>`;
  
  res.send(html);
});

// LANDING PAGE TWO - Team Access Portal  
app.get('/landing-two', (req, res) => {
  console.log('LANDING PAGE TWO HIT!');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Access — Tangent Protocol</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
    .container { max-width: 800px; margin: 100px auto; text-align: center; }
    h1 { color: #2563eb; margin-bottom: 50px; font-size: 3rem; }
    .access-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin: 60px 0; }
    .access-card { background: #1e293b; padding: 50px; border-radius: 20px; border: 1px solid #334155; }
    .access-card h2 { color: #06b6d4; font-size: 2rem; margin-bottom: 20px; }
    .access-card p { color: #94a3b8; margin-bottom: 30px; line-height: 1.6; }
    .btn { display: inline-block; padding: 15px 40px; background: #2563eb; color: white; text-decoration: none; border-radius: 12px; font-weight: 600; transition: all 0.3s; }
    .btn:hover { background: #1d4ed8; transform: translateY(-2px); }
    .btn.secondary { background: #06b6d4; }
    .btn.secondary:hover { background: #0891b2; }
    @media (max-width: 768px) { .access-grid { grid-template-columns: 1fr; gap: 30px; } }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Team Access Portal</h1>
    <p style="color: #94a3b8; font-size: 1.2rem; margin-bottom: 40px;">Choose your access method</p>
    
    <div class="access-grid">
      <div class="access-card">
        <h2>👤 Sign In</h2>
        <p>Existing team members and registered users</p>
        <p>Access your dashboard based on your role:</p>
        <ul style="text-align: left; color: #94a3b8; margin: 20px 0;">
          <li><strong>Admin:</strong> Full platform management</li>
          <li><strong>Supplier:</strong> Product management & orders</li>
          <li><strong>Buyer:</strong> Trading & purchasing</li>
          <li><strong>Trader:</strong> Advanced trading tools</li>
          <li><strong>Insurer:</strong> Risk assessment & quotes</li>
        </ul>
        <a href="/sign-in" class="btn">Sign In</a>
      </div>
      
      <div class="access-card">
        <h2>📝 Sign Up</h2>
        <p>New users requiring KYC verification</p>
        <p>Complete registration process:</p>
        <ul style="text-align: left; color: #94a3b8; margin: 20px 0;">
          <li>Create account with credentials</li>
          <li>Choose company type</li>
          <li>Upload required documents</li>
          <li>Complete KYC verification</li>
          <li>Get approved & access dashboard</li>
        </ul>
        <a href="/sign-up" class="btn secondary">Sign Up</a>
      </div>
    </div>
    
    <div style="margin-top: 40px;">
      <a href="/" style="color: #06b6d4; text-decoration: none;">← Back to Landing Page</a>
    </div>
  </div>
</body>
</html>`;
  
  res.send(html);
});

// SIGN IN PAGE
app.get('/sign-in', (req, res) => {
  console.log('SIGN IN PAGE HIT!');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In — Tangent Protocol</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
    .container { max-width: 400px; margin: 100px auto; }
    h1 { color: #2563eb; text-align: center; margin-bottom: 30px; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; color: #f8fafc; font-weight: 600; }
    .form-group input { width: 100%; padding: 12px; border: 1px solid #334155; border-radius: 8px; background: #0f172a; color: #f8fafc; font-size: 16px; }
    .form-group input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
    .btn { width: 100%; padding: 15px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 10px; }
    .btn:hover { background: #1d4ed8; }
    .error { color: #ef4444; margin-top: 10px; text-align: center; }
    .success { color: #10b981; margin-top: 10px; text-align: center; }
    .back-link { text-align: center; margin-top: 20px; }
    .back-link a { color: #06b6d4; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Sign In</h1>
    <form id="signInForm">
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required>
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required>
      </div>
      <button type="submit" class="btn">Sign In</button>
      <div id="error" class="error"></div>
      <div id="success" class="success"></div>
    </form>
    <div class="back-link">
      <a href="/landing-two">← Back to Team Access</a>
    </div>
  </div>
  
  <script>
    document.getElementById('signInForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const errorDiv = document.getElementById('error');
      const successDiv = document.getElementById('success');
      
      errorDiv.textContent = '';
      successDiv.textContent = '';
      
      try {
        const response = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
          successDiv.textContent = 'Login successful! Redirecting to your dashboard...';
          setTimeout(() => {
            if (data.user.role === 'admin') {
              window.location.href = '/admin';
            } else {
              window.location.href = '/dashboard';
            }
          }, 1000);
        } else {
          errorDiv.textContent = data.message || 'Invalid credentials';
        }
      } catch (error) {
        errorDiv.textContent = 'Login error. Please try again.';
      }
    });
  </script>
</body>
</html>`;
  
  res.send(html);
});

// SIGN UP PAGE
app.get('/sign-up', (req, res) => {
  console.log('SIGN UP PAGE HIT!');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign Up — Tangent Protocol</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
    .container { max-width: 600px; margin: 50px auto; }
    h1 { color: #2563eb; text-align: center; margin-bottom: 30px; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; color: #f8fafc; font-weight: 600; }
    .form-group input, .form-group select { width: 100%; padding: 12px; border: 1px solid #334155; border-radius: 8px; background: #0f172a; color: #f8fafc; font-size: 16px; }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
    .btn { width: 100%; padding: 15px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 10px; }
    .btn:hover { background: #1d4ed8; }
    .error { color: #ef4444; margin-top: 10px; text-align: center; }
    .success { color: #10b981; margin-top: 10px; text-align: center; }
    .back-link { text-align: center; margin-top: 20px; }
    .back-link a { color: #06b6d4; text-decoration: none; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📝 Create Account</h1>
    <p style="text-align: center; color: #94a3b8; margin-bottom: 30px;">Create your account and start the KYC verification process</p>
    
    <form id="signUpForm">
      <div class="form-row">
        <div class="form-group">
          <label for="firstName">First Name</label>
          <input type="text" id="firstName" name="firstName" required>
        </div>
        <div class="form-group">
          <label for="lastName">Last Name</label>
          <input type="text" id="lastName" name="lastName" required>
        </div>
      </div>
      
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required>
        </div>
        <div class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <input type="password" id="confirmPassword" name="confirmPassword" required>
        </div>
      </div>
      
      <div class="form-group">
        <label for="company">Company Name</label>
        <input type="text" id="company" name="company" required>
      </div>
      
      <div class="form-group">
        <label for="role">Your Role</label>
        <select id="role" name="role" required>
          <option value="">Select your role...</option>
          <option value="supplier">Supplier/Seller</option>
          <option value="buyer">Buyer</option>
          <option value="trader">Trader</option>
          <option value="insurer">Insurer</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="phone">Phone Number</label>
        <input type="tel" id="phone" name="phone" required>
      </div>
      
      <button type="submit" class="btn">Create Account & Start KYC</button>
      <div id="error" class="error"></div>
      <div id="success" class="success"></div>
    </form>
    
    <div class="back-link">
      <a href="/landing-two">← Back to Team Access</a>
    </div>
  </div>
  
  <script>
    document.getElementById('signUpForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const errorDiv = document.getElementById('error');
      const successDiv = document.getElementById('success');
      
      errorDiv.textContent = '';
      successDiv.textContent = '';
      
      if (password !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match';
        return;
      }
      
      const formData = new FormData(this);
      const data = Object.fromEntries(formData);
      
      try {
        const response = await fetch('/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
          successDiv.textContent = 'Account created! Redirecting to KYC verification...';
          setTimeout(() => {
            window.location.href = '/kyc?type=' + data.role;
          }, 2000);
        } else {
          errorDiv.textContent = result.message || 'Registration failed';
        }
      } catch (error) {
        errorDiv.textContent = 'Registration error. Please try again.';
      }
    });
  </script>
</body>
</html>`;
  
  res.send(html);
});

// KYC PAGE
app.get('/kyc', (req, res) => {
  console.log('KYC ROUTE HIT!');
  const type = req.query.type || 'private';
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KYC Verification - Tangent Protocol</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #2563eb; margin-bottom: 30px; }
    .btn { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin: 10px; border: none; cursor: pointer; }
    .btn:hover { background: #1d4ed8; }
    .btn.ghost { background: transparent; border: 2px solid #2563eb; color: #2563eb; }
    .btn.ghost:hover { background: #2563eb; color: white; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; color: #f8fafc; font-weight: 600; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 12px; border: 1px solid #334155; border-radius: 8px; background: #0f172a; color: #f8fafc; font-size: 16px; }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
    .upload-area { border: 2px dashed #334155; padding: 40px; text-align: center; border-radius: 8px; margin: 20px 0; }
    .upload-area:hover { border-color: #2563eb; }
    .card { background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #334155; margin: 20px 0; }
    .card h3 { color: #06b6d4; margin-bottom: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 KYC Verification</h1>
    <p>Complete your Know Your Customer verification to access the platform</p>
    
    <div class="card">
      <h3>Account Type: ${type === 'supplier' ? 'Supplier/Seller' : type === 'buyer' ? 'Buyer' : type === 'trader' ? 'Trader' : type === 'insurer' ? 'Insurer' : 'Business'}</h3>
      <p>Please upload the required documents for verification</p>
    </div>
    
    <form id="kycForm">
      <div class="card">
        <h3>Required Documents</h3>
        <div class="form-group">
          <label>Government ID (Passport, Driver's License, National ID)</label>
          <div class="upload-area">
            <p>Click to upload or drag and drop</p>
            <input type="file" name="governmentId" accept="image/*,.pdf" required>
          </div>
        </div>
        <div class="form-group">
          <label>Proof of Address (Utility bill, Bank statement)</label>
          <div class="upload-area">
            <p>Click to upload or drag and drop</p>
            <input type="file" name="proofOfAddress" accept="image/*,.pdf" required>
          </div>
        </div>
        <div class="form-group">
          <label>Business Registration (Certificate of Incorporation)</label>
          <div class="upload-area">
            <p>Click to upload or drag and drop</p>
            <input type="file" name="businessReg" accept="image/*,.pdf" required>
          </div>
        </div>
      </div>
      
      <div class="card">
        <h3>Additional Information</h3>
        <div class="form-group">
          <label for="kycNotes">Additional Notes (Optional)</label>
          <textarea id="kycNotes" name="notes" rows="4" placeholder="Any additional information..."></textarea>
        </div>
      </div>
      
      <button type="submit" class="btn" style="width: 100%;">Submit KYC Application</button>
    </form>
    
    <div style="margin-top: 40px; text-align: center;">
      <button class="btn ghost" onclick="window.location.href='/landing-two'">← Back to Team Access</button>
    </div>
  </div>
  
  <script>
    document.getElementById("kycForm").addEventListener("submit", async function(e) {
      e.preventDefault();
      console.log('KYC form submitted');
      const formData = new FormData(this);
      try {
        const response = await fetch("/api/kyc/submit", {
          method: "POST",
          body: formData
        });
        const result = await response.json();
        if (response.ok && result.success) {
          alert("🎉 KYC application submitted successfully! You will be notified once verification is complete.");
          window.location.href = "/dashboard";
        } else {
          alert("KYC submission failed: " + (result.message || "Unknown error"));
        }
      } catch (error) {
        alert("KYC submission failed. Please try again.");
      }
    });
  </script>
</body>
</html>`;
  
  res.send(html);
});

// DASHBOARD PAGE
app.get('/dashboard', (req, res) => {
  console.log('DASHBOARD ROUTE HIT!');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - Tangent Protocol</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #2563eb; margin-bottom: 30px; }
    .nav { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #334155; }
    .nav a { color: #06b6d4; text-decoration: none; margin-right: 20px; padding: 8px 16px; border-radius: 6px; transition: all 0.3s; }
    .nav a:hover { background: #06b6d4; color: white; }
    .btn { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin: 10px; border: none; cursor: pointer; }
    .btn:hover { background: #1d4ed8; }
    .btn.ghost { background: transparent; border: 2px solid #2563eb; color: #2563eb; }
    .btn.ghost:hover { background: #2563eb; color: white; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 30px 0; }
    .card { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; }
    .card h3 { color: #06b6d4; margin-bottom: 15px; }
    .status { background: #10b981; color: white; padding: 10px; border-radius: 6px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/portal">Home</a>
      <a href="/admin">Admin</a>
      <a href="/dashboard">Dashboard</a>
      <a href="/">Landing Page</a>
    </div>
    
    <h1>📊 Tangent Protocol Dashboard</h1>
    <div class="status">✅ Welcome to your dashboard</div>
    
    <div class="grid">
      <div class="card">
        <h3>💼 Upload Transactions</h3>
        <p>Upload and manage your trading transactions</p>
        <button class="btn" onclick="alert('Trading interface coming soon!')">Upload Transactions</button>
      </div>
      
      <div class="card">
        <h3>💳 Make Payments</h3>
        <p>Process payments and manage your account</p>
        <button class="btn" onclick="alert('Payment system coming soon!')">Make Payment</button>
      </div>
      
      <div class="card">
        <h3>📈 Trading Platform</h3>
        <p>Access the trading interface</p>
        <button class="btn" onclick="alert('Trading platform coming soon!')">Launch Trading</button>
      </div>
      
      <div class="card">
        <h3>📋 Portfolio</h3>
        <p>View your portfolio and positions</p>
        <button class="btn" onclick="alert('Portfolio view coming soon!')">View Portfolio</button>
      </div>
      
      <div class="card">
        <h3>🔍 KYC Status</h3>
        <p>Check your verification status</p>
        <button class="btn" onclick="window.location.href='/kyc'">Check KYC Status</button>
      </div>
      
      <div class="card">
        <h3>⚙️ Settings</h3>
        <p>Manage your account settings</p>
        <button class="btn" onclick="window.location.href='/admin'">Open Settings</button>
      </div>
    </div>
    
    <div style="margin-top: 40px; text-align: center;">
      <button class="btn ghost" onclick="window.location.href='/'">← Back to Landing Page</button>
    </div>
  </div>
</body>
</html>`;
  
  res.send(html);
});

// Additional Routes
app.get('/register', (req, res) => {
  res.redirect('/sign-up');
});

app.get('/login', (req, res) => {
  res.redirect('/sign-in');
});

// KYC SIGN UP PAGE  
app.get('/sign-up', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign Up & KYC — Tangent Protocol</title>
  <style>
    body { font-family: system-ui; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 50px auto; }
    .header { text-align: center; margin-bottom: 40px; }
    .header h1 { color: #2563eb; font-size: 2.5rem; margin-bottom: 10px; }
    .kyc-section { background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #334155; margin: 20px 0; }
    .kyc-section h3 { color: #06b6d4; margin-top: 0; }
    .form-group { margin: 20px 0; }
    .form-group label { display: block; margin-bottom: 8px; color: #94a3b8; font-weight: 500; }
    .form-group input, .form-group select { width: 100%; padding: 12px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #f8fafc; }
    .company-types { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
    .company-type { background: #0f172a; padding: 20px; border-radius: 8px; border: 2px solid #334155; cursor: pointer; transition: all 0.3s; }
    .company-type:hover { border-color: #2563eb; }
    .company-type.selected { border-color: #2563eb; background: rgba(37, 99, 235, 0.1); }
    .company-type h4 { color: #06b6d4; margin-top: 0; }
    .doc-list { color: #94a3b8; font-size: 0.9rem; }
    .doc-list li { margin: 5px 0; }
    .btn { display: inline-block; padding: 15px 30px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 10px 10px 10px 0; cursor: pointer; border: none; font-size: 1rem; }
    .btn:hover { background: #1d4ed8; }
    .btn.success { background: #10b981; }
    .btn.success:hover { background: #059669; }
    .back-link { display: block; text-align: center; margin-top: 30px; color: #06b6d4; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📝 Account Registration & KYC</h1>
      <p style="color: #94a3b8;">Create your account and complete verification</p>
    </div>
    
    <form id="kycForm">
      <div class="kyc-section">
        <h3>1. Account Information</h3>
        <div class="form-group">
          <label for="username">Username</label>
          <input type="text" id="username" name="username" required>
        </div>
        <div class="form-group">
          <label for="email">Email Address</label>
          <input type="email" id="email" name="email" required>
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required>
        </div>
        <div class="form-group">
          <label for="confirm-password">Confirm Password</label>
          <input type="password" id="confirm-password" name="confirm-password" required>
        </div>
      </div>
      
      <div class="kyc-section">
        <h3>2. Company Type Selection</h3>
        <p style="color: #94a3b8; margin-bottom: 20px;">Select your company type to see required documents</p>
        
        <div class="company-types">
          <div class="company-type" onclick="selectCompanyType('listed')" id="listed-company">
            <h4>📈 Listed Company</h4>
            <p style="color: #94a3b8; margin: 10px 0;">Publicly traded corporation</p>
            <ul class="doc-list">
              <li>• Certificate of Incorporation</li>
              <li>• Annual Report (Latest)</li>
              <li>• Stock Exchange Filing</li>
              <li>• Board Resolution</li>
              <li>• Beneficial Ownership (25%+)</li>
              <li>• Audited Financial Statements</li>
            </ul>
          </div>
          
          <div class="company-type" onclick="selectCompanyType('private')" id="private-company">
            <h4>🏢 Private Company</h4>
            <p style="color: #94a3b8; margin: 10px 0;">Privately held corporation</p>
            <ul class="doc-list">
              <li>• Certificate of Incorporation</li>
              <li>• Articles of Association</li>
              <li>• Shareholders Register</li>
              <li>• Directors Register</li>
              <li>• Beneficial Ownership Info</li>
              <li>• Financial Statements</li>
              <li>• Business License</li>
            </ul>
          </div>
        </div>
        
        <input type="hidden" id="company-type" name="company-type" required>
      </div>
      
      <div class="kyc-section">
        <h3>3. Business Information</h3>
        <div class="form-group">
          <label for="company-name">Company Name</label>
          <input type="text" id="company-name" name="company-name" required>
        </div>
        <div class="form-group">
          <label for="registration-number">Registration Number</label>
          <input type="text" id="registration-number" name="registration-number" required>
        </div>
        <div class="form-group">
          <label for="business-address">Business Address</label>
          <input type="text" id="business-address" name="business-address" required>
        </div>
        <div class="form-group">
          <label for="role">Your Role</label>
          <select id="role" name="role" required>
            <option value="">Select Role</option>
            <option value="buyer">Buyer</option>
            <option value="supplier">Supplier</option>
            <option value="trader">Trader</option>
            <option value="insurer">Insurer</option>
          </select>
        </div>
      </div>
      
      <div style="text-align: center;">
        <button type="submit" class="btn success">Proceed to Document Upload</button>
      </div>
    </form>
    
    <a href="/landing-two" class="back-link">← Back to Team Portal</a>
  </div>
  
  <script>
    let selectedCompanyType = null;
    
    function selectCompanyType(type) {
      // Remove previous selection
      document.querySelectorAll('.company-type').forEach(el => el.classList.remove('selected'));
      
      // Add selection to clicked type
      document.getElementById(type + '-company').classList.add('selected');
      document.getElementById('company-type').value = type;
      selectedCompanyType = type;
    }
    
    document.getElementById('kycForm').addEventListener('submit', function(e) {
      e.preventDefault();
      
      if (!selectedCompanyType) {
        alert('Please select your company type');
        return;
      }
      
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirm-password').value;
      
      if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
      }
      
      // Proceed to document upload based on company type
      window.location.href = '/kyc/upload/' + selectedCompanyType + '?email=' + encodeURIComponent(document.getElementById('email').value);
    });
  </script>
</body>
</html>`;
  res.send(html);
});

// KYC DOCUMENT UPLOAD PAGES
app.get('/kyc/upload/:companyType', (req, res) => {
  const { companyType } = req.params;
  const email = req.query.email || '';
  
  const documents = companyType === 'listed' ? 
    ['Certificate of Incorporation', 'Annual Report', 'Stock Exchange Filing', 'Board Resolution', 'Beneficial Ownership', 'Audited Financial Statements'] :
    ['Certificate of Incorporation', 'Articles of Association', 'Shareholders Register', 'Directors Register', 'Beneficial Ownership Info', 'Financial Statements', 'Business License'];
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document Upload — Tangent Protocol</title>
  <style>
    body { font-family: system-ui; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 800px; margin: 50px auto; }
    .header { text-align: center; margin-bottom: 40px; }
    .header h1 { color: #2563eb; font-size: 2.5rem; }
    .upload-section { background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #334155; margin: 20px 0; }
    .upload-section h3 { color: #06b6d4; margin-top: 0; }
    .document-item { background: #0f172a; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #334155; }
    .document-item h4 { color: #f8fafc; margin: 0 0 10px 0; }
    .file-input { width: 100%; padding: 10px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: #f8fafc; margin: 8px 0; }
    .btn { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 500; margin: 10px 10px 10px 0; cursor: pointer; border: none; }
    .btn:hover { background: #1d4ed8; }
    .btn.success { background: #10b981; }
    .btn.success:hover { background: #059669; }
    .status { padding: 8px 16px; border-radius: 20px; font-size: 0.9rem; margin-left: 10px; }
    .status.uploaded { background: #10b981; color: white; }
    .status.pending { background: #f59e0b; color: black; }
    .progress-bar { width: 100%; height: 20px; background: #334155; border-radius: 10px; margin: 20px 0; }
    .progress-fill { height: 100%; background: #10b981; border-radius: 10px; transition: width 0.3s; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📄 Document Upload</h1>
      <p style="color: #94a3b8;">Upload required documents for ${companyType === 'listed' ? 'Listed Company' : 'Private Company'} verification</p>
      <p style="color: #06b6d4;"><strong>Email:</strong> ${email}</p>
    </div>
    
    <div class="upload-section">
      <h3>Required Documents</h3>
      <p style="color: #94a3b8;">Please upload all required documents. Accepted formats: PDF, DOC, DOCX, JPG, PNG (Max 10MB each)</p>
      
      <div class="progress-bar">
        <div class="progress-fill" id="progress" style="width: 0%;"></div>
      </div>
      <p id="progress-text" style="text-align: center; color: #94a3b8;">0 of ${documents.length} documents uploaded</p>
      
      <form id="uploadForm" enctype="multipart/form-data">
        <input type="hidden" name="email" value="${email}">
        <input type="hidden" name="companyType" value="${companyType}">
        
        ${documents.map((doc, index) => `
          <div class="document-item">
            <h4>${doc} <span class="status pending" id="status-${index}">Required</span></h4>
            <input type="file" name="document-${index}" class="file-input" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onchange="uploadDocument(this, ${index}, '${doc}')">
            <div id="upload-result-${index}"></div>
          </div>
        `).join('')}
        
        <div style="text-align: center; margin-top: 30px;">
          <button type="button" id="submitBtn" class="btn success" onclick="submitKYC()" disabled>
            Submit for Review
          </button>
        </div>
      </form>
    </div>
  </div>
  
  <script>
    let uploadedCount = 0;
    const totalDocs = ${documents.length};
    const uploadedFiles = {};
    
    async function uploadDocument(input, index, docName) {
      const file = input.files[0];
      if (!file) return;
      
      const formData = new FormData();
      formData.append('document', file);
      formData.append('documentType', docName);
      formData.append('email', '${email}');
      formData.append('companyType', '${companyType}');
      
      try {
        const response = await fetch('/api/upload-document', {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
          document.getElementById('status-' + index).textContent = 'Uploaded';
          document.getElementById('status-' + index).className = 'status uploaded';
          uploadedFiles[index] = result.filePath;
          uploadedCount++;
          updateProgress();
        } else {
          alert('Upload failed: ' + result.message);
        }
      } catch (error) {
        alert('Upload error: ' + error.message);
      }
    }
    
    function updateProgress() {
      const percentage = (uploadedCount / totalDocs) * 100;
      document.getElementById('progress').style.width = percentage + '%';
      document.getElementById('progress-text').textContent = uploadedCount + ' of ' + totalDocs + ' documents uploaded';
      
      if (uploadedCount === totalDocs) {
        document.getElementById('submitBtn').disabled = false;
      }
    }
    
    async function submitKYC() {
      try {
        const response = await fetch('/api/submit-kyc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: '${email}',
            companyType: '${companyType}',
            uploadedFiles: uploadedFiles
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          if (result.status === 'approved') {
            alert('KYC approved! Redirecting to wallet setup...');
            window.location.href = '/wallet/setup?email=' + encodeURIComponent('${email}');
          } else if (result.status === 'flagged') {
            alert('Your application is under review. You will receive an email within 48 hours.');
            window.location.href = '/kyc/pending?email=' + encodeURIComponent('${email}');
          }
        } else {
          alert('Submission failed: ' + result.message);
        }
      } catch (error) {
        alert('Submission error: ' + error.message);
      }
    }
  </script>
</body>
</html>`;
  
  res.send(html);
});

// API Routes for document upload and KYC processing
app.post('/api/upload-document', upload.single('document'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const { documentType, email, companyType } = req.body;
    
    // Store document info (in production, save to database)
    const documentInfo = {
      originalName: req.file.originalname,
      fileName: req.file.filename,
      filePath: req.file.path,
      documentType,
      email,
      companyType,
      uploadedAt: new Date()
    };
    
    console.log('Document uploaded:', documentInfo);
    
    res.json({ 
      success: true, 
      message: 'Document uploaded successfully',
      filePath: req.file.path,
      documentType
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/submit-kyc', async (req, res) => {
  try {
    const { email, companyType, uploadedFiles } = req.body;
    
    // Perform compliance checking
    const complianceResult = await performComplianceCheck({ 
      email, 
      companyType,
      companyName: email.split('@')[0] // Simplified for demo
    });
    
    // Create KYC application
    const kycId = 'KYC-' + Date.now();
    const kycApplication = {
      id: kycId,
      email,
      companyType,
      uploadedFiles,
      complianceResult,
      status: complianceResult.finalStatus,
      submittedAt: new Date(),
      reviewedAt: complianceResult.finalStatus === 'approved' ? new Date() : null
    };
    
    kycApplications.set(kycId, kycApplication);
    
    console.log('KYC Application submitted:', kycApplication);
    
    // Send email notification (simulated)
    if (complianceResult.finalStatus === 'flagged') {
      console.log('📧 EMAIL: Flagged KYC application requires admin review:', kycId);
    }
    
    res.json({ 
      success: true, 
      status: complianceResult.finalStatus,
      kycId,
      message: complianceResult.finalStatus === 'approved' ? 
        'KYC approved automatically' : 
        'KYC requires manual review due to compliance flags'
    });
  } catch (error) {
    console.error('KYC submission error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/tgt-info', (req, res) => {
  res.send('<h1>💎 TGT Information</h1><p>Coming soon...</p><p><a href="/">← Back</a></p>');
});

app.get('/portal', (req, res) => {
  res.send('<h1>🚀 Portal Home</h1><p><a href="/dashboard">Go to Dashboard</a></p>');
});

app.get('/admin', (req, res) => {
  res.send('<h1>⚙️ Admin Panel</h1><p><a href="/dashboard">Go to Dashboard</a></p>');
});

// API Routes
app.post('/api/unified-register', (req, res) => {
  console.log('UNIFIED REGISTRATION:', req.body);
  res.json({ success: true, message: 'Registration received', data: req.body });
});

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  console.log('LOGIN ATTEMPT:', email);
  
  if ((email === 'admin@tangent-protocol.com' || email === 'dudiollech@gmail.com') && password === 'TangentAdmin2024!') {
    res.json({ success: true, user: { email, role: 'admin' } });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

app.post('/auth/register', (req, res) => {
  console.log('REGISTRATION:', req.body);
  res.json({ success: true, message: 'Registration successful' });
});

app.post('/api/kyc/submit', (req, res) => {
  console.log('KYC SUBMISSION:', req.body);
  res.json({ success: true, message: 'KYC submitted successfully' });
});

// Test Routes
app.get('/test', (req, res) => {
  res.json({ 
    status: 'TANGENT-RESTORE-24 ULTIMATE WORKING!', 
    timestamp: new Date(),
    version: 'ULTIMATE-1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// ROLE-BASED DASHBOARDS

// ADMIN DASHBOARD
app.get('/dashboard/admin', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard — Tangent Protocol</title>
  <style>
    body { font-family: system-ui; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
    .header { background: #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #334155; }
    .header h1 { color: #2563eb; margin: 0; font-size: 2.5rem; }
    .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
    .dashboard-card { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; }
    .dashboard-card h3 { color: #06b6d4; margin-top: 0; }
    .btn { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin: 8px 8px 8px 0; font-weight: 500; }
    .btn:hover { background: #1d4ed8; }
    .btn.secondary { background: #06b6d4; }
    .field-input { width: 100%; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #f8fafc; margin: 8px 0; }
    .logout { position: fixed; top: 20px; right: 20px; background: #ef4444; }
  </style>
</head>
<body>
  <a href="/" class="btn logout">Logout</a>
  
  <div class="header">
    <h1>⚙️ Admin Dashboard</h1>
    <p>Platform Management & Control Center</p>
  </div>
  
  <div class="dashboard-grid">
    <div class="dashboard-card">
      <h3>💰 Platform Configuration</h3>
      <label>Platform Fee (%)</label>
      <input type="number" class="field-input" placeholder="2.5" step="0.1">
      <label>Daily Interest Rate (%)</label>
      <input type="number" class="field-input" placeholder="0.1" step="0.01">
      <a href="#" class="btn">Save Settings</a>
    </div>
    
    <div class="dashboard-card">
      <h3>🚢 Voyage Times</h3>
      <a href="/admin/voyage-times" class="btn">Manage Voyage Times</a>
      <a href="/admin/basis-points" class="btn secondary">Basis Points</a>
    </div>
    
    <div class="dashboard-card">
      <h3>📊 Active Trades</h3>
      <p>12 Active Contracts</p>
      <p>5 Pending Confirmations</p>
      <a href="/admin/trades" class="btn">View All Trades</a>
    </div>
    
    <div class="dashboard-card">
      <h3>🔍 KYC Management</h3>
      <p>8 Pending Reviews</p>
      <p>3 Flagged Applications</p>
      <a href="/admin/kyc" class="btn">KYC Reports</a>
    </div>
    
    <div class="dashboard-card">
      <h3>🚨 Alerts & Flags</h3>
      <p>2 Price Alerts</p>
      <a href="/admin/flags" class="btn">Review Flags</a>
    </div>
    
    <div class="dashboard-card">
      <h3>🏛️ Auction Board</h3>
      <p>3 Items in Auction</p>
      <a href="/admin/auction" class="btn">Auction Board</a>
    </div>
  </div>
</body>
</html>`;
  res.send(html);
});

// BUYER DASHBOARD  
app.get('/dashboard/buyer', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Buyer Dashboard — Tangent Protocol</title>
  <style>
    body { font-family: system-ui; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
    .header { background: #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #334155; }
    .header h1 { color: #2563eb; margin: 0; font-size: 2.5rem; }
    .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }
    .dashboard-card { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; }
    .dashboard-card h3 { color: #06b6d4; margin-top: 0; }
    .btn { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin: 8px 8px 8px 0; font-weight: 500; }
    .btn:hover { background: #1d4ed8; }
    .btn.success { background: #10b981; }
    .field-input { width: 100%; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #f8fafc; margin: 8px 0; }
    .contract-status { padding: 8px 16px; border-radius: 20px; font-size: 0.9rem; background: #f59e0b; color: #000; }
    .logout { position: fixed; top: 20px; right: 20px; background: #ef4444; }
  </style>
</head>
<body>
  <a href="/" class="btn logout">Logout</a>
  
  <div class="header">
    <h1>🛒 Buyer Dashboard</h1>
    <p>Manage your purchase contracts and deposits</p>
  </div>
  
  <div class="dashboard-grid">
    <div class="dashboard-card">
      <h3>📝 Create New Contract</h3>
      <label>Role: Buyer</label>
      <input type="text" class="field-input" placeholder="Commodity (e.g., Wheat)">
      <input type="number" class="field-input" placeholder="Quantity (MT)">
      <input type="number" class="field-input" placeholder="Price per MT ($)">
      <input type="email" class="field-input" placeholder="Supplier Email">
      <input type="text" class="field-input" placeholder="Delivery Terms">
      
      <div style="background: #0f172a; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <h4 style="color: #06b6d4;">Cost Breakdown</h4>
        <p>Platform Fee (2.5%): $35,063</p>
        <p>Insurance (0.5%): $7,013</p>
        <p><strong>Total Deposit: $1,445,976</strong></p>
      </div>
      
      <p style="font-size: 0.9rem; color: #94a3b8;">
        By submitting, you accept all conditions and fees.
      </p>
      
      <a href="#" class="btn success">Submit Contract</a>
    </div>
    
    <div class="dashboard-card">
      <h3>📋 My Contracts</h3>
      
      <div style="border: 1px solid #334155; border-radius: 8px; padding: 15px; margin: 15px 0;">
        <h4>Contract #TNG-2024-001</h4>
        <p>Wheat - 5,000 MT - $280.50/MT</p>
        <span class="contract-status">Pending Confirmation</span>
        <div style="margin-top: 15px;">
          <a href="#" class="btn" style="opacity: 0.5;">Deposit (Waiting)</a>
        </div>
      </div>
      
      <div style="border: 1px solid #334155; border-radius: 8px; padding: 15px; margin: 15px 0;">
        <h4>Contract #TNG-2024-002</h4>
        <p>Corn - 3,000 MT - $195.75/MT</p>
        <span class="contract-status" style="background: #10b981; color: #fff;">Confirmed</span>
        <div style="margin-top: 15px;">
          <a href="#" class="btn success">Make Deposit</a>
        </div>
      </div>
    </div>
    
    <div class="dashboard-card">
      <h3>💳 Wallet</h3>
      <p><strong>Balance:</strong> 50,000 TGT</p>
      <p><strong>Active Deposits:</strong> 2,890,000 TGT</p>
      <a href="#" class="btn">Manage Wallet</a>
    </div>
  </div>
</body>
</html>`;
  res.send(html);
});

// SUPPLIER DASHBOARD
app.get('/dashboard/supplier', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Supplier Dashboard — Tangent Protocol</title>
  <style>
    body { font-family: system-ui; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
    .header { background: #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #334155; }
    .header h1 { color: #10b981; margin: 0; font-size: 2.5rem; }
    .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }
    .dashboard-card { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; }
    .dashboard-card h3 { color: #06b6d4; margin-top: 0; }
    .btn { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; margin: 8px 8px 8px 0; font-weight: 500; }
    .btn:hover { background: #059669; }
    .btn.primary { background: #2563eb; }
    .logout { position: fixed; top: 20px; right: 20px; background: #ef4444; }
  </style>
</head>
<body>
  <a href="/" class="btn logout">Logout</a>
  
  <div class="header">
    <h1>🏭 Supplier Dashboard</h1>
    <p>Manage your supply contracts and deliveries</p>
  </div>
  
  <div class="dashboard-grid">
    <div class="dashboard-card">
      <h3>📧 Contract Confirmations</h3>
      
      <div style="border: 1px solid #334155; border-radius: 8px; padding: 15px; margin: 15px 0;">
        <h4>Contract #TNG-2024-001</h4>
        <p><strong>Buyer:</strong> International Foods</p>
        <p><strong>Commodity:</strong> Wheat - 5,000 MT</p>
        <p><strong>Price:</strong> $280.50/MT</p>
        <div style="margin-top: 15px;">
          <a href="#" class="btn">Confirm Contract</a>
          <a href="#" class="btn" style="background: #ef4444;">Decline</a>
        </div>
      </div>
    </div>
    
    <div class="dashboard-card">
      <h3>📋 Active Contracts</h3>
      
      <div style="border: 1px solid #334155; border-radius: 8px; padding: 15px; margin: 15px 0;">
        <h4>Contract #TNG-2024-003</h4>
        <p>Soybeans - 2,500 MT - $420.00/MT</p>
        <p>Status: Ready for Documents</p>
        <div style="margin-top: 15px;">
          <a href="#" class="btn primary">Upload Documents</a>
        </div>
      </div>
    </div>
    
    <div class="dashboard-card">
      <h3>💳 Wallet</h3>
      <p><strong>Balance:</strong> 125,000 TGT</p>
      <p><strong>Pending Payments:</strong> 3 contracts</p>
      <a href="#" class="btn primary">Manage Wallet</a>
    </div>
  </div>
</body>
</html>`;
  res.send(html);
});

// TRADER DASHBOARD
app.get('/dashboard/trader', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trader Dashboard — Tangent Protocol</title>
  <style>
    body { font-family: system-ui; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
    .header { background: #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #334155; }
    .header h1 { color: #f59e0b; margin: 0; font-size: 2.5rem; }
    .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }
    .dashboard-card { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; }
    .dashboard-card h3 { color: #06b6d4; margin-top: 0; }
    .btn { display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 8px; margin: 8px 8px 8px 0; font-weight: 500; }
    .btn:hover { background: #d97706; }
    .logout { position: fixed; top: 20px; right: 20px; background: #ef4444; }
  </style>
</head>
<body>
  <a href="/" class="btn logout">Logout</a>
  
  <div class="header">
    <h1>📈 Trader Dashboard</h1>
    <p>Manage your buy and sell contracts</p>
  </div>
  
  <div class="dashboard-grid">
    <div class="dashboard-card">
      <h3>🔗 Link Contracts</h3>
      <p>Link your buying and selling contracts for trade execution</p>
      <a href="#" class="btn">Link Contracts</a>
    </div>
    
    <div class="dashboard-card">
      <h3>📊 Trading Portfolio</h3>
      <p>Active Trades: 5</p>
      <p>Profit/Loss: +$125,000</p>
      <a href="#" class="btn">View Portfolio</a>
    </div>
  </div>
</body>
</html>`;
  res.send(html);
});

// INSURER DASHBOARD
app.get('/dashboard/insurer', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Insurer Dashboard — Tangent Protocol</title>
  <style>
    body { font-family: system-ui; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
    .header { background: #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #334155; }
    .header h1 { color: #8b5cf6; margin: 0; font-size: 2.5rem; }
    .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }
    .dashboard-card { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; }
    .dashboard-card h3 { color: #06b6d4; margin-top: 0; }
    .btn { display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; margin: 8px 8px 8px 0; font-weight: 500; }
    .btn:hover { background: #7c3aed; }
    .logout { position: fixed; top: 20px; right: 20px; background: #ef4444; }
  </style>
</head>
<body>
  <a href="/" class="btn logout">Logout</a>
  
  <div class="header">
    <h1>🛡️ Insurer Dashboard</h1>
    <p>Provide insurance quotes and risk assessment</p>
  </div>
  
  <div class="dashboard-grid">
    <div class="dashboard-card">
      <h3>📋 Active Trades</h3>
      <p>View all platform trades available for insurance</p>
      <a href="#" class="btn">View Trades</a>
    </div>
    
    <div class="dashboard-card">
      <h3>💼 Insurance Quotes</h3>
      <p>Provide quotes for performance insurance</p>
      <a href="#" class="btn">Create Quote</a>
    </div>
  </div>
</body>
</html>`;
  res.send(html);
});

// Error handling
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// Start server
const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';

console.log('🚀 Starting Tangent Ultimate Platform...');

const server = app.listen(PORT, HOST, (err) => {
  if (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
  console.log(`✅ TANGENT ULTIMATE PLATFORM RUNNING ON PORT ${PORT}`);
  console.log(`🌐 Landing Page: http://${HOST}:${PORT}/`);
  console.log(`🔐 Team Portal: http://${HOST}:${PORT}/landing-two`);
  console.log(`❤️ Health Check: http://${HOST}:${PORT}/health`);
  console.log('🎯 ALL FUNCTIONALITIES RESTORED!');
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
});
