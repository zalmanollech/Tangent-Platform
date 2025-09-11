const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');

// Database configuration
const DB_TYPE = process.env.DB_TYPE || 'json';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data.json');

// Database schema definition
const defaultDBSchema = {
  platformToken: { 
    symbol: "TGT", 
    name: "Tangent Token", 
    decimals: 2, 
    peg: "USD (demo)" 
  },
  priceFeed: { 
    "DEMO.SUGAR": 650, 
    "DEMO.RICE": 520, 
    "DEMO.WHEAT": 580 
  },
  settings: {
    feePercent: 0.75,
    platformWallet: process.env.PLATFORM_WALLET || "PLATFORM_WALLET_NOT_SET",
    insuranceEnabled: false,
    insurancePremiumPercent: 1.25,
    insuranceWallet: process.env.INSURANCE_WALLET || "INSURANCE_WALLET_NOT_SET",
    defaultDays: 14,
    incotermOptions: ["FOB", "CIF", "CFR", "EXW", "DAP", "DDP"],
    emailEnabled: Boolean(process.env.SMTP_HOST),
    ocrEnabled: Boolean(process.env.GOOGLE_VISION_API_KEY),
    antivirusEnabled: false,
    paymentGraceDays: 7
  },
  docsWhitelist: ["ICE.CARGODOCS", "IQAX", "CARGOX", "BOLERO", "WAVE.BL"],
  users: [
    {
      "id": "admin_ollech",
      "email": "ollech@gmail.com",
      "passHash": "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi",
      "role": "admin",
      "isActive": true,
      "emailVerified": true,
      "registrationDate": "2025-09-11T21:00:00.000Z",
      "kyc": {
        "status": "verified",
        "company": "Sadot group inc",
        "country": "Israel",
        "regNumber": "a2345",
        "fullName": "Shmaya Ollech",
        "cryptoExperience": "expert",
        "hasWallet": true,
        "understoodRisks": true,
        "files": [],
        "submittedAt": "2025-09-11T21:00:00.000Z",
        "verifiedAt": "2025-09-11T21:00:00.000Z"
      }
    },
    {
      "id": "admin_dudi",
      "email": "dudiollech@gmail.com",
      "passHash": "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi",
      "role": "admin",
      "isActive": true,
      "emailVerified": true,
      "registrationDate": "2025-09-11T21:00:00.000Z",
      "kyc": {
        "status": "verified",
        "company": "Sadot group inc",
        "country": "Israel",
        "regNumber": "a2345",
        "fullName": "Dudi Ollech",
        "cryptoExperience": "expert",
        "hasWallet": true,
        "understoodRisks": true,
        "files": [],
        "submittedAt": "2025-09-11T21:00:00.000Z",
        "verifiedAt": "2025-09-11T21:00:00.000Z"
      }
    }
  ],
  trades: [],
  tokens: [],
  auctions: [],
  insuranceApplications: [],
  insuranceQuotes: [],
  kycSubmissions: [],
  complianceChecks: [],
  documentVerifications: [],
  sessions: [],
  auditLogs: [],
  notifications: [],
  escrowContracts: []
};

class Database {
  constructor() {
    this.data = null;
    this.initializeDatabase();
  }

