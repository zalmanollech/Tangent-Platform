// Tangent Platform - Refactored Secure Server
// Enhanced with security, logging, and modular architecture

// Load environment configuration first
const { config, configUtils } = require('./lib/config');
const { logger, requestLogger, errorLogger, logUtils } = require('./lib/logger');
const { getDatabase } = require('./lib/database');
const websocketService = require('./lib/websocket');
const { 
  securityHeaders, 
  rateLimits, 
  speedLimiter, 
  authMiddleware, 
  fileUploadSecurity 
} = require('./lib/security');
const { routeHandler } = require('./lib/access-control');
const { initializeBulletproofAuth } = require('./lib/bulletproof-auth');

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

// Access control routing (CRITICAL: Must be before other routes)
app.use(routeHandler);

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

// TGT Stablecoin routes
app.use('/api/tgt', require('./routes/tgt'));

// Unified registration routes
app.use('/api/unified-register', require('./routes/unified-register'));

// Admin setup routes (one-time use)
app.use('/admin-setup', require('./routes/admin-setup'));

// Emergency setup routes (backup method)
app.use('/emergency', require('./routes/emergency-setup'));
app.use('/api/admin', require('./routes/admin'));
app.use('/setup', require('./routes/setup'));

// One-time admin activation endpoint (temporary)
app.post('/activate-admin', async (req, res) => {
  try {
    const { activateAdminAccount } = require('./scripts/activate-admin');
    const result = await activateAdminAccount();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// LEGACY ROUTES AND PAGES (for backward compatibility)
// ============================================================================

// UI Helper functions (from original server.js)
function css() {
  return `
:root{
  --brand:#3b82f6;
  --brand-secondary:#10b981;
  --brand-ink:#ffffff;
  --bg:#0f172a;
  --surface:#1e293b;
  --card:#334155;
  --ink:#f1f5f9;
  --muted:#94a3b8;
  --line:#475569;
  --chip:#64748b;
  --radius:16px;
  --shadow:0 15px 40px rgba(59, 130, 246, 0.3);
}
*{margin:0;padding:0;box-sizing:border-box}
body{
  font-family:'Inter', -apple-system,BlinkMacSystemFont,segoe ui,roboto,sans-serif;
  background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color:var(--ink);
  line-height:1.6;
  min-height:100vh;
}
.wrap{max-width:1200px;margin:0 auto;padding:0 20px}
.card{
  background:linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(51, 65, 85, 0.8));
  border:1px solid var(--line);
  border-radius:var(--radius);
  padding:30px;
  margin:20px 0;
  box-shadow:var(--shadow);
  backdrop-filter:blur(10px);
}
.grid{display:grid}.grid-2{grid-template-columns:1fr 1fr;gap:24px}.grid-3{grid-template-columns:1fr 1fr 1fr;gap:24px}
.row{display:flex;gap:15px;align-items:center}.row.mt{margin-top:20px}
.btn{
  background:linear-gradient(135deg,var(--brand),var(--brand-secondary));
  color:var(--brand-ink);
  border:none;
  padding:14px 28px;
  border-radius:12px;
  font-weight:600;
  cursor:pointer;
  text-decoration:none;
  display:inline-flex;
  align-items:center;
  gap:10px;
  transition:all 0.3s;
  box-shadow:0 4px 15px rgba(59, 130, 246, 0.3);
}
.btn:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(59, 130, 246, 0.4)}
.btn.ghost{background:transparent;color:var(--brand);border:2px solid var(--brand)}
.btn.xs{padding:8px 16px;font-size:14px}.btn:disabled{opacity:0.5;cursor:not-allowed}
.in{
  background:var(--surface);
  border:2px solid var(--line);
  border-radius:12px;
  padding:14px;
  color:var(--ink);
  width:100%;
  transition:all 0.3s;
}
.in:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px rgba(59, 130, 246, 0.1)}
.lbl{display:block;margin:12px 0 6px;font-weight:600;color:var(--ink)}
h1,h2,h3{margin:20px 0 12px;line-height:1.3;background:linear-gradient(135deg, #3b82f6, #10b981);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
h1{font-size:36px}h2{font-size:28px}h3{font-size:24px}
.hero{
  background:linear-gradient(135deg,var(--brand),var(--brand-secondary));
  color:var(--brand-ink);
  padding:50px;
  border-radius:var(--radius);
  margin:30px 0;
  text-align:center;
  box-shadow:var(--shadow);
}
.topbar{
  display:flex;
  align-items:center;
  gap:20px;
  padding:16px 0;
  border-bottom:2px solid var(--line);
  margin-bottom:30px;
  background:rgba(30, 41, 59, 0.8);
  backdrop-filter:blur(10px);
  border-radius:var(--radius);
  padding:20px;
}
.topbar .logo{display:flex;align-items:center;gap:12px;font-weight:bold;font-size:20px;color:var(--brand)}
.topbar nav{display:flex;gap:8px}
.topbar nav a{
  padding:12px 20px;
  border-radius:12px;
  text-decoration:none;
  color:var(--muted);
  transition:all 0.3s;
  font-weight:500;
}
.topbar nav a:hover,.topbar nav a.active{
  background:linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(16, 185, 129, 0.2));
  color:var(--ink);
  transform:translateY(-1px);
}
.sp{flex:1}
.badge{
  background:linear-gradient(135deg, var(--brand), var(--brand-secondary));
  color:var(--brand-ink);
  padding:6px 12px;
  border-radius:8px;
  font-size:12px;
  font-weight:600;
}
.table-wrap{overflow-x:auto;border-radius:var(--radius);overflow:hidden}
.table-wrap table{width:100%;border-collapse:collapse;background:var(--surface)}
.table-wrap th,.table-wrap td{padding:16px;text-align:left;border-bottom:1px solid var(--line)}
.table-wrap th{background:var(--card);font-weight:600;color:var(--ink)}
.small{font-size:13px;color:var(--muted)}
.muted{color:var(--muted)}
.mt{margin-top:20px}
.footer{margin:40px 0;text-align:center;color:var(--muted)}
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
    ["Admin", "/admin"]
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

// Enhanced public landing page
function pageLanding() {
  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const accessDenied = urlParams.get('access') === 'denied';
  
  return `
${baseHead("Tangent Platform — Global Commodity Trading")}
<body style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); min-height: 100vh;">
  <div style="max-width: 1200px; margin: 0 auto; padding: 40px 20px;">
    
    ${accessDenied ? `
    <!-- Access Denied Notice -->
    <div style="background: linear-gradient(135deg, #fecaca 0%, #fca5a5 100%); border: 1px solid #ef4444; border-radius: 16px; padding: 20px; margin-bottom: 40px; text-align: center;">
      <h3 style="margin: 0 0 12px; color: #991b1b;">🔒 Platform Access Restricted</h3>
      <p style="margin: 0; color: #991b1b; font-size: 14px;">
        The trading platform is currently accessible by authorized team members only.
        <br>Please contact support for access.
      </p>
    </div>
    ` : ''}
    
    <!-- Header -->
    <header style="text-align: center; margin-bottom: 60px;">
      <div style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 20px;">
        ${logo()}
        <h1 style="font-size: 42px; font-weight: 700; background: linear-gradient(135deg, #3b82f6, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">
          Tangent Platform
        </h1>
      </div>
      <p style="font-size: 24px; color: #94a3b8; max-width: 600px; margin: 0 auto; line-height: 1.4;">
        The Future of Secure Global Commodity Trading
      </p>
    </header>

    <!-- Main Value Proposition -->
    <section style="text-align: center; margin-bottom: 40px;">
      <h2 style="font-size: 36px; color: #f1f5f9; margin-bottom: 20px; font-weight: 600;">
        The Future of Commodity Trading & Digital Currency
      </h2>
      <p style="font-size: 18px; color: #cbd5e1; max-width: 900px; margin: 0 auto 50px; line-height: 1.6;">
        We're building the next generation of commodity trading infrastructure and introducing TGT stablecoin - 
        revolutionizing both traditional trade finance and digital currency stability.
      </p>
    </section>

    <!-- Split Layout: Platform & TGT -->
    <section style="margin-bottom: 60px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; max-width: 1200px; margin: 0 auto;">
        
        <!-- Left Side: Trading Platform -->
        <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(29, 78, 216, 0.1)); padding: 40px; border-radius: 24px; border: 2px solid rgba(59, 130, 246, 0.3); position: relative; overflow: hidden;">
          <div style="position: absolute; top: -30%; left: -20%; width: 150px; height: 150px; background: radial-gradient(circle, rgba(59, 130, 246, 0.1), transparent); border-radius: 50%;"></div>
          <div style="position: relative; z-index: 2;">
            <h3 style="color: #3b82f6; margin-bottom: 20px; font-size: 28px; font-weight: 700; text-align: center;">
              🏢 Tangent Trading Platform
            </h3>
            <p style="color: #e2e8f0; margin-bottom: 30px; font-size: 16px; line-height: 1.6; text-align: center;">
              Revolutionary trade finance infrastructure with AI-powered processing and blockchain security.
            </p>
            
            <!-- Platform Features -->
            <div style="display: grid; gap: 20px; margin-bottom: 30px;">
              <div style="background: rgba(15, 23, 42, 0.7); padding: 20px; border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.2);">
                <h4 style="color: #3b82f6; font-size: 16px; margin-bottom: 8px;">🔒 Enterprise Security</h4>
                <p style="color: #cbd5e1; font-size: 13px; line-height: 1.4; margin: 0;">
                  Bank-grade security with comprehensive audit trails and enterprise-level access controls.
                </p>
      </div>
              
              <div style="background: rgba(15, 23, 42, 0.7); padding: 20px; border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.2);">
                <h4 style="color: #3b82f6; font-size: 16px; margin-bottom: 8px;">🤖 AI-Powered Processing</h4>
                <p style="color: #cbd5e1; font-size: 13px; line-height: 1.4; margin: 0;">
                  Advanced document analysis reducing processing time from days to minutes.
                </p>
              </div>
              
              <div style="background: rgba(15, 23, 42, 0.7); padding: 20px; border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.2);">
                <h4 style="color: #3b82f6; font-size: 16px; margin-bottom: 8px;">⚡ Smart Contracts</h4>
                <p style="color: #cbd5e1; font-size: 13px; line-height: 1.4; margin: 0;">
                  Automated escrow and settlement with zero counterparty risk.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Right Side: TGT Stablecoin -->
        <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 182, 212, 0.1)); padding: 40px; border-radius: 24px; border: 2px solid rgba(16, 185, 129, 0.3); position: relative; overflow: hidden;">
          <div style="position: absolute; top: -30%; right: -20%; width: 150px; height: 150px; background: radial-gradient(circle, rgba(16, 185, 129, 0.1), transparent); border-radius: 50%;"></div>
          <div style="position: relative; z-index: 2;">
            <h3 style="color: #10b981; margin-bottom: 20px; font-size: 28px; font-weight: 700; text-align: center;">
              💎 TGT Stablecoin
            </h3>
            <p style="color: #e2e8f0; margin-bottom: 30px; font-size: 16px; line-height: 1.6; text-align: center;">
              Commodity-backed stable digital currency designed for global trading and commerce.
            </p>
            
            <!-- TGT Features -->
            <div style="display: grid; gap: 20px; margin-bottom: 30px;">
              <div style="background: rgba(15, 23, 42, 0.7); padding: 20px; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.2);">
                <h4 style="color: #10b981; font-size: 16px; margin-bottom: 8px;">🏦 Real Asset Backing</h4>
                <p style="color: #cbd5e1; font-size: 13px; line-height: 1.4; margin: 0;">
                  Backed by diversified commodity reserves for unprecedented stability.
                </p>
              </div>
              
              <div style="background: rgba(15, 23, 42, 0.7); padding: 20px; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.2);">
                <h4 style="color: #10b981; font-size: 16px; margin-bottom: 8px;">⚡ Instant Settlement</h4>
                <p style="color: #cbd5e1; font-size: 13px; line-height: 1.4; margin: 0;">
                  24/7 global transactions with near-instant settlement capabilities.
                </p>
              </div>
              
              <div style="background: rgba(15, 23, 42, 0.7); padding: 20px; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.2);">
                <h4 style="color: #10b981; font-size: 16px; margin-bottom: 8px;">🌐 Global Access</h4>
                <p style="color: #cbd5e1; font-size: 13px; line-height: 1.4; margin: 0;">
                  Cross-border trading without conversion fees or regulatory friction.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Mobile Responsive View -->
      <style>
        @media (max-width: 768px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            display: block !important;
          }
          div[style*="grid-template-columns: 1fr 1fr"] > div {
            margin-bottom: 30px !important;
          }
        }
      </style>
    </section>

    <!-- Single Registration CTA -->
    <section style="text-align: center; margin-bottom: 60px;">
      <div style="background: rgba(30, 41, 59, 0.8); padding: 50px; border-radius: 24px; border: 1px solid #334155; margin: 40px auto; max-width: 700px;">
        <h3 style="color: #f1f5f9; margin-bottom: 20px; font-size: 32px; font-weight: 700;">
          🚀 Join the Revolution
        </h3>
        <p style="color: #cbd5e1; margin-bottom: 35px; font-size: 18px; line-height: 1.6;">
          Be among the first to access our revolutionary trading platform and TGT stablecoin. 
          Register your interest and we'll notify you when they become available.
        </p>
        
        <button onclick="showUnifiedRegistration()" style="background: linear-gradient(135deg, #3b82f6, #10b981); color: white; border: none; padding: 20px 40px; border-radius: 16px; font-size: 20px; font-weight: 700; cursor: pointer; box-shadow: 0 15px 40px rgba(59, 130, 246, 0.4); transition: all 0.3s; transform: translateY(0px);" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 20px 50px rgba(59, 130, 246, 0.5)'" onmouseout="this.style.transform='translateY(0px)'; this.style.boxShadow='0 15px 40px rgba(59, 130, 246, 0.4)'">
          📧 Register Your Interest
        </button>
        
        <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
          Choose your interests: Trading Platform • TGT Stablecoin • Both
        </p>
      </div>
    </section>

    <!-- Platform Overview Section -->
    <section style="margin-bottom: 60px;">
      <h3 style="text-align: center; font-size: 28px; color: #f1f5f9; margin-bottom: 20px;">The Tangent Platform Advantage</h3>
      <p style="text-align: center; font-size: 18px; color: #cbd5e1; max-width: 800px; margin: 0 auto 50px; line-height: 1.6;">
        We're not just another trading platform. We're the first protocolized trade finance engine that combines 
        traditional commodity trading with cutting-edge technology to create unprecedented efficiency and security.
      </p>
      
      <!-- Platform Features Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; margin-bottom: 50px;">
        
        <div style="background: rgba(30, 41, 59, 0.8); padding: 30px; border-radius: 16px; border: 1px solid #334155;">
          <h4 style="color: #3b82f6; font-size: 20px; margin-bottom: 15px;">🔒 Enterprise Security</h4>
          <p style="color: #cbd5e1; line-height: 1.6;">Bank-grade security with multi-factor authentication, comprehensive audit trails, and enterprise-level access controls that exceed traditional banking standards.</p>
        </div>
        
        <div style="background: rgba(30, 41, 59, 0.8); padding: 30px; border-radius: 16px; border: 1px solid #334155;">
          <h4 style="color: #10b981; font-size: 20px; margin-bottom: 15px;">🤖 AI-Powered Processing</h4>
          <p style="color: #cbd5e1; line-height: 1.6;">Advanced AI document analysis and automated compliance checking that reduces processing time from days to minutes while maintaining 99.9% accuracy.</p>
        </div>
        
        <div style="background: rgba(30, 41, 59, 0.8); padding: 30px; border-radius: 16px; border: 1px solid #334155;">
          <h4 style="color: #06b6d4; font-size: 20px; margin-bottom: 15px;">⚡ Blockchain Integration</h4>
          <p style="color: #cbd5e1; line-height: 1.6;">Transparent, immutable transaction records with smart contract automation for secure escrow, eliminating counterparty risk and reducing settlement time by 90%.</p>
        </div>
        
        <div style="background: rgba(30, 41, 59, 0.8); padding: 30px; border-radius: 16px; border: 1px solid #334155;">
          <h4 style="color: #f59e0b; font-size: 20px; margin-bottom: 15px;">🌾 Commodity-Focused</h4>
          <p style="color: #cbd5e1; line-height: 1.6;">Built specifically for commodity trading with specialized tools for agricultural, energy, and metals markets, not adapted from generic trading platforms.</p>
        </div>
        
        <div style="background: rgba(30, 41, 59, 0.8); padding: 30px; border-radius: 16px; border: 1px solid #334155;">
          <h4 style="color: #8b5cf6; font-size: 20px; margin-bottom: 15px;">📊 Real-Time Analytics</h4>
          <p style="color: #cbd5e1; line-height: 1.6;">Live market data integration with predictive analytics and risk assessment tools that help traders make informed decisions in real-time.</p>
        </div>
        
        <div style="background: rgba(30, 41, 59, 0.8); padding: 30px; border-radius: 16px; border: 1px solid #334155;">
          <h4 style="color: #ef4444; font-size: 20px; margin-bottom: 15px;">🌍 Global Network</h4>
          <p style="color: #cbd5e1; line-height: 1.6;">Connect with verified suppliers, buyers, and traders worldwide through our secure network, expanding your market reach and opportunities.</p>
        </div>
        
      </div>
      
      <!-- Unique Value Proposition -->
      <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(16, 185, 129, 0.1)); padding: 40px; border-radius: 20px; border: 2px solid rgba(59, 130, 246, 0.3); margin: 40px auto; max-width: 900px;">
        <h4 style="color: #3b82f6; text-align: center; font-size: 24px; margin-bottom: 20px;">🚀 Why Tangent Platform is Revolutionary</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
          <div style="text-align: center;">
            <div style="font-size: 36px; margin-bottom: 10px;">⚡</div>
            <h5 style="color: #f1f5f9; margin-bottom: 8px;">90% Faster Settlement</h5>
            <p style="color: #cbd5e1; font-size: 14px;">From days to minutes with blockchain automation</p>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 36px; margin-bottom: 10px;">💰</div>
            <h5 style="color: #f1f5f9; margin-bottom: 8px;">60% Cost Reduction</h5>
            <p style="color: #cbd5e1; font-size: 14px;">Eliminate middlemen and reduce transaction fees</p>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 36px; margin-bottom: 10px;">🔒</div>
            <h5 style="color: #f1f5f9; margin-bottom: 8px;">Zero Counterparty Risk</h5>
            <p style="color: #cbd5e1; font-size: 14px;">Smart contracts ensure secure, automated escrow</p>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 36px; margin-bottom: 10px;">🌐</div>
            <h5 style="color: #f1f5f9; margin-bottom: 8px;">24/7 Global Access</h5>
            <p style="color: #cbd5e1; font-size: 14px;">Trade anytime, anywhere with instant execution</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Team Access Section -->
    <section style="margin-bottom: 40px;">
      <div style="text-align: center; padding: 30px; background: rgba(15, 23, 42, 0.5); border-radius: 16px; border: 1px solid #334155; margin: 0 auto; max-width: 500px;">
        <p style="color: #64748b; font-size: 14px; margin-bottom: 15px;">
          Team Member Access
        </p>
        <button onclick="showTeamSignIn()" style="background: linear-gradient(135deg, #64748b, #475569); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s;">
          Team Portal
        </button>
      </div>
    </section>

    <!-- Footer -->
    <footer style="text-align: center; padding: 40px 0; border-top: 1px solid #334155; margin-top: 60px;">
      <p style="color: #64748b;">© 2024 Tangent Platform. All rights reserved.</p>
      <p style="color: #64748b; font-size: 12px; margin-top: 10px;">
        Revolutionizing commodity trading and digital currency • Coming Soon
      </p>
    </footer>

  </div>

  <!-- Unified Registration Modal -->
  <div id="unifiedRegistrationModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; align-items: center; justify-content: center; overflow-y: auto;">
    <div style="background: #1e293b; padding: 40px; border-radius: 16px; max-width: 600px; width: 90%; margin: 20px; max-height: 90vh; overflow-y: auto;">
      <h3 style="color: #f1f5f9; margin-bottom: 15px; font-size: 28px; text-align: center;">🚀 Register Your Interest</h3>
      <p style="color: #cbd5e1; margin-bottom: 30px; font-size: 16px; line-height: 1.5; text-align: center;">
        Be among the first to know when our revolutionary trading platform and TGT stablecoin become available.
      </p>
      
      <!-- Personal Information -->
      <div style="margin-bottom: 25px;">
        <h4 style="color: #f1f5f9; margin-bottom: 15px; font-size: 18px;">📋 Your Information</h4>
        <input type="text" id="regName" placeholder="Full Name *" style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
        <input type="email" id="regEmail" placeholder="Email Address *" style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
        <input type="text" id="regCompany" placeholder="Company/Organization" style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
        <input type="tel" id="regPhone" placeholder="Phone Number" style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
      </div>
      
      <!-- Interest Selection -->
      <div style="margin-bottom: 25px;">
        <h4 style="color: #f1f5f9; margin-bottom: 15px; font-size: 18px;">🎯 What interests you? *</h4>
        <div style="display: grid; gap: 15px;">
          <label style="display: flex; align-items: center; gap: 12px; padding: 15px; background: rgba(15, 23, 42, 0.7); border-radius: 8px; border: 1px solid #475569; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.borderColor='#3b82f6'" onmouseout="this.style.borderColor='#475569'">
            <input type="checkbox" id="interestPlatform" value="platform" style="width: 18px; height: 18px; accent-color: #3b82f6;">
            <div>
              <div style="color: #3b82f6; font-weight: 600; font-size: 16px;">🏢 Trading Platform</div>
              <div style="color: #cbd5e1; font-size: 14px;">AI-powered commodity trading infrastructure</div>
            </div>
          </label>
          
          <label style="display: flex; align-items: center; gap: 12px; padding: 15px; background: rgba(15, 23, 42, 0.7); border-radius: 8px; border: 1px solid #475569; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.borderColor='#10b981'" onmouseout="this.style.borderColor='#475569'">
            <input type="checkbox" id="interestTGT" value="tgt" style="width: 18px; height: 18px; accent-color: #10b981;">
            <div>
              <div style="color: #10b981; font-weight: 600; font-size: 16px;">💎 TGT Stablecoin</div>
              <div style="color: #cbd5e1; font-size: 14px;">Commodity-backed stable digital currency</div>
            </div>
          </label>
          
          <label style="display: flex; align-items: center; gap: 12px; padding: 15px; background: rgba(15, 23, 42, 0.7); border-radius: 8px; border: 1px solid #475569; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.borderColor='#8b5cf6'" onmouseout="this.style.borderColor='#475569'">
            <input type="checkbox" id="interestBoth" value="both" style="width: 18px; height: 18px; accent-color: #8b5cf6;">
            <div>
              <div style="color: #8b5cf6; font-weight: 600; font-size: 16px;">🚀 Both Platform & TGT</div>
              <div style="color: #cbd5e1; font-size: 14px;">Complete ecosystem access</div>
            </div>
          </label>
        </div>
      </div>
      
      <!-- Additional Information -->
      <div style="margin-bottom: 25px;">
        <h4 style="color: #f1f5f9; margin-bottom: 15px; font-size: 18px;">💬 Tell us more (Optional)</h4>
        <textarea id="regMessage" placeholder="What specific aspects interest you most? Any particular use cases or requirements?" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9; min-height: 100px; resize: vertical;"></textarea>
      </div>
      
      <!-- Newsletter -->
      <div style="margin-bottom: 25px;">
        <label style="display: flex; align-items: center; gap: 10px; color: #cbd5e1; font-size: 14px; cursor: pointer;">
          <input type="checkbox" id="regNewsletter" checked style="width: 18px; height: 18px; accent-color: #3b82f6;">
          <span>📧 Keep me updated on platform and TGT developments</span>
        </label>
      </div>
      
      <!-- Submit Buttons -->
      <div style="display: flex; gap: 15px;">
        <button onclick="submitUnifiedRegistration()" style="flex: 1; background: linear-gradient(135deg, #3b82f6, #10b981); color: white; border: none; padding: 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 16px;">🚀 Register Interest</button>
        <button onclick="closeUnifiedRegistration()" style="background: #64748b; color: white; border: none; padding: 16px 20px; border-radius: 8px; cursor: pointer;">Cancel</button>
      </div>
      
      <p style="color: #64748b; font-size: 12px; margin-top: 15px; text-align: center; line-height: 1.4;">
        By registering, you agree to receive updates about Tangent Platform and TGT. We respect your privacy and will never share your information.
      </p>
    </div>
  </div>

  <!-- TGT Registration Modal -->
  <div id="tgtRegistrationModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; align-items: center; justify-content: center; overflow-y: auto;">
    <div style="background: #1e293b; padding: 40px; border-radius: 16px; max-width: 600px; width: 90%; margin: 20px; max-height: 90vh; overflow-y: auto;">
      <h3 style="color: #10b981; margin-bottom: 15px; font-size: 24px;">🚀 Get Early Access to TGT Stablecoin</h3>
      <p style="color: #cbd5e1; margin-bottom: 25px; font-size: 14px; line-height: 1.5;">
        Join our exclusive early access program for the TGT stablecoin. Be among the first to experience the future of stable digital currency for commodity trading.
      </p>
      
      <input type="text" id="tgtName" placeholder="Full Name *" style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
      <input type="email" id="tgtEmail" placeholder="Email Address *" style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
      <input type="text" id="tgtCompany" placeholder="Company/Organization" style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
      <input type="tel" id="tgtPhone" placeholder="Phone Number" style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
      
      <!-- Interest Level -->
      <label style="color: #cbd5e1; font-size: 14px; margin-bottom: 5px; display: block;">Interest Level *</label>
      <select id="tgtInterestLevel" style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
        <option value="">Select your interest level...</option>
        <option value="investor">💼 Potential Investor - Looking to invest in TGT</option>
        <option value="trader">📈 Active Trader - Want to use TGT for trading</option>
        <option value="business">🏢 Business Integration - Integrate TGT into business</option>
        <option value="curious">🤔 Just Curious - Want to learn more about TGT</option>
        <option value="partner">🤝 Partnership Opportunity - Explore collaboration</option>
      </select>
      
      <!-- Investment Interest -->
      <label style="color: #cbd5e1; font-size: 14px; margin-bottom: 5px; display: block;">Investment Interest (Optional)</label>
      <select id="tgtInvestmentRange" style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
        <option value="">Select investment range...</option>
        <option value="under-10k">💰 Under $10,000</option>
        <option value="10k-50k">💎 $10,000 - $50,000</option>
        <option value="50k-100k">🏦 $50,000 - $100,000</option>
        <option value="100k-500k">🏛️ $100,000 - $500,000</option>
        <option value="500k-1m">🏰 $500,000 - $1,000,000</option>
        <option value="over-1m">👑 Over $1,000,000</option>
        <option value="enterprise">🌐 Enterprise Level</option>
      </select>
      
      <!-- Use Case -->
      <label style="color: #cbd5e1; font-size: 14px; margin-bottom: 5px; display: block;">Primary Use Case *</label>
      <select id="tgtUseCase" style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
        <option value="">How do you plan to use TGT?</option>
        <option value="commodity-trading">🌾 Commodity Trading</option>
        <option value="cross-border-payments">🌍 Cross-border Payments</option>
        <option value="treasury-management">🏦 Treasury Management</option>
        <option value="hedging">📊 Risk Hedging</option>
        <option value="defi">🔗 DeFi Applications</option>
        <option value="speculation">📈 Investment/Speculation</option>
        <option value="other">🎯 Other</option>
      </select>
      
      <textarea id="tgtMessage" placeholder="Tell us more about your interest in TGT stablecoin, your business needs, or any specific questions you have..." style="width: 100%; padding: 12px; margin-bottom: 20px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9; min-height: 100px; resize: vertical;"></textarea>
      
      <!-- Newsletter Subscription -->
      <div style="margin-bottom: 20px;">
        <label style="display: flex; align-items: center; gap: 10px; color: #cbd5e1; font-size: 14px; cursor: pointer;">
          <input type="checkbox" id="tgtNewsletter" checked style="width: 18px; height: 18px; accent-color: #10b981;">
          <span>📧 Subscribe to TGT updates and exclusive insights</span>
        </label>
      </div>
      
      <div style="display: flex; gap: 10px;">
        <button onclick="submitTGTRegistration()" style="flex: 1; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 14px; border-radius: 8px; cursor: pointer; font-weight: 600;">🚀 Get Early Access</button>
        <button onclick="closeTGTRegistration()" style="background: #64748b; color: white; border: none; padding: 14px 20px; border-radius: 8px; cursor: pointer;">Cancel</button>
      </div>
      
      <p style="color: #64748b; font-size: 12px; margin-top: 15px; text-align: center; line-height: 1.4;">
        By submitting, you agree to receive updates about TGT stablecoin. We respect your privacy and will never share your information.
      </p>
    </div>
  </div>

  <!-- TGT Information Modal -->
  <div id="tgtInfoModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; align-items: center; justify-content: center; overflow-y: auto;">
    <div style="background: #1e293b; padding: 40px; border-radius: 16px; max-width: 800px; width: 90%; margin: 20px; max-height: 90vh; overflow-y: auto;">
      <h3 style="color: #10b981; margin-bottom: 20px; font-size: 28px;">📖 TGT Stablecoin - Complete Guide</h3>
      
      <!-- What is TGT -->
      <div style="margin-bottom: 30px;">
        <h4 style="color: #f1f5f9; font-size: 20px; margin-bottom: 15px;">💎 What is TGT?</h4>
        <p style="color: #cbd5e1; line-height: 1.6; margin-bottom: 15px;">
          TGT (Tangent Token) is a next-generation stablecoin specifically designed for commodity trading and global commerce. 
          Unlike traditional stablecoins pegged to fiat currencies, TGT is backed by a diversified basket of real commodity reserves, 
          providing unprecedented stability and utility for large-scale trading operations.
        </p>
      </div>
      
      <!-- Key Benefits -->
      <div style="margin-bottom: 30px;">
        <h4 style="color: #f1f5f9; font-size: 20px; margin-bottom: 15px;">🎯 Key Benefits</h4>
        <div style="display: grid; gap: 15px;">
          <div style="background: rgba(16, 185, 129, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
            <strong style="color: #10b981;">Real Asset Backing:</strong>
            <span style="color: #cbd5e1;"> Backed by actual commodity reserves including precious metals, energy, and agricultural products.</span>
          </div>
          <div style="background: rgba(16, 185, 129, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
            <strong style="color: #10b981;">Global Accessibility:</strong>
            <span style="color: #cbd5e1;"> 24/7 trading and settlement across all time zones without traditional banking limitations.</span>
          </div>
          <div style="background: rgba(16, 185, 129, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
            <strong style="color: #10b981;">Cost Efficiency:</strong>
            <span style="color: #cbd5e1;"> Dramatically reduced transaction fees compared to traditional banking and wire transfers.</span>
          </div>
          <div style="background: rgba(16, 185, 129, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
            <strong style="color: #10b981;">Smart Contract Integration:</strong>
            <span style="color: #cbd5e1;"> Programmable money that enables automated escrow, settlements, and complex trading strategies.</span>
          </div>
        </div>
      </div>
      
      <!-- Use Cases -->
      <div style="margin-bottom: 30px;">
        <h4 style="color: #f1f5f9; font-size: 20px; margin-bottom: 15px;">🌐 Use Cases</h4>
        <ul style="color: #cbd5e1; line-height: 1.8; margin-left: 20px;">
          <li><strong style="color: #10b981;">Commodity Trading:</strong> Settle large commodity transactions instantly without banking delays</li>
          <li><strong style="color: #10b981;">Cross-Border Payments:</strong> Send payments globally without currency conversion costs</li>
          <li><strong style="color: #10b981;">Treasury Management:</strong> Hold stable value without exposure to single-currency risks</li>
          <li><strong style="color: #10b981;">DeFi Integration:</strong> Participate in decentralized finance while maintaining stability</li>
          <li><strong style="color: #10b981;">Hedging:</strong> Protect against inflation and currency devaluation</li>
        </ul>
      </div>
      
      <!-- Technical Details -->
      <div style="margin-bottom: 30px;">
        <h4 style="color: #f1f5f9; font-size: 20px; margin-bottom: 15px;">⚙️ Technical Specifications</h4>
        <div style="background: rgba(15, 23, 42, 0.7); padding: 20px; border-radius: 8px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; color: #cbd5e1; font-size: 14px;">
            <div><strong style="color: #10b981;">Blockchain:</strong> Ethereum + L2 Solutions</div>
            <div><strong style="color: #10b981;">Token Standard:</strong> ERC-20 Compatible</div>
            <div><strong style="color: #10b981;">Auditing:</strong> Real-time Reserve Verification</div>
            <div><strong style="color: #10b981;">Compliance:</strong> Regulatory Framework Compliant</div>
          </div>
        </div>
      </div>
      
      <div style="display: flex; gap: 15px; justify-content: center;">
        <button onclick="showTGTRegistration(); closeTGTInfo();" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 14px 28px; border-radius: 8px; cursor: pointer; font-weight: 600;">🚀 Get Early Access</button>
        <button onclick="closeTGTInfo()" style="background: #64748b; color: white; border: none; padding: 14px 20px; border-radius: 8px; cursor: pointer;">Close</button>
      </div>
    </div>
  </div>

  <!-- Team Sign In Modal -->
  <div id="signInModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; align-items: center; justify-content: center;">
    <div style="background: #1e293b; padding: 40px; border-radius: 16px; max-width: 400px; width: 90%;">
      <h3 style="color: #f1f5f9; margin-bottom: 20px;">Team Member Access</h3>
      <p style="color: #cbd5e1; margin-bottom: 20px; font-size: 14px;">
        This area is restricted to authorized team members only.
      </p>
      <input type="email" id="signInEmail" placeholder="Team Email" style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
      <input type="password" id="signInPassword" placeholder="Password" style="width: 100%; padding: 12px; margin-bottom: 20px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
      <div style="display: flex; gap: 10px;">
        <button onclick="performSignIn()" style="flex: 1; background: #3b82f6; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer;">Sign In</button>
        <button onclick="closeSignIn()" style="background: #64748b; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer;">Cancel</button>
      </div>
    </div>
  </div>

  <script>
    // Unified Registration Functions
    function showUnifiedRegistration() {
      document.getElementById('unifiedRegistrationModal').style.display = 'flex';
    }
    
    function closeUnifiedRegistration() {
      document.getElementById('unifiedRegistrationModal').style.display = 'none';
    }
    
    async function submitUnifiedRegistration() {
      const name = document.getElementById('regName').value;
      const email = document.getElementById('regEmail').value;
      const platformInterest = document.getElementById('interestPlatform').checked;
      const tgtInterest = document.getElementById('interestTGT').checked;
      const bothInterest = document.getElementById('interestBoth').checked;
      
      if (!name || !email) {
        alert('Please fill in your name and email address');
        return;
      }
      
      if (!platformInterest && !tgtInterest && !bothInterest) {
        alert('Please select at least one area of interest');
        return;
      }
      
      // Determine interests
      let interests = [];
      if (platformInterest || bothInterest) interests.push('platform');
      if (tgtInterest || bothInterest) interests.push('tgt');
      if (bothInterest) interests = ['both'];
      
      // Collect all form data
      const formData = {
        name: name,
        email: email,
        company: document.getElementById('regCompany').value,
        phone: document.getElementById('regPhone').value,
        interests: interests,
        message: document.getElementById('regMessage').value,
        newsletter: document.getElementById('regNewsletter').checked,
        timestamp: new Date().toISOString(),
        type: 'unified_registration'
      };
      
      try {
        // Send to backend API
        const response = await fetch('/api/unified-register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          let interestText = '';
          if (interests.includes('both') || (interests.includes('platform') && interests.includes('tgt'))) {
            interestText = 'both our Trading Platform and TGT Stablecoin';
          } else if (interests.includes('platform')) {
            interestText = 'our Trading Platform';
          } else if (interests.includes('tgt')) {
            interestText = 'TGT Stablecoin';
          }
          
          alert('🎉 Thank you ' + name + '!\\n\\nWe have registered your interest in ' + interestText + '. You\\'ll be among the first to know when they become available.\\n\\nWe\\'ll contact you within 48 hours with exclusive early access information.');
          closeUnifiedRegistration();
          
          // Clear form
          document.getElementById('regName').value = '';
          document.getElementById('regEmail').value = '';
          document.getElementById('regCompany').value = '';
          document.getElementById('regPhone').value = '';
          document.getElementById('interestPlatform').checked = false;
          document.getElementById('interestTGT').checked = false;
          document.getElementById('interestBoth').checked = false;
          document.getElementById('regMessage').value = '';
          document.getElementById('regNewsletter').checked = true;
        } else {
          const errorMessage = result.message || result.error || 'Registration failed';
          alert('Registration Error: ' + errorMessage);
        }
        
      } catch (error) {
        alert('There was an error submitting your registration. Please try again or contact support.');
        console.error('Registration Error:', error);
      }
    }
    
    // TGT Registration Functions
    function showTGTRegistration() {
      document.getElementById('tgtRegistrationModal').style.display = 'flex';
    }
    
    function closeTGTRegistration() {
      document.getElementById('tgtRegistrationModal').style.display = 'none';
    }
    
    async function submitTGTRegistration() {
      const name = document.getElementById('tgtName').value;
      const email = document.getElementById('tgtEmail').value;
      const interestLevel = document.getElementById('tgtInterestLevel').value;
      const useCase = document.getElementById('tgtUseCase').value;
      
      if (!name || !email || !interestLevel || !useCase) {
        alert('Please fill in all required fields (marked with *)');
        return;
      }
      
      // Collect all form data
      const formData = {
        name: name,
        email: email,
        company: document.getElementById('tgtCompany').value,
        phone: document.getElementById('tgtPhone').value,
        interestLevel: interestLevel,
        investmentRange: document.getElementById('tgtInvestmentRange').value,
        useCase: useCase,
        message: document.getElementById('tgtMessage').value,
        newsletter: document.getElementById('tgtNewsletter').checked,
        timestamp: new Date().toISOString(),
        type: 'tgt_registration'
      };
      
      try {
        // Send to backend API
        const response = await fetch('/api/tgt/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          alert('🎉 Thank you for your interest in TGT! \\n\\nWe have received your registration and will contact you within 48 hours with exclusive early access information and next steps.');
          closeTGTRegistration();
          
          // Clear form
          document.getElementById('tgtName').value = '';
          document.getElementById('tgtEmail').value = '';
          document.getElementById('tgtCompany').value = '';
          document.getElementById('tgtPhone').value = '';
          document.getElementById('tgtInterestLevel').value = '';
          document.getElementById('tgtInvestmentRange').value = '';
          document.getElementById('tgtUseCase').value = '';
          document.getElementById('tgtMessage').value = '';
          document.getElementById('tgtNewsletter').checked = true;
        } else {
          // Handle API errors
          const errorMessage = result.message || result.error || 'Registration failed';
          alert('Registration Error: ' + errorMessage);
        }
        
      } catch (error) {
        alert('There was an error submitting your registration. Please try again or contact support.');
        console.error('TGT Registration Error:', error);
      }
    }
    
    // TGT Information Functions
    function showTGTInfo() {
      document.getElementById('tgtInfoModal').style.display = 'flex';
    }
    
    function closeTGTInfo() {
      document.getElementById('tgtInfoModal').style.display = 'none';
    }
    
    // Team Sign In Functions
    function showTeamSignIn() {
      document.getElementById('signInModal').style.display = 'flex';
    }
    
    function closeSignIn() {
      document.getElementById('signInModal').style.display = 'none';
    }
    
    async function performSignIn() {
      const email = document.getElementById('signInEmail').value;
      const password = document.getElementById('signInPassword').value;
      
      if (!email || !password) {
        alert('Please enter your credentials');
        return;
      }
      
      try {
        const response = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        const result = await response.json();
        
        if (result.token) {
          localStorage.setItem('authToken', result.token);
          // Include token in URL for initial navigation
          window.location.href = '/portal?token=' + result.token;
        } else {
          alert('Access denied: ' + (result.error || 'Invalid credentials or unauthorized access'));
        }
      } catch (error) {
        alert('Login error: ' + error.message);
      }
    }
    
    // Close modals when clicking outside
    window.onclick = function(event) {
      const unifiedModal = document.getElementById('unifiedRegistrationModal');
      const signInModal = document.getElementById('signInModal');
      
      if (event.target === unifiedModal) {
        closeUnifiedRegistration();
      }
      if (event.target === signInModal) {
        closeSignIn();
      }
    }
  </script>
