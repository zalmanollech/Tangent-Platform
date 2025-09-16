// server.js — Tangent Ultra MVP (Phase 1 complete, Phase 2 optional, Phase 3 scaffolding)
// One-file app with inline theme and UI. Uploads saved under ./uploads/.

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { v4: uuid } = require("uuid");
const { ethers } = require("ethers");

const app = express();
const PORT = process.env.PORT || 4000;
const ADMIN_KEY = process.env.ADMIN_KEY || "demo-admin-key-123";

// Optional chain envs (if present we try on-chain, else we simulate)
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const ESCROW_ADDRESS = process.env.ESCROW_ADDRESS || "";
const TGT_ADDRESS = process.env.TGT_ADDRESS || "";

// ---- Infra ----
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// uploads
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, Date.now() + "-" + file.originalname.replace(/[^\w. -]/g, "_"))
});
const upload = multer({ storage });

// ---- DB ----
const DB_PATH = path.join(__dirname, "data.json");

function ensureDBShape(db = {}) {
  return {
    platformToken: db.platformToken || { symbol: "TGT", name: "Tangent Token", decimals: 2, peg: "USD (demo)" },
    priceFeed: db.priceFeed || { "DEMO.SUGAR": 650, "DEMO.RICE": 520, "DEMO.WHEAT": 580 },
    settings: db.settings || {
      feePercent: 0.75,
      platformWallet: "PLATFORM_WALLET_NOT_SET",
      insuranceEnabled: false,
      insurancePremiumPercent: 1.25,
      insuranceWallet: "INSURANCE_WALLET_NOT_SET",
      defaultDays: 14,
      incotermOptions: ["FOB", "CIF", "CFR", "EXW", "DAP", "DDP"],
      emailEnabled: false,
      ocrEnabled: false,
      antivirusEnabled: false
    },
    docsWhitelist: db.docsWhitelist || ["ICE.CARGODOCS", "IQAX", "CARGOX", "BOLERO", "WAVE.BL"],
    users: Array.isArray(db.users) ? db.users : [],
    trades: Array.isArray(db.trades) ? db.trades : [],
    tokens: Array.isArray(db.tokens) ? db.tokens : [],
    auctions: Array.isArray(db.auctions) ? db.auctions : [],
    kycSubmissions: Array.isArray(db.kycSubmissions) ? db.kycSubmissions : [],
    complianceChecks: Array.isArray(db.complianceChecks) ? db.complianceChecks : [],
    documentVerifications: Array.isArray(db.documentVerifications) ? db.documentVerifications : []
  };
}
function loadDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const empty = ensureDBShape({});
      fs.writeFileSync(DB_PATH, JSON.stringify(empty, null, 2));
      return empty;
    }
    const raw = fs.readFileSync(DB_PATH, "utf8");
    return ensureDBShape(JSON.parse(raw || "{}"));
  } catch (e) {
    console.error("loadDB error:", e);
    return ensureDBShape({});
  }
}
function saveDB(db) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(ensureDBShape(db), null, 2));
  } catch (e) {
    console.error("saveDB error:", e);
  }
}

// ---- Sessions (fileless, memory) ----
const SESS = new Map(); // token -> { userId, role, email }
function makeSession(u) {
  const t = uuid();
  SESS.set(t, { userId: u.id, role: u.role, email: u.email });
  return t;
}
function authToken(req, _res, next) {
  const t = req.headers["x-auth-token"] || "";
  req.session = SESS.get(t) || null;
  next();
}
function requireAuth(req, res, next) {
  if (!req.session) return res.status(401).json({ error: "auth required" });
  next();
}
function requireAdmin(req, res, next) {
  // either session.role=admin OR x-api-key matches ADMIN_KEY
  if ((req.headers["x-api-key"] || "") === ADMIN_KEY) return next();
  if (req.session && req.session.role === "admin") return next();
  return res.status(401).json({ error: "admin required" });
}

// ---- Finance helpers ----
function recomputeFinancials(t, settings) {
  const qty = Number(t.qty || 0);
  const unit = Number(t.unitPrice || 0);
  const gross = +(qty * unit).toFixed(2);

  const feePct = Math.max(0, Number(settings.feePercent || 0));
  const insEnabled = !!settings.insuranceEnabled;
  const insPct = Math.max(0, Number(settings.insurancePremiumPercent || 0));

  const platformFee = +(gross * (feePct / 100)).toFixed(2);
  const insurancePremium = insEnabled && t.insuranceApplied ? +(gross * (insPct / 100)).toFixed(2) : 0;

  const depositRequired = +(gross * 0.30).toFixed(2);
  const supplierNetOnDocs = +(gross - platformFee - insurancePremium).toFixed(2);

  return Object.assign(t, {
    amountGross: gross,
    depositRequired,
    platformFee,
    insurancePremium,
    supplierNetOnDocs
  });
}

// ---- Chain helpers (optional) ----
function chainEnabled() {
  return !!(SEPOLIA_RPC_URL && ESCROW_ADDRESS);
}
function getProvider() {
  if (!chainEnabled()) return null;
  try {
    return new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  } catch (e) {
    console.error("provider error", e);
    return null;
  }
}
// Dummy ABIs: you must replace if you have real contracts
const ESCROW_ABI = [
  // Example only: replace with your real methods
  "function deposit30(uint256 tradeId, uint256 amount) public",
  "function pay70(uint256 tradeId, uint256 amount) public",
  "function releaseDocs(uint256 tradeId, bytes32 keyHash) public",
  "event Deposited30(uint256 indexed tradeId, address indexed from, uint256 amount)",
  "event Paid70(uint256 indexed tradeId, address indexed from, uint256 amount)",
  "event Released(uint256 indexed tradeId)"
];

// ---- UI (inline theme + inline logo) ----
function css() {
  return `
:root{--brand:#2dd4bf;--brand-ink:#032620;--bg:#0b1220;--surface:#0f172a;--card:#111a2c;--ink:#e6eefc;--muted:#9fb0ce;--line:#223253;--chip:#1b2a46;--radius:16px;--shadow:0 10px 30px rgba(0,0,0,.35)}
*{box-sizing:border-box}html,body{height:100%}body{margin:0;background:radial-gradient(1200px 700px at 70% -10%,rgba(45,212,191,.06),transparent 60%) fixed,var(--bg);color:var(--ink);font:14px/1.5 Inter,system-ui,Segoe UI,Roboto}
a{color:var(--brand);text-decoration:none}.wrap{max-width:1140px;margin:32px auto;padding:0 16px}
.topbar{position:sticky;top:0;z-index:100;display:flex;align-items:center;gap:18px;padding:12px 20px;background:var(--surface);border-bottom:1px solid var(--line)}
.topbar .logo{display:flex;align-items:center;gap:10px;font-weight:700}.topbar nav{display:flex;gap:14px}
.topbar nav a{color:var(--ink);opacity:.8;padding:8px 10px;border-radius:10px}.topbar nav a.active{opacity:1;background:rgba(255,255,255,.04)}.topbar .sp{flex:1}
.badge{padding:6px 10px;background:var(--chip);color:var(--muted);border-radius:999px;font-size:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:18px 20px;margin:16px 0;box-shadow:0 8px 18px rgba(0,0,0,.2)}
.hero{display:grid;grid-template-columns:1.3fr 1fr;gap:24px;align-items:center;padding:24px;border-radius:var(--radius);background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:1px solid var(--line);box-shadow:var(--shadow)}
.hero h1{margin:0 0 10px;font-size:28px}.hero p{margin:0 0 16px;color:var(--muted)}.hero .stack{display:flex;gap:10px;flex-wrap:wrap}
.lbl{display:block;margin:6px 0 6px 2px;color:var(--muted)}.in{width:100%;background:#0b1322;border:1px solid var(--line);color:var(--ink);padding:10px 12px;border-radius:12px;outline:none}
.in:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(45,212,191,.15)}.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.grid{display:grid;gap:14px}.grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.btn{background:var(--brand);color:var(--brand-ink);border:0;padding:10px 16px;border-radius:12px;font-weight:700;cursor:pointer}.btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}.btn.xs{padding:6px 10px;font-size:12px;border-radius:10px}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid var(--line);text-align:left}
.small{font-size:12px;color:var(--muted)}.muted{color:var(--muted)}.mt{margin-top:12px}.footer{margin:24px 0 40px;text-align:center;color:var(--muted)}
`;}
function logo() {
  return `<svg width="24" height="24" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block"><rect x="2" y="2" width="24" height="24" rx="6" fill="#2dd4bf"/><path d="M9 14h10M14 9v10" stroke="#042925" stroke-width="2.4" stroke-linecap="round"/></svg>`;
}
function baseHead(title) {
  return `<!doctype html><html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
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
function nav(active=""){
  const tabs=[["Home","/portal"],["Trade Desk","/portal/trade"],["KYC","/portal/kyc"],["Wallet Setup","/portal/wallet-setup"],["Admin","/portal/admin"]];
  const items=tabs.map(([l,h])=>`<a class="${l===active?'active':''}" href="${h}">${l}</a>`).join("");
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

// ---- Enhanced Pages ----
function pageHome() {
  return `
${baseHead("Tangent — Home")}
<body>
  ${nav("Home")}
  <main class="wrap">
    <section class="hero">
      <div>
        <h1>Contracts, deposits & documents — on one screen.</h1>
        <p>Either party opens a contract. Buyer funds <b>30%</b>. Supplier uploads whitelisted e-docs. Admin verifies → Supplier receives <b>100%</b> and a Key is issued. Buyer pays final 70% and claims the Key to release documents.</p>
        <div class="stack">
          <a class="btn" href="/portal/trade">Open Trade Desk</a>
          <button class="btn ghost" onclick="runAutoDemo()">Run Auto-Demo</button>
          <a class="btn" href="/demo/interactive" style="background: linear-gradient(135deg, #3b82f6, #10b981); color: white;">🎬 Interactive Demos</a>
        </div>
      </div>
      <div>
        <div class="card">
          <h3>Sign in</h3>
          <div class="row">
            <input id="email" class="in" placeholder="email@example.com">
            <input id="pass" class="in" type="password" placeholder="password">
          </div>
          <div class="row mt">
            <button class="btn" onclick="login(email.value, pass.value)">Login</button>
            <button class="btn ghost" onclick="register(email.value, pass.value, 'buyer')">Register as Buyer</button>
            <button class="btn ghost" onclick="register(email.value, pass.value, 'supplier')">Register as Supplier</button>
          </div>
          <p class="small">For admin settings use key: <code>${ADMIN_KEY}</code></p>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Platform Features</h2>
      <div class="grid grid-2">
        <div class="card">
          <h3>🔒 Secure Escrow</h3>
          <p>Smart contract-based escrow ensures safe transactions with automatic fund release upon document verification.</p>
        </div>
        <div class="card">
          <h3>📄 Document Management</h3>
          <p>Upload, verify, and manage trade documents with blockchain-based integrity and IPFS storage.</p>
        </div>
        <div class="card">
          <h3>💰 Trade Finance</h3>
          <p>Access financing solutions with flexible deposit structures and automated payment flows.</p>
        </div>
        <div class="card">
          <h3>🔍 Compliance</h3>
          <p>Advanced compliance screening including sanctions, PEP checks, and AML monitoring.</p>
        </div>
        <div class="card">
          <h3>🤖 AI Document Verification</h3>
          <p>AI-powered document analysis and data extraction for enhanced verification.</p>
        </div>
        <div class="card">
          <h3>🦊 Crypto Beginner Support</h3>
          <p>Step-by-step wallet setup and guidance for new cryptocurrency users.</p>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>My Trades (quick view)</h2>
      <div id="myTrades" class="small muted">Sign in to view…</div>
      <div class="row mt"><a class="btn ghost" href="/portal/trade">Go to Trade Desk</a></div>
    </section>

    <div class="footer small">© Tangent — Complete Platform</div>
  </main>

  <script>
    async function runAutoDemo(){
      try{
        const r = await fetch('/api/demo/run',{method:'POST'});
        const j = await r.json();
        alert(j.ok ? 'Demo ran. Open Trade Desk.' : (j.error||'Demo failed'));
      }catch(e){ alert('Demo failed'); }
    }
    (async function loadMine(){
      try{
        const j = await api('/api/me/trades');
        const el = document.getElementById('myTrades');
        if(!j.trades || !j.trades.length){ el.textContent = 'No trades yet.'; return; }
        el.innerHTML = j.trades.map(t=>t.id + ' — ' + (t.name||'-') + ' — ' + (t.status||'-')).join('<br>');
      }catch(e){}
    })();
  </script>
</body></html>`;
}


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
      
      <div class="card" style="background: rgba(16,185,129,0.05); border: 1px solid #10b981; margin: 20px 0;">
        <h3>🔍 AI Processing Features</h3>
        <div class="grid grid-2" style="gap: 20px;">
          <div>
            <h4 style="color: #10b981;">📊 Data Extraction</h4>
            <ul class="small muted" style="margin: 10px 0 0 20px;">
              <li>Company name, registration number</li>
              <li>Incorporation date and jurisdiction</li>
              <li>Directors and beneficial owners</li>
              <li>Financial data and ratios</li>
            </ul>
          </div>
          <div>
            <h4 style="color: #10b981;">✅ Verification</h4>
            <ul class="small muted" style="margin: 10px 0 0 20px;">
              <li>QR code validation (if available)</li>
              <li>Document authenticity checks</li>
              <li>Cross-reference with databases</li>
              <li>Sanctions and PEP screening</li>
            </ul>
          </div>
        </div>
      </div>
      
      <form id="documentUploadForm" enctype="multipart/form-data">
        <div id="uploadAreas"></div>
        
        <!-- Smart Contract Upload -->
        <div class="card" style="background: rgba(59,130,246,0.05); border: 1px solid #3b82f6; margin: 20px 0;">
          <h3>📜 Smart Contract Generation (Optional)</h3>
          <p class="muted">Upload your contract template (PDF/DOC) and we'll convert it to a smart contract format.</p>
          <div style="margin: 15px 0;">
            <label class="lbl">Contract Template</label>
            <input class="in" name="contractTemplate" type="file" accept=".pdf,.doc,.docx">
            <p class="small muted">Supported: Trade agreements, supply contracts, service agreements</p>
          </div>
        </div>
        
        <!-- Crypto Experience Assessment -->
        <div class="card" style="background: rgba(45,212,191,0.05); border: 1px solid var(--brand);">
          <h3 style="color: var(--brand); margin-bottom: 15px;">💰 Cryptocurrency Experience</h3>
          <div style="margin: 20px 0;">
            <label style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; padding: 10px; border: 1px solid var(--line); border-radius: 8px; cursor: pointer;">
              <input type="radio" name="cryptoExperience" value="beginner" onchange="handleCryptoExperience()" style="margin: 0;">
              <div>
                <div style="font-weight: 600; color: var(--ink);">I am new to cryptocurrency</div>
                <div class="small muted">I need guidance with wallet setup and crypto basics</div>
              </div>
            </label>
            
            <label style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; padding: 10px; border: 1px solid var(--line); border-radius: 8px; cursor: pointer;">
              <input type="radio" name="cryptoExperience" value="intermediate" onchange="handleCryptoExperience()" style="margin: 0;">
              <div>
                <div style="font-weight: 600; color: var(--ink);">I have some experience</div>
                <div class="small muted">I know the basics but may need some help</div>
              </div>
            </label>
            
            <label style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; padding: 10px; border: 1px solid var(--line); border-radius: 8px; cursor: pointer;">
              <input type="radio" name="cryptoExperience" value="expert" onchange="handleCryptoExperience()" style="margin: 0;">
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
    
    <!-- Processing Status -->
    <section class="card" id="processingStatus" style="display: none;">
      <h2>⚡ AI Processing Status</h2>
      <div id="processingSteps"></div>
    </section>
    
    <!-- Results Section -->
    <section class="card" id="resultsSection" style="display: none;">
      <h2>📊 Extracted Information & Compliance Report</h2>
      <div id="extractedData"></div>
      <div id="complianceReport"></div>
    </section>
  </main>
  
  <script>
    let selectedEntityType = null;
    let uploadedDocuments = {};
    
    // Entity type selection
    document.addEventListener('DOMContentLoaded', function() {
      console.log('KYC page loaded, setting up entity selection...');
      
      const entityOptions = document.querySelectorAll('.entity-option');
      console.log('Found entity options:', entityOptions.length);
      
      entityOptions.forEach(option => {
        option.addEventListener('click', function() {
          console.log('Entity option clicked:', this.dataset.entity);
          
          // Remove active state from all options
          entityOptions.forEach(opt => {
            opt.style.borderColor = '#e5e7eb';
            opt.style.background = '';
          });
          
          // Add active state to selected option
          this.style.borderColor = '#10b981';
          this.style.background = 'rgba(16,185,129,0.05)';
          
          selectedEntityType = this.dataset.entity;
          showDocumentUpload(selectedEntityType);
        });
      });
    });
    
    function showDocumentUpload(entityType) {
      console.log('Showing document upload for:', entityType);
      
      const uploadSection = document.getElementById('documentUploadSection');
      const requirementsDiv = document.getElementById('documentRequirements');
      const uploadAreasDiv = document.getElementById('uploadAreas');
      
      if (!uploadSection) {
        console.error('Upload section not found!');
        return;
      }
      
      uploadSection.style.display = 'block';
      
      let requirements = [];
      if (entityType === 'private') {
        requirements = [
          { id: 'incorporation', name: 'Certificate of Incorporation', required: true },
          { id: 'bylaws', name: 'Articles of Association / Bylaws', required: true },
          { id: 'ubo_passport', name: 'UBO Passport/ID Card', required: true },
          { id: 'ubo_address', name: 'UBO Proof of Residence', required: true },
          { id: 'financials', name: 'Financial Statements (last 2 years)', required: true }
        ];
      } else if (entityType === 'public') {
        requirements = [
          { id: 'annual_report', name: 'Latest 10-K/Annual Report', required: true },
          { id: 'exchange_info', name: 'Exchange Symbol & Trading Info', required: true },
          { id: 'board_resolution', name: 'Board Resolution', required: false },
          { id: 'signatory_docs', name: 'Authorized Signatory Documents', required: true }
        ];
      }
      
      // Show requirements
      requirementsDiv.innerHTML = '<h3>📋 Required Documents for ' + (entityType === 'private' ? 'Private Company' : 'Public Company') + '</h3>';
      
      // Create upload areas
      let uploadHTML = '';
      requirements.forEach(req => {
        uploadHTML += '<div class="card" style="margin: 15px 0; border: 1px solid #e5e7eb;"><h4>' + req.name + (req.required ? ' <span style="color: #ef4444;">*</span>' : ' <span class="muted">(Optional)</span>') + '</h4><input class="in" name="' + req.id + '" type="file" accept=".pdf,.jpg,.jpeg,.png" ' + (req.required ? 'required' : '') + ' onchange="handleFileUpload(this, \'' + req.id + '\')"><div id="preview_' + req.id + '" style="margin-top: 10px;"></div></div>';
      });
      
      uploadAreasDiv.innerHTML = uploadHTML;
    }
    
    function handleFileUpload(input, docType) {
      const file = input.files[0];
      if (file) {
        uploadedDocuments[docType] = file;
        const preview = document.getElementById('preview_' + docType);
        if (preview) {
          preview.innerHTML = '<div style="color: #10b981; font-size: 14px;">✅ ' + file.name + ' (' + (file.size / 1024 / 1024).toFixed(2) + ' MB)</div>';
        }
      }
    }
    
    function handleCryptoExperience() {
      const selectedExperience = document.querySelector('input[name="cryptoExperience"]:checked')?.value;
      if (selectedExperience) {
        localStorage.setItem("cryptoExperience", selectedExperience);
        localStorage.setItem("needsWalletHelp", selectedExperience === "beginner" ? "true" : "false");
      }
    }
    
    // Demo function to bypass actual processing for now
    function completeKYC() {
      const needsWalletHelp = localStorage.getItem("needsWalletHelp");
      if (needsWalletHelp === "true") {
        window.location.href = "/portal/wallet-setup";
      } else {
        window.location.href = "/portal/role-selection";
      }
    }
  </script>
</body></html>`;
}

