const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

// In-memory storage for demo (in production, use a real database)
let registeredUsers = {};
let contracts = [];
let pendingRequests = [];
let contractNotifications = [];

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

// In-memory storage for demo
const users = new Map();
// contracts already declared above as array
const kycApplications = new Map();
const auctions = new Map();
const platformSettings = {
  platformFee: 2.5,
  dailyInterest: 0.1,
  insuranceRate: 0.5,
  voyageTime: 30,
  basisPoints: 5
};

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
  
  res.send(`<!DOCTYPE html>
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
      <p><strong>Version:</strong> ULTIMATE-CLEAN-${Date.now()}</p>
      <p><strong>Last Updated:</strong> ${new Date().toISOString()}</p>
    </div>
    
    <div style="margin-top: 30px; text-align: center;">
      <a href="/test" style="color: #2563eb; text-decoration: none; margin: 0 15px;">🔬 Test Server</a>
      <a href="/health" style="color: #2563eb; text-decoration: none; margin: 0 15px;">📊 Health Check</a>
    </div>
    
    <!-- Team Access Section -->
    <div style="text-align: center; margin-top: 40px; padding: 30px; border-top: 1px solid #334155; background: rgba(6, 182, 212, 0.05);">
      <p style="color: #94a3b8; font-size: 1rem; margin-bottom: 15px;">👥 Team members & new users</p>
      <a href="/landing-two" style="color: #06b6d4; text-decoration: none; font-size: 1rem; padding: 12px 24px; border: 2px solid #06b6d4; border-radius: 8px; transition: all 0.3s; font-weight: 500;" onmouseover="this.style.background='#06b6d4'; this.style.color='white'; this.style.transform='translateY(-2px)'" onmouseout="this.style.background='transparent'; this.style.color='#06b6d4'; this.style.transform='translateY(0)'">Team Portal</a>
    </div>
  </div>
</body>
</html>`);
});

// LANDING PAGE TWO - Team Access Portal  
app.get('/landing-two', (req, res) => {
  console.log('LANDING PAGE TWO HIT!');
  
  res.send(`<!DOCTYPE html>
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
    <h1>👥 Team Access Portal</h1>
    <p style="color: #94a3b8; font-size: 1.2rem; margin-bottom: 40px;">Choose your access method</p>
    
    <div class="access-grid">
      <div class="access-card">
        <h2>🔑 Sign In</h2>
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
      <a href="/" style="color: #06b6d4; text-decoration: none;">⬅ Back to Landing Page</a>
    </div>
  </div>
</body>
</html>`);
});

// SIGN IN PAGE
app.get('/sign-in', (req, res) => {
  console.log('SIGN IN PAGE HIT!');
  
  res.send(`<!DOCTYPE html>
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
    <h1>👥 Sign In</h1>
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
      <a href="/landing-two">⬅ Back to Team Access</a>
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
              window.location.href = '/dashboard/admin';
            } else {
              window.location.href = '/dashboard/' + data.user.role;
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
</html>`);
});

// ADMIN DASHBOARD
app.get('/dashboard/admin', (req, res) => {
  res.send(`<!DOCTYPE html>
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
      <input type="number" class="field-input" value="2.5" step="0.1">
      <label>Daily Interest Rate (%)</label>
      <input type="number" class="field-input" value="0.1" step="0.01">
      <label>Insurance Rate (%)</label>
      <input type="number" class="field-input" value="0.5" step="0.1">
      <button class="btn" onclick="saveSettings()">Save Settings</button>
    </div>
    
    <div class="dashboard-card">
      <h3>🚢 Voyage Times</h3>
      <p>Manage shipping times for different routes</p>
      <a href="/admin/voyage-times" class="btn">Manage Voyage Times</a>
      <a href="/admin/basis-points" class="btn secondary">Basis Points</a>
    </div>
    
    <div class="dashboard-card">
      <h3>📊 Active Trades</h3>
      <p><strong>12</strong> Active Contracts</p>
      <p><strong>5</strong> Pending Confirmations</p>
      <p><strong>3</strong> Awaiting Deposits</p>
      <a href="/admin/active-trades" class="btn">View All Trades</a>
    </div>
    
    <div class="dashboard-card">
      <h3>🔍 KYC Management</h3>
      <p><strong>8</strong> Pending Reviews</p>
      <p><strong>3</strong> Flagged Applications</p>
      <p><strong>25</strong> Approved This Month</p>
      <a href="/admin/kyc-reports" class="btn">KYC Reports</a>
      <a href="/admin/review-queue" class="btn secondary">Review Queue</a>
    </div>
    
    <div class="dashboard-card">
      <h3>🚩 Alerts & Flags</h3>
      <p><strong>2</strong> Price Alerts</p>
      <p><strong>1</strong> Compliance Flag</p>
      <p><strong>0</strong> Security Issues</p>
      <a href="/admin/flags" class="btn">Review Flags</a>
    </div>
    
    <div class="dashboard-card">
      <h3>🏆 Auction Board</h3>
      <p><strong>3</strong> Items in Auction</p>
      <p><strong>$2.5M</strong> Total Value</p>
      <p><strong>15</strong> Active Bidders</p>
      <a href="/admin/auction-board" class="btn">Auction Board</a>
    </div>
    
    <div class="dashboard-card">
      <h3>💎 TGT Pool</h3>
      <p><strong>$15.2M</strong> Total Balance</p>
      <p><strong>$8.7M</strong> Active Deposits</p>
      <p><strong>$6.5M</strong> Available</p>
      <button class="btn">Pool Management</button>
    </div>
    
    <div class="dashboard-card">
      <h3>📈 Platform Stats</h3>
      <p><strong>$125M</strong> Total Volume</p>
      <p><strong>$485K</strong> Fees Collected</p>
      <p><strong>1,247</strong> Active Users</p>
      <button class="btn secondary">Analytics</button>
    </div>
  </div>
  
  <script>
    function saveSettings() {
      alert('Settings saved successfully!');
    }
  </script>
</body>
</html>`);
});

// BUYER DASHBOARD  
app.get('/dashboard/buyer', (req, res) => {
  // Get current buyer email (in real app, from session)
  const buyerEmail = 'current_buyer@demo.com'; // Replace with actual session email
  
  // Get contracts for this buyer
  const buyerContracts = contracts.filter(contract => 
    contract.buyerEmail === buyerEmail
  );
  
  res.send(`<!DOCTYPE html>
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
      <label>Commodity Type</label>
      <input type="text" class="field-input" placeholder="e.g., Wheat, Corn, Soybeans">
      <label>Quantity (MT)</label>
      <input type="number" class="field-input" placeholder="5000">
      <label>Price per MT ($)</label>
      <input type="number" class="field-input" placeholder="280.50">
      <label>Supplier Email</label>
      <input type="email" class="field-input" placeholder="supplier@company.com">
      <label>Delivery Date</label>
      <input type="date" class="field-input">
      
      <div style="background: #0f172a; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <h4 style="color: #06b6d4;">Cost Breakdown</h4>
        <p>Platform Fee (2.5%): <strong>$35,063</strong></p>
        <p>Insurance (0.5%): <strong>$7,013</strong></p>
        <p>Total Value: <strong>$1,402,500</strong></p>
        <p style="color: #10b981;"><strong>Total Deposit Required: $1,444,576</strong></p>
      </div>
      
      <button class="btn success" onclick="createContract()">Submit Contract</button>
    </div>
    
    <div class="dashboard-card">
      <h3>📋 My Contracts</h3>
      <p>Your contracts and their current status (${buyerContracts.length} total)</p>
      
      ${buyerContracts.length === 0 ? 
        '<p style="color: #94a3b8; font-style: italic;">No contracts yet. Create your first contract using the unified trading dashboard.</p>' 
        : 
        buyerContracts.map(contract => {
          let statusColor = '#f59e0b'; // Default yellow for pending
          let statusText = contract.status;
          let buttonHtml = '';
          
          if (contract.status === 'pending_supplier_confirmation') {
            statusColor = '#f59e0b';
            statusText = 'Pending - Waiting for Supplier Confirmation';
            buttonHtml = '<button class="btn" style="opacity: 0.5;" disabled>Deposit (Waiting for Confirmation)</button>';
          } else if (contract.status === 'pending_deposit') {
            statusColor = '#10b981';
            statusText = 'Pending Deposit - Supplier Confirmed';
            buttonHtml = `<button class="btn success" onclick="makeDeposit('${contract.id}')">Make Deposit ($${contract.estimatedDeposit.toLocaleString()})</button>`;
          } else if (contract.status === 'active') {
            statusColor = '#06b6d4';
            statusText = 'Active - Deposit Paid';
            buttonHtml = `
              <button class="btn" style="background: #8b5cf6;" onclick="viewContract('${contract.id}')">View Details</button>
              <button class="btn" style="background: #ef4444;" onclick="viewDocuments('${contract.id}')">View Documents</button>
            `;
          }
          
          return `
          <div style="border: 1px solid #334155; border-radius: 8px; padding: 15px; margin: 15px 0;">
            <h4>Contract #${contract.id}</h4>
            <p><strong>Commodity:</strong> ${contract.product} - ${contract.quantity} MT</p>
            <p><strong>Max Price:</strong> $${contract.maxPrice}/MT</p>
            <p><strong>Total Value:</strong> $${contract.estimatedValue.toLocaleString()}</p>
            <p><strong>Supplier:</strong> ${contract.supplierEmail}</p>
            <p><strong>Required By:</strong> ${contract.requiredBy}</p>
            <p><strong>Created:</strong> ${new Date(contract.createdAt).toLocaleDateString()}</p>
            <span class="contract-status" style="background: ${statusColor}; color: #fff;">${statusText}</span>
            <div style="margin-top: 15px;">
              ${buttonHtml}
            </div>
          </div>`;
        }).join('')
      }
    </div>
    
    <div class="dashboard-card">
      <h3>💎 TGT Wallet</h3>
      <p><strong>Available Balance:</strong> 125,000 TGT</p>
      <p><strong>Active Deposits:</strong> 2,890,000 TGT</p>
      <p><strong>Pending Releases:</strong> 850,000 TGT</p>
      <div style="margin-top: 20px;">
        <button class="btn">Add Funds</button>
        <button class="btn" style="background: #06b6d4;">Transaction History</button>
      </div>
    </div>
    
    <div class="dashboard-card">
      <h3>📊 Trading Summary</h3>
      <p><strong>Contracts This Month:</strong> 8</p>
      <p><strong>Total Volume:</strong> $4.2M</p>
      <p><strong>Average Price:</strong> $285.50/MT</p>
      <p><strong>Saved in Fees:</strong> $12,450</p>
      <button class="btn" style="background: #8b5cf6;">View Analytics</button>
    </div>
  </div>
  
  <script>
    function createContract() {
      alert('Contract creation functionality - integrating with backend...');
    }
    
    function makeDeposit(contractId) {
      if(confirm('Proceed with deposit payment for contract ' + contractId + '? This will activate the contract.')) {
        fetch('/api/buyer/make-deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contractId, 
            buyerEmail: '${buyerEmail}' 
          })
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            alert('✅ ' + data.message);
            location.reload();
          } else {
            alert('❌ Error: ' + data.message);
          }
        })
        .catch(error => {
          alert('❌ Error processing deposit: ' + error.message);
        });
      }
    }
    
    function releasePayment(contractId) {
      if(confirm('Release payment for ' + contractId + '? This action cannot be undone.')) {
        alert('Payment release functionality - coming soon');
        // TODO: Implement payment release API
      }
    }
    
    function viewContract(contractId) {
      alert('Contract details for ' + contractId + ' - detailed view coming soon');
    }
    
    function viewDocuments(contractId) {
      alert('Document viewer for ' + contractId + ' - coming soon');
    }
  </script>
</body>
</html>`);
});