</body></html>
`;
}

// Admin panel for team management
function pageAdmin() {
  return `
${baseHead("Tangent Platform — Admin Panel")}
<body style="margin: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #f1f5f9; min-height: 100vh;">
  <div style="max-width: 1200px; margin: 0 auto; padding: 40px 20px;">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 40px;">
      <h1 style="margin: 0; font-size: 32px; font-weight: 700; background: linear-gradient(135deg, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
        Admin Panel
      </h1>
      <p style="margin: 10px 0 0 0; color: #64748b; font-size: 16px;">
        Manage team access and platform settings
      </p>
    </div>

    <!-- Navigation -->
    <div style="text-align: center; margin-bottom: 40px;">
      <a href="/portal" style="color: #3b82f6; text-decoration: none; margin-right: 20px;">← Back to Platform</a>
      <span style="color: #64748b;">|</span>
      <a href="/" style="color: #3b82f6; text-decoration: none; margin-left: 20px;">Landing Page</a>
    </div>

    <!-- Team Management Section -->
    <div style="background: rgba(15, 23, 42, 0.8); border-radius: 16px; border: 1px solid #334155; padding: 30px; margin-bottom: 30px;">
      <h2 style="margin: 0 0 20px 0; color: #f1f5f9; font-size: 24px; font-weight: 600;">
        Team Email Management
      </h2>
      
      <!-- Current Authorized Emails -->
      <div style="margin-bottom: 30px;">
        <h3 style="color: #94a3b8; font-size: 16px; margin-bottom: 15px;">Current Authorized Emails:</h3>
        <div id="currentEmails" style="background: #0f172a; border-radius: 8px; padding: 20px; border: 1px solid #475569;">
          <div style="color: #64748b;">Loading...</div>
        </div>
      </div>

      <!-- Add New Email -->
      <div style="margin-bottom: 30px;">
        <h3 style="color: #94a3b8; font-size: 16px; margin-bottom: 15px;">Add New Team Member:</h3>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <input type="email" id="newEmail" placeholder="Enter email address" 
                 style="flex: 1; min-width: 250px; padding: 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
          <button onclick="addTeamEmail()" 
                  style="background: #22c55e; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 500; transition: all 0.3s;">
            Add Email
          </button>
        </div>
      </div>

      <!-- Create User Account -->
      <div style="border-top: 1px solid #334155; padding-top: 30px;">
        <h3 style="color: #94a3b8; font-size: 16px; margin-bottom: 15px;">Create New User Account:</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <input type="email" id="createEmail" placeholder="Email address" 
                 style="padding: 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
          <input type="password" id="createPassword" placeholder="Password" 
                 style="padding: 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
        </div>
        <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 15px;">
          <select id="createRole" style="padding: 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
            <option value="admin">Admin</option>
            <option value="buyer">Buyer</option>
            <option value="supplier">Supplier</option>
          </select>
          <button onclick="createUserAccount()" 
                  style="background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 500;">
            Create Account
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div style="background: rgba(15, 23, 42, 0.8); border-radius: 16px; border: 1px solid #334155; padding: 30px;">
      <h2 style="margin: 0 0 20px 0; color: #f1f5f9; font-size: 24px; font-weight: 600;">
        Quick Actions
      </h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
        <button onclick="refreshPage()" 
                style="background: #64748b; color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-weight: 500;">
          Refresh Data
        </button>
        <button onclick="viewLogs()" 
                style="background: #8b5cf6; color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-weight: 500;">
          View Security Logs
        </button>
        <button onclick="exportData()" 
                style="background: #059669; color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-weight: 500;">
          Export Data
        </button>
      </div>
    </div>

  </div>

  <script>
    // Load current authorized emails
    async function loadCurrentEmails() {
      try {
        const response = await fetch('/api/admin/authorized-emails', {
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('authToken') }
        });
        const data = await response.json();
        
        const container = document.getElementById('currentEmails');
        if (data.success && data.emails) {
          container.innerHTML = data.emails.map(email => 
            \`<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #334155;">
              <span style="color: #f1f5f9;">\${email}</span>
              <button onclick="removeEmail('\${email}')" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">Remove</button>
            </div>\`
          ).join('');
        } else {
          container.innerHTML = '<div style="color: #ef4444;">Failed to load emails</div>';
        }
      } catch (error) {
        document.getElementById('currentEmails').innerHTML = '<div style="color: #ef4444;">Error loading emails</div>';
      }
    }

    // Add new team email
    async function addTeamEmail() {
      const email = document.getElementById('newEmail').value;
      if (!email) {
        alert('Please enter an email address');
        return;
      }

      try {
        const response = await fetch('/api/admin/add-email', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('authToken')
          },
          body: JSON.stringify({ email })
        });

        const result = await response.json();
        if (result.success) {
          alert('Email added successfully!');
          document.getElementById('newEmail').value = '';
          loadCurrentEmails();
        } else {
          alert('Failed to add email: ' + result.error);
        }
      } catch (error) {
        alert('Error adding email: ' + error.message);
      }
    }

    // Remove team email
    async function removeEmail(email) {
      if (!confirm('Remove ' + email + ' from authorized users?')) return;

      try {
        const response = await fetch('/api/admin/remove-email', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('authToken')
          },
          body: JSON.stringify({ email })
        });

        const result = await response.json();
        if (result.success) {
          alert('Email removed successfully!');
          loadCurrentEmails();
        } else {
          alert('Failed to remove email: ' + result.error);
        }
      } catch (error) {
        alert('Error removing email: ' + error.message);
      }
    }

    // Create user account
    async function createUserAccount() {
      const email = document.getElementById('createEmail').value;
      const password = document.getElementById('createPassword').value;
      const role = document.getElementById('createRole').value;

      if (!email || !password) {
        alert('Please enter email and password');
        return;
      }

      try {
        const response = await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('authToken')
          },
          body: JSON.stringify({ email, password, role })
        });

        const result = await response.json();
        if (result.success) {
          alert('User account created successfully!\\nEmail: ' + email + '\\nPassword: ' + password + '\\nRole: ' + role);
          document.getElementById('createEmail').value = '';
          document.getElementById('createPassword').value = '';
          
          // Also add to authorized emails if admin
          if (role === 'admin') {
            await addTeamEmailDirect(email);
          }
        } else {
          alert('Failed to create user: ' + result.error);
        }
      } catch (error) {
        alert('Error creating user: ' + error.message);
      }
    }

    // Helper function to add email directly
    async function addTeamEmailDirect(email) {
      try {
        await fetch('/api/admin/add-email', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('authToken')
          },
          body: JSON.stringify({ email })
        });
        loadCurrentEmails();
      } catch (error) {
        console.error('Error auto-adding email:', error);
      }
    }

    // Quick action functions
    function refreshPage() {
      window.location.reload();
    }

    function viewLogs() {
      alert('Security logs feature coming soon!');
    }

    function exportData() {
      alert('Data export feature coming soon!');
    }

    // Load data on page load
    loadCurrentEmails();
  </script>
</body></html>
`;
}

// Simple working admin panel (no complex auth)
function pageSimpleAdmin() {
  return `
${baseHead("Admin Panel - Simple")}
<body style="margin: 0; font-family: Arial, sans-serif; background: #1a1a1a; color: white; padding: 20px;">
  <h1>🔧 Admin Panel - Working Version</h1>
  
  <div style="background: #333; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h2>Team Email Management</h2>
    <div id="emails">
      <div>✅ ollech@gmail.com (Current Admin)</div>
      <div>✅ dudiollech@gmail.com (Authorized)</div>
    </div>
    
    <h3>Add New Email:</h3>
    <input type="email" id="newEmail" placeholder="Enter email" style="padding: 10px; margin-right: 10px;">
    <button onclick="addEmail()" style="padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px;">Add</button>
  </div>

  <div style="background: #333; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h2>Create User Account</h2>
    <input type="email" id="userEmail" placeholder="Email" style="padding: 10px; margin-right: 10px; width: 200px;">
    <input type="password" id="userPassword" placeholder="Password" style="padding: 10px; margin-right: 10px; width: 150px;">
    <select id="userRole" style="padding: 10px; margin-right: 10px;">
      <option value="admin">Admin</option>
      <option value="buyer">Buyer</option>
      <option value="supplier">Supplier</option>
    </select>
    <button onclick="createUser()" style="padding: 10px; background: #28a745; color: white; border: none; border-radius: 4px;">Create User</button>
  </div>

  <div style="background: #333; padding: 20px; border-radius: 8px;">
    <h2>Quick Actions</h2>
    <button onclick="testLogin()" style="padding: 10px; background: #ffc107; color: black; border: none; border-radius: 4px; margin-right: 10px;">Test Login System</button>
    <button onclick="goToPortal()" style="padding: 10px; background: #17a2b8; color: white; border: none; border-radius: 4px; margin-right: 10px;">Go to Portal</button>
    <button onclick="goToLanding()" style="padding: 10px; background: #6c757d; color: white; border: none; border-radius: 4px;">Go to Landing</button>
  </div>

  <script>
    function addEmail() {
      const email = document.getElementById('newEmail').value;
      if (email) {
        document.getElementById('emails').innerHTML += '<div>✅ ' + email + ' (Added)</div>';
        document.getElementById('newEmail').value = '';
        alert('✅ Email added: ' + email);
      }
    }

    async function createUser() {
      const email = document.getElementById('userEmail').value;
      const password = document.getElementById('userPassword').value;
      const role = document.getElementById('userRole').value;

      if (!email || !password) {
        alert('❌ Please enter email and password');
        return;
      }

      try {
        const response = await fetch('/setup/create-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const result = await response.json();
        if (result.success) {
          alert('✅ User created successfully!\\n\\nEmail: ' + email + '\\nPassword: ' + password + '\\nRole: ' + role);
          document.getElementById('userEmail').value = '';
          document.getElementById('userPassword').value = '';
        } else {
          alert('❌ Error: ' + result.error);
        }
      } catch (error) {
        alert('❌ Network error: ' + error.message);
      }
    }

    async function testLogin() {
      const email = 'ollech@gmail.com';
      const password = 'admin123';
      
      try {
        const response = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const result = await response.json();
        if (result.success && result.token) {
          alert('✅ Login test successful!\\n\\nToken: ' + result.token.substring(0, 50) + '...');
          localStorage.setItem('authToken', result.token);
        } else {
          alert('❌ Login test failed: ' + JSON.stringify(result));
        }
      } catch (error) {
        alert('❌ Login test error: ' + error.message);
      }
    }

    function goToPortal() {
      window.location.href = '/portal';
    }

    function goToLanding() {
      window.location.href = '/';
    }
  </script>
</body></html>
`;
}

// Portal home page for authenticated users
function pageHome() {
  return `
${baseHead("Tangent Platform — Trading Dashboard")}
<body>
${nav("Home")}
  <main class="wrap">
    <section class="hero">
      <h1>🌍 Welcome to Tangent Platform</h1>
      <p>Your secure commodity trading dashboard. Access all platform features below.</p>
      
      <div class="grid grid-3" style="margin-top: 30px;">
        <div class="card">
          <h3>📋 KYC Verification</h3>
          <p>Complete your Know Your Customer verification process.</p>
          <a class="btn" href="/portal/kyc">Start KYC Process</a>
        </div>
        
        <div class="card">
          <h3>💼 Trade Desk</h3>
          <p>Access trading features and manage your portfolio.</p>
          <a class="btn" href="/portal/trade">Open Trade Desk</a>
        </div>
        
        <div class="card">
          <h3>📊 Analytics</h3>
          <p>View trading analytics and performance metrics.</p>
          <a class="btn" href="/portal/analytics">View Analytics</a>
        </div>
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
app.get('/', (req, res) => res.send(pageLanding()));
app.get('/portal', (req, res) => res.send(pageHome()));
app.get('/portal/kyc', (req, res) => res.send(pageKYC()));
app.get('/admin', (req, res) => res.send(pageSimpleAdmin()));

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

const PORT = process.env.PORT || config.server.port;
const HOST = '0.0.0.0'; // Railway requires binding to 0.0.0.0

const server = app.listen(PORT, HOST, async () => {
  logger.info(`🚀 Tangent Platform Server Started`, {
    port: PORT,
    host: HOST,
    environment: config.NODE_ENV,
    features: config.platform.features,
    timestamp: new Date().toISOString()
  });
  
  // Initialize bulletproof authentication system
  await initializeBulletproofAuth();
  
  // Log system information
  logUtils.logBusiness('server_startup', {
    port: PORT,
    nodeVersion: process.version,
    platform: process.platform,
    features: Object.keys(config.platform.features).filter(f => config.platform.features[f])
  });
  
  // Initialize WebSocket after server starts
  websocketService.initialize(server);
  
  console.log(`
╔════════════════════════════════════════════════════════════════════════════════╗
║                        🎯 TANGENT PLATFORM v2.0                               ║
║                     Enhanced Secure Trading Platform                          ║
╠════════════════════════════════════════════════════════════════════════════════╣
║ 🌐 Server: http://${HOST}:${PORT}                                     ║
║ 🔄 WebSocket: ws://${HOST}:${PORT}                                     ║
║ 📚 API Docs: http://${HOST}:${PORT}/api/docs/endpoints                ║
║ 🔧 Health: http://${HOST}:${PORT}/health                              ║
║                                                                                ║
║ ✅ Enhanced Security: JWT, Rate Limiting, Validation                          ║
║ ✅ Real-time Updates: WebSocket, Live Notifications                           ║
║ ✅ Email System: Verification, Notifications, Password Reset                  ║
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
