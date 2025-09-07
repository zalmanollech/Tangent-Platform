const { Pool } = require('pg');
const { config } = require('./config');
const logger = require('./logger');

class PostgreSQLDatabase {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  async initialize() {
    try {
      // Create connection pool
      this.pool = new Pool({
        connectionString: config.database.url,
        max: config.database.maxConnections,
        ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      await this.createTables();
      
      this.isConnected = true;
      logger.info('PostgreSQL database connected successfully');
      
      return this;
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL', { error: error.message });
      throw error;
    }
  }

  async createTables() {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          pass_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'buyer',
          full_name VARCHAR(255),
          company VARCHAR(255),
          country VARCHAR(100),
          phone VARCHAR(50),
          is_active BOOLEAN DEFAULT true,
          email_verified BOOLEAN DEFAULT false,
          verification_token VARCHAR(255),
          verification_token_expiry TIMESTAMP,
          reset_token VARCHAR(255),
          reset_token_expiry TIMESTAMP,
          registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login_at TIMESTAMP,
          last_login_ip INET,
          password_changed_at TIMESTAMP,
          verified_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // KYC data stored as JSONB for flexibility
      await client.query(`
        CREATE TABLE IF NOT EXISTS kyc_data (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          status VARCHAR(50) DEFAULT 'none',
          entity_type VARCHAR(50),
          files JSONB DEFAULT '[]',
          crypto_experience TEXT,
          has_wallet BOOLEAN DEFAULT false,
          reviewed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // KYC submissions
      await client.query(`
        CREATE TABLE IF NOT EXISTS kyc_submissions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          entity_type VARCHAR(50) NOT NULL,
          uploaded_files JSONB NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          risk_score INTEGER,
          auto_approved BOOLEAN DEFAULT false,
          review_notes JSONB DEFAULT '[]',
          reviewed_at TIMESTAMP,
          reviewed_by UUID REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Trades table
      await client.query(`
        CREATE TABLE IF NOT EXISTS trades (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          commodity VARCHAR(255) NOT NULL,
          quantity DECIMAL(15,2) NOT NULL,
          unit_price DECIMAL(15,2) NOT NULL,
          total_value DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
          supplier VARCHAR(255) NOT NULL,
          buyer VARCHAR(255) NOT NULL,
          deposit_pct INTEGER DEFAULT 30,
          finance_pct INTEGER DEFAULT 70,
          incoterms VARCHAR(50) DEFAULT 'FOB',
          insurance_applied BOOLEAN DEFAULT false,
          description TEXT,
          status VARCHAR(50) DEFAULT 'created',
          creator_id UUID REFERENCES users(id),
          creator_role VARCHAR(50),
          buyer_deposit_paid BOOLEAN DEFAULT false,
          supplier_confirmed BOOLEAN DEFAULT false,
          docs_uploaded BOOLEAN DEFAULT false,
          key_issued BOOLEAN DEFAULT false,
          final_payment_made BOOLEAN DEFAULT false,
          completed BOOLEAN DEFAULT false,
          blockchain_tx_hash VARCHAR(255),
          blockchain_trade_id VARCHAR(255),
          deposit_amount DECIMAL(15,2),
          finance_amount DECIMAL(15,2),
          platform_fee DECIMAL(15,2),
          insurance_premium DECIMAL(15,2),
          deadline TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Trade events/history
      await client.query(`
        CREATE TABLE IF NOT EXISTS trade_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
          event_type VARCHAR(100) NOT NULL,
          event_data JSONB,
          user_id UUID REFERENCES users(id),
          tx_hash VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Platform settings
      await client.query(`
        CREATE TABLE IF NOT EXISTS platform_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          key VARCHAR(255) UNIQUE NOT NULL,
          value JSONB NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Price feed data
      await client.query(`
        CREATE TABLE IF NOT EXISTS price_feeds (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          commodity VARCHAR(255) NOT NULL,
          price DECIMAL(15,2) NOT NULL,
          currency VARCHAR(10) DEFAULT 'USD',
          source VARCHAR(100),
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Audit logs
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type VARCHAR(100) NOT NULL,
          user_id UUID REFERENCES users(id),
          resource_type VARCHAR(100),
          resource_id UUID,
          old_values JSONB,
          new_values JSONB,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Sessions (if using database sessions instead of Redis)
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          sid VARCHAR(255) PRIMARY KEY,
          sess JSONB NOT NULL,
          expire TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_kyc_data_user_id ON kyc_data(user_id);
        CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user_id ON kyc_submissions(user_id);
        CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status ON kyc_submissions(status);
        CREATE INDEX IF NOT EXISTS idx_trades_creator_id ON trades(creator_id);
        CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
        CREATE INDEX IF NOT EXISTS idx_trades_commodity ON trades(commodity);
        CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at);
        CREATE INDEX IF NOT EXISTS idx_trade_events_trade_id ON trade_events(trade_id);
        CREATE INDEX IF NOT EXISTS idx_trade_events_type ON trade_events(event_type);
        CREATE INDEX IF NOT EXISTS idx_price_feeds_commodity ON price_feeds(commodity);
        CREATE INDEX IF NOT EXISTS idx_price_feeds_timestamp ON price_feeds(timestamp);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);
      `);

      // Create updated_at trigger function
      await client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);

      // Create triggers for updated_at
      const tablesWithUpdatedAt = ['users', 'kyc_data', 'kyc_submissions', 'trades', 'platform_settings'];
      for (const table of tablesWithUpdatedAt) {
        await client.query(`
          CREATE TRIGGER IF NOT EXISTS update_${table}_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `);
      }

      await client.query('COMMIT');
      logger.info('Database tables created successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create database tables', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  // Generic CRUD operations
  async findById(table, id) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async findByEmail(email) {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async create(table, data) {
    const client = await this.pool.connect();
    try {
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      
      const query = `
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `;
      
      const result = await client.query(query, values);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async update(table, id, data) {
    const client = await this.pool.connect();
    try {
      const columns = Object.keys(data);
      const values = Object.values(data);
      const setClause = columns.map((col, i) => `${col} = $${i + 2}`).join(', ');
      
      const query = `
        UPDATE ${table}
        SET ${setClause}
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await client.query(query, [id, ...values]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async delete(table, id) {
    const client = await this.pool.connect();
    try {
      const query = `DELETE FROM ${table} WHERE id = $1 RETURNING *`;
      const result = await client.query(query, [id]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async findAll(table, conditions = {}, options = {}) {
    const client = await this.pool.connect();
    try {
      let query = `SELECT * FROM ${table}`;
      const values = [];
      
      // Add WHERE conditions
      if (Object.keys(conditions).length > 0) {
        const whereClause = Object.keys(conditions)
          .map((key, i) => `${key} = $${i + 1}`)
          .join(' AND ');
        query += ` WHERE ${whereClause}`;
        values.push(...Object.values(conditions));
      }
      
      // Add ORDER BY
      if (options.orderBy) {
        query += ` ORDER BY ${options.orderBy}`;
        if (options.order === 'DESC') {
          query += ' DESC';
        }
      }
      
      // Add LIMIT and OFFSET
      if (options.limit) {
        query += ` LIMIT $${values.length + 1}`;
        values.push(options.limit);
      }
      
      if (options.offset) {
        query += ` OFFSET $${values.length + 1}`;
        values.push(options.offset);
      }
      
      const result = await client.query(query, values);
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Specialized methods for complex operations
  async createUser(userData) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Create user
      const userResult = await client.query(`
        INSERT INTO users (email, pass_hash, role, full_name, company, country, phone, 
                          email_verified, verification_token, verification_token_expiry)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        userData.email,
        userData.passHash,
        userData.role,
        userData.fullName || null,
        userData.company || null,
        userData.country || null,
        userData.phone || null,
        userData.emailVerified || false,
        userData.verificationToken || null,
        userData.verificationTokenExpiry || null
      ]);
      
      const user = userResult.rows[0];
      
      // Create KYC record
      await client.query(`
        INSERT INTO kyc_data (user_id, status, crypto_experience, has_wallet)
        VALUES ($1, $2, $3, $4)
      `, [
        user.id,
        userData.kyc?.status || 'none',
        userData.kyc?.cryptoExperience || null,
        userData.kyc?.hasWallet || false
      ]);
      
      await client.query('COMMIT');
      
      // Return user with KYC data
      return this.getUserWithKYC(user.id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserWithKYC(userId) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT u.*, 
               json_build_object(
                 'status', k.status,
                 'entityType', k.entity_type,
                 'files', k.files,
                 'cryptoExperience', k.crypto_experience,
                 'hasWallet', k.has_wallet,
                 'reviewedAt', k.reviewed_at
               ) as kyc
        FROM users u
        LEFT JOIN kyc_data k ON u.id = k.user_id
        WHERE u.id = $1
      `, [userId]);
      
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async createTradeWithEvents(tradeData) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Create trade
      const tradeResult = await client.query(`
        INSERT INTO trades (commodity, quantity, unit_price, supplier, buyer, 
                           deposit_pct, finance_pct, incoterms, insurance_applied,
                           description, status, creator_id, creator_role,
                           deposit_amount, finance_amount, platform_fee, insurance_premium)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `, [
        tradeData.commodity,
        tradeData.quantity,
        tradeData.unitPrice,
        tradeData.supplier,
        tradeData.buyer,
        tradeData.depositPct,
        tradeData.financePct,
        tradeData.incoterms,
        tradeData.insuranceApplied,
        tradeData.description,
        tradeData.status,
        tradeData.creatorId,
        tradeData.creatorRole,
        tradeData.depositAmount,
        tradeData.financeAmount,
        tradeData.platformFee,
        tradeData.insurancePremium
      ]);
      
      const trade = tradeResult.rows[0];
      
      // Create trade event
      await client.query(`
        INSERT INTO trade_events (trade_id, event_type, event_data, user_id)
        VALUES ($1, $2, $3, $4)
      `, [
        trade.id,
        'trade_created',
        JSON.stringify({ commodity: trade.commodity, totalValue: trade.total_value }),
        tradeData.creatorId
      ]);
      
      await client.query('COMMIT');
      return trade;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Audit logging
  async logAudit(eventType, userId, resourceType, resourceId, oldValues, newValues, ipAddress, userAgent) {
    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO audit_logs (event_type, user_id, resource_type, resource_id, 
                               old_values, new_values, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        eventType,
        userId,
        resourceType,
        resourceId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent
      ]);
    } finally {
      client.release();
    }
  }

  // Analytics and reporting
  async getTradeAnalytics(dateRange = {}) {
    const client = await this.pool.connect();
    try {
      const { startDate, endDate } = dateRange;
      let whereClause = '';
      const values = [];
      
      if (startDate && endDate) {
        whereClause = 'WHERE created_at BETWEEN $1 AND $2';
        values.push(startDate, endDate);
      }
      
      const result = await client.query(`
        SELECT 
          COUNT(*) as total_trades,
          SUM(total_value) as total_volume,
          AVG(total_value) as avg_trade_value,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_trades,
          COUNT(CASE WHEN status = 'created' THEN 1 END) as pending_trades,
          COUNT(DISTINCT commodity) as unique_commodities
        FROM trades
        ${whereClause}
      `, values);
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('PostgreSQL connection closed');
    }
  }
}

module.exports = PostgreSQLDatabase;



