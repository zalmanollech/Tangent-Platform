// Simple server for Railway debugging
const express = require('express');

const app = express();

// Basic middleware
app.use(express.json());

// Simple routes
app.get('/', (req, res) => {
  res.send('<h1>🎯 Tangent Platform is Running!</h1><p>Server started successfully on Railway.</p>');
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 'unknown'
  });
});

const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Simple server running on http://${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;