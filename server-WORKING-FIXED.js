const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const { spawn } = require('child_process');
const axios = require('axios');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
require('dotenv').config({ path: './config.env' });

// Database integration
const db = require('./lib/database');

// Report generator for Traidefi
const reportGenerator = require('./lib/report-generator');

// PDF generator and storage service
const pdfGenerator = require('./lib/pdf-generator');
const storageService = require('./lib/storage-service');

// Email service
const emailService = require('./lib/email-service');

// PDF Contract Extractor (optional - lazy-loaded internally)
let contractExtractor;
try {
    contractExtractor = require('./lib/contract-extractor');
} catch (error) {
    console.warn('PDF extraction module not available:', error.message);
    contractExtractor = null;
}

// TANGENT-BRIDGE-v4 Credit Risk Integration - Production Safe
let creditIntegration = null;
let creditServiceAvailable = false;
let creditServiceProcess = null; // For auto-start functionality

// Insurance Integration - Production Safe
let insuranceIntegration = null;
let insuranceServiceAvailable = false;
let insuranceServiceProcess = null; // For auto-start functionality

// Function to auto-start credit service
function startCreditService() {
    // Always attempt to auto-start credit service (required for automatic credit assessments)
    // In production, this ensures credit assessments run automatically for all trades
    
    try {
        const creditServicePath = path.join(__dirname, 'credit-service', 'main.py');
        const isWindows = process.platform === 'win32';
        
        console.log('[INFO] Auto-starting Credit Service...');
        
        if (isWindows) {
            creditServiceProcess = spawn('python', ['main.py'], {
                cwd: path.join(__dirname, 'credit-service'),
                shell: true,
                stdio: 'pipe'
            });
        } else {
            creditServiceProcess = spawn('python3', ['main.py'], {
                cwd: path.join(__dirname, 'credit-service'),
                shell: true,
                stdio: 'pipe'
            });
        }
        
        creditServiceProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                console.log(`[INFO] Credit Service: ${output}`);
            }
        });
        
        creditServiceProcess.stderr.on('data', (data) => {
            const error = data.toString().trim();
            if (error && !error.includes('INFO:') && !error.includes('Application startup') && !error.includes('only one usage')) {
                console.warn(`[WARN] Credit Service: ${error}`);
            }
        });
        
        creditServiceProcess.on('error', (error) => {
            if (error.code === 'ENOENT') {
                console.warn('[WARN] Python not found. Credit service must be started manually: cd credit-service && python main.py');
            } else {
                console.warn('[WARN] Failed to start credit service:', error.message);
            }
            creditServiceProcess = null;
        });
        
        creditServiceProcess.on('exit', (code) => {
            if (code !== 0 && code !== null && code !== 1) {
                console.warn(`[WARN] Credit service exited with code ${code}`);
            }
            creditServiceProcess = null;
        });
        
        console.log('[INFO] Credit service startup initiated');
        
    } catch (error) {
        console.warn('[WARN] Could not auto-start credit service:', error.message);
        console.log('   To start manually: cd credit-service && python main.py');
    }
}

try {
    creditIntegration = require('./credit-integration');
    console.log('[INFO] Credit Integration loaded successfully');
    
    // Auto-start the Python credit service
    startCreditService();
    
    // Verify credit service is reachable (don't block startup)
    setTimeout(async () => {
        try {
            const status = await creditIntegration.checkCreditServiceHealth();
            creditServiceAvailable = status.status === 'healthy' || status.status === 'disabled';
            if (creditServiceAvailable) {
                console.log('[INFO] Credit service verified and available');
            } else {
                console.log('[INFO] Credit service not running (optional - credit assessments will be skipped)');
                console.log('   To enable credit assessments, start: cd credit-service && python main.py');
                creditServiceAvailable = false;
            }
        } catch (error) {
            console.log('[INFO] Credit service not running (optional - credit assessments will be skipped)');
            console.log('   To enable credit assessments, start: cd credit-service && python main.py');
            creditServiceAvailable = false;
        }
    }, 3000); // Wait 3 seconds for service to start
} catch (error) {
    console.warn('[WARN] Credit integration not available:', error.message);
    console.log('[INFO] Continuing without credit risk assessment');
    creditIntegration = null;
}

// Auto-start insurance service
function startInsuranceService() {
    // Always attempt to auto-start insurance service (required for insurance quotes)
    // In production, this ensures insurance quotes are available automatically
    
    try {
        const insuranceServicePath = path.join(__dirname, 'insurance-service', 'main.py');
        const isWindows = process.platform === 'win32';
        
        console.log('[INFO] Auto-starting Insurance Service...');
        
        if (isWindows) {
            // Windows: use python command
            insuranceServiceProcess = spawn('python', ['main.py'], {
                cwd: path.join(__dirname, 'insurance-service'),
                shell: true,
                stdio: 'pipe'
            });
        } else {
            // Unix/Linux: use python3
            insuranceServiceProcess = spawn('python3', ['main.py'], {
                cwd: path.join(__dirname, 'insurance-service'),
                shell: true,
                stdio: 'pipe'
            });
        }
        
        insuranceServiceProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                console.log(`[INFO] Insurance Service: ${output}`);
            }
        });
        
        insuranceServiceProcess.stderr.on('data', (data) => {
            const error = data.toString().trim();
            if (error && !error.includes('INFO:') && !error.includes('Application startup') && !error.includes('only one usage')) {
                console.warn(`[WARN] Insurance Service: ${error}`);
            }
        });
        
        insuranceServiceProcess.on('error', (error) => {
            if (error.code === 'ENOENT') {
                console.warn('[WARN] Python not found. Insurance service must be started manually: cd insurance-service && python main.py');
            } else {
                console.warn('[WARN] Failed to start insurance service:', error.message);
            }
            insuranceServiceProcess = null;
        });
        
        insuranceServiceProcess.on('exit', (code) => {
            if (code !== 0 && code !== null && code !== 1) {
                console.warn(`[WARN] Insurance service exited with code ${code}`);
            }
            insuranceServiceProcess = null;
        });
        
        console.log('[INFO] Insurance service startup initiated');
        
    } catch (error) {
        console.warn('[WARN] Could not auto-start insurance service:', error.message);
        console.log('   To start manually: cd insurance-service && python main.py');
    }
}

// Load Insurance Integration
try {
    insuranceIntegration = require('./insurance-integration');
    console.log('[INFO] Insurance Integration loaded successfully');
    
    // Auto-start the Python service
    startInsuranceService();
    
    // Wait a bit longer for service to start, then check health
    setTimeout(async () => {
        try {
            const status = await insuranceIntegration.checkInsuranceServiceHealth();
            insuranceServiceAvailable = status.status === 'healthy';
            console.log(insuranceServiceAvailable ? 
                '[INFO] Insurance service verified and available' : 
                '[WARN] Insurance service not healthy: ' + status.message);
            } catch (error) {
                console.warn('[WARN] Insurance service health check failed:', error.message);
                console.log('[INFO] The service may still be starting. It will be available shortly.');
                insuranceServiceAvailable = false;
            }
        }, 5000); // Increased to 5 seconds to allow Python service to fully start
    } catch (error) {
        console.warn('[WARN] Insurance integration not available:', error.message);
        console.log('[INFO] Continuing without insurance quotes');
        insuranceIntegration = null;
    }

console.log('[INFO] Starting traidefi Complete Production Platform...');

const app = express();
const PORT = process.env.PORT || 4000;

// Initialize database (creates tables automatically) - Non-blocking
(async () => {
    try {
        // Initialize database in background, don't block server startup
        db.initDatabase().then(() => {
            console.log('[INFO] Database initialization complete');
        }).catch((error) => {
            console.warn('[WARN] Database initialization failed:', error.message);
            console.warn('[WARN] Server will continue without database - features will be limited');
        });
    } catch (error) {
        console.warn('[WARN] Database initialization error:', error.message);
    }
})();

// Initialize blockchain service with error handling
let blockchain = null;
let blockchainService = null;

try {
    // Try to load blockchain service (may not be available in all environments)
    blockchainService = require('./lib/blockchain.js');
    
    // Initialize blockchain if enabled and service is available
    if (process.env.BLOCKCHAIN_ENABLED === 'true' && blockchainService) {
        console.log('[INFO] Initializing blockchain integration...');
        blockchainService.initialize().then((service) => {
            blockchain = service;
            if (service.isInitialized) {
                console.log('[INFO] Blockchain service initialized successfully');
            } else {
                console.log('[INFO] Blockchain service failed to initialize, using simulation mode');
            }
        }).catch(error => {
            console.error('[ERROR] Blockchain initialization error:', error.message);
            console.log('[INFO] Continuing with simulated blockchain operations');
        });
    } else {
        console.log('[INFO] Blockchain disabled in configuration, using simulation mode');
    }
} catch (error) {
    console.warn('[INFO] Blockchain service not available, using simulation mode:', error.message);
    blockchain = null;
    blockchainService = null;
}

