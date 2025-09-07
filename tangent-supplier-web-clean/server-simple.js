// Simple server for Railway debugging
const express = require('express');
const path = require('path');

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.static('public'));

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

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Simple server running on http://${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
});

// Keep the process alive
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;
