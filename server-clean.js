const express = require('express');
const path = require('path');
const compression = require('compression');
const cors = require('cors');

const app = express();

// Basic middleware
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Request logging
app.use((req, res, next) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Landing page with error handling
app.get('/', (req, res) => {
  try {
    console.log('🏠 Landing page requested');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tangent Protocol — Advanced Trading Platform</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      margin: 0;
      padding: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      max-width: 800px;
      text-align: center;
      padding: 40px 20px;
    }
    h1 {
      font-size: 3rem;
      font-weight: 700;
      margin-bottom: 20px;
      background: linear-gradient(135deg, #2563eb, #06b6d4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    p {
      font-size: 1.25rem;
      color: #94a3b8;
      margin-bottom: 40px;
    }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background: #2563eb;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-size: 16px;
      font-weight: 500;
      margin: 0 10px;
      transition: all 0.2s ease;
    }
    .btn:hover {
      background: #1d4ed8;
      transform: translateY(-2px);
    }
    .btn.ghost {
      background: transparent;
      border: 2px solid #2563eb;
      color: #2563eb;
    }
    .btn.ghost:hover {
      background: #2563eb;
      color: white;
    }
    .status {
      margin-top: 40px;
      padding: 20px;
      background: #1e293b;
      border-radius: 8px;
      border: 1px solid #334155;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Tangent Protocol</h1>
    <p>Advanced Trading Platform</p>
    <p>Experience next-generation trading with institutional-grade tools, real-time analytics, and seamless execution.</p>
    
    <div>
      <button class="btn" onclick="window.location.href='/admin'">Admin Panel</button>
      <button class="btn ghost" onclick="window.location.href='/portal'">Team Portal</button>
    </div>
    
    <div class="status">
      <h3>🚀 Platform Status</h3>
      <p><strong>Server:</strong> ✅ Online and Running</p>
      <p><strong>DNS Routing:</strong> ✅ Working</p>
      <p><strong>SSL Certificates:</strong> ✅ Active</p>
      <p><strong>Version:</strong> 1.0.0-clean</p>
      <p><strong>Last Updated:</strong> ${new Date().toISOString()}</p>
    </div>
    
    <div style="margin-top: 30px;">
      <a href="/test" style="color: #2563eb;">🧪 Test Server</a> | 
      <a href="/health" style="color: #2563eb;">📊 Health Check</a> |
      <a href="/demo/buyer-journey" style="color: #2563eb;">🎯 Demo</a>
    </div>
  </div>
</body>
</html>`;
  res.send(html);
});

// Admin page
app.get('/admin', (req, res) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Admin Panel</title>
  <style>
    body { font-family: Arial; background: #0f172a; color: #f8fafc; padding: 40px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #2563eb; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Admin Panel</h1>
    <p>Welcome to the admin dashboard.</p>
    <a href="/" style="color: #2563eb;">← Back to Home</a>
  </div>
</body>
</html>`;
  res.send(html);
});

// Portal page
app.get('/portal', (req, res) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Team Portal</title>
  <style>
    body { font-family: Arial; background: #0f172a; color: #f8fafc; padding: 40px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #2563eb; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Team Portal</h1>
    <p>Welcome to the team portal.</p>
    <a href="/" style="color: #2563eb;">← Back to Home</a>
  </div>
</body>
</html>`;
  res.send(html);
});

// Test route
app.get('/test', (req, res) => {
  res.send(`<html><body style="font-family: Arial; background: #0f172a; color: #f8fafc; padding: 40px; text-align: center;">
    <h1>✅ Server Working Perfectly!</h1>
    <p>Clean server deployed successfully!</p>
    <p><strong>Path:</strong> ${req.path}</p>
    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
    <a href="/" style="color: #2563eb;">← Back to Home</a>
  </body></html>`);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    mode: 'clean',
    timestamp: new Date().toISOString(),
    version: '1.0.0-clean',
    path: req.path
  });
});

// Catch all other routes
app.get('*', (req, res) => {
  res.send(`<html><body style="font-family: Arial; background: #0f172a; color: #f8fafc; padding: 40px; text-align: center;">
    <h1>Route: ${req.path}</h1>
    <p>This route was accessed but not specifically handled.</p>
    <a href="/" style="color: #2563eb;">Go to Home</a>
  </body></html>`);
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Tangent Platform (Clean) running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
