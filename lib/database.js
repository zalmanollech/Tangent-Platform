// Database connection and query utilities for Traidefi
const { Pool } = require('pg');
require('dotenv').config({ path: './config.env' });

let pool = null;

// Initialize database pool and create tables
async function initDatabase() {
    if (pool) {
        console.log('[INFO] Database pool already exists, reusing...');
        return pool;
    }
    
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
        console.warn('[WARN] DATABASE_URL not configured, database features disabled');
        return null;
    }
    
    console.log('[INFO] Initializing database connection...');
    console.log('[INFO] DATABASE_URL: ' + databaseUrl.replace(/:[^:@]+@/, ':****@')); // Hide password
    
    try {
        pool = new Pool({
            connectionString: databaseUrl,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
            max: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000, // Increased from 2000ms to 10000ms for Supabase
        });
        
        // Test connection with timeout
        console.log('[INFO] Testing database connection...');
        try {
            // Use Promise.race to add a timeout wrapper
            const testQuery = pool.query('SELECT NOW()');
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Connection timeout after 15 seconds')), 15000)
            );
            
            await Promise.race([testQuery, timeoutPromise]);
            console.log('[INFO] Database connected successfully');
        } catch (testError) {
            console.error('[ERROR] Database connection test failed:', testError.message);
            console.error('[ERROR] Connection error details:', {
                code: testError.code,
                errno: testError.errno,
                syscall: testError.syscall,
                address: testError.address,
                port: testError.port,
                stack: testError.stack
            });
            pool.end().catch(() => {}); // Clean up pool
            pool = null;
            throw new Error(`Database connection failed: ${testError.message}. Check your credentials and network connection.`);
        }
        
        // Create tables automatically
        await createTables();
        
        return pool;
    } catch (error) {
        console.error('[ERROR] Database initialization error:', error.message);
        console.error('[ERROR] Full error:', error);
        pool = null;
        throw error; // Re-throw to get better error messages
    }
}

