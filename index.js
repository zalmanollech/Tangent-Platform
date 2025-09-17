const express = require('express');
const app = express();

console.log('🚀 Starting Tangent Platform Server...');

// Basic middleware
app.use(express.json());
app.use(express.static('public'));

// Root route
app.get('/', (req, res) => {
  console.log('✅ Root route accessed');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tangent Protocol - Working!</title>
</head>
<body style="font-family: Arial, sans-serif; background: #0f172a; color: white; text-align: center; padding: 50px;">
    <h1 style="color: #2563eb; font-size: 3rem;">🚀 TANGENT PROTOCOL IS WORKING! 🎉</h1>
    <p style="font-size: 1.2rem;">Deployment successful! Server is running properly.</p>
    <p style="font-size: 1rem; color: #64748b;">Ready to restore full platform functionality.</p>
</body>
</html>`);
});

// Health check for Railway
app.get('/health', (req, res) => {
  console.log('❤️ Health check accessed');
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'Tangent Platform is running successfully!'
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  console.log('🧪 Test endpoint accessed');
  res.json({ 
    status: 'SUCCESS', 
    timestamp: new Date().toISOString(),
    message: 'Tangent Platform Test Successful!',
    version: '1.0.0'
  });
});

// Error handling
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// Start server
const PORT = process.env.PORT || 8000;
const HOST = '0.0.0.0';

console.log(`🔧 Starting server on ${HOST}:${PORT}`);

const server = app.listen(PORT, HOST, (err) => {
  if (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
  console.log(`✅ TANGENT PLATFORM RUNNING ON PORT ${PORT}`);
  console.log(`🌐 Server ready at http://${HOST}:${PORT}`);
  console.log('🎯 Ready for Railway health checks!');
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
});

console.log('⏳ Server initialization complete!');