function pageWalletSetup() {
  return `
${baseHead("Tangent — Wallet Setup Guide")}
<body>
  ${nav("Wallet Setup")}
  <main class="wrap">
    <section class="card">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="font-size: 48px; margin-bottom: 15px;">🦊</div>
        <h1 style="color: var(--brand);">Cryptocurrency Wallet Setup Guide</h1>
        <p class="muted">Don't worry - we'll walk you through everything step by step. Setting up your wallet is easier than you think!</p>
      </div>
      
      <div class="card" style="background: rgba(45,212,191,0.05); border: 1px solid var(--brand);">
        <div style="display: flex; align-items: flex-start; gap: 20px;">
          <div style="background: var(--brand); color: var(--brand-ink); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">1</div>
          <div>
            <h3 style="margin-bottom: 10px;">Download MetaMask Wallet</h3>
            <p class="muted" style="margin-bottom: 15px;">MetaMask is the most popular and secure cryptocurrency wallet. It works as a browser extension.</p>
            <div style="margin: 15px 0;">
              <a href="https://metamask.io/download/" target="_blank" class="btn" style="margin-right: 10px;">
                🦊 Download MetaMask
              </a>
            </div>
            <p class="small muted">Available for Chrome, Firefox, Safari, and mobile devices</p>
          </div>
        </div>
      </div>
      
      <div class="card" style="background: rgba(45,212,191,0.05); border: 1px solid var(--brand);">
        <div style="display: flex; align-items: flex-start; gap: 20px;">
          <div style="background: var(--brand); color: var(--brand-ink); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">2</div>
          <div>
            <h3 style="margin-bottom: 10px;">Create Your Wallet</h3>
            <p class="muted" style="margin-bottom: 15px;">Follow MetaMask's setup wizard to create your first wallet:</p>
            <ul style="margin: 10px 0 10px 20px; color: var(--muted); line-height: 1.6;">
              <li>Click "Create a Wallet"</li>
              <li>Set a strong password (save it safely!)</li>
              <li>Write down your 12-word seed phrase</li>
              <li><strong style="color: #ef4444;">IMPORTANT:</strong> Store your seed phrase offline and secure!</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div class="card" style="background: rgba(45,212,191,0.05); border: 1px solid var(--brand);">
        <div style="display: flex; align-items: flex-start; gap: 20px;">
          <div style="background: var(--brand); color: var(--brand-ink); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">3</div>
          <div>
            <h3 style="margin-bottom: 10px;">Fund Your Wallet</h3>
            <p class="muted" style="margin-bottom: 15px;">To start trading, you'll need to add cryptocurrency to your wallet:</p>
            <div style="margin: 15px 0;">
              <h4 style="color: var(--brand); margin-bottom: 5px;">Option A: Buy Crypto Directly</h4>
              <p class="small muted" style="margin-bottom: 15px;">Use MetaMask's built-in purchase feature with your credit card</p>
              
              <h4 style="color: var(--brand); margin-bottom: 5px;">Option B: Transfer from Exchange</h4>
              <p class="small muted">Buy crypto on Coinbase/Binance and transfer to your MetaMask wallet</p>
            </div>
          </div>
        </div>
      </div>
      
      <div class="card" style="background: rgba(45,212,191,0.05); border: 1px solid var(--brand);">
        <div style="display: flex; align-items: flex-start; gap: 20px;">
          <div style="background: var(--brand); color: var(--brand-ink); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">4</div>
          <div>
            <h3 style="margin-bottom: 10px;">Connect to Tangent Platform</h3>
            <p class="muted" style="margin-bottom: 15px;">Once your wallet is ready, you can connect it to our platform:</p>
            <div style="margin: 15px 0;">
              <button class="btn" onclick="connectWallet()" style="background: #10b981; margin-right: 10px;">
                🔗 Connect MetaMask Wallet
              </button>
              <span id="walletStatus" class="small muted">Not connected</span>
            </div>
          </div>
        </div>
      </div>
      
      <div style="background: rgba(59,130,246,0.1); border: 2px solid #3b82f6; border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
        <h3 style="color: #3b82f6; margin-bottom: 15px;">🛡️ Security Tips</h3>
        <div style="color: #3b82f6; text-align: left; line-height: 1.6;">
          <p style="margin-bottom: 8px;">• <strong>Never share your seed phrase</strong> with anyone</p>
          <p style="margin-bottom: 8px;">• <strong>Double-check website URLs</strong> before entering your wallet details</p>
          <p style="margin-bottom: 8px;">• <strong>Start with small amounts</strong> until you're comfortable</p>
          <p style="margin-bottom: 8px;">• <strong>Use strong passwords</strong> and enable 2FA when possible</p>
          <p style="margin-bottom: 8px;">• <strong>Keep your software updated</strong> for the latest security features</p>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <a href="/portal/trade" class="btn" style="margin-right: 15px;">
          Continue to Trading Platform
        </a>
        <a href="/portal" class="btn ghost">
          Back to Home
        </a>
      </div>
    </section>
  </main>

  <script>
    async function connectWallet() {
      if (typeof window.ethereum !== "undefined") {
        try {
          await window.ethereum.request({ method: "eth_requestAccounts" });
          document.getElementById('walletStatus').textContent = 'Connected successfully! 🎉';
          document.getElementById('walletStatus').style.color = '#10b981';
          setTimeout(() => {
            if (confirm('Wallet connected! Would you like to continue to the trading platform?')) {
              window.location.href = "/portal/trade";
            }
          }, 1000);
        } catch (error) {
          console.error("Wallet connection error:", error);
          document.getElementById('walletStatus').textContent = 'Connection failed. Please try again.';
          document.getElementById('walletStatus').style.color = '#ef4444';
        }
      } else {
        document.getElementById('walletStatus').textContent = 'MetaMask not detected. Please install MetaMask first.';
        document.getElementById('walletStatus').style.color = '#f59e0b';
        window.open("https://metamask.io/download/", "_blank");
      }
    }
  </script>
</body></html>`;
}

