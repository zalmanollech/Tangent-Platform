// Tangent Platform - Refactored Secure Server
// Enhanced with security, logging, and modular architecture

// Load environment configuration first
const { config, configUtils } = require('./lib/config');
const { logger, requestLogger, errorLogger, logUtils } = require('./lib/logger');
const { getDatabase } = require('./lib/database');
const { 
  securityHeaders, 
  rateLimits, 
  speedLimiter, 
  authMiddleware, 
  fileUploadSecurity 
} = require('./lib/security');

// Core dependencies
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');

// Initialize Express app
const app = express();

// Initialize database
const database = getDatabase();
logger.info('Database initialized successfully');

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

// Security headers (must be first)
app.use(securityHeaders);

// Compression for better performance
app.use(compression());

// CORS configuration
app.use(cors({
  origin: config.server.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Speed limiting and rate limiting (disabled in test environment)
if (config.NODE_ENV !== 'test') {
  app.use(speedLimiter);
  app.use(rateLimits.general);
}

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// ============================================================================
// API ROUTES
// ============================================================================

// Authentication routes
app.use('/auth', config.NODE_ENV !== 'test' ? rateLimits.auth : (req, res, next) => next(), require('./routes/auth'));

// KYC routes
app.use('/api/kyc', config.NODE_ENV !== 'test' ? rateLimits.upload : (req, res, next) => next(), require('./routes/kyc'));

// Trade routes
app.use('/api/trades', require('./routes/trades'));

// ============================================================================
// LEGACY ROUTES AND PAGES (for backward compatibility)
// ============================================================================

// UI Helper functions (from original server.js)
function css() {
  return `
:root{--brand:#2dd4bf;--brand-ink:#032620;--bg:#0b1220;--surface:#0f172a;--card:#111a2c;--ink:#e6eefc;--muted:#9fb0ce;--line:#223253;--chip:#1b2a46;--radius:16px;--shadow:0 10px 30px rgba(0,0,0,.35)}
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,segoe ui,roboto,sans-serif;background:var(--bg);color:var(--ink);line-height:1.6}
.wrap{max-width:1200px;margin:0 auto;padding:0 16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:20px;margin:12px 0}
.grid{display:grid}.grid-2{grid-template-columns:1fr 1fr;gap:16px}.grid-3{grid-template-columns:1fr 1fr 1fr;gap:16px}
.row{display:flex;gap:12px;align-items:center}.row.mt{margin-top:16px}
.btn{background:var(--brand);color:var(--brand-ink);border:none;padding:12px 20px;border-radius:12px;font-weight:600;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:8px;transition:all 0.2s}
.btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(45,212,191,0.3)}.btn.ghost{background:transparent;color:var(--brand);border:1px solid var(--brand)}
.btn.xs{padding:6px 12px;font-size:13px}.btn:disabled{opacity:0.5;cursor:not-allowed}
.in{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:12px;color:var(--ink);width:100%}.in:focus{outline:none;border-color:var(--brand)}
.lbl{display:block;margin:8px 0 4px;font-weight:500;color:var(--muted)}
h1,h2,h3{margin:16px 0 8px;line-height:1.3}h1{font-size:32px}h2{font-size:24px}h3{font-size:20px}
.hero{background:linear-gradient(135deg,var(--brand),#059669);color:var(--brand-ink);padding:40px;border-radius:var(--radius);margin:20px 0;text-align:center}
.topbar{display:flex;align-items:center;gap:16px;padding:12px 0;border-bottom:1px solid var(--line);margin-bottom:20px}
.topbar .logo{display:flex;align-items:center;gap:8px;font-weight:bold;font-size:18px}
.topbar nav{display:flex;gap:4px}.topbar nav a{padding:8px 16px;border-radius:8px;text-decoration:none;color:var(--muted);transition:all 0.2s}
.topbar nav a:hover,.topbar nav a.active{background:var(--chip);color:var(--ink)}
.sp{flex:1}.badge{background:var(--chip);color:var(--ink);padding:4px 8px;border-radius:6px;font-size:12px}
.table-wrap{overflow-x:auto}.table-wrap table{width:100%;border-collapse:collapse}
.table-wrap th,.table-wrap td{padding:12px;text-align:left;border-bottom:1px solid var(--line)}
.table-wrap th{background:var(--surface);font-weight:600;color:var(--muted)}
.small{font-size:12px;color:var(--muted)}.muted{color:var(--muted)}.mt{margin-top:12px}.footer{margin:24px 0 40px;text-align:center;color:var(--muted)}
`;
}

function logo() {
  return `<svg width="24" height="24" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block"><rect x="2" y="2" width="24" height="24" rx="6" fill="#2dd4bf"/><path d="M9 14h10M14 9v10" stroke="#042925" stroke-width="2.4" stroke-linecap="round"/></svg>`;
}

function baseHead(title) {
  return `<!doctype html><html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 28'><rect x='2' y='2' width='24' height='24' rx='6' fill='%232dd4bf'/></svg>">
<style>${css()}</style>
<script>
function getRole(){try{return localStorage.getItem('role')||'buyer'}catch(e){return'buyer'}}
function setRole(r){try{localStorage.setItem('role',r)}catch(e){};const el=document.querySelector('#roleShow');if(el)el.textContent=r;}
function clearKey(){try{localStorage.removeItem('apiKey')}catch(e){}; alert('Cleared'); location.reload()}
function setToken(t){try{localStorage.setItem('authToken',t)}catch(e){}}
function getToken(){try{return localStorage.getItem('authToken')||''}catch(e){return''}}
async function api(path,opts){opts=opts||{};opts.headers=opts.headers||{};opts.headers['x-auth-token']=getToken(); if(!opts.headers['Content-Type'] && !(opts.body instanceof FormData)) opts.headers['Content-Type']='application/json'; const r=await fetch(path,opts); if(!r.ok){const tx=await r.text(); throw new Error(tx)}; return r.json();}
async function login(email,pass){const r=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})});const j=await r.json(); if(j.token){setToken(j.token); alert('Logged in'); location.reload()} else alert(j.error||'login failed')}
async function register(email,pass,role){const r=await fetch('/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass,role})});const j=await r.json(); if(j.token){setToken(j.token); alert('Registered'); location.reload()} else alert(j.error||'register failed')}
</script>
</head>`;
}

function nav(active = "") {
  const tabs = [
    ["Home", "/portal"],
    ["Trade Desk", "/portal/trade"],
    ["Auctions", "/portal/auctions"],
    ["Insurance", "/portal/insurance"],
    ["KYC", "/portal/kyc"],
    ["Demo", "/portal/interactive-demo"],
    ["Admin", "/portal/admin"]
  ];
  const items = tabs.map(([l, h]) => `<a class="${l === active ? 'active' : ''}" href="${h}">${l}</a>`).join("");
  return `<header class="topbar">
    <div class="logo">${logo()}<span>Tangent</span></div>
    <nav>${items}</nav>
    <span class="sp"></span>
    <span class="badge">Role: <b id="roleShow"></b></span>
    <button class="btn xs ghost" onclick="setRole(getRole()==='buyer'?'supplier':'buyer')">Toggle Role</button>
    <span class="badge" id="walletBadge">Wallet: -</span>
    <button class="btn xs" id="wcBtn" onclick="connectWallet()">Connect Wallet</button>
  </header>
  <script>
    let userAddress=null;
    async function connectWallet(){
      if(!window.ethereum){ alert('No wallet found'); return;}
      const acc = await window.ethereum.request({ method: 'eth_requestAccounts' });
      userAddress = acc && acc[0];
      document.getElementById('walletBadge').textContent = 'Wallet: ' + (userAddress? (userAddress.slice(0,6)+'…'+userAddress.slice(-4)):'-');
    }
    document.addEventListener('DOMContentLoaded',()=>{setRole(getRole());});
  </script>`;
}

// Page functions (simplified versions for backward compatibility)
function pageHome() {
  return `
${baseHead("Tangent — Secure Trading Platform")}
<body>
${nav("Home")}
  <main class="wrap">
    <section class="hero">
      <h1>🌍 Secure Global Commodity Trading</h1>
      <p>Enhanced with enterprise-grade security, comprehensive logging, and blockchain integration. Trade with confidence on our upgraded platform.</p>
      
      <div class="card" style="margin-top: 20px; background: rgba(45, 212, 191, 0.05); border: 1px solid rgba(45, 212, 191, 0.2);">
        <h3>✨ Platform Features:</h3>
        <ul style="margin: 10px 0; padding-left: 20px; color: var(--muted);">
          <li><strong>Enhanced Security:</strong> JWT tokens, rate limiting, input validation</li>
          <li><strong>Comprehensive Logging:</strong> Audit trails, security monitoring</li>
          <li><strong>Modular Architecture:</strong> Scalable, maintainable codebase</li>
          <li><strong>Database Integration:</strong> Robust data management</li>
          <li><strong>API Documentation:</strong> RESTful endpoints with validation</li>
        </ul>
      </div>
      
      <div class="stack" style="margin-top: 20px;">
        <a class="btn" href="/portal/kyc" style="background: linear-gradient(135deg, #3b82f6, #10b981); color: white;">🚀 Start KYC Process</a>
        <a class="btn ghost" href="/api/docs/endpoints">📚 API Documentation</a>
      </div>
    </section>
  </main>
</body></html>
`;
}

// KYC page function for backward compatibility
function pageKYC() {
  return `
${baseHead("Tangent — Automated KYC & Document Processing")}
<body>
${nav("KYC")}
  <main class="wrap">
    <section class="hero" style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; border-radius: 16px; margin-bottom: 30px;">
      <h1>🤖 Automated KYC & Document Processing</h1>
      <p>Upload your official documents and our AI will extract all required information automatically. No manual form filling required!</p>
    </section>
    
    <!-- Entity Type Selection -->
    <section class="card">
      <h2>📋 Entity Type Selection</h2>
      <p class="muted">Select your entity type to see the required documents. Our system will automatically extract all necessary information.</p>
      
      <div class="grid grid-2" style="gap: 20px; margin: 20px 0;">
        <div class="card entity-option" data-entity="private" style="border: 2px solid #e5e7eb; cursor: pointer; transition: all 0.3s;">
          <h3>🏢 Private Company</h3>
          <p class="muted">Limited liability company, LLC, Partnership, or similar private entity</p>
          <div class="small" style="color: #10b981; font-weight: bold;">Required Documents:</div>
          <ul class="small muted" style="margin: 10px 0 0 20px;">
            <li>Certificate of Incorporation</li>
            <li>Articles of Association / Bylaws</li>
            <li>UBO Passport/ID + Proof of Residence</li>
            <li>Financial Statements (last 2 years)</li>
          </ul>
        </div>
        
        <div class="card entity-option" data-entity="public" style="border: 2px solid #e5e7eb; cursor: pointer; transition: all 0.3s;">
          <h3>🏛️ Public Company</h3>
          <p class="muted">Publicly traded company listed on a recognized exchange</p>
          <div class="small" style="color: #10b981; font-weight: bold;">Required Documents:</div>
          <ul class="small muted" style="margin: 10px 0 0 20px;">
            <li>Latest 10-K/Annual Report</li>
            <li>Exchange Symbol & Trading Info</li>
            <li>Board Resolution (if applicable)</li>
            <li>Authorized Signatory Documents</li>
          </ul>
        </div>
      </div>
    </section>
    
    <!-- Document Upload Section -->
    <section class="card" id="documentUploadSection" style="display: none;">
      <h2>📄 Document Upload & Processing</h2>
      <p class="muted">Upload your documents in PDF or image format. Our AI will automatically extract and verify all information.</p>
      
      <div id="documentRequirements"></div>
      
      <form id="documentUploadForm" action="/api/kyc/submit" method="post" enctype="multipart/form-data">
        <div id="uploadAreas"></div>
        
        <!-- Crypto Experience Assessment -->
        <div class="card" style="background: rgba(45,212,191,0.05); border: 1px solid var(--brand);">
          <h3 style="color: var(--brand); margin-bottom: 15px;">💰 Cryptocurrency Experience</h3>
          <div style="margin: 20px 0;">
            <label style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; padding: 10px; border: 1px solid var(--line); border-radius: 8px; cursor: pointer;">
              <input type="radio" name="cryptoExperience" value="beginner" style="margin: 0;">
              <div>
                <div style="font-weight: 600; color: var(--ink);">I am new to cryptocurrency</div>
                <div class="small muted">I need guidance with wallet setup and crypto basics</div>
              </div>
            </label>
            
            <label style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; padding: 10px; border: 1px solid var(--line); border-radius: 8px; cursor: pointer;">
              <input type="radio" name="cryptoExperience" value="intermediate" style="margin: 0;">
              <div>
                <div style="font-weight: 600; color: var(--ink);">I have some experience</div>
                <div class="small muted">I know the basics but may need some help</div>
              </div>
            </label>
            
            <label style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; padding: 10px; border: 1px solid var(--line); border-radius: 8px; cursor: pointer;">
              <input type="radio" name="cryptoExperience" value="expert" style="margin: 0;">
              <div>
                <div style="font-weight: 600; color: var(--ink);">I am experienced with cryptocurrency</div>
                <div class="small muted">I have my own wallet and understand DeFi</div>
              </div>
            </label>
          </div>
        </div>

        <div class="row mt">
          <button class="btn" type="submit" style="background: #10b981; color: white;">🚀 Process Documents & Complete KYC</button>
        </div>
      </form>
    </section>
  </main>
  
  <script>
    let selectedEntityType = null;
    
    document.addEventListener('DOMContentLoaded', function() {
      const entityOptions = document.querySelectorAll('.entity-option');
      
      entityOptions.forEach(option => {
        option.addEventListener('click', function() {
          entityOptions.forEach(opt => {
            opt.style.borderColor = '#e5e7eb';
            opt.style.background = '';
          });
          
          this.style.borderColor = '#10b981';
          this.style.background = 'rgba(16,185,129,0.05)';
          
          selectedEntityType = this.dataset.entity;
          showDocumentUpload(selectedEntityType);
        });
      });
      
      // Handle form submission
      document.getElementById('documentUploadForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        formData.append('entityType', selectedEntityType);
        
        try {
          const response = await fetch('/api/kyc/submit', {
            method: 'POST',
            headers: {
              'x-auth-token': getToken()
            },
            body: formData
          });
          
          const result = await response.json();
          
          if (result.success) {
            alert('KYC submitted successfully!');
            window.location.href = '/portal';
          } else {
            alert('Error: ' + (result.error || 'Submission failed'));
          }
        } catch (error) {
          alert('Error submitting KYC: ' + error.message);
        }
      });
    });
    
    function showDocumentUpload(entityType) {
      document.getElementById('documentUploadSection').style.display = 'block';
      
      const requirements = entityType === 'private' ? [
        { id: 'incorporation', name: 'Certificate of Incorporation', required: true },
        { id: 'bylaws', name: 'Articles of Association / Bylaws', required: true },
        { id: 'ubo_docs', name: 'UBO Documents', required: true },
        { id: 'financials', name: 'Financial Statements', required: true }
      ] : [
        { id: 'annual_report', name: 'Latest Annual Report', required: true },
        { id: 'exchange_info', name: 'Exchange Information', required: true },
        { id: 'board_resolution', name: 'Board Resolution', required: false },
        { id: 'signatory_docs', name: 'Signatory Documents', required: true }
      ];
      
      let uploadHTML = '<h3>📋 Required Documents for ' + (entityType === 'private' ? 'Private Company' : 'Public Company') + '</h3>';
      requirements.forEach(req => {
        uploadHTML += '<div class="card" style="margin: 15px 0;"><h4>' + req.name + (req.required ? ' <span style="color: #ef4444;">*</span>' : ' <span class="muted">(Optional)</span>') + '</h4><input class="in" name="files" type="file" accept=".pdf,.jpg,.jpeg,.png" ' + (req.required ? 'required' : '') + '></div>';
      });
      
      document.getElementById('uploadAreas').innerHTML = uploadHTML;
    }
  </script>
</body></html>
`;
}

// ============================================================================
// LEGACY ROUTES (for backward compatibility)
// ============================================================================

// Portal routes
app.get('/', (req, res) => res.redirect('/portal'));
app.get('/portal', (req, res) => res.send(pageHome()));
app.get('/portal/kyc', (req, res) => res.send(pageKYC()));

// ============================================================================
// API DOCUMENTATION
// ============================================================================

app.get('/api/docs/endpoints', (req, res) => {
  const endpoints = {
    info: {
      name: 'Tangent Platform API',
      version: '2.0.0',
      description: 'Enhanced secure trading platform with comprehensive features'
    },
    authentication: [
      'POST /auth/register - User registration with validation',
      'POST /auth/login - User authentication with JWT',
      'POST /auth/logout - User logout (logging only)',
      'GET /auth/profile - Get user profile',
      'PUT /auth/profile - Update user profile',
      'POST /auth/change-password - Change user password',
      'POST /auth/verify-token - Verify JWT token'
    ],
    kyc: [
      'POST /api/kyc/submit - Submit KYC application with documents',
      'GET /api/kyc/status - Get KYC status for current user',
      'GET /api/kyc/submission/:id - Get specific KYC submission',
      'GET /api/kyc/admin/submissions - Admin: List all submissions',
      'POST /api/kyc/admin/review/:id - Admin: Review KYC submission'
    ],
    trades: [
      'GET /api/trades - List all trades with filtering',
      'GET /api/trades/my-trades - Get current user\'s trades',
      'GET /api/trades/:id - Get specific trade details',
      'POST /api/trades - Create new trade',
      'PATCH /api/trades/:id/status - Update trade status',
      'POST /api/trades/:id/deposit - Record trade deposit',
      'POST /api/trades/:id/confirm - Confirm trade (supplier)',
      'GET /api/trades/analytics/summary - Get trade analytics'
    ],
    features: {
      security: ['JWT authentication', 'Rate limiting', 'Input validation', 'Security headers'],
      logging: ['Request logging', 'Error tracking', 'Audit trails', 'Security monitoring'],
      validation: ['Schema validation', 'File upload security', 'Business rule validation'],
      architecture: ['Modular design', 'Database abstraction', 'Configuration management']
    }
  };
  
  res.json(endpoints);
});

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: config.NODE_ENV,
    features: {
      database: 'operational',
      logging: 'operational',
      security: 'operational',
      blockchain: configUtils.isFeatureEnabled('blockchainEnabled') ? 'operational' : 'disabled'
    },
    uptime: process.uptime()
  };
  
  res.json(health);
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
  logUtils.logSecurity('404_not_found', { url: req.originalUrl }, req);
  res.status(404).json({
    error: 'Endpoint not found',
    message: `${req.method} ${req.originalUrl} is not a valid endpoint`,
    availableEndpoints: '/api/docs/endpoints'
  });
});

