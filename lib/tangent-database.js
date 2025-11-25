// Tangent Platform PostgreSQL Database Module
// This module handles all database operations for the Tangent Platform
const { Pool } = require('pg');

let pool = null;

// Initialize database connection
async function initDatabase() {
    if (pool) {
        console.log('[DB] Database pool already exists, reusing...');
        return pool;
    }
    
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
        console.warn('[DB] DATABASE_URL not configured, database features disabled');
        return null;
    }
    
    console.log('[DB] ========================================');
    console.log('[DB] Initializing PostgreSQL connection...');
    console.log('[DB] DATABASE_URL (masked):', databaseUrl.replace(/:[^:@]+@/, ':****@'));
    console.log('[DB] Using connectionString from process.env.DATABASE_URL');
    
    // Detect Railway internal connection (no SSL needed for internal)
    const isRailwayInternal = databaseUrl.includes('railway.internal');
    const useSSL = !isRailwayInternal && process.env.DB_SSL === 'true';
    
    if (isRailwayInternal) {
        console.log('[DB] Detected Railway internal connection - SSL disabled');
    } else {
        console.log('[DB] External connection - SSL:', useSSL);
    }
    
    try {
        const connectionString = process.env.DATABASE_URL;
        console.log('[DB] Creating connection pool with connectionString from process.env.DATABASE_URL');
        
        pool = new Pool({
            connectionString: connectionString,
            ssl: useSSL ? { rejectUnauthorized: false } : false,
            max: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });
        
        // Test connection
        console.log('[DB] Testing database connection...');
        const testResult = await pool.query('SELECT NOW() as current_time');
        console.log('[DB] Connection test successful. Server time:', testResult.rows[0].current_time);
        
        if (isRailwayInternal) {
            console.log('[DB] ✅ Connected to PostgreSQL via Railway (internal)');
        } else {
            console.log('[DB] ✅ Connected to PostgreSQL successfully');
        }
        
        // Create tables
        console.log('[DB] Starting table auto-creation...');
        await createTables();
        console.log('[DB] Table auto-creation completed');
        console.log('[DB] ========================================');
        
        return pool;
    } catch (error) {
        console.error('[DB] ========================================');
        console.error('[DB] Database initialization error:', error);
        console.error('[DB] Error message:', error.message);
        console.error('[DB] Error code:', error.code);
        console.error('[DB] Error stack:', error.stack);
        if (error.detail) {
            console.error('[DB] Error detail:', error.detail);
        }
        if (error.hint) {
            console.error('[DB] Error hint:', error.hint);
        }
        console.error('[DB] ========================================');
        pool = null;
        throw error;
    }
}