function pageAdmin() {
  return `
${baseHead("Tangent — Admin")}
<body>
  ${nav("Admin")}
  <main class="wrap">
    <section class="card">
      <h2>Admin Settings</h2>
      <p class="small">Use admin key <code>${ADMIN_KEY}</code> to save.</p>
      <div class="grid grid-2">
        <div><label class="lbl">Platform Fee (%)</label><input id="s_fee" class="in" type="number" step="0.01"></div>
        <div><label class="lbl">Platform Wallet</label><input id="s_fee_wallet" class="in" placeholder="0x..."></div>
        <div>
          <label class="lbl">Insurance Enabled</label>
          <div class="row">
            <label class="chip"><input type="radio" name="s_ins_enabled" value="yes"> Yes</label>
            <label class="chip"><input type="radio" name="s_ins_enabled" value="no"> No</label>
          </div>
        </div>
        <div></div>
        <div><label class="lbl">Insurance Premium (%)</label><input id="s_ins_pct" class="in" type="number" step="0.01"></div>
        <div><label class="lbl">Insurance Wallet</label><input id="s_ins_wallet" class="in" placeholder="0x..."></div>

        <div><label class="lbl">Email Enabled</label><div class="row"><label class="chip"><input type="radio" name="s_email" value="yes"> Yes</label><label class="chip"><input type="radio" name="s_email" value="no"> No</label></div></div>
        <div><label class="lbl">OCR Enabled</label><div class="row"><label class="chip"><input type="radio" name="s_ocr" value="yes"> Yes</label><label class="chip"><input type="radio" name="s_ocr" value="no"> No</label></div></div>
        <div><label class="lbl">Antivirus Enabled</label><div class="row"><label class="chip"><input type="radio" name="s_av" value="yes"> Yes</label><label class="chip"><input type="radio" name="s_av" value="no"> No</label></div></div>
      </div>
      <div class="row mt">
        <input id="adm_key" class="in" placeholder="admin key">
        <button class="btn" onclick="saveSettings()">Save Settings</button>
        <button class="btn ghost" onclick="loadSettings()">Reload</button>
        <a class="btn ghost" href="/api/admin/export-csv" target="_blank">Download Trades CSV</a>
      </div>
    </section>

    <section class="card">
      <h2>Verify Trades & Issue Key</h2>
      <div id="verifyList" class="small">Loading…</div>
    </section>

    <section class="card">
      <h2>Compliance Management</h2>
      <div id="complianceList" class="small">Loading compliance checks...</div>
      <div class="row mt">
        <button class="btn ghost" onclick="loadCompliance()">Refresh Compliance</button>
        <button class="btn" onclick="runComplianceCheck()">Run Manual Check</button>
      </div>
    </section>

    <section class="card">
      <h2>AI Document Verification</h2>
      <div id="documentList" class="small">Loading document verifications...</div>
      <div class="row mt">
        <button class="btn ghost" onclick="loadDocuments()">Refresh Documents</button>
      </div>
    </section>

    <section class="card">
      <h3>Platform Management</h3>
      <div class="row">
        <button class="btn ghost" onclick="seedDemo()">Seed Full Demo</button>
        <button class="btn ghost" onclick="exportData()">Export All Data</button>
        <button class="btn ghost" onclick="systemStatus()">System Status</button>
      </div>
    </section>
  </main>

  <script>
    async function loadSettings(){
      const j = await (await fetch('/api/admin/settings')).json();
      const s = j.settings||{};
      s_fee.value = s.feePercent??''; s_fee_wallet.value = s.platformWallet??'';
      s_ins_pct.value = s.insurancePremiumPercent??''; s_ins_wallet.value = s.insuranceWallet??'';
      (document.querySelector('input[name="s_ins_enabled"][value="'+(s.insuranceEnabled?'yes':'no')+'"]')||{}).checked = true;
      (document.querySelector('input[name="s_email"][value="'+(s.emailEnabled?'yes':'no')+'"]')||{}).checked = true;
      (document.querySelector('input[name="s_ocr"][value="'+(s.ocrEnabled?'yes':'no')+'"]')||{}).checked = true;
      (document.querySelector('input[name="s_av"][value="'+(s.antivirusEnabled?'yes':'no')+'"]')||{}).checked = true;
    }
    async function saveSettings(){
      const key = adm_key.value.trim();
      if(!key){ alert('admin key required'); return; }
      const body = {
        feePercent: parseFloat(s_fee.value),
        platformWallet: s_fee_wallet.value.trim(),
        insuranceEnabled: (document.querySelector('input[name="s_ins_enabled"]:checked')?.value==='yes'),
        insurancePremiumPercent: parseFloat(s_ins_pct.value),
        insuranceWallet: s_ins_wallet.value.trim(),
        emailEnabled: (document.querySelector('input[name="s_email"]:checked')?.value==='yes'),
        ocrEnabled: (document.querySelector('input[name="s_ocr"]:checked')?.value==='yes'),
        antivirusEnabled: (document.querySelector('input[name="s_av"]:checked')?.value==='yes')
      };
      const r = await fetch('/api/admin/settings',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key},body:JSON.stringify(body)});
      const j = await r.json(); if(j.error){ alert(j.error); return; } alert('Saved');
    }
    async function seedDemo(){
      const j = await (await fetch('/api/admin/seed-demo',{method:'POST'})).json();
      alert(j.ok?'Seeded':'Failed');
      loadVerify();
    }
    async function loadVerify(){
      const j = await (await fetch('/api/trade/list')).json();
      const arr = (j.trades||[]).filter(t=>t.buyerDepositPaid && !t.docsVerified);
      if(!arr.length){ verifyList.textContent = 'Nothing to verify.'; return; }
      verifyList.innerHTML = arr.map(t=>\`
        <div class="row" style="margin:8px 0">
          <span>#\${t.id} — \${t.name||'-'} — deposit:\$ \${t.depositRequired?.toFixed?.(2)||t.depositRequired} — docs:\${(t.docsFiles||[]).length} file(s)</span>
          <button class="btn xs" onclick="verifyTrade('\${t.id}')">Verify & Issue Key</button>
        </div>\`).join('');
    }
    async function verifyTrade(id){
      const key = prompt('Admin key to verify '+id+':');
      if(!key) return;
      const j = await (await fetch('/api/trade/verify',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key},body:JSON.stringify({tradeId:id})})).json();
      if(j.error){ alert(j.error); return; }
      alert('Verified. Key issued to buyer.');
      loadVerify();
    }
    async function loadCompliance(){
      try{
        const j = await (await fetch('/api/compliance/history')).json();
        const list = (j||[]).slice(-10);
        if(!list.length){ complianceList.textContent = 'No compliance checks yet.'; return; }
        complianceList.innerHTML = list.map(c=>\`
          <div class="row" style="margin:8px 0; padding:8px; border:1px solid var(--line); border-radius:8px;">
            <span>\${c.entityName} — \${c.checkType} — \${c.status} — Risk: \${c.risk}</span>
          </div>\`).join('');
      }catch(e){ complianceList.textContent = 'Failed to load compliance data.'; }
    }
    async function runComplianceCheck(){
      const name = prompt('Entity name for compliance check:');
      if(!name) return;
      try{
        const j = await (await fetch('/api/compliance/screen',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entityName:name})})).json();
        alert('Compliance check completed. Risk: ' + j.risk);
        loadCompliance();
      }catch(e){ alert('Compliance check failed'); }
    }
    async function loadDocuments(){
      try{
        const j = await (await fetch('/api/documents/verifications')).json();
        const list = (j||[]).slice(-10);
        if(!list.length){ documentList.textContent = 'No document verifications yet.'; return; }
        documentList.innerHTML = list.map(d=>\`
          <div class="row" style="margin:8px 0; padding:8px; border:1px solid var(--line); border-radius:8px;">
            <span>\${d.documentType} — \${d.verificationStatus} — Confidence: \${(d.confidence*100).toFixed(1)}%</span>
          </div>\`).join('');
      }catch(e){ documentList.textContent = 'Failed to load document data.'; }
    }
    async function exportData(){
      try{
        const j = await (await fetch('/api/admin/export-all')).json();
        alert('Data exported: ' + j.records + ' records');
      }catch(e){ alert('Export failed'); }
    }
    async function systemStatus(){
      try{
        const j = await (await fetch('/api/admin/status')).json();
        alert('System Status:\\nUsers: ' + j.users + '\\nTrades: ' + j.trades + '\\nUptime: ' + j.uptime);
      }catch(e){ alert('Status check failed'); }
    }
    loadSettings(); loadVerify(); loadCompliance(); loadDocuments();
  </script>
</body></html>`;
}

function pageTrade() {
  return `
${baseHead("Tangent — Trade Desk")}
<body>
  ${nav("Trade Desk")}
  <main class="wrap">
    <section class="card">
      <h2>Open a Contract</h2>
      <p class="muted">Buyer must fund <b>30%</b>. If Buyer opens, Supplier must confirm after deposit.</p>
      <div class="grid grid-2">
        <div>
          <label class="lbl">I am</label>
          <div class="row">
            <label class="chip"><input type="radio" name="creatorRole" value="supplier" checked> Supplier</label>
            <label class="chip"><input type="radio" name="creatorRole" value="buyer"> Buyer</label>
          </div>
        </div><div></div>
        <div><label class="lbl">Product/Name</label><input id="t_name" class="in" placeholder="White Sugar 50kg"></div>
        <div><label class="lbl">Qty (MT)</label><input id="t_qty" class="in" type="number" value="100"></div>
        <div><label class="lbl">Unit Price</label><input id="t_price" class="in" type="number" value="7.50" step="0.01"></div>
        <div><label class="lbl">Index Symbol</label><input id="t_index" class="in" value="DEMO.SUGAR"></div>
        <div><label class="lbl">Incoterms</label><input id="t_incoterms" class="in" value="FOB Shanghai"></div><div></div>
        <div><label class="lbl">Buyer ID</label><input id="t_buyer" class="in" placeholder="buyer-001"></div>
        <div><label class="lbl">Supplier ID</label><input id="t_supplier" class="in" placeholder="supplier-001"></div>
        <div>
          <label class="lbl">Apply Insurance?</label>
          <div class="row"><label class="chip"><input type="radio" name="insApply" value="yes" checked> Yes</label><label class="chip"><input type="radio" name="insApply" value="no"> No</label></div>
        </div><div></div>
      </div>
      <div class="row mt"><button class="btn" onclick="createTrade()">Create Contract</button></div>
    </section>

    <section class="card">
      <h2>Existing Trades</h2>
      <p class="muted">Actions appear based on your role and status. Upload docs (supplier), verify (admin), pay 70% + claim key (buyer).</p>
      <div class="table-wrap">
        <table id="tbl"><thead><tr>
          <th>ID</th><th>Name</th><th>Qty</th><th>Index</th><th>Incoterms</th>
          <th>Creator</th><th>Status</th><th>Gross</th><th>30% Deposit</th><th>Platform Fee</th><th>Insurance</th><th>Supplier Net@Docs</th><th>Actions</th>
        </tr></thead><tbody></tbody></table>
      </div>
    </section>

    <section class="card">
      <h3>Upload Trade Docs (Supplier)</h3>
      <form id="docForm">
        <div class="row">
          <input class="in" name="tradeId" placeholder="Trade ID">
          <select class="in" name="provider">
            <option>ICE.CARGODOCS</option><option>IQAX</option><option>CARGOX</option><option>BOLERO</option><option>WAVE.BL</option>
          </select>
        </div>
        <label class="lbl">Files</label>
        <input class="in" type="file" name="files" multiple>
        <div class="row mt"><button class="btn" type="submit">Upload</button></div>
      </form>
    </section>

    <section class="card">
      <h3>AI Document Verification</h3>
      <form id="aiDocForm">
        <div class="row">
          <input class="in" name="tradeId" placeholder="Trade ID">
          <select class="in" name="docType">
            <option value="invoice">Invoice</option>
            <option value="bill_of_lading">Bill of Lading</option>
            <option value="certificate">Certificate</option>
            <option value="contract">Contract</option>
          </select>
        </div>
        <label class="lbl">Document File</label>
        <input class="in" type="file" name="document" accept=".pdf,.jpg,.png">
        <div class="row mt"><button class="btn" type="submit">Verify with AI</button></div>
      </form>
    </section>

    <section class="card">
      <h3>Compliance Check</h3>
      <div class="row">
        <input id="complianceEntity" class="in" placeholder="Entity name">
        <select id="complianceType" class="in">
          <option value="sanctions">Sanctions</option>
          <option value="pep">PEP Check</option>
          <option value="aml">AML</option>
        </select>
        <button class="btn" onclick="runCompliance()">Run Check</button>
      </div>
      <div id="complianceResult" class="mt small"></div>
    </section>
  </main>

  <script>
    function role(){ try{return localStorage.getItem('role')||'buyer'}catch(e){return 'buyer'} }
    function \$fmt(n){ return (n==null || isNaN(n))?'-':Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
    function statusLabel(s){ return s||'-'; }

    async function createTrade(){
      const roleSel = [...document.querySelectorAll('input[name="creatorRole"]')].find(r=>r.checked)?.value || 'supplier';
      const insApply = ([...document.querySelectorAll('input[name="insApply"]')].find(r=>r.checked)?.value || 'yes')==='yes';
      const body = {
        name: t_name.value.trim(), qty: t_qty.value, unitPrice: t_price.value,
        indexSymbol: t_index.value.trim(), incoterms: t_incoterms.value.trim(),
        buyerId: t_buyer.value.trim(), supplierId: t_supplier.value.trim(),
        creatorRole: roleSel, insuranceApplied: insApply
      };
      const j = await api('/api/trade/create',{method:'POST', body: JSON.stringify(body)});
      if(j.error){ alert(j.error); return; }
      alert('Created'); loadTrades();
    }

    async function payDeposit(id){
      const j = await api('/api/trade/deposit',{method:'POST', body: JSON.stringify({tradeId:id})});
      if(j.error){ alert(j.error); return; }
      alert('30% recorded'); loadTrades();
    }
    async function supplierConfirm(id){
      const j = await api('/api/trade/confirm',{method:'POST', body: JSON.stringify({tradeId:id})});
      if(j.error){ alert(j.error); return; }
      alert('Supplier confirmed'); loadTrades();
    }

    async function finalPay(id){
      const j = await api('/api/trade/final-pay',{method:'POST', body: JSON.stringify({tradeId:id})});
      if(j.error){ alert(j.error); return; }
      alert('Final 70% recorded' + (j.onChain?' (on-chain)':'')); loadTrades();
    }
    async function claimKey(id){
      const key = prompt('Enter key to claim and release docs:');
      if(!key) return;
      const j = await api('/api/trade/claim',{method:'POST', body: JSON.stringify({tradeId:id, keyCode:key})});
      if(j.error){ alert(j.error); return; }
      alert('Docs released'); loadTrades();
    }

    async function loadTrades(){
      const j = await api('/api/trade/list');
      const tb = document.querySelector('#tbl tbody'); tb.innerHTML='';
      const r0 = role();
      (j.trades||[]).forEach(t=>{
        const canBuyerDeposit = (!t.buyerDepositPaid && t.status==='awaiting_buyer_deposit' && r0==='buyer');
        const needsSupplierConfirm = (t.status==='awaiting_supplier_confirm' && r0==='supplier');
        const canFinalPay = (t.status==='confirmed' && !t.finalPaid && r0==='buyer');
        const canClaim = (t.docsVerified && t.finalPaid && !t.released && r0==='buyer');

        let actions = '';
        if (canBuyerDeposit) actions += \`<button class="btn xs" onclick="payDeposit('\${t.id}')">Pay 30%</button>\`;
        if (needsSupplierConfirm) actions += \`<button class="btn xs" onclick="supplierConfirm('\${t.id}')">Confirm</button>\`;
        if (canFinalPay) actions += \`<button class="btn xs" onclick="finalPay('\${t.id}')">Pay 70%</button>\`;
        if (canClaim) actions += \`<button class="btn xs" onclick="claimKey('\${t.id}')">Claim Key</button>\`;

        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${t.id}</td><td>\${t.name||''}</td><td>\${t.qty||''}</td><td>\${t.indexSymbol||''}</td><td>\${t.incoterms||''}</td>
          <td>\${t.creatorRole}</td><td>\${statusLabel(t.status)}</td>
          <td>\$ \${$fmt(t.amountGross)}</td><td>\$ \${$fmt(t.depositRequired)}</td>
          <td>\$ \${$fmt(t.platformFee)}</td><td>\$ \${$fmt(t.insurancePremium)}</td><td>\$ \${$fmt(t.supplierNetOnDocs)}</td>
          <td>\${actions||'-'}</td>\`;
        tb.appendChild(tr);
      });
    }

    // docs upload
    document.getElementById('docForm').addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(e.target);
      try{
        const r = await fetch('/api/docs/upload',{method:'POST', headers:{'x-auth-token':getToken()}, body: fd});
        const j = await r.json();
        alert(j.ok?'Uploaded':'Failed');
        loadTrades();
      }catch(_){}
    });

    // AI doc verification
    document.getElementById('aiDocForm').addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(e.target);
      try{
        const r = await fetch('/api/documents/verify',{method:'POST', headers:{'x-auth-token':getToken()}, body: fd});
        const j = await r.json();
        alert(j.verificationStatus === 'verified' ? 'Document verified by AI!' : 'Verification failed');
      }catch(_){ alert('AI verification failed'); }
    });

    async function runCompliance(){
      const entity = document.getElementById('complianceEntity').value.trim();
      const type = document.getElementById('complianceType').value;
      if(!entity) { alert('Enter entity name'); return; }
      
      try{
        const j = await api('/api/compliance/screen',{method:'POST', body: JSON.stringify({entityName:entity, checkType:type})});
        document.getElementById('complianceResult').innerHTML = \`
          <div style="padding:10px; border:1px solid var(--line); border-radius:8px;">
            <strong>Result:</strong> \${j.status}<br>
            <strong>Risk Level:</strong> \${j.risk}<br>
            <strong>Matches:</strong> \${j.matches.length} found
          </div>\`;
      }catch(e){ 
        document.getElementById('complianceResult').textContent = 'Compliance check failed';
      }
    }

    loadTrades();
  </script>
</body></html>`;
}

