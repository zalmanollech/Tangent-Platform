const express = require('express');
const app = express();

console.log('🚀 Starting Tangent Platform Server...');

// Catch all middleware for debugging
app.use((req, res, next) => {
  console.log(`📞 Request: ${req.method} ${req.url}`);
  next();
});

// Basic middleware
app.use(express.json());
app.use(express.static('public'));

// Root route with absolute minimal response
app.get('/', (req, res) => {
  console.log('✅ Root route accessed');
  res.writeHead(200, {
    'Content-Type': 'text/html',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.end('TANGENT WORKING - MINIMAL TEST');
});

// Test route
app.get('/test', (req, res) => {
  console.log('🧪 Test endpoint accessed');
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('TEST ENDPOINT WORKING');
});

// Health check
app.get('/health', (req, res) => {
  console.log('❤️ Health check accessed');
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end('{"status":"healthy"}');
});

// Catch all other routes
app.get('*', (req, res) => {
  console.log(`🔍 Catch-all route: ${req.url}`);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`TANGENT SERVER WORKING - URL: ${req.url}`);
});

// Start server
const PORT = process.env.PORT || 8000;
const HOST = '0.0.0.0';

console.log(`🔧 Starting server on ${HOST}:${PORT}`);

const server = app.listen(PORT, HOST, () => {
  console.log(`✅ TANGENT PLATFORM RUNNING ON PORT ${PORT}`);
  console.log(`🌐 Server ready at http://${HOST}:${PORT}`);
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
});

console.log('⏳ Server initialization complete!');