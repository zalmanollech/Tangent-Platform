// Debug wrapper for server.js to catch crashes
console.log('🔍 Starting debug server...');

// Catch all uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION:', err);
  console.error('Stack:', err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION:', reason);
  console.error('Promise:', promise);
  process.exit(1);
});

try {
  console.log('🔄 Attempting to load server.js...');
  require('./server.js');
  console.log('✅ Server.js loaded successfully');
} catch (error) {
  console.error('💥 ERROR LOADING SERVER:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
}