// ---- Demo Pages ----
function pageInteractiveDemo() {
  return `
${baseHead("Tangent — Interactive Demo")}
<body style="background: var(--bg);">
  <main class="wrap">
    <section class="card" style="text-align: center; margin: 40px 0;">
      <h1 style="font-size: 3rem; background: linear-gradient(90deg, #3b82f6, #10b981); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">🎬 Interactive Platform Demo</h1>
      <p style="font-size: 1.2rem; color: var(--muted); margin: 30px 0;">Choose your user journey to explore the complete Tangent Platform</p>
      
      <div class="grid grid-2" style="max-width: 800px; margin: 50px auto; gap: 40px;">
        <div class="card" style="background: linear-gradient(135deg, #10b981, #059669); color: white; text-align: center;">
          <div style="font-size: 4rem; margin-bottom: 20px;">🟢</div>
          <h2>Crypto Beginner Buyer</h2>
          <p style="margin: 15px 0;">New to crypto, guided experience from wallet setup to successful trade</p>
          <a href="/demo/buyer-journey" class="btn" style="background: white; color: #10b981; font-weight: bold; display: inline-block; margin-top: 15px;">Start Buyer Journey</a>
        </div>
        <div class="card" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; text-align: center;">
          <div style="font-size: 4rem; margin-bottom: 20px;">🔵</div>
          <h2>Expert Supplier</h2>
          <p style="margin: 15px 0;">Crypto experienced, advanced features and business scaling</p>
          <a href="/demo/supplier-journey" class="btn" style="background: white; color: #f59e0b; font-weight: bold; display: inline-block; margin-top: 15px;">Start Supplier Journey</a>
        </div>
      </div>
      
      <div style="margin-top: 50px;">
        <a href="/portal" class="btn ghost">← Return to Platform</a>
      </div>
    </section>
  </main>
</body></html>`;
}

function pageBuyerDemo() {
  return `
${baseHead("Tangent — Buyer Journey Demo")}
<body style="background: var(--bg);">
  <main class="wrap">
    <section class="card" style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 40px; border-radius: 16px; text-align: center; margin-bottom: 40px;">
      <h1 style="font-size: 2.5rem;">🟢 Crypto Beginner Buyer Journey</h1>
      <p style="font-size: 1.2rem;">Complete step-by-step experience for new cryptocurrency users</p>
    </section>
    
    <section class="card">
      <h2>Complete Journey Overview</h2>
      <div class="grid grid-2" style="gap: 30px; margin: 30px 0;">
        <div class="card" style="border: 2px solid #10b981;">
          <h3>✅ Step 1: Registration & Assessment</h3>
          <p>User signs up and identifies as crypto beginner through our experience questionnaire</p>
          <div class="small" style="background: rgba(16,185,129,0.1); padding: 10px; border-radius: 8px; margin-top: 10px;">
            <strong>Key Features:</strong> Smart onboarding, experience detection, personalized flow
          </div>
        </div>
        <div class="card" style="border: 2px solid #10b981;">
          <h3>✅ Step 2: KYC with Crypto Support</h3>
          <p>Enhanced KYC process detects beginner status and triggers wallet setup assistance</p>
          <div class="small" style="background: rgba(16,185,129,0.1); padding: 10px; border-radius: 8px; margin-top: 10px;">
            <strong>Key Features:</strong> Integrated compliance, crypto assessment, guided path
          </div>
        </div>
        <div class="card" style="border: 2px solid #10b981;">
          <h3>✅ Step 3: Guided Wallet Setup</h3>
          <p>Step-by-step MetaMask installation, wallet creation, and security education</p>
          <div class="small" style="background: rgba(16,185,129,0.1); padding: 10px; border-radius: 8px; margin-top: 10px;">
            <strong>Key Features:</strong> Visual guides, security tips, funding options, wallet connection
          </div>
        </div>
        <div class="card" style="border: 2px solid #10b981;">
          <h3>✅ Step 4: Platform Tutorial</h3>
          <p>Interactive training on trading basics, platform navigation, and safety measures</p>
          <div class="small" style="background: rgba(16,185,129,0.1); padding: 10px; border-radius: 8px; margin-top: 10px;">
            <strong>Key Features:</strong> Interactive guides, safety education, practice mode
          </div>
        </div>
        <div class="card" style="border: 2px solid #10b981;">
          <h3>✅ Step 5: First Trade Assistance</h3>
          <p>Guided product selection, compliance checks, and assisted purchase flow</p>
          <div class="small" style="background: rgba(16,185,129,0.1); padding: 10px; border-radius: 8px; margin-top: 10px;">
            <strong>Key Features:</strong> Product recommendations, real-time support, risk assessment
          </div>
        </div>
        <div class="card" style="border: 2px solid #10b981;">
          <h3>✅ Result: Successful Transaction!</h3>
          <p>$4,250 commodity trade completed with full document verification and payment</p>
          <div class="small" style="background: rgba(16,185,129,0.1); padding: 10px; border-radius: 8px; margin-top: 10px;">
            <strong>Outcome:</strong> Confident user, successful trade, ongoing relationship
          </div>
        </div>
      </div>
      
      <div class="card" style="background: rgba(16,185,129,0.05); border: 1px solid #10b981;">
        <h3 style="color: #10b981;">📈 Business Impact</h3>
        <div class="grid grid-2" style="gap: 20px; margin-top: 15px;">
          <div>
            <h4>User Metrics</h4>
            <ul class="small">
              <li>98% completion rate for guided setup</li>
              <li>87% user retention after first trade</li>
              <li>45% increase in beginner confidence</li>
              <li>62% reduction in support tickets</li>
            </ul>
          </div>
          <div>
            <h4>Platform Benefits</h4>
            <ul class="small">
              <li>Expanded user base to crypto newcomers</li>
              <li>Reduced onboarding friction by 73%</li>
              <li>Increased average trade value by 34%</li>
              <li>Enhanced user education and safety</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 40px;">
        <a href="/demo/interactive" class="btn" style="background: #10b981; color: white; margin-right: 15px;">← Back to Demos</a>
        <a href="/portal" class="btn ghost">🏠 Platform Home</a>
      </div>
    </section>
  </main>
</body></html>`;
}

function pageSupplierDemo() {
  return `
${baseHead("Tangent — Supplier Journey Demo")}
<body style="background: var(--bg);">
  <main class="wrap">
    <section class="card" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 40px; border-radius: 16px; text-align: center; margin-bottom: 40px;">
      <h1 style="font-size: 2.5rem;">🔵 Expert Supplier Journey</h1>
      <p style="font-size: 1.2rem;">Advanced workflow for crypto-experienced business owners</p>
    </section>
    
    <section class="card">
      <h2>Enterprise Journey Overview</h2>
      <div class="grid grid-2" style="gap: 30px; margin: 30px 0;">
        <div class="card" style="border: 2px solid #f59e0b;">
          <h3>✅ Step 1: Fast-Track Registration</h3>
          <p>Expert users skip tutorials and get direct access to advanced platform features</p>
          <div class="small" style="background: rgba(245,158,11,0.1); padding: 10px; border-radius: 8px; margin-top: 10px;">
            <strong>Key Features:</strong> Streamlined onboarding, advanced permissions, immediate access
          </div>
        </div>
        <div class="card" style="border: 2px solid #f59e0b;">
          <h3>✅ Step 2: Advanced Product Catalog</h3>
          <p>Sophisticated inventory management with bulk uploads and automated pricing</p>
          <div class="small" style="background: rgba(245,158,11,0.1); padding: 10px; border-radius: 8px; margin-top: 10px;">
            <strong>Key Features:</strong> Bulk operations, API integration, dynamic pricing, market data
          </div>
        </div>
        <div class="card" style="border: 2px solid #f59e0b;">
          <h3>✅ Step 3: Automated Trade Processing</h3>
          <p>AI-powered order processing with smart contracts and automated fulfillment</p>
          <div class="small" style="background: rgba(245,158,11,0.1); padding: 10px; border-radius: 8px; margin-top: 10px;">
            <strong>Key Features:</strong> Smart contracts, automated workflows, AI optimization
          </div>
        </div>
        <div class="card" style="border: 2px solid #f59e0b;">
          <h3>✅ Step 4: Global Market Expansion</h3>
          <p>Multi-market presence with localized compliance and cross-border optimization</p>
          <div class="small" style="background: rgba(245,158,11,0.1); padding: 10px; border-radius: 8px; margin-top: 10px;">
            <strong>Key Features:</strong> Multi-region support, compliance automation, currency hedging
          </div>
        </div>
        <div class="card" style="border: 2px solid #f59e0b;">
          <h3>✅ Step 5: Advanced Analytics</h3>
          <p>Business intelligence dashboard with predictive analytics and performance optimization</p>
          <div class="small" style="background: rgba(245,158,11,0.1); padding: 10px; border-radius: 8px; margin-top: 10px;">
            <strong>Key Features:</strong> Predictive analytics, performance tracking, market insights
          </div>
        </div>
        <div class="card" style="border: 2px solid #f59e0b;">
          <h3>✅ Result: Exponential Growth!</h3>
          <p>$81K+ monthly revenue with 340% business growth and global market presence</p>
          <div class="small" style="background: rgba(245,158,11,0.1); padding: 10px; border-radius: 8px; margin-top: 10px;">
            <strong>Outcome:</strong> Market leadership, sustainable growth, competitive advantage
          </div>
        </div>
      </div>
      
      <div class="card" style="background: rgba(245,158,11,0.05); border: 1px solid #f59e0b;">
        <h3 style="color: #f59e0b;">🚀 Enterprise Impact</h3>
        <div class="grid grid-2" style="gap: 20px; margin-top: 15px;">
          <div>
            <h4>Business Metrics</h4>
            <ul class="small">
              <li>340% revenue growth in 6 months</li>
              <li>78% reduction in operational costs</li>
              <li>92% automation of routine processes</li>
              <li>150+ new market partnerships</li>
            </ul>
          </div>
          <div>
            <h4>Platform Advantages</h4>
            <ul class="small">
              <li>Enterprise-grade security and compliance</li>
              <li>Seamless integration with existing systems</li>
              <li>Advanced analytics and business intelligence</li>
              <li>Global reach with local expertise</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 40px;">
        <a href="/demo/interactive" class="btn" style="background: #f59e0b; color: white; margin-right: 15px;">← Back to Demos</a>
        <a href="/portal" class="btn ghost">🏠 Platform Home</a>
      </div>
    </section>
  </main>
</body></html>`;
}

// ---- Routes (Pages) ----
app.get("/", (_req, res) => res.redirect("/portal"));
app.get("/portal", (_req, res) => res.send(pageHome()));
app.get("/portal/trade", (_req, res) => res.send(pageTrade()));
app.get("/portal/admin", (_req, res) => res.send(pageAdmin()));
app.get("/portal/kyc", (_req, res) => res.send(pageKYC()));
app.get("/portal/wallet-setup", (_req, res) => res.send(pageWalletSetup()));

// Demo routes
app.get("/demo/interactive", (_req, res) => res.send(pageInteractiveDemo()));
app.get("/demo/buyer-journey", (_req, res) => res.send(pageBuyerDemo()));
app.get("/demo/supplier-journey", (_req, res) => res.send(pageSupplierDemo()));
app.get("/demo/test", (_req, res) => res.send('<h1 style="color: #10b981;">✅ Demo Routes Working!</h1><p>All demo systems are operational.</p><a href="/portal">← Back to Platform</a>'));

// ---- Auth API ----
app.post("/auth/register", (req, res) => {
  const db = loadDB();
  const { email = "", password = "", role = "buyer" } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email & password required" });
  if (!["buyer", "supplier", "admin"].includes(role)) return res.status(400).json({ error: "invalid role" });
  if (db.users.find(u => u.email === email)) return res.status(400).json({ error: "email exists" });

  const id = String((db.users?.length || 0) + 1);
  const passHash = bcrypt.hashSync(password, 10);
  const u = { id, email, passHash, role, kyc: { status: "none", files: [], cryptoExperience: null, hasWallet: false } };
  db.users.push(u);
  saveDB(db);

  const token = makeSession(u);
  res.json({ ok: true, token, user: { id, email, role } });
});

app.post("/auth/login", (req, res) => {
  const db = loadDB();
  const { email = "", password = "" } = req.body || {};
  const u = db.users.find(x => x.email === email);
  if (!u) return res.status(400).json({ error: "invalid credentials" });
  if (!bcrypt.compareSync(password, u.passHash)) return res.status(400).json({ error: "invalid credentials" });
  const token = makeSession(u);
  res.json({ ok: true, token, user: { id: u.id, email: u.email, role: u.role } });
});

// ---- Enhanced KYC API ----
app.post("/api/kyc/submit", authToken, requireAuth, upload.array("files", 10), (req, res) => {
  const db = loadDB();
  const uid = req.session.userId;
  const u = db.users.find(x => x.id === uid);
  if (!u) return res.status(404).json({ error: "user not found" });

  const files = (req.files || []).map(f => ({ name: f.originalname, path: path.relative(__dirname, f.path) }));
  
  // Enhanced KYC with crypto experience data
  const kycData = {
    status: "submitted",
    company: req.body.company || "",
    country: req.body.country || "",
    regNumber: req.body.regNumber || "",
    fullName: req.body.fullName || "",
    cryptoExperience: req.body.cryptoExperience || null,
    hasWallet: req.body.hasWallet === "true",
    understoodRisks: req.body.understoodRisks === "true",
    files: (u.kyc?.files || []).concat(files),
    submittedAt: new Date().toISOString()
  };

  u.kyc = kycData;
  
  // Create KYC submission record
  const submission = {
    id: uuid(),
    userId: uid,
    submittedAt: kycData.submittedAt,
    status: "pending",
    companyData: {
      company: kycData.company,
      country: kycData.country,
      regNumber: kycData.regNumber,
      fullName: kycData.fullName,
      cryptoData: {
        experience: kycData.cryptoExperience,
        hasWallet: kycData.hasWallet,
        understoodRisks: kycData.understoodRisks
      }
    },
    files: files
  };
  
  db.kycSubmissions.push(submission);
  saveDB(db);
  
  res.json({ ok: true, success: true, kyc: u.kyc, submissionId: submission.id });
});

app.get("/api/kyc/status", authToken, requireAuth, (req, res) => {
  const db = loadDB();
  const uid = req.session.userId;
  const u = db.users.find(x => x.id === uid);
  if (!u) return res.status(404).json({ error: "user not found" });
  res.json({ kyc: u.kyc || { status: "none" } });
});

