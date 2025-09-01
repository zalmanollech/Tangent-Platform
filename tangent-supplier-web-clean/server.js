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
const FAUCET_PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY || "";

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

function ensureDBShape(db) {
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
    auctions: Array.isArray(db.auctions) ? db.auctions : []
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
// Minimal TGT ABI for faucet
const TGT_ABI = [
  "function mint(address to, uint256 amount) external",
  "function decimals() view returns (uint8)"
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

 // ---- Wallet helpers (demo) ----
 let WALLET_ADDR = '';
 async function connectWallet(){
   try{
     if(!window.ethereum){ alert('MetaMask not found'); return; }
     const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
     WALLET_ADDR = (accs && accs[0])||'';
     const el = document.getElementById('walletShow');
     if(el) el.textContent = WALLET_ADDR ? (WALLET_ADDR.slice(0,6)+'…'+WALLET_ADDR.slice(-4)) : 'Not connected';
   }catch(e){ alert('Wallet connect failed'); }
 }
 async function faucet(amount=100){
   try{
     if(!WALLET_ADDR){ await connectWallet(); if(!WALLET_ADDR) return; }
     const r = await fetch('/api/faucet',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ to: WALLET_ADDR, amountTokens: amount }) });
     const j = await r.json();
     if(!r.ok){ alert(j.error||'Faucet failed'); return; }
     alert('Minted '+amount+' TGT. Tx: '+(j.txHash||'-'));
   }catch(e){ alert('Faucet error'); }
 }
</script>
</head>`;
}
function nav(active=""){
  const tabs=[["Home","/portal"],["Trade Desk","/portal/trade"],["KYC","/portal/kyc"],["Admin","/portal/admin"]];
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

// ---- Pages ----
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
        <div class="card">
          <h3>Wallet</h3>
          <div class="row">
            <button class="btn" onclick="connectWallet()">Connect MetaMask</button>
            <span id="walletShow" class="badge">Not connected</span>
          </div>
          <div class="row mt">
            <button class="btn ghost" onclick="faucet(100)">Get 100 TGT (Sepolia)</button>
          </div>
          <p class="small muted">Requires on-chain mode. Uses server faucet if available.</p>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>My Trades (quick view)</h2>
      <div id="myTrades" class="small muted">Sign in to view…</div>
      <div class="row mt"><a class="btn ghost" href="/portal/trade">Go to Trade Desk</a></div>
    </section>

    <div class="footer small">© Tangent — MVP</div>
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
${baseHead("Tangent — KYC")}
<body>
  ${nav("KYC")}
  <main class="wrap">
    <section class="card">
      <h2>KYC Submission</h2>
      <p class="small">Upload your company docs. (Demo stores files locally only.)</p>
      <form id="kycForm">
        <div class="row">
          <input class="in" name="company" placeholder="Company legal name">
          <input class="in" name="country" placeholder="Country">
        </div>
        <label class="lbl">Documents (PDF/IMG)</label>
        <input class="in" name="files" type="file" multiple>
        <div class="row mt"><button class="btn" type="submit">Submit KYC</button></div>
      </form>
    </section>
  </main>
  <script>
    const f = document.getElementById('kycForm');
    f.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(f);
      try{
        const r = await fetch('/api/kyc/submit',{method:'POST',headers:{'x-auth-token':getToken()}, body:fd});
        const j = await r.json();
        alert(j.ok ? 'KYC submitted' : (j.error||'Failed'));
      }catch(err){ alert('Failed'); }
    });
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
      <h3>Seed Demo</h3>
      <div class="row">
        <button class="btn ghost" onclick="seedDemo()">Seed Full Demo</button>
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
    loadSettings(); loadVerify();
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
  </main>

  <script>
    function role(){ try{return localStorage.getItem('role')||'buyer'}catch(e){return 'buyer'} }
    function $fmt(n){ return (n==null || isNaN(n))?'-':Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
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

    loadTrades();
  </script>
</body></html>`;
}

// ---- Routes (pages) ----
app.get("/", (_req, res) => res.redirect("/portal"));
app.get("/portal", (_req, res) => res.send(pageHome()));
app.get("/portal/trade", (_req, res) => res.send(pageTrade()));
app.get("/portal/admin", (_req, res) => res.send(pageAdmin()));
app.get("/portal/kyc", (_req, res) => res.send(pageKYC()));