// SUPPLIER DASHBOARD
app.get('/dashboard/supplier', (req, res) => {
  // Get current supplier email (in real app, from session)
  const supplierEmail = 'zo@sadotagri.com'; // This should come from logged-in user session
  
  // Get notifications for this supplier (contracts awaiting confirmation)
  const supplierNotifications = contractNotifications.filter(notif => 
    notif.supplierEmail === supplierEmail && notif.status === 'unread'
  );
  
  // Get contracts for this supplier at different stages
  const supplierContracts = contracts.filter(contract => 
    contract.supplierEmail === supplierEmail
  );
  
  // Debug logging
  console.log('SUPPLIER DASHBOARD DEBUG:', {
    supplierEmail,
    totalContracts: contracts.length,
    totalNotifications: contractNotifications.length,
    supplierNotifications: supplierNotifications.length,
    supplierContracts: supplierContracts.length,
    allContractEmails: contracts.map(c => c.supplierEmail),
    allNotificationEmails: contractNotifications.map(n => n.supplierEmail)
  });
  
  res.send(`<!DOCTYPE html>
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
    .btn.danger { background: #ef4444; }
    .logout { position: fixed; top: 20px; right: 20px; background: #ef4444; }
  </style>
</head>
<body>
  <a href="/" class="btn logout">Logout</a>
  
  <div class="header">
    <h1>🚚 Supplier Dashboard</h1>
    <p>Manage your supply contracts and deliveries</p>
  </div>
  
  <div class="dashboard-grid">
    <div class="dashboard-card">
      <h3>📞 Contract Confirmations</h3>
      <p>New buyer requests requiring your confirmation (${supplierNotifications.length} pending)</p>
      
      ${supplierNotifications.length === 0 ? 
        '<p style="color: #94a3b8; font-style: italic;">No pending buyer requests at the moment. New requests will appear here automatically.</p>' 
        : 
        supplierNotifications.map(notification => {
          const request = notification.data;
          return `
          <div style="border: 1px solid #334155; border-radius: 8px; padding: 15px; margin: 15px 0; background: rgba(251, 191, 36, 0.1);">
            <h4>Contract #${request.id}</h4>
            <p><strong>Buyer:</strong> ${request.buyerEmail}</p>
            <p><strong>Commodity:</strong> ${request.product} - ${request.quantity} MT</p>
            <p><strong>Max Price:</strong> $${request.maxPrice}/MT</p>
            <p><strong>Total Value:</strong> $${request.estimatedValue.toLocaleString()}</p>
            <p><strong>Required By:</strong> ${request.requiredBy}</p>
            <p><strong>Destination:</strong> ${request.destination}</p>
            <p><strong>Posted:</strong> ${new Date(request.createdAt).toLocaleDateString()}</p>
            <div style="margin-top: 15px;">
              <button class="btn" onclick="confirmContract('${request.id}')">✅ Confirm Contract</button>
              <button class="btn danger" onclick="declineContract('${request.id}')">❌ Decline</button>
            </div>
          </div>`;
        }).join('')
      }
    </div>
    
    <div class="dashboard-card">
      <h3>📋 Active Contracts</h3>
      <p>Confirmed contracts ready for document upload</p>
      
      <div style="border: 1px solid #334155; border-radius: 8px; padding: 15px; margin: 15px 0;">
        <h4>Contract #TNG-2024-003</h4>
        <p><strong>Commodity:</strong> Soybeans - 2,000 MT</p>
        <p><strong>Price:</strong> $425.00/MT</p>
        <p><strong>Buyer:</strong> Asian Markets Inc</p>
        <p><strong>Status:</strong> Deposit Received - Ready for Documents</p>
        <div style="margin-top: 15px;">
          <button class="btn primary" onclick="uploadDocuments('TNG-2024-003')">📄 Upload Shipping Documents</button>
        </div>
      </div>
      
      <div style="border: 1px solid #334155; border-radius: 8px; padding: 15px; margin: 15px 0;">
        <h4>Contract #TNG-2024-002</h4>
        <p><strong>Commodity:</strong> Corn - 3,000 MT</p>
        <p><strong>Price:</strong> $195.75/MT</p>
        <p><strong>Buyer:</strong> Midwest Farms Co</p>
        <p><strong>Status:</strong> Documents Uploaded - Awaiting Payment</p>
        <div style="margin-top: 15px;">
          <button class="btn" style="background: #6b7280;" disabled>📄 Documents Uploaded</button>
          <button class="btn primary" onclick="viewDocuments('TNG-2024-002')">👁 View Status</button>
        </div>
      </div>
    </div>
    
    <div class="dashboard-card">
      <h3>💎 TGT Wallet</h3>
      <p><strong>Available Balance:</strong> 425,000 TGT</p>
      <p><strong>Pending Payments:</strong> 3 contracts</p>
      <p><strong>Expected:</strong> 2,447,825 TGT</p>
      <div style="margin-top: 20px;">
        <button class="btn primary">Transaction History</button>
        <button class="btn" style="background: #06b6d4;">Withdraw Funds</button>
      </div>
    </div>
    
    <div class="dashboard-card">
      <h3>📊 Performance Stats</h3>
      <p><strong>Contracts This Month:</strong> 12</p>
      <p><strong>Total Revenue:</strong> $5.8M</p>
      <p><strong>Average Rating:</strong> 4.9/5 ⭐</p>
      <p><strong>On-Time Delivery:</strong> 98%</p>
      <button class="btn" style="background: #8b5cf6;">View Full Analytics</button>
    </div>
  </div>
  
  <script>
    function confirmContract(contractId) {
      if(confirm('Confirm contract ' + contractId + '? You will be able to upload documents after buyer makes deposit.')) {
        fetch('/api/supplier/confirm-contract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contractId, 
            supplierEmail: '${supplierEmail}' 
          })
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            alert('✅ ' + data.message);
            location.reload();
          } else {
            alert('❌ Error: ' + data.message);
          }
        })
        .catch(error => {
          alert('❌ Error confirming contract: ' + error.message);
        });
      }
    }
    
    function declineContract(contractId) {
      if(confirm('Decline contract ' + contractId + '? This action cannot be undone.')) {
        fetch('/api/supplier/decline-contract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contractId, 
            supplierEmail: '${supplierEmail}' 
          })
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            alert('✅ ' + data.message);
            location.reload();
          } else {
            alert('❌ Error: ' + data.message);
          }
        })
        .catch(error => {
          alert('❌ Error declining contract: ' + error.message);
        });
      }
    }
    
    function uploadDocuments(contractId) {
      alert('Opening document upload interface for ' + contractId);
    }
    
    function viewDocuments(contractId) {
      alert('Viewing document status for ' + contractId);
    }
  </script>
</body>
</html>`);
});