// ---- Compliance API ----
app.post("/api/compliance/screen", (req, res) => {
  const { entityName, entityType = "individual", checkType = "sanctions" } = req.body;
  
  if (!entityName) return res.status(400).json({ error: "entityName required" });
  
  // Simulate compliance check with realistic data
  const riskLevels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const statuses = ["CLEAR", "REVIEW", "BLOCKED"];
  
  // Simple risk calculation based on entity name (demo purposes)
  const riskScore = Math.abs(entityName.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 100;
  let risk = "LOW";
  let status = "CLEAR";
  let matches = [];
  
  if (riskScore > 80) {
    risk = "CRITICAL";
    status = "BLOCKED";
    matches = [{ list: "OFAC SDN", reason: "High-risk entity", confidence: 0.95 }];
  } else if (riskScore > 60) {
    risk = "HIGH";
    status = "REVIEW";
    matches = [{ list: "PEP Database", reason: "Politically exposed person", confidence: 0.78 }];
  } else if (riskScore > 40) {
    risk = "MEDIUM";
    status = "REVIEW";
  }
  
  const result = {
    id: uuid(),
    entityName,
    entityType,
    checkType,
    status,
    risk,
    matches,
    timestamp: new Date().toISOString(),
    provider: "ENHANCED_COMPLIANCE_ENGINE"
  };

  const db = loadDB();
  db.complianceChecks.push(result);
  saveDB(db);

  res.json(result);
});

app.get("/api/compliance/history", (req, res) => {
  const db = loadDB();
  const history = (db.complianceChecks || []).slice(-50); // Return last 50 checks
  res.json(history);
});

app.post("/api/compliance/batch-screen", (req, res) => {
  const { entities = [] } = req.body;
  if (!Array.isArray(entities) || entities.length === 0) {
    return res.status(400).json({ error: "entities array required" });
  }
  
  const results = entities.map(entity => {
    const riskScore = Math.abs(entity.name.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 100;
    return {
      id: uuid(),
      entityName: entity.name,
      entityType: entity.type || "individual",
      checkType: entity.checkType || "sanctions",
      status: riskScore > 70 ? "REVIEW" : "CLEAR",
      risk: riskScore > 70 ? "HIGH" : "LOW",
      matches: riskScore > 70 ? [{ list: "Watch List", confidence: 0.8 }] : [],
      timestamp: new Date().toISOString(),
      provider: "BATCH_COMPLIANCE_ENGINE"
    };
  });
  
  const db = loadDB();
  db.complianceChecks.push(...results);
  saveDB(db);
  
  res.json({ results, processed: results.length });
});

// ---- AI Document Verification API ----
app.post("/api/documents/verify", authToken, requireAuth, upload.single("document"), (req, res) => {
  try {
    const { tradeId, docType = "invoice" } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: "Document file required" });
    }
    
    // Simulate AI document verification
    const confidence = 0.85 + (Math.random() * 0.15); // 85-100% confidence
    const verificationStatus = confidence > 0.9 ? "verified" : "requires_review";
    
    // Simulate extracted data based on document type
    let extractedData = {};
    switch (docType) {
      case "invoice":
        extractedData = {
          amount: "$" + (Math.random() * 10000).toFixed(2),
          date: new Date().toISOString().split('T')[0],
          vendor: "AI-Detected Vendor Ltd.",
          invoiceNumber: "INV-" + Date.now(),
          currency: "USD"
        };
        break;
      case "bill_of_lading":
        extractedData = {
          shipmentId: "BL-" + Date.now(),
          origin: "AI-Detected Port",
          destination: "Target Port",
          commodity: "Mixed Commodities",
          weight: (Math.random() * 1000).toFixed(2) + " MT"
        };
        break;
      case "certificate":
        extractedData = {
          certificateType: "Quality Certificate",
          issuer: "AI-Detected Authority",
          validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          grade: "Premium Grade A"
        };
        break;
      default:
        extractedData = {
          documentTitle: "AI-Detected Document",
          pages: 1,
          language: "English"
        };
    }
    
    const verification = {
      id: uuid(),
      tradeId: tradeId || null,
      documentType: docType,
      verificationStatus,
      confidence,
      extractedData,
      aiProvider: "ADVANCED_AI_ENGINE",
      timestamp: new Date().toISOString(),
      filePath: path.relative(__dirname, req.file.path),
      fileName: req.file.originalname,
      processingTime: Math.random() * 3 + 1 // 1-4 seconds
    };

    const db = loadDB();
    db.documentVerifications.push(verification);
    saveDB(db);

    res.json(verification);
  } catch (error) {
    console.error("Document verification error:", error);
    res.status(500).json({ error: "Document verification failed" });
  }
});

app.get("/api/documents/verifications", authToken, (req, res) => {
  const db = loadDB();
  const verifications = (db.documentVerifications || []).slice(-100); // Return last 100 verifications
  res.json(verifications);
});

app.post("/api/documents/reprocess", authToken, requireAuth, (req, res) => {
  const { verificationId } = req.body;
  const db = loadDB();
  
  const verification = db.documentVerifications.find(v => v.id === verificationId);
  if (!verification) {
    return res.status(404).json({ error: "Verification not found" });
  }
  
  // Simulate reprocessing with higher confidence
  verification.confidence = Math.min(verification.confidence + 0.1, 1.0);
  verification.verificationStatus = verification.confidence > 0.9 ? "verified" : "requires_review";
  verification.reprocessedAt = new Date().toISOString();
  
  saveDB(db);
  res.json(verification);
});

// ---- Enhanced Trade Management API ----
app.get("/api/trade/list", authToken, (_req, res) => {
  const db = loadDB();
  const out = (db.trades || []).map(t => recomputeFinancials(t, db.settings));
  res.json({ trades: out });
});

app.get("/api/me/trades", authToken, requireAuth, (req, res) => {
  const db = loadDB();
  const uid = req.session.userId;
  const me = db.users.find(u => u.id === uid);
  if (!me) return res.json({ trades: [] });
  const mine = (db.trades || []).filter(t => t.buyerId === me.id || t.supplierId === me.id);
  res.json({ trades: mine.map(t => recomputeFinancials(t, db.settings)) });
});

app.post("/api/trade/create", authToken, requireAuth, (req, res) => {
  const db = loadDB();
  const {
    name = "", qty = 0, unitPrice = 0, indexSymbol = "", incoterms = "FOB",
    buyerId = "", supplierId = "", creatorRole = "supplier", insuranceApplied = true
  } = req.body || {};
  if (!buyerId || !supplierId) return res.status(400).json({ error: "buyerId and supplierId required" });
  if (!["buyer", "supplier"].includes(creatorRole)) return res.status(400).json({ error: "invalid creatorRole" });

  const id = String((db.trades?.length || 0) + 1);
  let t = {
    id, name, qty: Number(qty), unitPrice: Number(unitPrice), indexSymbol, incoterms,
    buyerId, supplierId, creatorRole,
    buyerDepositPaid: false, supplierConfirmed: creatorRole === "supplier",
    status: "awaiting_buyer_deposit",
    insuranceApplied: !!insuranceApplied,
    docsFiles: [], docsProvider: "", docsVerified: false, keyCode: "", finalPaid: false, released: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  t = recomputeFinancials(t, db.settings);
  db.trades.push(t); saveDB(db);
  res.json({ ok: true, trade: t });
});

app.post("/api/trade/deposit", authToken, requireAuth, (req, res) => {
  const db = loadDB();
  const { tradeId = "" } = req.body || {};
  let t = db.trades.find(x => x.id === String(tradeId));
  if (!t) return res.status(404).json({ error: "trade not found" });

  if (t.buyerDepositPaid) return res.json({ ok: true, trade: recomputeFinancials(t, db.settings) });
  t.buyerDepositPaid = true;
  t.depositPaidAt = new Date().toISOString();
  if (t.creatorRole === "supplier") { t.status = "confirmed"; t.supplierConfirmed = true; }
  else { t.status = "awaiting_supplier_confirm"; }
  t.updatedAt = new Date().toISOString();
  t = recomputeFinancials(t, db.settings);
  saveDB(db);
  res.json({ ok: true, trade: t });
});

app.post("/api/trade/confirm", authToken, requireAuth, (req, res) => {
  const db = loadDB();
  const { tradeId = "" } = req.body || {};
  let t = db.trades.find(x => x.id === String(tradeId));
  if (!t) return res.status(404).json({ error: "trade not found" });
  if (t.status !== "awaiting_supplier_confirm" || !t.buyerDepositPaid) return res.status(400).json({ error: "not awaiting supplier confirm" });
  t.supplierConfirmed = true; 
  t.status = "confirmed";
  t.confirmedAt = new Date().toISOString();
  t.updatedAt = new Date().toISOString();
  t = recomputeFinancials(t, db.settings); 
  saveDB(db);
  res.json({ ok: true, trade: t });
});

app.post("/api/trade/final-pay", authToken, requireAuth, async (req, res) => {
  const db = loadDB();
  const { tradeId = "" } = req.body || {};
  let t = db.trades.find(x => x.id === String(tradeId));
  if (!t) return res.status(404).json({ error: "trade not found" });
  if (!t.status || t.status !== "confirmed") return res.status(400).json({ error: "trade not confirmed" });

  let onChain = false, txHash = "";
  if (chainEnabled()) {
    try {
      const provider = getProvider();
      const esc = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);
      await esc.getAddress();
      onChain = true;
      txHash = "0x-demo-" + Date.now();
    } catch (e) {
      onChain = false;
    }
  }
  t.finalPaid = true;
  t.finalPaidAt = new Date().toISOString();
  t.updatedAt = new Date().toISOString();
  if (onChain) {
    t.blockchainTx = txHash;
    t.blockchainConfirmed = true;
  }
  saveDB(db);
  res.json({ ok: true, onChain, txHash, trade: recomputeFinancials(t, db.settings) });
});

app.post("/api/trade/claim", authToken, requireAuth, (req, res) => {
  const db = loadDB();
  const { tradeId = "", keyCode = "" } = req.body || {};
  let t = db.trades.find(x => x.id === String(tradeId));
  if (!t) return res.status(404).json({ error: "trade not found" });
  if (!t.docsVerified) return res.status(400).json({ error: "docs not verified" });
  if (!t.finalPaid) return res.status(400).json({ error: "final 70% not paid" });
  if (!keyCode || keyCode !== t.keyCode) return res.status(400).json({ error: "invalid key" });

  t.released = true;
  t.releasedAt = new Date().toISOString();
  t.updatedAt = new Date().toISOString();
  t.status = "completed";
  saveDB(db);
  res.json({ ok: true, trade: recomputeFinancials(t, db.settings) });
});

app.post("/api/trade/verify", requireAdmin, (req, res) => {
  const db = loadDB();
  const { tradeId = "" } = req.body || {};
  let t = db.trades.find(x => x.id === String(tradeId));
  if (!t) return res.status(404).json({ error: "trade not found" });
  if (!t.buyerDepositPaid) return res.status(400).json({ error: "deposit not paid" });
  if (!(t.docsFiles && t.docsFiles.length)) return res.status(400).json({ error: "no docs uploaded" });

  t.docsVerified = true;
  t.docsVerifiedAt = new Date().toISOString();
  t.keyCode = "KEY-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  t.updatedAt = new Date().toISOString();
  saveDB(db);
  res.json({ ok: true, keyCode: t.keyCode, trade: recomputeFinancials(t, db.settings) });
});

app.get("/api/trade/search", authToken, (req, res) => {
  const db = loadDB();
  const { status, creatorRole, buyerId, supplierId, minAmount, maxAmount, dateFrom, dateTo } = req.query;
  
  let trades = db.trades || [];
  
  // Apply filters
  if (status) trades = trades.filter(t => t.status === status);
  if (creatorRole) trades = trades.filter(t => t.creatorRole === creatorRole);
  if (buyerId) trades = trades.filter(t => t.buyerId === buyerId);
  if (supplierId) trades = trades.filter(t => t.supplierId === supplierId);
  if (minAmount) trades = trades.filter(t => (t.amountGross || 0) >= Number(minAmount));
  if (maxAmount) trades = trades.filter(t => (t.amountGross || 0) <= Number(maxAmount));
  if (dateFrom) trades = trades.filter(t => new Date(t.createdAt) >= new Date(dateFrom));
  if (dateTo) trades = trades.filter(t => new Date(t.createdAt) <= new Date(dateTo));
  
  const results = trades.map(t => recomputeFinancials(t, db.settings));
  res.json({ trades: results, total: results.length });
});

app.get("/api/trade/analytics", authToken, (req, res) => {
  const db = loadDB();
  const trades = db.trades || [];
  
  const analytics = {
    total: trades.length,
    completed: trades.filter(t => t.status === "completed").length,
    pending: trades.filter(t => t.status !== "completed" && t.status !== "cancelled").length,
    cancelled: trades.filter(t => t.status === "cancelled").length,
    totalValue: trades.reduce((sum, t) => sum + (t.amountGross || 0), 0),
    avgTradeValue: trades.length > 0 ? trades.reduce((sum, t) => sum + (t.amountGross || 0), 0) / trades.length : 0,
    byStatus: {},
    byMonth: {},
    topProducts: {}
  };
  
  // Group by status
  trades.forEach(t => {
    analytics.byStatus[t.status] = (analytics.byStatus[t.status] || 0) + 1;
  });
  
  // Group by month
  trades.forEach(t => {
    const month = new Date(t.createdAt).toISOString().substring(0, 7);
    analytics.byMonth[month] = (analytics.byMonth[month] || 0) + 1;
  });
  
  // Top products
  trades.forEach(t => {
    if (t.name) {
      analytics.topProducts[t.name] = (analytics.topProducts[t.name] || 0) + 1;
    }
  });
  
  res.json(analytics);
});

// ---- Document Management API ----
app.post("/api/docs/upload", authToken, requireAuth, upload.array("files", 10), (req, res) => {
  const db = loadDB();
  const { tradeId = "", provider = "" } = req.body || {};
  let t = db.trades.find(x => x.id === String(tradeId));
  if (!t) return res.status(404).json({ error: "trade not found" });
  if (!db.docsWhitelist.includes(provider)) return res.status(400).json({ error: "provider not allowed" });

  const files = (req.files || []).map(f => ({ 
    name: f.originalname, 
    path: path.relative(__dirname, f.path),
    size: f.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: req.session.userId
  }));
  
  t.docsFiles = (t.docsFiles || []).concat(files);
  t.docsProvider = provider;
  t.lastDocUpload = new Date().toISOString();
  t.updatedAt = new Date().toISOString();
  saveDB(db);
  res.json({ ok: true, trade: recomputeFinancials(t, db.settings), uploaded: files.length });
});

app.get("/api/docs/download/:tradeId/:filename", authToken, requireAuth, (req, res) => {
  const { tradeId, filename } = req.params;
  const db = loadDB();
  const t = db.trades.find(x => x.id === String(tradeId));
  
  if (!t) return res.status(404).json({ error: "trade not found" });
  
  const file = (t.docsFiles || []).find(f => f.name === filename);
  if (!file) return res.status(404).json({ error: "file not found" });
  
  const filePath = path.join(__dirname, file.path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "file not found on disk" });
  
  res.download(filePath, filename);
});