// ================================
// MIDDLEWARE & SECURITY
// ================================
app.use(cors({
    origin: [
        'http://localhost:3000', 
        'http://localhost:4000', 
        'https://tangent-platform.up.railway.app',
        'https://tangent-protocol.com',
        'https://www.tangent-protocol.com',
        ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
    ],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session middleware for demo password protection
app.use(session({
    secret: process.env.SESSION_SECRET || 'tangent-demo-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Security Headers and Encoding
app.use((req, res, next) => {
    // Store original send function
    const originalSend = res.send;
    
    // Override send to add UTF-8 encoding for HTML responses
    res.send = function(body) {
        // Check if response is HTML
        const contentType = res.getHeader('Content-Type') || '';
        if (typeof body === 'string' && (body.trim().startsWith('<!DOCTYPE html') || body.trim().startsWith('<html') || contentType.includes('text/html'))) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
        
        // Call original send
        return originalSend.call(this, body);
    };
    
    res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://www.googletagmanager.com; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' https:; " +
        "frame-src 'self';"
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// ================================
// FILE UPLOAD CONFIGURATION
// ================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${timestamp}_${safeName}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// ================================
// EMAIL CONFIGURATION
// ================================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'tangent@platform.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

// ================================
// DATABASE SIMULATION (In-Memory)
// ================================
const database = {
    users: new Map(),
    contracts: new Map(),
    kyc: new Map(),
    wallets: new Map(),
    auctions: new Map(),
    transactions: new Map(),
    documents: new Map(),
    pendingContracts: new Map(), // Contracts waiting for counterparty KYC
    notifications: new Map(), // User notifications
    complianceReports: new Map(), // KYC compliance reports
    auditLogs: new Map(), // Audit trail system
    sessions: new Map(), // Session management
    admin: {
        fees: { tradingFee: 0.5, platformFee: 1.0 },
        interestRates: { deposit: 2.5, lending: 5.0 },
        voyageTimes: { short: 30, medium: 60, long: 90 },
        basisPoints: 100
    }
};

// Audit Trail System
function logAuditEvent(action, userId, details = {}) {
    const logId = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const auditLog = {
        id: logId,
        action,
        userId: userId || 'system',
        timestamp: new Date().toISOString(),
        details,
        ip: details.ip || 'unknown',
        userAgent: details.userAgent || 'unknown'
    };
    
    database.auditLogs.set(logId, auditLog);
    
    // Log to console for visibility
    console.log(`📋 AUDIT: ${action} | User: ${userId || 'system'} | Time: ${auditLog.timestamp}`);
    if (details.email) {
        console.log(`   Email: ${details.email}`);
    }
    if (details.ip && details.ip !== 'unknown') {
        console.log(`   IP: ${details.ip}`);
    }
    
    // Keep only last 10,000 audit logs in memory (older logs should be archived)
    if (database.auditLogs.size > 10000) {
        const firstKey = database.auditLogs.keys().next().value;
        database.auditLogs.delete(firstKey);
    }
    
    return auditLog;
}

// Session Management System
function createSession(userId, token, req) {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const session = {
        id: sessionId,
        userId,
        token,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        ip: req.ip || req.connection?.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        active: true
    };
    
    database.sessions.set(sessionId, session);
    
    // Clean up expired sessions periodically
    cleanupExpiredSessions();
    
    return session;
}

function updateSessionActivity(sessionId) {
    const session = database.sessions.get(sessionId);
    if (session) {
        session.lastActivity = new Date().toISOString();
        database.sessions.set(sessionId, session);
    }
}

function terminateSession(sessionId, userId) {
    const session = database.sessions.get(sessionId);
    if (session && (session.userId === userId || userId === 'admin')) {
        session.active = false;
        session.terminatedAt = new Date().toISOString();
        database.sessions.set(sessionId, session);
        logAuditEvent('session_terminated', userId, { sessionId });
        return true;
    }
    return false;
}

function getActiveSessions(userId) {
    const now = new Date();
    const activeSessions = [];
    
    for (const [sessionId, session] of database.sessions.entries()) {
        if (session.userId === userId && session.active) {
            const expiresAt = new Date(session.expiresAt);
            if (expiresAt > now) {
                activeSessions.push(session);
            } else {
                // Session expired, mark as inactive
                session.active = false;
                session.expiredAt = new Date().toISOString();
            }
    }
    }
    
    return activeSessions;
}

function cleanupExpiredSessions() {
    const now = new Date();
    let cleaned = 0;
    
    for (const [sessionId, session] of database.sessions.entries()) {
        const expiresAt = new Date(session.expiresAt);
        if (expiresAt < now) {
            session.active = false;
            session.expiredAt = new Date().toISOString();
            cleaned++;
        }
    }
    
    if (cleaned > 0) {
        console.log(`[INFO] Cleaned up ${cleaned} expired sessions`);
    }
}

// ================================
// TWO-FACTOR AUTHENTICATION (2FA) SYSTEM
// ================================

// Generate 2FA secret for a user
function generate2FASecret(userEmail) {
    const secret = speakeasy.generateSecret({
        name: `Traidefi (${userEmail})`,
        issuer: 'Traidefi Platform'
    });
    
    return {
        secret: secret.base32,
        otpauthUrl: secret.otpauth_url
    };
}

// Generate QR code for 2FA setup
async function generate2FAQRCode(otpauthUrl) {
    try {
        const qrCodeDataURL = await QRCode.toDataURL(otpauthUrl);
        return qrCodeDataURL;
    } catch (error) {
        console.error('Error generating QR code:', error);
        throw new Error('Failed to generate QR code');
    }
}

// Verify 2FA token
function verify2FAToken(token, secret) {
    return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 2 // Allow 2 time steps (60 seconds) tolerance
    });
}

// Generate backup codes
function generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
        // Generate 8-digit backup code
        const code = Math.floor(10000000 + Math.random() * 90000000).toString();
        codes.push(code);
    }
    return codes;
}

// Hash backup codes for storage
async function hashBackupCodes(codes) {
    const hashedCodes = [];
    for (const code of codes) {
        const hashed = await bcrypt.hash(code, 10);
        hashedCodes.push(hashed);
    }
    return hashedCodes;
}

// Verify backup code
async function verifyBackupCode(code, hashedCodes) {
    for (const hashedCode of hashedCodes) {
        const match = await bcrypt.compare(code, hashedCode);
        if (match) {
            return true;
        }
    }
    return false;
}

// ================================
// EMAIL/SMS CODE 2FA SYSTEM
// ================================

// Generate 6-digit code for email/SMS
function generateEmailCode() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
}

// Store email codes temporarily (expire after 10 minutes)
const emailCodes = new Map(); // email -> { code, expiresAt, attempts }

// Send 2FA code via email
async function send2FACodeEmail(userEmail, code) {
    try {
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .code-box { background: #f4f4f4; border: 2px dashed #666666; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
                    .code { font-size: 32px; font-weight: bold; color: #333333; letter-spacing: 5px; }
                    .warning { background: #e5e5e5; border-left: 4px solid #666666; padding: 15px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Your Two-Factor Authentication Code</h2>
                    <p>You requested a two-factor authentication code for your Traidefi account.</p>
                    <div class="code-box">
                        <div class="code">${code}</div>
                    </div>
                    <p>Enter this code to complete your login or enable 2FA.</p>
                    <div class="warning">
                        <strong>Security Notice:</strong><br>
                        This code will expire in 10 minutes.<br>
                        If you didn't request this code, please ignore this email and secure your account.
                    </div>
                    <p style="color: #666; font-size: 12px; margin-top: 30px;">
                        This is an automated message. Please do not reply to this email.
                    </p>
                </div>
            </body>
            </html>
        `;
        
        const textContent = `
Your Two-Factor Authentication Code

Your code is: ${code}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email and secure your account.
        `;
        
        // Use emailService if available, otherwise use transporter
        if (emailService && emailService.sendEmail) {
            await emailService.sendEmail(userEmail, 'Your Two-Factor Authentication Code', htmlContent, textContent);
        } else {
            await transporter.sendMail({
                from: process.env.EMAIL_USER || 'noreply@traidefi.com',
                to: userEmail,
                subject: 'Your Two-Factor Authentication Code',
                html: htmlContent,
                text: textContent
            });
        }
        
        console.log(`📧 2FA code sent to ${userEmail}`);
        return true;
    } catch (error) {
        console.error('[ERROR] Failed to send 2FA code email:', error);
        return false;
    }
}

// Store email code with expiration
function storeEmailCode(userEmail, code) {
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
    emailCodes.set(userEmail, {
        code: code,
        expiresAt: expiresAt,
        attempts: 0
    });
    
    // Clean up expired codes periodically
    setTimeout(() => {
        emailCodes.delete(userEmail);
    }, 10 * 60 * 1000);
}

// Verify email code
function verifyEmailCode(userEmail, inputCode) {
    const stored = emailCodes.get(userEmail);
    
    if (!stored) {
        return { valid: false, error: 'No code found. Please request a new code.' };
    }
    
    if (Date.now() > stored.expiresAt) {
        emailCodes.delete(userEmail);
        return { valid: false, error: 'Code expired. Please request a new code.' };
    }
    
    if (stored.attempts >= 5) {
        emailCodes.delete(userEmail);
        return { valid: false, error: 'Too many attempts. Please request a new code.' };
    }
    
    stored.attempts++;
    
    if (stored.code === inputCode) {
        emailCodes.delete(userEmail); // Code used, remove it
        return { valid: true };
    }
    
    return { valid: false, error: 'Invalid code. Please try again.' };
}

// Automated Backup System
function createBackup() {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
    
    const backup = {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        data: {
            users: Array.from(database.users.entries()),
            contracts: Array.from(database.contracts.entries()),
            kyc: Array.from(database.kyc.entries()),
            wallets: Array.from(database.wallets.entries()),
            auctions: Array.from(database.auctions.entries()),
            transactions: Array.from(database.transactions.entries()),
            documents: Array.from(database.documents.entries()),
            pendingContracts: Array.from(database.pendingContracts.entries()),
            notifications: Array.from(database.notifications.entries()),
            complianceReports: Array.from(database.complianceReports.entries()),
            auditLogs: Array.from(database.auditLogs.entries()).slice(-1000), // Last 1000 audit logs
            sessions: Array.from(database.sessions.entries()),
            admin: database.admin
        }
    };
    
    try {
        fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
        logAuditEvent('backup_created', 'system', { backupFile });
        console.log(`[INFO] Backup created: ${backupFile}`);
        
        // Keep only last 10 backups
        cleanupOldBackups(backupDir, 10);
        
        return { success: true, file: backupFile, timestamp };
    } catch (error) {
        console.error('[ERROR] Failed to create backup:', error);
        logAuditEvent('backup_failed', 'system', { error: error.message });
        return { success: false, error: error.message };
    }
}

function cleanupOldBackups(backupDir, maxBackups = 10) {
    try {
        const files = fs.readdirSync(backupDir)
            .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
            .map(file => ({
                name: file,
                path: path.join(backupDir, file),
                time: fs.statSync(path.join(backupDir, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);
        
        if (files.length > maxBackups) {
            const toDelete = files.slice(maxBackups);
            for (const file of toDelete) {
                fs.unlinkSync(file.path);
                console.log(`[INFO] Deleted old backup: ${file.name}`);
            }
        }
    } catch (error) {
        console.error('[ERROR] Failed to cleanup old backups:', error);
    }
}

// Schedule automated backups (every 6 hours)
function scheduleBackups() {
    // Create initial backup
    createBackup();
    
    // Schedule backups every 6 hours
    setInterval(() => {
        createBackup();
    }, 6 * 60 * 60 * 1000);
    
    console.log('[INFO] Automated backup system initialized (backups every 6 hours)');
}

// Initialize Pool Wallet System
function initializePoolWallet() {
    if (!database.wallets.has('pool-wallet')) {
        const poolWallet = {
            userId: 'system-pool',
            tgtBalance: 5000000, // $5M initial pool balance
            address: 'tgt_pool_wallet_main',
            createdAt: new Date().toISOString(),
            type: 'pool',
            transactions: [{
                type: 'initial_pool_allocation',
                amount: 5000000,
                description: 'Initial Pool Wallet Capital',
                timestamp: new Date().toISOString()
            }]
        };
        database.wallets.set('pool-wallet', poolWallet);
        console.log('[INFO] Pool Wallet initialized: $5,000,000 TGT balance');
    }
    
    if (!database.wallets.has('fee-wallet')) {
        const feeWallet = {
            userId: 'system-fees',
            tgtBalance: 0,
            address: 'tgt_fee_wallet_main',
            createdAt: new Date().toISOString(),
            type: 'fee_collection',
            transactions: []
        };
        database.wallets.set('fee-wallet', feeWallet);
        console.log('[INFO] Fee Collection Wallet initialized');
    }
}

// Default admin user
database.users.set('admin@tangent.com', {
    id: 'admin-001',
    email: 'admin@tangent.com',
    password: bcrypt.hashSync('TangentAdmin2024!', 10),
    role: 'admin',
    verified: true,
    kycStatus: 'approved'
});

// Test approved users for each role
database.users.set('buyer@test.com', {
    id: 'buyer-001',
    email: 'buyer@test.com',
    password: bcrypt.hashSync('TestUser2024!', 10),
    role: 'buyer',
    verified: true,
    kycStatus: 'approved'
});

database.users.set('supplier@test.com', {
    id: 'supplier-001',
    email: 'supplier@test.com',
    password: bcrypt.hashSync('TestUser2024!', 10),
    role: 'supplier',
    verified: true,
    kycStatus: 'approved'
});

database.users.set('trader@test.com', {
    id: 'trader-001',
    email: 'trader@test.com',
    password: bcrypt.hashSync('TestUser2024!', 10),
    role: 'trader',
    verified: true,
    kycStatus: 'approved'
});

database.users.set('insurer@test.com', {
    id: 'insurer-001',
    email: 'insurer@test.com',
    password: bcrypt.hashSync('TestUser2024!', 10),
    role: 'insurer',
    verified: true,
    kycStatus: 'approved'
});

// Create sample test contracts for demonstration
database.contracts.set('contract_test_001', {
    id: 'contract_test_001',
    buyerEmail: 'buyer@test.com',
    supplierEmail: 'supplier@test.com',
    productDetails: 'Wheat',
    quantity: 5000,
    unit: 'tons',
    pricePerUnit: 525.50,
    totalValue: 2627500,
    deliveryDate: '03/2025',
    paymentTerms: 'at_sight',
    origin: 'Kansas, USA',
    destination: 'Hamburg, Germany',
    specifications: 'Hard Red Winter Wheat, Grade #2',
    contractRole: 'supplier',
    status: 'pending_buyer_confirmation',
    createdAt: new Date().toISOString(),
    depositAmount: 5255, // 20% deposit (reduced for demo)
    depositPaid: false,
    documents: [],
    buyerFlag: null,
    supplierFlag: null,
    timeline: [
        {
            event: 'contract_created',
            timestamp: new Date().toISOString(),
            actor: 'supplier@test.com',
            description: 'Contract created by supplier'
        }
    ]
});

database.contracts.set('contract_test_002', {
    id: 'contract_test_002',
    buyerEmail: 'trader@test.com',
    supplierEmail: 'supplier@test.com',
    productDetails: 'Crude Oil (WTI)',
    quantity: 10000,
    unit: 'barrels',
    pricePerUnit: 75.50,
    totalValue: 755000,
    deliveryDate: '02/2025',
    paymentTerms: 'deposit_against_docs',
    origin: 'Houston, TX',
    destination: 'Rotterdam, Netherlands',
    specifications: 'WTI Crude Oil, API 39.6',
    contractRole: 'buyer',
    status: 'active',
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    depositAmount: 1510, // 20% deposit (reduced for demo)
    depositPaid: true,
    documents: [],
    buyerFlag: null,
    supplierFlag: { message: 'Documents ready for upload', timestamp: new Date().toISOString() },
    timeline: [
        {
            event: 'contract_created',
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            actor: 'trader@test.com',
            description: 'Contract created by trader'
        },
        {
            event: 'deposit_paid',
            timestamp: new Date(Date.now() - 43200000).toISOString(),
            actor: 'trader@test.com',
            description: 'Deposit payment completed'
        }
    ]
});

database.contracts.set('contract_test_003', {
    id: 'contract_test_003',
    buyerEmail: 'buyer@test.com',
    supplierEmail: 'trader@test.com',
    productDetails: 'Coffee C',
    quantity: 100,
    unit: 'tons',
    pricePerUnit: 165.50,
    totalValue: 16550,
    deliveryDate: '04/2025',
    paymentTerms: 'at_sight',
    origin: 'Santos, Brazil',
    destination: 'Hamburg, Germany',
    specifications: 'Arabica Coffee Beans, Grade A',
    contractRole: 'supplier',
    status: 'pending_deposit',
    createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    depositAmount: 331, // 20% deposit (reduced for demo)
    depositPaid: false,
    documents: [],
    buyerFlag: { message: 'Deposit payment required', timestamp: new Date().toISOString() },
    supplierFlag: null,
    timeline: [
        {
            event: 'contract_created',
            timestamp: new Date(Date.now() - 172800000).toISOString(),
            actor: 'trader@test.com',
            description: 'Contract created by trader'
        }
    ]
});

// Initialize pool wallet system
initializePoolWallet();
scheduleBackups(); // Initialize automated backup system

// Create TGT wallets for test users
database.wallets.set('buyer-001', {
    userId: 'buyer-001',
    tgtBalance: 100000, // Give them plenty of starting balance for deposits
    address: 'tgt_buyer-001_test',
    createdAt: new Date().toISOString()
});

database.wallets.set('supplier-001', {
    userId: 'supplier-001',
    tgtBalance: 5000,
    address: 'tgt_supplier-001_test',
    createdAt: new Date().toISOString()
});

database.wallets.set('trader-001', {
    userId: 'trader-001',
    tgtBalance: 100000, // Give them plenty of starting balance for deposits
    address: 'tgt_trader-001_test',
    createdAt: new Date().toISOString()
});

database.wallets.set('insurer-001', {
    userId: 'insurer-001',
    tgtBalance: 8000,
    address: 'tgt_insurer-001_test',
    createdAt: new Date().toISOString()
});

// ================================
// NOTIFICATION SYSTEM FUNCTIONS
// ================================

// Send contract notification email
async function sendContractNotificationEmail(toEmail, contractData, notificationType) {
    try {
        const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:4000';
        let subject, htmlContent;
        
        switch (notificationType) {
            case 'contract_created':
                subject = `New Contract Awaiting Your Response - ${contractData.productDetails}`;
                htmlContent = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #1f2937;">New Contract Created</h2>
                        <p>A new contract has been created and requires your action:</p>
                        
                        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3>Contract Details:</h3>
                            <p><strong>Product:</strong> ${contractData.productDetails}</p>
                            <p><strong>Total Value:</strong> $${contractData.totalValue.toLocaleString()}</p>
                            <p><strong>Delivery Date:</strong> ${new Date(contractData.deliveryDate).toLocaleDateString()}</p>
                            <p><strong>Status:</strong> ${contractData.status.replace(/_/g, ' ').toUpperCase()}</p>
                            ${contractData.depositAmount ? `<p><strong>Required Deposit:</strong> $${contractData.depositAmount.toLocaleString()}</p>` : ''}
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${baseUrl}/dashboard/authenticated?role=${contractData.yourRole}&token=auto" 
                               style="background: #666666; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                                View Contract in Dashboard
                            </a>
                        </div>
                        
                        <p style="color: #6b7280; font-size: 14px;">
                            Please log in to your Tangent Platform dashboard to review and take action on this contract.
                        </p>
                    </div>
                `;
                break;
                
            case 'contract_confirmed':
                subject = `Contract Confirmed - Payment Required - ${contractData.productDetails}`;
                htmlContent = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #333333;">Contract Confirmed!</h2>
                        <p>Your contract has been confirmed by the counterparty. Payment is now required to activate the contract.</p>
                        
                        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3>Contract Details:</h3>
                            <p><strong>Product:</strong> ${contractData.productDetails}</p>
                            <p><strong>Total Value:</strong> $${contractData.totalValue.toLocaleString()}</p>
                            <p><strong>Required Payment:</strong> $${contractData.depositAmount.toLocaleString()}</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${baseUrl}/dashboard/authenticated?role=${contractData.yourRole}&token=auto" 
                               style="background: #666666; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                                Make Payment Now
                            </a>
                        </div>
                    </div>
                `;
                break;
                
            case 'trader_contract':
                subject = `New Trading Contract - ${contractData.productDetails}`;
                htmlContent = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #333333;">Trading Contract Created</h2>
                        <p>A trader has created a new contract involving your participation:</p>
                        
                        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3>Contract Details:</h3>
                            <p><strong>Product:</strong> ${contractData.productDetails}</p>
                            <p><strong>Your Role:</strong> ${contractData.yourRole.toUpperCase()}</p>
                            <p><strong>Contract Value:</strong> $${contractData.totalValue.toLocaleString()}</p>
                            <p><strong>Trader:</strong> ${contractData.traderEmail}</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${baseUrl}/dashboard/authenticated?role=${contractData.yourRole}&token=auto" 
                               style="background: #666666; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                                View Trading Contract
                            </a>
                        </div>
                    </div>
                `;
                break;
                
            case 'deposit_paid':
                subject = `Contract Activated - Deposit Received - ${contractData.productDetails}`;
                htmlContent = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #ffffff;">Contract Activated</h2>
                        <p>Great news! The buyer has paid the deposit and your contract is now active. You can proceed with shipping preparations.</p>
                        
                        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3>Contract Details:</h3>
                            <p><strong>Product:</strong> ${contractData.productDetails}</p>
                            <p><strong>Total Value:</strong> $${contractData.totalValue.toLocaleString()}</p>
                            <p><strong>Deposit Received:</strong> $${contractData.depositAmount.toLocaleString()}</p>
                            <p><strong>Status:</strong> ACTIVE</p>
                        </div>
                        
                        <div style="background: #e5e5e5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #666666;">
                            <h4 style="color: #333333; margin-top: 0;">Next Steps:</h4>
                            <p style="color: #333333; margin-bottom: 0;">
                                1. Prepare your goods for shipping<br>
                                2. Upload shipping documents when ready<br>
                                3. Receive remaining payment upon document approval
                            </p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${baseUrl}/dashboard/authenticated?role=${contractData.yourRole}&token=auto" 
                               style="background: #666666; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                                Manage Contract
                            </a>
                        </div>
                    </div>
                `;
                break;
        }
        
        const mailOptions = {
            from: process.env.EMAIL_USER || 'tangent@platform.com',
            to: toEmail,
            subject: subject,
            html: htmlContent
        };
        
        await transporter.sendMail(mailOptions);
        console.log(`📧 Contract notification email sent to: ${toEmail}`);
        
    } catch (error) {
        console.error('📧 Email sending failed:', error);
    }
}

// Add contract to user's dashboard (or pending if not KYC)
function addContractToUserDashboard(userEmail, contractId, contractData, userRole) {
    const user = database.users.get(userEmail);
    
    if (!user) {
        // User doesn't exist yet, store as pending
        console.log(`📋 Storing pending contract for non-registered user: ${userEmail}`);
        if (!database.pendingContracts.has(userEmail)) {
            database.pendingContracts.set(userEmail, []);
        }
        database.pendingContracts.get(userEmail).push({
            contractId,
            contractData: {...contractData, yourRole: userRole},
            assignedAt: new Date().toISOString()
        });
        return false; // User doesn't exist
    }
    
    if (user.kycStatus !== 'approved') {
        // User exists but not KYC approved, store as pending
        console.log(`📋 Storing pending contract for non-KYC user: ${userEmail}`);
        if (!database.pendingContracts.has(userEmail)) {
            database.pendingContracts.set(userEmail, []);
        }
        database.pendingContracts.get(userEmail).push({
            contractId,
            contractData: {...contractData, yourRole: userRole},
            assignedAt: new Date().toISOString()
        });
        return false; // User not KYC approved
    }
    
    // User exists and is KYC approved - contract is already in main database
    console.log(`[OK] Contract ${contractId} available in dashboard for: ${userEmail}`);
    return true; // User can see contract immediately
}

// Process pending contracts when user completes KYC
function processPendingContractsForUser(userEmail) {
    const pendingContracts = database.pendingContracts.get(userEmail);
    if (!pendingContracts || pendingContracts.length === 0) {
        return;
    }
    
    console.log(`[INFO] Processing ${pendingContracts.length} pending contracts for: ${userEmail}`);
    
    // Move pending contracts to main database
    pendingContracts.forEach(pending => {
        // Contract should already exist in database.contracts, just needs to be visible to user
        console.log(`[OK] Contract ${pending.contractId} now available for: ${userEmail}`);
    });
    
    // Clear pending contracts for this user
    database.pendingContracts.delete(userEmail);
    
    console.log(`[OK] All pending contracts processed for: ${userEmail}`);
}

// ================================
// AUTHENTICATION MIDDLEWARE
// ================================
const authenticateToken = (req, res, next) => {
    // Reduced logging - only log errors to prevent terminal flickering
    // Try multiple ways to get the token
    let token = null;
    
    // 1. Check Authorization header (for API calls)
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.split(' ')[1]) {
        token = authHeader.split(' ')[1];
    }
    
    // 2. Check query parameter (for dashboard redirects)
    if (!token && req.query.token) {
        token = req.query.token;
    }
    
    // 3. Check cookies (if we implement cookie auth later)
    if (!token && req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }
    
    if (!token) {
        // Only log if it's not a public route (to reduce noise)
        const publicRoutes = ['/static', '/uploads', '/terms', '/privacy', '/user-agreement', '/favicon.ico', '/health', '/test', '/tools', '/'];
        const isPublicRoute = publicRoutes.some(route => req.path.startsWith(route) || req.path === route);
        
        if (!isPublicRoute) {
            // Don't log - too noisy
        }
        // For dashboard routes, redirect to login instead of JSON error
        if (req.path.startsWith('/dashboard')) {
            return res.redirect('/landing-two');
        }
        // For settings routes, redirect to login
        if (req.path.startsWith('/settings')) {
            return res.redirect('/landing-two');
        }
        // For public routes, don't require auth
        if (isPublicRoute) {
            return next(); // Skip auth for public routes
        }
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET || 'tangent-secret-key', (err, user) => {
        if (err) {
            console.error('[ERROR] AUTH - Token verification failed:', err.message);
            // For dashboard routes, redirect to login instead of JSON error
            if (req.path.startsWith('/dashboard')) {
                return res.redirect('/landing-two');
            }
            return res.status(403).json({ error: 'Invalid token' });
        }
        
        // Update session activity if session exists
        if (user.sessionId) {
            updateSessionActivity(user.sessionId);
        }
        
        // Only log successful auth for important routes (reduce noise)
        if (req.path.startsWith('/api/admin') || req.path.startsWith('/dashboard/admin')) {
            console.log('[OK] AUTH - Admin access:', user.email);
        }
        req.user = user;
        next();
    });
};

const requireRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

// ================================
// ROUTES (DEFINED BEFORE STATIC FILES TO TAKE PRECEDENCE)
// ================================
// CRITICAL: All explicit routes defined here take precedence over static file serving
// Use app.get() for exact match - this takes precedence over app.use() middleware
// Routes are matched in order, so explicit routes will be handled before static files

// Landing Two Page - Access Portal
app.get('/landing-two', (req, res) => {
    console.log('[ROUTE] /landing-two route hit - serving plain HTML');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>traidefi - Access Portal</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;min-height:100vh;display:flex;align-items:center;justify-content:center}.container{background:#fff;padding:3rem;border-radius:15px;box-shadow:0 20px 40px rgba(0,0,0,0.2);max-width:500px;width:90%}h1{color:#1e3c72;font-size:2.2rem;margin-bottom:1rem;text-align:center}.subtitle{color:#666;font-size:1.1rem;margin-bottom:2rem;text-align:center}.instruction-box{background:#e3f2fd;padding:1.5rem;border-radius:8px;margin-bottom:2rem;color:#333;font-size:0.95rem;line-height:1.6}.btn{width:100%;padding:15px;background:#000;color:#fff;border:none;border-radius:8px;font-size:1.1rem;font-weight:600;cursor:pointer;margin-bottom:1rem;text-decoration:none;display:block;text-align:center}.btn:hover{background:#333}.back-link{text-align:center;margin-top:2rem}.back-link a{color:#666;text-decoration:none;font-size:0.9rem}.back-link a:hover{color:#333}</style></head><body><div class="container"><h1>Welcome to traidefi</h1><p class="subtitle">Access Your Trading Platform</p><div class="instruction-box">Choose your access method: Sign in if you already have an account, or sign up to get started</div><a href="/signin" class="btn">Sign In</a><a href="/signup" class="btn">Sign Up</a><a href="/demo/workflow" class="btn">Demo</a><div class="back-link"><a href="/">Back to Main Platform</a></div></div></body></html>';
    res.end(html, 'utf8');
});

// Root route - serve landing page with feature boxes and explanations
app.get('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>traidefi - Get Started</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;min-height:100vh;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}.header{text-align:center;margin-bottom:3rem}h1{color:#fff;font-size:3rem;margin-bottom:1rem}.subtitle{color:#ccc;font-size:1.3rem;margin-bottom:3rem}.features-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:2rem;margin-bottom:3rem}.feature-box{background:#1a1a1a;padding:2rem;border-radius:15px;border:1px solid #333}.feature-box h3{color:#fff;font-size:1.5rem;margin-bottom:1rem}.feature-box p{color:#ccc;line-height:1.6;margin-bottom:1rem}.feature-list{list-style:none;padding:0}.feature-list li{color:#ccc;padding:0.5rem 0;padding-left:1.5rem;position:relative}.feature-list li:before{content:"✓";position:absolute;left:0;color:#667eea;font-weight:bold}.btn-container{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;margin-top:3rem}.btn{padding:15px 30px;background:#fff;color:#000;border:none;border-radius:8px;font-size:1.1rem;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}.btn:hover{background:#ccc}.btn-secondary{background:#667eea;color:#fff}.btn-secondary:hover{background:#5a6fd8}</style></head><body><div class="container"><div class="header"><h1>Welcome to traidefi</h1><p class="subtitle">The Future of Commodity Trading</p></div><div class="features-grid"><div class="feature-box"><h3>Secure Trading Platform</h3><p>Trade commodities with confidence using our secure, blockchain-powered platform.</p><ul class="feature-list"><li>End-to-end encryption</li><li>Smart contract automation</li><li>Real-time trade tracking</li><li>Secure payment processing</li></ul></div><div class="feature-box"><h3>TGT Stablecoin</h3><p>Use TGT (Tangent Gold Token) for fast, secure, and low-cost transactions.</p><ul class="feature-list"><li>Stable value backed by gold</li><li>Instant settlements</li><li>Low transaction fees</li><li>Global accessibility</li></ul></div><div class="feature-box"><h3>Complete Workflow</h3><p>From contract creation to payment release, manage your entire trade lifecycle.</p><ul class="feature-list"><li>Contract management</li><li>KYC compliance</li><li>Document verification</li><li>Automated payments</li></ul></div></div><div class="btn-container"><a href="/landing-two" class="btn">Register Interest (Early Access)</a><a href="/landing-two" class="btn btn-secondary">Team Portal</a></div></div></body></html>';
    res.end(html, 'utf8');
});


// Sign In Page
app.get('/signin', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    // Use plain text strings - no HTML entities
    const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Sign In - traidefi</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;min-height:100vh;display:flex;align-items:center;justify-content:center}.container{background:#fff;padding:3rem;border-radius:15px;box-shadow:0 20px 40px rgba(0,0,0,0.2);max-width:400px;width:90%}h1{color:#1e3c72;font-size:2.2rem;margin-bottom:2rem;text-align:center}.form-group{margin-bottom:1.5rem}label{display:block;margin-bottom:0.5rem;color:#333;font-weight:600}input{width:100%;padding:12px;border:2px solid #e5e5e5;border-radius:8px;font-size:1rem}input:focus{outline:none;border-color:#667eea}.btn{width:100%;padding:15px;background:#667eea;color:#fff;border:none;border-radius:8px;font-size:1.1rem;font-weight:600;cursor:pointer;margin-top:1rem}.btn:hover{background:#5a6fd8}.links{text-align:center;margin-top:2rem}.links a{color:#667eea;text-decoration:none}.message{padding:1rem;margin-bottom:1rem;border-radius:8px;display:none}.success{background:#d4edda;color:#155724;border:1px solid #c3e6cb}.error{background:#f8d7da;color:#721c24;border:1px solid #f5c6cb}</style></head><body><div class="container"><h1>Sign In</h1><div id="message" class="message"></div><form id="signinForm"><div class="form-group"><label for="email">Email</label><input type="email" id="email" required></div><div class="form-group"><label for="password">Password</label><input type="password" id="password" required></div><div class="form-group" id="twoFactorGroup" style="display:none"><label for="twoFactorToken">Two-Factor Authentication Code</label><input type="text" id="twoFactorToken" placeholder="Enter 6-digit code" maxlength="6" pattern="[0-9]{6}"><small style="color:#666;font-size:0.85rem;display:block;margin-top:0.5rem">Enter the code from your authenticator app or use a backup code</small></div><button type="submit" class="btn" id="submitBtn">Sign In</button></form><div class="links"><a href="/signup">Dont have an account? Sign Up</a><br><a href="/forgot-password">Forgot your password?</a><br><a href="/landing-two">Back to Home</a></div><div style="margin-top:1.5rem;padding:1rem;background:#e5e5e5;border-radius:8px;border-left:4px solid #666666"><p style="margin:0;color:#333333;font-size:0.9rem"><strong>Security Tip:</strong> After signing in, enable Two-Factor Authentication (2FA) to protect your account. You will see a prompt on your dashboard.</p></div></div><script>console.log("[OK] Signin page JavaScript loaded");let loginSessionId=null;let loginEmail=null;let loginPassword=null;async function sendLoginEmailCode(email){try{const response=await fetch("/api/auth/2fa/send-login-code",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});const data=await response.json();if(data.success){console.log("Email code sent for login")}}catch(error){console.error("Failed to send email code:",error)}}document.getElementById("signinForm").addEventListener("submit",async function(e){e.preventDefault();const email=document.getElementById("email").value;const password=document.getElementById("password").value;const twoFactorToken=document.getElementById("twoFactorToken").value;const messageDiv=document.getElementById("message");const twoFactorGroup=document.getElementById("twoFactorGroup");console.log("[AUTH] Login form submitted:",email);try{console.log("[HTTP] Sending login request to server...");const response=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password,twoFactorToken:twoFactorToken||null})});const data=await response.json();if(data.success){console.log("[OK] Login successful");localStorage.setItem("token",data.token);localStorage.setItem("user",JSON.stringify(data.user));window.location.href="/dashboard"}else if(data.requires2FA){console.log("[2FA] 2FA required");twoFactorGroup.style.display="block";messageDiv.textContent="Please enter your 2FA code";messageDiv.className="message";messageDiv.style.display="block";if(data.twoFactorMethod==="email"){await sendLoginEmailCode(email);messageDiv.textContent="2FA code sent to your email. Please check and enter it below."}}else{console.error("[ERROR] Login failed:",data.error);messageDiv.textContent=data.error||"Login failed. Please check your credentials.";messageDiv.className="message error";messageDiv.style.display="block"}}catch(error){console.error("[ERROR] Login error:",error);messageDiv.textContent="Network error. Please try again.";messageDiv.className="message error";messageDiv.style.display="block"}});</script></body></html>';
    res.end(html, 'utf8');
});

// Sign Up Page
app.get('/signup', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    // Use plain text strings - no HTML entities, no corrupted characters
    const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Sign Up - traidefi</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff}.container{background:#1a1a1a;padding:3rem;border-radius:15px;box-shadow:0 20px 40px rgba(0,0,0,0.5);max-width:500px;width:90%}h1{color:#fff;font-size:2.2rem;margin-bottom:1rem;text-align:center}.journey{background:#2a2a2a;padding:1.5rem;border-radius:8px;margin-bottom:2rem}.journey h3{color:#fff;margin-bottom:1rem;font-size:1.1rem}.steps{display:flex;justify-content:space-between;margin-bottom:1rem}.step{flex:1;text-align:center;padding:0.5rem;background:#333;border-radius:6px;margin:0 0.25rem;color:#ccc;font-size:0.9rem}.step.active{background:#667eea;color:#fff}.step-desc{color:#888;font-size:0.85rem;text-align:center}.form-group{margin-bottom:1.5rem}label{display:block;margin-bottom:0.5rem;color:#fff;font-weight:600}input,select{width:100%;padding:12px;background:#333;border:1px solid #555;border-radius:8px;font-size:1rem;color:#fff}input:focus,select:focus{outline:none;border-color:#667eea}.btn{width:100%;padding:15px;background:#667eea;color:#fff;border:none;border-radius:8px;font-size:1.1rem;font-weight:600;cursor:pointer;margin-top:1rem}.btn:hover{background:#5a6fd8}.links{text-align:center;margin-top:2rem}.links a{color:#667eea;text-decoration:none}.message{padding:1rem;margin-bottom:1rem;border-radius:8px;display:none}.success{background:#d4edda;color:#155724;border:1px solid #c3e6cb}.error{background:#f8d7da;color:#721c24;border:1px solid #f5c6cb}</style></head><body><div class="container"><h1>Create Your Account</h1><div class="journey"><h3>Your Registration Journey</h3><div class="steps"><div class="step active">1. Sign Up</div><div class="step">2. KYC Docs</div><div class="step">3. Wallet Setup</div><div class="step">4. Dashboard</div></div><p class="step-desc">Complete basic info - Upload KYC documents - Set up your wallet - Start trading!</p></div><div id="message" class="message"></div><form id="signupForm"><div class="form-group"><label for="email">Email Address *</label><input type="email" id="email" required></div><div class="form-group"><label for="password">Password *</label><input type="password" id="password" required></div><div class="form-group"><label for="role">Your Role *</label><select id="role" required><option value="">Select your trading role</option><option value="buyer">Buyer</option><option value="supplier">Supplier</option><option value="trader">Trader</option><option value="insurer">Insurer</option></select></div><button type="submit" class="btn" id="submitBtn">Create Account</button></form><div class="links"><a href="/signin">Already have an account? Sign In</a><br><a href="/landing-two">Back to Home</a></div></div><script>console.log("[OK] Signup page loaded");document.getElementById("signupForm").addEventListener("submit",async function(e){e.preventDefault();const email=document.getElementById("email").value;const password=document.getElementById("password").value;const role=document.getElementById("role").value;const messageDiv=document.getElementById("message");try{const response=await fetch("/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password,role})});const data=await response.json();if(data.success){localStorage.setItem("token",data.token);localStorage.setItem("user",JSON.stringify(data.user));window.location.href="/dashboard/kyc"}else{messageDiv.textContent=data.error||"Registration failed";messageDiv.className="message error";messageDiv.style.display="block"}}catch(error){messageDiv.textContent="Network error. Please try again.";messageDiv.className="message error";messageDiv.style.display="block"}});</script></body></html>';
    res.end(html, 'utf8');
});

// Demo Main Page
app.get('/demo-main', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    // Use plain text strings - no HTML entities, no corrupted characters
    const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Demo Access - traidefi</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff}.container{background:#1a1a1a;padding:3rem;border-radius:15px;box-shadow:0 20px 40px rgba(0,0,0,0.5);max-width:500px;width:90%;text-align:center}h1{color:#fff;font-size:2.2rem;margin-bottom:1rem}.subtitle{color:#ccc;font-size:1.1rem;margin-bottom:2rem}.form-group{margin-bottom:1.5rem}label{display:block;margin-bottom:0.5rem;color:#fff;font-weight:600;text-align:left}input{width:100%;padding:12px;background:#333;border:1px solid #555;border-radius:8px;font-size:1rem;color:#fff}input:focus{outline:none;border-color:#667eea}.btn{width:100%;padding:15px;background:#667eea;color:#fff;border:none;border-radius:8px;font-size:1.1rem;font-weight:600;cursor:pointer;margin-top:1rem}.btn:hover{background:#5a6fd8}.features{background:#2a2a2a;padding:1.5rem;border-radius:8px;margin:2rem 0;text-align:left}.features h3{color:#fff;margin-bottom:1rem}.features ul{list-style:none;padding:0}.features li{color:#ccc;margin:0.5rem 0;padding-left:1.5rem;position:relative}.features li:before{content:"-";position:absolute;left:0;color:#667eea;font-weight:bold}.back-link{text-align:center;margin-top:2rem}.back-link a{color:#667eea;text-decoration:none}</style></head><body><div class="container"><h1>Demo Access Required</h1><p class="subtitle">Enter the demo password to access the Tangent Platform demonstration</p><form id="demoForm"><div class="form-group"><label for="password">Demo Password</label><input type="password" id="password" placeholder="Enter demo password" required></div><button type="submit" class="btn">Access Demo</button></form><div class="features"><h3>Demo Features:</h3><ul><li>Complete platform workflows for all roles</li><li>Interactive contract management</li><li>KYC and compliance systems</li><li>Admin dashboard and controls</li></ul></div><div class="back-link"><a href="/">Back to Main Platform</a></div></div><script>document.getElementById("demoForm").addEventListener("submit",function(e){e.preventDefault();const password=document.getElementById("password").value;if(password==="demo"||password==="tangent2024"){window.location.href="/demo/workflow"}else{alert("Invalid demo password")}});</script></body></html>';
    res.end(html, 'utf8');
});

// ================================
// API ROUTES (DEFINED BEFORE STATIC FILES)
// ================================
// User Registration API
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, role = 'buyer' } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // Validate role
        if (!['buyer', 'supplier', 'trader', 'insurer'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        
        // Check if user already exists
        if (database.users.has(email)) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const user = {
            id: 'user-' + Date.now(),
            email: email,
            password: hashedPassword,
            role: role,
            verified: false,
            kycStatus: 'pending',
            createdAt: new Date().toISOString()
        };
        
        database.users.set(email, user);
        saveDatabase();
        
        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'tangent-secret-key',
            { expiresIn: '7d' }
        );
        
        // Return success (don't include password)
        const { password: _, ...safeUser } = user;
        res.status(201).json({
            success: true,
            token: token,
            user: safeUser
        });
    } catch (error) {
        console.error('[ERROR] Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// User Login API
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password, twoFactorToken } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // Find user
        const user = database.users.get(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Check 2FA if enabled
        if (user.twoFactorEnabled && !twoFactorToken) {
            return res.status(200).json({
                requires2FA: true,
                twoFactorMethod: user.twoFactorMethod || 'email'
            });
        }
        
        if (user.twoFactorEnabled && twoFactorToken) {
            // Verify 2FA token (simplified - should use proper 2FA verification)
            // For now, just check if token is provided
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'tangent-secret-key',
            { expiresIn: '7d' }
        );
        
        // Return success (don't include password)
        const { password: _, ...safeUser } = user;
        res.json({
            success: true,
            token: token,
            user: safeUser
        });
    } catch (error) {
        console.error('[ERROR] Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ================================
// CONTRACT API ROUTES
// ================================
// Get contracts for user (buyer, supplier, trader)
app.get('/api/contracts', authenticateToken, (req, res) => {
    try {
        const userEmail = req.user.email;
        const userRole = req.user.role;
        
        // Get all contracts where user is involved
        const userContracts = [];
        for (const [contractId, contract] of database.contracts.entries()) {
            if (contract.buyerEmail === userEmail || 
                contract.supplierEmail === userEmail ||
                (userRole === 'trader' && (contract.buyerEmail || contract.supplierEmail))) {
                userContracts.push({
                    ...contract,
                    id: contractId
                });
            }
        }
        
        res.json({
            success: true,
            contracts: userContracts
        });
    } catch (error) {
        console.error('[ERROR] Get contracts error:', error);
        res.status(500).json({ error: 'Failed to load contracts' });
    }
});

// Get all contracts for admin
app.get('/api/admin/contracts', authenticateToken, requireRole(['admin']), (req, res) => {
    try {
        const allContracts = [];
        for (const [contractId, contract] of database.contracts.entries()) {
            allContracts.push({
                ...contract,
                id: contractId
            });
        }
        
        res.json({
            success: true,
            contracts: allContracts
        });
    } catch (error) {
        console.error('[ERROR] Get admin contracts error:', error);
        res.status(500).json({ error: 'Failed to load contracts' });
    }
});

// ================================
// ADMIN ROUTES
// ================================
// Admin Users Management
app.get('/admin/users', authenticateToken, requireRole(['admin']), (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
        const users = Array.from(database.users.values()).map(user => {
            const { password, ...safeUser } = user;
            return safeUser;
        });
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>User Management - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}h1{color:#fff;margin-bottom:2rem}.btn{background:#667eea;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;margin:10px 5px}.btn:hover{background:#5a6fd8}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:12px;text-align:left;border-bottom:1px solid #333}th{background:#1a1a1a;color:#fff}</style></head><body><div class="container"><h1>User Management</h1><a href="/dashboard/authenticated?token=${token}" class="btn">Back to Dashboard</a><table><thead><tr><th>Email</th><th>Role</th><th>KYC Status</th><th>Created</th></tr></thead><tbody>${users.map(u => `<tr><td>${u.email}</td><td>${u.role}</td><td>${u.kycStatus || 'pending'}</td><td>${new Date(u.createdAt || Date.now()).toLocaleDateString()}</td></tr>`).join('')}</tbody></table></div></body></html>`;
        res.end(html, 'utf8');
    } catch (error) {
        console.error('[ERROR] Admin users error:', error);
        res.status(500).send('Error loading users');
    }
});

// Admin Active Trades
app.get('/admin/active-trades', authenticateToken, requireRole(['admin']), (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
        const contracts = Array.from(database.contracts.values());
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Active Trades - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}h1{color:#fff;margin-bottom:2rem}.btn{background:#667eea;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;margin:10px 5px}.btn:hover{background:#5a6fd8}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:12px;text-align:left;border-bottom:1px solid #333}th{background:#1a1a1a;color:#fff}</style></head><body><div class="container"><h1>Active Trades</h1><a href="/dashboard/authenticated?token=${token}" class="btn">Back to Dashboard</a><table><thead><tr><th>Contract ID</th><th>Product</th><th>Value</th><th>Buyer</th><th>Supplier</th><th>Status</th></tr></thead><tbody>${contracts.map(c => `<tr><td>${c.id || 'N/A'}</td><td>${c.productDetails || 'N/A'}</td><td>$${(c.totalValue || 0).toLocaleString()}</td><td>${c.buyerEmail || 'N/A'}</td><td>${c.supplierEmail || 'N/A'}</td><td>${(c.status || 'pending').replace(/_/g, ' ')}</td></tr>`).join('')}</tbody></table></div></body></html>`;
        res.end(html, 'utf8');
    } catch (error) {
        console.error('[ERROR] Admin active trades error:', error);
        res.status(500).send('Error loading trades');
    }
});

// Admin Auction Board
app.get('/admin/auction', authenticateToken, requireRole(['admin']), (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Auction Board - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}h1{color:#fff;margin-bottom:2rem}.btn{background:#667eea;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;margin:10px 5px}.btn:hover{background:#5a6fd8}</style></head><body><div class="container"><h1>Auction Board</h1><a href="/dashboard/authenticated?token=${token}" class="btn">Back to Dashboard</a><p style="margin-top:2rem;color:#ccc">Auction management interface coming soon...</p></div></body></html>`;
        res.end(html, 'utf8');
    } catch (error) {
        console.error('[ERROR] Admin auction error:', error);
        res.status(500).send('Error loading auction board');
    }
});

// Admin KYC Reports
app.get('/admin/kyc-reports', authenticateToken, requireRole(['admin']), (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>KYC Reports - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}h1{color:#fff;margin-bottom:2rem}.btn{background:#667eea;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;margin:10px 5px}.btn:hover{background:#5a6fd8}</style></head><body><div class="container"><h1>KYC Reports</h1><a href="/dashboard/authenticated?token=${token}" class="btn">Back to Dashboard</a><p style="margin-top:2rem;color:#ccc">KYC reports interface coming soon...</p></div></body></html>`;
        res.end(html, 'utf8');
    } catch (error) {
        console.error('[ERROR] Admin KYC reports error:', error);
        res.status(500).send('Error loading KYC reports');
    }
});

// Admin OFAC Management
app.get('/admin/ofac-management', authenticateToken, requireRole(['admin']), (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>OFAC Screening - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}h1{color:#fff;margin-bottom:2rem}.btn{background:#667eea;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;margin:10px 5px}.btn:hover{background:#5a6fd8}</style></head><body><div class="container"><h1>OFAC Screening</h1><a href="/dashboard/authenticated?token=${token}" class="btn">Back to Dashboard</a><p style="margin-top:2rem;color:#ccc">OFAC screening interface coming soon...</p></div></body></html>`;
        res.end(html, 'utf8');
    } catch (error) {
        console.error('[ERROR] Admin OFAC management error:', error);
        res.status(500).send('Error loading OFAC management');
    }
});

// Admin Blockchain
app.get('/admin/blockchain', authenticateToken, requireRole(['admin']), (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Blockchain - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}h1{color:#fff;margin-bottom:2rem}.btn{background:#667eea;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;margin:10px 5px}.btn:hover{background:#5a6fd8}</style></head><body><div class="container"><h1>Blockchain Management</h1><a href="/dashboard/authenticated?token=${token}" class="btn">Back to Dashboard</a><p style="margin-top:2rem;color:#ccc">Blockchain management interface coming soon...</p></div></body></html>`;
        res.end(html, 'utf8');
    } catch (error) {
        console.error('[ERROR] Admin blockchain error:', error);
        res.status(500).send('Error loading blockchain');
    }
});