// TRADER DASHBOARD
app.get('/dashboard/trader', (req, res) => {
  res.send(`<!DOCTYPE html>
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
    .btn.success { background: #10b981; }
    .btn.primary { background: #2563eb; }
    .field-input { width: 100%; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #f8fafc; margin: 8px 0; }
    .logout { position: fixed; top: 20px; right: 20px; background: #ef4444; }
  </style>
</head>
<body>
  <a href="/" class="btn logout">Logout</a>
  
  <div class="header">
    <h1>🎯 Trading Platform</h1>
    <p>Select your role and manage contracts</p>
    
    <!-- Role Selector -->
    <div style="margin-top: 20px;">
      <label style="color: #06b6d4; font-weight: 600; margin-right: 15px;">What is your role today?</label>
      <select id="roleSelector" class="field-input" style="width: auto; display: inline-block; margin-right: 20px;" onchange="switchRole()">
        <option value="">Select Role...</option>
        <option value="supplier">Supplier - I want to sell commodities</option>
        <option value="buyer">Buyer - I want to buy commodities</option>
        <option value="trader">Trader - I want to trade (buy & sell)</option>
      </select>
      <button onclick="resetForm()" class="btn" style="background: #6b7280;">Clear Form</button>
    </div>
  </div>
  
  <!-- Unified Contract Form -->
  <div id="contractForm" style="display: none; max-width: 800px; margin: 0 auto;">
    <div class="dashboard-card">
      <h3 id="formTitle">📝 Create Contract</h3>
      <p id="formDescription">Complete the form below</p>
      
      <form id="unifiedForm" onsubmit="submitContract(event)">
        <!-- Common Fields -->
        <div class="form-group">
          <label>Product *</label>
          <select id="product" class="field-input" required>
            <option value="">Select Commodity...</option>
            <option value="wheat">Wheat (ZW)</option>
            <option value="corn">Corn (ZC)</option>
            <option value="soybeans">Soybeans (ZS)</option>
            <option value="rice">Rice (ZR)</option>
            <option value="barley">Barley</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Quantity (MT) *</label>
          <input type="number" id="quantity" class="field-input" required placeholder="e.g. 5000">
        </div>
        
        <!-- Supplier-specific fields -->
        <div id="supplierFields" style="display: none;">
          <div class="form-group">
            <label>Price per MT (USD) *</label>
            <input type="number" id="pricePerUnit" class="field-input" step="0.01" placeholder="e.g. 275.50">
          </div>
          
          <div class="form-group">
            <label>Delivery Period *</label>
            <select id="deliveryPeriod" class="field-input">
              <option value="">Select Month/Year...</option>
              <option value="Jan 2025">January 2025</option>
              <option value="Feb 2025">February 2025</option>
              <option value="Mar 2025">March 2025</option>
              <option value="Apr 2025">April 2025</option>
              <option value="May 2025">May 2025</option>
              <option value="Jun 2025">June 2025</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Loading Port/Location *</label>
            <input type="text" id="deliveryLocation" class="field-input" placeholder="e.g. Santos, Brazil">
          </div>
          
          <div class="form-group">
            <label>Destination Port *</label>
            <input type="text" id="destination" class="field-input" placeholder="e.g. Shanghai, China">
          </div>
        </div>
        
        <!-- Buyer-specific fields -->
        <div id="buyerFields" style="display: none;">
          <div class="form-group">
            <label>Maximum Price per MT (USD) *</label>
            <input type="number" id="maxPrice" class="field-input" step="0.01" placeholder="e.g. 280.00">
          </div>
          
          <div class="form-group">
            <label>Required By *</label>
            <select id="requiredBy" class="field-input">
              <option value="">Select Month/Year...</option>
              <option value="Jan 2025">January 2025</option>
              <option value="Feb 2025">February 2025</option>
              <option value="Mar 2025">March 2025</option>
              <option value="Apr 2025">April 2025</option>
              <option value="May 2025">May 2025</option>
              <option value="Jun 2025">June 2025</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Preferred Origin *</label>
            <input type="text" id="preferredOrigin" class="field-input" placeholder="e.g. USA, Brazil, Argentina">
          </div>
          
          <div class="form-group">
            <label>Destination Port *</label>
            <input type="text" id="buyerDestination" class="field-input" placeholder="e.g. Hamburg, Germany">
          </div>
          
          <div class="form-group">
            <label>Supplier Email *</label>
            <input type="email" id="supplierEmail" class="field-input" placeholder="e.g. supplier@company.com" required>
          </div>
        </div>
        
        <!-- Trader-specific fields -->
        <div id="traderFields" style="display: none;">
          <div style="background: #0f172a; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #10b981;">Buy Side (You as Buyer)</h4>
            <div class="form-group">
              <label>Maximum Buy Price per MT (USD) *</label>
              <input type="number" id="traderBuyPrice" class="field-input" step="0.01" placeholder="e.g. 275.00">
            </div>
            <div class="form-group">
              <label>Buy From (Origin) *</label>
              <input type="text" id="buyFrom" class="field-input" placeholder="e.g. USA, Brazil">
            </div>
          </div>
          
          <div style="background: #0f172a; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #2563eb;">Sell Side (You as Supplier)</h4>
            <div class="form-group">
              <label>Minimum Sell Price per MT (USD) *</label>
              <input type="number" id="traderSellPrice" class="field-input" step="0.01" placeholder="e.g. 285.00">
            </div>
            <div class="form-group">
              <label>Sell To (Destination) *</label>
              <input type="text" id="sellTo" class="field-input" placeholder="e.g. China, Europe">
            </div>
          </div>
          
          <div id="profitCalculation" style="background: #1e293b; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h4 style="color: #f59e0b;">Profit Calculation</h4>
            <p id="profitDetails">Enter prices to calculate profit...</p>
          </div>
        </div>
        
        <button type="submit" class="btn success" id="submitBtn">Create Contract</button>
        <div id="responseMessage" style="margin-top: 15px;"></div>
      </form>
    </div>
  </div>
  
  <!-- Welcome Message -->
  <div id="welcomeMessage" style="text-align: center; padding: 60px 20px;">
    <h2 style="color: #06b6d4; margin-bottom: 20px;">👆 Please select your role above to get started</h2>
    <p style="font-size: 1.2rem; color: #94a3b8;">Choose whether you want to act as a Supplier, Buyer, or Trader today</p>
  </div>
  
  <script>
    function switchRole() {
      const role = document.getElementById('roleSelector').value;
      const contractForm = document.getElementById('contractForm');
      const welcomeMessage = document.getElementById('welcomeMessage');
      const formTitle = document.getElementById('formTitle');
      const formDescription = document.getElementById('formDescription');
      const submitBtn = document.getElementById('submitBtn');
      
      // Hide all role-specific fields
      document.getElementById('supplierFields').style.display = 'none';
      document.getElementById('buyerFields').style.display = 'none';
      document.getElementById('traderFields').style.display = 'none';
      
      if (role === '') {
        contractForm.style.display = 'none';
        welcomeMessage.style.display = 'block';
        return;
      }
      
      contractForm.style.display = 'block';
      welcomeMessage.style.display = 'none';
      
      if (role === 'supplier') {
        formTitle.textContent = '🏭 Supplier - Create Offer';
        formDescription.textContent = 'Create an offer to sell your commodities';
        submitBtn.textContent = 'Create Supplier Offer';
        document.getElementById('supplierFields').style.display = 'block';
      } else if (role === 'buyer') {
        formTitle.textContent = '🛒 Buyer - Create Request';
        formDescription.textContent = 'Create a request to buy commodities';
        submitBtn.textContent = 'Create Buyer Request';
        document.getElementById('buyerFields').style.display = 'block';
      } else if (role === 'trader') {
        formTitle.textContent = '📈 Trader - Create Dual Contract';
        formDescription.textContent = 'Set up both buy and sell sides for trading profit';
        submitBtn.textContent = 'Create Dual Contract';
        document.getElementById('traderFields').style.display = 'block';
      }
    }
    
    function resetForm() {
      document.getElementById('roleSelector').value = '';
      document.getElementById('unifiedForm').reset();
      document.getElementById('contractForm').style.display = 'none';
      document.getElementById('welcomeMessage').style.display = 'block';
      document.getElementById('responseMessage').innerHTML = '';
    }
    
    function submitContract(event) {
      event.preventDefault();
      const role = document.getElementById('roleSelector').value;
      const responseDiv = document.getElementById('responseMessage');
      
      // Collect form data
      const formData = {
        type: role === 'supplier' ? 'supplier_offer' : role === 'buyer' ? 'buyer_request' : 'trader_dual',
        product: document.getElementById('product').value,
        quantity: document.getElementById('quantity').value
      };
      
      if (role === 'supplier') {
        formData.pricePerUnit = document.getElementById('pricePerUnit').value;
        formData.deliveryPeriod = document.getElementById('deliveryPeriod').value;
        formData.deliveryLocation = document.getElementById('deliveryLocation').value;
        formData.destination = document.getElementById('destination').value;
      } else if (role === 'buyer') {
        formData.maxPrice = document.getElementById('maxPrice').value;
        formData.requiredBy = document.getElementById('requiredBy').value;
        formData.preferredOrigin = document.getElementById('preferredOrigin').value;
        formData.destination = document.getElementById('buyerDestination').value;
        formData.supplierEmail = document.getElementById('supplierEmail').value;
      } else if (role === 'trader') {
        formData.buyPrice = document.getElementById('traderBuyPrice').value;
        formData.sellPrice = document.getElementById('traderSellPrice').value;
        formData.buyFrom = document.getElementById('buyFrom').value;
        formData.sellTo = document.getElementById('sellTo').value;
      }
      
      // Submit to backend
      fetch('/api/create-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          responseDiv.innerHTML = '<div style="color: #10b981; padding: 15px; background: rgba(16, 185, 129, 0.1); border-radius: 8px;"><strong>Success!</strong><br>' + data.message + '<br><strong>Contract ID:</strong> ' + data.contractId + '</div>';
          document.getElementById('unifiedForm').reset();
        } else {
          responseDiv.innerHTML = '<div style="color: #ef4444; padding: 15px; background: rgba(239, 68, 68, 0.1); border-radius: 8px;"><strong>Error:</strong> ' + data.message + '</div>';
        }
      })
      .catch(error => {
        responseDiv.innerHTML = '<div style="color: #ef4444; padding: 15px; background: rgba(239, 68, 68, 0.1); border-radius: 8px;"><strong>Error:</strong> ' + error.message + '</div>';
      });
    }
    
    // Auto-calculate profit for traders
    document.addEventListener('input', function(e) {
      if (e.target.id === 'traderBuyPrice' || e.target.id === 'traderSellPrice' || e.target.id === 'quantity') {
        const buyPrice = parseFloat(document.getElementById('traderBuyPrice').value) || 0;
        const sellPrice = parseFloat(document.getElementById('traderSellPrice').value) || 0;
        const quantity = parseFloat(document.getElementById('quantity').value) || 0;
        
        if (buyPrice > 0 && sellPrice > 0 && quantity > 0) {
          const buyTotal = buyPrice * quantity;
          const sellTotal = sellPrice * quantity;
          const profit = sellTotal - buyTotal;
          const margin = ((profit / buyTotal) * 100);
          
          document.getElementById('profitDetails').innerHTML = 
            '<p>Buy Total: $' + buyTotal.toLocaleString() + '</p>' +
            '<p>Sell Total: $' + sellTotal.toLocaleString() + '</p>' +
            '<p style="color: ' + (profit > 0 ? '#10b981' : '#ef4444') + ';">Profit: $' + profit.toLocaleString() + '</p>' +
            '<p style="color: #f59e0b;">Margin: ' + margin.toFixed(2) + '%</p>';
        }
      }
    });
  </script>
</body>
</html>`);
});