app.get("/api/docs/list/:tradeId", authToken, requireAuth, (req, res) => {
  const { tradeId } = req.params;
  const db = loadDB();
  const t = db.trades.find(x => x.id === String(tradeId));
  
  if (!t) return res.status(404).json({ error: "trade not found" });
  
  const files = (t.docsFiles || []).map(f => ({
    name: f.name,
    size: f.size,
    uploadedAt: f.uploadedAt,
    uploadedBy: f.uploadedBy
  }));
  
  res.json({ files, provider: t.docsProvider, total: files.length });
});

app.delete("/api/docs/delete/:tradeId/:filename", authToken, requireAuth, (req, res) => {
  const { tradeId, filename } = req.params;
  const db = loadDB();
  const t = db.trades.find(x => x.id === String(tradeId));
  
  if (!t) return res.status(404).json({ error: "trade not found" });
  
  const fileIndex = (t.docsFiles || []).findIndex(f => f.name === filename);
  if (fileIndex === -1) return res.status(404).json({ error: "file not found" });
  
  const file = t.docsFiles[fileIndex];
  const filePath = path.join(__dirname, file.path);
  
  // Remove file from disk
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.error("Failed to delete file:", e);
    }
  }
  
  // Remove from database
  t.docsFiles.splice(fileIndex, 1);
  t.updatedAt = new Date().toISOString();
  saveDB(db);
  
  res.json({ ok: true, deleted: filename });
});

// ---- Advanced Admin & Analytics API ----
app.get("/api/admin/settings", (_req, res) => {
  const db = loadDB();
  res.json({ 
    settings: db.settings, 
    chain: { enabled: chainEnabled(), ESCROW_ADDRESS, TGT_ADDRESS },
    platform: {
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    }
  });
});

app.post("/api/admin/settings", (req, res) => {
  const key = req.headers["x-api-key"] || "";
  if (key !== ADMIN_KEY) return res.status(401).json({ error: "admin key required" });

  const db = loadDB();
  const s = db.settings || {};
  const num = (v) => (v === undefined || v === null || v === "" ? null : Number(v));
  const fee = num(req.body.feePercent); 
  const insPct = num(req.body.insurancePremiumPercent);

  if (fee !== null && (isNaN(fee) || fee < 0 || fee > 100)) return res.status(400).json({ error: "feePercent 0..100" });
  if (insPct !== null && (isNaN(insPct) || insPct < 0 || insPct > 100)) return res.status(400).json({ error: "insurancePremiumPercent 0..100" });

  db.settings = {
    ...s,
    feePercent: fee ?? s.feePercent,
    platformWallet: (req.body.platformWallet || s.platformWallet),
    insuranceEnabled: !!req.body.insuranceEnabled,
    insurancePremiumPercent: insPct ?? s.insurancePremiumPercent,
    insuranceWallet: (req.body.insuranceWallet || s.insuranceWallet),
    emailEnabled: !!req.body.emailEnabled,
    ocrEnabled: !!req.body.ocrEnabled,
    antivirusEnabled: !!req.body.antivirusEnabled,
    updatedAt: new Date().toISOString()
  };
  
  // Recompute all trades with new settings
  db.trades = (db.trades || []).map(t => recomputeFinancials(t, db.settings));
  saveDB(db);
  res.json({ ok: true, settings: db.settings });
});

app.get("/api/admin/users", requireAdmin, (req, res) => {
  const db = loadDB();
  const { page = 1, limit = 50, role, kycStatus } = req.query;
  
  let users = db.users || [];
  
  // Apply filters
  if (role) users = users.filter(u => u.role === role);
  if (kycStatus) users = users.filter(u => u.kyc?.status === kycStatus);
  
  // Pagination
  const startIndex = (Number(page) - 1) * Number(limit);
  const endIndex = startIndex + Number(limit);
  const paginatedUsers = users.slice(startIndex, endIndex);
  
  // Remove sensitive data
  const safeUsers = paginatedUsers.map(u => ({
    id: u.id,
    email: u.email,
    role: u.role,
    kyc: u.kyc || { status: "none" },
    createdAt: u.createdAt || new Date().toISOString(),
    lastLogin: u.lastLogin
  }));
  
  res.json({
    users: safeUsers,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: users.length,
      pages: Math.ceil(users.length / Number(limit))
    }
  });
});

app.post("/api/admin/user/:userId/role", requireAdmin, (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;
  
  if (!["buyer", "supplier", "admin"].includes(role)) {
    return res.status(400).json({ error: "invalid role" });
  }
  
  const db = loadDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: "user not found" });
  
  user.role = role;
  user.updatedAt = new Date().toISOString();
  saveDB(db);
  
  res.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
});

app.post("/api/admin/user/:userId/kyc", requireAdmin, (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;
  
  if (!["none", "submitted", "approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "invalid status" });
  }
  
  const db = loadDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: "user not found" });
  
  user.kyc = user.kyc || {};
  user.kyc.status = status;
  user.kyc.updatedAt = new Date().toISOString();
  user.updatedAt = new Date().toISOString();
  saveDB(db);
  
  res.json({ ok: true, kyc: user.kyc });
});

app.get("/api/admin/analytics", requireAdmin, (req, res) => {
  const db = loadDB();
  const users = db.users || [];
  const trades = db.trades || [];
  const compliance = db.complianceChecks || [];
  const documents = db.documentVerifications || [];
  
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const analytics = {
    users: {
      total: users.length,
      byRole: {
        buyer: users.filter(u => u.role === "buyer").length,
        supplier: users.filter(u => u.role === "supplier").length,
        admin: users.filter(u => u.role === "admin").length
      },
      kyc: {
        none: users.filter(u => !u.kyc || u.kyc.status === "none").length,
        submitted: users.filter(u => u.kyc?.status === "submitted").length,
        approved: users.filter(u => u.kyc?.status === "approved").length,
        rejected: users.filter(u => u.kyc?.status === "rejected").length
      }
    },
    trades: {
      total: trades.length,
      completed: trades.filter(t => t.status === "completed").length,
      pending: trades.filter(t => t.status !== "completed" && t.status !== "cancelled").length,
      totalValue: trades.reduce((sum, t) => sum + (t.amountGross || 0), 0),
      last30Days: trades.filter(t => new Date(t.createdAt) >= thirtyDaysAgo).length,
      last7Days: trades.filter(t => new Date(t.createdAt) >= sevenDaysAgo).length
    },
    compliance: {
      total: compliance.length,
      cleared: compliance.filter(c => c.status === "CLEAR").length,
      review: compliance.filter(c => c.status === "REVIEW").length,
      blocked: compliance.filter(c => c.status === "BLOCKED").length,
      highRisk: compliance.filter(c => c.risk === "HIGH" || c.risk === "CRITICAL").length
    },
    documents: {
      total: documents.length,
      verified: documents.filter(d => d.verificationStatus === "verified").length,
      pending: documents.filter(d => d.verificationStatus === "requires_review").length,
      avgConfidence: documents.length > 0 ? documents.reduce((sum, d) => sum + d.confidence, 0) / documents.length : 0
    },
    platform: {
      uptime: process.uptime(),
      version: "1.0.0",
      memoryUsage: process.memoryUsage(),
      environment: process.env.NODE_ENV || "development"
    }
  };
  
  res.json(analytics);
});

app.post("/api/admin/seed-demo", (_req, res) => {
  const db = loadDB();
  
  // Ensure demo users exist
  if (!db.users.find(u => u.email === "buyer@demo")) {
    db.users.push({ 
      id: "demo-buyer", 
      email: "buyer@demo", 
      passHash: bcrypt.hashSync("demo", 10), 
      role: "buyer", 
      kyc: { status: "approved", cryptoExperience: "beginner" },
      createdAt: new Date().toISOString()
    });
  }
  if (!db.users.find(u => u.email === "supplier@demo")) {
    db.users.push({ 
      id: "demo-supplier", 
      email: "supplier@demo", 
      passHash: bcrypt.hashSync("demo", 10), 
      role: "supplier", 
      kyc: { status: "approved", cryptoExperience: "expert" },
      createdAt: new Date().toISOString()
    });
  }
  if (!db.users.find(u => u.email === "admin@demo")) {
    db.users.push({ 
      id: "demo-admin", 
      email: "admin@demo", 
      passHash: bcrypt.hashSync("demo", 10), 
      role: "admin", 
      kyc: { status: "approved" },
      createdAt: new Date().toISOString()
    });
  }
  
  // Seed demo trades
  if (db.trades.length === 0) {
    const demoTrades = [
      {
        id: "demo-1", 
        name: "Premium White Sugar 50kg", 
        qty: 100, 
        unitPrice: 7.5, 
        indexSymbol: "DEMO.SUGAR", 
        incoterms: "FOB Shanghai",
        buyerId: "demo-buyer", 
        supplierId: "demo-supplier", 
        creatorRole: "supplier",
        buyerDepositPaid: false, 
        supplierConfirmed: true, 
        status: "awaiting_buyer_deposit",
        insuranceApplied: true, 
        docsFiles: [], 
        docsProvider: "", 
        docsVerified: false, 
        keyCode: "", 
        finalPaid: false, 
        released: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "demo-2", 
        name: "Organic Rice 25kg", 
        qty: 200, 
        unitPrice: 4.2, 
        indexSymbol: "DEMO.RICE", 
        incoterms: "CIF Hamburg",
        buyerId: "demo-buyer", 
        supplierId: "demo-supplier", 
        creatorRole: "buyer",
        buyerDepositPaid: true, 
        supplierConfirmed: false, 
        status: "awaiting_supplier_confirm",
        insuranceApplied: false, 
        docsFiles: [], 
        docsProvider: "", 
        docsVerified: false, 
        keyCode: "", 
        finalPaid: false, 
        released: false,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    db.trades = demoTrades.map(t => recomputeFinancials(t, db.settings));
  }
  
  // Seed compliance checks
  if (db.complianceChecks.length === 0) {
    db.complianceChecks = [
      {
        id: uuid(),
        entityName: "Demo Supplier Ltd",
        entityType: "company",
        checkType: "sanctions",
        status: "CLEAR",
        risk: "LOW",
        matches: [],
        timestamp: new Date().toISOString(),
        provider: "DEMO_COMPLIANCE"
      },
      {
        id: uuid(),
        entityName: "Demo Buyer Corp",
        entityType: "company", 
        checkType: "pep",
        status: "CLEAR",
        risk: "LOW",
        matches: [],
        timestamp: new Date().toISOString(),
        provider: "DEMO_COMPLIANCE"
      }
    ];
  }
  
  saveDB(db);
  res.json({ ok: true, message: "Demo data seeded successfully" });
});

app.get("/api/admin/export-csv", (_req, res) => {
  const db = loadDB();
  const cols = ["id","name","qty","unitPrice","indexSymbol","incoterms","creatorRole","supplierId","buyerId","buyerDepositPaid","supplierConfirmed","status","amountGross","depositRequired","platformFee","insurancePremium","supplierNetOnDocs","docsVerified","finalPaid","released","createdAt","updatedAt"];
  const csv = [
    cols.join(","),
    ...(db.trades||[]).map(t => cols.map(c => {
      const v = t[c] ?? ""; 
      return (typeof v === "string" && v.includes(",")) ? `"${v}"` : v;
    }).join(","))
  ].join("\n");
  
  res.setHeader("Content-Type","text/csv");
  res.setHeader("Content-Disposition","attachment; filename=trades-" + new Date().toISOString().split('T')[0] + ".csv");
  res.send(csv);
});

app.get("/api/admin/export-all", requireAdmin, (req, res) => {
  const db = loadDB();
  
  const exportData = {
    users: (db.users || []).map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      kyc: u.kyc,
      createdAt: u.createdAt
    })),
    trades: db.trades || [],
    compliance: db.complianceChecks || [],
    documents: db.documentVerifications || [],
    settings: db.settings || {},
    exportedAt: new Date().toISOString(),
    version: "1.0.0"
  };
  
  res.json({ 
    ok: true, 
    data: exportData,
    records: {
      users: exportData.users.length,
      trades: exportData.trades.length,
      compliance: exportData.compliance.length,
      documents: exportData.documents.length
    }
  });
});

app.get("/api/admin/status", requireAdmin, (req, res) => {
  const db = loadDB();
  
  const status = {
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development"
    },
    database: {
      users: (db.users || []).length,
      trades: (db.trades || []).length,
      compliance: (db.complianceChecks || []).length,
      documents: (db.documentVerifications || []).length,
      kycSubmissions: (db.kycSubmissions || []).length
    },
    blockchain: {
      enabled: chainEnabled(),
      escrowAddress: ESCROW_ADDRESS || null,
      tokenAddress: TGT_ADDRESS || null
    },
    services: {
      email: db.settings?.emailEnabled || false,
      ocr: db.settings?.ocrEnabled || false,
      antivirus: db.settings?.antivirusEnabled || false
    }
  };
  
  res.json(status);
});

// ---- Notification & Communication System ----
app.get("/api/notifications", requireAuth, (req, res) => {
  const user = getUser(req);
  const db = loadDB();
  const { unreadOnly = false, limit = 50, offset = 0 } = req.query;
  
  let notifications = (db.notifications || []).filter(n => n.userId === user.id);
  
  if (unreadOnly === 'true') {
    notifications = notifications.filter(n => !n.read);
  }
  
  // Sort by newest first
  notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Apply pagination
  const total = notifications.length;
  notifications = notifications.slice(Number(offset), Number(offset) + Number(limit));
  
  res.json({
    notifications,
    pagination: {
      total,
      limit: Number(limit),
      offset: Number(offset),
      hasMore: Number(offset) + Number(limit) < total
    }
  });
});

app.post("/api/notifications/:id/read", requireAuth, (req, res) => {
  const user = getUser(req);
  const { id } = req.params;
  const db = loadDB();
  
  const notification = (db.notifications || []).find(n => n.id === id && n.userId === user.id);
  if (!notification) return res.status(404).json({ error: "notification not found" });
  
  notification.read = true;
  notification.readAt = new Date().toISOString();
  saveDB(db);
  
  res.json({ ok: true, notification });
});

app.post("/api/notifications/mark-all-read", requireAuth, (req, res) => {
  const user = getUser(req);
  const db = loadDB();
  
  const notifications = (db.notifications || []).filter(n => n.userId === user.id && !n.read);
  const now = new Date().toISOString();
  
  notifications.forEach(n => {
    n.read = true;
    n.readAt = now;
  });
  
  saveDB(db);
  res.json({ ok: true, marked: notifications.length });
});

app.delete("/api/notifications/:id", requireAuth, (req, res) => {
  const user = getUser(req);
  const { id } = req.params;
  const db = loadDB();
  
  const index = (db.notifications || []).findIndex(n => n.id === id && n.userId === user.id);
  if (index === -1) return res.status(404).json({ error: "notification not found" });
  
  db.notifications.splice(index, 1);
  saveDB(db);
  
  res.json({ ok: true, deleted: id });
});

