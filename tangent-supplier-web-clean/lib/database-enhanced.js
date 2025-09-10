const { config } = require('./config');
const logger = require('./logger');
const PostgreSQLDatabase = require('./database-postgres');
const JSONDatabase = require('./database'); // Original JSON database

class DatabaseManager {
  constructor() {
    this.database = null;
    this.type = config.database.type;
  }

  async initialize() {
    try {
      if (this.type === 'postgresql' && config.database.url) {
        // Use PostgreSQL
        this.database = new PostgreSQLDatabase();
        await this.database.initialize();
        logger.info('Database initialized: PostgreSQL');
      } else {
        // Fallback to JSON database
        this.database = new JSONDatabase();
        await this.database.initialize();
        logger.info('Database initialized: JSON');
      }
      
      return this;
    } catch (error) {
      logger.error('Database initialization failed', { error: error.message });
      throw error;
    }
  }

  // Unified interface - these methods work with both PostgreSQL and JSON
  async findById(table, id) {
    if (this.type === 'postgresql') {
      return await this.database.findById(table, id);
    } else {
      return this.database.findById(table, id);
    }
  }

  async findUserByEmail(email) {
    if (this.type === 'postgresql') {
      return await this.database.findByEmail(email);
    } else {
      return this.database.findUserByEmail(email);
    }
  }

  async create(table, data) {
    if (this.type === 'postgresql') {
      return await this.database.create(table, data);
    } else {
      return this.database.create(table, data);
    }
  }

  async update(table, id, data) {
    if (this.type === 'postgresql') {
      return await this.database.update(table, id, data);
    } else {
      return this.database.update(table, id, data);
    }
  }

  async delete(table, id) {
    if (this.type === 'postgresql') {
      return await this.database.delete(table, id);
    } else {
      return this.database.delete(table, id);
    }
  }

  async findAll(table, conditions = {}, options = {}) {
    if (this.type === 'postgresql') {
      return await this.database.findAll(table, conditions, options);
    } else {
      return this.database.findAll(table, conditions, options);
    }
  }

  // Specialized methods
  async createUser(userData) {
    if (this.type === 'postgresql') {
      return await this.database.createUser(userData);
    } else {
      return this.database.createUser(userData);
    }
  }

  async getUserWithKYC(userId) {
    if (this.type === 'postgresql') {
      return await this.database.getUserWithKYC(userId);
    } else {
      // For JSON database, simulate the joined data
      const user = this.database.findById('users', userId);
      return user; // KYC data is already embedded in JSON structure
    }
  }

  async createTradeWithEvents(tradeData) {
    if (this.type === 'postgresql') {
      return await this.database.createTradeWithEvents(tradeData);
    } else {
      // For JSON database, just create the trade
      return this.database.create('trades', tradeData);
    }
  }

  // Analytics
  async getTradeAnalytics(dateRange = {}) {
    if (this.type === 'postgresql') {
      return await this.database.getTradeAnalytics(dateRange);
    } else {
      // Calculate analytics from JSON data
      const trades = this.database.getAll().trades || [];
      const { startDate, endDate } = dateRange;
      
      let filteredTrades = trades;
      if (startDate && endDate) {
        filteredTrades = trades.filter(trade => {
          const tradeDate = new Date(trade.createdAt);
          return tradeDate >= new Date(startDate) && tradeDate <= new Date(endDate);
        });
      }
      
      const totalTrades = filteredTrades.length;
      const totalVolume = filteredTrades.reduce((sum, trade) => sum + (trade.totalValue || 0), 0);
      const avgTradeValue = totalTrades > 0 ? totalVolume / totalTrades : 0;
      const completedTrades = filteredTrades.filter(trade => trade.status === 'completed').length;
      const pendingTrades = filteredTrades.filter(trade => trade.status === 'created').length;
      const uniqueCommodities = new Set(filteredTrades.map(trade => trade.commodity)).size;
      
      return {
        total_trades: totalTrades,
        total_volume: totalVolume,
        avg_trade_value: avgTradeValue,
        completed_trades: completedTrades,
        pending_trades: pendingTrades,
        unique_commodities: uniqueCommodities
      };
    }
  }

  // Audit logging
  async logAudit(eventType, userId, resourceType, resourceId, oldValues, newValues, ipAddress, userAgent) {
    if (this.type === 'postgresql') {
      return await this.database.logAudit(eventType, userId, resourceType, resourceId, oldValues, newValues, ipAddress, userAgent);
    } else {
      // For JSON database, store in a simple audit log
      const auditLog = {
        id: require('uuid').v4(),
        eventType,
        userId,
        resourceType,
        resourceId,
        oldValues,
        newValues,
        ipAddress,
        userAgent,
        createdAt: new Date().toISOString()
      };
      
      const data = this.database.getAll();
      if (!data.auditLogs) data.auditLogs = [];
      data.auditLogs.push(auditLog);
      this.database.saveDB(data);
      
      return auditLog;
    }
  }

