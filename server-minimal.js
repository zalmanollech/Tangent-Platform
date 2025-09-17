const express = require('express');
const app = express();

console.log('Starting Tangent server...');

// Root route
app.get('/', (req, res) => {
  console.log('Root route accessed');
  res.send('TANGENT PROTOCOL WORKING!');
});

// Health check for Railway
app.get('/health', (req, res) => {
  console.log('Health check accessed');
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Test endpoint
app.get('/test', (req, res) => {
  console.log('Test endpoint accessed');
  res.json({ 
    status: 'WORKING', 
    time: new Date().toISOString(),
    message: 'Tangent Platform Test Successful'
  });
});

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
const PORT = process.env.PORT || 8000;
const HOST = '0.0.0.0';

console.log(`Attempting to start server on ${HOST}:${PORT}`);

app.listen(PORT, HOST, (err) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  console.log(`✅ TANGENT SERVER RUNNING ON PORT ${PORT}`);
  console.log(`🌐 Server accessible at http://${HOST}:${PORT}`);
});

console.log('Server setup complete, waiting for Railway...');