// Create database tables
async function createTables() {
    try {
        const client = pool;
        
        // Users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                verified_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Purchases table
        await client.query(`
            CREATE TABLE IF NOT EXISTS purchases (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                brand VARCHAR(50) DEFAULT 'traidefi',
                product VARCHAR(50) NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                currency VARCHAR(10) DEFAULT 'USD',
                status VARCHAR(50) DEFAULT 'pending',
                paypal_order_id VARCHAR(255),
                paypal_payer_id VARCHAR(255),
                form_data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Credit Reports table
        await client.query(`
            CREATE TABLE IF NOT EXISTS credit_reports (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                purchase_id INTEGER REFERENCES purchases(id),
                brand VARCHAR(50) DEFAULT 'traidefi',
                input_json JSONB NOT NULL,
                score INTEGER,
                factors JSONB,
                risk_notes TEXT,
                pdf_url VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Premium Quotes table
        await client.query(`
            CREATE TABLE IF NOT EXISTS premium_quotes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                purchase_id INTEGER REFERENCES purchases(id),
                brand VARCHAR(50) DEFAULT 'traidefi',
                input_json JSONB NOT NULL,
                premium_min DECIMAL(5, 2),
                premium_max DECIMAL(5, 2),
                assumptions_json JSONB,
                pdf_url VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create indexes
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_purchases_paypal_order_id ON purchases(paypal_order_id)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_optiocredit_reports_user_id ON credit_reports(user_id)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_credit_reports_purchase_id ON credit_reports(purchase_id)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_premium_quotes_user_id ON premium_quotes(user_id)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_premium_quotes_purchase_id ON premium_quotes(purchase_id)
        `);
        
        // Create updated_at trigger function
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        `);
        
        // Apply triggers
        await client.query(`
            DROP TRIGGER IF EXISTS update_users_updated_at ON users;
            CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
        `);
        
        await client.query(`
            DROP TRIGGER IF EXISTS update_purchases_updated_at ON purchases;
            CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON purchases
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
        `);
        
        console.log('[INFO] Database tables created successfully');
    } catch (error) {
        // If tables already exist, that's fine
        if (error.message && error.message.includes('already exists')) {
            console.log('[INFO] Database tables already exist');
        } else {
            console.error('[ERROR] Error creating database tables:', error.message);
        }
    }
}

// Get database pool (initializes if needed)
async function getPool() {
    if (!pool) {
        console.log('[INFO] Pool not initialized, calling initDatabase...');
        await initDatabase();
    }
    return pool;
}

// Execute query helper
async function query(text, params) {
    try {
        // Ensure pool is initialized
        let dbPool = await getPool();
        if (!dbPool) {
            // Try to initialize if pool is null
            console.log('[INFO] Pool is null, attempting to initialize database...');
            try {
                dbPool = await initDatabase();
                if (!dbPool) {
                    const dbUrl = process.env.DATABASE_URL;
                    throw new Error(`Database initialization returned null. DATABASE_URL: ${dbUrl ? 'Set but connection failed' : 'Not set'}`);
                }
            } catch (initError) {
                console.error('[ERROR] Failed to initialize database:', initError.message);
                throw initError;
            }
        }
        
        const result = await dbPool.query(text, params);
        return result;
    } catch (error) {
        console.error('[ERROR] Database query error:', error.message);
        console.error('[ERROR] Stack:', error.stack);
        throw error;
    }
}

// User operations
const users = {
    async create(email, passwordHash) {
        const result = await query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *',
            [email, passwordHash]
        );
        return result.rows[0];
    },
    
    async findByEmail(email) {
        const result = await query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0] || null;
    },
    
    async findById(id) {
        const result = await query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0] || null;
    },
    
    async verify(id) {
        await query('UPDATE users SET verified_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    }
};

// Purchase operations
const purchases = {
    async create(data) {
        const {
            userId,
            brand = 'traidefi',
            product,
            amount,
            currency = 'USD',
            status = 'pending',
            paypalOrderId,
            paypalPayerId,
            formData
        } = data;
        
        const result = await query(
            `INSERT INTO purchases (user_id, brand, product, amount, currency, status, paypal_order_id, paypal_payer_id, form_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [userId, brand, product, amount, currency, status, paypalOrderId, paypalPayerId, JSON.stringify(formData)]
        );
        return result.rows[0];
    },
    
    async updateStatus(id, status) {
        await query('UPDATE purchases SET status = $1 WHERE id = $2', [status, id]);
    },
    
    async findByPaypalOrderId(orderId) {
        const result = await query('SELECT * FROM purchases WHERE paypal_order_id = $1', [orderId]);
        return result.rows[0] || null;
    },
    
    async findByUserId(userId) {
        const result = await query('SELECT * FROM purchases WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return result.rows;
    }
};

// Credit Report operations
const creditReports = {
    async create(data) {
        const {
            userId,
            purchaseId,
            brand = 'traidefi',
            inputJson,
            score,
            factors,
            riskNotes,
            pdfUrl
        } = data;
        
        const result = await query(
            `INSERT INTO credit_reports (user_id, purchase_id, brand, input_json, score, factors, risk_notes, pdf_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [userId, purchaseId, brand, JSON.stringify(inputJson), score, JSON.stringify(factors), riskNotes, pdfUrl]
        );
        return result.rows[0];
    },
    
    async findByUserId(userId) {
        const result = await query(
            'SELECT * FROM credit_reports WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        return result.rows;
    },
    
    async findById(id) {
        const result = await query('SELECT * FROM credit_reports WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
};

// Premium Quote operations
const premiumQuotes = {
    async create(data) {
        const {
            userId,
            purchaseId,
            brand = 'traidefi',
            inputJson,
            premiumMin,
            premiumMax,
            assumptionsJson,
            pdfUrl
        } = data;
        
        const result = await query(
            `INSERT INTO premium_quotes (user_id, purchase_id, brand, input_json, premium_min, premium_max, assumptions_json, pdf_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [userId, purchaseId, brand, JSON.stringify(inputJson), premiumMin, premiumMax, JSON.stringify(assumptionsJson), pdfUrl]
        );
        return result.rows[0];
    },
    
    async findByUserId(userId) {
        const result = await query(
            'SELECT * FROM premium_quotes WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        return result.rows;
    },
    
    async findById(id) {
        const result = await query('SELECT * FROM premium_quotes WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
};

module.exports = {
    initDatabase,
    getPool,
    query,
    users,
    purchases,
    creditReports,
    premiumQuotes
};

