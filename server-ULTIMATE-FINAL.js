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

// JWT Authentication System
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'tangent-protocol-secret-key-2024';

// Demo users for testing (in production, load from database)
const demoUsers = [
  { email: 'admin@tangent-protocol.com', password: 'admin123', role: 'admin', company: 'Tangent Protocol' },
  { email: 'supplier@example.com', password: 'supplier123', role: 'supplier', company: 'Sample Trading LLC' },
  { email: 'buyer@example.com', password: 'buyer123', role: 'buyer', company: 'Global Trading Corp' },
  { email: 'trader@example.com', password: 'trader123', role: 'trader', company: 'Strategic Trading Partners' },
  { email: 'insurer@example.com', password: 'insurer123', role: 'insurer', company: 'Global Insurance Partners' }
];

// Initialize demo users with hashed passwords
async function initializeDemoUsers() {
  for (const user of demoUsers) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    users.set(user.email, {
      ...user,
      password: hashedPassword,
      id: user.email.split('@')[0],
      createdAt: new Date(),
      isVerified: true
    });
  }
  console.log('✅ Demo users initialized');
}

// JWT Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Role-based access control middleware
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userRoles = Array.isArray(roles) ? roles : [roles];
    if (!userRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

// Authentication Routes
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }
    
    const user = users.get(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        email: user.email, 
        role: user.role, 
        company: user.company,
        id: user.id 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('✅ User logged in:', email, 'Role:', user.role);
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        email: user.email,
        role: user.role,
        company: user.company,
        id: user.id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, company, role, phone } = req.body;
    
    if (!email || !password || !firstName || !lastName || !company || !role) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }
    
    if (users.has(email)) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      company,
      role,
      phone,
      id: email.split('@')[0],
      createdAt: new Date(),
      isVerified: false // Will be verified after KYC
    };
    
    users.set(email, newUser);
    
    console.log('✅ User registered:', email, 'Role:', role);
    
    res.json({
      success: true,
      message: 'Registration successful',
      redirectTo: `/kyc?email=${encodeURIComponent(email)}&role=${role}`
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

app.post('/auth/logout', (req, res) => {
  // In a production app, you might want to blacklist the token
  res.json({ success: true, message: 'Logged out successfully' });
});

// Protected route for getting user profile
app.get('/auth/profile', authenticateToken, (req, res) => {
  const user = users.get(req.user.email);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    company: user.company,
    role: user.role,
    phone: user.phone,
    isVerified: user.isVerified
  });
});

// Initialize demo users on startup
initializeDemoUsers();

// Helper functions for compliance checking and notifications
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

// Email notification system (simulated - replace with real email service)
function sendEmail(to, subject, message, type = 'info') {
  const emailLog = {
    timestamp: new Date().toISOString(),
    to,
    subject,
    message,
    type,
    status: 'sent'
  };
  
  console.log(`📧 EMAIL SENT [${type.toUpperCase()}]:`, emailLog);
  
  // In production, integrate with SendGrid, AWS SES, or similar
  return Promise.resolve(emailLog);
}

// Wallet creation system
function createTGTWallet(userEmail) {
  // Simulate wallet creation with blockchain integration
  const walletAddress = '0x' + Math.random().toString(16).substring(2, 42).padStart(40, '0');
  const walletInfo = {
    address: walletAddress,
    balance: 0,
    created: new Date(),
    email: userEmail,
    type: 'TGT_WALLET'
  };
  
  // Store wallet info
  users.set(userEmail + '_wallet', walletInfo);
  
  console.log('💰 WALLET CREATED:', walletInfo);
  return walletInfo;
}

// TGT Pool management
const tgtPool = {
  totalBalance: 1000000, // Starting with 1M TGT
  deposits: new Map(),
  withdrawals: new Map(),
  
  deposit(amount, from, contractId) {
    const depositId = 'DEP-' + Date.now();
    const deposit = {
      id: depositId,
      amount,
      from,
      contractId,
      timestamp: new Date(),
      status: 'confirmed'
    };
    
    this.deposits.set(depositId, deposit);
    this.totalBalance += amount;
    
    console.log('💰 TGT POOL DEPOSIT:', deposit);
    return deposit;
  },
  
  withdraw(amount, to, contractId) {
    if (this.totalBalance < amount) {
      throw new Error('Insufficient funds in TGT pool');
    }
    
    const withdrawalId = 'WITH-' + Date.now();
    const withdrawal = {
      id: withdrawalId,
      amount,
      to,
      contractId,
      timestamp: new Date(),
      status: 'confirmed'
    };
    
    this.withdrawals.set(withdrawalId, withdrawal);
    this.totalBalance -= amount;
    
    console.log('💸 TGT POOL WITHDRAWAL:', withdrawal);
    return withdrawal;
  }
};

