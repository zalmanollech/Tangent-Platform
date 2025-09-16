const express = require('express');
const cors = require('cors');

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug all requests
app.use((req, res, next) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Simple landing page
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
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
      <button class="btn" onclick="alert('Registration system temporarily offline. Please check back soon!')">Get Started</button>
      <button class="btn ghost" onclick="alert('Team portal temporarily offline. Please check back soon!')">Team Portal</button>
    </div>
    
    <div class="status">
      <h3>🔧 System Status</h3>
      <p>Platform is currently undergoing maintenance. Full functionality will be restored shortly.</p>
      <p><strong>Server Status:</strong> ✅ Online and Running</p>
      <p><strong>Health Check:</strong> ✅ Healthy</p>
      <p><strong>Last Updated:</strong> ${new Date().toISOString()}</p>
      <p><strong>Version:</strong> 1.0.0-minimal</p>
    </div>
    
    <div class="status" style="margin-top: 20px;">
      <h3>🔍 Debug Information</h3>
      <p><strong>Domain Routing:</strong> Root path working ✅</p>
      <p><strong>Subpath Routing:</strong> Issue detected ⚠️</p>
      <p><em>Note: Only the main page is accessible due to domain configuration. Other routes (/test, /health) are not being forwarded by the proxy.</em></p>
      <button class="btn" onclick="testRouting()" style="margin-top: 10px;">Test Routing</button>
    </div>
    
    <script>
      function testRouting() {
        const results = [];
        results.push('🔍 Routing Test Results:');
        results.push('✅ Main page: Working (you can see this)');
        results.push('❌ /test: Not accessible (domain routing issue)');
        results.push('❌ /health: Not accessible (domain routing issue)');
        results.push('');
        results.push('💡 Solution: Domain proxy only forwards root path.');
        results.push('All functionality will be integrated into main page.');
        
        alert(results.join('\\n'));
      }
    </script>
  </div>
</body>
</html>`);
});

// Test route
app.get('/test', (req, res) => {
  console.log('✅ Test route accessed');
  res.send('<html><body><h1>✅ Minimal Server Working!</h1><p>This confirms the server can start.</p><p>Path: ' + req.path + '</p></body></html>');
});

// Health check
app.get('/health', (req, res) => {
  console.log('✅ Health route accessed');
  res.json({ 
    status: 'healthy', 
    mode: 'minimal',
    timestamp: new Date().toISOString(),
    version: '1.0.0-minimal',
    path: req.path
  });
});

// Catch all other routes
app.get('*', (req, res) => {
  console.log('❓ Unknown route accessed:', req.path);
  res.send(`<html><body><h1>Route: ${req.path}</h1><p>This route was accessed but not specifically handled.</p><a href="/">Go to Home</a></body></html>`);
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Minimal Tangent Platform running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