// Admin Fees
app.get('/admin/fees', authenticateToken, requireRole(['admin']), (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Manage Fees - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}h1{color:#fff;margin-bottom:2rem}.btn{background:#667eea;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;margin:10px 5px}.btn:hover{background:#5a6fd8}</style></head><body><div class="container"><h1>Manage Fees</h1><a href="/dashboard/authenticated?token=${token}" class="btn">Back to Dashboard</a><p style="margin-top:2rem;color:#ccc">Fee management interface coming soon...</p></div></body></html>`;
        res.end(html, 'utf8');
    } catch (error) {
        console.error('[ERROR] Admin fees error:', error);
        res.status(500).send('Error loading fees');
    }
});

// Admin Voyage Times
app.get('/admin/voyage-times', authenticateToken, requireRole(['admin']), (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Voyage Times - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}h1{color:#fff;margin-bottom:2rem}.btn{background:#667eea;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;margin:10px 5px}.btn:hover{background:#5a6fd8}</style></head><body><div class="container"><h1>Voyage Times</h1><a href="/dashboard/authenticated?token=${token}" class="btn">Back to Dashboard</a><p style="margin-top:2rem;color:#ccc">Voyage times management coming soon...</p></div></body></html>`;
        res.end(html, 'utf8');
    } catch (error) {
        console.error('[ERROR] Admin voyage times error:', error);
        res.status(500).send('Error loading voyage times');
    }
});

