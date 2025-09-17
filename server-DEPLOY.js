const express = require('express');
require('dotenv').config({ path: './config.env' });
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Try to load existing routes
try {
  const authRoutes = require('./routes/auth');
  const tradeRoutes = require('./routes/trades');
  const paymentRoutes = require('./routes/payments');
  
  app.use('/auth', authRoutes);
  app.use('/api/trades', tradeRoutes);
  app.use('/api/payments', paymentRoutes);
  console.log('✅ API routes loaded');
} catch (error) {
  console.log('⚠️ API routes not available:', error.message);
}

// Landing page
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><title>Tangent Protocol</title>
<style>body{font-family:system-ui;background:#0f172a;color:#f8fafc;padding:40px;text-align:center}
h1{color:#2563eb;font-size:3rem}
.btn{background:#2563eb;color:white;padding:15px 30px;border:none;border-radius:8px;margin:10px;text-decoration:none;display:inline-block}
.btn:hover{background:#1d4ed8}</style></head>
<body><h1>🚀 Tangent Protocol</h1><p>Advanced Trading Platform & TGT Stablecoin</p>
<a href="/landing-two" class="btn">Team Portal</a>
<a href="/test" class="btn">Test Server</a></body></html>`);
});

// Team access
app.get('/landing-two', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><title>Team Access</title>
<style>body{font-family:system-ui;background:#0f172a;color:#f8fafc;padding:40px;text-align:center}
.btn{background:#2563eb;color:white;padding:15px 30px;border:none;border-radius:8px;margin:10px;text-decoration:none;display:inline-block}
.btn.secondary{background:#06b6d4}</style></head>
<body><h1>🔐 Team Access</h1>
<a href="/sign-in" class="btn">Sign In</a>
<a href="/sign-up" class="btn secondary">Sign Up</a></body></html>`);
});

// Auth pages
app.get('/sign-in', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><title>Sign In</title>
<style>body{font-family:system-ui;background:#0f172a;color:#f8fafc;padding:40px}
form{max-width:400px;margin:0 auto}
input{width:100%;padding:12px;margin:10px 0;border:1px solid #334155;border-radius:8px;background:#0f172a;color:#f8fafc}
.btn{width:100%;padding:15px;background:#2563eb;color:white;border:none;border-radius:8px;cursor:pointer}</style></head>
<body><h1>🔐 Sign In</h1>
<form id="loginForm"><input type="email" placeholder="Email" required>
<input type="password" placeholder="Password" required>
<button type="submit" class="btn">Sign In</button></form>
<script>document.getElementById('loginForm').onsubmit=function(e){
e.preventDefault();alert('Login system ready - connecting to backend...');
window.location.href='/dashboard';}</script></body></html>`);
});

app.get('/sign-up', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><title>Sign Up</title>
<style>body{font-family:system-ui;background:#0f172a;color:#f8fafc;padding:40px}
form{max-width:400px;margin:0 auto}
input,select{width:100%;padding:12px;margin:10px 0;border:1px solid #334155;border-radius:8px;background:#0f172a;color:#f8fafc}
.btn{width:100%;padding:15px;background:#2563eb;color:white;border:none;border-radius:8px;cursor:pointer}</style></head>
<body><h1>📝 Sign Up</h1>
<form id="signupForm"><input type="text" placeholder="First Name" required>
<input type="text" placeholder="Last Name" required>
<input type="email" placeholder="Email" required>
<input type="password" placeholder="Password" required>
<select required><option value="">Select Role</option><option value="buyer">Buyer</option>
<option value="supplier">Supplier</option><option value="trader">Trader</option></select>
<button type="submit" class="btn">Create Account</button></form>
<script>document.getElementById('signupForm').onsubmit=function(e){
e.preventDefault();alert('Registration successful! Redirecting to KYC...');
window.location.href='/kyc';}</script></body></html>`);
});

// Dashboard
app.get('/dashboard', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><title>Dashboard</title>
<style>body{font-family:system-ui;background:#0f172a;color:#f8fafc;padding:40px;text-align:center}
.btn{background:#2563eb;color:white;padding:15px 30px;border:none;border-radius:8px;margin:10px;text-decoration:none;display:inline-block}</style></head>
<body><h1>📊 Dashboard</h1><p>✅ Welcome to Tangent Platform</p>
<a href="/api/trades" class="btn">View Trades</a>
<a href="/" class="btn">Home</a></body></html>`);
});

// KYC placeholder
app.get('/kyc', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><title>KYC</title></head>
<body style="font-family:system-ui;background:#0f172a;color:#f8fafc;padding:40px;text-align:center">
<h1>🔍 KYC Verification</h1><p>KYC system ready - full implementation loading...</p>
<a href="/dashboard" style="background:#2563eb;color:white;padding:15px 30px;border:none;border-radius:8px;margin:10px;text-decoration:none;display:inline-block">Continue to Dashboard</a>
</body></html>`);
});

// API endpoints
app.get('/test', (req, res) => {
  res.json({ 
    status: 'TANGENT DEPLOY VERSION WORKING!', 
    timestamp: new Date(),
    version: 'DEPLOY-1.0.0',
    size: 'Optimized for Railway deployment'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TANGENT DEPLOY SERVER RUNNING ON PORT ${PORT}`);
});