// ---- Auth ----
app.post("/auth/register", (req, res) => {
  const db = loadDB();
  const { email = "", password = "", role = "buyer" } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email & password required" });
  if (!["buyer", "supplier", "admin"].includes(role)) return res.status(400).json({ error: "invalid role" });
  if (db.users.find(u => u.email === email)) return res.status(400).json({ error: "email exists" });

  const id = String((db.users?.length || 0) + 1);
  const passHash = bcrypt.hashSync(password, 10);
  const u = { id, email, passHash, role, kyc: { status: "none", files: [] } };
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

// ---- KYC ----
app.post("/api/kyc/submit", authToken, requireAuth, upload.array("files", 10), (req, res) => {
  const db = loadDB();
  const uid = req.session.userId;
  const u = db.users.find(x => x.id === uid);
  if (!u) return res.status(404).json({ error: "user not found" });

  const files = (req.files || []).map(f => ({ name: f.originalname, path: path.relative(__dirname, f.path) }));
  u.kyc = {
    status: "submitted",
    company: req.body.company || "",
    country: req.body.country || "",
    files: (u.kyc?.files || []).concat(files)
  };
  saveDB(db);
  res.json({ ok: true, kyc: u.kyc });
});

// ---- Trades Unified ----
app.get("/api/trade/list", authToken, (_req, res) => {
  const db = loadDB();
  const out = (db.trades || []).map(t => recomputeFinancials(t, db.settings));
  res.json({ trades: out });
});

app.get("/api/me/trades", authToken, requireAuth, (_req, res) => {
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
    createdAt: new Date().toISOString()
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
  if (t.creatorRole === "supplier") { t.status = "confirmed"; t.supplierConfirmed = true; }
  else { t.status = "awaiting_supplier_confirm"; }
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
  t.supplierConfirmed = true; t.status = "confirmed";
  t = recomputeFinancials(t, db.settings); saveDB(db);
  res.json({ ok: true, trade: t });
});

// Docs upload (supplier)
app.post("/api/docs/upload", authToken, requireAuth, upload.array("files", 10), (req, res) => {
  const db = loadDB();
  const { tradeId = "", provider = "" } = req.body || {};
  let t = db.trades.find(x => x.id === String(tradeId));
  if (!t) return res.status(404).json({ error: "trade not found" });
  if (!db.docsWhitelist.includes(provider)) return res.status(400).json({ error: "provider not allowed" });

  const files = (req.files || []).map(f => ({ name: f.originalname, path: path.relative(__dirname, f.path) }));
  t.docsFiles = (t.docsFiles || []).concat(files);
  t.docsProvider = provider;
  saveDB(db);
  res.json({ ok: true, trade: recomputeFinancials(t, db.settings) });
});

// Admin verify -> issue key to buyer
app.post("/api/trade/verify", requireAdmin, (req, res) => {
  const db = loadDB();
  const { tradeId = "" } = req.body || {};
  let t = db.trades.find(x => x.id === String(tradeId));
  if (!t) return res.status(404).json({ error: "trade not found" });
  if (!t.buyerDepositPaid) return res.status(400).json({ error: "deposit not paid" });
  if (!(t.docsFiles && t.docsFiles.length)) return res.status(400).json({ error: "no docs uploaded" });

  t.docsVerified = true;
  t.keyCode = "KEY-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  saveDB(db);
  res.json({ ok: true, keyCode: t.keyCode, trade: recomputeFinancials(t, db.settings) });
});

// Buyer final 70% (on-chain if configured, else simulated)
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
      // NOTE: For real tx, you'd use a signer/private key or a wallet prompt in the browser. Here we only simulate call presence.
      const esc = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);
      // This call would fail without a signer; we just check ABI wiring exists.
      await esc.getAddress(); // sanity
      onChain = true;
      txHash = "0x-demo"; // placeholder
    } catch (e) {
      onChain = false;
    }
  }
  t.finalPaid = true;
  saveDB(db);
  res.json({ ok: true, onChain, txHash, trade: recomputeFinancials(t, db.settings) });
});

// Buyer claims with key -> release docs
app.post("/api/trade/claim", authToken, requireAuth, (req, res) => {
  const db = loadDB();
  const { tradeId = "", keyCode = "" } = req.body || {};
  let t = db.trades.find(x => x.id === String(tradeId));
  if (!t) return res.status(404).json({ error: "trade not found" });
  if (!t.docsVerified) return res.status(400).json({ error: "docs not verified" });
  if (!t.finalPaid) return res.status(400).json({ error: "final 70% not paid" });
  if (!keyCode || keyCode !== t.keyCode) return res.status(400).json({ error: "invalid key" });

  t.released = true;
  saveDB(db);
  res.json({ ok: true, trade: recomputeFinancials(t, db.settings) });
});

