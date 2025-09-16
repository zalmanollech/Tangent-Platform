const request = require('supertest');
const app = require('../server_new');
const { getDatabase } = require('../lib/database');

describe('Authentication API', () => {
  let database;
  
  beforeAll(() => {
    database = getDatabase();
  });
  
  beforeEach(() => {
    // Clear users for each test
    database.data.users = [];
    database.saveData();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPass123!',
        role: 'buyer'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.passHash).toBeUndefined(); // Should not return password
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'TestPass123!',
        role: 'buyer'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        email: 'test@example.com',
        password: '123',
        role: 'buyer'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject registration with duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPass123!',
        role: 'buyer'
      };

      // First registration
      await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      // Second registration with same email
      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Email already registered');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'TestPass123!',
          role: 'buyer'
        });
    });

    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPass123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should reject login with incorrect password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPass123!'
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });
  });

  describe('GET /auth/profile', () => {
    let authToken;

    beforeEach(async () => {
      // Register and login to get token
      const registerResponse = await request(app)
        .post('/auth/register')
        .send({
          email: 'test2@example.com', // Use different email to avoid conflicts
          password: 'TestPass123!',
          role: 'buyer'
        });
      
      authToken = registerResponse.body.token;
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/auth/profile')
        .set('x-auth-token', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.passHash).toBeUndefined();
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/auth/profile')
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/auth/profile')
        .set('x-auth-token', 'invalid-token')
        .expect(401);

      expect(response.body.error).toBe('Invalid authentication token');
    });
  });

  describe('POST /auth/verify-token', () => {
    let authToken;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/auth/register')
        .send({
          email: 'test3@example.com', // Use different email to avoid conflicts
          password: 'TestPass123!',
          role: 'buyer'
        });
      
      authToken = registerResponse.body.token;
    });

    it('should verify valid token', async () => {
      const response = await request(app)
        .post('/auth/verify-token')
        .set('x-auth-token', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBe(true);
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/auth/verify-token')
        .set('x-auth-token', 'invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.valid).toBe(false);
    });
  });
});