// INSURER DASHBOARD
app.get('/dashboard/insurer', (req, res) => {
  res.send(`<!DOCTYPE html>
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
    .btn.success { background: #10b981; }
    .btn.primary { background: #2563eb; }
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
      <h3>📋 Available Trades</h3>
      <p>Active trades seeking insurance coverage</p>
      
      <div style="border: 1px solid #334155; border-radius: 8px; padding: 15px; margin: 15px 0;">
        <h4>Contract #TNG-2024-001</h4>
        <p><strong>Commodity:</strong> Wheat - 5,000 MT</p>
        <p><strong>Value:</strong> $1,402,500</p>
        <p><strong>Route:</strong> USA → China</p>
        <p><strong>Risk Level:</strong> <span style="color: #10b981;">Low</span></p>
        <button class="btn success">Provide Quote</button>
      </div>
      
      <div style="border: 1px solid #334155; border-radius: 8px; padding: 15px; margin: 15px 0;">
        <h4>Contract #TNG-2024-003</h4>
        <p><strong>Commodity:</strong> Crude Oil - 10,000 barrels</p>
        <p><strong>Value:</strong> $755,000</p>
        <p><strong>Route:</strong> Middle East → Europe</p>
        <p><strong>Risk Level:</strong> <span style="color: #f59e0b;">Medium</span></p>
        <button class="btn">Provide Quote</button>
      </div>
    </div>
    
    <div class="dashboard-card">
      <h3>💼 Active Policies</h3>
      
      <div style="border: 1px solid #334155; border-radius: 8px; padding: 15px; margin: 15px 0;">
        <h4>Policy #INS-2024-001</h4>
        <p><strong>Contract:</strong> TNG-2024-002</p>
        <p><strong>Coverage:</strong> $590,325</p>
        <p><strong>Premium:</strong> $2,951 (0.5%)</p>
        <p><strong>Status:</strong> Active</p>
        <button class="btn primary">View Details</button>
      </div>
    </div>
    
    <div class="dashboard-card">
      <h3>📊 Insurance Stats</h3>
      <p><strong>Active Policies:</strong> 8</p>
      <p><strong>Total Coverage:</strong> $12.5M</p>
      <p><strong>Premium Income:</strong> $62,500</p>
      <p><strong>Claims Ratio:</strong> 2.1%</p>
      <button class="btn primary">Detailed Reports</button>
    </div>
  </div>
</body>
</html>`);
});