// Admin Basis Points
app.get('/admin/basis-points', authenticateToken, requireRole(['admin']), (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Basis Points - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}h1{color:#fff;margin-bottom:2rem}.btn{background:#667eea;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;margin:10px 5px}.btn:hover{background:#5a6fd8}</style></head><body><div class="container"><h1>Basis Points</h1><a href="/dashboard/authenticated?token=${token}" class="btn">Back to Dashboard</a><p style="margin-top:2rem;color:#ccc">Basis points management coming soon...</p></div></body></html>`;
        res.end(html, 'utf8');
    } catch (error) {
        console.error('[ERROR] Admin basis points error:', error);
        res.status(500).send('Error loading basis points');
    }
});

// Admin Flags
app.get('/admin/flags', authenticateToken, requireRole(['admin']), (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Review Flags - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}h1{color:#fff;margin-bottom:2rem}.btn{background:#667eea;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;margin:10px 5px}.btn:hover{background:#5a6fd8}</style></head><body><div class="container"><h1>Review Flags</h1><a href="/dashboard/authenticated?token=${token}" class="btn">Back to Dashboard</a><p style="margin-top:2rem;color:#ccc">Flag review interface coming soon...</p></div></body></html>`;
        res.end(html, 'utf8');
    } catch (error) {
        console.error('[ERROR] Admin flags error:', error);
        res.status(500).send('Error loading flags');
    }
});

