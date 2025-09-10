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
    <section style="text-align: center; margin-bottom: 80px;">
      <h2 style="font-size: 36px; color: #f1f5f9; margin-bottom: 20px; font-weight: 600;">
        Revolutionary Trade Finance Platform
      </h2>
      <p style="font-size: 18px; color: #cbd5e1; max-width: 800px; margin: 0 auto 40px; line-height: 1.6;">
        We're building the next generation of commodity trading infrastructure, combining cutting-edge security, 
        AI-powered document processing, and blockchain technology to revolutionize global trade finance.
      </p>
      
      <!-- TGT Stablecoin Section -->
      <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 182, 212, 0.1)); padding: 50px; border-radius: 24px; border: 2px solid rgba(16, 185, 129, 0.3); margin: 60px auto; max-width: 900px; position: relative; overflow: hidden;">
        <div style="position: absolute; top: -50%; right: -20%; width: 200px; height: 200px; background: radial-gradient(circle, rgba(16, 185, 129, 0.1), transparent); border-radius: 50%;"></div>
        <div style="position: relative; z-index: 2;">
          <h3 style="color: #10b981; margin-bottom: 25px; font-size: 32px; font-weight: 700;">
            💎 Introducing TGT Stablecoin
          </h3>
          <p style="color: #e2e8f0; margin-bottom: 35px; font-size: 20px; line-height: 1.6; max-width: 700px; margin-left: auto; margin-right: auto;">
            The future of stable digital currency designed specifically for commodity trading and global commerce.
          </p>
          
          <!-- TGT Benefits Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 25px; margin-bottom: 40px;">
            <div style="background: rgba(15, 23, 42, 0.7); padding: 25px; border-radius: 16px; border: 1px solid rgba(16, 185, 129, 0.2);">
              <h4 style="color: #10b981; font-size: 18px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                🏦 <span>Price Stability</span>
              </h4>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin: 0;">
                Backed by real commodity reserves, providing unprecedented stability for large-scale trading.
              </p>
            </div>
            
            <div style="background: rgba(15, 23, 42, 0.7); padding: 25px; border-radius: 16px; border: 1px solid rgba(16, 185, 129, 0.2);">
              <h4 style="color: #10b981; font-size: 18px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                ⚡ <span>Instant Settlement</span>
              </h4>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin: 0;">
                24/7 global transactions with near-instant settlement, eliminating traditional banking delays.
              </p>
            </div>
            
            <div style="background: rgba(15, 23, 42, 0.7); padding: 25px; border-radius: 16px; border: 1px solid rgba(16, 185, 129, 0.2);">
              <h4 style="color: #10b981; font-size: 18px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                🌐 <span>Global Access</span>
              </h4>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin: 0;">
                Cross-border trading without currency conversion fees or regulatory friction.
              </p>
            </div>
            
            <div style="background: rgba(15, 23, 42, 0.7); padding: 25px; border-radius: 16px; border: 1px solid rgba(16, 185, 129, 0.2);">
              <h4 style="color: #10b981; font-size: 18px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                🔒 <span>Transparency</span>
              </h4>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin: 0;">
                Blockchain-verified reserves with real-time auditing and complete transaction transparency.
              </p>
            </div>
          </div>
          
          <!-- CTA Buttons for TGT -->
          <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; margin-top: 35px;">
            <button onclick="showTGTRegistration()" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 18px 36px; border-radius: 12px; font-size: 18px; font-weight: 600; cursor: pointer; box-shadow: 0 12px 35px rgba(16, 185, 129, 0.4); transition: all 0.3s; transform: translateY(0px);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 15px 40px rgba(16, 185, 129, 0.5)'" onmouseout="this.style.transform='translateY(0px)'; this.style.boxShadow='0 12px 35px rgba(16, 185, 129, 0.4)'">
              🚀 Get Early Access to TGT
            </button>
            <button onclick="showTGTInfo()" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.2)); color: #10b981; border: 2px solid #10b981; padding: 16px 32px; border-radius: 12px; font-size: 18px; font-weight: 600; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background='linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(6, 182, 212, 0.3))'" onmouseout="this.style.background='linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.2))'">
              📖 Learn More About TGT
            </button>
          </div>
        </div>
      </div>
      
      <!-- Platform Access Section -->
      <div style="background: rgba(30, 41, 59, 0.8); padding: 40px; border-radius: 20px; border: 1px solid #334155; margin: 40px auto; max-width: 600px;">
        <h3 style="color: #f1f5f9; margin-bottom: 20px; font-size: 24px;">🏢 Trading Platform Access</h3>
        <p style="color: #cbd5e1; margin-bottom: 30px; line-height: 1.6;">
          Our commodity trading platform is currently in private beta. 
          We're working with select partners to shape the future of global trade.
        </p>
        <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;">
          <button onclick="showContactForm()" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; border: none; padding: 16px 32px; border-radius: 12px; font-size: 18px; font-weight: 600; cursor: pointer; box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3); transition: all 0.3s;">
            📧 Request Platform Access
          </button>
          <button onclick="showTeamSignIn()" style="background: linear-gradient(135deg, #64748b, #475569); color: white; border: none; padding: 16px 32px; border-radius: 12px; font-size: 18px; font-weight: 600; cursor: pointer; transition: all 0.3s;">
            👥 Team Access
          </button>
        </div>
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

    <!-- Footer -->
    <footer style="text-align: center; padding: 40px 0; border-top: 1px solid #334155; margin-top: 60px;">
      <p style="color: #64748b;">© 2024 Tangent Platform. All rights reserved.</p>
      <p style="color: #64748b; font-size: 12px; margin-top: 10px;">
        Platform currently in private beta • Contact us for partnership opportunities
      </p>
    </footer>

  </div>

  <!-- Contact Form Modal -->
  <div id="contactModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; align-items: center; justify-content: center;">
    <div style="background: #1e293b; padding: 40px; border-radius: 16px; max-width: 500px; width: 90%;">
      <h3 style="color: #f1f5f9; margin-bottom: 20px;">Request Platform Access</h3>
      <p style="color: #cbd5e1; margin-bottom: 20px; font-size: 14px;">
        We're currently onboarding select partners. Please provide your details and we'll get back to you.
      </p>
      <input type="text" id="contactName" placeholder="Full Name" style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
      <input type="email" id="contactEmail" placeholder="Business Email" style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
      <input type="text" id="contactCompany" placeholder="Company Name" style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9;">
      <textarea id="contactMessage" placeholder="Tell us about your trading needs..." style="width: 100%; padding: 12px; margin-bottom: 20px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9; min-height: 80px; resize: vertical;"></textarea>
      <div style="display: flex; gap: 10px;">
        <button onclick="submitContactForm()" style="flex: 1; background: #10b981; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer;">Send Request</button>
        <button onclick="closeContactForm()" style="background: #64748b; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer;">Cancel</button>
      </div>
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
    // Contact Form Functions
    function showContactForm() {
      document.getElementById('contactModal').style.display = 'flex';
    }
    
    function closeContactForm() {
      document.getElementById('contactModal').style.display = 'none';
    }
    
    async function submitContactForm() {
      const name = document.getElementById('contactName').value;
      const email = document.getElementById('contactEmail').value;
      const company = document.getElementById('contactCompany').value;
      const message = document.getElementById('contactMessage').value;
      
      if (!name || !email || !company) {
        alert('Please fill in all required fields');
        return;
      }
      
      // Here you would typically send to your backend
      alert('Thank you for your interest! We will contact you within 24 hours.');
      closeContactForm();
      
      // Clear form
      document.getElementById('contactName').value = '';
      document.getElementById('contactEmail').value = '';
      document.getElementById('contactCompany').value = '';
      document.getElementById('contactMessage').value = '';
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
          window.location.href = '/portal';
        } else {
          alert('Access denied: ' + (result.error || 'Invalid credentials or unauthorized access'));
        }
      } catch (error) {
        alert('Login error: ' + error.message);
      }
    }
    
    // Close modals when clicking outside
    window.onclick = function(event) {
      const contactModal = document.getElementById('contactModal');
      const tgtModal = document.getElementById('tgtRegistrationModal');
      const tgtInfoModal = document.getElementById('tgtInfoModal');
      const signInModal = document.getElementById('signInModal');
      
      if (event.target === contactModal) {
        closeContactForm();
      }
      if (event.target === tgtModal) {
        closeTGTRegistration();
      }
      if (event.target === tgtInfoModal) {
        closeTGTInfo();
      }
      if (event.target === signInModal) {
        closeSignIn();
      }
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

const server = app.listen(PORT, HOST, () => {
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