// ---- Admin settings & CSV ----
app.get("/api/admin/settings", (_req, res) => {
  const db = loadDB();
  res.json({ settings: db.settings, chain: { enabled: chainEnabled(), ESCROW_ADDRESS, TGT_ADDRESS } });
});
app.post("/api/admin/settings", (req, res) => {
  const key = req.headers["x-api-key"] || "";
  if (key !== ADMIN_KEY) return res.status(401).json({ error: "admin key required" });

  const db = loadDB();
  const s = db.settings || {};
  const num = (v) => (v === undefined || v === null || v === "" ? null : Number(v));
  const fee = num(req.body.feePercent); const insPct = num(req.body.insurancePremiumPercent);

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
    antivirusEnabled: !!req.body.antivirusEnabled
  };
  // recompute
  db.trades = (db.trades || []).map(t => recomputeFinancials(t, db.settings));
  saveDB(db);
  res.json({ ok: true, settings: db.settings });
});

app.post("/api/admin/seed-demo", (_req, res) => {
  const db = loadDB();
  if (!db.users.length) {
    const buyer = { id: "1", email: "buyer@demo", passHash: bcrypt.hashSync("demo", 10), role: "buyer", kyc: { status: "none", files: [] } };
    const supplier = { id: "2", email: "supplier@demo", passHash: bcrypt.hashSync("demo", 10), role: "supplier", kyc: { status: "none", files: [] } };
    const admin = { id: "3", email: "admin@demo", passHash: bcrypt.hashSync("demo", 10), role: "admin", kyc: { status: "none", files: [] } };
    db.users.push(buyer, supplier, admin);
  }
  if (!db.trades.length) {
    db.trades.push(
      recomputeFinancials({
        id: "1", name: "White Sugar 50kg", qty: 100, unitPrice: 7.5, indexSymbol: "DEMO.SUGAR", incoterms: "FOB Shanghai",
        buyerId: "1", supplierId: "2", creatorRole: "supplier",
        buyerDepositPaid: false, supplierConfirmed: true, status: "awaiting_buyer_deposit",
        insuranceApplied: true, docsFiles: [], docsProvider: "", docsVerified: false, keyCode: "", finalPaid: false, released: false,
        createdAt: new Date().toISOString()
      }, db.settings)
    );
  }
  saveDB(db);
  res.json({ ok: true });
});

app.get("/api/admin/export-csv", (_req, res) => {
  const db = loadDB();
  const cols = ["id","name","qty","unitPrice","indexSymbol","incoterms","creatorRole","supplierId","buyerId","buyerDepositPaid","supplierConfirmed","status","amountGross","depositRequired","platformFee","insurancePremium","supplierNetOnDocs","docsVerified","finalPaid","released","createdAt"];
  const csv = [
    cols.join(","),
    ...(db.trades||[]).map(t => cols.map(c => {
      const v = t[c] ?? ""; return (typeof v === "string" && v.includes(",")) ? `"${v}"` : v;
    }).join(","))
  ].join("\n");
  res.setHeader("Content-Type","text/csv");
  res.setHeader("Content-Disposition","attachment; filename=trades.csv");
  res.send(csv);
});

// ---- Auto-Demo ----
app.post("/api/demo/run", async (_req, res) => {
  const db = loadDB();
  // ensure demo users
  if (!db.users.find(u=>u.email==="buyer@demo")) {
    db.users.push({ id: "1", email: "buyer@demo", passHash: bcrypt.hashSync("demo", 10), role: "buyer", kyc: { status: "none", files: [] } });
  }
  if (!db.users.find(u=>u.email==="supplier@demo")) {
    db.users.push({ id: "2", email: "supplier@demo", passHash: bcrypt.hashSync("demo", 10), role: "supplier", kyc: { status: "none", files: [] } });
  }
  // seed one trade
  const id = String((db.trades?.length || 0) + 1);
  let t = {
    id, name: "AutoDemo Rice 25%", qty: 120, unitPrice: 4.20, indexSymbol: "DEMO.RICE", incoterms: "CIF Hamburg",
    buyerId: "1", supplierId: "2", creatorRole: "buyer",
    buyerDepositPaid: true, supplierConfirmed: false, status: "awaiting_supplier_confirm",
    insuranceApplied: true, docsFiles: [], docsProvider: "", docsVerified: false, keyCode: "", finalPaid: false, released: false,
    createdAt: new Date().toISOString()
  };
  t = recomputeFinancials(t, db.settings);
  db.trades.push(t); saveDB(db);
  res.json({ ok: true, tradeId: id });
});

// ---- Start ----
app.listen(PORT, () => console.log(`✅ Tangent Ultra MVP listening on http://localhost:${PORT}`));