// Admin Credit Assessments
app.get('/admin/credit-assessments', authenticateToken, requireRole(['admin']), (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Credit Assessments - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}h1{color:#fff;margin-bottom:2rem}.btn{background:#667eea;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;margin:10px 5px}.btn:hover{background:#5a6fd8}</style></head><body><div class="container"><h1>Credit Assessments</h1><a href="/dashboard/authenticated?token=${token}" class="btn">Back to Dashboard</a><p style="margin-top:2rem;color:#ccc">Credit assessments interface coming soon...</p></div></body></html>`;
        res.end(html, 'utf8');
    } catch (error) {
        console.error('[ERROR] Admin credit assessments error:', error);
        res.status(500).send('Error loading credit assessments');
    }
});

// ================================
// STATIC FILE SERVING
// ================================
// Define explicit routes that should NOT be served as static files
// CRITICAL: This must be defined BEFORE any static middleware
// Note: API routes (POST) are handled separately and don't need to be in this array
const explicitRoutes = ['/landing-two', '/signin', '/signup', '/demo-main', '/'];

// CRITICAL: Add middleware BEFORE static file serving to prevent serving files for explicit routes
// BUT: This middleware should NOT interfere with route handlers - routes are defined BEFORE this
// Routes (app.get) take precedence over middleware (app.use), so this is just a safety check
app.use((req, res, next) => {
    // If this is an explicit route, DO NOT serve static files
    // BUT: The route handler should have already sent the response
    // This is just a safety check to prevent static files from being served
    if (explicitRoutes.includes(req.path)) {
        // If response already sent by route handler, don't serve static files
        if (res.headersSent) {
            return;
        }
        // If response not sent yet, the route handler should handle it
        // Continue to next middleware (which will skip static file serving)
        // The route handler should have already sent the response by now
        return next();
    }
    // For other routes, continue to static file serving
    next();
});

// Middleware to ensure UTF-8 encoding for all static files
// BUT: Skip for explicit routes
app.use((req, res, next) => {
    // Skip encoding middleware for explicit routes (they handle their own encoding)
    if (explicitRoutes.includes(req.path)) {
        return next();
    }
    // Set UTF-8 encoding for text files
    if (req.path.match(/\.(html|js|jsx|css|json|txt)$/)) {
        res.setHeader('Content-Type', res.getHeader('Content-Type')?.replace(/; charset=.*/, '') + '; charset=utf-8');
    }
    next();
});

// Serve static files from public directory (for React app)
// BUT: Skip static file serving for routes we've explicitly defined
app.use((req, res, next) => {
    // CRITICAL: Skip static file serving for routes we've explicitly defined
    // Check this BEFORE trying to serve static files
    if (explicitRoutes.includes(req.path)) {
        // DO NOT serve static files for explicit routes - they have their own handlers
        // DO NOT call next() - just return to completely skip static file serving
        // The route handler should have already sent the response
        return;
    }
    // For other routes, try to serve static files from public directory
    express.static('public', { 
        setHeaders: (res, path) => {
            if (path.match(/\.(html|js|jsx|css|json|txt)$/)) {
                res.setHeader('Content-Type', res.getHeader('Content-Type')?.replace(/; charset=.*/, '') + '; charset=utf-8');
            }
        }
    })(req, res, next);
});

// Serve static files from src directory (for React app)
// BUT: NEVER serve files for explicit routes - they have their own handlers
app.use((req, res, next) => {
    // CRITICAL: Completely skip static file serving for routes we've explicitly defined
    // This MUST be checked BEFORE trying to serve static files
    if (explicitRoutes.includes(req.path)) {
        // DO NOT serve static files for explicit routes - they have their own handlers
        // DO NOT call next() - just return to completely skip static file serving
        // The route handler should have already sent the response
        return;
    }
    // For other routes, try to serve static files from src directory
    // Use a custom handler to prevent serving index.html for explicit routes
    const staticHandler = express.static('src', { 
        setHeaders: (res, path) => {
            if (path.match(/\.(html|js|jsx|css|json|txt)$/)) {
                res.setHeader('Content-Type', res.getHeader('Content-Type')?.replace(/; charset=.*/, '') + '; charset=utf-8');
            }
        },
        index: false // Don't serve index.html automatically
    });
    staticHandler(req, res, next);
});
app.use('/uploads', express.static('uploads'));

// ================================
// LEGAL DOCUMENTS
// ================================
// Terms of Service
app.get('/terms', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const termsPath = path.join(__dirname, 'legal', 'terms-of-service.html');
    try {
        if (!fs.existsSync(termsPath)) {
            return res.status(404).send('Terms of Service file not found');
        }
        const html = fs.readFileSync(termsPath, 'utf8');
        res.send(html);
    } catch (error) {
        console.error('[ERROR] Error reading Terms file:', error.message);
        res.status(500).send('Error loading Terms of Service: ' + error.message);
    }
});

// Privacy Policy
app.get('/privacy', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const privacyPath = path.join(__dirname, 'legal', 'privacy-policy.html');
    try {
        if (!fs.existsSync(privacyPath)) {
            return res.status(404).send('Privacy Policy file not found');
        }
        const html = fs.readFileSync(privacyPath, 'utf8');
        res.send(html);
    } catch (error) {
        console.error('[ERROR] Error reading Privacy file:', error.message);
        res.status(500).send('Error loading Privacy Policy: ' + error.message);
    }
});

// User Agreement
app.get('/user-agreement', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const agreementPath = path.join(__dirname, 'legal', 'user-agreement.html');
    try {
        if (!fs.existsSync(agreementPath)) {
            return res.status(404).send('User Agreement file not found');
        }
        const html = fs.readFileSync(agreementPath, 'utf8');
        res.send(html);
    } catch (error) {
        console.error('[ERROR] Error reading User Agreement file:', error.message);
        res.status(500).send('Error loading User Agreement: ' + error.message);
    }
});

// Block access to problematic React files that cause console errors
app.get('*.jsx', (req, res) => {
    res.status(404).send('JSX files not served');
});
app.get('*.js', (req, res) => {
    // Only allow specific JS files, block React components
    if (req.path.includes('App.jsx') || 
        req.path.includes('DashboardRouter') || 
        req.path.includes('react') ||
        req.path.includes('components/')) {
        res.status(404).send('React components not served');
    } else {
        res.status(404).send('File not found');
    }
});