// Error handling middleware
app.use(errorLogger);
app.use((err, req, res, next) => {
  // Log the error
  logUtils.logError(err, {
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    params: req.params
  }, req);
  
  // Handle specific error types
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }
  
  if (err.message.includes('Validation failed')) {
    return res.status(400).json({ error: err.message });
  }
  
  // Generic error response
  const errorId = require('uuid').v4().split('-')[0];
  res.status(500).json({
    error: 'Internal server error',
    errorId,
    message: config.isDevelopment ? err.message : 'Something went wrong'
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = config.server.port;
const HOST = config.server.host;

app.listen(PORT, HOST, () => {
  logger.info(`🚀 Tangent Platform Server Started`, {
    port: PORT,
    host: HOST,
    environment: config.NODE_ENV,
    features: config.platform.features,
    timestamp: new Date().toISOString()
  });
  
  // Log system information
  logUtils.logBusiness('server_startup', {
    port: PORT,
    nodeVersion: process.version,
    platform: process.platform,
    features: Object.keys(config.platform.features).filter(f => config.platform.features[f])
  });
  
  console.log(`
╔════════════════════════════════════════════════════════════════════════════════╗
║                        🎯 TANGENT PLATFORM v2.0                               ║
║                     Enhanced Secure Trading Platform                          ║
╠════════════════════════════════════════════════════════════════════════════════╣
║ 🌐 Server: http://${HOST}:${PORT}                                     ║
║ 📚 API Docs: http://${HOST}:${PORT}/api/docs/endpoints                ║
║ 🔧 Health: http://${HOST}:${PORT}/health                              ║
║                                                                                ║
║ ✅ Enhanced Security: JWT, Rate Limiting, Validation                          ║
║ ✅ Comprehensive Logging: Audit, Security, Performance                        ║
║ ✅ Modular Architecture: Scalable, Maintainable                               ║
║ ✅ Database Integration: Robust Data Management                               ║
╚════════════════════════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;