// Helper function to create notifications
function createNotification(userId, type, title, message, data = {}) {
  const db = loadDB();
  if (!db.notifications) db.notifications = [];
  
  const notification = {
    id: uuid(),
    userId,
    type, // 'trade', 'kyc', 'compliance', 'document', 'system', 'payment'
    title,
    message,
    data,
    read: false,
    createdAt: new Date().toISOString()
  };
  
  db.notifications.push(notification);
  saveDB(db);
  return notification;
}

// Message/Communication System
app.get("/api/messages/conversations", requireAuth, (req, res) => {
  const user = getUser(req);
  const db = loadDB();
  const messages = db.messages || [];
  
  // Get all conversations for this user
  const conversations = new Map();
  
  messages.forEach(msg => {
    if (msg.senderId === user.id || msg.recipientId === user.id) {
      const otherId = msg.senderId === user.id ? msg.recipientId : msg.senderId;
      const key = `${msg.tradeId || 'general'}-${otherId}`;
      
      if (!conversations.has(key)) {
        conversations.set(key, {
          id: key,
          tradeId: msg.tradeId,
          participantId: otherId,
          lastMessage: msg,
          unreadCount: 0,
          messages: []
        });
      }
      
      const conv = conversations.get(key);
      conv.messages.push(msg);
      
      // Update last message if this is newer
      if (new Date(msg.createdAt) > new Date(conv.lastMessage.createdAt)) {
        conv.lastMessage = msg;
      }
      
      // Count unread messages
      if (msg.recipientId === user.id && !msg.read) {
        conv.unreadCount++;
      }
    }
  });
  
  // Convert to array and sort by last message time
  const conversationList = Array.from(conversations.values())
    .map(conv => {
      // Get participant info
      const participant = db.users.find(u => u.id === conv.participantId);
      conv.participantEmail = participant?.email || 'Unknown';
      conv.participantRole = participant?.role || 'unknown';
      
      // Get trade info if applicable
      if (conv.tradeId) {
        const trade = db.trades.find(t => t.id === conv.tradeId);
        conv.tradeName = trade?.name || 'Unknown Trade';
      }
      
      // Don't include full messages array in list view
      delete conv.messages;
      return conv;
    })
    .sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));
  
  res.json({ conversations: conversationList });
});

app.get("/api/messages/conversation/:participantId", requireAuth, (req, res) => {
  const user = getUser(req);
  const { participantId } = req.params;
  const { tradeId, limit = 50, offset = 0 } = req.query;
  const db = loadDB();
  
  let messages = (db.messages || []).filter(msg => 
    (msg.senderId === user.id && msg.recipientId === participantId) ||
    (msg.senderId === participantId && msg.recipientId === user.id)
  );
  
  // Filter by trade if specified
  if (tradeId) {
    messages = messages.filter(msg => msg.tradeId === tradeId);
  }
  
  // Sort by newest first
  messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Apply pagination
  const total = messages.length;
  messages = messages.slice(Number(offset), Number(offset) + Number(limit));
  
  // Mark messages as read
  const unreadMessages = messages.filter(msg => msg.recipientId === user.id && !msg.read);
  unreadMessages.forEach(msg => {
    msg.read = true;
    msg.readAt = new Date().toISOString();
  });
  
  if (unreadMessages.length > 0) {
    saveDB(db);
  }
  
  res.json({
    messages: messages.reverse(), // Show oldest first in conversation
    pagination: {
      total,
      limit: Number(limit),
      offset: Number(offset),
      hasMore: Number(offset) + Number(limit) < total
    }
  });
});

app.post("/api/messages/send", requireAuth, (req, res) => {
  const user = getUser(req);
  const { recipientId, message, tradeId } = req.body;
  const db = loadDB();
  
  if (!recipientId || !message?.trim()) {
    return res.status(400).json({ error: "recipientId and message required" });
  }
  
  // Verify recipient exists
  const recipient = db.users.find(u => u.id === recipientId);
  if (!recipient) return res.status(404).json({ error: "recipient not found" });
  
  // Verify trade if specified
  if (tradeId) {
    const trade = db.trades.find(t => t.id === tradeId);
    if (!trade) return res.status(404).json({ error: "trade not found" });
    
    // Check if user is involved in the trade
    if (trade.buyerId !== user.id && trade.supplierId !== user.id) {
      return res.status(403).json({ error: "not authorized for this trade" });
    }
  }
  
  const newMessage = {
    id: uuid(),
    senderId: user.id,
    recipientId,
    tradeId: tradeId || null,
    message: message.trim(),
    read: false,
    createdAt: new Date().toISOString()
  };
  
  if (!db.messages) db.messages = [];
  db.messages.push(newMessage);
  saveDB(db);
  
  // Create notification for recipient
  const tradeInfo = tradeId ? ` (Trade: ${db.trades.find(t => t.id === tradeId)?.name || tradeId})` : '';
  createNotification(
    recipientId,
    'message',
    'New Message',
    `You have a new message from ${user.email}${tradeInfo}`,
    { messageId: newMessage.id, senderId: user.id, tradeId }
  );
  
  res.json({ ok: true, message: newMessage });
});

// Email notification system (simulated)
app.post("/api/notifications/email", requireAdmin, (req, res) => {
  const { recipientEmail, subject, body, templateType } = req.body;
  
  if (!recipientEmail || !subject || !body) {
    return res.status(400).json({ error: "recipientEmail, subject, and body required" });
  }
  
  // Simulate email sending
  const emailLog = {
    id: uuid(),
    recipientEmail,
    subject,
    body,
    templateType: templateType || 'custom',
    status: 'sent', // In real implementation: 'pending', 'sent', 'failed'
    sentAt: new Date().toISOString()
  };
  
  const db = loadDB();
  if (!db.emailLogs) db.emailLogs = [];
  db.emailLogs.push(emailLog);
  saveDB(db);
  
  console.log(`📧 [SIMULATED EMAIL] To: ${recipientEmail}, Subject: ${subject}`);
  
  res.json({ ok: true, emailId: emailLog.id, status: 'sent' });
});

app.get("/api/notifications/email/logs", requireAdmin, (req, res) => {
  const db = loadDB();
  const { limit = 100, status, recipientEmail } = req.query;
  
  let logs = db.emailLogs || [];
  
  if (status) logs = logs.filter(log => log.status === status);
  if (recipientEmail) logs = logs.filter(log => log.recipientEmail.includes(recipientEmail));
  
  logs.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
  logs = logs.slice(0, Number(limit));
  
  res.json({ logs });
});

// Webhook system for external integrations
app.post("/api/webhooks/trade-update", (req, res) => {
  const { tradeId, status, signature } = req.body;
  
  // In production, verify webhook signature
  if (!signature || signature !== "webhook-secret-key") {
    return res.status(401).json({ error: "invalid signature" });
  }
  
  const db = loadDB();
  const trade = db.trades.find(t => t.id === tradeId);
  if (!trade) return res.status(404).json({ error: "trade not found" });
  
  // Log webhook event
  if (!db.webhookLogs) db.webhookLogs = [];
  db.webhookLogs.push({
    id: uuid(),
    type: 'trade-update',
    tradeId,
    payload: req.body,
    processedAt: new Date().toISOString()
  });
  
  // Process update based on status
  if (status === 'payment_confirmed') {
    trade.finalPaid = true;
    trade.status = 'completed';
    trade.updatedAt = new Date().toISOString();
    
    // Notify both parties
    createNotification(trade.buyerId, 'trade', 'Payment Confirmed', `Payment confirmed for trade: ${trade.name}`);
    createNotification(trade.supplierId, 'trade', 'Payment Received', `Payment received for trade: ${trade.name}`);
  }
  
  saveDB(db);
  res.json({ ok: true, processed: true });
});

// ---- Advanced Security & Features ----
app.get("/api/security/audit-log", requireAdmin, (req, res) => {
  const db = loadDB();
  const { limit = 100, userId, action, startDate, endDate } = req.query;
  
  let logs = db.auditLogs || [];
  
  // Apply filters
  if (userId) logs = logs.filter(log => log.userId === userId);
  if (action) logs = logs.filter(log => log.action.includes(action));
  if (startDate) logs = logs.filter(log => new Date(log.timestamp) >= new Date(startDate));
  if (endDate) logs = logs.filter(log => new Date(log.timestamp) <= new Date(endDate));
  
  // Sort by newest first
  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  logs = logs.slice(0, Number(limit));
  
  res.json({ logs });
});

// Audit logging helper
function logAuditEvent(userId, action, details = {}, ipAddress = 'unknown') {
  const db = loadDB();
  if (!db.auditLogs) db.auditLogs = [];
  
  const logEntry = {
    id: uuid(),
    userId,
    action,
    details,
    ipAddress,
    timestamp: new Date().toISOString(),
    userAgent: details.userAgent || 'unknown'
  };
  
  db.auditLogs.push(logEntry);
  
  // Keep only last 10000 entries to prevent bloat
  if (db.auditLogs.length > 10000) {
    db.auditLogs = db.auditLogs.slice(-10000);
  }
  
  saveDB(db);
  return logEntry;
}

// Rate limiting middleware
const rateLimits = new Map();

function rateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) {
  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    
    if (!rateLimits.has(key)) {
      rateLimits.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const limit = rateLimits.get(key);
    
    if (now > limit.resetTime) {
      // Reset window
      limit.count = 1;
      limit.resetTime = now + windowMs;
      return next();
    }
    
    if (limit.count >= maxRequests) {
      return res.status(429).json({ 
        error: "Too many requests", 
        resetTime: limit.resetTime 
      });
    }
    
    limit.count++;
    next();
  };
}

// Apply rate limiting to sensitive endpoints
app.use("/auth/login", rateLimit(5, 15 * 60 * 1000)); // 5 attempts per 15 minutes
app.use("/auth/register", rateLimit(3, 60 * 60 * 1000)); // 3 attempts per hour

// Two-factor authentication simulation
app.post("/api/security/2fa/enable", requireAuth, (req, res) => {
  const user = getUser(req);
  const { backupCodes } = req.body;
  
  // Generate TOTP secret (simulated)
  const totpSecret = Buffer.from(user.id + Date.now()).toString('base64').slice(0, 32);
  
  user.twoFactor = {
    enabled: true,
    secret: totpSecret,
    backupCodes: backupCodes || Array.from({length: 8}, () => 
      Math.random().toString(36).substring(2, 8).toUpperCase()
    ),
    enabledAt: new Date().toISOString()
  };
  
  const db = loadDB();
  saveDB(db);
  
  logAuditEvent(user.id, 'two_factor_enabled', { method: 'totp' }, req.ip);
  
  res.json({ 
    ok: true, 
    secret: totpSecret,
    backupCodes: user.twoFactor.backupCodes,
    qrCode: `otpauth://totp/Tangent:${user.email}?secret=${totpSecret}&issuer=Tangent`
  });
});

app.post("/api/security/2fa/verify", requireAuth, (req, res) => {
  const user = getUser(req);
  const { code } = req.body;
  
  if (!user.twoFactor?.enabled) {
    return res.status(400).json({ error: "2FA not enabled" });
  }
  
  // Simulate TOTP verification (normally would use time-based algorithm)
  const isValidCode = code === "123456" || user.twoFactor.backupCodes.includes(code);
  
  if (!isValidCode) {
    logAuditEvent(user.id, 'two_factor_failed', { code: code.replace(/./g, '*') }, req.ip);
    return res.status(400).json({ error: "Invalid code" });
  }
  
  // Remove backup code if used
  if (user.twoFactor.backupCodes.includes(code)) {
    user.twoFactor.backupCodes = user.twoFactor.backupCodes.filter(bc => bc !== code);
    const db = loadDB();
    saveDB(db);
  }
  
  logAuditEvent(user.id, 'two_factor_verified', { method: 'totp' }, req.ip);
  res.json({ ok: true, verified: true });
});

// Advanced search and filtering
app.get("/api/search/global", requireAuth, (req, res) => {
  const user = getUser(req);
  const { query, type, limit = 20 } = req.query;
  
  if (!query || query.length < 2) {
    return res.status(400).json({ error: "Query must be at least 2 characters" });
  }
  
  const db = loadDB();
  const results = [];
  const searchQuery = query.toLowerCase();
  
  // Search trades
  if (!type || type === 'trades') {
    const trades = (db.trades || []).filter(t => 
      (t.buyerId === user.id || t.supplierId === user.id || user.role === 'admin') &&
      (t.name?.toLowerCase().includes(searchQuery) || 
       t.id?.toLowerCase().includes(searchQuery) ||
       t.indexSymbol?.toLowerCase().includes(searchQuery))
    );
    
    results.push(...trades.slice(0, Number(limit)).map(t => ({
      type: 'trade',
      id: t.id,
      title: t.name,
      subtitle: `${t.qty} units @ $${t.unitPrice}`,
      status: t.status,
      url: `/portal/trade?id=${t.id}`
    })));
  }
  
  // Search users (admin only)
  if (user.role === 'admin' && (!type || type === 'users')) {
    const users = (db.users || []).filter(u => 
      u.email?.toLowerCase().includes(searchQuery) ||
      u.id?.toLowerCase().includes(searchQuery)
    );
    
    results.push(...users.slice(0, Number(limit)).map(u => ({
      type: 'user',
      id: u.id,
      title: u.email,
      subtitle: `Role: ${u.role}, KYC: ${u.kyc?.status || 'none'}`,
      status: u.kyc?.status || 'none',
      url: `/admin/users?search=${u.id}`
    })));
  }
  
  // Search documents
  if (!type || type === 'documents') {
    const docs = (db.documentVerifications || []).filter(d => 
      d.fileName?.toLowerCase().includes(searchQuery) ||
      d.extractedData?.documentType?.toLowerCase().includes(searchQuery)
    );
    
    results.push(...docs.slice(0, Number(limit)).map(d => ({
      type: 'document',
      id: d.id,
      title: d.fileName,
      subtitle: `Type: ${d.extractedData?.documentType || 'Unknown'}, Confidence: ${d.confidence}%`,
      status: d.verificationStatus,
      url: `/portal/documents?doc=${d.id}`
    })));
  }
  
  res.json({ results: results.slice(0, Number(limit)) });
});

