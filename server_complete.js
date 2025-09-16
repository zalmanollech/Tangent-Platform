// server.js — Tangent Ultra MVP - Complete Platform
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { v4: uuid } = require("uuid");

const app = express();
const PORT = process.env.PORT || 4000;

// ---- CORS and Body Parsing ----
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true,
  credentials: true
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ---- File Upload Setup ----
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, Date.now() + "-" + file.originalname.replace(/[^\w. -]/g, "_"))
});
const upload = multer({ storage });

// ---- Database ----
const DB_PATH = path.join(__dirname, "data.json");

function ensureDBShape(db) {
  return {
    platformToken: db.platformToken || { symbol: "TGT", name: "Tangent Token", decimals: 2, peg: "USD" },
    priceFeed: db.priceFeed || { "DEMO.SUGAR": 650, "DEMO.RICE": 520, "DEMO.WHEAT": 580 },
    settings: db.settings || {
      feePercent: 0.75,
      platformWallet: "PLATFORM_WALLET_NOT_SET",
      insuranceEnabled: false,
      insurancePremiumPercent: 1.25,
      defaultDays: 14,
      incotermOptions: ["FOB", "CIF", "CFR", "EXW", "DAP", "DDP"]
    },
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
  if (!fs.existsSync(DB_PATH)) {
    const defaultDB = ensureDBShape({});
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultDB, null, 2));
    return defaultDB;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return ensureDBShape(parsed);
  } catch (e) {
    console.error("DB parse error:", e);
    return ensureDBShape({});
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// ---- Sessions ----
const SESSIONS = new Map();

function makeSession(u) {
  const token = uuid();
  SESSIONS.set(token, { user: u, created: Date.now() });
  return token;
}

function getUser(token) {
  const sess = SESSIONS.get(token);
  if (!sess) return null;
  return sess.user;
}

// ---- Base HTML Head with Complete Styling ----
function baseHead(title) {
  return "<!DOCTYPE html>" +
"<html lang=\"en\">" +
"<head>" +
"  <meta charset=\"UTF-8\">" +
"  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">" +
"  <title>" + title + "</title>" +
"  <style>" +
"    /* CSS Reset and Base Styles */" +
"    * { margin: 0; padding: 0; box-sizing: border-box; }" +
"    " +
"    body {" +
"      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;" +
"      line-height: 1.6;" +
"      color: #333;" +
"      background: #f8fafc;" +
"    }" +
"    " +
"    .wrap {" +
"      max-width: 1200px;" +
"      margin: 0 auto;" +
"      padding: 0 20px;" +
"    }" +
"    " +
"    /* Navigation */" +
"    .topbar {" +
"      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);" +
"      color: white;" +
"      padding: 1rem 0;" +
"      box-shadow: 0 2px 10px rgba(0,0,0,0.1);" +
"    }" +
"    " +
"    .topbar .wrap {" +
"      display: flex;" +
"      justify-content: space-between;" +
"      align-items: center;" +
"    }" +
"    " +
"    .logo {" +
"      font-size: 1.5rem;" +
"      font-weight: bold;" +
"      display: flex;" +
"      align-items: center;" +
"      gap: 0.5rem;" +
"    }" +
"    " +
"    .nav-links {" +
"      display: flex;" +
"      gap: 2rem;" +
"    }" +
"    " +
"    .nav-links a {" +
"      color: white;" +
"      text-decoration: none;" +
"      padding: 0.5rem 1rem;" +
"      border-radius: 5px;" +
"      transition: background-color 0.3s;" +
"    }" +
"    " +
"    .nav-links a:hover, .nav-links a.active {" +
"      background-color: rgba(255, 255, 255, 0.2);" +
"    }" +
"    " +
"    /* Main Content */" +
"    main {" +
"      padding: 2rem 0;" +
"      min-height: calc(100vh - 80px);" +
"    }" +
"    " +
"    .hero {" +
"      display: grid;" +
"      grid-template-columns: 2fr 1fr;" +
"      gap: 3rem;" +
"      align-items: center;" +
"      margin-bottom: 3rem;" +
"    }" +
"    " +
"    .hero h1 {" +
"      font-size: 2.5rem;" +
"      font-weight: bold;" +
"      margin-bottom: 1rem;" +
"      color: #1a202c;" +
"    }" +
"    " +
"    .hero h2 {" +
"      font-size: 1.5rem;" +
"      color: #4a5568;" +
"      margin-bottom: 1rem;" +
"    }" +
"    " +
"    .hero p {" +
"      color: #6b7280;" +
"      font-size: 1.1rem;" +
"      line-height: 1.6;" +
"    }" +
"    " +
"    /* Cards */" +
"    .card {" +
"      background: white;" +
"      border-radius: 12px;" +
"      padding: 2rem;" +
"      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);" +
"      border: 1px solid #e5e7eb;" +
"      margin-bottom: 1.5rem;" +
"    }" +
"    " +
"    .card h3 {" +
"      margin-bottom: 1rem;" +
"      color: #1f2937;" +
"    }" +
"    " +
"    /* Buttons */" +
"    .btn {" +
"      display: inline-block;" +
"      padding: 12px 24px;" +
"      border: none;" +
"      border-radius: 8px;" +
"      font-size: 16px;" +
"      font-weight: 600;" +
"      text-decoration: none;" +
"      cursor: pointer;" +
"      transition: all 0.3s ease;" +
"      text-align: center;" +
"    }" +
"    " +
"    .btn.primary {" +
"      background: #3b82f6;" +
"      color: white;" +
"    }" +
"    " +
"    .btn.primary:hover {" +
"      background: #2563eb;" +
"      transform: translateY(-1px);" +
"    }" +
"    " +
"    .btn.ghost {" +
"      background: transparent;" +
"      color: #3b82f6;" +
"      border: 2px solid #3b82f6;" +
"    }" +
"    " +
"    .btn.ghost:hover {" +
"      background: #3b82f6;" +
"      color: white;" +
"    }" +
"    " +
"    .btn.success {" +
"      background: #10b981;" +
"      color: white;" +
"    }" +
"    " +
"    .btn.success:hover {" +
"      background: #059669;" +
"    }" +
"    " +
"    /* Forms */" +
"    .form-group {" +
"      margin-bottom: 1.5rem;" +
"    }" +
"    " +
"    .form-label {" +
"      display: block;" +
"      margin-bottom: 0.5rem;" +
"      font-weight: 600;" +
"      color: #374151;" +
"    }" +
"    " +
"    .form-input, .in {" +
"      width: 100%;" +
"      padding: 12px;" +
"      border: 2px solid #e5e7eb;" +
"      border-radius: 8px;" +
"      font-size: 16px;" +
"      transition: border-color 0.3s;" +
"    }" +
"    " +
"    .form-input:focus, .in:focus {" +
"      outline: none;" +
"      border-color: #3b82f6;" +
"    }" +
"    " +
"    /* Features Grid */" +
"    .features {" +
"      display: grid;" +
"      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));" +
"      gap: 1.5rem;" +
"      margin: 2rem 0;" +
"    }" +
"    " +
"    .feature {" +
"      background: white;" +
"      padding: 1.5rem;" +
"      border-radius: 12px;" +
"      border: 1px solid #e5e7eb;" +
"      text-align: center;" +
"    }" +
"    " +
"    .feature h3 {" +
"      margin-bottom: 0.5rem;" +
"      color: #1f2937;" +
"    }" +
"    " +
"    /* Auth Section */" +
"    .auth-section {" +
"      display: flex;" +
"      flex-direction: column;" +
"      gap: 1rem;" +
"    }" +
"    " +
"    .auth-buttons {" +
"      display: flex;" +
"      flex-direction: column;" +
"      gap: 1rem;" +
"    }" +
"    " +
"    .auth-form {" +
"      display: none;" +
"    }" +
"    " +
"    /* Crypto Experience Section */" +
"    .crypto-experience {" +
"      background: #f0f9ff;" +
"      border: 2px solid #0ea5e9;" +
"      border-radius: 12px;" +
"      padding: 20px;" +
"      margin: 20px 0;" +
"    }" +
"    " +
"    .crypto-beginner-help {" +
"      background: #fef2f2;" +
"      border: 2px solid #ef4444;" +
"      border-radius: 12px;" +
"      padding: 20px;" +
"      margin-top: 15px;" +
"      display: none;" +
"    }" +
"    " +
"    /* Wallet Setup */" +
"    .wallet-step {" +
"      background: white;" +
"      border: 1px solid #e5e7eb;" +
"      border-radius: 12px;" +
"      padding: 20px;" +
"      margin: 15px 0;" +
"    }" +
"    " +
"    .step-number {" +
"      background: #3b82f6;" +
"      color: white;" +
"      width: 30px;" +
"      height: 30px;" +
"      border-radius: 50%;" +
"      display: inline-flex;" +
"      align-items: center;" +
"      justify-content: center;" +
"      font-weight: bold;" +
"      margin-right: 15px;" +
"    }" +
"    " +
"    /* Utilities */" +
"    .small { font-size: 0.875rem; }" +
"    .muted { color: #6b7280; }" +
"    .mt { margin-top: 1rem; }" +
"    .row { display: flex; gap: 1rem; align-items: center; }" +
"    .footer { text-align: center; margin-top: 3rem; padding: 2rem 0; color: #6b7280; }" +
"    " +
"    /* Responsive */" +
"    @media (max-width: 768px) {" +
"      .hero {" +
"        grid-template-columns: 1fr;" +
"        gap: 2rem;" +
"      }" +
"      " +
"      .features {" +
"        grid-template-columns: 1fr;" +
"      }" +
"      " +
"      .nav-links {" +
"        flex-direction: column;" +
"        gap: 0.5rem;" +
"      }" +
"    }" +
"  </style>" +
"</head>";
}

// ---- Navigation Component ----
function nav(active = "") {
  return '
  <div class="topbar">
    <div class="wrap">
      <div class="logo">
        <span>🚀</span>
        <span>Tangent</span>
      </div>
      <div class="nav-links">
        <a href="/portal" class="' + (active === "Home" ? "active" : "") + '">Home</a>
        <a href="/portal/trade" class="' + (active === "Trade Desk" ? "active" : "") + '">Trade Desk</a>
        <a href="/portal/kyc" class="' + (active === "KYC" ? "active" : "") + '">KYC</a>
        <a href="/portal/wallet-setup" class="' + (active === "Wallet Setup" ? "active" : "") + '">Wallet Setup</a>
        <a href="/portal/admin" class="' + (active === "Admin" ? "active" : "") + '">Admin</a>
      </div>
    </div>
  </div>';
}