// Create all required tables
async function createTables() {
    if (!pool) {
        throw new Error('Database pool not initialized');
    }
    
    try {
        console.log('[DB] ========================================');
        console.log('[DB] Creating database tables (if they do not exist)...');
        console.log('[DB] Running auto-migration queries...');
        
        // Users table
        console.log('[DB] Creating table: users');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                hashed_password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'buyer',
                name VARCHAR(255),
                kyc_status VARCHAR(50) DEFAULT 'pending',
                verified BOOLEAN DEFAULT false,
                two_factor_enabled BOOLEAN DEFAULT false,
                two_factor_method VARCHAR(50),
                two_factor_secret VARCHAR(255),
                backup_codes TEXT[],
                has_wallet BOOLEAN DEFAULT false,
                wallet_address VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata JSONB
            )
        `);
        console.log('[DB] ✅ Table "users" created or already exists');
        
        // Contracts table
        console.log('[DB] Creating table: contracts');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS contracts (
                id VARCHAR(255) PRIMARY KEY,
                product VARCHAR(255) NOT NULL,
                quantity DECIMAL(15, 2) NOT NULL,
                unit VARCHAR(50) NOT NULL,
                price_per_unit DECIMAL(15, 2) NOT NULL,
                total_value DECIMAL(15, 2) NOT NULL,
                currency VARCHAR(10) DEFAULT 'TGT',
                buyer_email VARCHAR(255) NOT NULL,
                supplier_email VARCHAR(255) NOT NULL,
                deposit_percent INTEGER DEFAULT 30,
                deposit_amount DECIMAL(15, 2),
                status VARCHAR(50) DEFAULT 'pending_supplier_confirmation',
                deposit_paid BOOLEAN DEFAULT false,
                deposit_paid_at TIMESTAMP,
                documents_uploaded BOOLEAN DEFAULT false,
                documents_uploaded_at TIMESTAMP,
                voyage_time INTEGER,
                payment_due_date TIMESTAMP,
                final_payment_released BOOLEAN DEFAULT false,
                completed_at TIMESTAMP,
                cancelled_at TIMESTAMP,
                cancelled_by VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata JSONB
            )
        `);
        console.log('[DB] ✅ Table "contracts" created or already exists');
        
        // KYC table
        console.log('[DB] Creating table: kyc');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS kyc (
                id VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                company_type VARCHAR(50),
                status VARCHAR(50) DEFAULT 'pending',
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TIMESTAMP,
                reviewed_by VARCHAR(255),
                documents JSONB,
                ofac_screened BOOLEAN DEFAULT false,
                ofac_result JSONB,
                metadata JSONB
            )
        `);
        console.log('[DB] ✅ Table "kyc" created or already exists');
        
        // Wallets table
        console.log('[DB] Creating table: wallets');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS wallets (
                id VARCHAR(255) PRIMARY KEY,
                user_email VARCHAR(255),
                address VARCHAR(255) NOT NULL,
                type VARCHAR(50) DEFAULT 'Manual',
                tgt_balance DECIMAL(15, 2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata JSONB
            )
        `);
        console.log('[DB] ✅ Table "wallets" created or already exists');
        
        // Transactions table
        console.log('[DB] Creating table: transactions');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id VARCHAR(255) PRIMARY KEY,
                contract_id VARCHAR(255),
                type VARCHAR(50) NOT NULL,
                amount DECIMAL(15, 2) NOT NULL,
                currency VARCHAR(10) DEFAULT 'TGT',
                from_email VARCHAR(255),
                to_email VARCHAR(255),
                status VARCHAR(50) DEFAULT 'pending',
                blockchain BOOLEAN DEFAULT false,
                blockchain_tx_hash VARCHAR(255),
                blockchain_status VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata JSONB
            )
        `);
        console.log('[DB] ✅ Table "transactions" created or already exists');
        
        // Documents table
        console.log('[DB] Creating table: documents');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS documents (
                id VARCHAR(255) PRIMARY KEY,
                contract_id VARCHAR(255) NOT NULL,
                type VARCHAR(50) DEFAULT 'shipping_document',
                filename VARCHAR(255) NOT NULL,
                original_name VARCHAR(255) NOT NULL,
                path VARCHAR(500) NOT NULL,
                size BIGINT,
                mimetype VARCHAR(100),
                uploaded_by VARCHAR(255) NOT NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                signatures TEXT[],
                qr_code_scanned BOOLEAN DEFAULT false,
                qr_code_data TEXT,
                metadata JSONB
            )
        `);
        console.log('[DB] ✅ Table "documents" created or already exists');
        
        // Auctions table
        console.log('[DB] Creating table: auctions');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS auctions (
                id VARCHAR(255) PRIMARY KEY,
                contract_id VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'active',
                minimum_bid DECIMAL(15, 2) NOT NULL,
                current_bid DECIMAL(15, 2),
                current_bidder VARCHAR(255),
                end_time TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                bids JSONB,
                metadata JSONB
            )
        `);
        console.log('[DB] ✅ Table "auctions" created or already exists');
        
        // Audit logs table
        console.log('[DB] Creating table: audit_logs');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id VARCHAR(255) PRIMARY KEY,
                action VARCHAR(100) NOT NULL,
                user_id VARCHAR(255),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                details JSONB,
                ip_address VARCHAR(50),
                user_agent TEXT
            )
        `);
        console.log('[DB] ✅ Table "audit_logs" created or already exists');
        
        // Create indexes for performance
        console.log('[DB] Creating indexes...');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_contracts_buyer ON contracts(buyer_email)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_contracts_supplier ON contracts(supplier_email)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_kyc_user ON kyc(user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_wallets_email ON wallets(user_email)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_contract ON transactions(contract_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_documents_contract ON documents(contract_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_auctions_contract ON auctions(contract_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)');
        console.log('[DB] ✅ All indexes created or already exist');
        
        console.log('[DB] ========================================');
        console.log('[DB] ✅ AUTO-MIGRATION COMPLETE');
        console.log('[DB] All tables created or already exist:');
        console.log('[DB]   - users');
        console.log('[DB]   - contracts');
        console.log('[DB]   - kyc');
        console.log('[DB]   - wallets');
        console.log('[DB]   - transactions');
        console.log('[DB]   - documents');
        console.log('[DB]   - auctions');
        console.log('[DB]   - audit_logs');
        console.log('[DB] ========================================');
    } catch (error) {
        console.error('[DB] Error creating tables:', error.message);
        throw error;
    }
}

// Get database pool
async function getPool() {
    if (!pool) {
        await initDatabase();
    }
    return pool;
}

// Execute query helper
async function query(text, params) {
    const dbPool = await getPool();
    if (!dbPool) {
        throw new Error('Database not initialized');
    }
    return await dbPool.query(text, params);
}

// ============================================
// USER OPERATIONS
// ============================================
const users = {
    // Get user by email
    async get(email) {
        const result = await query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return null;
        return this._mapRowToUser(result.rows[0]);
    },
    
    // Set (create or update) user
    async set(email, userData) {
        const existing = await this.get(email);
        
        if (existing) {
            // Update existing user
            const result = await query(`
                UPDATE users SET
                    hashed_password = COALESCE($1, hashed_password),
                    role = COALESCE($2, role),
                    name = COALESCE($3, name),
                    kyc_status = COALESCE($4, kyc_status),
                    verified = COALESCE($5, verified),
                    two_factor_enabled = COALESCE($6, two_factor_enabled),
                    two_factor_method = COALESCE($7, two_factor_method),
                    two_factor_secret = COALESCE($8, two_factor_secret),
                    backup_codes = COALESCE($9, backup_codes),
                    has_wallet = COALESCE($10, has_wallet),
                    wallet_address = COALESCE($11, wallet_address),
                    metadata = COALESCE($12, metadata),
                    updated_at = CURRENT_TIMESTAMP
                WHERE email = $13
                RETURNING *
            `, [
                userData.password || userData.hashedPassword,
                userData.role,
                userData.name,
                userData.kycStatus,
                userData.verified,
                userData.twoFactorEnabled,
                userData.twoFactorMethod,
                userData.twoFactorSecret,
                userData.backupCodes,
                userData.hasWallet,
                userData.walletAddress,
                userData.metadata ? JSON.stringify(userData.metadata) : null,
                email
            ]);
            return this._mapRowToUser(result.rows[0]);
        } else {
            // Create new user
            const result = await query(`
                INSERT INTO users (email, hashed_password, role, name, kyc_status, verified, 
                    two_factor_enabled, two_factor_method, two_factor_secret, backup_codes,
                    has_wallet, wallet_address, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *
            `, [
                email,
                userData.password || userData.hashedPassword,
                userData.role || 'buyer',
                userData.name,
                userData.kycStatus || 'pending',
                userData.verified || false,
                userData.twoFactorEnabled || false,
                userData.twoFactorMethod,
                userData.twoFactorSecret,
                userData.backupCodes,
                userData.hasWallet || false,
                userData.walletAddress,
                userData.metadata ? JSON.stringify(userData.metadata) : null
            ]);
            return this._mapRowToUser(result.rows[0]);
        }
    },
    
    // Check if user exists
    async has(email) {
        const result = await query('SELECT 1 FROM users WHERE email = $1', [email]);
        return result.rows.length > 0;
    },
    
    // Delete user
    async delete(email) {
        await query('DELETE FROM users WHERE email = $1', [email]);
    },
    
    // Get all users (for admin)
    async getAll() {
        const result = await query('SELECT * FROM users ORDER BY created_at DESC');
        return result.rows.map(row => this._mapRowToUser(row));
    },
    
    // Map database row to user object (matches Map structure)
    _mapRowToUser(row) {
        return {
            id: row.id.toString(),
            email: row.email,
            password: row.hashed_password, // Keep 'password' for compatibility
            hashedPassword: row.hashed_password,
            role: row.role,
            name: row.name,
            kycStatus: row.kyc_status,
            verified: row.verified,
            twoFactorEnabled: row.two_factor_enabled,
            twoFactorMethod: row.two_factor_method,
            twoFactorSecret: row.two_factor_secret,
            backupCodes: row.backup_codes || [],
            hasWallet: row.has_wallet,
            walletAddress: row.wallet_address,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            ...(row.metadata || {})
        };
    }
};

module.exports = {
    initDatabase,
    getPool,
    query,
    createTables,
    users
};