// Authentication routes
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  console.log('LOGIN ATTEMPT:', email);
  
  // Demo credentials
  if ((email === 'admin@tangent-protocol.com' || email === 'dudiollech@gmail.com') && password === 'TangentAdmin2024!') {
    res.json({ success: true, user: { email, role: 'admin' } });
  } else if ((email === 'zo@sadotagri.com' || email === 'dudiollech@gmail.com') && password === 'TangentAdmin2024!') {
    res.json({ success: true, user: { email, role: 'admin' } });
  } else if (email === 'buyer@demo.com' && password === 'demo123') {
    res.json({ success: true, user: { email, role: 'buyer' } });
  } else if (email === 'supplier@demo.com' && password === 'demo123') {
    res.json({ success: true, user: { email, role: 'supplier' } });
  } else if (email === 'trader@demo.com' && password === 'demo123') {
    res.json({ success: true, user: { email, role: 'trader' } });
  } else if (email === 'zo@sadotagri.com' && password === 'demo123') {
    res.json({ success: true, user: { email, role: 'trader' } });
  } else if (email === 'insurer@demo.com' && password === 'demo123') {
    res.json({ success: true, user: { email, role: 'insurer' } });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Registration endpoint
app.post('/auth/register', (req, res) => {
  const { firstName, lastName, email, phone, country, role, password } = req.body;
  
  console.log('REGISTRATION ATTEMPT:', email);
  
  // Simple validation
  if (!firstName || !lastName || !email || !phone || !country || !role || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  }
  
  // Check if email already exists (in a real app, check database)
  const existingEmails = [
    'admin@tangent-protocol.com', 
    'dudiollech@gmail.com', 
    'zo@sadotagri.com',
    'buyer@demo.com',
    'supplier@demo.com', 
    'trader@demo.com',
    'insurer@demo.com'
  ];
  
  if (existingEmails.includes(email)) {
    return res.status(400).json({ success: false, message: 'Email already registered. Please use a different email or sign in.' });
  }
  
  // In a real application, you would:
  // 1. Hash the password with bcrypt
  // 2. Save user to database
  // 3. Send verification email
  
  // Store the user for notifications
  registeredUsers[email] = {
    id: 'USR-' + Date.now(),
    firstName, 
    lastName, 
    email, 
    role,
    country,
    password, // In production: hash this
    status: 'pending_kyc'
  };
  
  console.log('✅ NEW USER REGISTERED:', { 
    name: `${firstName} ${lastName}`, 
    email, 
    country, 
    role 
  });
  
  // For demo purposes, simulate successful registration
  res.json({ 
    success: true, 
    message: 'Account created successfully! Please complete KYC verification.',
    user: { 
      id: 'USR-' + Date.now(),
      firstName, 
      lastName, 
      email, 
      role,
      country,
      status: 'pending_kyc'
    }
  });
});

// KYC page route
app.get('/kyc', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KYC Verification - Tangent Protocol</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; background: rgba(255, 255, 255, 0.95); border-radius: 20px; padding: 40px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo h1 { color: #667eea; font-size: 2.5rem; margin-bottom: 10px; }
    .logo p { color: #6b7280; font-size: 1.1rem; }
    .steps { display: flex; justify-content: center; margin-bottom: 40px; }
    .step { display: flex; align-items: center; margin: 0 10px; }
    .step-number { width: 30px; height: 30px; border-radius: 50%; background: #667eea; color: white; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-weight: bold; }
    .step-text { color: #374151; font-weight: 600; }
    .step.active .step-number { background: #10b981; }
    .company-type { margin-bottom: 30px; }
    .company-type h3 { color: #374151; margin-bottom: 20px; font-size: 1.3rem; }
    .type-options { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .type-card { border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px; cursor: pointer; transition: all 0.3s; text-align: center; }
    .type-card:hover { border-color: #667eea; background: #f8faff; }
    .type-card.selected { border-color: #667eea; background: #f8faff; }
    .type-card h4 { color: #374151; margin-bottom: 10px; }
    .type-card p { color: #6b7280; font-size: 0.9rem; }
    .upload-section { margin-top: 30px; display: none; }
    .upload-section.show { display: block; }
    .upload-item { margin-bottom: 25px; padding: 20px; border: 2px dashed #d1d5db; border-radius: 12px; }
    .upload-item h4 { color: #374151; margin-bottom: 10px; }
    .upload-item p { color: #6b7280; font-size: 0.9rem; margin-bottom: 15px; }
    .file-input { display: none; }
    .upload-btn { background: #667eea; color: white; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; transition: background 0.3s; }
    .upload-btn:hover { background: #5a67d8; }
    .submit-btn { width: 100%; background: #10b981; color: white; padding: 15px; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.3s; margin-top: 30px; display: none; }
    .submit-btn:hover { background: #059669; }
    .submit-btn.show { display: block; }
    .progress { background: #e5e7eb; height: 8px; border-radius: 4px; margin: 20px 0; }
    .progress-bar { background: #10b981; height: 100%; border-radius: 4px; width: 0%; transition: width 0.3s; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>🔐 KYC Verification</h1>
      <p>Complete your Know Your Customer verification to access the platform</p>
    </div>
    
    <div class="steps">
      <div class="step active">
        <div class="step-number">1</div>
        <div class="step-text">Company Type</div>
      </div>
      <div class="step">
        <div class="step-number">2</div>
        <div class="step-text">Upload Documents</div>
      </div>
      <div class="step">
        <div class="step-number">3</div>
        <div class="step-text">Verification</div>
      </div>
    </div>
    
    <div class="progress">
      <div class="progress-bar" id="progressBar"></div>
    </div>
    
    <div class="company-type">
      <h3>Select Your Company Type</h3>
      <div class="type-options">
        <div class="type-card" onclick="selectCompanyType('listed')">
          <h4>📈 Listed Company</h4>
          <p>Publicly traded company with shares on stock exchange</p>
          <ul style="text-align: left; margin-top: 10px; color: #6b7280;">
            <li>Stock exchange listing</li>
            <li>Annual reports required</li>
            <li>Enhanced compliance</li>
          </ul>
        </div>
        <div class="type-card" onclick="selectCompanyType('private')">
          <h4>🏢 Privately Held Company</h4>
          <p>Private company not publicly traded</p>
          <ul style="text-align: left; margin-top: 10px; color: #6b7280;">
            <li>Private ownership</li>
            <li>Standard documentation</li>
            <li>Regular compliance</li>
          </ul>
        </div>
      </div>
    </div>
    
    <div class="upload-section" id="uploadSection">
      <h3>Upload Required Documents</h3>
      
      <div class="upload-item">
        <h4>📄 Certificate of Incorporation</h4>
        <p>Official document proving company registration</p>
        <input type="file" id="incorporation" class="file-input" accept=".pdf,.jpg,.png" onchange="handleFileUpload('incorporation')">
        <button class="upload-btn" onclick="document.getElementById('incorporation').click()">Choose File</button>
        <span id="incorporation-status"></span>
      </div>
      
      <div class="upload-item">
        <h4>🆔 Director Identification</h4>
        <p>Passport or national ID of company directors</p>
        <input type="file" id="director-id" class="file-input" accept=".pdf,.jpg,.png" onchange="handleFileUpload('director-id')">
        <button class="upload-btn" onclick="document.getElementById('director-id').click()">Choose File</button>
        <span id="director-id-status"></span>
      </div>
      
      <div class="upload-item">
        <h4>🏦 Bank Statement</h4>
        <p>Recent bank statement (last 3 months)</p>
        <input type="file" id="bank-statement" class="file-input" accept=".pdf" onchange="handleFileUpload('bank-statement')">
        <button class="upload-btn" onclick="document.getElementById('bank-statement').click()">Choose File</button>
        <span id="bank-statement-status"></span>
      </div>
      
      <div class="upload-item" id="listed-docs" style="display: none;">
        <h4>📊 Financial Statements</h4>
        <p>Latest audited financial statements</p>
        <input type="file" id="financial" class="file-input" accept=".pdf" onchange="handleFileUpload('financial')">
        <button class="upload-btn" onclick="document.getElementById('financial').click()">Choose File</button>
        <span id="financial-status"></span>
      </div>
    </div>
    
    <button class="submit-btn" id="submitBtn" onclick="submitKYC()">Submit KYC Application</button>
  </div>
  
  <script>
    let selectedType = '';
    let uploadedFiles = {};
    
    function selectCompanyType(type) {
      selectedType = type;
      
      // Update UI
      document.querySelectorAll('.type-card').forEach(card => card.classList.remove('selected'));
      event.target.closest('.type-card').classList.add('selected');
      
      // Show upload section
      document.getElementById('uploadSection').classList.add('show');
      
      // Show/hide listed company specific docs
      const listedDocs = document.getElementById('listed-docs');
      if (type === 'listed') {
        listedDocs.style.display = 'block';
      } else {
        listedDocs.style.display = 'none';
      }
      
      updateProgress();
      checkSubmitReady();
    }
    
    function handleFileUpload(docType) {
      const fileInput = document.getElementById(docType);
      const statusSpan = document.getElementById(docType + '-status');
      
      if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        uploadedFiles[docType] = file;
        statusSpan.innerHTML = ' ✅ ' + file.name;
        statusSpan.style.color = '#10b981';
      }
      
      updateProgress();
      checkSubmitReady();
    }
    
    function updateProgress() {
      let progress = 0;
      
      if (selectedType) progress += 25;
      
      const requiredDocs = selectedType === 'listed' ? 4 : 3;
      const uploadedCount = Object.keys(uploadedFiles).length;
      progress += (uploadedCount / requiredDocs) * 75;
      
      document.getElementById('progressBar').style.width = progress + '%';
    }
    
    function checkSubmitReady() {
      const requiredDocs = selectedType === 'listed' ? 
        ['incorporation', 'director-id', 'bank-statement', 'financial'] :
        ['incorporation', 'director-id', 'bank-statement'];
      
      const isReady = selectedType && requiredDocs.every(doc => uploadedFiles[doc]);
      
      if (isReady) {
        document.getElementById('submitBtn').classList.add('show');
      }
    }
    
    function submitKYC() {
      // Simulate KYC submission
      document.getElementById('submitBtn').textContent = 'Processing...';
      document.getElementById('submitBtn').disabled = true;
      
      setTimeout(() => {
        alert('KYC Application Submitted Successfully!\\n\\nYour application is now under review. You will receive an email notification within 24-48 hours with the verification results.\\n\\nRedirecting to dashboard...');
        window.location.href = '/dashboard/trader';
      }, 2000);
    }
  </script>
</body>
</html>`);
});

// Additional routes
app.get('/register', (req, res) => res.redirect('/sign-up'));
app.get('/login', (req, res) => res.redirect('/sign-in'));
app.get('/sign-up', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign Up - Tangent Protocol</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { background: rgba(255, 255, 255, 0.95); padding: 40px; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); width: 100%; max-width: 500px; }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo h1 { color: #667eea; font-size: 2.5rem; margin-bottom: 10px; }
    .logo p { color: #6b7280; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; color: #374151; font-weight: 600; }
    .form-group input, .form-group select { width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; transition: border-color 0.3s; }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: #667eea; }
    .btn { width: 100%; background: #667eea; color: white; padding: 15px; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.3s; margin-top: 20px; }
    .btn:hover { background: #5a67d8; }
    .back-link { text-align: center; margin-top: 20px; }
    .back-link a { color: #667eea; text-decoration: none; }
    .back-link a:hover { text-decoration: underline; }
    .error { color: #ef4444; font-size: 14px; margin-top: 5px; }
    .success { color: #10b981; font-size: 14px; margin-top: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>🎯 Tangent Protocol</h1>
      <p>Create Your Account</p>
    </div>
    
    <form id="signupForm" onsubmit="handleSignup(event)">
      <div class="form-group">
        <label for="firstName">First Name *</label>
        <input type="text" id="firstName" name="firstName" required>
      </div>
      
      <div class="form-group">
        <label for="lastName">Last Name *</label>
        <input type="text" id="lastName" name="lastName" required>
      </div>
      
      <div class="form-group">
        <label for="email">Email Address *</label>
        <input type="email" id="email" name="email" required>
      </div>
      
      <div class="form-group">
        <label for="phone">Phone Number *</label>
        <input type="tel" id="phone" name="phone" required>
      </div>
      
      <div class="form-group">
        <label for="country">Country *</label>
        <select id="country" name="country" required>
          <option value="">Select your country...</option>
          <option value="US">United States</option>
          <option value="UK">United Kingdom</option>
          <option value="CA">Canada</option>
          <option value="AU">Australia</option>
          <option value="DE">Germany</option>
          <option value="FR">France</option>
          <option value="JP">Japan</option>
          <option value="SG">Singapore</option>
          <option value="BR">Brazil</option>
          <option value="IN">India</option>
          <option value="IL">Israel</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="role">Primary Role *</label>
        <select id="role" name="role" required>
          <option value="">Select your primary role...</option>
          <option value="supplier">Supplier - I sell commodities</option>
          <option value="buyer">Buyer - I purchase commodities</option>
          <option value="trader">Trader - I trade commodities</option>
          <option value="insurer">Insurer - I provide trade insurance</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="password">Password *</label>
        <input type="password" id="password" name="password" required minlength="8">
        <div class="error" style="display: none;" id="passwordError">Password must be at least 8 characters</div>
      </div>
      
      <div class="form-group">
        <label for="confirmPassword">Confirm Password *</label>
        <input type="password" id="confirmPassword" name="confirmPassword" required>
        <div class="error" style="display: none;" id="confirmError">Passwords do not match</div>
      </div>
      
      <button type="submit" class="btn">Create Account & Continue to KYC</button>
      
      <div id="responseMessage" style="margin-top: 15px;"></div>
    </form>
    
    <div class="back-link">
      <a href="/landing-two">← Back to Sign In</a>
    </div>
  </div>
  
  <script>
    function handleSignup(event) {
      event.preventDefault();
      
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const responseDiv = document.getElementById('responseMessage');
      
      // Reset errors
      document.getElementById('passwordError').style.display = 'none';
      document.getElementById('confirmError').style.display = 'none';
      
      // Validate password
      if (password.length < 8) {
        document.getElementById('passwordError').style.display = 'block';
        return;
      }
      
      if (password !== confirmPassword) {
        document.getElementById('confirmError').style.display = 'block';
        return;
      }
      
      // Collect form data
      const formData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        country: document.getElementById('country').value,
        role: document.getElementById('role').value,
        password: password
      };
      
      // Submit registration
      fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          responseDiv.innerHTML = '<div class="success">Account created successfully! Redirecting to KYC...</div>';
          setTimeout(() => {
            window.location.href = '/kyc';
          }, 2000);
        } else {
          responseDiv.innerHTML = '<div class="error">' + data.message + '</div>';
        }
      })
      .catch(error => {
        responseDiv.innerHTML = '<div class="error">Registration failed. Please try again.</div>';
      });
    }
  </script>
</body>
</html>`);
});
app.get('/tgt-info', (req, res) => res.send('<h1>TGT Information - To be implemented</h1>'));

// Test routes
app.get('/test', (req, res) => {
  res.json({ 
    status: 'ULTIMATE CLEAN VERSION WORKING!', 
    timestamp: new Date(),
    version: 'ULTIMATE-CLEAN-1.0.0',
    dashboards: ['admin', 'buyer', 'supplier', 'trader', 'insurer'],
    features: ['Authentication', 'Role-based dashboards', 'Clean UI', 'No encoding issues']
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    version: 'ULTIMATE-CLEAN'
  });
});

// Error handling
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// Start server
// CONTRACT CREATION WITH DEPOSIT HANDLING
app.post('/api/create-contract', async (req, res) => {
  try {
    const { type, product, quantity, pricePerUnit, maxPrice, deliveryPeriod, deliveryLocation, destination, requiredBy } = req.body;
    
    const contractId = 'CT-' + Date.now();
    const currentTime = new Date();
    
    if (type === 'supplier_offer') {
      // SUPPLIER CONTRACT CREATION WITH DEPOSIT
      const totalValue = parseFloat(quantity) * parseFloat(pricePerUnit);
      const requiredDeposit = totalValue * 0.1; // 10% deposit
      
      // Check TGT pool balance (simulated user balance)
      const userBalance = 10000; // Simulated user balance
      if (userBalance < requiredDeposit) {
        return res.json({
          success: false,
          message: 'Insufficient TGT balance. Required: ' + requiredDeposit + ' TGT, Available: ' + userBalance + ' TGT'
        });
      }
      
      // Process deposit to TGT pool
      const deposit = tgtPool.deposit(requiredDeposit, 'supplier@current.com', contractId);
      const newBalance = userBalance - requiredDeposit;
      
      // Calculate fees
      const platformFee = totalValue * 0.025; // 2.5%
      const insuranceFee = totalValue * 0.005; // 0.5%
      
      console.log('✅ SUPPLIER CONTRACT CREATED WITH DEPOSIT:', {
        contractId,
        totalValue,
        deposit: requiredDeposit,
        newBalance
      });
      
      return res.json({
        success: true,
        contractId,
        message: 'Supplier contract created and deposit processed',
        depositRequired: requiredDeposit + ' TGT',
        newBalance,
        totalValue: '$' + totalValue.toLocaleString(),
        fees: {
          platform: '$' + platformFee.toLocaleString(),
          insurance: '$' + insuranceFee.toLocaleString()
        }
      });
      
    } else if (type === 'buyer_request') {
      // DIRECT BUYER CONTRACT CREATION WITH SPECIFIC SUPPLIER
      const { supplierEmail } = req.body;
      const estimatedValue = parseFloat(quantity) * parseFloat(maxPrice);
      const estimatedDeposit = estimatedValue * 0.1; // 10% estimated deposit
      
      // Create direct contract between buyer and specified supplier
      const contract = {
        id: contractId,
        type: 'buyer_contract',
        product,
        quantity,
        maxPrice,
        requiredBy,
        destination,
        estimatedValue,
        estimatedDeposit,
        status: 'pending_supplier_confirmation',
        supplierEmail,
        buyerEmail: 'current_buyer@demo.com', // In real app, get from session
        createdAt: currentTime,
        statusHistory: [
          { status: 'pending_supplier_confirmation', timestamp: currentTime, note: 'Contract created, awaiting supplier confirmation' }
        ]
      };
      
      contracts.push(contract);
      
      // Create notification for the specific supplier
      contractNotifications.push({
        id: 'NOTIF-' + Date.now(),
        type: 'contract_confirmation_request',
        contractId,
        supplierEmail,
        message: `New contract from buyer requires your confirmation: ${quantity} MT of ${product} at $${maxPrice}/MT`,
        data: contract,
        status: 'unread',
        createdAt: currentTime
      });
      
      console.log('✅ DIRECT BUYER CONTRACT CREATED:', {
        contractId,
        supplierEmail,
        estimatedValue,
        estimatedDeposit,
        status: 'pending_supplier_confirmation'
      });
      
      return res.json({
        success: true,
        contractId,
        message: `Contract created and sent to ${supplierEmail} for confirmation. Status: Pending`,
        estimatedValue: '$' + estimatedValue.toLocaleString(),
        estimatedDeposit: estimatedDeposit + ' TGT',
        status: 'pending_supplier_confirmation'
      });
    }
    
  } catch (error) {
    console.error('Contract creation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// SUPPLIER CONFIRMATION/DECLINE ENDPOINTS
app.post('/api/supplier/confirm-contract', (req, res) => {
  const { contractId, supplierEmail } = req.body;
  
  // Find the contract
  const contractIndex = contracts.findIndex(contract => contract.id === contractId);
  if (contractIndex === -1) {
    return res.json({ success: false, message: 'Contract not found' });
  }
  
  const contract = contracts[contractIndex];
  
  // Update contract status to pending deposit
  contract.status = 'pending_deposit';
  contract.confirmedAt = new Date();
  contract.statusHistory.push({
    status: 'pending_deposit',
    timestamp: new Date(),
    note: 'Supplier confirmed contract, awaiting buyer deposit'
  });
  
  // Mark notifications as confirmed for this supplier
  contractNotifications.forEach(notif => {
    if (notif.contractId === contractId && notif.supplierEmail === supplierEmail) {
      notif.status = 'confirmed';
    }
  });
  
  console.log('✅ CONTRACT CONFIRMED BY SUPPLIER:', { 
    contractId, 
    supplierEmail,
    newStatus: 'pending_deposit'
  });
  
  res.json({
    success: true,
    message: 'Contract confirmed! Status changed to "Pending Deposit" - waiting for buyer payment.',
    contractId,
    newStatus: 'pending_deposit'
  });
});

app.post('/api/supplier/decline-contract', (req, res) => {
  const { contractId, supplierEmail } = req.body;
  
  // Mark notifications as declined for this supplier
  contractNotifications.forEach(notif => {
    if (notif.contractId === contractId && notif.supplierEmail === supplierEmail) {
      notif.status = 'declined';
    }
  });
  
  console.log('✅ CONTRACT DECLINED BY SUPPLIER:', { contractId, supplierEmail });
  
  res.json({
    success: true,
    message: 'Contract declined.',
    contractId
  });
});

// BUYER DEPOSIT PAYMENT ENDPOINT
app.post('/api/buyer/make-deposit', (req, res) => {
  const { contractId, buyerEmail } = req.body;
  
  // Find the contract
  const contractIndex = contracts.findIndex(contract => contract.id === contractId);
  if (contractIndex === -1) {
    return res.json({ success: false, message: 'Contract not found' });
  }
  
  const contract = contracts[contractIndex];
  
  if (contract.status !== 'pending_deposit') {
    return res.json({ success: false, message: 'Contract is not ready for deposit. Current status: ' + contract.status });
  }
  
  // Process deposit payment
  const depositAmount = contract.estimatedDeposit;
  
  // Update contract status to active
  contract.status = 'active';
  contract.depositPaidAt = new Date();
  contract.statusHistory.push({
    status: 'active',
    timestamp: new Date(),
    note: `Buyer paid deposit of ${depositAmount} TGT. Contract is now active.`
  });
  
  console.log('✅ DEPOSIT PAID BY BUYER:', { 
    contractId, 
    buyerEmail,
    depositAmount,
    newStatus: 'active'
  });
  
  res.json({
    success: true,
    message: `Deposit of ${depositAmount} TGT paid successfully! Contract is now Active.`,
    contractId,
    newStatus: 'active',
    depositAmount
  });
});

// DEBUG ENDPOINT TO CHECK CURRENT STATE
app.get('/api/debug/state', (req, res) => {
  res.json({
    contracts: contracts.length,
    notifications: contractNotifications.length,
    registeredUsers: Object.keys(registeredUsers).length,
    contractsData: contracts,
    notificationsData: contractNotifications,
    usersData: registeredUsers
  });
});

// GET SUPPLIER NOTIFICATIONS
app.get('/api/supplier/notifications/:email', (req, res) => {
  const { email } = req.params;
  
  // Get pending requests for this supplier
  const supplierNotifications = contractNotifications.filter(notif => 
    notif.supplierEmail === email && notif.status === 'unread'
  );
  
  res.json({
    success: true,
    notifications: supplierNotifications,
    pendingRequests: pendingRequests
  });
});

// ADMIN BUTTON ROUTES WITH TABLES
app.get('/admin/voyage-times', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voyage Times Management - Admin Panel</title>
  <style>
    body { font-family: system-ui; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
    .back-btn { background: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block; margin-bottom: 20px; }
    .header { background: #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #334155; }
    .header h1 { color: #2563eb; margin: 0; font-size: 2.5rem; }
    .table { background: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 15px; text-align: left; border-bottom: 1px solid #334155; }
    th { background: #0f172a; color: #06b6d4; font-weight: 600; }
    .btn { background: #2563eb; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 0.9rem; }
    .btn.edit { background: #f59e0b; }
  </style>
</head>
<body>
  <a href="/dashboard/admin" class="back-btn">← Back to Admin Dashboard</a>
  <div class="header">
    <h1>🚢 Voyage Times Management</h1>
    <p>Configure shipping routes and estimated delivery times</p>
  </div>
  <div class="table">
    <table>
      <thead>
        <tr>
          <th>Route ID</th>
          <th>From Port</th>
          <th>To Port</th>
          <th>Voyage Days</th>
          <th>Last Updated</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>RT-001</td>
          <td>Shanghai, China</td>
          <td>Los Angeles, USA</td>
          <td>14 days</td>
          <td>2025-01-15</td>
          <td><span style="background: #10b981; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">Active</span></td>
          <td><a href="#" class="btn edit">Edit Route</a></td>
        </tr>
        <tr>
          <td>RT-002</td>
          <td>Hamburg, Germany</td>
          <td>Santos, Brazil</td>
          <td>21 days</td>
          <td>2025-01-18</td>
          <td><span style="background: #10b981; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">Active</span></td>
          <td><a href="#" class="btn edit">Edit Route</a></td>
        </tr>
        <tr>
          <td>RT-003</td>
          <td>Singapore</td>
          <td>Dubai, UAE</td>
          <td>7 days</td>
          <td>2025-01-20</td>
          <td><span style="background: #10b981; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">Active</span></td>
          <td><a href="#" class="btn edit">Edit Route</a></td>
        </tr>
        <tr>
          <td>RT-004</td>
          <td>Mumbai, India</td>
          <td>London, UK</td>
          <td>18 days</td>
          <td>2025-01-22</td>
          <td><span style="background: #10b981; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">Active</span></td>
          <td><a href="#" class="btn edit">Edit Route</a></td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;
  res.send(html);
});

app.get('/admin/active-trades', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Active Trades - Admin Panel</title>
  <style>
    body { font-family: system-ui; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
    .back-btn { background: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block; margin-bottom: 20px; }
    .header { background: #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #334155; }
    .header h1 { color: #2563eb; margin: 0; font-size: 2.5rem; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .stat-card { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; text-align: center; }
    .stat-number { font-size: 2rem; font-weight: bold; color: #10b981; }
    .table { background: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 15px; text-align: left; border-bottom: 1px solid #334155; }
    th { background: #0f172a; color: #06b6d4; font-weight: 600; }
    .status-active { background: #10b981; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; }
    .status-pending { background: #f59e0b; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; }
    .btn { background: #2563eb; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 0.9rem; }
  </style>
</head>
<body>
  <a href="/dashboard/admin" class="back-btn">← Back to Admin Dashboard</a>
  <div class="header">
    <h1>📊 Active Trades Management</h1>
    <p>Monitor and manage all platform trading activity</p>
  </div>
  <div class="stats">
    <div class="stat-card">
      <div class="stat-number">12</div>
      <div>Active Contracts</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">5</div>
      <div>Pending Confirmation</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">$2.5M</div>
      <div>Total Value</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">7</div>
      <div>Completed Today</div>
    </div>
  </div>
  <div class="table">
    <table>
      <thead>
        <tr>
          <th>Contract ID</th>
          <th>Product</th>
          <th>Quantity</th>
          <th>Value</th>
          <th>Status</th>
          <th>Delivery</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>CT-001</td>
          <td>Wheat (ZW)</td>
          <td>500 tons</td>
          <td>$125,000</td>
          <td><span class="status-active">Active</span></td>
          <td>Jan 2025</td>
          <td><a href="#" class="btn">Manage</a></td>
        </tr>
        <tr>
          <td>CT-002</td>
          <td>Corn (ZC)</td>
          <td>300 tons</td>
          <td>$60,000</td>
          <td><span class="status-pending">Pending</span></td>
          <td>Feb 2025</td>
          <td><a href="#" class="btn">Review</a></td>
        </tr>
        <tr>
          <td>CT-003</td>
          <td>Soybeans (ZS)</td>
          <td>200 tons</td>
          <td>$90,000</td>
          <td><span class="status-active">Active</span></td>
          <td>Mar 2025</td>
          <td><a href="#" class="btn">Manage</a></td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;
  res.send(html);
});

// Admin sub-route for KYC reports
app.get('/admin/kyc-reports', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KYC Reports - Admin Panel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
    .back-btn { display: inline-block; background: rgba(255,255,255,0.2); color: white; padding: 8px 16px; border-radius: 20px; text-decoration: none; margin-bottom: 20px; transition: all 0.3s; }
    .back-btn:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }
    .header { text-align: center; color: white; margin-bottom: 30px; }
    .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
    .header p { font-size: 1.1rem; opacity: 0.9; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .stat-card { background: rgba(255,255,255,0.95); padding: 20px; border-radius: 15px; text-align: center; box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
    .stat-number { font-size: 2rem; font-weight: bold; color: #667eea; margin-bottom: 5px; }
    .stat-label { color: #666; font-size: 0.9rem; }
    .table { background: rgba(255,255,255,0.95); border-radius: 15px; overflow: hidden; box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
    table { width: 100%; border-collapse: collapse; }
    th { background: #667eea; color: white; padding: 15px; text-align: left; font-weight: 600; }
    td { padding: 12px 15px; border-bottom: 1px solid #eee; }
    tr:hover { background: #f8f9ff; }
    .status-approved { background: #10b981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; }
    .status-pending { background: #f59e0b; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; }
    .status-flagged { background: #ef4444; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; }
    .btn { background: #667eea; color: white; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 0.8rem; transition: all 0.3s; }
    .btn:hover { background: #5a67d8; transform: translateY(-1px); }
  </style>
</head>
<body>
  <a href="/dashboard/admin" class="back-btn">← Back to Admin Dashboard</a>
  
  <div class="header">
    <h1>📋 KYC Reports & Compliance</h1>
    <p>Review customer verification and compliance status</p>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-number">156</div>
      <div class="stat-label">Total Applications</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">142</div>
      <div class="stat-label">Approved</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">8</div>
      <div class="stat-label">Pending Review</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">6</div>
      <div class="stat-label">Flagged</div>
    </div>
  </div>

  <div class="table">
    <table>
      <thead>
        <tr>
          <th>User ID</th>
          <th>Company Name</th>
          <th>Type</th>
          <th>Submitted</th>
          <th>Status</th>
          <th>Risk Score</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>KYC-001</td>
          <td>AgriCorp Ltd</td>
          <td>Listed Company</td>
          <td>2025-01-15</td>
          <td><span class="status-approved">Approved</span></td>
          <td>Low</td>
          <td><a href="#" class="btn">View Report</a></td>
        </tr>
        <tr>
          <td>KYC-002</td>
          <td>Global Traders Inc</td>
          <td>Private Company</td>
          <td>2025-01-14</td>
          <td><span class="status-pending">Pending</span></td>
          <td>Medium</td>
          <td><a href="#" class="btn">Review</a></td>
        </tr>
        <tr>
          <td>KYC-003</td>
          <td>Commodity Solutions</td>
          <td>Private Company</td>
          <td>2025-01-13</td>
          <td><span class="status-flagged">Flagged</span></td>
          <td>High</td>
          <td><a href="#" class="btn">Investigate</a></td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;
  res.send(html);
});

// Admin sub-route for review queue
app.get('/admin/review-queue', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Review Queue - Admin Panel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
    .back-btn { display: inline-block; background: rgba(255,255,255,0.2); color: white; padding: 8px 16px; border-radius: 20px; text-decoration: none; margin-bottom: 20px; transition: all 0.3s; }
    .back-btn:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }
    .header { text-align: center; color: white; margin-bottom: 30px; }
    .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
    .header p { font-size: 1.1rem; opacity: 0.9; }
    .priority-high { border-left: 5px solid #ef4444; }
    .priority-medium { border-left: 5px solid #f59e0b; }
    .priority-low { border-left: 5px solid #10b981; }
    .table { background: rgba(255,255,255,0.95); border-radius: 15px; overflow: hidden; box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
    table { width: 100%; border-collapse: collapse; }
    th { background: #667eea; color: white; padding: 15px; text-align: left; font-weight: 600; }
    td { padding: 12px 15px; border-bottom: 1px solid #eee; }
    tr:hover { background: #f8f9ff; }
    .btn { background: #667eea; color: white; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 0.8rem; transition: all 0.3s; margin-right: 5px; }
    .btn:hover { background: #5a67d8; transform: translateY(-1px); }
    .btn.approve { background: #10b981; }
    .btn.reject { background: #ef4444; }
  </style>
</head>
<body>
  <a href="/dashboard/admin" class="back-btn">← Back to Admin Dashboard</a>
  
  <div class="header">
    <h1>⏳ Review Queue</h1>
    <p>Items requiring administrative review and approval</p>
  </div>

  <div class="table">
    <table>
      <thead>
        <tr>
          <th>Item Type</th>
          <th>Description</th>
          <th>Submitted By</th>
          <th>Date</th>
          <th>Priority</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr class="priority-high">
          <td>KYC Application</td>
          <td>Global Traders Inc - High Risk Flag</td>
          <td>system@auto</td>
          <td>2025-01-16</td>
          <td>High</td>
          <td>
            <a href="#" class="btn approve">Approve</a>
            <a href="#" class="btn reject">Reject</a>
            <a href="#" class="btn">Details</a>
          </td>
        </tr>
        <tr class="priority-medium">
          <td>Contract Dispute</td>
          <td>CT-002 - Delivery Date Conflict</td>
          <td>buyer@example.com</td>
          <td>2025-01-15</td>
          <td>Medium</td>
          <td>
            <a href="#" class="btn">Mediate</a>
            <a href="#" class="btn">Details</a>
          </td>
        </tr>
        <tr class="priority-low">
          <td>Price Validation</td>
          <td>Wheat contract exceeds 10% variance</td>
          <td>supplier@agri.com</td>
          <td>2025-01-14</td>
          <td>Low</td>
          <td>
            <a href="#" class="btn approve">Approve</a>
            <a href="#" class="btn">Review</a>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;
  res.send(html);
});

// Admin sub-route for flags
app.get('/admin/flags', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Review Flags - Admin Panel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
    .back-btn { display: inline-block; background: rgba(255,255,255,0.2); color: white; padding: 8px 16px; border-radius: 20px; text-decoration: none; margin-bottom: 20px; transition: all 0.3s; }
    .back-btn:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }
    .header { text-align: center; color: white; margin-bottom: 30px; }
    .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
    .header p { font-size: 1.1rem; opacity: 0.9; }
    .flag-critical { background: rgba(239, 68, 68, 0.1); border-left: 5px solid #ef4444; }
    .flag-warning { background: rgba(245, 158, 11, 0.1); border-left: 5px solid #f59e0b; }
    .flag-info { background: rgba(59, 130, 246, 0.1); border-left: 5px solid #3b82f6; }
    .table { background: rgba(255,255,255,0.95); border-radius: 15px; overflow: hidden; box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
    table { width: 100%; border-collapse: collapse; }
    th { background: #667eea; color: white; padding: 15px; text-align: left; font-weight: 600; }
    td { padding: 12px 15px; border-bottom: 1px solid #eee; }
    tr:hover { background: #f8f9ff; }
    .flag-type { padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; }
    .flag-aml { background: #ef4444; color: white; }
    .flag-credit { background: #f59e0b; color: white; }
    .flag-price { background: #3b82f6; color: white; }
    .btn { background: #667eea; color: white; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 0.8rem; transition: all 0.3s; margin-right: 5px; }
    .btn:hover { background: #5a67d8; transform: translateY(-1px); }
  </style>
</head>
<body>
  <a href="/dashboard/admin" class="back-btn">← Back to Admin Dashboard</a>
  
  <div class="header">
    <h1>🚩 System Flags & Alerts</h1>
    <p>Automated compliance and risk detection alerts</p>
  </div>

  <div class="table">
    <table>
      <thead>
        <tr>
          <th>Flag Type</th>
          <th>Entity</th>
          <th>Description</th>
          <th>Severity</th>
          <th>Date</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr class="flag-critical">
          <td><span class="flag-type flag-aml">AML</span></td>
          <td>Global Traders Inc</td>
          <td>High-risk jurisdiction match detected</td>
          <td>Critical</td>
          <td>2025-01-16</td>
          <td>
            <a href="#" class="btn">Investigate</a>
            <a href="#" class="btn">Report</a>
          </td>
        </tr>
        <tr class="flag-warning">
          <td><span class="flag-type flag-credit">Credit</span></td>
          <td>AgriCorp Ltd</td>
          <td>Credit score below threshold (650)</td>
          <td>Warning</td>
          <td>2025-01-15</td>
          <td>
            <a href="#" class="btn">Review</a>
            <a href="#" class="btn">Override</a>
          </td>
        </tr>
        <tr class="flag-info">
          <td><span class="flag-type flag-price">Price</span></td>
          <td>CT-001</td>
          <td>Price deviation 12% above market rate</td>
          <td>Info</td>
          <td>2025-01-14</td>
          <td>
            <a href="#" class="btn">Approve</a>
            <a href="#" class="btn">Reject</a>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;
  res.send(html);
});

// Admin sub-route for auction board
app.get('/admin/auction-board', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auction Board - Admin Panel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
    .back-btn { display: inline-block; background: rgba(255,255,255,0.2); color: white; padding: 8px 16px; border-radius: 20px; text-decoration: none; margin-bottom: 20px; transition: all 0.3s; }
    .back-btn:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }
    .header { text-align: center; color: white; margin-bottom: 30px; }
    .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
    .header p { font-size: 1.1rem; opacity: 0.9; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .stat-card { background: rgba(255,255,255,0.95); padding: 20px; border-radius: 15px; text-align: center; box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
    .stat-number { font-size: 2rem; font-weight: bold; color: #667eea; margin-bottom: 5px; }
    .stat-label { color: #666; font-size: 0.9rem; }
    .table { background: rgba(255,255,255,0.95); border-radius: 15px; overflow: hidden; box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
    table { width: 100%; border-collapse: collapse; }
    th { background: #667eea; color: white; padding: 15px; text-align: left; font-weight: 600; }
    td { padding: 12px 15px; border-bottom: 1px solid #eee; }
    tr:hover { background: #f8f9ff; }
    .status-live { background: #ef4444; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; animation: pulse 2s infinite; }
    .status-upcoming { background: #f59e0b; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; }
    .status-closed { background: #6b7280; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
    .btn { background: #667eea; color: white; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 0.8rem; transition: all 0.3s; margin-right: 5px; }
    .btn:hover { background: #5a67d8; transform: translateY(-1px); }
  </style>
</head>
<body>
  <a href="/dashboard/admin" class="back-btn">← Back to Admin Dashboard</a>
  
  <div class="header">
    <h1>🏛️ Auction Board Management</h1>
    <p>Monitor and manage overdue contract auctions</p>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-number">3</div>
      <div class="stat-label">Live Auctions</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">7</div>
      <div class="stat-label">Upcoming</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">$450K</div>
      <div class="stat-label">Total Value</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">12</div>
      <div class="stat-label">Active Bidders</div>
    </div>
  </div>

  <div class="table">
    <table>
      <thead>
        <tr>
          <th>Auction ID</th>
          <th>Original Contract</th>
          <th>Product</th>
          <th>Starting Bid</th>
          <th>Current Bid</th>
          <th>Status</th>
          <th>Ends</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>AU-001</td>
          <td>CT-005</td>
          <td>Wheat (ZW) - 300 tons</td>
          <td>$75,000</td>
          <td>$82,500</td>
          <td><span class="status-live">Live</span></td>
          <td>2h 15m</td>
          <td>
            <a href="#" class="btn">Monitor</a>
            <a href="#" class="btn">Extend</a>
          </td>
        </tr>
        <tr>
          <td>AU-002</td>
          <td>CT-007</td>
          <td>Corn (ZC) - 500 tons</td>
          <td>$120,000</td>
          <td>$125,000</td>
          <td><span class="status-live">Live</span></td>
          <td>45m</td>
          <td>
            <a href="#" class="btn">Monitor</a>
            <a href="#" class="btn">Close</a>
          </td>
        </tr>
        <tr>
          <td>AU-003</td>
          <td>CT-009</td>
          <td>Soybeans (ZS) - 200 tons</td>
          <td>$48,000</td>
          <td>No bids</td>
          <td><span class="status-upcoming">Starts 1h</span></td>
          <td>Tomorrow</td>
          <td>
            <a href="#" class="btn">Preview</a>
            <a href="#" class="btn">Cancel</a>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;
  res.send(html);
});

// Admin sub-route for basis points
app.get('/admin/basis-points', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Basis Points Management - Admin Panel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
    .back-btn { display: inline-block; background: rgba(255,255,255,0.2); color: white; padding: 8px 16px; border-radius: 20px; text-decoration: none; margin-bottom: 20px; transition: all 0.3s; }
    .back-btn:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }
    .header { text-align: center; color: white; margin-bottom: 30px; }
    .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
    .header p { font-size: 1.1rem; opacity: 0.9; }
    .table { background: rgba(255,255,255,0.95); border-radius: 15px; overflow: hidden; box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
    table { width: 100%; border-collapse: collapse; }
    th { background: #667eea; color: white; padding: 15px; text-align: left; font-weight: 600; }
    td { padding: 12px 15px; border-bottom: 1px solid #eee; }
    tr:hover { background: #f8f9ff; }
    .btn { background: #667eea; color: white; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 0.8rem; transition: all 0.3s; margin-right: 5px; }
    .btn:hover { background: #5a67d8; transform: translateY(-1px); }
    .btn.edit { background: #f59e0b; }
    .positive { color: #10b981; font-weight: 600; }
    .negative { color: #ef4444; font-weight: 600; }
  </style>
</head>
<body>
  <a href="/dashboard/admin" class="back-btn">← Back to Admin Dashboard</a>
  
  <div class="header">
    <h1>📈 Basis Points Management</h1>
    <p>Configure commodity pricing basis points and regional adjustments</p>
  </div>

  <div class="table">
    <table>
      <thead>
        <tr>
          <th>Commodity</th>
          <th>Exchange Symbol</th>
          <th>Current Basis</th>
          <th>Regional Adjustment</th>
          <th>Last Updated</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Wheat</td>
          <td>ZW</td>
          <td class="positive">+25 basis points</td>
          <td class="positive">+$0.15/bushel</td>
          <td>2025-01-16 09:30</td>
          <td>
            <a href="#" class="btn edit">Edit</a>
            <a href="#" class="btn">History</a>
          </td>
        </tr>
        <tr>
          <td>Corn</td>
          <td>ZC</td>
          <td class="negative">-15 basis points</td>
          <td class="negative">-$0.08/bushel</td>
          <td>2025-01-16 08:45</td>
          <td>
            <a href="#" class="btn edit">Edit</a>
            <a href="#" class="btn">History</a>
          </td>
        </tr>
        <tr>
          <td>Soybeans</td>
          <td>ZS</td>
          <td class="positive">+40 basis points</td>
          <td class="positive">+$0.22/bushel</td>
          <td>2025-01-16 10:15</td>
          <td>
            <a href="#" class="btn edit">Edit</a>
            <a href="#" class="btn">History</a>
          </td>
        </tr>
        <tr>
          <td>Rice</td>
          <td>ZR</td>
          <td class="positive">+10 basis points</td>
          <td class="positive">+$0.05/cwt</td>
          <td>2025-01-15 16:20</td>
          <td>
            <a href="#" class="btn edit">Edit</a>
            <a href="#" class="btn">History</a>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;
  res.send(html);
});

const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';

console.log('🚀 Starting Tangent Ultimate Clean Platform...');

const server = app.listen(PORT, HOST, (err) => {
  if (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
  console.log(`✅ TANGENT ULTIMATE CLEAN PLATFORM RUNNING ON PORT ${PORT}`);
  console.log(`🌐 Landing Page: http://${HOST}:${PORT}/`);
  console.log(`👥 Team Portal: http://${HOST}:${PORT}/landing-two`);
  console.log(`⚙️ Admin Dashboard: http://${HOST}:${PORT}/dashboard/admin`);
  console.log(`🛒 Buyer Dashboard: http://${HOST}:${PORT}/dashboard/buyer`);
  console.log(`🚚 Supplier Dashboard: http://${HOST}:${PORT}/dashboard/supplier`);
  console.log(`⚡ Trader Dashboard: http://${HOST}:${PORT}/dashboard/trader`);
  console.log(`🛡️ Insurer Dashboard: http://${HOST}:${PORT}/dashboard/insurer`);
  console.log(`📊 Health Check: http://${HOST}:${PORT}/health`);
  console.log('🎉 ALL DASHBOARDS RESTORED - CLEAN VERSION!');
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
});