  // Initialize database connection/file
  initializeDatabase() {
    try {
      if (DB_TYPE === 'json') {
        this.initializeJsonDatabase();
      } else if (DB_TYPE === 'postgres') {
        // TODO: Implement PostgreSQL connection
        throw new Error('PostgreSQL support not yet implemented');
      } else {
        throw new Error(`Unsupported database type: ${DB_TYPE}`);
      }
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  // Initialize JSON file database
  initializeJsonDatabase() {
    try {
      if (!fs.existsSync(DB_PATH)) {
        console.log('Creating new database file:', DB_PATH);
        this.data = { ...defaultDBSchema };
        this.saveData();
      } else {
        const rawData = fs.readFileSync(DB_PATH, 'utf8');
        this.data = JSON.parse(rawData);
        
        // Ensure all required fields exist (migration)
        this.data = this.ensureDBSchema(this.data);
        this.saveData();
      }
    } catch (error) {
      console.error('JSON database initialization error:', error);
      // Create backup and reinitialize
      if (fs.existsSync(DB_PATH)) {
        const backupPath = DB_PATH + '.backup.' + Date.now();
        fs.copyFileSync(DB_PATH, backupPath);
        console.log('Created backup:', backupPath);
      }
      this.data = { ...defaultDBSchema };
      this.saveData();
    }
  }

  // Ensure database has all required fields
  ensureDBSchema(data) {
    const result = { ...defaultDBSchema };
    
    // Merge existing data with defaults
    Object.keys(defaultDBSchema).forEach(key => {
      if (data[key] !== undefined) {
        if (Array.isArray(defaultDBSchema[key])) {
          if (key === 'users') {
            // For users array, merge default admin users with existing users
            const existingUsers = Array.isArray(data[key]) ? data[key] : [];
            const defaultUsers = defaultDBSchema[key];
            
            // Add default admin users if they don't exist
            const mergedUsers = [...existingUsers];
            defaultUsers.forEach(defaultUser => {
              const existingUser = existingUsers.find(u => u.email === defaultUser.email);
              if (!existingUser) {
                mergedUsers.push(defaultUser);
              } else {
                // Update existing admin users to ensure they have correct properties
                if (defaultUser.role === 'admin') {
                  const userIndex = mergedUsers.findIndex(u => u.email === defaultUser.email);
                  if (userIndex !== -1) {
                    mergedUsers[userIndex] = {
                      ...existingUser,
                      role: 'admin',
                      isActive: true,
                      emailVerified: true,
                      passHash: defaultUser.passHash // Ensure correct password
                    };
                  }
                }
              }
            });
            result[key] = mergedUsers;
          } else {
            result[key] = Array.isArray(data[key]) ? data[key] : [];
          }
        } else if (typeof defaultDBSchema[key] === 'object') {
          result[key] = { ...defaultDBSchema[key], ...data[key] };
        } else {
          result[key] = data[key];
        }
      }
    });

    return result;
  }

  // Save data to storage
  saveData() {
    try {
      if (DB_TYPE === 'json') {
        const dataToSave = JSON.stringify(this.data, null, 2);
        fs.writeFileSync(DB_PATH, dataToSave, 'utf8');
      }
      // TODO: Implement for other database types
    } catch (error) {
      console.error('Database save error:', error);
      throw error;
    }
  }

  // Load fresh data from storage
  loadData() {
    try {
      if (DB_TYPE === 'json') {
        const rawData = fs.readFileSync(DB_PATH, 'utf8');
        this.data = JSON.parse(rawData);
        this.data = this.ensureDBSchema(this.data);
      }
      // TODO: Implement for other database types
      return this.data;
    } catch (error) {
      console.error('Database load error:', error);
      return this.data;
    }
  }

  // Generic CRUD operations
  
  // Create new record
  create(collection, record) {
    try {
      if (!this.data[collection]) {
        this.data[collection] = [];
      }
      
      const newRecord = {
        id: record.id || uuid(),
        ...record,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      this.data[collection].push(newRecord);
      this.saveData();
      
      return newRecord;
    } catch (error) {
      console.error(`Error creating ${collection} record:`, error);
      throw error;
    }
  }

  // Find records by criteria
  find(collection, criteria = {}) {
    try {
      if (!this.data[collection]) {
        return [];
      }

      if (Object.keys(criteria).length === 0) {
        return [...this.data[collection]];
      }

      return this.data[collection].filter(record => {
        return Object.keys(criteria).every(key => {
          if (key.includes('.')) {
            // Support nested field queries (e.g., 'user.email')
            const value = key.split('.').reduce((obj, k) => obj?.[k], record);
            return value === criteria[key];
          }
          return record[key] === criteria[key];
        });
      });
    } catch (error) {
      console.error(`Error finding ${collection} records:`, error);
      return [];
    }
  }

  // Find single record by criteria
  findOne(collection, criteria) {
    const results = this.find(collection, criteria);
    return results.length > 0 ? results[0] : null;
  }

  // Find by ID
  findById(collection, id) {
    return this.findOne(collection, { id });
  }

  // Update record
  update(collection, id, updates) {
    try {
      if (!this.data[collection]) {
        throw new Error(`Collection ${collection} does not exist`);
      }

      const index = this.data[collection].findIndex(record => record.id === id);
      if (index === -1) {
        throw new Error(`Record with id ${id} not found in ${collection}`);
      }

      this.data[collection][index] = {
        ...this.data[collection][index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      this.saveData();
      return this.data[collection][index];
    } catch (error) {
      console.error(`Error updating ${collection} record:`, error);
      throw error;
    }
  }

  // Delete record
  delete(collection, id) {
    try {
      if (!this.data[collection]) {
        throw new Error(`Collection ${collection} does not exist`);
      }

      const index = this.data[collection].findIndex(record => record.id === id);
      if (index === -1) {
        throw new Error(`Record with id ${id} not found in ${collection}`);
      }

      const deletedRecord = this.data[collection].splice(index, 1)[0];
      this.saveData();
      
      return deletedRecord;
    } catch (error) {
      console.error(`Error deleting ${collection} record:`, error);
      throw error;
    }
  }

  // Get collection statistics
  getStats(collection) {
    if (!this.data[collection]) {
      return { count: 0, lastModified: null };
    }

    const records = this.data[collection];
    const lastModified = records.length > 0 
      ? Math.max(...records.map(r => new Date(r.updatedAt || r.createdAt).getTime()))
      : null;

    return {
      count: records.length,
      lastModified: lastModified ? new Date(lastModified).toISOString() : null
    };
  }

  // Database-specific methods

  // User management
  createUser(userData) {
    const existingUser = this.findOne('users', { email: userData.email });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }
    return this.create('users', userData);
  }

  findUserByEmail(email) {
    return this.findOne('users', { email });
  }

  updateUserKYC(userId, kycData) {
    return this.update('users', userId, { kyc: kycData });
  }

  // Session management
  createSession(sessionData) {
    return this.create('sessions', sessionData);
  }

  findSession(sessionId) {
    return this.findOne('sessions', { id: sessionId });
  }

  deleteSession(sessionId) {
    return this.delete('sessions', sessionId);
  }

  cleanExpiredSessions() {
    const now = new Date();
    const expiredSessions = this.find('sessions').filter(session => {
      const expiresAt = new Date(session.expiresAt);
      return expiresAt < now;
    });

    expiredSessions.forEach(session => {
      this.delete('sessions', session.id);
    });

    return expiredSessions.length;
  }

  // Audit logging
  logAuditEvent(userId, action, details, ipAddress = null) {
    return this.create('auditLogs', {
      userId,
      action,
      details,
      ipAddress,
      userAgent: null, // Can be passed from request
      timestamp: new Date().toISOString()
    });
  }

  // Trade management
  createTrade(tradeData) {
    return this.create('trades', tradeData);
  }

  updateTradeStatus(tradeId, status, additionalData = {}) {
    return this.update('trades', tradeId, { status, ...additionalData });
  }

  // Document management
  createDocumentVerification(docData) {
    return this.create('documentVerifications', docData);
  }

  // Compliance
  createComplianceCheck(checkData) {
    return this.create('complianceChecks', checkData);
  }

  // Backup and restore
  createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = DB_PATH + `.backup.${timestamp}`;
    
    try {
      fs.copyFileSync(DB_PATH, backupPath);
      console.log('Database backup created:', backupPath);
      return backupPath;
    } catch (error) {
      console.error('Backup creation failed:', error);
      throw error;
    }
  }

  // Export data for analysis
  exportData() {
    return {
      ...this.data,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
  }

  // Get all data (for compatibility with existing code)
  getAll() {
    return this.data;
  }
}

// Singleton instance
let dbInstance = null;

const getDatabase = () => {
  if (!dbInstance) {
    dbInstance = new Database();
  }
  return dbInstance;
};

module.exports = {
  Database,
  getDatabase,
  defaultDBSchema
};