// ADMIN MANAGEMENT SYSTEM
app.post('/api/admin/update-settings', (req, res) => {
  try {
    const { platformFee, dailyInterest, insuranceRate, voyageTime, basisPoints } = req.body;
    
    if (platformFee !== undefined) platformSettings.platformFee = platformFee;
    if (dailyInterest !== undefined) platformSettings.dailyInterest = dailyInterest;
    if (insuranceRate !== undefined) platformSettings.insuranceRate = insuranceRate;
    if (voyageTime !== undefined) platformSettings.voyageTime = voyageTime;
    if (basisPoints !== undefined) platformSettings.basisPoints = basisPoints;
    
    console.log('⚙️ ADMIN SETTINGS UPDATED:', platformSettings);
    
    res.json({ 
      success: true, 
      message: 'Settings updated successfully',
      settings: platformSettings
    });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/dashboard-data', (req, res) => {
  try {
    // Calculate active trades
    const activeTrades = Array.from(contracts.values()).filter(c => 
      c.status === 'confirmed' || c.status === 'pending_confirmation'
    );
    
    // Get flagged KYC applications
    const flaggedKYC = Array.from(kycApplications.values()).filter(k => 
      k.status === 'flagged'
    );
    
    // Get price-flagged contracts
    const priceFlaggedContracts = Array.from(contracts.values()).filter(c => 
      c.priceFlags && c.priceFlags.length > 0
    );
    
    // Get active auctions
    const activeAuctions = Array.from(auctions.values()).filter(a => 
      a.status === 'active'
    );
    
    // Calculate total pool balance and fees collected
    const totalFeesCollected = Array.from(contracts.values())
      .filter(c => c.fees)
      .reduce((sum, c) => sum + c.fees.total, 0);
    
    const dashboardData = {
      activeTrades: activeTrades.length,
      flaggedKYC: flaggedKYC.length,
      priceFlaggedContracts: priceFlaggedContracts.length,
      activeAuctions: activeAuctions.length,
      tgtPoolBalance: tgtPool.totalBalance,
      totalFeesCollected,
      platformSettings,
      recentActivity: {
        flaggedKYCApplications: flaggedKYC.slice(0, 5),
        priceFlaggedContracts: priceFlaggedContracts.slice(0, 5),
        activeAuctions: activeAuctions.slice(0, 5)
      }
    };
    
    res.json(dashboardData);
  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/approve-kyc', async (req, res) => {
  try {
    const { kycId } = req.body;
    
    const kycApplication = kycApplications.get(kycId);
    if (!kycApplication) {
      return res.status(404).json({ success: false, message: 'KYC application not found' });
    }
    
    // Update KYC status
    kycApplication.status = 'approved';
    kycApplication.reviewedAt = new Date();
    
    // Create wallet for approved user
    const wallet = createTGTWallet(kycApplication.email);
    
    // Send approval email
    await sendEmail(
      kycApplication.email,
      'KYC Approved - Welcome to Tangent Protocol',
      `Your KYC application has been manually approved by admin. Your TGT wallet: ${wallet.address}`,
      'success'
    );
    
    console.log('✅ ADMIN KYC APPROVAL:', kycId);
    
    res.json({ 
      success: true, 
      message: 'KYC approved successfully',
      walletAddress: wallet.address
    });
  } catch (error) {
    console.error('KYC approval error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// TRADER DUAL CONTRACT SYSTEM
app.post('/api/create-dual-contract', async (req, res) => {
  try {
    const { 
      traderEmail,
      buyContractData,  // {supplierEmail, productType, quantity, pricePerUnit, deliveryDate}
      sellContractData, // {buyerEmail, productType, quantity, pricePerUnit, deliveryDate}
      tradeMargin
    } = req.body;
    
    // Create buy contract (trader as buyer)
    const buyContract = {
      id: 'BUY-CONTRACT-' + Date.now(),
      supplierEmail: buyContractData.supplierEmail,
      buyerEmail: traderEmail,
      productType: buyContractData.productType,
      quantity: buyContractData.quantity,
      pricePerUnit: buyContractData.pricePerUnit,
      totalValue: buyContractData.quantity * buyContractData.pricePerUnit,
      deliveryDate: buyContractData.deliveryDate,
      createdBy: 'trader',
      status: 'pending_confirmation',
      createdAt: new Date(),
      contractType: 'buy',
      linkedContractId: null // Will be set after sell contract creation
    };
    
    // Create sell contract (trader as supplier)
    const sellContract = {
      id: 'SELL-CONTRACT-' + Date.now(),
      supplierEmail: traderEmail,
      buyerEmail: sellContractData.buyerEmail,
      productType: sellContractData.productType,
      quantity: sellContractData.quantity,
      pricePerUnit: sellContractData.pricePerUnit,
      totalValue: sellContractData.quantity * sellContractData.pricePerUnit,
      deliveryDate: sellContractData.deliveryDate,
      createdBy: 'trader',
      status: 'pending_confirmation',
      createdAt: new Date(),
      contractType: 'sell',
      linkedContractId: buyContract.id
    };
    
    // Link contracts
    buyContract.linkedContractId = sellContract.id;
    
    // Calculate profit margin
    const profit = sellContract.totalValue - buyContract.totalValue;
    const tradeData = {
      traderEmail,
      buyContractId: buyContract.id,
      sellContractId: sellContract.id,
      expectedProfit: profit,
      margin: tradeMargin,
      status: 'pending'
    };
    
    // Store contracts
    contracts.set(buyContract.id, buyContract);
    contracts.set(sellContract.id, sellContract);
    
    // Send confirmation emails
    await sendEmail(
      buyContractData.supplierEmail,
      'Contract Confirmation Required',
      `Trader has created a buy contract (${buyContract.id}). Please confirm.`,
      'action'
    );
    
    await sendEmail(
      sellContractData.buyerEmail,
      'Contract Confirmation Required',
      `Trader has created a sell contract (${sellContract.id}). Please confirm.`,
      'action'
    );
    
    console.log('🔄 DUAL CONTRACT CREATED:', tradeData);
    
    res.json({ 
      success: true, 
      message: 'Dual contracts created successfully',
      buyContractId: buyContract.id,
      sellContractId: sellContract.id,
      expectedProfit: profit
    });
  } catch (error) {
    console.error('Dual contract creation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

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
          // Store JWT token in localStorage
          localStorage.setItem('authToken', data.token);
          localStorage.setItem('userRole', data.user.role);
          localStorage.setItem('userEmail', data.user.email);
          localStorage.setItem('userCompany', data.user.company);
          
          successDiv.textContent = 'Login successful! Redirecting to your dashboard...';
          setTimeout(() => {
            // Redirect based on user role
            switch(data.user.role) {
              case 'admin':
                window.location.href = '/dashboard/admin';
                break;
              case 'supplier':
                window.location.href = '/dashboard/supplier';
                break;
              case 'buyer':
                window.location.href = '/dashboard/buyer';
                break;
              case 'trader':
                window.location.href = '/dashboard/trader';
                break;
              case 'insurer':
                window.location.href = '/dashboard/insurer';
                break;
              default:
                window.location.href = '/landing-two';
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
    
    // Send email notifications
    if (complianceResult.finalStatus === 'flagged') {
      await sendEmail(
        'admin@tangent-protocol.com',
        'KYC Application Flagged',
        `KYC Application ${kycId} for ${email} has been flagged and requires manual review. Flags: ${complianceResult.flags.join(', ')}`,
        'warning'
      );
      
      await sendEmail(
        email,
        'KYC Application Under Review',
        'Your KYC application is currently under review. You will receive an email within 48 hours with the results.',
        'info'
      );
    } else {
      // Auto-approve - create wallet and send confirmation
      const wallet = createTGTWallet(email);
      
      await sendEmail(
        email,
        'KYC Approved - Welcome to Tangent Protocol',
        `Congratulations! Your KYC has been approved. Your TGT wallet has been created: ${wallet.address}`,
        'success'
      );
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

// CONTRACT MANAGEMENT SYSTEM
app.post('/api/create-contract', async (req, res) => {
  try {
    const { 
      supplierEmail, 
      buyerEmail, 
      productType, 
      quantity, 
      pricePerUnit, 
      totalValue, 
      deliveryDate, 
      role // 'supplier' or 'buyer'
    } = req.body;
    
    // Validate price against exchanges (simulate)
    const marketPrice = await validateMarketPrice(productType, pricePerUnit);
    const priceFlags = [];
    
    if (marketPrice.discrepancy > platformSettings.basisPoints || 5) { // Default 5% if not set
      priceFlags.push(`Price discrepancy: ${marketPrice.discrepancy}% above market`);
    }
    
    const contractId = 'CONTRACT-' + Date.now();
    const contract = {
      id: contractId,
      supplierEmail,
      buyerEmail,
      productType,
      quantity,
      pricePerUnit,
      totalValue,
      deliveryDate,
      createdBy: role,
      status: 'pending_confirmation',
      priceValidation: marketPrice,
      priceFlags,
      createdAt: new Date(),
      depositStatus: 'pending',
      documentsUploaded: false,
      paymentReleased: false
    };
    
    contracts.set(contractId, contract);
    
    // Send email to counterparty for confirmation
    const counterpartyEmail = role === 'supplier' ? buyerEmail : supplierEmail;
    const counterpartyRole = role === 'supplier' ? 'buyer' : 'supplier';
    
    await sendEmail(
      counterpartyEmail,
      'Contract Confirmation Required',
      `A new contract (${contractId}) has been created and requires your confirmation. Please log in to review and confirm.`,
      'action'
    );
    
    // Notify admin if price flags exist
    if (priceFlags.length > 0) {
      await sendEmail(
        'admin@tangent-protocol.com',
        'Contract Price Alert',
        `Contract ${contractId} has price discrepancies: ${priceFlags.join(', ')}`,
        'warning'
      );
    }
    
    console.log('📋 CONTRACT CREATED:', contract);
    
    res.json({ 
      success: true, 
      contractId, 
      status: contract.status,
      priceFlags,
      message: 'Contract created successfully. Waiting for confirmation.'
    });
  } catch (error) {
    console.error('Contract creation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/confirm-contract', async (req, res) => {
  try {
    const { contractId, userEmail, role } = req.body;
    
    const contract = contracts.get(contractId);
    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }
    
    // Verify user is authorized to confirm this contract
    const isAuthorized = (role === 'buyer' && contract.buyerEmail === userEmail) || 
                        (role === 'supplier' && contract.supplierEmail === userEmail);
    
    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Not authorized to confirm this contract' });
    }
    
    // Update contract status
    contract.status = 'confirmed';
    contract.confirmedAt = new Date();
    contract.confirmedBy = userEmail;
    
    // Enable deposit for supplier-initiated contracts
    if (contract.createdBy === 'supplier') {
      contract.depositStatus = 'available';
      
      // Notify buyer about deposit requirement
      await sendEmail(
        contract.buyerEmail,
        'Contract Confirmed - Deposit Required',
        `Contract ${contractId} has been confirmed. Please make your deposit to proceed.`,
        'action'
      );
    }
    
    console.log('✅ CONTRACT CONFIRMED:', contract);
    
    res.json({ 
      success: true, 
      message: 'Contract confirmed successfully',
      contract: {
        id: contract.id,
        status: contract.status,
        depositStatus: contract.depositStatus
      }
    });
  } catch (error) {
    console.error('Contract confirmation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/make-deposit', async (req, res) => {
  try {
    const { contractId, userEmail, amount } = req.body;
    
    const contract = contracts.get(contractId);
    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }
    
    if (contract.totalValue !== amount) {
      return res.status(400).json({ 
        success: false, 
        message: `Deposit amount must equal contract value: ${contract.totalValue}` 
      });
    }
    
    // Process deposit to TGT pool
    const deposit = tgtPool.deposit(amount, userEmail, contractId);
    
    // Update contract
    contract.depositStatus = 'completed';
    contract.depositedAt = new Date();
    contract.depositId = deposit.id;
    
    // Notify supplier about completed deposit
    await sendEmail(
      contract.supplierEmail,
      'Deposit Received - Upload Documents',
      `Deposit for contract ${contractId} has been received. Please upload shipping documents to proceed.`,
      'action'
    );
    
    console.log('💰 DEPOSIT COMPLETED:', { contractId, deposit });
    
    res.json({ 
      success: true, 
      message: 'Deposit completed successfully',
      depositId: deposit.id
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// CONTRACT DOCUMENT UPLOAD
app.post('/api/upload-contract-documents', upload.array('documents', 10), async (req, res) => {
  try {
    const { contractId, userEmail } = req.body;
    
    const contract = contracts.get(contractId);
    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }
    
    // Verify user is supplier
    if (contract.supplierEmail !== userEmail) {
      return res.status(403).json({ success: false, message: 'Only supplier can upload documents' });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No documents uploaded' });
    }
    
    // Store document paths
    const documentPaths = req.files.map(file => ({
      originalName: file.originalname,
      fileName: file.filename,
      filePath: file.path,
      uploadedAt: new Date()
    }));
    
    // Update contract
    contract.documentsUploaded = true;
    contract.documentPaths = documentPaths;
    contract.documentsUploadedAt = new Date();
    
    // Start countdown timer based on voyage time
    const voyageTime = platformSettings.voyageTime || 30; // Default 30 days
    contract.paymentDeadline = new Date(Date.now() + voyageTime * 24 * 60 * 60 * 1000);
    
    // Notify buyer about document upload
    await sendEmail(
      contract.buyerEmail,
      'Documents Uploaded - Payment Required',
      `Shipping documents for contract ${contractId} have been uploaded. Payment deadline: ${contract.paymentDeadline.toDateString()}`,
      'action'
    );
    
    console.log('📄 CONTRACT DOCUMENTS UPLOADED:', { contractId, documentCount: documentPaths.length });
    
    res.json({ 
      success: true, 
      message: 'Documents uploaded successfully',
      documentCount: documentPaths.length,
      paymentDeadline: contract.paymentDeadline
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PAYMENT RELEASE SYSTEM
app.post('/api/release-payment', async (req, res) => {
  try {
    const { contractId, userEmail, role } = req.body;
    
    const contract = contracts.get(contractId);
    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }
    
    // Verify authorization (buyer, trader, or admin can release payment)
    const isAuthorized = (role === 'buyer' && contract.buyerEmail === userEmail) ||
                        (role === 'trader') || // Traders can release for both sides
                        (role === 'admin');
    
    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Not authorized to release payment' });
    }
    
    if (contract.paymentReleased) {
      return res.status(400).json({ success: false, message: 'Payment already released' });
    }
    
    if (!contract.documentsUploaded) {
      return res.status(400).json({ success: false, message: 'Documents must be uploaded first' });
    }
    
    // Calculate fees and final amount
    const platformFee = contract.totalValue * (platformSettings.platformFee / 100);
    const insuranceFee = contract.totalValue * (platformSettings.insuranceRate / 100);
    
    // Calculate daily interest if payment is late
    let interestFee = 0;
    if (new Date() > contract.paymentDeadline) {
      const daysLate = Math.ceil((new Date() - contract.paymentDeadline) / (1000 * 60 * 60 * 24));
      interestFee = contract.totalValue * (platformSettings.dailyInterest / 100) * daysLate;
    }
    
    const totalFees = platformFee + insuranceFee + interestFee;
    const finalAmount = contract.totalValue - totalFees;
    
    // Process withdrawal from TGT pool to supplier
    const withdrawal = tgtPool.withdraw(finalAmount, contract.supplierEmail, contractId);
    
    // Update contract
    contract.paymentReleased = true;
    contract.paymentReleasedAt = new Date();
    contract.finalAmount = finalAmount;
    contract.fees = {
      platform: platformFee,
      insurance: insuranceFee,
      interest: interestFee,
      total: totalFees
    };
    contract.withdrawalId = withdrawal.id;
    contract.status = 'completed';
    
    // Send notifications
    await sendEmail(
      contract.supplierEmail,
      'Payment Released',
      `Payment for contract ${contractId} has been released. Amount: $${finalAmount.toFixed(2)} (after fees: $${totalFees.toFixed(2)})`,
      'success'
    );
    
    await sendEmail(
      contract.buyerEmail,
      'Contract Completed',
      `Contract ${contractId} has been completed. Payment has been released to supplier.`,
      'info'
    );
    
    console.log('💸 PAYMENT RELEASED:', { contractId, finalAmount, totalFees });
    
    res.json({ 
      success: true, 
      message: 'Payment released successfully',
      finalAmount,
      fees: contract.fees,
      withdrawalId: withdrawal.id
    });
  } catch (error) {
    console.error('Payment release error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// COUNTDOWN TIMER AND AUCTION TRIGGER
app.get('/api/check-overdue-contracts', (req, res) => {
  const overdueContracts = [];
  const now = new Date();
  
  for (const [contractId, contract] of contracts) {
    if (contract.documentsUploaded && 
        !contract.paymentReleased && 
        contract.paymentDeadline && 
        now > contract.paymentDeadline) {
      
      overdueContracts.push({
        id: contractId,
        daysOverdue: Math.ceil((now - contract.paymentDeadline) / (1000 * 60 * 60 * 24)),
        totalValue: contract.totalValue,
        supplierEmail: contract.supplierEmail,
        buyerEmail: contract.buyerEmail
      });
      
      // Auto-trigger auction if more than 7 days overdue
      if (!contract.auctionTriggered && 
          now > new Date(contract.paymentDeadline.getTime() + 7 * 24 * 60 * 60 * 1000)) {
        
        triggerAuction(contractId, contract);
        contract.auctionTriggered = true;
      }
    }
  }
  
  res.json({ overdueContracts, count: overdueContracts.length });
});

// AUCTION SYSTEM
function triggerAuction(contractId, contract) {
  const auctionId = 'AUCTION-' + Date.now();
  const auction = {
    id: auctionId,
    contractId,
    startingPrice: contract.totalValue,
    currentBid: contract.totalValue,
    bidders: new Map(),
    status: 'active',
    startTime: new Date(),
    endTime: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
    originalContract: contract
  };
  
  auctions.set(auctionId, auction);
  
  console.log('🏺 AUCTION TRIGGERED:', auctionId);
  
  // Notify all relevant parties
  sendEmail(
    'admin@tangent-protocol.com',
    'Contract Auction Triggered',
    `Contract ${contractId} has been moved to auction due to non-payment. Auction ID: ${auctionId}`,
    'warning'
  );
}

app.post('/api/place-bid', async (req, res) => {
  try {
    const { auctionId, bidderEmail, bidAmount } = req.body;
    
    const auction = auctions.get(auctionId);
    if (!auction) {
      return res.status(404).json({ success: false, message: 'Auction not found' });
    }
    
    if (auction.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Auction is not active' });
    }
    
    if (new Date() > auction.endTime) {
      return res.status(400).json({ success: false, message: 'Auction has ended' });
    }
    
    if (bidAmount <= auction.currentBid) {
      return res.status(400).json({ success: false, message: 'Bid must be higher than current bid' });
    }
    
    // Place bid
    auction.bidders.set(bidderEmail, {
      amount: bidAmount,
      timestamp: new Date()
    });
    
    auction.currentBid = bidAmount;
    auction.leadingBidder = bidderEmail;
    
    console.log('🔨 BID PLACED:', { auctionId, bidderEmail, bidAmount });
    
    res.json({ 
      success: true, 
      message: 'Bid placed successfully',
      currentBid: auction.currentBid,
      timeRemaining: auction.endTime - new Date()
    });
  } catch (error) {
    console.error('Bid placement error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Price validation against market data
async function validateMarketPrice(productType, proposedPrice) {
  // Simulate market price checking against exchanges/publications
  const marketPrices = {
    'crude_oil': 75.50,
    'wheat': 245.30,
    'copper': 8456.20,
    'gold': 1985.40,
    'silver': 24.15
  };
  
  const marketPrice = marketPrices[productType] || proposedPrice * 0.95; // Default to 5% below proposed
  const discrepancy = ((proposedPrice - marketPrice) / marketPrice) * 100;
  
  return {
    marketPrice,
    proposedPrice,
    discrepancy: Math.round(discrepancy * 100) / 100,
    source: 'Exchange_API_Simulation',
    timestamp: new Date()
  };
}

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
    .container { max-width: 1600px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
    .header h1 { color: #2563eb; font-size: 2.5rem; margin: 0; }
    .admin-info { text-align: right; color: #94a3b8; }
    .nav { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #334155; }
    .nav a { color: #06b6d4; text-decoration: none; margin-right: 20px; padding: 8px 16px; border-radius: 6px; transition: all 0.3s; }
    .nav a:hover { background: #06b6d4; color: white; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .stat-card { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; text-align: center; }
    .stat-number { font-size: 2rem; font-weight: bold; color: #2563eb; }
    .stat-label { color: #94a3b8; margin-top: 5px; }
    .main-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-bottom: 30px; }
    .section { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; }
    .section h3 { color: #06b6d4; margin-bottom: 20px; }
    .btn { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin: 5px; border: none; cursor: pointer; font-size: 14px; }
    .btn:hover { background: #1d4ed8; }
    .btn.success { background: #10b981; }
    .btn.success:hover { background: #059669; }
    .btn.warning { background: #f59e0b; }
    .btn.danger { background: #ef4444; }
    .kyc-item, .flag-item, .auction-item { background: #0f172a; padding: 15px; border-radius: 8px; margin: 10px 0; border: 1px solid #334155; }
    .item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .flag-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .flag-high { background: #ef4444; color: white; }
    .flag-medium { background: #f59e0b; color: black; }
    .flag-low { background: #10b981; color: white; }
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; }
    .modal-content { background: #1e293b; padding: 30px; border-radius: 12px; max-width: 600px; margin: 50px auto; border: 1px solid #334155; }
    .close { float: right; font-size: 28px; font-weight: bold; color: #94a3b8; cursor: pointer; }
    .close:hover { color: #f8fafc; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; color: #f8fafc; font-weight: 500; }
    .form-group input, .form-group select { width: 100%; padding: 10px; border: 1px solid #334155; border-radius: 6px; background: #0f172a; color: #f8fafc; }
    .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/">Home</a>
      <a href="/dashboard/admin">Dashboard</a>
      <a href="#" onclick="showSettingsModal()">Platform Settings</a>
      <a href="#" onclick="showAuctionModal()">Auction Board</a>
      <a href="/landing-two">Sign Out</a>
    </div>
    
    <div class="header">
      <h1>⚙️ Admin Dashboard</h1>
      <div class="admin-info">
        <div><strong>Administrator:</strong> System Admin</div>
        <div><strong>Email:</strong> admin@tangent-protocol.com</div>
        <div><strong>Access Level:</strong> Full Control</div>
      </div>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-number" id="totalUsers">245</div>
        <div class="stat-label">Total Users</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="activeContracts">18</div>
        <div class="stat-label">Active Contracts</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="flaggedKYC">7</div>
        <div class="stat-label">Flagged KYC</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="tgtPoolBalance">$8.2M</div>
        <div class="stat-label">TGT Pool Balance</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="totalFees">$125,400</div>
        <div class="stat-label">Fees Collected</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="activeAuctions">3</div>
        <div class="stat-label">Active Auctions</div>
      </div>
    </div>
    
    <div class="main-grid">
      <div class="section">
        <h3>🔍 KYC Management</h3>
        <div style="margin-bottom: 20px;">
          <button class="btn" onclick="loadKYCData()">🔄 Refresh</button>
          <button class="btn success" onclick="approveAllPending()">✅ Approve All Pending</button>
        </div>
        <div id="kycList">
          <div class="kyc-item">
            <div class="item-header">
              <span style="font-weight: bold;">KYC-20240917-001</span>
              <span class="flag-badge flag-high">HIGH RISK</span>
            </div>
            <div style="color: #94a3b8; font-size: 0.9rem;">
              <div><strong>Company:</strong> Global Trading LLC</div>
              <div><strong>Email:</strong> contact@globaltrading.com</div>
              <div><strong>Type:</strong> Private Company</div>
              <div><strong>Flags:</strong> High risk jurisdiction, Suspicious activity</div>
              <div><strong>Submitted:</strong> 2 hours ago</div>
            </div>
            <div style="margin-top: 10px;">
              <button class="btn success" onclick="approveKYC('KYC-20240917-001')">Approve</button>
              <button class="btn danger" onclick="rejectKYC('KYC-20240917-001')">Reject</button>
              <button class="btn" onclick="reviewKYC('KYC-20240917-001')">Review Documents</button>
            </div>
          </div>
          
          <div class="kyc-item">
            <div class="item-header">
              <span style="font-weight: bold;">KYC-20240917-002</span>
              <span class="flag-badge flag-medium">MEDIUM RISK</span>
            </div>
            <div style="color: #94a3b8; font-size: 0.9rem;">
              <div><strong>Company:</strong> Energy Solutions Inc</div>
              <div><strong>Email:</strong> admin@energysol.com</div>
              <div><strong>Type:</strong> Listed Company</div>
              <div><strong>Flags:</strong> Missing beneficial ownership info</div>
              <div><strong>Submitted:</strong> 1 day ago</div>
            </div>
            <div style="margin-top: 10px;">
              <button class="btn success" onclick="approveKYC('KYC-20240917-002')">Approve</button>
              <button class="btn danger" onclick="rejectKYC('KYC-20240917-002')">Reject</button>
              <button class="btn" onclick="reviewKYC('KYC-20240917-002')">Review Documents</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h3>🚨 Price Flags & Alerts</h3>
        <div style="margin-bottom: 20px;">
          <button class="btn" onclick="loadPriceFlags()">🔄 Refresh</button>
          <button class="btn warning" onclick="showSettingsModal()">⚙️ Adjust Basis Points</button>
        </div>
        <div id="flagsList">
          <div class="flag-item">
            <div class="item-header">
              <span style="font-weight: bold;">CONTRACT-1234567890</span>
              <span class="flag-badge flag-high">PRICE ALERT</span>
            </div>
            <div style="color: #94a3b8; font-size: 0.9rem;">
              <div><strong>Product:</strong> Crude Oil</div>
              <div><strong>Contract Price:</strong> $82.50/barrel</div>
              <div><strong>Market Price:</strong> $75.50/barrel</div>
              <div><strong>Discrepancy:</strong> +9.3% above market</div>
              <div><strong>Flagged:</strong> 30 minutes ago</div>
            </div>
            <div style="margin-top: 10px;">
              <button class="btn" onclick="approvePrice('CONTRACT-1234567890')">Approve Price</button>
              <button class="btn warning" onclick="investigatePrice('CONTRACT-1234567890')">Investigate</button>
            </div>
          </div>
          
          <div class="flag-item">
            <div class="item-header">
              <span style="font-weight: bold;">CONTRACT-0987654321</span>
              <span class="flag-badge flag-medium">MANUAL REVIEW</span>
            </div>
            <div style="color: #94a3b8; font-size: 0.9rem;">
              <div><strong>Product:</strong> Gold</div>
              <div><strong>Contract Price:</strong> $2,150.00/oz</div>
              <div><strong>Market Price:</strong> $1,985.40/oz</div>
              <div><strong>Discrepancy:</strong> +8.3% above market</div>
              <div><strong>Flagged:</strong> 1 hour ago</div>
            </div>
            <div style="margin-top: 10px;">
              <button class="btn" onclick="approvePrice('CONTRACT-0987654321')">Approve Price</button>
              <button class="btn warning" onclick="investigatePrice('CONTRACT-0987654321')">Investigate</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h3>🏺 Auction Management</h3>
        <div style="margin-bottom: 20px;">
          <button class="btn" onclick="loadAuctions()">🔄 Refresh</button>
          <button class="btn success" onclick="showAuctionModal()">🏺 Auction Board</button>
        </div>
        <div id="auctionsList">
          <div class="auction-item">
            <div class="item-header">
              <span style="font-weight: bold;">AUCTION-001</span>
              <span style="color: #10b981; font-weight: bold;">ACTIVE</span>
            </div>
            <div style="color: #94a3b8; font-size: 0.9rem;">
              <div><strong>Contract:</strong> CONTRACT-555666777</div>
              <div><strong>Product:</strong> Wheat - 1,500 tons</div>
              <div><strong>Starting Price:</strong> $367,950</div>
              <div><strong>Current Bid:</strong> $354,200</div>
              <div><strong>Bidders:</strong> 4</div>
              <div><strong>Time Left:</strong> 18h 32m</div>
            </div>
            <div style="margin-top: 10px;">
              <button class="btn" onclick="viewAuction('AUCTION-001')">View Auction</button>
              <button class="btn warning" onclick="extendAuction('AUCTION-001')">Extend Time</button>
            </div>
          </div>
          
          <div class="auction-item">
            <div class="item-header">
              <span style="font-weight: bold;">AUCTION-002</span>
              <span style="color: #f59e0b; font-weight: bold;">ENDING SOON</span>
            </div>
            <div style="color: #94a3b8; font-size: 0.9rem;">
              <div><strong>Contract:</strong> CONTRACT-888999000</div>
              <div><strong>Product:</strong> Copper - 25 tons</div>
              <div><strong>Starting Price:</strong> $211,405</div>
              <div><strong>Current Bid:</strong> $198,750</div>
              <div><strong>Bidders:</strong> 7</div>
              <div><strong>Time Left:</strong> 2h 15m</div>
            </div>
            <div style="margin-top: 10px;">
              <button class="btn" onclick="viewAuction('AUCTION-002')">View Auction</button>
              <button class="btn danger" onclick="closeAuction('AUCTION-002')">Close Early</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="section">
      <h3>⚙️ Platform Controls</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
        <button class="btn" onclick="showSettingsModal()">Platform Settings</button>
        <button class="btn success" onclick="loadDashboardData()">Refresh Data</button>
        <button class="btn warning" onclick="generateReports()">Generate Reports</button>
        <button class="btn" onclick="systemBackup()">System Backup</button>
        <button class="btn danger" onclick="emergencyStop()">Emergency Stop</button>
        <button class="btn" onclick="contactSupport()">Support</button>
      </div>
    </div>
  </div>
  
  <!-- Platform Settings Modal -->
  <div id="settingsModal" class="modal">
    <div class="modal-content">
      <span class="close" onclick="closeModal('settingsModal')">&times;</span>
      <h3 style="color: #2563eb;">Platform Settings</h3>
      <form id="settingsForm">
        <div class="settings-grid">
          <div>
            <h4 style="color: #06b6d4;">Fee Settings</h4>
            <div class="form-group">
              <label>Platform Fee (%)</label>
              <input type="number" id="platformFee" value="2.5" step="0.1" required>
            </div>
            <div class="form-group">
              <label>Daily Interest Rate (%)</label>
              <input type="number" id="dailyInterest" value="0.1" step="0.01" required>
            </div>
            <div class="form-group">
              <label>Insurance Rate (%)</label>
              <input type="number" id="insuranceRate" value="0.5" step="0.1" required>
            </div>
          </div>
          
          <div>
            <h4 style="color: #06b6d4;">Market Settings</h4>
            <div class="form-group">
              <label>Default Voyage Time (days)</label>
              <input type="number" id="voyageTime" value="30" required>
            </div>
            <div class="form-group">
              <label>Price Alert Threshold (%)</label>
              <input type="number" id="basisPoints" value="5" step="0.5" required>
            </div>
            <div class="form-group">
              <label>Auction Duration (hours)</label>
              <input type="number" id="auctionDuration" value="72" required>
            </div>
          </div>
        </div>
        <button type="submit" class="btn success">Save Settings</button>
      </form>
    </div>
  </div>
  
  <!-- Auction Board Modal -->
  <div id="auctionModal" class="modal">
    <div class="modal-content" style="max-width: 1000px;">
      <span class="close" onclick="closeModal('auctionModal')">&times;</span>
      <h3 style="color: #2563eb;">🏺 Live Auction Board</h3>
      <div style="background: #0f172a; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h4 style="color: #f59e0b; margin-top: 0;">Featured Auctions</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div style="background: #1e293b; padding: 15px; border-radius: 8px;">
            <h5 style="color: #06b6d4; margin-top: 0;">AUCTION-001: Wheat Contract</h5>
            <div style="color: #94a3b8; margin-bottom: 10px;">Current Bid: $354,200</div>
            <div style="color: #94a3b8; margin-bottom: 10px;">Time Left: 18h 32m</div>
            <button class="btn" onclick="placeBid('AUCTION-001')">Place Bid</button>
          </div>
          <div style="background: #1e293b; padding: 15px; border-radius: 8px;">
            <h5 style="color: #06b6d4; margin-top: 0;">AUCTION-002: Copper Contract</h5>
            <div style="color: #94a3b8; margin-bottom: 10px;">Current Bid: $198,750</div>
            <div style="color: #94a3b8; margin-bottom: 10px;">Time Left: 2h 15m</div>
            <button class="btn warning" onclick="placeBid('AUCTION-002')">Place Bid</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    // Load dashboard data
    async function loadDashboardData() {
      try {
        const response = await fetch('/api/admin/dashboard-data');
        const data = await response.json();
        
        document.getElementById('totalUsers').textContent = data.activeTrades || '18';
        document.getElementById('activeContracts').textContent = data.activeTrades || '18';
        document.getElementById('flaggedKYC').textContent = data.flaggedKYC || '7';
        document.getElementById('tgtPoolBalance').textContent = '$' + (data.tgtPoolBalance || 8200000).toLocaleString();
        document.getElementById('totalFees').textContent = '$' + (data.totalFeesCollected || 125400).toLocaleString();
        document.getElementById('activeAuctions').textContent = data.activeAuctions || '3';
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      }
    }
    
    function showSettingsModal() {
      document.getElementById('settingsModal').style.display = 'block';
    }
    
    function showAuctionModal() {
      document.getElementById('auctionModal').style.display = 'block';
    }
    
    function closeModal(modalId) {
      document.getElementById(modalId).style.display = 'none';
    }
    
    // Settings form submission
    document.getElementById('settingsForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const formData = {
        platformFee: parseFloat(document.getElementById('platformFee').value),
        dailyInterest: parseFloat(document.getElementById('dailyInterest').value),
        insuranceRate: parseFloat(document.getElementById('insuranceRate').value),
        voyageTime: parseInt(document.getElementById('voyageTime').value),
        basisPoints: parseFloat(document.getElementById('basisPoints').value)
      };
      
      try {
        const response = await fetch('/api/admin/update-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
          alert('✅ Platform settings updated successfully!');
          closeModal('settingsModal');
        } else {
          alert('❌ Error: ' + result.message);
        }
      } catch (error) {
        alert('❌ Error updating settings: ' + error.message);
      }
    });
    
    async function approveKYC(kycId) {
      try {
        const response = await fetch('/api/admin/approve-kyc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kycId })
        });
        
        const result = await response.json();
        
        if (result.success) {
          alert('✅ KYC approved successfully! Wallet created: ' + result.walletAddress);
          loadKYCData();
        } else {
          alert('❌ Error: ' + result.message);
        }
      } catch (error) {
        alert('❌ Error approving KYC: ' + error.message);
      }
    }
    
    function rejectKYC(kycId) {
      if (confirm('Are you sure you want to reject this KYC application?')) {
        alert('❌ KYC application rejected: ' + kycId);
        loadKYCData();
      }
    }
    
    function reviewKYC(kycId) {
      alert('📋 Opening document review for: ' + kycId);
    }
    
    function approvePrice(contractId) {
      alert('✅ Price approved for contract: ' + contractId);
      loadPriceFlags();
    }
    
    function investigatePrice(contractId) {
      alert('🔍 Opening investigation for contract: ' + contractId);
    }
    
    function viewAuction(auctionId) {
      alert('🏺 Opening auction details for: ' + auctionId);
    }
    
    function extendAuction(auctionId) {
      alert('⏰ Extending auction time for: ' + auctionId);
    }
    
    function closeAuction(auctionId) {
      if (confirm('Are you sure you want to close this auction early?')) {
        alert('🔚 Auction closed: ' + auctionId);
        loadAuctions();
      }
    }
    
    function placeBid(auctionId) {
      const bidAmount = prompt('Enter your bid amount:');
      if (bidAmount) {
        alert('🔨 Bid placed: $' + parseFloat(bidAmount).toLocaleString() + ' for ' + auctionId);
      }
    }
    
    function loadKYCData() {
      console.log('Refreshing KYC data...');
    }
    
    function loadPriceFlags() {
      console.log('Refreshing price flags...');
    }
    
    function loadAuctions() {
      console.log('Refreshing auctions...');
    }
    
    function approveAllPending() {
      if (confirm('Are you sure you want to approve all pending KYC applications?')) {
        alert('✅ All pending KYC applications approved!');
        loadKYCData();
      }
    }
    
    function generateReports() {
      alert('📊 Generating comprehensive platform reports...');
    }
    
    function systemBackup() {
      alert('💾 Starting system backup...');
    }
    
    function emergencyStop() {
      if (confirm('⚠️ EMERGENCY STOP - This will halt all platform operations. Are you sure?')) {
        alert('🛑 Emergency stop activated!');
      }
    }
    
    function contactSupport() {
      alert('📞 Admin Support: Email us at admin-support@tangent-protocol.com');
    }
    
    // Load dashboard data on page load
    loadDashboardData();
    
    // Auto-refresh every 30 seconds
    setInterval(loadDashboardData, 30000);
  </script>
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
    .container { max-width: 1400px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
    .header h1 { color: #2563eb; font-size: 2.5rem; margin: 0; }
    .user-info { text-align: right; color: #94a3b8; }
    .nav { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #334155; }
    .nav a { color: #06b6d4; text-decoration: none; margin-right: 20px; padding: 8px 16px; border-radius: 6px; transition: all 0.3s; }
    .nav a:hover { background: #06b6d4; color: white; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .stat-card { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; text-align: center; }
    .stat-number { font-size: 2rem; font-weight: bold; color: #2563eb; }
    .stat-label { color: #94a3b8; margin-top: 5px; }
    .main-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 30px; }
    .section { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; }
    .section h3 { color: #06b6d4; margin-bottom: 20px; }
    .btn { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin: 5px; border: none; cursor: pointer; font-size: 14px; }
    .btn:hover { background: #1d4ed8; }
    .btn.success { background: #10b981; }
    .btn.success:hover { background: #059669; }
    .btn.warning { background: #f59e0b; }
    .btn.danger { background: #ef4444; }
    .contract-item { background: #0f172a; padding: 15px; border-radius: 8px; margin: 10px 0; border: 1px solid #334155; }
    .contract-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .contract-id { font-weight: bold; color: #f8fafc; }
    .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .status-pending { background: #f59e0b; color: black; }
    .status-confirmed { background: #10b981; color: white; }
    .status-awaiting { background: #06b6d4; color: white; }
    .status-completed { background: #8b5cf6; color: white; }
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; }
    .modal-content { background: #1e293b; padding: 30px; border-radius: 12px; max-width: 600px; margin: 50px auto; border: 1px solid #334155; }
    .close { float: right; font-size: 28px; font-weight: bold; color: #94a3b8; cursor: pointer; }
    .close:hover { color: #f8fafc; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; color: #f8fafc; font-weight: 500; }
    .form-group input, .form-group select { width: 100%; padding: 10px; border: 1px solid #334155; border-radius: 6px; background: #0f172a; color: #f8fafc; }
    .cost-breakdown { background: #0f172a; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #334155; }
    .cost-item { display: flex; justify-content: space-between; margin: 8px 0; }
    .total-cost { font-weight: bold; color: #2563eb; font-size: 1.1rem; border-top: 1px solid #334155; padding-top: 8px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/">Home</a>
      <a href="/dashboard/buyer">Dashboard</a>
      <a href="#" onclick="showContractModal()">Create Contract</a>
      <a href="#" onclick="showDepositModal()">Make Deposit</a>
      <a href="/landing-two">Sign Out</a>
    </div>
    
    <div class="header">
      <h1>🛒 Buyer Dashboard</h1>
      <div class="user-info">
        <div><strong>Company:</strong> Global Trading Corp</div>
        <div><strong>Email:</strong> buyer@example.com</div>
        <div><strong>Wallet:</strong> 0x5678...efgh</div>
      </div>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-number" id="activeContracts">2</div>
        <div class="stat-label">Active Contracts</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="pendingDeposits">$280,000</div>
        <div class="stat-label">Pending Deposits</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="completedPurchases">8</div>
        <div class="stat-label">Completed Purchases</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="totalSpent">$5.2M</div>
        <div class="stat-label">Total Spent</div>
      </div>
    </div>
    
    <div class="main-grid">
      <div class="section">
        <h3>📋 Contract Management</h3>
        <div style="margin-bottom: 20px;">
          <button class="btn success" onclick="showContractModal()">+ Create New Contract</button>
          <button class="btn" onclick="refreshContracts()">🔄 Refresh</button>
        </div>
        <div id="contractsList">
          <div class="contract-item">
            <div class="contract-header">
              <span class="contract-id">CONTRACT-1111222233</span>
              <span class="status-badge status-confirmed">Confirmed - Deposit Required</span>
            </div>
            <div style="color: #94a3b8;">
              <div><strong>Supplier:</strong> Energy Solutions Inc</div>
              <div><strong>Product:</strong> Crude Oil | <strong>Quantity:</strong> 2,000 barrels</div>
              <div><strong>Price:</strong> $151,000 ($75.50/barrel)</div>
              <div><strong>Confirmed:</strong> 3 hours ago</div>
            </div>
            <div style="margin-top: 10px;">
              <button class="btn success" onclick="makeDeposit('CONTRACT-1111222233', 151000)">Make Deposit ($151,000)</button>
              <button class="btn" onclick="viewContract('CONTRACT-1111222233')">View Details</button>
            </div>
          </div>
          
          <div class="contract-item">
            <div class="contract-header">
              <span class="contract-id">CONTRACT-4444555566</span>
              <span class="status-badge status-awaiting">Awaiting Documents</span>
            </div>
            <div style="color: #94a3b8;">
              <div><strong>Supplier:</strong> Grain Masters LLC</div>
              <div><strong>Product:</strong> Wheat | <strong>Quantity:</strong> 1,000 tons</div>
              <div><strong>Price:</strong> $245,300 ($245.30/ton)</div>
              <div><strong>Deposit Made:</strong> 2 days ago</div>
            </div>
            <div style="margin-top: 10px;">
              <button class="btn" onclick="viewDocuments('CONTRACT-4444555566')">Review Documents</button>
              <button class="btn success" onclick="releasePayment('CONTRACT-4444555566')">Release Payment</button>
            </div>
          </div>
          
          <div class="contract-item">
            <div class="contract-header">
              <span class="contract-id">CONTRACT-7777888899</span>
              <span class="status-badge status-pending">Pending Confirmation</span>
            </div>
            <div style="color: #94a3b8;">
              <div><strong>Supplier:</strong> Metal Trading Co</div>
              <div><strong>Product:</strong> Copper | <strong>Quantity:</strong> 50 tons</div>
              <div><strong>Price:</strong> $422,810 ($8,456.20/ton)</div>
              <div><strong>Created:</strong> 1 hour ago</div>
            </div>
            <div style="margin-top: 10px;">
              <button class="btn warning" onclick="editContract('CONTRACT-7777888899')">Edit Contract</button>
              <button class="btn danger" onclick="cancelContract('CONTRACT-7777888899')">Cancel</button>
            </div>
          </div>
        </div>
      </div>
      
      <div>
        <div class="section" style="margin-bottom: 20px;">
          <h3>🚀 Quick Actions</h3>
          <button class="btn success" style="width: 100%; margin-bottom: 10px;" onclick="showContractModal()">Create Contract</button>
          <button class="btn" style="width: 100%; margin-bottom: 10px;" onclick="showDepositModal()">Make Deposit</button>
          <button class="btn warning" style="width: 100%; margin-bottom: 10px;" onclick="viewReports()">View Reports</button>
          <button class="btn" style="width: 100%;" onclick="contactSupport()">Contact Support</button>
        </div>
        
        <div class="section">
          <h3>💰 Financial Overview</h3>
          <div style="background: #0f172a; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>Available Balance:</span>
              <span style="color: #10b981; font-weight: bold;">$2,850,000</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>Deposits Pending:</span>
              <span style="color: #f59e0b; font-weight: bold;">$280,000</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Total Committed:</span>
              <span style="color: #2563eb; font-weight: bold;">$3,130,000</span>
            </div>
          </div>
          <button class="btn" style="width: 100%;">Manage Finances</button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Contract Creation Modal -->
  <div id="contractModal" class="modal">
    <div class="modal-content">
      <span class="close" onclick="closeModal('contractModal')">&times;</span>
      <h3 style="color: #2563eb;">Create New Purchase Contract</h3>
      <form id="contractForm">
        <div class="form-group">
          <label>Supplier Email</label>
          <input type="email" id="supplierEmail" required>
        </div>
        <div class="form-group">
          <label>Product Type</label>
          <select id="productType" required onchange="updatePricing()">
            <option value="">Select product...</option>
            <option value="crude_oil">Crude Oil</option>
            <option value="wheat">Wheat</option>
            <option value="copper">Copper</option>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
          </select>
        </div>
        <div class="form-group">
          <label>Quantity</label>
          <input type="number" id="quantity" required onchange="calculateCosts()">
        </div>
        <div class="form-group">
          <label>Price Per Unit ($)</label>
          <input type="number" id="pricePerUnit" step="0.01" required onchange="calculateCosts()">
        </div>
        <div class="form-group">
          <label>Delivery Date</label>
          <input type="date" id="deliveryDate" required>
        </div>
        
        <div class="cost-breakdown" id="costBreakdown" style="display: none;">
          <h4 style="color: #06b6d4; margin-top: 0;">Cost Breakdown</h4>
          <div class="cost-item">
            <span>Contract Value:</span>
            <span id="contractValue">$0</span>
          </div>
          <div class="cost-item">
            <span>Platform Fee (2.5%):</span>
            <span id="platformFee">$0</span>
          </div>
          <div class="cost-item">
            <span>Insurance Fee (0.5%):</span>
            <span id="insuranceFee">$0</span>
          </div>
          <div class="cost-item total-cost">
            <span>Total Cost:</span>
            <span id="totalCost">$0</span>
          </div>
          <div style="margin-top: 15px; padding: 10px; background: #1e293b; border-radius: 6px; color: #94a3b8; font-size: 0.9rem;">
            ⚠️ Additional daily interest of 0.1% applies for late payments
          </div>
        </div>
        
        <button type="submit" class="btn success">Create Contract</button>
      </form>
    </div>
  </div>
  
  <!-- Deposit Modal -->
  <div id="depositModal" class="modal">
    <div class="modal-content">
      <span class="close" onclick="closeModal('depositModal')">&times;</span>
      <h3 style="color: #2563eb;">Make Contract Deposit</h3>
      <form id="depositForm">
        <div class="form-group">
          <label>Contract ID</label>
          <input type="text" id="depositContractId" required>
        </div>
        <div class="form-group">
          <label>Deposit Amount ($)</label>
          <input type="number" id="depositAmount" step="0.01" required readonly>
        </div>
        <div style="background: #0f172a; padding: 15px; border-radius: 8px; margin: 15px 0; color: #94a3b8;">
          <div style="margin-bottom: 10px;"><strong>Payment Method:</strong> TGT Pool Transfer</div>
          <div style="margin-bottom: 10px;"><strong>Processing Time:</strong> Instant</div>
          <div><strong>Security:</strong> Funds held in escrow until delivery</div>
        </div>
        <button type="submit" class="btn success">Confirm Deposit</button>
      </form>
    </div>
  </div>
  
  <script>
    function showContractModal() {
      document.getElementById('contractModal').style.display = 'block';
    }
    
    function showDepositModal() {
      document.getElementById('depositModal').style.display = 'block';
    }
    
    function closeModal(modalId) {
      document.getElementById(modalId).style.display = 'none';
    }
    
    function updatePricing() {
      const productType = document.getElementById('productType').value;
      const marketPrices = {
        'crude_oil': 75.50,
        'wheat': 245.30,
        'copper': 8456.20,
        'gold': 1985.40,
        'silver': 24.15
      };
      
      if (marketPrices[productType]) {
        document.getElementById('pricePerUnit').value = marketPrices[productType];
        calculateCosts();
      }
    }
    
    function calculateCosts() {
      const quantity = parseFloat(document.getElementById('quantity').value) || 0;
      const pricePerUnit = parseFloat(document.getElementById('pricePerUnit').value) || 0;
      const contractValue = quantity * pricePerUnit;
      
      if (contractValue > 0) {
        const platformFee = contractValue * 0.025; // 2.5%
        const insuranceFee = contractValue * 0.005; // 0.5%
        const totalCost = contractValue + platformFee + insuranceFee;
        
        document.getElementById('contractValue').textContent = '$' + contractValue.toLocaleString();
        document.getElementById('platformFee').textContent = '$' + platformFee.toLocaleString();
        document.getElementById('insuranceFee').textContent = '$' + insuranceFee.toLocaleString();
        document.getElementById('totalCost').textContent = '$' + totalCost.toLocaleString();
        document.getElementById('costBreakdown').style.display = 'block';
      } else {
        document.getElementById('costBreakdown').style.display = 'none';
      }
    }
    
    // Contract form submission
    document.getElementById('contractForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const formData = {
        supplierEmail: document.getElementById('supplierEmail').value,
        buyerEmail: 'buyer@example.com',
        productType: document.getElementById('productType').value,
        quantity: parseFloat(document.getElementById('quantity').value),
        pricePerUnit: parseFloat(document.getElementById('pricePerUnit').value),
        totalValue: parseFloat(document.getElementById('quantity').value) * parseFloat(document.getElementById('pricePerUnit').value),
        deliveryDate: document.getElementById('deliveryDate').value,
        role: 'buyer'
      };
      
      try {
        const response = await fetch('/api/create-contract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
          alert('✅ Contract created successfully! ID: ' + result.contractId);
          closeModal('contractModal');
          refreshContracts();
        } else {
          alert('❌ Error: ' + result.message);
        }
      } catch (error) {
        alert('❌ Error creating contract: ' + error.message);
      }
    });
    
    async function makeDeposit(contractId, amount) {
      document.getElementById('depositContractId').value = contractId;
      document.getElementById('depositAmount').value = amount;
      showDepositModal();
    }
    
    // Deposit form submission
    document.getElementById('depositForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const formData = {
        contractId: document.getElementById('depositContractId').value,
        userEmail: 'buyer@example.com',
        amount: parseFloat(document.getElementById('depositAmount').value)
      };
      
      try {
        const response = await fetch('/api/make-deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
          alert('✅ Deposit made successfully! Deposit ID: ' + result.depositId);
          closeModal('depositModal');
          refreshContracts();
        } else {
          alert('❌ Error: ' + result.message);
        }
      } catch (error) {
        alert('❌ Error making deposit: ' + error.message);
      }
    });
    
    async function releasePayment(contractId) {
      if (confirm('Are you sure you want to release payment for this contract?')) {
        try {
          const response = await fetch('/api/release-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contractId,
              userEmail: 'buyer@example.com',
              role: 'buyer'
            })
          });
          
          const result = await response.json();
          
          if (result.success) {
            alert('✅ Payment released successfully! Final amount: $' + result.finalAmount.toLocaleString());
            refreshContracts();
          } else {
            alert('❌ Error: ' + result.message);
          }
        } catch (error) {
          alert('❌ Error releasing payment: ' + error.message);
        }
      }
    }
    
    function viewDocuments(contractId) {
      alert('📄 Viewing documents for contract: ' + contractId);
    }
    
    function viewContract(contractId) {
      alert('📋 Viewing contract details for: ' + contractId);
    }
    
    function editContract(contractId) {
      alert('✏️ Editing contract: ' + contractId);
    }
    
    function cancelContract(contractId) {
      if (confirm('Are you sure you want to cancel this contract?')) {
        alert('❌ Contract cancelled: ' + contractId);
        refreshContracts();
      }
    }
    
    function refreshContracts() {
      location.reload();
    }
    
    function viewReports() {
      alert('📊 Reports feature - Integration with your existing analytics');
    }
    
    function contactSupport() {
      alert('📞 Support: Email us at support@tangent-protocol.com');
    }
  </script>
</body>
</html>`;
  res.send(html);
});
  
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
    .container { max-width: 1400px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
    .header h1 { color: #10b981; font-size: 2.5rem; margin: 0; }
    .user-info { text-align: right; color: #94a3b8; }
    .nav { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #334155; }
    .nav a { color: #06b6d4; text-decoration: none; margin-right: 20px; padding: 8px 16px; border-radius: 6px; transition: all 0.3s; }
    .nav a:hover { background: #06b6d4; color: white; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .stat-card { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; text-align: center; }
    .stat-number { font-size: 2rem; font-weight: bold; color: #10b981; }
    .stat-label { color: #94a3b8; margin-top: 5px; }
    .main-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 30px; }
    .section { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; }
    .section h3 { color: #06b6d4; margin-bottom: 20px; }
    .btn { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; margin: 5px; border: none; cursor: pointer; font-size: 14px; }
    .btn:hover { background: #059669; }
    .btn.primary { background: #2563eb; }
    .btn.primary:hover { background: #1d4ed8; }
    .btn.warning { background: #f59e0b; }
    .btn.danger { background: #ef4444; }
    .contract-item { background: #0f172a; padding: 15px; border-radius: 8px; margin: 10px 0; border: 1px solid #334155; }
    .contract-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .contract-id { font-weight: bold; color: #f8fafc; }
    .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .status-pending { background: #f59e0b; color: black; }
    .status-confirmed { background: #10b981; color: white; }
    .status-completed { background: #06b6d4; color: white; }
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; }
    .modal-content { background: #1e293b; padding: 30px; border-radius: 12px; max-width: 600px; margin: 50px auto; border: 1px solid #334155; }
    .close { float: right; font-size: 28px; font-weight: bold; color: #94a3b8; cursor: pointer; }
    .close:hover { color: #f8fafc; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; color: #f8fafc; font-weight: 500; }
    .form-group input, .form-group select { width: 100%; padding: 10px; border: 1px solid #334155; border-radius: 6px; background: #0f172a; color: #f8fafc; }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/">Home</a>
      <a href="/dashboard/supplier">Dashboard</a>
      <a href="#" onclick="showContractModal()">Create Contract</a>
      <a href="#" onclick="showUploadModal()">Upload Documents</a>
      <a href="/landing-two">Sign Out</a>
    </div>
    
    <div class="header">
      <h1>🏭 Supplier Dashboard</h1>
      <div class="user-info">
        <div><strong>Company:</strong> Sample Trading LLC</div>
        <div><strong>Email:</strong> supplier@example.com</div>
        <div><strong>Wallet:</strong> 0x1234...abcd</div>
      </div>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-number" id="activeContracts">3</div>
        <div class="stat-label">Active Contracts</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="pendingPayments">$198,150</div>
        <div class="stat-label">Pending Payments</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="completedTrades">12</div>
        <div class="stat-label">Completed Trades</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="totalEarnings">$2.45M</div>
        <div class="stat-label">Total Earnings</div>
      </div>
    </div>
    
    <div class="main-grid">
      <div class="section">
        <h3>📋 Contract Management</h3>
        <div style="margin-bottom: 20px;">
          <button class="btn" onclick="showContractModal()">+ Create New Contract</button>
          <button class="btn primary" onclick="refreshContracts()">🔄 Refresh</button>
        </div>
        <div id="contractsList">
          <div class="contract-item">
            <div class="contract-header">
              <span class="contract-id">CONTRACT-1234567890</span>
              <span class="status-badge status-pending">Pending Confirmation</span>
            </div>
            <div style="color: #94a3b8;">
              <div><strong>Buyer:</strong> Global Trading Corp</div>
              <div><strong>Product:</strong> Crude Oil | <strong>Quantity:</strong> 1,000 barrels</div>
              <div><strong>Price:</strong> $75,500 ($75.50/barrel)</div>
              <div><strong>Created:</strong> 2 hours ago</div>
            </div>
            <div style="margin-top: 10px;">
              <button class="btn primary" onclick="confirmContract('CONTRACT-1234567890')">Confirm Contract</button>
              <button class="btn warning" onclick="editContract('CONTRACT-1234567890')">Edit</button>
            </div>
          </div>
          
          <div class="contract-item">
            <div class="contract-header">
              <span class="contract-id">CONTRACT-0987654321</span>
              <span class="status-badge status-confirmed">Confirmed - Awaiting Documents</span>
            </div>
            <div style="color: #94a3b8;">
              <div><strong>Buyer:</strong> Energy Solutions Inc</div>
              <div><strong>Product:</strong> Wheat | <strong>Quantity:</strong> 500 tons</div>
              <div><strong>Price:</strong> $122,650 ($245.30/ton)</div>
              <div><strong>Confirmed:</strong> 1 day ago</div>
            </div>
            <div style="margin-top: 10px;">
              <button class="btn" onclick="uploadDocuments('CONTRACT-0987654321')">Upload Documents</button>
              <button class="btn primary" onclick="viewContract('CONTRACT-0987654321')">View Details</button>
            </div>
          </div>
        </div>
      </div>
      
      <div>
        <div class="section" style="margin-bottom: 20px;">
          <h3>🚀 Quick Actions</h3>
          <button class="btn" style="width: 100%; margin-bottom: 10px;" onclick="showContractModal()">Create Contract</button>
          <button class="btn primary" style="width: 100%; margin-bottom: 10px;" onclick="showUploadModal()">Upload Documents</button>
          <button class="btn warning" style="width: 100%; margin-bottom: 10px;" onclick="viewReports()">View Reports</button>
          <button class="btn" style="width: 100%;" onclick="contactSupport()">Contact Support</button>
        </div>
        
        <div class="section">
          <h3>💰 Wallet Overview</h3>
          <div style="background: #0f172a; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>TGT Balance:</span>
              <span style="color: #10b981; font-weight: bold;">125,000 TGT</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>Pending:</span>
              <span style="color: #f59e0b; font-weight: bold;">$198,150</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Available:</span>
              <span style="color: #10b981; font-weight: bold;">$856,500</span>
            </div>
          </div>
          <button class="btn primary" style="width: 100%;">Manage Wallet</button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Contract Creation Modal -->
  <div id="contractModal" class="modal">
    <div class="modal-content">
      <span class="close" onclick="closeModal('contractModal')">&times;</span>
      <h3 style="color: #10b981;">Create New Contract</h3>
      <form id="contractForm">
        <div class="form-group">
          <label>Buyer Email</label>
          <input type="email" id="buyerEmail" required>
        </div>
        <div class="form-group">
          <label>Product Type</label>
          <select id="productType" required>
            <option value="">Select product...</option>
            <option value="crude_oil">Crude Oil</option>
            <option value="wheat">Wheat</option>
            <option value="copper">Copper</option>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
          </select>
        </div>
        <div class="form-group">
          <label>Quantity</label>
          <input type="number" id="quantity" required>
        </div>
        <div class="form-group">
          <label>Price Per Unit ($)</label>
          <input type="number" id="pricePerUnit" step="0.01" required>
        </div>
        <div class="form-group">
          <label>Delivery Date</label>
          <input type="date" id="deliveryDate" required>
        </div>
        <button type="submit" class="btn">Create Contract</button>
      </form>
    </div>
  </div>
  
  <!-- Document Upload Modal -->
  <div id="uploadModal" class="modal">
    <div class="modal-content">
      <span class="close" onclick="closeModal('uploadModal')">&times;</span>
      <h3 style="color: #10b981;">Upload Contract Documents</h3>
      <form id="uploadForm" enctype="multipart/form-data">
        <div class="form-group">
          <label>Contract ID</label>
          <input type="text" id="uploadContractId" required>
        </div>
        <div class="form-group">
          <label>Documents (PDF, DOC, JPG, PNG)</label>
          <input type="file" id="documents" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" required>
        </div>
        <button type="submit" class="btn">Upload Documents</button>
      </form>
    </div>
  </div>
  
  <script>
    function showContractModal() {
      document.getElementById('contractModal').style.display = 'block';
    }
    
    function showUploadModal() {
      document.getElementById('uploadModal').style.display = 'block';
    }
    
    function closeModal(modalId) {
      document.getElementById(modalId).style.display = 'none';
    }
    
    // Contract form submission
    document.getElementById('contractForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const formData = {
        supplierEmail: 'supplier@example.com',
        buyerEmail: document.getElementById('buyerEmail').value,
        productType: document.getElementById('productType').value,
        quantity: parseFloat(document.getElementById('quantity').value),
        pricePerUnit: parseFloat(document.getElementById('pricePerUnit').value),
        totalValue: parseFloat(document.getElementById('quantity').value) * parseFloat(document.getElementById('pricePerUnit').value),
        deliveryDate: document.getElementById('deliveryDate').value,
        role: 'supplier'
      };
      
      try {
        const response = await fetch('/api/create-contract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
          alert('✅ Contract created successfully! ID: ' + result.contractId);
          closeModal('contractModal');
          refreshContracts();
        } else {
          alert('❌ Error: ' + result.message);
        }
      } catch (error) {
        alert('❌ Error creating contract: ' + error.message);
      }
    });
    
    async function confirmContract(contractId) {
      try {
        const response = await fetch('/api/confirm-contract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contractId,
            userEmail: 'supplier@example.com',
            role: 'supplier'
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          alert('✅ Contract confirmed successfully!');
          refreshContracts();
        } else {
          alert('❌ Error: ' + result.message);
        }
      } catch (error) {
        alert('❌ Error confirming contract: ' + error.message);
      }
    }
    
    function uploadDocuments(contractId) {
      document.getElementById('uploadContractId').value = contractId;
      showUploadModal();
    }
    
    function refreshContracts() {
      location.reload();
    }
    
    function viewContract(contractId) {
      alert('📋 Viewing contract details for: ' + contractId);
    }
    
    function editContract(contractId) {
      alert('✏️ Editing contract: ' + contractId);
    }
    
    function viewReports() {
      alert('📊 Reports feature - Integration with your existing analytics');
    }
    
    function contactSupport() {
      alert('📞 Support: Email us at support@tangent-protocol.com');
    }
  </script>
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
    .container { max-width: 1400px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
    .header h1 { color: #f59e0b; font-size: 2.5rem; margin: 0; }
    .user-info { text-align: right; color: #94a3b8; }
    .nav { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #334155; }
    .nav a { color: #06b6d4; text-decoration: none; margin-right: 20px; padding: 8px 16px; border-radius: 6px; transition: all 0.3s; }
    .nav a:hover { background: #06b6d4; color: white; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .stat-card { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; text-align: center; }
    .stat-number { font-size: 2rem; font-weight: bold; color: #f59e0b; }
    .stat-label { color: #94a3b8; margin-top: 5px; }
    .main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
    .section { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; }
    .section h3 { color: #06b6d4; margin-bottom: 20px; }
    .btn { display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 8px; margin: 5px; border: none; cursor: pointer; font-size: 14px; }
    .btn:hover { background: #d97706; }
    .btn.success { background: #10b981; }
    .btn.success:hover { background: #059669; }
    .btn.primary { background: #2563eb; }
    .btn.primary:hover { background: #1d4ed8; }
    .btn.danger { background: #ef4444; }
    .trade-item { background: #0f172a; padding: 15px; border-radius: 8px; margin: 10px 0; border: 1px solid #334155; }
    .trade-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .trade-id { font-weight: bold; color: #f8fafc; }
    .profit-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .profit-positive { background: #10b981; color: white; }
    .profit-negative { background: #ef4444; color: white; }
    .trade-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .contract-side { background: #1e293b; padding: 15px; border-radius: 8px; }
    .contract-side h4 { margin: 0 0 10px 0; color: #06b6d4; }
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; }
    .modal-content { background: #1e293b; padding: 30px; border-radius: 12px; max-width: 800px; margin: 50px auto; border: 1px solid #334155; }
    .close { float: right; font-size: 28px; font-weight: bold; color: #94a3b8; cursor: pointer; }
    .close:hover { color: #f8fafc; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; color: #f8fafc; font-weight: 500; }
    .form-group input, .form-group select { width: 100%; padding: 10px; border: 1px solid #334155; border-radius: 6px; background: #0f172a; color: #f8fafc; }
    .dual-form { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
    .form-section { background: #0f172a; padding: 20px; border-radius: 8px; border: 1px solid #334155; }
    .form-section h4 { color: #06b6d4; margin-top: 0; }
    .profit-calculator { background: #0f172a; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/">Home</a>
      <a href="/dashboard/trader">Dashboard</a>
      <a href="#" onclick="showDualContractModal()">Create Dual Contract</a>
      <a href="#" onclick="showDocumentTransferModal()">Transfer Documents</a>
      <a href="/landing-two">Sign Out</a>
    </div>
    
    <div class="header">
      <h1>📈 Trader Dashboard</h1>
      <div class="user-info">
        <div><strong>Company:</strong> Strategic Trading Partners</div>
        <div><strong>Email:</strong> trader@example.com</div>
        <div><strong>License:</strong> TR-001-2024</div>
      </div>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-number" id="activeTrades">4</div>
        <div class="stat-label">Active Trades</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="totalProfit">+$285,400</div>
        <div class="stat-label">Total Profit</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="successRate">87%</div>
        <div class="stat-label">Success Rate</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="volumeTraded">$12.5M</div>
        <div class="stat-label">Volume Traded</div>
      </div>
    </div>
    
    <div class="main-grid">
      <div class="section">
        <h3>🔄 Active Dual Contracts</h3>
        <div style="margin-bottom: 20px;">
          <button class="btn" onclick="showDualContractModal()">+ Create Dual Contract</button>
          <button class="btn primary" onclick="refreshTrades()">🔄 Refresh</button>
        </div>
        <div id="tradesList">
          <div class="trade-item">
            <div class="trade-header">
              <span class="trade-id">TRADE-2024-001</span>
              <span class="profit-badge profit-positive">+$45,200 Projected</span>
            </div>
            <div class="trade-pair">
              <div class="contract-side">
                <h4>🔵 BUY CONTRACT</h4>
                <div style="color: #94a3b8; font-size: 0.9rem;">
                  <div><strong>From:</strong> Oil Suppliers LLC</div>
                  <div><strong>Product:</strong> Crude Oil</div>
                  <div><strong>Quantity:</strong> 1,000 barrels</div>
                  <div><strong>Buy Price:</strong> $73.50/barrel</div>
                  <div><strong>Status:</strong> Documents Received</div>
                </div>
              </div>
              <div class="contract-side">
                <h4>🔴 SELL CONTRACT</h4>
                <div style="color: #94a3b8; font-size: 0.9rem;">
                  <div><strong>To:</strong> Energy Corp International</div>
                  <div><strong>Product:</strong> Crude Oil</div>
                  <div><strong>Quantity:</strong> 1,000 barrels</div>
                  <div><strong>Sell Price:</strong> $78.70/barrel</div>
                  <div><strong>Status:</strong> Awaiting Transfer</div>
                </div>
              </div>
            </div>
            <div style="margin-top: 15px; text-align: center;">
              <button class="btn success" onclick="transferDocuments('TRADE-2024-001')">Transfer Documents</button>
              <button class="btn primary" onclick="viewTradeDetails('TRADE-2024-001')">View Details</button>
            </div>
          </div>
          
          <div class="trade-item">
            <div class="trade-header">
              <span class="trade-id">TRADE-2024-002</span>
              <span class="profit-badge profit-positive">+$125,800 Projected</span>
            </div>
            <div class="trade-pair">
              <div class="contract-side">
                <h4>🔵 BUY CONTRACT</h4>
                <div style="color: #94a3b8; font-size: 0.9rem;">
                  <div><strong>From:</strong> Grain Masters Co</div>
                  <div><strong>Product:</strong> Wheat</div>
                  <div><strong>Quantity:</strong> 2,000 tons</div>
                  <div><strong>Buy Price:</strong> $240.00/ton</div>
                  <div><strong>Status:</strong> Confirmed</div>
                </div>
              </div>
              <div class="contract-side">
                <h4>🔴 SELL CONTRACT</h4>
                <div style="color: #94a3b8; font-size: 0.9rem;">
                  <div><strong>To:</strong> Food Processing Inc</div>
                  <div><strong>Product:</strong> Wheat</div>
                  <div><strong>Quantity:</strong> 2,000 tons</div>
                  <div><strong>Sell Price:</strong> $302.90/ton</div>
                  <div><strong>Status:</strong> Pending Confirmation</div>
                </div>
              </div>
            </div>
            <div style="margin-top: 15px; text-align: center;">
              <button class="btn" onclick="linkContracts('TRADE-2024-002')">Link Contracts</button>
              <button class="btn primary" onclick="viewTradeDetails('TRADE-2024-002')">View Details</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h3>📊 Trade Analytics</h3>
        <div style="background: #0f172a; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span>Current Month P&L:</span>
            <span style="color: #10b981; font-weight: bold;">+$185,400</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span>Pending Profits:</span>
            <span style="color: #f59e0b; font-weight: bold;">+$171,000</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Risk Exposure:</span>
            <span style="color: #2563eb; font-weight: bold;">$2.4M</span>
          </div>
        </div>
        
        <div style="background: #0f172a; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
          <h4 style="color: #06b6d4; margin-top: 0;">Top Performing Products</h4>
          <div style="margin-bottom: 8px;">1. Crude Oil - +15.2% margin</div>
          <div style="margin-bottom: 8px;">2. Wheat - +12.8% margin</div>
          <div style="margin-bottom: 8px;">3. Copper - +8.4% margin</div>
        </div>
        
        <button class="btn" style="width: 100%; margin-bottom: 10px;" onclick="showDualContractModal()">Create New Trade</button>
        <button class="btn primary" style="width: 100%;" onclick="viewReports()">Detailed Reports</button>
      </div>
    </div>
    
    <div class="section">
      <h3>🚀 Quick Actions</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
        <button class="btn" onclick="showDualContractModal()">Create Dual Contract</button>
        <button class="btn success" onclick="showDocumentTransferModal()">Transfer Documents</button>
        <button class="btn primary" onclick="viewMarketData()">Market Data</button>
        <button class="btn" onclick="contactSupport()">Support</button>
      </div>
    </div>
  </div>
  
  <!-- Dual Contract Modal -->
  <div id="dualContractModal" class="modal">
    <div class="modal-content">
      <span class="close" onclick="closeModal('dualContractModal')">&times;</span>
      <h3 style="color: #f59e0b;">Create Dual Trading Contract</h3>
      <form id="dualContractForm">
        <div class="dual-form">
          <div class="form-section">
            <h4>🔵 BUY CONTRACT (From Supplier)</h4>
            <div class="form-group">
              <label>Supplier Email</label>
              <input type="email" id="buySupplierEmail" required>
            </div>
            <div class="form-group">
              <label>Product Type</label>
              <select id="buyProductType" required onchange="calculateProfit()">
                <option value="">Select product...</option>
                <option value="crude_oil">Crude Oil</option>
                <option value="wheat">Wheat</option>
                <option value="copper">Copper</option>
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
              </select>
            </div>
            <div class="form-group">
              <label>Quantity</label>
              <input type="number" id="buyQuantity" required onchange="calculateProfit()">
            </div>
            <div class="form-group">
              <label>Buy Price Per Unit ($)</label>
              <input type="number" id="buyPricePerUnit" step="0.01" required onchange="calculateProfit()">
            </div>
            <div class="form-group">
              <label>Delivery Date</label>
              <input type="date" id="buyDeliveryDate" required>
            </div>
          </div>
          
          <div class="form-section">
            <h4>🔴 SELL CONTRACT (To Buyer)</h4>
            <div class="form-group">
              <label>Buyer Email</label>
              <input type="email" id="sellBuyerEmail" required>
            </div>
            <div class="form-group">
              <label>Product Type</label>
              <select id="sellProductType" required>
                <option value="">Will match buy contract</option>
              </select>
            </div>
            <div class="form-group">
              <label>Quantity</label>
              <input type="number" id="sellQuantity" required onchange="calculateProfit()">
            </div>
            <div class="form-group">
              <label>Sell Price Per Unit ($)</label>
              <input type="number" id="sellPricePerUnit" step="0.01" required onchange="calculateProfit()">
            </div>
            <div class="form-group">
              <label>Delivery Date</label>
              <input type="date" id="sellDeliveryDate" required>
            </div>
          </div>
        </div>
        
        <div class="profit-calculator" id="profitCalculator" style="display: none;">
          <h4 style="color: #f59e0b; margin-top: 0;">Profit Analysis</h4>
          <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>Buy Contract Value:</span>
            <span id="buyValue">$0</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>Sell Contract Value:</span>
            <span id="sellValue">$0</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 8px 0; font-weight: bold; color: #10b981;">
            <span>Projected Profit:</span>
            <span id="projectedProfit">$0</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>Profit Margin:</span>
            <span id="profitMargin">0%</span>
          </div>
        </div>
        
        <button type="submit" class="btn success">Create Dual Contract</button>
      </form>
    </div>
  </div>
  
  <!-- Document Transfer Modal -->
  <div id="documentTransferModal" class="modal">
    <div class="modal-content">
      <span class="close" onclick="closeModal('documentTransferModal')">&times;</span>
      <h3 style="color: #f59e0b;">Transfer Documents Between Contracts</h3>
      <form id="documentTransferForm">
        <div class="form-group">
          <label>Trade ID</label>
          <input type="text" id="transferTradeId" required>
        </div>
        <div class="form-group">
          <label>Transfer Direction</label>
          <select id="transferDirection" required>
            <option value="">Select direction...</option>
            <option value="buy_to_sell">From Buy Contract to Sell Contract</option>
            <option value="sell_to_buy">From Sell Contract to Buy Contract</option>
          </select>
        </div>
        <div style="background: #0f172a; padding: 15px; border-radius: 8px; margin: 15px 0; color: #94a3b8;">
          <div><strong>Note:</strong> Document transfer allows seamless commodity flow</div>
          <div>Documents will be automatically validated and forwarded</div>
        </div>
        <button type="submit" class="btn success">Transfer Documents</button>
      </form>
    </div>
  </div>
  
  <script>
    function showDualContractModal() {
      document.getElementById('dualContractModal').style.display = 'block';
    }
    
    function showDocumentTransferModal() {
      document.getElementById('documentTransferModal').style.display = 'block';
    }
    
    function closeModal(modalId) {
      document.getElementById(modalId).style.display = 'none';
    }
    
    function calculateProfit() {
      const buyQuantity = parseFloat(document.getElementById('buyQuantity').value) || 0;
      const buyPrice = parseFloat(document.getElementById('buyPricePerUnit').value) || 0;
      const sellQuantity = parseFloat(document.getElementById('sellQuantity').value) || 0;
      const sellPrice = parseFloat(document.getElementById('sellPricePerUnit').value) || 0;
      
      if (buyQuantity > 0 && buyPrice > 0 && sellQuantity > 0 && sellPrice > 0) {
        const buyValue = buyQuantity * buyPrice;
        const sellValue = sellQuantity * sellPrice;
        const profit = sellValue - buyValue;
        const margin = (profit / buyValue) * 100;
        
        document.getElementById('buyValue').textContent = '$' + buyValue.toLocaleString();
        document.getElementById('sellValue').textContent = '$' + sellValue.toLocaleString();
        document.getElementById('projectedProfit').textContent = '$' + profit.toLocaleString();
        document.getElementById('profitMargin').textContent = margin.toFixed(2) + '%';
        
        // Update sell product to match buy
        const buyProduct = document.getElementById('buyProductType').value;
        if (buyProduct) {
          document.getElementById('sellProductType').innerHTML = '<option value="' + buyProduct + '">Same as buy contract (' + buyProduct.replace('_', ' ').toUpperCase() + ')</option>';
          document.getElementById('sellProductType').value = buyProduct;
        }
        
        document.getElementById('profitCalculator').style.display = 'block';
      } else {
        document.getElementById('profitCalculator').style.display = 'none';
      }
    }
    
    // Dual contract form submission
    document.getElementById('dualContractForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const formData = {
        traderEmail: 'trader@example.com',
        buyContractData: {
          supplierEmail: document.getElementById('buySupplierEmail').value,
          productType: document.getElementById('buyProductType').value,
          quantity: parseFloat(document.getElementById('buyQuantity').value),
          pricePerUnit: parseFloat(document.getElementById('buyPricePerUnit').value),
          deliveryDate: document.getElementById('buyDeliveryDate').value
        },
        sellContractData: {
          buyerEmail: document.getElementById('sellBuyerEmail').value,
          productType: document.getElementById('buyProductType').value,
          quantity: parseFloat(document.getElementById('sellQuantity').value),
          pricePerUnit: parseFloat(document.getElementById('sellPricePerUnit').value),
          deliveryDate: document.getElementById('sellDeliveryDate').value
        },
        tradeMargin: parseFloat(document.getElementById('profitMargin').textContent)
      };
      
      try {
        const response = await fetch('/api/create-dual-contract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
          alert('✅ Dual contract created successfully!\\nBuy Contract: ' + result.buyContractId + '\\nSell Contract: ' + result.sellContractId + '\\nProjected Profit: $' + result.expectedProfit.toLocaleString());
          closeModal('dualContractModal');
          refreshTrades();
        } else {
          alert('❌ Error: ' + result.message);
        }
      } catch (error) {
        alert('❌ Error creating dual contract: ' + error.message);
      }
    });
    
    function transferDocuments(tradeId) {
      document.getElementById('transferTradeId').value = tradeId;
      showDocumentTransferModal();
    }
    
    function viewTradeDetails(tradeId) {
      alert('📋 Viewing trade details for: ' + tradeId);
    }
    
    function linkContracts(tradeId) {
      alert('🔗 Linking contracts for trade: ' + tradeId);
    }
    
    function refreshTrades() {
      location.reload();
    }
    
    function viewMarketData() {
      alert('📊 Market data feature - Real-time commodity prices');
    }
    
    function viewReports() {
      alert('📈 Detailed trading reports and analytics');
    }
    
    function contactSupport() {
      alert('📞 Trading Support: Email us at trading@tangent-protocol.com');
    }
  </script>
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
    .container { max-width: 1400px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
    .header h1 { color: #8b5cf6; font-size: 2.5rem; margin: 0; }
    .user-info { text-align: right; color: #94a3b8; }
    .nav { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #334155; }
    .nav a { color: #06b6d4; text-decoration: none; margin-right: 20px; padding: 8px 16px; border-radius: 6px; transition: all 0.3s; }
    .nav a:hover { background: #06b6d4; color: white; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .stat-card { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; text-align: center; }
    .stat-number { font-size: 2rem; font-weight: bold; color: #8b5cf6; }
    .stat-label { color: #94a3b8; margin-top: 5px; }
    .main-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 30px; }
    .section { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; }
    .section h3 { color: #06b6d4; margin-bottom: 20px; }
    .btn { display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; margin: 5px; border: none; cursor: pointer; font-size: 14px; }
    .btn:hover { background: #7c3aed; }
    .btn.success { background: #10b981; }
    .btn.success:hover { background: #059669; }
    .btn.warning { background: #f59e0b; }
    .btn.danger { background: #ef4444; }
    .trade-item { background: #0f172a; padding: 15px; border-radius: 8px; margin: 10px 0; border: 1px solid #334155; }
    .trade-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .trade-id { font-weight: bold; color: #f8fafc; }
    .risk-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .risk-low { background: #10b981; color: white; }
    .risk-medium { background: #f59e0b; color: black; }
    .risk-high { background: #ef4444; color: white; }
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; }
    .modal-content { background: #1e293b; padding: 30px; border-radius: 12px; max-width: 600px; margin: 50px auto; border: 1px solid #334155; }
    .close { float: right; font-size: 28px; font-weight: bold; color: #94a3b8; cursor: pointer; }
    .close:hover { color: #f8fafc; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; color: #f8fafc; font-weight: 500; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px; border: 1px solid #334155; border-radius: 6px; background: #0f172a; color: #f8fafc; }
    .quote-calculator { background: #0f172a; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #334155; }
    .risk-factors { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/">Home</a>
      <a href="/dashboard/insurer">Dashboard</a>
      <a href="#" onclick="showQuoteModal()">Create Quote</a>
      <a href="#" onclick="showRiskModal()">Risk Assessment</a>
      <a href="/landing-two">Sign Out</a>
    </div>
    
    <div class="header">
      <h1>🛡️ Insurer Dashboard</h1>
      <div class="user-info">
        <div><strong>Company:</strong> Global Insurance Partners</div>
        <div><strong>Email:</strong> insurer@example.com</div>
        <div><strong>License:</strong> INS-001-2024</div>
      </div>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-number" id="activeQuotes">12</div>
        <div class="stat-label">Active Quotes</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="totalCoverage">$45.2M</div>
        <div class="stat-label">Total Coverage</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="premiumsEarned">$285,400</div>
        <div class="stat-label">Premiums Earned</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="riskScore">7.2</div>
        <div class="stat-label">Avg Risk Score</div>
      </div>
    </div>
    
    <div class="main-grid">
      <div class="section">
        <h3>📊 Available Contracts for Insurance</h3>
        <div style="margin-bottom: 20px;">
          <button class="btn" onclick="showQuoteModal()">+ Create Quote</button>
          <button class="btn success" onclick="refreshTrades()">🔄 Refresh</button>
        </div>
        <div id="tradesList">
          <div class="trade-item">
            <div class="trade-header">
              <span class="trade-id">CONTRACT-1234567890</span>
              <span class="risk-badge risk-medium">MEDIUM RISK</span>
            </div>
            <div style="color: #94a3b8;">
              <div><strong>Parties:</strong> Global Trading Corp ↔ Energy Solutions Inc</div>
              <div><strong>Product:</strong> Crude Oil | <strong>Quantity:</strong> 2,000 barrels</div>
              <div><strong>Value:</strong> $151,000 | <strong>Route:</strong> Gulf Coast → Europe</div>
              <div><strong>Delivery:</strong> 45 days | <strong>Coverage Needed:</strong> Performance Insurance</div>
            </div>
            <div style="margin-top: 10px;">
              <button class="btn" onclick="createQuote('CONTRACT-1234567890', 151000)">Provide Quote</button>
              <button class="btn success" onclick="assessRisk('CONTRACT-1234567890')">Risk Assessment</button>
            </div>
          </div>
          
          <div class="trade-item">
            <div class="trade-header">
              <span class="trade-id">CONTRACT-0987654321</span>
              <span class="risk-badge risk-low">LOW RISK</span>
            </div>
            <div style="color: #94a3b8;">
              <div><strong>Parties:</strong> Grain Masters LLC ↔ Food Processing Inc</div>
              <div><strong>Product:</strong> Wheat | <strong>Quantity:</strong> 1,000 tons</div>
              <div><strong>Value:</strong> $245,300 | <strong>Route:</strong> Midwest → East Coast</div>
              <div><strong>Delivery:</strong> 30 days | <strong>Coverage Needed:</strong> Delivery Guarantee</div>
            </div>
            <div style="margin-top: 10px;">
              <button class="btn" onclick="createQuote('CONTRACT-0987654321', 245300)">Provide Quote</button>
              <button class="btn success" onclick="assessRisk('CONTRACT-0987654321')">Risk Assessment</button>
            </div>
          </div>
          
          <div class="trade-item">
            <div class="trade-header">
              <span class="trade-id">AUCTION-001</span>
              <span class="risk-badge risk-high">HIGH RISK</span>
            </div>
            <div style="color: #94a3b8;">
              <div><strong>Type:</strong> Auction Contract | <strong>Status:</strong> Active Bidding</div>
              <div><strong>Product:</strong> Copper | <strong>Quantity:</strong> 25 tons</div>
              <div><strong>Current Bid:</strong> $198,750 | <strong>Time Left:</strong> 18h 32m</div>
              <div><strong>Coverage Needed:</strong> Auction Performance Insurance</div>
            </div>
            <div style="margin-top: 10px;">
              <button class="btn warning" onclick="createQuote('AUCTION-001', 198750)">Emergency Quote</button>
              <button class="btn danger" onclick="assessRisk('AUCTION-001')">High Risk Assessment</button>
            </div>
          </div>
        </div>
      </div>
      
      <div>
        <div class="section" style="margin-bottom: 20px;">
          <h3>📈 Risk Analytics</h3>
          <div style="background: #0f172a; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>Portfolio Risk Score:</span>
              <span style="color: #f59e0b; font-weight: bold;">7.2/10</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>Claims Ratio:</span>
              <span style="color: #10b981; font-weight: bold;">2.3%</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Avg Premium Rate:</span>
              <span style="color: #8b5cf6; font-weight: bold;">1.2%</span>
            </div>
          </div>
          
          <div style="background: #0f172a; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <h4 style="color: #06b6d4; margin-top: 0;">Risk Factors</h4>
            <div style="margin-bottom: 8px;">• Geographic: Moderate</div>
            <div style="margin-bottom: 8px;">• Commodity: Low-Medium</div>
            <div style="margin-bottom: 8px;">• Counterparty: Low</div>
            <div>• Market Volatility: Medium</div>
          </div>
          
          <button class="btn" style="width: 100%;" onclick="showRiskModal()">Full Risk Analysis</button>
        </div>
        
        <div class="section">
          <h3>🚀 Quick Actions</h3>
          <button class="btn" style="width: 100%; margin-bottom: 10px;" onclick="showQuoteModal()">Create Quote</button>
          <button class="btn success" style="width: 100%; margin-bottom: 10px;" onclick="showRiskModal()">Risk Assessment</button>
          <button class="btn warning" style="width: 100%; margin-bottom: 10px;" onclick="viewReports()">Performance Reports</button>
          <button class="btn" style="width: 100%;" onclick="contactSupport()">Support</button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Insurance Quote Modal -->
  <div id="quoteModal" class="modal">
    <div class="modal-content">
      <span class="close" onclick="closeModal('quoteModal')">&times;</span>
      <h3 style="color: #8b5cf6;">Create Insurance Quote</h3>
      <form id="quoteForm">
        <div class="form-group">
          <label>Contract ID</label>
          <input type="text" id="contractId" required>
        </div>
        <div class="form-group">
          <label>Contract Value ($)</label>
          <input type="number" id="contractValue" required readonly>
        </div>
        <div class="form-group">
          <label>Coverage Type</label>
          <select id="coverageType" required onchange="calculatePremium()">
            <option value="">Select coverage...</option>
            <option value="performance">Performance Insurance</option>
            <option value="delivery">Delivery Guarantee</option>
            <option value="quality">Quality Assurance</option>
            <option value="payment">Payment Protection</option>
          </select>
        </div>
        <div class="form-group">
          <label>Coverage Percentage (%)</label>
          <input type="number" id="coveragePercentage" value="80" min="50" max="100" required onchange="calculatePremium()">
        </div>
        <div class="form-group">
          <label>Risk Assessment</label>
          <select id="riskLevel" required onchange="calculatePremium()">
            <option value="">Select risk level...</option>
            <option value="low">Low Risk (0.5% premium)</option>
            <option value="medium">Medium Risk (1.2% premium)</option>
            <option value="high">High Risk (2.5% premium)</option>
          </select>
        </div>
        
        <div class="quote-calculator" id="quoteCalculator" style="display: none;">
          <h4 style="color: #8b5cf6; margin-top: 0;">Quote Calculation</h4>
          <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>Contract Value:</span>
            <span id="calcContractValue">$0</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>Coverage Amount:</span>
            <span id="calcCoverageAmount">$0</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>Premium Rate:</span>
            <span id="calcPremiumRate">0%</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 8px 0; font-weight: bold; color: #8b5cf6;">
            <span>Total Premium:</span>
            <span id="calcTotalPremium">$0</span>
          </div>
        </div>
        
        <div class="form-group">
          <label>Additional Terms</label>
          <textarea id="additionalTerms" rows="3" placeholder="Special conditions or requirements..."></textarea>
        </div>
        
        <button type="submit" class="btn">Generate Quote</button>
      </form>
    </div>
  </div>
  
  <!-- Risk Assessment Modal -->
  <div id="riskModal" class="modal">
    <div class="modal-content">
      <span class="close" onclick="closeModal('riskModal')">&times;</span>
      <h3 style="color: #8b5cf6;">Risk Assessment Tool</h3>
      <form id="riskForm">
        <div class="form-group">
          <label>Contract ID</label>
          <input type="text" id="riskContractId" required>
        </div>
        
        <div class="risk-factors">
          <div>
            <h4 style="color: #06b6d4;">Geographic Risk</h4>
            <div class="form-group">
              <label>Origin Country</label>
              <select id="originCountry" required>
                <option value="low">USA/EU (Low Risk)</option>
                <option value="medium">Emerging Markets (Medium)</option>
                <option value="high">High Risk Jurisdictions</option>
              </select>
            </div>
            <div class="form-group">
              <label>Shipping Route</label>
              <select id="shippingRoute" required>
                <option value="low">Established Routes (Low)</option>
                <option value="medium">Regional Routes (Medium)</option>
                <option value="high">New/Complex Routes (High)</option>
              </select>
            </div>
          </div>
          
          <div>
            <h4 style="color: #06b6d4;">Operational Risk</h4>
            <div class="form-group">
              <label>Commodity Type</label>
              <select id="commodityRisk" required>
                <option value="low">Stable Commodities (Low)</option>
                <option value="medium">Volatile Commodities (Medium)</option>
                <option value="high">High-Risk Materials (High)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Counterparty Rating</label>
              <select id="counterpartyRating" required>
                <option value="low">A+ Rated (Low Risk)</option>
                <option value="medium">B Rated (Medium Risk)</option>
                <option value="high">Unrated/New (High Risk)</option>
              </select>
            </div>
          </div>
        </div>
        
        <div style="background: #0f172a; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <h4 style="color: #f59e0b; margin-top: 0;">Risk Score: <span id="riskScore">Not Calculated</span></h4>
          <div id="riskRecommendation" style="color: #94a3b8;">Complete assessment to see recommendation</div>
        </div>
        
        <button type="submit" class="btn">Calculate Risk</button>
      </form>
    </div>
  </div>
  
  <script>
    function showQuoteModal() {
      document.getElementById('quoteModal').style.display = 'block';
    }
    
    function showRiskModal() {
      document.getElementById('riskModal').style.display = 'block';
    }
    
    function closeModal(modalId) {
      document.getElementById(modalId).style.display = 'none';
    }
    
    function createQuote(contractId, value) {
      document.getElementById('contractId').value = contractId;
      document.getElementById('contractValue').value = value;
      showQuoteModal();
    }
    
    function assessRisk(contractId) {
      document.getElementById('riskContractId').value = contractId;
      showRiskModal();
    }
    
    function calculatePremium() {
      const contractValue = parseFloat(document.getElementById('contractValue').value) || 0;
      const coveragePercentage = parseFloat(document.getElementById('coveragePercentage').value) || 0;
      const riskLevel = document.getElementById('riskLevel').value;
      
      if (contractValue > 0 && coveragePercentage > 0 && riskLevel) {
        const coverageAmount = contractValue * (coveragePercentage / 100);
        
        let premiumRate = 0;
        switch(riskLevel) {
          case 'low': premiumRate = 0.5; break;
          case 'medium': premiumRate = 1.2; break;
          case 'high': premiumRate = 2.5; break;
        }
        
        const totalPremium = coverageAmount * (premiumRate / 100);
        
        document.getElementById('calcContractValue').textContent = '$' + contractValue.toLocaleString();
        document.getElementById('calcCoverageAmount').textContent = '$' + coverageAmount.toLocaleString();
        document.getElementById('calcPremiumRate').textContent = premiumRate + '%';
        document.getElementById('calcTotalPremium').textContent = '$' + totalPremium.toLocaleString();
        document.getElementById('quoteCalculator').style.display = 'block';
      } else {
        document.getElementById('quoteCalculator').style.display = 'none';
      }
    }
    
    // Quote form submission
    document.getElementById('quoteForm').addEventListener('submit', function(e) {
      e.preventDefault();
      
      const quoteData = {
        contractId: document.getElementById('contractId').value,
        contractValue: parseFloat(document.getElementById('contractValue').value),
        coverageType: document.getElementById('coverageType').value,
        coveragePercentage: parseFloat(document.getElementById('coveragePercentage').value),
        riskLevel: document.getElementById('riskLevel').value,
        premium: parseFloat(document.getElementById('calcTotalPremium').textContent.replace('$', '').replace(',', '')),
        terms: document.getElementById('additionalTerms').value
      };
      
      alert('✅ Insurance quote generated successfully!\\nContract: ' + quoteData.contractId + '\\nPremium: $' + quoteData.premium.toLocaleString() + '\\nCoverage: $' + (quoteData.contractValue * quoteData.coveragePercentage / 100).toLocaleString());
      closeModal('quoteModal');
    });
    
    // Risk assessment form
    document.getElementById('riskForm').addEventListener('submit', function(e) {
      e.preventDefault();
      
      const riskFactors = {
        geographic: document.getElementById('originCountry').value,
        shipping: document.getElementById('shippingRoute').value,
        commodity: document.getElementById('commodityRisk').value,
        counterparty: document.getElementById('counterpartyRating').value
      };
      
      // Calculate risk score
      let score = 0;
      Object.values(riskFactors).forEach(factor => {
        switch(factor) {
          case 'low': score += 2; break;
          case 'medium': score += 5; break;
          case 'high': score += 8; break;
        }
      });
      
      const avgScore = score / 4;
      let riskLevel = 'Low';
      let recommendation = 'Standard coverage recommended';
      
      if (avgScore > 6) {
        riskLevel = 'High';
        recommendation = 'Requires enhanced due diligence and higher premiums';
      } else if (avgScore > 3) {
        riskLevel = 'Medium';
        recommendation = 'Standard coverage with additional monitoring';
      }
      
      document.getElementById('riskScore').textContent = avgScore.toFixed(1) + '/10 (' + riskLevel + ' Risk)';
      document.getElementById('riskRecommendation').textContent = recommendation;
    });
    
    function refreshTrades() {
      location.reload();
    }
    
    function viewReports() {
      alert('📊 Performance reports and analytics dashboard');
    }
    
    function contactSupport() {
      alert('📞 Insurance Support: Email us at insurance@tangent-protocol.com');
    }
  </script>
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