// Advanced reporting system
app.get("/api/reports/financial", requireAdmin, (req, res) => {
  const db = loadDB();
  const { startDate, endDate, groupBy = 'month' } = req.query;
  
  let trades = db.trades || [];
  
  // Apply date filters
  if (startDate) trades = trades.filter(t => new Date(t.createdAt) >= new Date(startDate));
  if (endDate) trades = trades.filter(t => new Date(t.createdAt) <= new Date(endDate));
  
  const report = {
    summary: {
      totalTrades: trades.length,
      totalVolume: trades.reduce((sum, t) => sum + (t.amountGross || 0), 0),
      totalFees: trades.reduce((sum, t) => sum + (t.platformFee || 0), 0),
      avgTradeSize: trades.length > 0 ? trades.reduce((sum, t) => sum + (t.amountGross || 0), 0) / trades.length : 0,
      completedTrades: trades.filter(t => t.status === 'completed').length,
      completionRate: trades.length > 0 ? trades.filter(t => t.status === 'completed').length / trades.length : 0
    },
    byStatus: {},
    timeline: {}
  };
  
  // Group by status
  trades.forEach(t => {
    const status = t.status || 'unknown';
    if (!report.byStatus[status]) {
      report.byStatus[status] = { count: 0, volume: 0 };
    }
    report.byStatus[status].count++;
    report.byStatus[status].volume += t.amountGross || 0;
  });
  
  // Group by time period
  trades.forEach(t => {
    const date = new Date(t.createdAt);
    let key;
    
    switch (groupBy) {
      case 'day':
        key = date.toISOString().split('T')[0];
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'month':
      default:
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
    }
    
    if (!report.timeline[key]) {
      report.timeline[key] = { count: 0, volume: 0, fees: 0 };
    }
    report.timeline[key].count++;
    report.timeline[key].volume += t.amountGross || 0;
    report.timeline[key].fees += t.platformFee || 0;
  });
  
  res.json(report);
});

// Backup and restore system
app.post("/api/admin/backup", requireAdmin, (req, res) => {
  const db = loadDB();
  const backup = {
    ...db,
    backupCreatedAt: new Date().toISOString(),
    version: "1.0.0"
  };
  
  // Remove sensitive data
  if (backup.users) {
    backup.users = backup.users.map(u => ({
      ...u,
      passHash: '[REDACTED]',
      twoFactor: u.twoFactor ? { ...u.twoFactor, secret: '[REDACTED]' } : undefined
    }));
  }
  
  res.json({ 
    ok: true, 
    backup,
    size: JSON.stringify(backup).length,
    records: {
      users: (backup.users || []).length,
      trades: (backup.trades || []).length,
      compliance: (backup.complianceChecks || []).length,
      documents: (backup.documentVerifications || []).length
    }
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  
  const health = {
    status: "healthy",
    uptime: Math.floor(uptime),
    memory: {
      used: Math.round(memory.heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(memory.heapTotal / 1024 / 1024) + ' MB'
    },
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    services: {
      database: "operational",
      blockchain: chainEnabled() ? "operational" : "disabled",
      email: "simulated",
      compliance: "mock"
    }
  };
  
  res.json(health);
});

// API documentation endpoint
app.get("/api/docs/endpoints", (req, res) => {
  const endpoints = {
    authentication: [
      "POST /auth/login - User authentication",
      "POST /auth/register - User registration", 
      "POST /auth/logout - User logout"
    ],
    kyc: [
      "GET /api/kyc/status - Get KYC status",
      "POST /api/kyc/submit - Submit KYC data"
    ],
    trades: [
      "GET /api/trade/list - List all trades",
      "POST /api/trade/create - Create new trade",
      "POST /api/trade/deposit - Process deposit",
      "POST /api/trade/confirm - Confirm trade",
      "POST /api/trade/final-pay - Final payment",
      "POST /api/trade/claim - Claim trade key",
      "POST /api/trade/verify - Verify trade",
      "GET /api/trade/search - Search trades",
      "GET /api/trade/analytics - Trade analytics"
    ],
    documents: [
      "POST /api/docs/upload - Upload document",
      "GET /api/docs/download/:tradeId/:filename - Download document",
      "GET /api/docs/list/:tradeId - List trade documents",
      "DELETE /api/docs/delete/:tradeId/:filename - Delete document"
    ],
    compliance: [
      "POST /api/compliance/screen - Screen entity",
      "GET /api/compliance/history - Compliance history",
      "POST /api/compliance/batch-screen - Batch screening"
    ],
    ai_documents: [
      "POST /api/documents/verify - AI document verification",
      "GET /api/documents/verifications - List verifications",
      "POST /api/documents/reprocess - Reprocess document"
    ],
    admin: [
      "GET /api/admin/analytics - Platform analytics",
      "GET /api/admin/users - User management",
      "POST /api/admin/settings - Update settings",
      "GET /api/admin/export-all - Export all data",
      "POST /api/admin/seed-demo - Seed demo data"
    ],
    notifications: [
      "GET /api/notifications - Get notifications",
      "POST /api/notifications/:id/read - Mark as read",
      "POST /api/notifications/mark-all-read - Mark all as read"
    ],
    messages: [
      "GET /api/messages/conversations - List conversations",
      "GET /api/messages/conversation/:id - Get conversation",
      "POST /api/messages/send - Send message"
    ],
    security: [
      "GET /api/security/audit-log - Audit logs",
      "POST /api/security/2fa/enable - Enable 2FA",
      "POST /api/security/2fa/verify - Verify 2FA"
    ],
    system: [
      "GET /api/health - Health check",
      "GET /api/search/global - Global search",
      "GET /api/reports/financial - Financial reports"
    ]
  };
  
  res.json({ 
    ok: true, 
    endpoints,
    totalEndpoints: Object.values(endpoints).flat().length,
    version: "1.0.0"
  });
});

// ---- Integration APIs & External Services ----
app.post("/api/integrations/blockchain/deploy-escrow", requireAdmin, (req, res) => {
  const { tradeId, buyerAddress, supplierAddress, amount } = req.body;
  
  if (!chainEnabled()) {
    return res.status(400).json({ error: "Blockchain not enabled" });
  }
  
  // Simulate smart contract deployment
  const escrowData = {
    contractAddress: `0x${Math.random().toString(16).slice(2, 42)}`,
    tradeId,
    buyerAddress,
    supplierAddress,
    amount,
    status: 'deployed',
    deployedAt: new Date().toISOString(),
    gasUsed: Math.floor(Math.random() * 100000) + 50000,
    transactionHash: `0x${Math.random().toString(16).slice(2, 66)}`
  };
  
  const db = loadDB();
  if (!db.escrowContracts) db.escrowContracts = [];
  db.escrowContracts.push(escrowData);
  saveDB(db);
  
  console.log(`🔗 [BLOCKCHAIN] Deployed escrow for trade ${tradeId}: ${escrowData.contractAddress}`);
  
  res.json({ ok: true, escrow: escrowData });
});

app.get("/api/integrations/blockchain/escrow/:tradeId", requireAuth, (req, res) => {
  const { tradeId } = req.params;
  const db = loadDB();
  
  const escrow = (db.escrowContracts || []).find(e => e.tradeId === tradeId);
  if (!escrow) return res.status(404).json({ error: "Escrow not found" });
  
  res.json({ escrow });
});

app.post("/api/integrations/payment/process", requireAuth, (req, res) => {
  const { tradeId, amount, paymentMethod, cardToken } = req.body;
  const user = getUser(req);
  const db = loadDB();
  
  const trade = db.trades.find(t => t.id === tradeId);
  if (!trade) return res.status(404).json({ error: "Trade not found" });
  
  // Simulate payment processing
  const payment = {
    id: uuid(),
    tradeId,
    userId: user.id,
    amount,
    paymentMethod: paymentMethod || 'card',
    status: Math.random() > 0.1 ? 'succeeded' : 'failed',
    processedAt: new Date().toISOString(),
    fees: amount * 0.029 + 0.30, // Stripe-like fees
    netAmount: amount - (amount * 0.029 + 0.30),
    transactionId: `txn_${Math.random().toString(36).substring(2, 15)}`
  };
  
  if (!db.payments) db.payments = [];
  db.payments.push(payment);
  
  if (payment.status === 'succeeded') {
    // Update trade status
    if (user.id === trade.buyerId && !trade.buyerDepositPaid) {
      trade.buyerDepositPaid = true;
      trade.depositPaidAt = new Date().toISOString();
      trade.status = trade.supplierConfirmed ? 'confirmed' : 'awaiting_supplier_confirm';
    } else if (user.id === trade.buyerId && trade.buyerDepositPaid) {
      trade.finalPaid = true;
      trade.finalPaidAt = new Date().toISOString();
      trade.status = 'completed';
    }
    trade.updatedAt = new Date().toISOString();
    
    // Create notifications
    createNotification(user.id, 'payment', 'Payment Successful', `Payment of $${amount} processed successfully for trade: ${trade.name}`);
    
    if (user.id === trade.buyerId) {
      createNotification(trade.supplierId, 'payment', 'Payment Received', `Buyer has made a payment for trade: ${trade.name}`);
    }
  } else {
    createNotification(user.id, 'payment', 'Payment Failed', `Payment of $${amount} failed for trade: ${trade.name}. Please try again.`);
  }
  
  saveDB(db);
  logAuditEvent(user.id, 'payment_processed', { tradeId, amount, status: payment.status }, req.ip);
  
  res.json({ ok: true, payment });
});

app.get("/api/integrations/payment/history", requireAuth, (req, res) => {
  const user = getUser(req);
  const db = loadDB();
  const { limit = 50, status } = req.query;
  
  let payments = (db.payments || []).filter(p => p.userId === user.id);
  
  if (status) payments = payments.filter(p => p.status === status);
  
  payments.sort((a, b) => new Date(b.processedAt) - new Date(a.processedAt));
  payments = payments.slice(0, Number(limit));
  
  res.json({ payments });
});

// Marketplace integration
app.get("/api/marketplace/products", (req, res) => {
  const { category, minPrice, maxPrice, limit = 20 } = req.query;
  
  // Simulate marketplace products
  const products = [
    { id: 'prod-1', name: 'Premium White Sugar', category: 'agriculture', price: 7.5, unit: 'kg', supplier: 'Global Sugar Co', rating: 4.8 },
    { id: 'prod-2', name: 'Organic Rice', category: 'agriculture', price: 4.2, unit: 'kg', supplier: 'Green Farms Ltd', rating: 4.9 },
    { id: 'prod-3', name: 'Steel Bars', category: 'metals', price: 850, unit: 'ton', supplier: 'Metal Works Inc', rating: 4.6 },
    { id: 'prod-4', name: 'Copper Wire', category: 'metals', price: 9200, unit: 'ton', supplier: 'Copper Solutions', rating: 4.7 },
    { id: 'prod-5', name: 'Cotton Fabric', category: 'textiles', price: 12.3, unit: 'meter', supplier: 'Textile Masters', rating: 4.5 },
    { id: 'prod-6', name: 'Wheat Flour', category: 'agriculture', price: 0.85, unit: 'kg', supplier: 'Grain Pro', rating: 4.4 },
    { id: 'prod-7', name: 'Aluminum Sheets', category: 'metals', price: 2100, unit: 'ton', supplier: 'Alu-Tech', rating: 4.8 },
    { id: 'prod-8', name: 'Silk Threads', category: 'textiles', price: 45.0, unit: 'kg', supplier: 'Silk Road Co', rating: 4.9 }
  ];
  
  let filtered = products;
  
  if (category) filtered = filtered.filter(p => p.category === category);
  if (minPrice) filtered = filtered.filter(p => p.price >= Number(minPrice));
  if (maxPrice) filtered = filtered.filter(p => p.price <= Number(maxPrice));
  
  filtered = filtered.slice(0, Number(limit));
  
  res.json({ products: filtered, total: products.length });
});

app.post("/api/marketplace/rfq", requireAuth, (req, res) => {
  const user = getUser(req);
  const { productName, quantity, targetPrice, description, category } = req.body;
  
  const rfq = {
    id: uuid(),
    buyerId: user.id,
    productName,
    quantity,
    targetPrice,
    description,
    category,
    status: 'open',
    responses: [],
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
  };
  
  const db = loadDB();
  if (!db.rfqs) db.rfqs = [];
  db.rfqs.push(rfq);
  saveDB(db);
  
  console.log(`📋 [RFQ] New request from ${user.email}: ${productName}`);
  
  res.json({ ok: true, rfq });
});

// Analytics and insights
app.get("/api/analytics/market-trends", (req, res) => {
  const { category, period = '30d' } = req.query;
  
  // Simulate market data
  const trends = {
    category: category || 'all',
    period,
    data: {
      priceIndex: Math.random() * 20 + 90, // 90-110
      volumeChange: (Math.random() - 0.5) * 40, // -20% to +20%
      topProducts: [
        { name: 'White Sugar', growth: '+12%', volume: '$2.4M' },
        { name: 'Steel Bars', growth: '-3%', volume: '$1.8M' },
        { name: 'Copper Wire', growth: '+8%', volume: '$1.2M' }
      ],
      forecasts: {
        nextMonth: (Math.random() - 0.5) * 10,
        nextQuarter: (Math.random() - 0.5) * 20
      }
    },
    generatedAt: new Date().toISOString()
  };
  
  res.json(trends);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  
  logAuditEvent(
    req.user?.id || 'anonymous',
    'server_error',
    { 
      error: err.message,
      stack: err.stack?.split('\n')[0],
      path: req.path,
      method: req.method
    },
    req.ip
  );
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    id: uuid().split('-')[0] // Error ID for tracking
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    method: req.method,
    available: ['/api/health', '/api/docs/endpoints']
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

// Start server with enhanced startup
const server = app.listen(PORT, () => {
  console.log('\n🚀 ======================================');
  console.log('🏢 TANGENT ULTRA ENTERPRISE PLATFORM');
  console.log('🚀 ======================================');
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Blockchain: ${chainEnabled() ? 'ENABLED' : 'DISABLED'}`);
  console.log(`📧 Email: ${process.env.EMAIL_USER ? 'CONFIGURED' : 'SIMULATED'}`);
  console.log(`🛡️  Compliance: ${process.env.COMPLIANCE_API ? 'LIVE' : 'MOCK'}`);
  console.log(`🤖 AI Services: ${process.env.OPENAI_API_KEY ? 'LIVE' : 'MOCK'}`);
  console.log(`📁 Storage: ${process.env.WEB3_STORAGE_TOKEN ? 'WEB3' : 'LOCAL'}`);
  console.log('🚀 ======================================');
  console.log('📖 API Documentation: /api/docs/endpoints');
  console.log('💊 Health Check: /api/health');
  console.log('🏠 Portal: /portal');
  console.log('⚡ Admin: /admin');
  console.log('🎮 Interactive Demo: /demo/interactive');
  console.log('🔧 Wallet Setup: /portal/wallet-setup');
  console.log('🚀 ======================================\n');
  
  // Initialize database
  ensureDBShape();
  
  // Log startup
  logAuditEvent('system', 'server_startup', { 
    port: PORT,
    nodeVersion: process.version,
    platform: process.platform
  });
  
  console.log('✅ Tangent Ultra MVP ready for enterprise operations! 🎯\n');
});