  // Legacy JSON database methods for backward compatibility
  getAll() {
    if (this.type === 'postgresql') {
      throw new Error('getAll() not supported for PostgreSQL. Use specific query methods.');
    }
    return this.database.getAll();
  }

  saveDB(data) {
    if (this.type === 'postgresql') {
      throw new Error('saveDB() not supported for PostgreSQL. Use specific update methods.');
    }
    return this.database.saveDB(data);
  }

  getTable(tableName) {
    if (this.type === 'postgresql') {
      throw new Error('getTable() not supported for PostgreSQL. Use findAll() method.');
    }
    return this.database.getTable(tableName);
  }

  // Utility methods
  getDatabaseType() {
    return this.type;
  }

  isPostgreSQL() {
    return this.type === 'postgresql';
  }

  isJSON() {
    return this.type === 'json';
  }

  async close() {
    if (this.database && typeof this.database.close === 'function') {
      await this.database.close();
    }
  }

  // Migration utilities
  async migrateFromJSONToPostgreSQL(jsonFilePath) {
    if (this.type !== 'postgresql') {
      throw new Error('Can only migrate to PostgreSQL database');
    }

    logger.info('Starting migration from JSON to PostgreSQL');
    
    try {
      // Load JSON data
      const fs = require('fs');
      const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
      
      // Migrate users
      if (jsonData.users && Array.isArray(jsonData.users)) {
        for (const user of jsonData.users) {
          try {
            await this.database.createUser({
              email: user.email,
              passHash: user.passHash,
              role: user.role,
              fullName: user.fullName,
              company: user.company,
              country: user.country,
              phone: user.phone,
              emailVerified: user.emailVerified,
              verificationToken: user.verificationToken,
              verificationTokenExpiry: user.verificationTokenExpiry,
              kyc: user.kyc
            });
            logger.info('Migrated user', { email: user.email });
          } catch (error) {
            logger.error('Failed to migrate user', { email: user.email, error: error.message });
          }
        }
      }
      
      // Migrate trades
      if (jsonData.trades && Array.isArray(jsonData.trades)) {
        for (const trade of jsonData.trades) {
          try {
            await this.database.createTradeWithEvents({
              commodity: trade.commodity,
              quantity: trade.quantity,
              unitPrice: trade.unitPrice,
              supplier: trade.supplier,
              buyer: trade.buyer,
              depositPct: trade.depositPct,
              financePct: trade.financePct,
              incoterms: trade.incoterms,
              insuranceApplied: trade.insuranceApplied,
              description: trade.description,
              status: trade.status,
              creatorId: trade.creatorId,
              creatorRole: trade.creatorRole,
              depositAmount: trade.depositAmount,
              financeAmount: trade.financeAmount,
              platformFee: trade.platformFee,
              insurancePremium: trade.insurancePremium
            });
            logger.info('Migrated trade', { id: trade.id, commodity: trade.commodity });
          } catch (error) {
            logger.error('Failed to migrate trade', { id: trade.id, error: error.message });
          }
        }
      }
      
      // Migrate platform settings
      if (jsonData.settings) {
        for (const [key, value] of Object.entries(jsonData.settings)) {
          try {
            await this.database.create('platform_settings', {
              key,
              value: JSON.stringify(value),
              description: `Migrated from JSON: ${key}`
            });
          } catch (error) {
            logger.error('Failed to migrate setting', { key, error: error.message });
          }
        }
      }
      
      // Migrate price feeds
      if (jsonData.priceFeed) {
        for (const [commodity, price] of Object.entries(jsonData.priceFeed)) {
          try {
            await this.database.create('price_feeds', {
              commodity,
              price,
              currency: 'USD',
              source: 'migration'
            });
          } catch (error) {
            logger.error('Failed to migrate price feed', { commodity, error: error.message });
          }
        }
      }
      
      logger.info('Migration from JSON to PostgreSQL completed successfully');
      
    } catch (error) {
      logger.error('Migration failed', { error: error.message });
      throw error;
    }
  }
}

// Singleton instance
let databaseInstance = null;

module.exports = {
  async getDatabase() {
    if (!databaseInstance) {
      databaseInstance = new DatabaseManager();
      await databaseInstance.initialize();
    }
    return databaseInstance;
  },
  
  DatabaseManager
};




