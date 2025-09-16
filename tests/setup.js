// Test setup file
const path = require('path');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.DB_PATH = path.join(__dirname, '../test_data.json');
process.env.LOG_LEVEL = 'error'; // Reduce logging noise during tests
process.env.RATE_LIMIT_WINDOW_MS = '60000'; // 1 minute for tests
process.env.RATE_LIMIT_MAX_REQUESTS = '1000'; // High limit for tests

// Clean up test database after each test suite
afterAll(async () => {
  const fs = require('fs');
  const testDbPath = process.env.DB_PATH;
  
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});