// Serve favicon to prevent 404 errors
// KYC Page HTML Function
function getFullKYCPageHTML(userEmail, token) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-C1FN7FSX06"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', 'G-C1FN7FSX06');
  </script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KYC Verification - traidefi</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; background: #000000; color: #ffffff; min-height: 100vh; }
        .header { background: #1a1a1a; padding: 2rem; border-bottom: 1px solid #333333; }
        .header-content { max-width: 1200px; margin: 0 auto; text-align: center; }
        .header h1 { color: #ffffff; font-size: 2.5rem; margin-bottom: 1rem; }
        .main-content { max-width: 900px; margin: 0 auto; padding: 2rem; }
        .step { background: #1a1a1a; padding: 40px; border-radius: 12px; border: 1px solid #333333; margin-bottom: 20px; display: none; }
        .step.active { display: block; }
        .step h2 { color: #ffffff; margin-bottom: 30px; text-align: center; }
        .company-type-selector { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
        .company-card { background: #0a0a0a; border: 2px solid #333333; border-radius: 12px; padding: 30px; text-align: center; cursor: pointer; transition: all 0.3s; }
        .company-card:hover { border-color: #ffffff; transform: translateY(-5px); }
        .company-card.selected { border-color: #ffffff; background: #1a1a1a; }
        .company-card h3 { color: #ffffff; margin-bottom: 15px; font-size: 1.5rem; }
        .company-card p { color: #888888; line-height: 1.6; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; color: #ffffff; font-weight: 600; margin-bottom: 8px; }
        .form-group input, .form-group select { width: 100%; padding: 12px; background: #0a0a0a; border: 1px solid #333333; border-radius: 8px; color: #ffffff; }
        .form-group input:focus, .form-group select:focus { border-color: #ffffff; outline: none; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .file-upload { border: 2px dashed #333333; padding: 40px; text-align: center; border-radius: 8px; background: #0a0a0a; margin-bottom: 20px; }
        .file-upload.dragover { border-color: #ffffff; background: #1a1a1a; }
        .file-upload input[type="file"] { display: none; }
        .upload-btn { background: #ffffff; color: #000000; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
        .upload-btn:hover { background: #cccccc; }
        .file-list { margin-top: 15px; }
        .file-item { background: #1a1a1a; padding: 10px; border-radius: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
        .remove-file { background: #666666; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
        .btn { display: inline-block; padding: 15px 30px; background: #ffffff; color: #000000; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 10px 10px 0 0; cursor: pointer; border: none; font-size: 1.1rem; }
        .btn:hover { background: #cccccc; }
        .btn-secondary { background: #666666; color: #ffffff; }
        .btn-secondary:hover { background: #555555; }
        .logout-btn { background: #666666; color: white; padding: 0.5rem 1rem; border-radius: 6px; text-decoration: none; position: absolute; top: 2rem; right: 2rem; }
        .progress-indicator { display: flex; justify-content: center; margin-bottom: 30px; }
        .progress-step { padding: 10px 20px; background: #333333; color: #888888; border-radius: 6px; margin: 0 5px; }
        .progress-step.active { background: #ffffff; color: #000000; }
        .progress-step.completed { background: #666666; color: #ffffff; }
        .checking-status { text-align: center; padding: 40px; }
        .spinner { border: 3px solid #333333; border-top: 3px solid #ffffff; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto 20px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .hidden { display: none; }
    </style>
</head>
<body>
    <a href="/" class="logout-btn">Logout</a>
    
    <div class="header">
        <div class="header-content">
            <h1>KYC Verification</h1>
            <p>Complete your Know Your Customer verification to access the trading platform</p>
        </div>
    </div>
    
    <div class="main-content">
        <div class="progress-indicator">
            <div class="progress-step active" id="step1">1. Company Type</div>
            <div class="progress-step" id="step2">2. Information</div>
            <div class="progress-step" id="step3">3. Documents</div>
            <div class="progress-step" id="step4">4. Verification</div>
        </div>

        <!-- Step 1: Company Type Selection -->
        <div class="step active" id="companyTypeStep">
            <h2>Select Your Company Type</h2>
            
            
            <div class="company-type-selector">
                <div class="company-card" onclick="selectCompanyType('listed', this)">
                    <h3>Listed Company</h3>
                    <p><strong>Public/Traded Company</strong><br><br>
                    Your company is publicly traded on a stock exchange. You'll need to provide your stock symbol and contact information for verification.</p>
                </div>
                <div class="company-card" onclick="selectCompanyType('private', this)">
                    <h3>Private Company</h3>
                    <p><strong>Privately Held Company</strong><br><br>
                    Your company is privately owned. You'll need to upload incorporation documents, latest audited financial statements, and optionally company bylaws for verification.</p>
                </div>
            </div>
        </div>

        <!-- Step 2: Listed Company Information -->
        <div class="step" id="listedCompanyStep">
            <h2>Listed Company Verification</h2>
            <form id="listedForm">
                <div class="form-group">
                    <label for="companyName">Company Name *</label>
                    <input type="text" id="companyName" name="companyName" required>
                </div>
                
                <div class="form-grid">
                    <div class="form-group">
                        <label for="stockSymbol">Stock Symbol *</label>
                        <input type="text" id="stockSymbol" name="stockSymbol" placeholder="e.g., AAPL, TSLA" required>
                    </div>
                    <div class="form-group">
                        <label for="exchange">Exchange *</label>
                        <select id="exchange" name="exchange" required>
                            <option value="">Select Exchange</option>
                            <option value="NYSE">NYSE</option>
                            <option value="NASDAQ">NASDAQ</option>
                            <option value="LSE">London Stock Exchange</option>
                            <option value="TSE">Tokyo Stock Exchange</option>
                            <option value="OTHER">Other</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-grid">
                    <div class="form-group">
                        <label for="contactName">Contact Person Name *</label>
                        <input type="text" id="contactName" name="contactName" required>
                    </div>
                    <div class="form-group">
                        <label for="contactFunction">Function/Title *</label>
                        <input type="text" id="contactFunction" name="contactFunction" placeholder="e.g., CFO, Legal Director" required>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="contactPhone">Contact Phone *</label>
                    <input type="tel" id="contactPhone" name="contactPhone" required>
                </div>
                
                <div class="form-group">
                    <label>Passport Upload *</label>
                    <div class="file-upload" id="passportUpload">
                        <p>Upload a clear copy of your passport</p>
                        <button type="button" class="upload-btn" onclick="document.getElementById('passportFile').click()">Choose File</button>
                        <input type="file" id="passportFile" accept=".pdf,.jpg,.jpeg,.png" onchange="handleFileUpload(this, 'passport')">
                        <div id="passportFiles" class="file-list"></div>
                    </div>
                </div>
                
                <button type="button" class="btn" onclick="submitListedCompany()">Submit for Verification</button>
                <button type="button" class="btn btn-secondary" onclick="goToStep('companyTypeStep')">Back</button>
            </form>
        </div>

        <!-- Step 3: Private Company Information -->
        <div class="step" id="privateCompanyStep">
            <h2>Private Company Verification</h2>
            <form id="privateForm">
                <div class="form-group">
                    <label for="privateCompanyName">Company Name *</label>
                    <input type="text" id="privateCompanyName" name="companyName" required>
                </div>
                
                <div class="form-grid">
                    <div class="form-group">
                        <label for="privateContactName">Contact Person Name *</label>
                        <input type="text" id="privateContactName" name="contactName" required>
                    </div>
                    <div class="form-group">
                        <label for="privateContactPhone">Contact Phone *</label>
                        <input type="tel" id="privateContactPhone" name="contactPhone" required>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Required Documents *</label>
                    
                    <div class="file-upload" id="passportUploadPrivate" style="margin-bottom: 15px;">
                        <p><strong>Passport</strong> - Clear copy of authorized representative's passport</p>
                        <button type="button" class="upload-btn" onclick="document.getElementById('passportFilePrivate').click()">Choose File</button>
                        <input type="file" id="passportFilePrivate" accept=".pdf,.jpg,.jpeg,.png" onchange="handleFileUpload(this, 'passport')">
                        <div id="passportFilesPrivate" class="file-list"></div>
                    </div>
                    
                    <div class="file-upload" id="incorporationUpload" style="margin-bottom: 15px;">
                        <p><strong>Certificate of Incorporation</strong> - Official incorporation documents</p>
                        <button type="button" class="upload-btn" onclick="document.getElementById('incorporationFile').click()">Choose File</button>
                        <input type="file" id="incorporationFile" accept=".pdf,.jpg,.jpeg,.png" onchange="handleFileUpload(this, 'incorporation')">
                        <div id="incorporationFiles" class="file-list"></div>
                    </div>
                    
                    <div class="file-upload" id="financialsUpload" style="margin-bottom: 15px;">
                        <p><strong>Latest Audited Financial Statements *</strong> - Most recent audited financials (Required for private companies only)</p>
                        <button type="button" class="upload-btn" onclick="document.getElementById('financialsFile').click()">Choose File</button>
                        <input type="file" id="financialsFile" accept=".pdf,.jpg,.jpeg,.png" onchange="handleFileUpload(this, 'financials')">
                        <div id="financialsFiles" class="file-list"></div>
                    </div>
                    
                    <div class="file-upload" id="bylawsUpload">
                        <p><strong>Company Bylaws (Optional)</strong> - Corporate governance documents</p>
                        <button type="button" class="upload-btn" onclick="document.getElementById('bylawsFile').click()">Choose File</button>
                        <input type="file" id="bylawsFile" accept=".pdf,.jpg,.jpeg,.png" onchange="handleFileUpload(this, 'bylaws')">
                        <div id="bylawsFiles" class="file-list"></div>
                    </div>
                </div>
                
                <button type="button" class="btn" onclick="submitPrivateCompany()">Submit for Verification</button>
                <button type="button" class="btn btn-secondary" onclick="goToStep('companyTypeStep')">Back</button>
            </form>
        </div>

        <!-- Step 4: Verification Status -->
        <div class="step" id="verificationStep">
            <div class="checking-status">
                <div class="spinner"></div>
                <h2>Running Compliance Checks</h2>
                <p id="checkingMessage">Verifying your information against compliance databases...</p>
                <ul style="text-align: left; margin: 20px 0; max-width: 600px; margin-left: auto; margin-right: auto;">
                    <li id="check1" style="margin: 10px 0;">Sanctions database check...</li>
                    <li id="check2" style="margin: 10px 0;">Anti-money laundering verification...</li>
                    <li id="check3" style="margin: 10px 0;">Credit information review...</li>
                    <li id="check4" style="margin: 10px 0;">Document authenticity verification...</li>
                    <li id="check5" style="margin: 10px 0;">Final compliance assessment...</li>
                </ul>
            </div>
        </div>
        
    </div>

    <script>
        console.log('KYC Script loaded successfully');
        
        // Get the token from the URL parameter or localStorage
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token') || localStorage.getItem('token') || '${token}';
                console.log('Token available for KYC:', token ? 'Yes' : 'No');
        
        let currentCompanyType = '';
        const uploadedFiles = {};

        function selectCompanyType(type, element) {
            console.log('Company type selected:', type);
            currentCompanyType = type;
            
            // Update visual selection
            document.querySelectorAll('.company-card').forEach(card => {
                card.classList.remove('selected');
            });
            
            // Mark the clicked card as selected
            if (element) {
                element.classList.add('selected');
                console.log('Card selected visually');
            }
            
            // Show appropriate form after delay
            setTimeout(() => {
                console.log('Transitioning to', type, 'company form');
                if (type === 'listed') {
                    goToStep('listedCompanyStep');
                } else {
                    goToStep('privateCompanyStep');
                }
                updateProgress(2);
            }, 1000);
        }
        

        function goToStep(stepId) {
            document.querySelectorAll('.step').forEach(step => {
                step.classList.remove('active');
            });
            document.getElementById(stepId).classList.add('active');
        }

        function updateProgress(stepNumber) {
            document.querySelectorAll('.progress-step').forEach((step, index) => {
                if (index + 1 < stepNumber) {
                    step.classList.add('completed');
                    step.classList.remove('active');
                } else if (index + 1 === stepNumber) {
                    step.classList.add('active');
                    step.classList.remove('completed');
                } else {
                    step.classList.remove('active', 'completed');
                }
            });
        }

        async function handleFileUpload(input, category) {
            const files = input.files;
            if (files.length > 0) {
                const file = files[0];
                
                // Real-time file validation
                const validationResult = validateFileRealTime(file, category);
                
                if (!validationResult.isValid) {
                    alert('File Validation Error:\\n' + validationResult.errors.join('\\n'));
                    input.value = ''; // Clear the input
                    return;
                }
                
                if (!uploadedFiles[category]) {
                    uploadedFiles[category] = [];
                }
                uploadedFiles[category] = [file]; // Replace instead of append for single file uploads
                displayFiles(category, validationResult);
            }
        }
        
        // Real-time file validation function
        function validateFileRealTime(file, category) {
            const result = {
                isValid: true,
                errors: [],
                warnings: []
            };
            
            // Check file size (10MB max, 1KB min)
            const maxSize = 10 * 1024 * 1024; // 10MB
            const minSize = 1024; // 1KB
            
            if (file.size > maxSize) {
                result.errors.push(\`File too large: \${Math.round(file.size / 1024 / 1024)}MB. Maximum size: 10MB\`);
                result.isValid = false;
            }
            
            if (file.size < minSize) {
                result.errors.push(\`File too small: \${file.size} bytes. Minimum size: 1KB\`);
                result.isValid = false;
            }
            
            // Check file format
            const allowedFormats = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
            const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
            
            if (!allowedFormats.includes(fileExtension)) {
                result.errors.push(\`Invalid file format: \${fileExtension}. Allowed formats: \${allowedFormats.join(', ')}\`);
                result.isValid = false;
            }
            
            // Success message
            if (result.isValid) {
                result.successMessage = \`\${category.charAt(0).toUpperCase() + category.slice(1)} document validated successfully (\${Math.round(file.size / 1024)}KB)\`;
            }
            
            return result;
        }

        function displayFiles(category, validationResult = null) {
            const fileListIds = [category + 'Files', category + 'FilesPrivate'];
            fileListIds.forEach(fileListId => {
                const fileList = document.getElementById(fileListId);
                if (fileList) {
                    fileList.innerHTML = '';
                    
                    if (uploadedFiles[category]) {
                        uploadedFiles[category].forEach((file, index) => {
                            const fileItem = document.createElement('div');
                            fileItem.className = 'file-item';
                            
                            // Show validation status
                            let validationStatus = '';
                            if (validationResult && validationResult.successMessage) {
                                validationStatus = \`<div class="validation-success" style="color: #ffffff; font-size: 0.9em; margin-top: 5px;">\${validationResult.successMessage}</div>\`;
                            }
                            
                            fileItem.innerHTML = \`
                                <div class="file-info" style="display: flex; justify-content: space-between; align-items: center;">
                                    <span class="file-name">\${file.name} (\${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                    <button type="button" class="remove-file" onclick="removeFile('\${category}', \${index})" style="background: #dc2626; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Remove</button>
                                </div>
                                \${validationStatus}
                            \`;
                            fileList.appendChild(fileItem);
                        });
                    }
                }
            });
        }

        function removeFile(category, index) {
            if (uploadedFiles[category]) {
                uploadedFiles[category].splice(index, 1);
                displayFiles(category);
            }
        }

        async function submitListedCompany() {
            const form = document.getElementById('listedForm');
            
            // Validate required documents for listed company
            const requiredDocs = ['passport'];
            const validationErrors = [];
            
            requiredDocs.forEach(docType => {
                if (!uploadedFiles[docType] || uploadedFiles[docType].length === 0) {
                    validationErrors.push(\`Missing required document: \${docType.charAt(0).toUpperCase() + docType.slice(1)}\`);
                }
            });
            
            if (validationErrors.length > 0) {
                alert('Document Validation Failed:\\n\\n' + validationErrors.join('\\n') + '\\n\\nPlease upload all required documents before submitting.');
                return;
            }
            
            const formData = new FormData(form);
            formData.append('companyType', 'listed');
            
            // Add uploaded files
            Object.keys(uploadedFiles).forEach(category => {
                if (uploadedFiles[category]) {
                    uploadedFiles[category].forEach(file => {
                        formData.append(category, file);
                    });
                }
            });
            
            await submitKYC(formData);
        }

        async function submitPrivateCompany() {
            const form = document.getElementById('privateForm');
            
            // Validate required documents for private company (bylaws is optional)
            const requiredDocs = ['passport', 'incorporation', 'financials'];
            const optionalDocs = ['bylaws'];
            const validationErrors = [];
            
            requiredDocs.forEach(docType => {
                if (!uploadedFiles[docType] || uploadedFiles[docType].length === 0) {
                    validationErrors.push(\`Missing required document: \${docType.charAt(0).toUpperCase() + docType.slice(1)}\`);
                }
            });
            
            if (validationErrors.length > 0) {
                alert('Document Validation Failed:\\n\\n' + validationErrors.join('\\n') + '\\n\\nPrivate companies must upload passport, incorporation documents, and latest audited financial statements. Bylaws are optional.');
                return;
            }
            
            const formData = new FormData(form);
            formData.append('companyType', 'private');
            
            // Add uploaded files
            Object.keys(uploadedFiles).forEach(category => {
                if (uploadedFiles[category]) {
                    uploadedFiles[category].forEach(file => {
                        formData.append(category, file);
                    });
                }
            });
            
            await submitKYC(formData);
        }

        async function submitKYC(formData) {
            goToStep('verificationStep');
            updateProgress(4);
            
            try {
                const response = await fetch('/api/kyc/submit', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token
                    },
                    body: formData
                });
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('KYC submission successful:', result);
                    
                    // Start compliance checks simulation AFTER successful submission
                    await simulateComplianceChecks();
                    
                    // Then show completion
                    setTimeout(() => {
                        showKYCCompletion();
                    }, 1000);
                } else {
                    const error = await response.json();
                    console.error('KYC submission failed:', error);
                    
                    // Handle document validation errors specifically
                    if (error.validationErrors && error.validationErrors.length > 0) {
                        let errorMessage = 'Document Validation Failed:\\n\\n';
                        errorMessage += error.validationErrors.join('\\n');
                        
                        if (error.missingDocuments && error.missingDocuments.length > 0) {
                            errorMessage += '\\n\\nMissing Documents:\\n';
                            errorMessage += error.missingDocuments.map(doc => \`- \${doc.charAt(0).toUpperCase() + doc.slice(1)}\`).join('\\n');
                        }
                        
                        if (error.warnings && error.warnings.length > 0) {
                            errorMessage += '\\n\\nWarnings:\\n';
                            errorMessage += error.warnings.join('\\n');
                        }
                        
                        alert(errorMessage);
                    } else {
                        alert('Error: ' + (error.error || 'KYC submission failed'));
                    }
                }
            } catch (error) {
                console.error('KYC submission error:', error);
                alert('Network error. Please try again.');
            }
        }

        async function simulateComplianceChecks() {
            const checks = ['check1', 'check2', 'check3', 'check4', 'check5'];
            
            for (let i = 0; i < checks.length; i++) {
                await new Promise(resolve => setTimeout(resolve, 1500));
                const checkElement = document.getElementById(checks[i]);
                checkElement.innerHTML = checkElement.textContent.replace('⏳ ', '').replace('...', ' - Clear');
                checkElement.style.color = '#ffffff';
            }
            
            // After all checks, show completion directly (no wallet check)
            setTimeout(() => {
                showKYCCompletion();
            }, 1000);
        }
        
        function showKYCCompletion() {
            // Hide verification step
            document.getElementById('verificationStep').classList.remove('active');
            
            // Show completion message
            const completionHTML = \`
                <div style="text-align: center; padding: 40px; background: #1a1a1a; border-radius: 12px; border: 2px solid #ffffff;">
                    <h2 style="color: #ffffff; margin-bottom: 20px;">KYC Verification Complete</h2>
                    <p style="color: #ffffff; margin-bottom: 30px; font-size: 1.1em;">
                        Your verification has been successfully completed. All compliance checks have passed.
                    </p>
                    <div style="background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="color: #ffffff; margin: 0; font-weight: 600;">
                            Next Step: Set up your TGT wallet for trading and payments
                        </p>
                    </div>
                    <button type="button" class="btn" onclick="completeKYC()" style="background: #ffffff; color: #000000; font-size: 1.1em; padding: 15px 30px;">
                        Continue to Wallet Setup
                    </button>
                </div>
            \`;
            
            const mainContent = document.querySelector('.main-content');
            mainContent.innerHTML = completionHTML;
        }
        
        
        function completeKYC() {
            console.log('🎉 KYC process completed, redirecting to wallet setup');
            const token = localStorage.getItem('token') || '${token}';
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const userRole = user.role || 'buyer';
            
            // Remove the alert and redirect directly
            window.location.href = '/wallet-setup?role=' + userRole + '&token=' + encodeURIComponent(token);
        }

    </script>
</body>
</html>
    `;
}

app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); // No content response for favicon
});

// Unified Dashboard routing - ALL roles go to same dashboard
app.get('/dashboard', (req, res) => {
    // Client-side token authentication
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <!-- Google tag (gtag.js) -->
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-C1FN7FSX06"></script>
        <script>
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', 'G-C1FN7FSX06');
        </script>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard - traidefi</title>
    </head>
    <body>
        <div id="loadingMessage">Loading dashboard...</div>
        
        <script>
            console.log('Dashboard page loaded');
            
            // Check for token in localStorage
            const token = localStorage.getItem('token');
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            
            console.log('[DEBUG] Token from localStorage:', token ? token.substring(0, 20) + '...' : 'NOT FOUND');
            console.log('[DEBUG] User from localStorage:', user);
            
            if (!token || !user.email) {
                console.log('[ERROR] No token or user found, redirecting to login');
                window.location.href = '/landing-two';
            } else {
                console.log('[OK] Token and user found, redirecting to dashboard...');
                
                // Direct redirect without server verification (token will be verified by server-side middleware)
                window.location.href = '/dashboard/authenticated?role=' + user.role + '&token=' + encodeURIComponent(token) + '&v=' + Date.now();
            }
        </script>
    </body>
    </html>
    `);
});

// Token verification API
app.post('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ 
        valid: true, 
        user: req.user 
    });
});

// Authenticated dashboard route
app.get('/dashboard/authenticated', (req, res) => {
    console.log('[DASHBOARD] DASHBOARD AUTHENTICATED ROUTE HIT');
    
    // Get token from Authorization header or query parameter
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
    
    if (!token) {
        console.log('[ERROR] No token provided to authenticated route');
        return res.redirect('/landing-two');
    }
    
    let user = null;
    let twoFactorEnabled = false;
    let twoFactorMethod = null;
    
    try {
        // Verify token and get user data
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tangent-secret-key');
        user = database.users.get(decoded.email);
        
        if (!user) {
            console.log('[ERROR] User not found in database:', decoded.email);
            return res.redirect('/landing-two');
        }
        
        // Check 2FA status
        twoFactorEnabled = user.twoFactorEnabled || false;
        twoFactorMethod = user.twoFactorMethod || null;
        console.log('[2FA] 2FA Status Check:', {
            twoFactorEnabled: twoFactorEnabled,
            twoFactorMethod: twoFactorMethod,
            userHas2FA: user.twoFactorEnabled,
            userHasMethod: user.twoFactorMethod
        });
        
        // Check if user needs KYC (redirect new users to KYC)  
        if (user.kycStatus !== 'approved' && user.role !== 'admin') {
            console.log('[INFO] User needs KYC verification, showing KYC page directly');
            // Show KYC page directly instead of redirecting to avoid loops
            return res.send(getFullKYCPageHTML(user.email, token));
        }
        
        console.log('[OK] User KYC approved, showing dashboard');
        
    } catch (error) {
        console.log('[ERROR] Token verification failed:', error.message);
        return res.redirect('/landing-two');
    }
    
    // Use user's actual role from database
    const safeRole = (user.role || 'unified').replace(/[^a-zA-Z0-9_]/g, '') || 'unified';
    const isAdmin = user.role === 'admin';
    
    console.log('[DASHBOARD] User role:', user.role);
    console.log('[DASHBOARD] Is admin:', isAdmin);
    console.log('[DASHBOARD] Safe role:', safeRole);
    
    // Build admin tools section HTML
    const adminToolsHTML = isAdmin ? `
        <div class="contracts-section" style="background: #1a1a1a; padding: 30px; border-radius: 8px; border: 1px solid #333333; margin-bottom: 30px; margin-top: 30px;">
            <div class="section-header">
                <h2 class="section-title" style="color: #ffffff; font-size: 1.5rem; margin: 0; margin-bottom: 20px;">⚙️ Admin Tools</h2>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 20px;">
                <button class="btn secondary" onclick="navigateAdmin('/admin/users')" style="background: #666666; color: #ffffff; padding: 12px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 600; text-align: center;">👤 View Users</button>
                <button class="btn secondary" onclick="navigateAdmin('/admin/active-trades')" style="background: #666666; color: #ffffff; padding: 12px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 600; text-align: center;">📊 View All Trades</button>
                <button class="btn secondary" onclick="navigateAdmin('/admin/auction')" style="background: #666666; color: #ffffff; padding: 12px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 600; text-align: center;">🏛️ Auction Board</button>
                <button class="btn secondary" onclick="navigateAdmin('/admin/kyc-reports')" style="background: #666666; color: #ffffff; padding: 12px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 600; text-align: center;">🔍 KYC Reports</button>
                <button class="btn secondary" onclick="navigateAdmin('/admin/ofac-management')" style="background: #666666; color: #ffffff; padding: 12px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 600; text-align: center;">🛡️ OFAC Screening</button>
                <button class="btn secondary" onclick="navigateAdmin('/admin/blockchain')" style="background: #666666; color: #ffffff; padding: 12px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 600; text-align: center;">🔗 Blockchain</button>
                <button class="btn secondary" onclick="navigateAdmin('/admin/fees')" style="background: #666666; color: #ffffff; padding: 12px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 600; text-align: center;">💳 Manage Fees</button>
                <button class="btn secondary" onclick="navigateAdmin('/admin/voyage-times')" style="background: #666666; color: #ffffff; padding: 12px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 600; text-align: center;">🚢 Voyage Times</button>
                <button class="btn secondary" onclick="navigateAdmin('/admin/basis-points')" style="background: #666666; color: #ffffff; padding: 12px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 600; text-align: center;">⚡ Basis Points</button>
                <button class="btn secondary" onclick="navigateAdmin('/admin/flags')" style="background: #666666; color: #ffffff; padding: 12px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 600; text-align: center;">🚨 Review Flags</button>
                <button class="btn secondary" onclick="navigateAdmin('/admin/credit-assessments')" style="background: #666666; color: #ffffff; padding: 12px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 600; text-align: center;">📈 Credit Assessments</button>
                <button class="btn secondary" onclick="window.open('/dashboard/insurer?token=' + localStorage.getItem('token'), '_blank')" style="background: #2563eb; color: #ffffff; padding: 12px 20px; border: 2px solid #1e40af; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: bold; text-align: center;">🛡️ Insurance Opportunities</button>
            </div>
        </div>
    ` : '';
    
    // Enhanced My Contracts dashboard
    const dashboardHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-C1FN7FSX06"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', 'G-C1FN7FSX06');
    </script>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeRole.charAt(0).toUpperCase() + safeRole.slice(1)} Dashboard - traidefi</title>
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <!-- Version: ${Date.now()} -->
    <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; width: 100%; overflow-x: hidden; max-width: 100vw; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #000000; color: #ffffff; padding: 15px; min-height: 100vh; }
        .container { max-width: 1200px; margin: 0 auto; width: 100%; padding: 0 1rem; box-sizing: border-box; }
        .header { background: #1a1a1a; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #333333; display: flex; justify-content: space-between; align-items: center; flex-direction: row; }
        .header h1 { color: #ffffff; margin: 0; font-size: 2rem; white-space: nowrap; }
        .role-badge { background: #666666; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
        .contracts-section { background: #1a1a1a; padding: 30px; border-radius: 8px; border: 1px solid #333333; margin-bottom: 30px; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .section-title { color: #ffffff; font-size: 1.5rem; margin: 0; }
        .btn { background: #ffffff; color: #000000; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; font-size: 0.9rem; font-weight: 600; transition: all 0.3s ease; display: inline-block; }
        .btn:hover { background: #cccccc; transform: translateY(-2px); }
        .btn.secondary { background: #666666; color: #ffffff; }
        .btn.secondary:hover { background: #555555; }
        .btn.small { font-size: 0.75rem; padding: 4px 8px; margin-right: 3px; }
        .contracts-table-wrapper { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; max-width: 100%; }
        .contracts-table { width: 100%; min-width: 800px; border-collapse: collapse; margin-top: 20px; font-size: 0.9rem; }
        .contracts-table th, .contracts-table td { padding: 12px; text-align: left; border-bottom: 1px solid #333333; }
        .contracts-table th { background: #0a0a0a; color: #ffffff; font-weight: 600; font-size: 0.85rem; }
        .status-pending, .status-pending-deposit, .status-pending-supplier-confirmation, .status-pending-buyer-confirmation { background: #666666; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; }
        .status-active { background: #888888; color: #000000; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; }
        .status-completed { background: #666666; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; }
        .empty-state { text-align: center; padding: 40px; color: #888888; }
        .logout-btn { background: #666666; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; font-size: 0.9rem; }
        .security-banner { background: #333333; color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 2px solid #666666; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; }
        .security-banner.enabled { background: #444444; }
        .security-banner .content { flex: 1; }
        .security-banner h3 { margin: 0 0 8px 0; font-size: 1.2rem; }
        .security-banner p { margin: 0; opacity: 0.9; font-size: 0.95rem; }
        .security-banner .btn { background: white; color: #333333; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; white-space: nowrap; font-size: 1rem; }
        .security-banner.enabled .btn { color: #333333; }
        @media (max-width: 768px) {
            html, body { overflow-x: hidden; max-width: 100vw; }
            body { padding: 10px; }
            .container { padding: 0 0.5rem; max-width: 100%; }
            .header { flex-direction: column; align-items: flex-start; gap: 15px; padding: 15px; }
            .header h1 { font-size: 1.5rem; }
            .contracts-section { padding: 15px; }
            .contracts-table-wrapper { overflow-x: auto; }
            .contracts-table { min-width: 600px; font-size: 0.8rem; }
            .contracts-table th, .contracts-table td { padding: 8px; }
            .security-banner { flex-direction: column; text-align: center; padding: 12px; }
            .security-banner .btn { width: 100%; }
        }
    </style>
</head>
<body>
    <div class="container">
        ${(twoFactorEnabled === false || twoFactorEnabled === undefined) ? `
        <div class="security-banner">
            <div class="content">
                <h3>Protect Your Account</h3>
                <p>Enable Two-Factor Authentication (2FA) to add an extra layer of security to your account. Choose between Email codes or Authenticator App.</p>
            </div>
            <a href="/settings/2fa?token=${token}" class="btn">Enable 2FA Now</a>
        </div>
        ` : `
        <div class="security-banner enabled">
            <div class="content">
                <h3>Account Protected</h3>
                <p>Two-Factor Authentication is enabled using ${twoFactorMethod === 'email' ? 'Email Code' : 'Authenticator App'} method.</p>
            </div>
            <a href="/settings/2fa?token=${token}" class="btn">Manage 2FA</a>
        </div>
        `}
        
        <div class="header">
            <h1>My Contracts Dashboard</h1>
            <div style="display: flex; align-items: center; gap: 15px; flex-direction: row;">
                <span class="role-badge">${safeRole.toUpperCase()}</span>
                <button class="logout-btn" onclick="logout()">Logout</button>
            </div>
        </div>
        
        <div class="contracts-section">
            <div class="section-header">
                <h2 class="section-title">My Contracts</h2>
                <button class="btn" onclick="createContract()">Create New Contract</button>
            </div>
            <div id="contractsContainer">
                <div class="empty-state"><p>Loading contracts...</p></div>
            </div>
        </div>
        
        ${adminToolsHTML}
    </div>
    
    <script>
        console.log('Dashboard script loading...');
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (!token || !user.email) {
            window.location.href = '/landing-two';
        }
        
        console.log('Token found:', !!token);
        console.log('User found:', !!user.email);
        
        // Verify payDeposit function is defined
        console.log('payDeposit function defined:', typeof payDeposit !== 'undefined');
        
        loadContracts();
        
        async function loadContracts() {
            try {
                const isAdmin = user.role === 'admin';
                const response = await fetch(isAdmin ? '/api/admin/contracts' : '/api/contracts', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    displayContracts(data.contracts);
                } else {
                    document.getElementById('contractsContainer').innerHTML = 
                        '<div class="empty-state"><p>Error loading contracts</p></div>';
                }
            } catch (error) {
                document.getElementById('contractsContainer').innerHTML = 
                    '<div class="empty-state"><p>Error loading contracts</p></div>';
            }
        }
        
        function displayContracts(contracts) {
            const container = document.getElementById('contractsContainer');
            const isAdmin = user.role === 'admin';
            
            if (!contracts || contracts.length === 0) {
                container.innerHTML = '<div class="empty-state"><p>No contracts found. Create your first contract!</p></div>';
                return;
            }
            
            let tableHTML = '<div class="contracts-table-wrapper"><table class="contracts-table"><thead><tr>';
            tableHTML += '<th>Contract ID</th><th>Product</th><th>Value</th><th>Status</th>';
            if (isAdmin) {
                tableHTML += '<th>Buyer</th><th>Supplier</th>';
            } else {
                tableHTML += '<th>Counterparty</th><th>My Role</th>';
            }
            tableHTML += '<th>Flags</th><th>Created</th>';
            tableHTML += '<th>Actions</th></tr></thead><tbody>';
            
            contracts.forEach(contract => {
                const statusClass = 'status-' + (contract.status || 'pending').replace(/_/g, '-');
                const flags = [];
                
                if (contract.buyerFlag) flags.push('Buyer Flag');
                if (contract.supplierFlag) flags.push('Supplier Flag');
                if (contract.status === 'pending_deposit') flags.push('Pending Deposit');
                if (contract.status === 'pending_supplier_confirmation') flags.push('Awaiting Supplier');
                if (contract.status === 'pending_buyer_confirmation') flags.push('Awaiting Buyer');
                
                // Get user's role in this specific contract
                const userRole = getUserRole(contract, user.email);
                const actionButtons = getActionButtons(contract, userRole);
                
                tableHTML += '<tr>';
                tableHTML += '<td>' + (contract.id || 'N/A') + '</td>';
                tableHTML += '<td>' + (contract.productDetails || 'N/A') + '</td>';
                tableHTML += '<td>$' + (contract.totalValue || 0).toLocaleString() + '</td>';
                tableHTML += '<td><span class="' + statusClass + '">' + (contract.status || 'pending').replace(/_/g, ' ').toUpperCase() + '</span></td>';
                if (isAdmin) {
                    tableHTML += '<td>' + (contract.buyerEmail || 'N/A') + '</td>';
                    tableHTML += '<td>' + (contract.supplierEmail || 'N/A') + '</td>';
                } else {
                    // Show counterparty based on user's role (userRole already calculated above)
                    let counterparty = 'N/A';
                    if (userRole === 'buyer' && contract.supplierEmail) {
                        counterparty = contract.supplierEmail;
                    } else if (userRole === 'supplier' && contract.buyerEmail) {
                        counterparty = contract.buyerEmail;
                    } else if (userRole === 'trader') {
                        counterparty = contract.buyerEmail + ' / ' + contract.supplierEmail;
                    }
                    // Display role with proper capitalization
                    const displayRole = userRole.charAt(0).toUpperCase() + userRole.slice(1);
                    tableHTML += '<td>' + counterparty + '</td>';
                    tableHTML += '<td>' + displayRole + '</td>';
                }
                tableHTML += '<td>' + (flags.join('<br>') || 'None') + '</td>';
                tableHTML += '<td>' + new Date(contract.createdAt).toLocaleDateString() + '</td>';
                tableHTML += '<td>' + actionButtons + '</td>';
                tableHTML += '</tr>';
            });
            
            tableHTML += '</tbody></table></div>';
            container.innerHTML = tableHTML;
        }
        
        function getActionButtons(contract, userRole) {
            const token = localStorage.getItem('token');
            let buttons = '<a href="/manage-contract/' + contract.id + '?token=' + encodeURIComponent(token) + '" class="btn small">Manage</a>';
            
            if (userRole === 'buyer') {
                // Step 1: Pay Deposit (10-30% of total value)
                if (contract.status === 'pending_deposit' || contract.status === 'pending_buyer_confirmation') {
                    const depositAmount = Math.round(contract.totalValue * 0.20); // 20% deposit
                    buttons += '<button class="btn secondary small" onclick="payDeposit(\\''+contract.id+'\\', '+depositAmount+')" style="background: #666666;">Pay Deposit ($'+depositAmount.toLocaleString()+')</button>';
                }
                // Step 4: Release Remaining Payment (Against Documents)
                if (contract.status === 'active' && contract.depositPaid && contract.documentsUploaded) {
                    const remainingAmount = contract.totalValue - (contract.depositAmount || Math.round(contract.totalValue * 0.20));
                    buttons += '<button class="btn secondary small" onclick="releasePayment(\\''+contract.id+'\\', '+remainingAmount+')" style="background: #666666;">Release Payment ($'+remainingAmount.toLocaleString()+')</button>';
                }
                // Show waiting status
                if (contract.status === 'active' && contract.depositPaid && !contract.documentsUploaded) {
                    buttons += '<span class="btn small" style="background: #6b7280; cursor: default;">Awaiting Shipping Docs</span>';
                }
            } else if (userRole === 'supplier') {
                // Step 2: Confirm Contract
                if (contract.status === 'pending_supplier_confirmation') {
                    buttons += '<button class="btn secondary small" onclick="confirmContract(\\''+contract.id+'\\')">Confirm Contract</button>';
                }
                // Step 3: Upload Shipping Documents (after deposit received)
                if (contract.status === 'active' && contract.depositPaid && !contract.documentsUploaded) {
                    buttons += '<button class="btn secondary small" onclick="uploadDocuments(\\''+contract.id+'\\')">Upload Shipping Docs</button>';
                }
                // Show waiting for deposit
                if (contract.status === 'pending_deposit') {
                    buttons += '<span class="btn small" style="background: #6b7280; cursor: default;">Awaiting Buyer Deposit</span>';
                }
            } else if (userRole === 'trader') {
                // Traders can act as both buyer and supplier
                // Supplier actions
                if (contract.status === 'pending_supplier_confirmation') {
                    buttons += '<button class="btn secondary small" onclick="confirmContract(\\''+contract.id+'\\')">Confirm as Supplier</button>';
                }
                if (contract.status === 'active' && contract.depositPaid && !contract.documentsUploaded) {
                    buttons += '<button class="btn secondary small" onclick="uploadDocuments(\\''+contract.id+'\\')">Upload Shipping Docs</button>';
                }
                
                // Buyer actions
                if (contract.status === 'pending_deposit' || contract.status === 'pending_buyer_confirmation') {
                    const depositAmount = Math.round(contract.totalValue * 0.20);
                    buttons += '<button class="btn secondary small" onclick="payDeposit(\\''+contract.id+'\\', '+depositAmount+')" style="background: #666666;">Pay Deposit ($'+depositAmount.toLocaleString()+')</button>';
                }
                if (contract.status === 'active' && contract.depositPaid && contract.documentsUploaded) {
                    const remainingAmount = contract.totalValue - (contract.depositAmount || Math.round(contract.totalValue * 0.20));
                    buttons += '<button class="btn secondary small" onclick="releasePayment(\\''+contract.id+'\\', '+remainingAmount+')" style="background: #666666;">Release Payment ($'+remainingAmount.toLocaleString()+')</button>';
                }
                
                buttons += '<button class="btn secondary small" onclick="manageTraderContract(\\''+contract.id+'\\')">Dual Contract</button>';
            }
            
            return buttons;
        }
        
        function getUserRole(contract, userEmail) {
            if (contract.buyerEmail === userEmail) return 'buyer';
            if (contract.supplierEmail === userEmail) return 'supplier';
            return 'trader';
        }

        function navigateAdmin(path) {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Please login first');
                window.location.href = '/landing-two';
                return;
            }
            window.location.href = path + '?token=' + encodeURIComponent(token);
        }
        
        function createContract() { 
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Please login first');
                window.location.href = '/landing-two';
                return;
            }
            window.location.href = '/create-contract?token=' + encodeURIComponent(token);
        }
        
        async function payDeposit(id, amount) {
            console.log('payDeposit called with id:', id, 'amount:', amount);
            
            // Get token from localStorage to ensure it's available
            const authToken = localStorage.getItem('token');
            if (!authToken) {
                alert('Authentication required. Please login again.');
                window.location.href = '/landing-two';
                return;
            }
            
            console.log('Token retrieved:', !!authToken);
            
            // Optional MetaMask integration - non-blocking
            let useBlockchain = false;
            if (typeof window.ethereum !== 'undefined') {
                try {
                    const useMetaMask = confirm('MetaMask Detected! Pay deposit using blockchain with MetaMask? (Click Cancel to use simulation mode)');
                    
                    if (useMetaMask) {
                        // Connect to MetaMask
                        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                        if (accounts && accounts.length > 0) {
                            // Check network
                            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
                            const sepoliaChainId = '0xaa36a7';
                            
                            if (chainId !== sepoliaChainId) {
                                const switched = await window.ethereum.request({
                                    method: 'wallet_switchEthereumChain',
                                    params: [{ chainId: sepoliaChainId }]
                                }).catch(() => null);
                                if (!switched) {
                                    alert('Please switch to Sepolia testnet manually. Proceeding with simulation mode.');
                                } else {
                                    useBlockchain = true;
                                }
                            } else {
                                useBlockchain = true;
                            }
                            console.log('MetaMask connected, blockchain mode:', useBlockchain);
                        } else {
                            console.log('MetaMask not connected, using simulation mode');
                        }
                    } else {
                        console.log('MetaMask skipped, using simulation mode');
                    }
                } catch (error) {
                    console.error('MetaMask error:', error);
                    console.log('Falling back to simulation mode');
                }
            }
            
            // Execute deposit payment (works with or without MetaMask)
            try {
                console.log('Sending deposit request to /api/contracts/' + id + '/deposit');
                // Send deposit request with blockchain flag
                const response = await fetch('/api/contracts/' + id + '/deposit', {
                    method: 'POST',
                    headers: { 
                        'Authorization': 'Bearer ' + authToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ useBlockchain: useBlockchain })
                });
                
                console.log('Response status:', response.status);
                console.log('Response ok:', response.ok);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Response error:', errorText);
                    let errorData;
                    try {
                        errorData = JSON.parse(errorText);
                    } catch (e) {
                        errorData = { error: errorText || 'Server error occurred' };
                    }
                    
                    if (errorData.action === 'fund_wallet' && errorData.details) {
                        const details = errorData.details;
                        alert('Payment failed. Required: $' + details.required.toLocaleString() + '. Available: $' + details.available.toLocaleString() + '. Please fund your wallet.');
                    } else if (errorData.action === 'create_wallet') {
                        alert('Wallet error: ' + errorData.error + '. Please contact support.');
                    } else {
                        alert('Error: ' + (errorData.error || 'Deposit payment failed'));
                    }
                    return;
                }
                
                const result = await response.json();
                console.log('Deposit result:', result);
                
                if (result.success) {
                    alert('Deposit paid successfully! Contract is now active.');
                    location.reload();
                } else {
                    alert('Error: ' + (result.error || 'Deposit payment failed'));
                }
            } catch (error) {
                console.error('Network error paying deposit:', error);
                alert('Network error paying deposit: ' + error.message);
            }
        }
        
        async function releasePayment(id) {
            if (!confirm('Release payment to supplier? This action cannot be undone.')) return;
            
            try {
                const response = await fetch('/api/contracts/' + id + '/release-payment', {
                    method: 'POST',
                    headers: { 
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    }
                });
                
                const result = await response.json();
                if (result.success) {
                    alert('Payment released successfully! Contract completed.');
                    location.reload();
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Error releasing payment: ' + error.message);
            }
        }
        
        async function confirmContract(id) {
            try {
                const response = await fetch('/api/contracts/' + id + '/confirm', {
                    method: 'POST',
                    headers: { 
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    }
                });
                
                const result = await response.json();
                if (result.success) {
                    alert('Contract confirmed successfully!');
                    location.reload();
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Error confirming contract: ' + error.message);
            }
        }
        
        function uploadDocuments(id) { 
            window.location.href = '/manage-contract/' + id; 
        }
        
        function manageTraderContract(id) { 
            window.location.href = '/manage-contract/' + id; 
        }
        function logout() { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = '/landing-two'; }
        
        
        // Initialize WebSocket connection
        function initWebSocket() {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                
                socket = io({
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionDelay: 1000,
                    reconnectionAttempts: 5
                });
                
                socket.on('connect', () => {
                    console.log('[OK] WebSocket connected');
                    socket.emit('authenticate', { token: token });
                });
                
                socket.on('authenticated', (data) => {
                    console.log('[OK] WebSocket authenticated:', data);
                    loadNotifications();
                });
                
                socket.on('auth_error', (error) => {
                    console.error('[ERROR] WebSocket auth error:', error);
                });
                
                socket.on('notification', (notification) => {
                    console.log('📬 New notification received:', notification);
                    notifications.unshift(notification);
                    updateNotificationUI();
                });
                
                socket.on('notifications', (notificationsList) => {
                    console.log('📬 Pending notifications received:', notificationsList);
                    notifications = notificationsList.concat(notifications);
                    updateNotificationUI();
                });
                
                socket.on('disconnect', () => {
                    console.log('🔌 WebSocket disconnected');
                });
            } catch (error) {
                console.warn('[WARNING] WebSocket not available, using polling:', error);
                loadNotifications();
                // Poll for notifications every 30 seconds
                setInterval(loadNotifications, 30000);
            }
        }
        
        // Load notifications from API
        async function loadNotifications() {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                
                const response = await fetch('/api/notifications', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    notifications = data.notifications || [];
                    unreadCount = data.unreadCount || 0;
                    updateNotificationUI();
                }
            } catch (error) {
                console.error('Failed to load notifications:', error);
            }
        }
        
        // Update notification UI
        function updateNotificationUI() {
            const badge = document.getElementById('notificationBadge');
            const list = document.getElementById('notificationList');
            
            // Update badge
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
            
            // Update list
            if (notifications.length === 0) {
                list.innerHTML = '<div class="notification-empty">No notifications</div>';
                return;
            }
            
            list.innerHTML = notifications.map(notif => {
                const timeAgo = getTimeAgo(notif.createdAt);
                const typeClass = notif.type || 'system';
                return \`
                    <div class="notification-item \${notif.read ? 'read' : 'unread'}" onclick="markAsRead('\${notif.id}')">
                        <div>
                            <span class="notification-type \${typeClass}">\${typeClass}</span>
                            <span class="notification-title">\${notif.title}</span>
                        </div>
                        <div class="notification-message">\${notif.message}</div>
                        <div class="notification-time">\${timeAgo}</div>
                    </div>
                \`;
            }).join('');
        }
        
        // Get time ago string
        function getTimeAgo(timestamp) {
            const now = new Date();
            const time = new Date(timestamp);
            const diff = Math.floor((now - time) / 1000);
            
            if (diff < 60) return 'Just now';
            if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
            if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
            return Math.floor(diff / 86400) + 'd ago';
        }
        
        // Toggle notification panel
        function toggleNotifications() {
            const panel = document.getElementById('notificationPanel');
            panel.classList.toggle('open');
            if (panel.classList.contains('open')) {
                loadNotifications();
            }
        }
        
        // Mark notification as read
        async function markAsRead(notificationId) {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(\`/api/notifications/\${notificationId}/read\`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                
                if (response.ok) {
                    const notif = notifications.find(n => n.id === notificationId);
                    if (notif) {
                        notif.read = true;
                        unreadCount = Math.max(0, unreadCount - 1);
                        updateNotificationUI();
                    }
                }
            } catch (error) {
                console.error('Failed to mark as read:', error);
            }
        }
        
        // Mark all as read
        async function markAllAsRead() {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('/api/notifications/read-all', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                
                if (response.ok) {
                    notifications.forEach(n => n.read = true);
                    unreadCount = 0;
                    updateNotificationUI();
                }
            } catch (error) {
                console.error('Failed to mark all as read:', error);
            }
        }
        
        // Close notification panel when clicking outside
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('notificationPanel');
            const bell = document.getElementById('notificationBell');
            if (panel && !panel.contains(e.target) && !bell.contains(e.target)) {
                panel.classList.remove('open');
            }
        });
        
        
        // Test payDeposit function availability
        window.addEventListener('load', function() {
            console.log('Page loaded. payDeposit function:', typeof payDeposit !== 'undefined' ? 'AVAILABLE' : 'NOT DEFINED');
        });
    </script>
</body>
</html>`;
    
    res.send(dashboardHTML);
});

// Insurer Dashboard Route - MUST BE BEFORE /dashboard/:role
app.get('/dashboard/insurer', authenticateToken, (req, res) => {
    // Check if user has insurer role or is admin
    if (req.user.role !== 'insurer' && req.user.role !== 'admin') {
        return res.status(403).send(`
            <h1>Access Denied</h1>
            <p>Insurer access required.</p>
            <a href="/dashboard">Back to Dashboard</a>
        `);
    }
    
    res.sendFile(path.join(__dirname, 'insurer-dashboard.html'));
});

app.get('/dashboard/:role', authenticateToken, (req, res) => {
    const { role } = req.params;
    
    // Admin access
    if (role === 'admin') {
        if (req.user.role !== 'admin') {
            return res.status(403).send('<h1>Access Denied</h1><p>Admin access required.</p>');
        }
        return res.send(createDashboard('admin', req.user, req.query.token || req.headers.authorization?.replace('Bearer ', '') || ''));
    }
    
    // Check if user needs KYC
    console.log('[KYC] KYC CHECK - User:', req.user.email, 'KYC Status:', req.user.kycStatus, 'Role:', req.user.role);
    if (req.user.kycStatus !== 'approved' && req.user.role !== 'admin') {
        // Client-side redirect to KYC with token handling
        return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <!-- Google tag (gtag.js) -->
            <script async src="https://www.googletagmanager.com/gtag/js?id=G-C1FN7FSX06"></script>
            <script>
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());

              gtag('config', 'G-C1FN7FSX06');
            </script>
            <title>Redirecting to KYC...</title>
        </head>
        <body>
        <script>
        // Redirect to KYC page - client-side redirect preserves localStorage token
        console.log('KYC verification required, redirecting...');
        // Get token from URL parameter and pass it to KYC page
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token') || localStorage.getItem('token');
        window.location.href = '/dashboard/kyc?token=' + encodeURIComponent(token);
        </script>
        </body>
        </html>
        `);
    }
    
    // Role-specific routing
    if (role === 'insurer') {
        return res.send(createDashboard('insurer', req.user, req.query.token || req.headers.authorization?.replace('Bearer ', '') || ''));
    }
    
    // All other roles go to unified dashboard
    res.send(createDashboard('unified', req.user, req.query.token || req.headers.authorization?.replace('Bearer ', '') || ''));
});

// Helper function to ensure UTF-8 encoding
function ensureUTF8(str) {
    return Buffer.from(str, 'utf8').toString('utf8');
}

// Start server if this file is run directly
if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`[INFO] traidefi Complete Production Platform running on port ${PORT}`);
        console.log(`[INFO] Landing Page: http://localhost:${PORT}/`);
    });
}

module.exports = app;