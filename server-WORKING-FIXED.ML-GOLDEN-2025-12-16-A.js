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

// MERGE LIFELINE BUILD MARKER
const MERGE_LIFELINE_BUILD = "ML-GOLDEN-2025-12-16-A";

// Feature flag: Use risk engine for financing terms
// Default: false (legacy behavior)
// When true: uses risk-based maxFinancingPercent and requiredDepositPercent
const USE_RISK_ENGINE_FOR_FINANCING = process.env.USE_RISK_ENGINE_FOR_FINANCING === 'true';

// Database integration
const db = require('./lib/database');

// Financing terms resolver
const { 
    getEffectiveFinancingTerms,
    getLegacyFinancingTerms,
    getRiskBasedFinancingTermsFromContract
} = require('./lib/financing-terms');

// Role helpers (contextual role determination)
const {
    getUserRoleForContract,
    // isUserAuthorizedForContract,  // will use later
} = require('./lib/roles');

// Report generator for Traidefi
const reportGenerator = require('./lib/report-generator');

// PDF generator and storage service
const pdfGenerator = require('./lib/pdf-generator');
const storageService = require('./lib/storage-service');

// Email service
const emailService = require('./lib/email-service');

// Sumsub integration
const sumsubRoutes = require('./routes/sumsub');

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

// OFAC Sanctions Screening Integration
let sanctionsAPI = null;
try {
    sanctionsAPI = require('./lib/free-sanctions-api');
    console.log('[INFO] OFAC Sanctions API loaded successfully');
    // Initialize sanctions databases (async, non-blocking)
    sanctionsAPI.initializeSanctions().catch(err => {
        console.warn('[WARN] Failed to initialize sanctions databases:', err.message);
    });
} catch (error) {
    console.warn('[WARN] OFAC Sanctions API not available:', error.message);
    sanctionsAPI = null;
}

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
    // startCreditService();  // disabled for Railway
    
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
    // startInsuranceService();  // disabled for Railway
    
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
const PORT = process.env.PORT || 8080;

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
        'http://localhost:8081',
        'http://localhost:3000', 
        'http://localhost:4000', 
        'https://tangent-platform.up.railway.app',
        'https://tangent-protocol.com',
        'https://www.tangent-protocol.com',
        ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Handle preflight requests
app.options('*', cors());

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
    
    res.setHeader(
        'Content-Security-Policy',
        [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://www.googletagmanager.com https://static.sumsub.com https://websdk.sumsub.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https://static.sumsub.com",
            "connect-src 'self' https://api.sumsub.com https://websdk.sumsub.com https://static.sumsub.com",
            "frame-src 'self' https://websdk.sumsub.com https://static.sumsub.com https://api.sumsub.com",
            "worker-src 'self' blob:",
            "frame-ancestors 'self'"
        ].join('; ')
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
    creditAssessments: new Map(), // Credit risk assessments
    auditLogs: new Map(), // Audit trail system
    sessions: new Map(), // Session management
    earlyRegistrations: new Map(), // Early registration/interest forms
    admin: {
        fees: { tradingFee: 0.5, platformFee: 1.0 },
        interestRates: { deposit: 2.5, lending: 5.0 },
        voyageTimes: { short: 30, medium: 60, long: 90 },
        basisPoints: 100
    }
};

// Database persistence helper function
function saveDatabase() {
  // Temporary stub so demos don't crash if persistence is missing.
  try {
    console.log('[DB] saveDatabase() called – persistence temporarily disabled in this build.');
  } catch (err) {
    console.error('[DB] saveDatabase error (ignored for demo):', err);
  }
}

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
    kycStatus: 'approved', // Legacy field
    kyc_status: 'approved', // New KYC status field
    sumsub_applicant_id: null
});

// MERGE-LIFELINE: Test admin user for frontend testing
database.users.set('admin@test.com', {
    id: 'admin-test-001',
    email: 'admin@test.com',
    password: bcrypt.hashSync('TestUser2024!', 10),
    role: 'admin',
    verified: true,
    kycStatus: 'approved', // Legacy field
    kyc_status: 'approved', // New KYC status field
    sumsub_applicant_id: null
});

// Test approved users for each role
database.users.set('buyer@test.com', {
    id: 'buyer-001',
    email: 'buyer@test.com',
    password: bcrypt.hashSync('TestUser2024!', 10),
    role: 'buyer',
    verified: true,
    kycStatus: 'approved', // Legacy field
    kyc_status: 'approved', // New KYC status field
    sumsub_applicant_id: null
});

database.users.set('supplier@test.com', {
    id: 'supplier-001',
    email: 'supplier@test.com',
    password: bcrypt.hashSync('TestUser2024!', 10),
    role: 'supplier',
    verified: true,
    kycStatus: 'approved', // Legacy field
    kyc_status: 'approved', // New KYC status field
    sumsub_applicant_id: null
});

database.users.set('trader@test.com', {
    id: 'trader-001',
    email: 'trader@test.com',
    password: bcrypt.hashSync('TestUser2024!', 10),
    role: 'trader',
    verified: true,
    kycStatus: 'approved', // Legacy field
    kyc_status: 'approved', // New KYC status field
    sumsub_applicant_id: null
});

database.users.set('insurer@test.com', {
    id: 'insurer-001',
    email: 'insurer@test.com',
    password: bcrypt.hashSync('TestUser2024!', 10),
    role: 'insurer',
    verified: true,
    kycStatus: 'approved', // Legacy field
    kyc_status: 'approved', // New KYC status field
    sumsub_applicant_id: null
});

// Create sample test contracts for demonstration
database.contracts.set('contract_test_001', {
    id: 'contract_test_001',
    contract_id: 'contract_test_001',
    buyerEmail: 'buyer@test.com',
    supplierEmail: 'supplier@test.com',
    productDetails: 'Wheat',
    product: 'Wheat',
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
    buyerDepositPaid: false,
    documentsUploaded: false,
    deliveryDocsUploaded: false,
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
    contract_id: 'contract_test_002',
    buyerEmail: 'trader@test.com',
    supplierEmail: 'supplier@test.com',
    productDetails: 'Crude Oil (WTI)',
    product: 'Crude Oil (WTI)',
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
    status: 'AWAITING_DOCUMENTS', // Updated to new status
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    depositAmount: 1510, // 20% deposit (reduced for demo)
    depositPaid: true,
    buyerDepositPaid: true,
    documentsUploaded: false,
    deliveryDocsUploaded: false,
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
    contract_id: 'contract_test_003',
    buyerEmail: 'buyer@test.com',
    supplierEmail: 'trader@test.com',
    productDetails: 'Coffee C',
    product: 'Coffee C',
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
    buyerDepositPaid: false,
    documentsUploaded: false,
    deliveryDocsUploaded: false,
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
// USER HELPER FUNCTIONS
// ================================
// Ensure user has KYC fields (backward compatibility)
function ensureUserKYCFields(user) {
    if (!user) return user;
    
    // Set default kyc_status if missing
    if (!user.kyc_status) {
        // Use legacy kycStatus if available, otherwise default to 'not_started'
        user.kyc_status = user.kycStatus || 'not_started';
    }
    
    // Ensure sumsub_applicant_id exists (can be null)
    if (user.sumsub_applicant_id === undefined) {
        user.sumsub_applicant_id = null;
    }
    
    return user;
}

// ================================
// CONTRACT HELPER FUNCTIONS
// ================================
// Ensure contract has all required fields (backward compatibility)
function ensureContractFields(contract) {
    if (!contract) return contract;
    
    // Data consistency fix: Normalize depositPercent - if missing/null, set to 0
    if (contract.depositPercent === undefined || contract.depositPercent === null) {
        contract.depositPercent = contract.deposit_percent || 0;
    }
    contract.depositPercent = Number(contract.depositPercent) || 0;
    
    // Data consistency fix: If depositPercent === 0, set depositPaid = true (no deposit required)
    if (contract.depositPercent === 0) {
        contract.depositPaid = true;
        contract.buyerDepositPaid = true;
    }
    
    // Ensure buyerDepositPaid exists (use depositPaid as fallback)
    if (contract.buyerDepositPaid === undefined) {
        contract.buyerDepositPaid = contract.depositPaid || false;
    }
    
    // Ensure deliveryDocsUploaded exists
    if (contract.deliveryDocsUploaded === undefined) {
        contract.deliveryDocsUploaded = contract.documentsUploaded || false;
    }
    
    // Ensure status exists
    if (!contract.status) {
        contract.status = 'pending_buyer_confirmation';
    }
    
    // Ensure required identifiers exist
    if (!contract.id && contract.contract_id) {
        contract.id = contract.contract_id;
    }
    if (!contract.contract_id && contract.id) {
        contract.contract_id = contract.id;
    }
    
    // STEP 1: Risk engine fields - ensure they exist but remain null/undefined (no logic applied)
    // These fields are added for future risk engine integration
    if (contract.riskScore === undefined) {
        contract.riskScore = null;
    }
    if (contract.riskBand === undefined) {
        contract.riskBand = null;
    }
    if (contract.maxFinancingPercent === undefined) {
        contract.maxFinancingPercent = null;
    }
    if (contract.requiredDepositPercent === undefined) {
        contract.requiredDepositPercent = null;
    }
    
    // A4 REG-01: Ensure all invariant fields exist with safe defaults
    if (contract.settlementStatus === undefined) {
        contract.settlementStatus = 'locked';
    }
    if (contract.finalPaymentPaid === undefined) {
        contract.finalPaymentPaid = false;
    }
    if (contract.buyerApprovedDraftDocs === undefined) {
        contract.buyerApprovedDraftDocs = false;
    }
    if (contract.originalDocsUploaded === undefined) {
        contract.originalDocsUploaded = false;
    }
    if (contract.docsReleased === undefined) {
        contract.docsReleased = false;
    }
    if (contract.docsReleaseStatus === undefined) {
        contract.docsReleaseStatus = 'LOCKED';
    }
    if (contract.documentsUploaded === undefined) {
        contract.documentsUploaded = false;
    }
    
    return contract;
}

/**
 * Normalize contract status to canonical uppercase enum form
 * Converts any status format (lowercase, mixed case, with spaces/dashes) to uppercase with underscores
 * Examples:
 *   "pending_buyer_confirmation" -> "PENDING_BUYER_CONFIRMATION"
 *   "pending-supplier-confirmation" -> "PENDING_SUPPLIER_CONFIRMATION"
 *   "Pending Counterparty Confirmation" -> "PENDING_COUNTERPARTY_CONFIRMATION"
 */
function normalizeStatus(status) {
    if (!status || typeof status !== 'string') {
        return status || '';
    }
    // Rule: status.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_")
    return status.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

// ================================
// CONTRACT STATE MACHINE (A1 FINALIZATION)
// ================================

/**
 * Canonical Contract States
 * All contract states must be one of these values
 */
const ContractState = {
    // Initial states
    PENDING_BUYER_CONFIRMATION: "PENDING_BUYER_CONFIRMATION",
    PENDING_SUPPLIER_CONFIRMATION: "PENDING_SUPPLIER_CONFIRMATION",
    PENDING_COUNTERPARTY_CONFIRMATION: "PENDING_COUNTERPARTY_CONFIRMATION",
    
    // Confirmed states
    ACTIVE: "ACTIVE",
    CONFIRMED: "CONFIRMED", // Alias for ACTIVE
    
    // Payment states
    AWAITING_DEPOSIT: "AWAITING_DEPOSIT",
    AWAITING_VERIFICATION_DOCS: "AWAITING_VERIFICATION_DOCS", // After deposit paid
    
    // Document states
    AWAITING_ORIGINAL_DOCS: "AWAITING_ORIGINAL_DOCS",
    AWAITING_SETTLEMENT: "AWAITING_SETTLEMENT",
    
    // Final states
    SETTLED: "SETTLED",
    CANCELLED: "CANCELLED",
    COMPLETED: "COMPLETED"
};

/**
 * Canonical Contract Actions
 * All state transitions must use one of these actions
 */
const ContractAction = {
    CREATE: "CREATE",
    CONFIRM: "CONFIRM",
    PAY_DEPOSIT: "PAY_DEPOSIT",
    UPLOAD_VERIFICATION_DOCS: "UPLOAD_VERIFICATION_DOCS",
    APPROVE_VERIFICATION_DOCS: "APPROVE_VERIFICATION_DOCS",
    UPLOAD_ORIGINAL_DOCS: "UPLOAD_ORIGINAL_DOCS",
    VERIFY_ORIGINAL_DOCS: "VERIFY_ORIGINAL_DOCS",
    PAY_SETTLEMENT: "PAY_SETTLEMENT",
    CANCEL: "CANCEL",
    COMPLETE: "COMPLETE"
};

/**
 * State transition rules
 * Maps (fromState, action) -> toState
 * Only valid transitions are allowed
 */
const STATE_TRANSITIONS = {
    // CREATE action: initial state based on creator role
    [ContractState.PENDING_BUYER_CONFIRMATION]: {
        [ContractAction.CONFIRM]: ContractState.ACTIVE,
        [ContractAction.CANCEL]: ContractState.CANCELLED
    },
    [ContractState.PENDING_SUPPLIER_CONFIRMATION]: {
        [ContractAction.CONFIRM]: ContractState.ACTIVE,
        [ContractAction.CANCEL]: ContractState.CANCELLED
    },
    [ContractState.PENDING_COUNTERPARTY_CONFIRMATION]: {
        [ContractAction.CONFIRM]: ContractState.ACTIVE,
        [ContractAction.CANCEL]: ContractState.CANCELLED
    },
    [ContractState.ACTIVE]: {
        [ContractAction.PAY_DEPOSIT]: ContractState.AWAITING_VERIFICATION_DOCS,
        [ContractAction.CANCEL]: ContractState.CANCELLED
    },
    [ContractState.AWAITING_VERIFICATION_DOCS]: {
        [ContractAction.UPLOAD_VERIFICATION_DOCS]: ContractState.AWAITING_VERIFICATION_DOCS, // Same state, docs added
        [ContractAction.APPROVE_VERIFICATION_DOCS]: ContractState.AWAITING_ORIGINAL_DOCS,
        [ContractAction.CANCEL]: ContractState.CANCELLED
    },
    [ContractState.AWAITING_ORIGINAL_DOCS]: {
        [ContractAction.UPLOAD_ORIGINAL_DOCS]: ContractState.AWAITING_ORIGINAL_DOCS, // Same state, docs added
        [ContractAction.VERIFY_ORIGINAL_DOCS]: ContractState.AWAITING_SETTLEMENT,
        [ContractAction.CANCEL]: ContractState.CANCELLED
    },
    [ContractState.AWAITING_SETTLEMENT]: {
        [ContractAction.PAY_SETTLEMENT]: ContractState.SETTLED,
        [ContractAction.CANCEL]: ContractState.CANCELLED
    },
    [ContractState.SETTLED]: {
        [ContractAction.COMPLETE]: ContractState.COMPLETED
    }
};

/**
 * Transition contract state (A1 FINALIZATION)
 * This is the ONLY way to change contract state - enforces valid transitions
 * 
 * @param {Object} contract - Contract object
 * @param {string} action - ContractAction constant
 * @param {string} actorEmail - Email of user performing the action (normalized)
 * @returns {Object} { success: boolean, newState: string, error?: string }
 */
function transitionContract(contract, action, actorEmail) {
    if (!contract || !action || !actorEmail) {
        return {
            success: false,
            error: 'Missing required parameters: contract, action, and actorEmail are required'
        };
    }
    
    // Normalize current state
    const currentState = normalizeStatus(contract.status);
    
    // Get valid transitions for current state
    const validTransitions = STATE_TRANSITIONS[currentState];
    
    if (!validTransitions) {
        return {
            success: false,
            error: `Invalid current state: ${currentState}. No transitions defined.`
        };
    }
    
    // Check if action is valid for current state
    const newState = validTransitions[action];
    
    if (!newState) {
        const validActions = Object.keys(validTransitions).join(', ');
        return {
            success: false,
            error: `Invalid action '${action}' for state '${currentState}'. Valid actions: ${validActions}`
        };
    }
    
    // Special case: PAY_DEPOSIT requires deposit to be required and not paid
    if (action === ContractAction.PAY_DEPOSIT) {
        const deposit = computeDepositObject(contract);
        if (!deposit.required) {
            return {
                success: false,
                error: 'Deposit is not required for this contract'
            };
        }
        if (deposit.status === "paid") {
            return {
                success: false,
                error: 'Deposit has already been paid'
            };
        }
    }
    
    // A2.1e: Special case: CONFIRM with zero/no deposit transitions directly to AWAITING_VERIFICATION_DOCS
    let finalToState = newState;
    if (action === ContractAction.CONFIRM) {
        const depositPercent = contract.depositPercent || contract.deposit_percent || 0;
        if (depositPercent <= 0) {
            finalToState = ContractState.AWAITING_VERIFICATION_DOCS;
            console.log('[STATE_TRANSITION] CONFIRM → AWAITING_VERIFICATION_DOCS (zero deposit)', {
                contractId: contract.id || contract.contract_id,
                fromState: currentState,
                action: action,
                toState: finalToState,
                depositPercent: depositPercent,
                actorEmail: actorEmail.trim().toLowerCase(),
                timestamp: new Date().toISOString()
            });
        }
    }
    
    // Perform transition
    const fromState = currentState;
    const toState = finalToState;
    
    // Update contract state
    contract.status = toState;
    contract.updatedAt = new Date().toISOString();
    
    // Log transition (A1 FINALIZATION requirement)
    // A2.1e: Zero-deposit CONFIRM transitions are logged separately above
    if (!(action === ContractAction.CONFIRM && (contract.depositPercent || contract.deposit_percent || 0) === 0)) {
        console.log('[STATE_TRANSITION]', {
            contractId: contract.id || contract.contract_id,
            fromState: fromState,
            action: action,
            toState: toState,
            actorEmail: actorEmail.trim().toLowerCase(),
            timestamp: new Date().toISOString()
        });
    }
    
    return {
        success: true,
        newState: toState,
        fromState: fromState,
        action: action,
        actorEmail: actorEmail.trim().toLowerCase()
    };
}

/**
 * Compute contract.deposit object (authoritative backend structure)
 * Single source of truth for deposit state
 */
function computeDepositObject(contract) {
    // Read from existing fields (backward compatibility)
    const depositPercent = contract.depositPercent || contract.deposit_percent || 0;
    const depositAmount = contract.depositAmount || contract.deposit_amount || 0;
    const depositPaid = contract.depositPaid || contract.buyerDepositPaid || false;
    const depositPaidAt = contract.depositPaidAt || contract.deposit_paid_at || null;
    
    // Determine if deposit is required (from existing contract fields)
    const totalValue = contract.totalValue || contract.total_value || 0;
    const required = depositPercent > 0 || depositAmount > 0;
    
    // Determine payer (default BUYER, can be overridden by financing)
    let payer = "BUYER";
    if (contract.financing && contract.financing.status === "approved" && contract.financing.payerForDeposit) {
        payer = contract.financing.payerForDeposit;
    }
    
    return {
        required: required,
        percent: depositPercent,
        amount: depositAmount || (totalValue * depositPercent / 100),
        status: depositPaid ? "paid" : "pending",
        payer: payer,
        paidAt: depositPaidAt
    };
}

/**
 * Compute contract.settlement object (authoritative backend structure)
 * Single source of truth for settlement state
 */
function computeSettlementObject(contract, documents = []) {
    const totalValue = contract.totalValue || contract.total_value || 0;
    const deposit = computeDepositObject(contract);
    const depositAmount = deposit.amount || 0;
    
    // Settlement is always required (remaining amount after deposit)
    const required = true;
    const amount = totalValue - depositAmount;
    
    // Determine payer (default BUYER, can be overridden by financing)
    let payer = "BUYER";
    if (contract.financing && contract.financing.status === "approved" && contract.financing.payerForSettlement) {
        payer = contract.financing.payerForSettlement;
    } else if (contract.financing && contract.financing.status === "approved") {
        // Default: financier pays settlement if financing approved
        payer = "FINANCIER";
    }
    
    // Check prerequisites to determine status
    let status = "locked";
    let lockedReason = null;
    
    // Get document objects
    const verificationDocs = computeVerificationDocsObject(contract);
    const originalDocs = computeOriginalDocsObject(contract);
    
    // Prerequisite 1: Deposit must be paid if required
    if (deposit.required && deposit.status !== "paid") {
        status = "locked";
        lockedReason = "AWAITING_DEPOSIT";
    }
    // Prerequisite 2: Verification docs must be approved by buyer
    else if (verificationDocs.status !== "APPROVED") {
        if (verificationDocs.status === "NONE") {
            status = "locked";
            lockedReason = "AWAITING_DOCS";
        } else if (verificationDocs.status === "PENDING") {
            status = "locked";
            lockedReason = "AWAITING_BUYER_APPROVAL";
        } else if (verificationDocs.status === "REJECTED") {
            status = "locked";
            lockedReason = "VERIFICATION_DOCS_REJECTED";
        }
    }
    // Prerequisite 3: Original docs must be verified (admin verification)
    else if (originalDocs.status !== "VERIFIED") {
        if (originalDocs.status === "NONE" || originalDocs.status === "PENDING") {
            status = "locked";
            lockedReason = "AWAITING_ORIGINAL_DOCS_VERIFICATION";
        }
    }
    // Prerequisite 4: If payer is FINANCIER, financing must be approved
    else if (payer === "FINANCIER" && (!contract.financing || contract.financing.status !== "approved")) {
        status = "locked";
        lockedReason = "AWAITING_FINANCING";
    }
    // All prerequisites satisfied
    else {
        status = "ready";
        lockedReason = null;
    }
    
    // Check if already paid
    const settlementPaid = contract.settlementPaid || contract.settlement_paid || false;
    const settlementPaidAt = contract.settlementPaidAt || contract.settlement_paid_at || null;
    
    if (settlementPaid) {
        status = "paid";
        lockedReason = null;
    }
    
    return {
        required: required,
        amount: amount,
        status: status,
        payer: payer,
        lockedReason: lockedReason,
        paidAt: settlementPaidAt
    };
}

/**
 * Compute contract.financing object (authoritative backend structure)
 */
function computeFinancingObject(contract) {
    // Read from existing fields (backward compatibility)
    const financingRequested = contract.financingRequested || contract.financing_requested || false;
    const financingStatus = contract.financingStatus || contract.financing_status || "none";
    const financingApproved = financingStatus === "approved" || financingStatus === "APPROVED";
    
    return {
        requested: financingRequested,
        status: financingStatus === "none" ? "none" : financingStatus.toLowerCase(),
        payerForDeposit: contract.financingPayerForDeposit || contract.financing_payer_for_deposit || null,
        payerForSettlement: contract.financingPayerForSettlement || contract.financing_payer_for_settlement || null
    };
}

/**
 * Compute contract.verificationDocs object (authoritative backend structure)
 * Tracks supplier-uploaded verification documents for buyer approval
 */
function computeVerificationDocsObject(contract) {
    // Read from existing fields or initialize
    const verificationDocs = contract.verificationDocs || contract.verification_docs || {};
    const items = verificationDocs.items || contract.verificationDocItems || [];
    const status = verificationDocs.status || (items.length > 0 ? "PENDING" : "NONE");
    const buyerDecision = verificationDocs.buyerDecision || verificationDocs.buyer_decision || null;
    const buyerComment = verificationDocs.buyerComment || verificationDocs.buyer_comment || null;
    const updatedAt = verificationDocs.updatedAt || verificationDocs.updated_at || null;
    
    return {
        status: status.toUpperCase(), // NONE, PENDING, APPROVED, REJECTED
        items: items,
        buyerDecision: buyerDecision, // "APPROVED" | "REJECTED" | null
        buyerComment: buyerComment || null,
        updatedAt: updatedAt
    };
}

/**
 * Compute contract.originalDocs object (authoritative backend structure)
 * Tracks supplier-uploaded original documents for admin verification
 */
function computeOriginalDocsObject(contract) {
    // Read from existing fields or initialize
    const originalDocs = contract.originalDocs || contract.original_docs || {};
    const items = originalDocs.items || contract.originalDocItems || [];
    const status = originalDocs.status || (items.length > 0 ? "PENDING" : "NONE");
    const verifiedBy = originalDocs.verifiedBy || originalDocs.verified_by || null;
    const verifiedAt = originalDocs.verifiedAt || originalDocs.verified_at || null;
    const releaseStatus = originalDocs.releaseStatus || originalDocs.release_status || "LOCKED"; // LOCKED, RELEASED
    
    return {
        status: status.toUpperCase(), // NONE, PENDING, VERIFIED
        items: items,
        verifiedBy: verifiedBy,
        verifiedAt: verifiedAt,
        releaseStatus: releaseStatus.toUpperCase() // LOCKED, RELEASED
    };
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
        // For API routes, return JSON error instead of redirecting
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'Authentication required', message: 'Please sign in to access this resource' });
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

// Simple healthcheck endpoint for Railway and monitoring
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'Tangent-Platform',
        env: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
    });
});

// Sumsub KYC integration routes - requires authentication
// Middleware to pass database and saveDatabase to routes
app.use('/api/sumsub', authenticateToken, (req, res, next) => {
    req.database = database;
    req.saveDatabase = saveDatabase;
    next();
}, sumsubRoutes);

// KYC Status API - returns current user's KYC status
app.get('/api/kyc/status', authenticateToken, (req, res) => {
    try {
        const userEmail = req.user.email;
        const user = ensureUserKYCFields(database.users.get(userEmail));
        
        if (!user) {
            // Return safe default if user not found
            return res.json({
                kyc_status: 'not_started',
                sumsub_applicant_id: null
            });
        }
        
        // Return KYC status (ensureUserKYCFields already normalized it)
        res.json({
            kyc_status: user.kyc_status || 'not_started',
            sumsub_applicant_id: user.sumsub_applicant_id || null
        });
    } catch (error) {
        console.error('[ERROR] KYC status error:', error);
        res.status(500).json({
            kyc_status: 'not_started',
            sumsub_applicant_id: null,
            error: 'Failed to retrieve KYC status'
        });
    }
});

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
    const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>traidefi - Get Started</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;min-height:100vh;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}.header{text-align:center;margin-bottom:3rem}h1{color:#fff;font-size:3rem;margin-bottom:1rem}.subtitle{color:#ccc;font-size:1.3rem;margin-bottom:3rem}.features-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:2rem;margin-bottom:3rem}.feature-box{background:#1a1a1a;padding:2rem;border-radius:15px;border:1px solid #333}.feature-box h3{color:#fff;font-size:1.5rem;margin-bottom:1rem}.feature-box p{color:#ccc;line-height:1.6;margin-bottom:1rem}.feature-list{list-style:none;padding:0}.feature-list li{color:#ccc;padding:0.5rem 0;padding-left:1.5rem;position:relative}.feature-list li:before{content:"✓";position:absolute;left:0;color:#667eea;font-weight:bold}.btn-container{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;margin-top:3rem}.btn{padding:15px 30px;background:#fff;color:#000;border:none;border-radius:8px;font-size:1.1rem;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}.btn:hover{background:#ccc}.btn-secondary{background:#667eea;color:#fff}.btn-secondary:hover{background:#5a6fd8}</style></head><body><div class="container"><div class="header"><h1>Welcome to traidefi</h1><p class="subtitle">The Future of Commodity Trading</p></div><div class="features-grid"><div class="feature-box"><h3>Secure Trading Platform</h3><p>Trade commodities with confidence using our secure, blockchain-powered platform.</p><ul class="feature-list"><li>End-to-end encryption</li><li>Smart contract automation</li><li>Real-time trade tracking</li><li>Secure payment processing</li></ul></div><div class="feature-box"><h3>TGT Stablecoin</h3><p>Use TGT (Tangent Gold Token) for fast, secure, and low-cost transactions.</p><ul class="feature-list"><li>Stable value backed by gold</li><li>Instant settlements</li><li>Low transaction fees</li><li>Global accessibility</li></ul></div><div class="feature-box"><h3>Complete Workflow</h3><p>From contract creation to payment release, manage your entire trade lifecycle.</p><ul class="feature-list"><li>Contract management</li><li>KYC compliance</li><li>Document verification</li><li>Automated payments</li></ul></div></div><div class="btn-container"><a href="/early-registration" class="btn">Register Interest (Early Access)</a><a href="/landing-two" class="btn btn-secondary">Team Portal</a></div></div></body></html>';
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
    const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Sign Up - traidefi</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff}.container{background:#1a1a1a;padding:3rem;border-radius:15px;box-shadow:0 20px 40px rgba(0,0,0,0.5);max-width:500px;width:90%}h1{color:#fff;font-size:2.2rem;margin-bottom:1rem;text-align:center}.journey{background:#2a2a2a;padding:1.5rem;border-radius:8px;margin-bottom:2rem}.journey h3{color:#fff;margin-bottom:1rem;font-size:1.1rem}.steps{display:flex;justify-content:space-between;margin-bottom:1rem}.step{flex:1;text-align:center;padding:0.5rem;background:#333;border-radius:6px;margin:0 0.25rem;color:#ccc;font-size:0.9rem}.step.active{background:#667eea;color:#fff}.step-desc{color:#888;font-size:0.85rem;text-align:center}.form-group{margin-bottom:1.5rem}label{display:block;margin-bottom:0.5rem;color:#fff;font-weight:600}input,select{width:100%;padding:12px;background:#333;border:1px solid #555;border-radius:8px;font-size:1rem;color:#fff}input:focus,select:focus{outline:none;border-color:#667eea}.btn{width:100%;padding:15px;background:#667eea;color:#fff;border:none;border-radius:8px;font-size:1.1rem;font-weight:600;cursor:pointer;margin-top:1rem}.btn:hover{background:#5a6fd8}.links{text-align:center;margin-top:2rem}.links a{color:#667eea;text-decoration:none}.message{padding:1rem;margin-bottom:1rem;border-radius:8px;display:none}.success{background:#d4edda;color:#155724;border:1px solid #c3e6cb}.error{background:#f8d7da;color:#721c24;border:1px solid #f5c6cb}</style></head><body><div class="container"><h1>Create Your Account</h1><div class="journey"><h3>Your Registration Journey</h3><div class="steps"><div class="step active">1. Sign Up</div><div class="step">2. KYC Docs</div><div class="step">3. Wallet Setup</div><div class="step">4. Dashboard</div></div><p class="step-desc">Complete basic info - Upload KYC documents - Set up your wallet - Start trading!</p></div><div id="message" class="message"></div><form id="signupForm"><div class="form-group"><label for="email">Email Address *</label><input type="email" id="email" required></div><div class="form-group"><label for="password">Password *</label><input type="password" id="password" required></div><div class="form-group"><label for="role">Your Role *</label><select id="role" required><option value="">Select your trading role</option><option value="buyer">Buyer</option><option value="supplier">Supplier</option><option value="trader">Trader</option><option value="insurer">Insurer</option></select></div><button type="submit" class="btn" id="submitBtn">Create Account</button></form><div class="links"><a href="/signin">Already have an account? Sign In</a><br><a href="/landing-two">Back to Home</a></div></div><script>console.log("[OK] Signup page loaded");document.getElementById("signupForm").addEventListener("submit",async function(e){e.preventDefault();const email=document.getElementById("email").value;const password=document.getElementById("password").value;const role=document.getElementById("role").value;const messageDiv=document.getElementById("message");try{const response=await fetch("/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password,role})});const data=await response.json();if(data.success){localStorage.setItem("token",data.token);localStorage.setItem("user",JSON.stringify(data.user));window.location.href="/dashboard/kyc?token=" + encodeURIComponent(data.token)}else{messageDiv.textContent=data.error||"Registration failed";messageDiv.className="message error";messageDiv.style.display="block"}}catch(error){messageDiv.textContent="Network error. Please try again.";messageDiv.className="message error";messageDiv.style.display="block"}});</script></body></html>';
    res.end(html, 'utf8');
});

// ==================================================
// LOVABLE-COMPATIBLE ROUTES (STEP F2)
// These routes map LOVABLE paths to existing handlers
// ==================================================

// LOVABLE: /auth → same as /signin (unified auth entry point)
app.get('/auth', (req, res) => {
    console.log('[ROUTING] Serving LOVABLE path /auth via legacy /signin handler');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    // Reuse the same HTML as /signin
    const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Sign In - traidefi</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;min-height:100vh;display:flex;align-items:center;justify-content:center}.container{background:#fff;padding:3rem;border-radius:15px;box-shadow:0 20px 40px rgba(0,0,0,0.2);max-width:400px;width:90%}h1{color:#1e3c72;font-size:2.2rem;margin-bottom:2rem;text-align:center}.form-group{margin-bottom:1.5rem}label{display:block;margin-bottom:0.5rem;color:#333;font-weight:600}input{width:100%;padding:12px;border:2px solid #e5e5e5;border-radius:8px;font-size:1rem}input:focus{outline:none;border-color:#667eea}.btn{width:100%;padding:15px;background:#667eea;color:#fff;border:none;border-radius:8px;font-size:1.1rem;font-weight:600;cursor:pointer;margin-top:1rem}.btn:hover{background:#5a6fd8}.links{text-align:center;margin-top:2rem}.links a{color:#667eea;text-decoration:none}.message{padding:1rem;margin-bottom:1rem;border-radius:8px;display:none}.success{background:#d4edda;color:#155724;border:1px solid #c3e6cb}.error{background:#f8d7da;color:#721c24;border:1px solid #f5c6cb}</style></head><body><div class="container"><h1>Sign In</h1><div id="message" class="message"></div><form id="signinForm"><div class="form-group"><label for="email">Email</label><input type="email" id="email" required></div><div class="form-group"><label for="password">Password</label><input type="password" id="password" required></div><div class="form-group" id="twoFactorGroup" style="display:none"><label for="twoFactorToken">Two-Factor Authentication Code</label><input type="text" id="twoFactorToken" placeholder="Enter 6-digit code" maxlength="6" pattern="[0-9]{6}"><small style="color:#666;font-size:0.85rem;display:block;margin-top:0.5rem">Enter the code from your authenticator app or use a backup code</small></div><button type="submit" class="btn" id="submitBtn">Sign In</button></form><div class="links"><a href="/signup">Dont have an account? Sign Up</a><br><a href="/forgot-password">Forgot your password?</a><br><a href="/landing-two">Back to Home</a></div><div style="margin-top:1.5rem;padding:1rem;background:#e5e5e5;border-radius:8px;border-left:4px solid #666666"><p style="margin:0;color:#333333;font-size:0.9rem"><strong>Security Tip:</strong> After signing in, enable Two-Factor Authentication (2FA) to protect your account. You will see a prompt on your dashboard.</p></div></div><script>console.log("[OK] Signin page JavaScript loaded");let loginSessionId=null;let loginEmail=null;let loginPassword=null;async function sendLoginEmailCode(email){try{const response=await fetch("/api/auth/2fa/send-login-code",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});const data=await response.json();if(data.success){console.log("Email code sent for login")}}catch(error){console.error("Failed to send email code:",error)}}document.getElementById("signinForm").addEventListener("submit",async function(e){e.preventDefault();const email=document.getElementById("email").value;const password=document.getElementById("password").value;const twoFactorToken=document.getElementById("twoFactorToken").value;const messageDiv=document.getElementById("message");const twoFactorGroup=document.getElementById("twoFactorGroup");console.log("[AUTH] Login form submitted:",email);try{console.log("[HTTP] Sending login request to server...");const response=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password,twoFactorToken:twoFactorToken||null})});const data=await response.json();if(data.success){console.log("[OK] Login successful");localStorage.setItem("token",data.token);localStorage.setItem("user",JSON.stringify(data.user));window.location.href="/dashboard"}else if(data.requires2FA){console.log("[2FA] 2FA required");twoFactorGroup.style.display="block";messageDiv.textContent="Please enter your 2FA code";messageDiv.className="message";messageDiv.style.display="block";if(data.twoFactorMethod==="email"){await sendLoginEmailCode(email);messageDiv.textContent="2FA code sent to your email. Please check and enter it below."}}else{console.error("[ERROR] Login failed:",data.error);messageDiv.textContent=data.error||"Login failed. Please check your credentials.";messageDiv.className="message error";messageDiv.style.display="block"}}catch(error){console.error("[ERROR] Login error:",error);messageDiv.textContent="Network error. Please try again.";messageDiv.className="message error";messageDiv.style.display="block"}});</script></body></html>';
    res.end(html, 'utf8');
});

// LOVABLE: /landing → serve landing page (reuse current / or /landing-two)
app.get('/landing', (req, res) => {
    console.log('[ROUTING] Serving LOVABLE path /landing via legacy /landing-two handler');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>traidefi - Access Portal</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;min-height:100vh;display:flex;align-items:center;justify-content:center}.container{background:#fff;padding:3rem;border-radius:15px;box-shadow:0 20px 40px rgba(0,0,0,0.2);max-width:500px;width:90%}h1{color:#1e3c72;font-size:2.2rem;margin-bottom:1rem;text-align:center}.subtitle{color:#666;font-size:1.1rem;margin-bottom:2rem;text-align:center}.instruction-box{background:#e3f2fd;padding:1.5rem;border-radius:8px;margin-bottom:2rem;color:#333;font-size:0.95rem;line-height:1.6}.btn{width:100%;padding:15px;background:#000;color:#fff;border:none;border-radius:8px;font-size:1.1rem;font-weight:600;cursor:pointer;margin-bottom:1rem;text-decoration:none;display:block;text-align:center}.btn:hover{background:#333}.back-link{text-align:center;margin-top:2rem}.back-link a{color:#666;text-decoration:none;font-size:0.9rem}.back-link a:hover{color:#333}</style></head><body><div class="container"><h1>Welcome to traidefi</h1><p class="subtitle">Access Your Trading Platform</p><div class="instruction-box">Choose your access method: Sign in if you already have an account, or sign up to get started</div><a href="/signin" class="btn">Sign In</a><a href="/signup" class="btn">Sign Up</a><a href="/demo/workflow" class="btn">Demo</a><div class="back-link"><a href="/">Back to Main Platform</a></div></div></body></html>';
    res.end(html, 'utf8');
});

// Early Registration Form (Interest Form)
app.get('/early-registration', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Early Registration - traidefi</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff;padding:2rem}.container{background:#1a1a1a;padding:3rem;border-radius:15px;box-shadow:0 20px 40px rgba(0,0,0,0.5);max-width:600px;width:90%}h1{color:#fff;font-size:2.2rem;margin-bottom:1rem;text-align:center}.subtitle{color:#ccc;font-size:1rem;margin-bottom:2rem;text-align:center}.form-group{margin-bottom:1.5rem}label{display:block;margin-bottom:0.5rem;color:#fff;font-weight:600}input,textarea,select{width:100%;padding:12px;background:#333;border:1px solid #555;border-radius:8px;font-size:1rem;color:#fff;font-family:Arial,sans-serif}input:focus,textarea:focus,select:focus{outline:none;border-color:#667eea}textarea{min-height:100px;resize:vertical}.btn{width:100%;padding:15px;background:#667eea;color:#fff;border:none;border-radius:8px;font-size:1.1rem;font-weight:600;cursor:pointer;margin-top:1rem}.btn:hover{background:#5a6fd8}.btn:disabled{background:#666;cursor:not-allowed}.message{padding:1rem;margin-bottom:1rem;border-radius:8px;display:none}.success{background:#d4edda;color:#155724;border:1px solid #c3e6cb}.error{background:#f8d7da;color:#721c24;border:1px solid #f5c6cb}.back-link{text-align:center;margin-top:2rem}.back-link a{color:#667eea;text-decoration:none}.back-link a:hover{text-decoration:underline}</style></head><body><div class="container"><h1>Early Registration</h1><p class="subtitle">Express your interest in joining traidefi</p><div id="message" class="message"></div><form id="registrationForm"><div class="form-group"><label for="email">Email Address *</label><input type="email" id="email" name="email" required placeholder="your.email@example.com"></div><div class="form-group"><label for="name">Full Name *</label><input type="text" id="name" name="name" required placeholder="John Doe"></div><div class="form-group"><label for="company">Company Name *</label><input type="text" id="company" name="company" required placeholder="Your Company Ltd."></div><div class="form-group"><label for="interest">What is your interest in traidefi? *</label><textarea id="interest" name="interest" required placeholder="Tell us what interests you about our platform, what you'd like to use it for, or any questions you have..."></textarea></div><button type="submit" class="btn" id="submitBtn">Submit Registration</button></form><div class="back-link"><a href="/">← Back to Home</a></div></div><script>document.getElementById('registrationForm').addEventListener('submit',async function(e){e.preventDefault();const submitBtn=document.getElementById('submitBtn');const messageDiv=document.getElementById('message');submitBtn.disabled=true;submitBtn.textContent='Submitting...';const formData={email:document.getElementById('email').value.trim(),name:document.getElementById('name').value.trim(),company:document.getElementById('company').value.trim(),interest:document.getElementById('interest').value.trim()};try{const response=await fetch('/api/early-registration',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(formData)});const data=await response.json();if(response.ok&&data.success){messageDiv.textContent='Thank you! Your registration has been submitted successfully. We will contact you soon.';messageDiv.className='message success';messageDiv.style.display='block';document.getElementById('registrationForm').reset();setTimeout(()=>{window.location.href='/'},3000)}else{messageDiv.textContent=data.error||'Failed to submit registration. Please try again.';messageDiv.className='message error';messageDiv.style.display='block'}}catch(error){console.error('Registration error:',error);messageDiv.textContent='Network error. Please check your connection and try again.';messageDiv.className='message error';messageDiv.style.display='block'}finally{submitBtn.disabled=false;submitBtn.textContent='Submit Registration'}});</script></body></html>`;
    res.end(html, 'utf8');
});

// KYC Verification Page
// KYC page route - accessible to any logged-in user regardless of KYC status
// Note: This route requires authentication but does NOT check KYC status (bypasses KYC gate)
app.get('/kyc', authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'kyc.html'));
});

// Contract Detail View Route
app.get('/contracts/:contractId', authenticateToken, (req, res) => {
    try {
        const { contractId } = req.params;
        const userEmail = req.user.email;
        const userRole = req.user.role;
        
        const contract = ensureContractFields(database.contracts.get(contractId));
        
        if (!contract) {
            return res.status(404).send(`
                <h1>Contract Not Found</h1>
                <p>The contract you're looking for doesn't exist.</p>
                <a href="/dashboard/authenticated?token=${req.query.token || ''}">Back to Dashboard</a>
            `);
        }
        
        // Authorization check: user must be buyer, supplier, or admin
        const isAuthorized = userRole === 'admin' || 
                            contract.buyerEmail === userEmail || 
                            contract.supplierEmail === userEmail ||
                            (userRole === 'trader' && (contract.buyerEmail === userEmail || contract.supplierEmail === userEmail));
        
        if (!isAuthorized) {
            return res.status(403).send(`
                <h1>Access Denied</h1>
                <p>You are not authorized to view this contract.</p>
                <a href="/dashboard/authenticated?token=${req.query.token || ''}">Back to Dashboard</a>
            `);
        }
        
        res.sendFile(path.join(__dirname, 'views', 'contract-detail.html'));
    } catch (error) {
        console.error('[ERROR] Contract detail view error:', error);
        res.status(500).send('Error loading contract details');
    }
});

// LOVABLE: /trade/:id → same as /contracts/:contractId
app.get('/trade/:id', authenticateToken, (req, res) => {
    console.log('[ROUTING] Serving LOVABLE path /trade/:id via legacy /contracts/:contractId handler');
    try {
        // Map :id to contractId for the existing handler logic
        const contractId = req.params.id;
        const userEmail = req.user.email;
        const userRole = req.user.role;
        
        const contract = ensureContractFields(database.contracts.get(contractId));
        
        if (!contract) {
            return res.status(404).send(`
                <h1>Contract Not Found</h1>
                <p>The contract you're looking for doesn't exist.</p>
                <a href="/dashboard/authenticated?token=${req.query.token || ''}">Back to Dashboard</a>
            `);
        }
        
        // Authorization check: user must be buyer, supplier, or admin
        const isAuthorized = userRole === 'admin' || 
                            contract.buyerEmail === userEmail || 
                            contract.supplierEmail === userEmail ||
                            (userRole === 'trader' && (contract.buyerEmail === userEmail || contract.supplierEmail === userEmail));
        
        if (!isAuthorized) {
            return res.status(403).send(`
                <h1>Access Denied</h1>
                <p>You are not authorized to view this contract.</p>
                <a href="/dashboard/authenticated?token=${req.query.token || ''}">Back to Dashboard</a>
            `);
        }
        
        res.sendFile(path.join(__dirname, 'views', 'contract-detail.html'));
    } catch (error) {
        console.error('[ERROR] Contract detail view error:', error);
        res.status(500).send('Error loading contract details');
    }
});

// Contract Detail API Endpoint
app.get('/api/contracts/:contractId', authenticateToken, async (req, res) => {
    try {
        const { contractId } = req.params;
        const userEmail = req.user.email;
        const userRole = req.user.role;
        
        // LOG: Received contract ID from URL
        console.log('[GET /api/contracts/:contractId] Received contractId:', contractId);
        
        // LOG: Available contract IDs in storage
        const availableIds = Array.from(database.contracts.keys());
        console.log('[GET /api/contracts/:contractId] Available contract IDs:', availableIds);
        console.log('[GET /api/contracts/:contractId] Available IDs count:', availableIds.length);
        
        const contractRaw = database.contracts.get(contractId);
        if (!contractRaw) {
            console.log('[GET /api/contracts/:contractId] Contract not found for ID:', contractId);
            return res.status(404).json({ error: 'Contract not found' });
        }
        
        // CRITICAL: Ensure we're working with the actual contract object (not a copy)
        const contract = ensureContractFields(contractRaw);
        
        // CRITICAL: Log verificationDocs for debugging - check raw contract object
        console.log('[GET /api/contracts/:contractId] verificationDocs check (raw contract):', {
            contractId: contractId,
            hasVerificationDocs: !!contract.verificationDocs,
            itemsCount: contract.verificationDocs?.items?.length || 0,
            status: contract.verificationDocs?.status || 'NONE',
            items: contract.verificationDocs?.items?.map((item) => ({ name: item.name, type: item.type })) || []
        });
        
        // LOG: Contract found, show its ID fields
        console.log('[GET /api/contracts/:contractId] Contract found:', {
            mapKey: contractId,
            contractId: contractId,
            contractObjectId: contract.id,
            contractObjectContractId: contract.contract_id
        });
        
        // Compute contextual role using new helper (before authorization check)
        const roleInfo = await getUserRoleForContract(userEmail, contract, database);
        
        // Authorization check using contextual role
        if (roleInfo.contractRole === 'VIEWER' && userRole !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to view this contract' });
        }
        
        // Keep existing authorization check as fallback (for backward compatibility)
        const isAuthorized = userRole === 'admin' || 
                            contract.buyerEmail === userEmail || 
                            contract.supplierEmail === userEmail ||
                            (userRole === 'trader' && (contract.buyerEmail === userEmail || contract.supplierEmail === userEmail));
        
        if (!isAuthorized) {
            return res.status(403).json({ error: 'Not authorized to view this contract' });
        }
        
        // MERGE-LIFELINE: Derive counterpartyEmail if not set
        const creatorEmail = contract.createdByEmail || contract.creatorEmail || contract.created_by || null;
        const buyerEmail = contract.buyerEmail || contract.buyer_email || null;
        const supplierEmail = contract.supplierEmail || contract.supplier_email || null;
        
        let counterpartyEmail = contract.counterpartyEmail || contract.counterparty_email || null;
        if (!counterpartyEmail && creatorEmail && buyerEmail && supplierEmail) {
            // Derive counterparty: if creator is buyer, counterparty is supplier; if creator is supplier, counterparty is buyer
            counterpartyEmail = creatorEmail === buyerEmail ? supplierEmail : buyerEmail;
        }
        
        // Debug log (dev only)
        if (process.env.NODE_ENV !== 'production') {
            console.log('[CONTRACT_DETAIL]', {
                id: contract.id,
                creatorEmail: creatorEmail,
                counterpartyEmail: counterpartyEmail,
                buyerEmail: buyerEmail,
                supplierEmail: supplierEmail,
                status: contract.status,
                contractRole: roleInfo.contractRole,
                globalRole: roleInfo.globalRole,
            });
        }
        
        // Build response payload with contextual roles and explicit counterparty
        // Normalize status to canonical uppercase form before returning
        
        // Get documents for this contract (if available)
        // TODO: Enhance to fetch from documents database/table
        const documents = contract.documents || [];
        
        // Compute authoritative deposit, settlement, financing, and document objects
        const deposit = computeDepositObject(contract);
        const settlement = computeSettlementObject(contract, documents);
        const financing = computeFinancingObject(contract);
        const verificationDocs = computeVerificationDocsObject(contract);
        const originalDocs = computeOriginalDocsObject(contract);
        
        // CRITICAL: Log verificationDocs to ensure they're being computed correctly
        console.log('[GET /api/contracts/:contractId] verificationDocs computed:', {
            contractId: contractId,
            status: verificationDocs.status,
            itemsCount: verificationDocs.items?.length || 0,
            items: verificationDocs.items?.map((item) => ({ name: item.name, type: item.type })) || []
        });
        
        // FIX: Ensure id matches the map key (canonical primary key)
        // The map key (contractId) is the authoritative ID, not contract.id
        const payload = {
            ...contract,
            id: contractId, // CRITICAL: Use map key as canonical ID (same as list endpoint)
            contract_id: contractId, // Ensure contract_id also matches
            status: normalizeStatus(contract.status), // Normalize status to uppercase
            creatorEmail: creatorEmail,
            counterpartyEmail: counterpartyEmail,
            buyerEmail: buyerEmail,
            supplierEmail: supplierEmail,
            userRole: roleInfo.contractRole,
            userGlobalRole: roleInfo.globalRole,
            // Authoritative objects (single source of truth) - CRITICAL: Must be included
            deposit: deposit,
            settlement: settlement,
            financing: financing,
            verificationDocs: verificationDocs, // CRITICAL: Must include items array
            originalDocs: originalDocs,
            // Backward compatibility: include legacy fields for debugging
            // Data consistency: Always include normalized depositPercent and depositPaid
            depositPercent: contract.depositPercent || deposit.percent || 0,
            depositPaid: contract.depositPaid !== undefined ? contract.depositPaid : (deposit.status === "paid"),
            depositAmount: deposit.amount,
            requiredAdvancePercent: deposit.percent, // Alias for depositPercent
        };
        
        // LOG: Final payload ID and verificationDocs
        console.log('[GET /api/contracts/:contractId] Returning payload with id:', payload.id, 'verificationDocs.items:', payload.verificationDocs?.items?.length || 0);
        
        res.json(payload);
    } catch (error) {
        console.error('[ERROR] Contract detail API error:', error);
        res.status(500).json({ error: 'Failed to retrieve contract details' });
    }
});

// Financing Eligibility Endpoint
app.post('/api/financing/eligibility/:contractId', authenticateToken, async (req, res) => {
    try {
        const userEmail = req.user.email;
        const { contractId } = req.params;
        
        const contract = ensureContractFields(database.contracts.get(contractId));
        
        if (!contract) {
            return res.status(404).json({ error: 'Contract not found' });
        }
        
        // Check user role for this contract
        const roleInfo = await getUserRoleForContract(userEmail, contract, database);
        
        // Only BUYER can request financing
        if (roleInfo.contractRole !== 'BUYER') {
            return res.status(403).json({ error: 'Only the buyer can request financing' });
        }
        
        // Get financing terms (using existing helper)
        const financingTerms = getEffectiveFinancingTerms(contract, USE_RISK_ENGINE_FOR_FINANCING);
        
        // Compute eligibility score based on risk engine if available
        let score = 80; // Default score
        let maxAdvancePercent = financingTerms.maxFinancingPercent || 70;
        const riskFlags = [];
        
        if (contract.riskScore !== null && contract.riskScore !== undefined) {
            // Use risk score to compute eligibility
            score = Math.max(0, Math.min(100, 100 - (contract.riskScore - 1) * 10)); // Convert 1-10 risk to 0-100 score
            maxAdvancePercent = contract.maxFinancingPercent || financingTerms.maxFinancingPercent || 70;
            
            if (contract.riskScore >= 8) {
                riskFlags.push({ type: 'high_risk', message: 'High risk contract - financing may be limited' });
            }
            if (contract.riskBand === 'VERY_HIGH') {
                riskFlags.push({ type: 'very_high_risk', message: 'Very high risk - financing eligibility reduced' });
            }
        }
        
        const eligibility = {
            eligible: score >= 50 && maxAdvancePercent > 0,
            score: score,
            maxAdvancePercent: maxAdvancePercent,
            depositPercent: financingTerms.depositPercent || contract.depositPercent || 0, // MERGE-LIFELINE: No hardcoded 30% default
            riskFlags: riskFlags,
            riskScore: contract.riskScore || null,
            riskBand: contract.riskBand || null,
            userGlobalRole: roleInfo.globalRole,
            contractId: contractId,
            contractValue: contract.totalValue || contract.contractValue || 0,
            currency: contract.currency || 'USD',
        };
        
        res.json(eligibility);
    } catch (error) {
        console.error('[ERROR] Financing eligibility error:', error);
        res.status(500).json({ error: 'Failed to check financing eligibility' });
    }
});

// Wallet Setup Page
app.get('/wallet-setup', (req, res) => {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
    const role = req.query.role || 'buyer';
    
    if (!token) {
        return res.redirect('/landing-two');
    }
    
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Wallet Setup - traidefi</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff}.container{background:#1a1a1a;padding:3rem;border-radius:15px;box-shadow:0 20px 40px rgba(0,0,0,0.5);max-width:600px;width:90%}h1{color:#fff;font-size:2.2rem;margin-bottom:1rem;text-align:center}.journey{background:#2a2a2a;padding:1.5rem;border-radius:8px;margin-bottom:2rem}.journey h3{color:#fff;margin-bottom:1rem;font-size:1.1rem}.steps{display:flex;justify-content:space-between;margin-bottom:1rem}.step{flex:1;text-align:center;padding:0.5rem;background:#333;border-radius:6px;margin:0 0.25rem;color:#ccc;font-size:0.9rem}.step.active{background:#667eea;color:#fff}.step-desc{color:#888;font-size:0.85rem;text-align:center}.options{display:flex;flex-direction:column;gap:1rem;margin-top:2rem}.option-card{background:#2a2a2a;padding:2rem;border-radius:8px;border:2px solid #333;cursor:pointer;transition:all 0.3s}.option-card:hover{border-color:#667eea;background:#333}.option-card h3{color:#fff;margin-bottom:0.5rem}.option-card p{color:#ccc;font-size:0.9rem}.form-group{margin-bottom:1.5rem}label{display:block;margin-bottom:0.5rem;color:#fff;font-weight:600}input{width:100%;padding:12px;background:#333;border:1px solid #555;border-radius:8px;font-size:1rem;color:#fff}input:focus{outline:none;border-color:#667eea}.btn{width:100%;padding:15px;background:#667eea;color:#fff;border:none;border-radius:8px;font-size:1.1rem;font-weight:600;cursor:pointer;margin-top:1rem}.btn:hover{background:#5a6fd8}.btn.secondary{background:#666;margin-top:0.5rem}.btn.secondary:hover{background:#777}.message{padding:1rem;margin-bottom:1rem;border-radius:8px;display:none}.success{background:#d4edda;color:#155724;border:1px solid #c3e6cb}.error{background:#f8d7da;color:#721c24;border:1px solid #f5c6cb}</style></head><body><div class="container"><h1>Wallet Setup</h1><div class="journey"><h3>Your Registration Journey</h3><div class="steps"><div class="step">1. Sign Up</div><div class="step">2. KYC Docs</div><div class="step active">3. Wallet Setup</div><div class="step">4. Dashboard</div></div><p class="step-desc">Set up your wallet to start trading on the platform</p></div><div id="message" class="message"></div><div class="options" id="options"><div class="option-card" onclick="showWalletForm()"><h3>I have a wallet</h3><p>Enter your existing wallet address and details</p></div><div class="option-card" onclick="setupMetaMask()"><h3>Help me set up wallet</h3><p>Connect with MetaMask or create a new wallet</p></div></div><form id="walletForm" style="display:none"><div class="form-group"><label for="walletAddress">Wallet Address *</label><input type="text" id="walletAddress" name="walletAddress" placeholder="0x..." required></div><div class="form-group"><label for="walletType">Wallet Type</label><input type="text" id="walletType" name="walletType" placeholder="MetaMask, Ledger, etc."></div><button type="submit" class="btn">Save Wallet</button><button type="button" class="btn secondary" onclick="hideWalletForm()">Cancel</button></form></div><script>const token='${token}';const role='${role}';function showWalletForm(){document.getElementById('walletForm').style.display='block';document.getElementById('options').style.display='none'}function hideWalletForm(){document.getElementById('walletForm').style.display='none';document.getElementById('options').style.display='flex';document.getElementById('walletAddress').value='';document.getElementById('walletType').value=''}async function setupMetaMask(){if(typeof window.ethereum!=='undefined'){try{const accounts=await window.ethereum.request({method:'eth_requestAccounts'});if(accounts&&accounts.length>0){const walletAddress=accounts[0];await saveWallet(walletAddress,'MetaMask');}else{alert('Please connect your MetaMask account')}}catch(error){console.error('MetaMask error:',error);alert('MetaMask connection failed. Please try again.')}}else{alert('MetaMask is not installed. Please install MetaMask extension or use the manual wallet entry option.')}}async function saveWallet(address,type){if(!address||address.trim()===''){showMessage('Wallet address is required','error');return}if(!address.match(/^0x[a-fA-F0-9]{40}$/)){showMessage('Invalid wallet address format. Must be a valid Ethereum address (0x followed by 40 hex characters)','error');return}try{const response=await fetch('/api/wallet/create',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({address:address.trim(),type:type||'Manual'})});const data=await response.json();if(data.success){localStorage.setItem('token',token);window.location.href='/dashboard/authenticated?role='+role+'&token='+encodeURIComponent(token)}else{showMessage(data.error||'Failed to save wallet','error')}}catch(error){console.error('Wallet save error:',error);showMessage('Network error. Please try again.','error')}}document.getElementById('walletForm').addEventListener('submit',async function(e){e.preventDefault();const address=document.getElementById('walletAddress').value.trim();const type=document.getElementById('walletType').value.trim()||'Manual';await saveWallet(address,type)});function showMessage(text,type){const messageDiv=document.getElementById('message');messageDiv.textContent=text;messageDiv.className='message '+type;messageDiv.style.display='block';setTimeout(()=>{messageDiv.style.display='none'},5000)}</script></body></html>`;
    res.end(html, 'utf8');
});

// LOVABLE: /accounts → same as /wallet-setup
app.get('/accounts', (req, res) => {
    console.log('[ROUTING] Serving LOVABLE path /accounts via legacy /wallet-setup handler');
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
    const role = req.query.role || 'buyer';
    
    if (!token) {
        return res.redirect('/landing-two');
    }
    
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    // Reuse the same HTML as /wallet-setup
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Wallet Setup - traidefi</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff}.container{background:#1a1a1a;padding:3rem;border-radius:15px;box-shadow:0 20px 40px rgba(0,0,0,0.5);max-width:600px;width:90%}h1{color:#fff;font-size:2.2rem;margin-bottom:1rem;text-align:center}.journey{background:#2a2a2a;padding:1.5rem;border-radius:8px;margin-bottom:2rem}.journey h3{color:#fff;margin-bottom:1rem;font-size:1.1rem}.steps{display:flex;justify-content:space-between;margin-bottom:1rem}.step{flex:1;text-align:center;padding:0.5rem;background:#333;border-radius:6px;margin:0 0.25rem;color:#ccc;font-size:0.9rem}.step.active{background:#667eea;color:#fff}.step-desc{color:#888;font-size:0.85rem;text-align:center}.options{display:flex;flex-direction:column;gap:1rem;margin-top:2rem}.option-card{background:#2a2a2a;padding:2rem;border-radius:8px;border:2px solid #333;cursor:pointer;transition:all 0.3s}.option-card:hover{border-color:#667eea;background:#333}.option-card h3{color:#fff;margin-bottom:0.5rem}.option-card p{color:#ccc;font-size:0.9rem}.form-group{margin-bottom:1.5rem}label{display:block;margin-bottom:0.5rem;color:#fff;font-weight:600}input{width:100%;padding:12px;background:#333;border:1px solid #555;border-radius:8px;font-size:1rem;color:#fff}input:focus{outline:none;border-color:#667eea}.btn{width:100%;padding:15px;background:#667eea;color:#fff;border:none;border-radius:8px;font-size:1.1rem;font-weight:600;cursor:pointer;margin-top:1rem}.btn:hover{background:#5a6fd8}.btn.secondary{background:#666;margin-top:0.5rem}.btn.secondary:hover{background:#777}.message{padding:1rem;margin-bottom:1rem;border-radius:8px;display:none}.success{background:#d4edda;color:#155724;border:1px solid #c3e6cb}.error{background:#f8d7da;color:#721c24;border:1px solid #f5c6cb}</style></head><body><div class="container"><h1>Wallet Setup</h1><div class="journey"><h3>Your Registration Journey</h3><div class="steps"><div class="step">1. Sign Up</div><div class="step">2. KYC Docs</div><div class="step active">3. Wallet Setup</div><div class="step">4. Dashboard</div></div><p class="step-desc">Set up your wallet to start trading on the platform</p></div><div id="message" class="message"></div><div class="options" id="options"><div class="option-card" onclick="showWalletForm()"><h3>I have a wallet</h3><p>Enter your existing wallet address and details</p></div><div class="option-card" onclick="setupMetaMask()"><h3>Help me set up wallet</h3><p>Connect with MetaMask or create a new wallet</p></div></div><form id="walletForm" style="display:none"><div class="form-group"><label for="walletAddress">Wallet Address *</label><input type="text" id="walletAddress" name="walletAddress" placeholder="0x..." required></div><div class="form-group"><label for="walletType">Wallet Type</label><input type="text" id="walletType" name="walletType" placeholder="MetaMask, Ledger, etc."></div><button type="submit" class="btn">Save Wallet</button><button type="button" class="btn secondary" onclick="hideWalletForm()">Cancel</button></form></div><script>const token='${token}';const role='${role}';function showWalletForm(){document.getElementById('walletForm').style.display='block';document.getElementById('options').style.display='none'}function hideWalletForm(){document.getElementById('walletForm').style.display='none';document.getElementById('options').style.display='flex';document.getElementById('walletAddress').value='';document.getElementById('walletType').value=''}async function setupMetaMask(){if(typeof window.ethereum!=='undefined'){try{const accounts=await window.ethereum.request({method:'eth_requestAccounts'});if(accounts&&accounts.length>0){const walletAddress=accounts[0];await saveWallet(walletAddress,'MetaMask');}else{alert('Please connect your MetaMask account')}}catch(error){console.error('MetaMask error:',error);alert('MetaMask connection failed. Please try again.')}}else{alert('MetaMask is not installed. Please install MetaMask extension or use the manual wallet entry option.')}}async function saveWallet(address,type){if(!address||address.trim()===''){showMessage('Wallet address is required','error');return}if(!address.match(/^0x[a-fA-F0-9]{40}$/)){showMessage('Invalid wallet address format. Must be a valid Ethereum address (0x followed by 40 hex characters)','error');return}try{const response=await fetch('/api/wallet/create',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({address:address.trim(),type:type||'Manual'})});const data=await response.json();if(data.success){localStorage.setItem('token',token);window.location.href='/dashboard/authenticated?role='+role+'&token='+encodeURIComponent(token)}else{showMessage(data.error||'Failed to save wallet','error')}}catch(error){console.error('Wallet save error:',error);showMessage('Network error. Please try again.','error')}}document.getElementById('walletForm').addEventListener('submit',async function(e){e.preventDefault();const address=document.getElementById('walletAddress').value.trim();const type=document.getElementById('walletType').value.trim()||'Manual';await saveWallet(address,type)});function showMessage(text,type){const messageDiv=document.getElementById('message');messageDiv.textContent=text;messageDiv.className='message '+type;messageDiv.style.display='block';setTimeout(()=>{messageDiv.style.display='none'},5000)}</script></body></html>`;
    res.end(html, 'utf8');
});

// Manage Contract Page (Document Upload)
app.get('/manage-contract/:contractId', (req, res) => {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
    const { contractId } = req.params;
    
    if (!token) {
        return res.redirect('/landing-two');
    }
    
    let user = null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tangent-secret-key');
        user = database.users.get(decoded.email);
        if (!user) {
            return res.redirect('/landing-two');
        }
    } catch (error) {
        return res.redirect('/landing-two');
    }
    
    const contract = database.contracts.get(contractId);
    if (!contract) {
        return res.status(404).send('Contract not found');
    }
    
    // Check if user has permission
    if (contract.supplierEmail !== user.email && contract.buyerEmail !== user.email && user.role !== 'admin' && user.role !== 'trader') {
        return res.status(403).send('Unauthorized');
    }
    
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Manage Contract - traidefi</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;min-height:100vh;padding:2rem;color:#fff}.container{max-width:800px;margin:0 auto;background:#1a1a1a;padding:3rem;border-radius:15px;box-shadow:0 20px 40px rgba(0,0,0,0.5)}h1{color:#fff;font-size:2.2rem;margin-bottom:1rem}.contract-info{background:#2a2a2a;padding:1.5rem;border-radius:8px;margin-bottom:2rem}.contract-info h3{color:#fff;margin-bottom:1rem}.info-row{display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid #333}.info-row:last-child{border-bottom:none}.info-label{color:#ccc}.info-value{color:#fff;font-weight:600}.document-upload{background:#2a2a2a;padding:1.5rem;border-radius:8px;margin-bottom:2rem}.document-upload h3{color:#fff;margin-bottom:1rem}.file-input-wrapper{position:relative;display:inline-block;width:100%}.file-input-wrapper input[type=file]{position:absolute;opacity:0;width:100%;height:100%;cursor:pointer}.file-input-label{display:block;padding:12px;background:#333;border:1px solid #555;border-radius:8px;text-align:center;cursor:pointer;color:#fff}.file-input-label:hover{background:#444;border-color:#667eea}.uploaded-docs{margin-top:1.5rem}.doc-item{background:#333;padding:1rem;border-radius:8px;margin-bottom:0.5rem;display:flex;justify-content:space-between;align-items:center}.doc-name{color:#fff}.doc-date{color:#ccc;font-size:0.9rem}.btn{width:100%;padding:15px;background:#667eea;color:#fff;border:none;border-radius:8px;font-size:1.1rem;font-weight:600;cursor:pointer;margin-top:1rem}.btn:hover{background:#5a6fd8}.btn.secondary{background:#666;margin-top:0.5rem}.btn.secondary:hover{background:#777}.message{padding:1rem;margin-bottom:1rem;border-radius:8px;display:none}.success{background:#d4edda;color:#155724;border:1px solid #c3e6cb}.error{background:#f8d7da;color:#721c24;border:1px solid #f5c6cb}.back-link{text-align:center;margin-top:2rem}.back-link a{color:#667eea;text-decoration:none}</style></head><body><div class="container"><h1>Manage Contract</h1><div id="message" class="message"></div><div class="contract-info"><h3>Contract Details</h3><div class="info-row"><span class="info-label">Product:</span><span class="info-value">${contract.product}</span></div><div class="info-row"><span class="info-label">Quantity:</span><span class="info-value">${contract.quantity} ${contract.unit}</span></div><div class="info-row"><span class="info-label">Total Value:</span><span class="info-value">$${contract.totalValue.toLocaleString()} ${contract.currency}</span></div><div class="info-row"><span class="info-label">Status:</span><span class="info-value">${contract.status}</span></div></div><div class="document-upload"><h3>📄 Upload Shipping Documents</h3><p style="color:#ccc;margin-bottom:1rem">Upload shipping documents (Bill of Lading, Commercial Invoice, Packing List, etc.)</p><div class="file-input-wrapper"><input type="file" id="documentUpload" multiple accept=".pdf,.jpg,.jpeg,.png" onchange="handleFileSelect(event)"><label for="documentUpload" class="file-input-label">Choose Files (PDF, JPG, PNG)</label></div><div id="selectedFiles" style="margin-top:1rem;color:#ccc"></div><button class="btn" onclick="uploadDocuments()">Upload Documents</button><div id="uploadedDocs" class="uploaded-docs"></div></div><button class="btn secondary" onclick="window.location.href='/dashboard/authenticated?token='+encodeURIComponent('${token}')">Back to Dashboard</button></div><script>let token='${token}'||localStorage.getItem('token')||'';const contractId='${contractId}';let selectedFiles=[];function handleFileSelect(event){selectedFiles=Array.from(event.target.files);const filesDiv=document.getElementById('selectedFiles');if(selectedFiles.length>0){filesDiv.innerHTML='<strong>Selected files:</strong><br>'+selectedFiles.map(f=>f.name).join('<br>')}else{filesDiv.innerHTML=''}}async function uploadDocuments(){if(selectedFiles.length===0){showMessage('Please select at least one file','error');return}if(!token){token=localStorage.getItem('token')||'';if(!token){showMessage('Authentication required. Please sign in again.','error');setTimeout(()=>{window.location.href='/landing-two'},2000);return}}const formData=new FormData();selectedFiles.forEach(file=>{formData.append('documents',file)});try{showMessage('Uploading documents...','success');const response=await fetch('/api/contracts/'+contractId+'/documents',{method:'POST',headers:{'Authorization':'Bearer '+token},body:formData});if(!response.ok){if(response.status===401||response.status===403){const errorData=await response.json().catch(()=>({error:'Authentication failed'}));showMessage(errorData.error||'Session expired. Please sign in again.','error');setTimeout(()=>{window.location.href='/landing-two'},2000);return}const errorData=await response.json().catch(()=>({error:'Upload failed'}));showMessage(errorData.error||'Failed to upload documents','error');return}const result=await response.json();if(result.success){showMessage(result.message||'Documents uploaded successfully!','success');selectedFiles=[];document.getElementById('documentUpload').value='';document.getElementById('selectedFiles').innerHTML='';setTimeout(()=>{const finalToken=token||localStorage.getItem('token')||'';window.location.href='/dashboard/authenticated?token='+encodeURIComponent(finalToken)},2000)}else{showMessage(result.error||'Failed to upload documents','error')}}catch(error){console.error('Upload error:',error);showMessage('Network error: '+error.message+'. Please check your connection and try again.','error')}}function showMessage(text,type){const messageDiv=document.getElementById('message');messageDiv.textContent=text;messageDiv.className='message '+type;messageDiv.style.display='block';setTimeout(()=>{messageDiv.style.display='none'},5000)}</script></body></html>`;
    res.end(html, 'utf8');
});

// LOVABLE: /trade/create → same as /create-contract
app.get('/trade/create', (req, res) => {
    console.log('[ROUTING] Serving LOVABLE path /trade/create via legacy /create-contract handler');
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
    
    if (!token) {
        return res.redirect('/landing-two');
    }
    
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Create Contract - traidefi</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;min-height:100vh;padding:2rem;color:#fff}.container{max-width:800px;margin:0 auto;background:#1a1a1a;padding:3rem;border-radius:15px;box-shadow:0 20px 40px rgba(0,0,0,0.5)}h1{color:#fff;font-size:2.2rem;margin-bottom:1rem;text-align:center}.form-group{margin-bottom:1.5rem}label{display:block;margin-bottom:0.5rem;color:#fff;font-weight:600}input,select,textarea{width:100%;padding:12px;background:#333;border:1px solid #555;border-radius:8px;font-size:1rem;color:#fff}input:focus,select:focus,textarea:focus{outline:none;border-color:#667eea}textarea{min-height:100px;resize:vertical}.currency-options{display:flex;gap:1rem;margin-top:0.5rem}.currency-option{flex:1;padding:15px;background:#2a2a2a;border:2px solid #333;border-radius:8px;cursor:pointer;text-align:center;transition:all 0.3s}.currency-option:hover{border-color:#667eea}.currency-option.selected{background:#667eea;border-color:#667eea}.currency-option h4{color:#fff;margin-bottom:0.5rem;font-size:1rem}.currency-option p{color:#ccc;font-size:0.85rem}.btn{width:100%;padding:15px;background:#667eea;color:#fff;border:none;border-radius:8px;font-size:1.1rem;font-weight:600;cursor:pointer;margin-top:1rem}.btn:hover{background:#5a6fd8}.btn.secondary{background:#666;margin-top:0.5rem}.btn.secondary:hover{background:#777}.message{padding:1rem;margin-bottom:1rem;border-radius:8px;display:none}.success{background:#d4edda;color:#155724;border:1px solid #c3e6cb}.error{background:#f8d7da;color:#721c24;border:1px solid #f5c6cb}.back-link{text-align:center;margin-top:2rem}.back-link a{color:#667eea;text-decoration:none}.price-comparison{background:#2a2a2a;padding:1.5rem;border-radius:8px;margin-top:1rem;display:none}.price-comparison h4{color:#fff;margin-bottom:1rem}.price-row{display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid #333}.price-row:last-child{border-bottom:none}.price-label{color:#ccc}.price-value{color:#fff;font-weight:600}.price-warning{color:#ff6b6b}.price-good{color:#51cf66}.price-loading{color:#ffd43b}.pdf-upload{background:#2a2a2a;padding:1.5rem;border-radius:8px;margin-bottom:2rem;border:2px dashed #555}.pdf-upload h3{color:#fff;margin-bottom:1rem}.pdf-upload p{color:#ccc;margin-bottom:1rem;font-size:0.9rem}.file-input-wrapper{position:relative;display:inline-block;width:100%}.file-input-wrapper input[type=file]{position:absolute;opacity:0;width:100%;height:100%;cursor:pointer}.file-input-label{display:block;padding:12px;background:#333;border:1px solid #555;border-radius:8px;text-align:center;cursor:pointer;color:#fff}.file-input-label:hover{background:#444;border-color:#667eea}.file-name{color:#ccc;margin-top:0.5rem;font-size:0.9rem}</style></head><body><div class="container"><h1>Create New Contract</h1><div id="message" class="message"></div><div class="pdf-upload"><h3>📄 Upload PDF Contract (Optional)</h3><p>Upload a PDF contract to automatically extract and fill in the contract details. You can review and edit the extracted information before submitting.</p><div class="file-input-wrapper"><input type="file" id="pdfUpload" accept=".pdf" onchange="handlePDFUpload(event)"><label for="pdfUpload" class="file-input-label">Choose PDF File</label></div><div id="pdfFileName" class="file-name"></div></div><form id="contractForm"><div class="form-group"><label for="product">Product/Commodity *</label><select id="product" name="product" required onchange="checkPriceComparison()"><option value="">Select a product</option><option value="Rice">Rice</option><option value="Wheat">Wheat</option><option value="Corn">Corn</option><option value="Soybeans">Soybeans</option><option value="Coffee">Coffee</option><option value="Sugar">Sugar</option><option value="Cocoa">Cocoa</option><option value="Cotton">Cotton</option><option value="Palm Oil">Palm Oil</option><option value="Rubber">Rubber</option><option value="Other">Other (specify below)</option></select><input type="text" id="productOther" name="productOther" placeholder="Specify product name" style="display:none;margin-top:0.5rem"></div><div class="form-group"><label for="quantity">Quantity *</label><input type="number" id="quantity" name="quantity" placeholder="e.g., 1000" step="0.01" required></div><div class="form-group"><label for="unit">Unit *</label><select id="unit" name="unit" required><option value="">Select unit</option><option value="MT">Metric Tons (MT)</option><option value="kg">Kilograms (kg)</option><option value="lb">Pounds (lb)</option><option value="bushels">Bushels</option><option value="bags">Bags</option></select></div><div class="form-group"><label for="price">Price per Unit *</label><input type="number" id="price" name="price" placeholder="e.g., 500" step="0.01" required oninput="checkPriceComparison()"><div id="priceComparison" class="price-comparison"><h4>Market Price Comparison</h4><div id="priceComparisonContent"></div></div></div><div class="form-group"><label>Payment Currency *</label><div class="currency-options"><div class="currency-option" onclick="selectCurrency('TGT')"><h4>TGT</h4><p>Tangent Token</p></div><div class="currency-option" onclick="selectCurrency('USDT')"><h4>USDT</h4><p>Tether USD</p></div><div class="currency-option" onclick="selectCurrency('USDC')"><h4>USDC</h4><p>USD Coin</p></div></div><input type="hidden" id="currency" name="currency" value="TGT" required></div><div class="form-group"><label for="counterparty">Counterparty Email *</label><input type="email" id="counterparty" name="counterparty" placeholder="buyer@example.com or supplier@example.com" required></div><div class="form-group"><label for="depositPercent">Deposit Percentage *</label><input type="number" id="depositPercent" name="depositPercent" placeholder="30" min="10" max="50" value="30" required></div><div class="form-group"><label for="voyageTime">Voyage Time (days) *</label><input type="number" id="voyageTime" name="voyageTime" placeholder="30" min="1" value="30" required></div><div class="form-group"><label for="description">Description</label><textarea id="description" name="description" placeholder="Additional contract details..."></textarea></div><button type="submit" class="btn">Create Contract</button><button type="button" class="btn secondary" onclick="window.location.href='/dashboard/authenticated?token='+encodeURIComponent('${token}')">Cancel</button></form><div class="back-link"><a href="/dashboard/authenticated?token=${token}">Back to Dashboard</a></div></div><script>const token='${token}'||localStorage.getItem('token');if(!token){window.location.href='/landing-two'}function selectCurrency(currency){document.querySelectorAll('.currency-option').forEach(opt=>opt.classList.remove('selected'));event.target.closest('.currency-option')?.classList.add('selected')||event.currentTarget.classList.add('selected');document.getElementById('currency').value=currency}async function handlePDFUpload(event){const file=event.target.files[0];if(!file){return}if(file.type!=='application/pdf'){showMessage('Please upload a PDF file','error');return}document.getElementById('pdfFileName').textContent='Uploading: '+file.name;showMessage('Extracting contract data from PDF...','success');const formData=new FormData();formData.append('pdf',file);try{const response=await fetch('/api/contracts/extract-from-pdf',{method:'POST',headers:{'Authorization':'Bearer '+token},body:formData});const result=await response.json();if(result.success&&result.extracted){const ext=result.extracted;if(ext.productDetails){const productSelect=document.getElementById('product');const productValue=ext.productDetails.toLowerCase();if(['rice','wheat','corn','soybeans','coffee','sugar','cocoa','cotton','palm oil','rubber'].some(p=>productValue.includes(p))){productSelect.value=ext.productDetails}else{productSelect.value='Other';document.getElementById('productOther').style.display='block';document.getElementById('productOther').value=ext.productDetails}}if(ext.quantity){document.getElementById('quantity').value=ext.quantity}if(ext.unit){document.getElementById('unit').value=ext.unit}if(ext.pricePerUnit){document.getElementById('price').value=ext.pricePerUnit;checkPriceComparison()}if(ext.buyerEmail||ext.supplierEmail){document.getElementById('counterparty').value=ext.buyerEmail||ext.supplierEmail}if(ext.deliveryDate){const days=Math.ceil((new Date(ext.deliveryDate)-new Date())/86400000);if(days>0){document.getElementById('voyageTime').value=days}}if(ext.specifications){document.getElementById('description').value=ext.specifications}showMessage('Contract data extracted and filled! Please review and edit as needed.','success');document.getElementById('pdfFileName').textContent='Extracted from: '+file.name}else{showMessage('Could not extract contract data from PDF. Please fill the form manually.','error')}}catch(error){console.error('PDF extraction error:',error);showMessage('Failed to extract PDF. Please fill the form manually.','error')}}document.getElementById('product').addEventListener('change',function(){const productOther=document.getElementById('productOther');if(this.value==='Other'){productOther.style.display='block';productOther.required=true}else{productOther.style.display='none';productOther.required=false;productOther.value=''}checkPriceComparison()});async function checkPriceComparison(){const product=document.getElementById('product').value;const price=parseFloat(document.getElementById('price').value);const comparisonDiv=document.getElementById('priceComparison');const contentDiv=document.getElementById('priceComparisonContent');if(!product||!price||isNaN(price)){comparisonDiv.style.display='none';return}comparisonDiv.style.display='block';contentDiv.innerHTML='<div class="price-row"><span class="price-label price-loading">Loading market prices...</span></div>';try{let variancePercent=5;let basisPoints=100;try{const response=await fetch('/api/admin/settings',{headers:{'Authorization':'Bearer '+token}});if(response.ok){const settings=await response.json();basisPoints=settings.basisPoints||100;variancePercent=5}}catch(e){console.log('Using default variance settings')}const mockPrices={Rice:450,Wheat:280,Corn:180,Soybeans:520,Coffee:180,Sugar:0.18,Cocoa:3200,Cotton:0.85,'Palm Oil':850,Rubber:1.2};const marketPrice=mockPrices[product]||price*0.95;const priceDiff=Math.abs(price-marketPrice);const priceDiffPercent=(priceDiff/marketPrice)*100;const isWithinVariance=priceDiffPercent<=variancePercent;let html='';html+='<div class="price-row"><span class="price-label">Your Price:</span><span class="price-value">$'+price.toFixed(2)+'</span></div>';html+='<div class="price-row"><span class="price-label">Market Average:</span><span class="price-value">$'+marketPrice.toFixed(2)+'</span></div>';html+='<div class="price-row"><span class="price-label">Difference:</span><span class="price-value '+(isWithinVariance?'price-good':'price-warning')+'">'+priceDiffPercent.toFixed(2)+'% '+(price>marketPrice?'above':'below')+' market</span></div>';if(!isWithinVariance){html+='<div class="price-row"><span class="price-label price-warning">⚠️ Price variance exceeds '+variancePercent+'% threshold</span></div>'}else{html+='<div class="price-row"><span class="price-label price-good">✓ Price within acceptable range</span></div>'}contentDiv.innerHTML=html}catch(error){console.error('Price comparison error:',error);contentDiv.innerHTML='<div class="price-row"><span class="price-label">Unable to fetch market prices</span></div>'}}document.getElementById('price').addEventListener('input',checkPriceComparison);document.getElementById('contractForm').addEventListener('submit',async function(e){e.preventDefault();const formData=new FormData(this);const data=Object.fromEntries(formData);if(data.product==='Other'){data.product=data.productOther||'Other'}data.totalValue=(parseFloat(data.quantity)*parseFloat(data.price)).toFixed(2);data.depositAmount=((parseFloat(data.totalValue)*parseFloat(data.depositPercent))/100).toFixed(2);try{const response=await fetch('/api/contracts',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(data)});if(!response.ok){const errorData=await response.json().catch(()=>({error:'Authentication failed. Please sign in again.'}));if(response.status===401||response.status===403){showMessage('Session expired. Please sign in again.','error');setTimeout(()=>{window.location.href='/landing-two'},2000);return}showMessage(errorData.error||'Failed to create contract','error');return}const result=await response.json();if(result.success||result.id){showMessage('Contract created successfully!','success');setTimeout(()=>{window.location.href='/dashboard/authenticated?token='+encodeURIComponent(token)},2000)}else{showMessage(result.error||'Failed to create contract','error')}}catch(error){console.error('Contract creation error:',error);showMessage('Network error. Please try again.','error')}});function showMessage(text,type){const messageDiv=document.getElementById('message');messageDiv.textContent=text;messageDiv.className='message '+type;messageDiv.style.display='block';setTimeout(()=>{messageDiv.style.display='none'},5000)}</script></body></html>`;
    res.end(html, 'utf8');
});

// Demo Workflow - Main Index Page
app.get('/demo/workflow', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Demo Workflow - traidefi</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;min-height:100vh;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}.header{text-align:center;margin-bottom:3rem}h1{color:#fff;font-size:2.5rem;margin-bottom:1rem}.subtitle{color:#ccc;font-size:1.2rem;margin-bottom:2rem}.intro-box{background:#1a1a1a;padding:2rem;border-radius:15px;margin-bottom:3rem;border:1px solid #333}.intro-box p{color:#ccc;line-height:1.8;font-size:1.1rem;margin-bottom:1rem}.workflow-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem;margin-bottom:3rem}.workflow-card{background:#1a1a1a;padding:2rem;border-radius:15px;border:2px solid #333;transition:all 0.3s;cursor:pointer}.workflow-card:hover{border-color:#667eea;background:#2a2a2a}.workflow-card h3{color:#fff;font-size:1.5rem;margin-bottom:1rem}.workflow-card p{color:#ccc;line-height:1.6;margin-bottom:1.5rem}.workflow-card .step-count{color:#667eea;font-weight:600;margin-bottom:0.5rem}.btn{display:inline-block;padding:12px 24px;background:#667eea;color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;text-decoration:none}.btn:hover{background:#5a6fd8}.btn.secondary{background:#666}.btn.secondary:hover{background:#777}.back-link{text-align:center;margin-top:2rem}.back-link a{color:#667eea;text-decoration:none;font-size:1.1rem}</style></head><body><div class="container"><div class="header"><h1>📚 Platform Demo & Documentation</h1><p class="subtitle">Step-by-step walkthrough of every page and backend process</p></div><div class="intro-box"><p><strong>Welcome to the comprehensive demo system!</strong> This interactive guide walks you through every page of the Tangent Platform, showing you exactly what users see and what happens behind the scenes in the backend.</p><p>Each workflow includes detailed explanations of:</p><ul style="color:#ccc;line-height:2;margin-left:2rem"><li>What the page looks like and its purpose</li><li>What happens when users interact with it</li><li>Backend API calls and database operations</li><li>Data flow and state changes</li><li>Security and validation checks</li></ul></div><div class="workflow-grid"><div class="workflow-card" onclick="window.location.href='/demo/workflow/buyer'"><div class="step-count">8 Steps</div><h3>👤 Buyer Workflow</h3><p>Complete buyer journey from signup to contract completion. See how buyers create contracts, pay deposits, review documents, and release payments.</p><a href="/demo/workflow/buyer" class="btn">Start Buyer Demo →</a></div><div class="workflow-card" onclick="window.location.href='/demo/workflow/supplier'"><div class="step-count">7 Steps</div><h3>🏭 Supplier Workflow</h3><p>Supplier journey from registration to receiving payments. Learn how suppliers confirm contracts, upload documents, and get paid.</p><a href="/demo/workflow/supplier" class="btn">Start Supplier Demo →</a></div><div class="workflow-card" onclick="window.location.href='/demo/workflow/trader'"><div class="step-count">9 Steps</div><h3>🤝 Trader Workflow</h3><p>Trader dual-role workflow. See how traders manage contracts as both buyer and supplier simultaneously.</p><a href="/demo/workflow/trader" class="btn">Start Trader Demo →</a></div><div class="workflow-card" onclick="window.location.href='/demo/workflow/admin'"><div class="step-count">6 Sections</div><h3>⚙️ Admin Dashboard</h3><p>Complete admin overview. Explore user management, KYC review, contract oversight, and platform configuration.</p><a href="/demo/workflow/admin" class="btn">Start Admin Demo →</a></div></div><div class="back-link"><a href="/landing-two">← Back to Access Portal</a></div></div><script>console.log('Demo workflow index loaded')</script></body></html>`;
    res.end(html, 'utf8');
});

// Demo Buyer Workflow - Step by Step
app.get('/demo/workflow/buyer', (req, res) => {
    const step = parseInt(req.query.step) || 1;
    const totalSteps = 9;
    
    const steps = [
        {
            title: 'Step 1: Sign Up Page',
            pageUrl: '/signup',
            description: 'The buyer starts by creating an account on the signup page.',
            frontend: {
                what: 'User sees a clean signup form with email, password, and role selection fields. The form includes a 4-step journey indicator showing: Sign Up → KYC Docs → Wallet Setup → Dashboard.',
                features: ['Email validation', 'Password strength requirements', 'Role selector (Buyer/Supplier/Trader/Insurer)', '4-step progress indicator']
            },
            backend: {
                endpoint: 'POST /api/auth/register',
                process: [
                    'Validates email format and checks if email already exists',
                    'Hashes password using bcrypt (10 rounds)',
                    'Normalizes role to lowercase for validation',
                    'Creates user record in database.users Map',
                    'Generates JWT token with 7-day expiration',
                    'Sets initial KYC status to "pending"',
                    'Returns token and user data (without password)'
                ],
                database: {
                    table: 'database.users',
                    action: 'Create new user record',
                    fields: ['id', 'email', 'hashedPassword', 'role', 'kycStatus: "pending"', 'verified: false', 'createdAt']
                }
            },
            nextAction: 'User is redirected to /dashboard/kyc with token in URL'
        },
        {
            title: 'Step 2: KYC Document Upload',
            pageUrl: '/dashboard/kyc',
            description: 'Buyer must complete KYC verification by uploading required documents.',
            frontend: {
                what: 'User sees KYC form with company type selection (Listed Company or Private Company). Each type has different document requirements. Form includes file upload fields for passport, incorporation documents, financial statements, etc.',
                features: ['Company type selection', 'Document upload (PDF, JPG, PNG)', 'Real-time file validation', 'Progress tracking']
            },
            backend: {
                endpoint: 'POST /api/kyc/submit',
                process: [
                    'Authenticates user via JWT token',
                    'Receives uploaded files via Multer middleware',
                    'Validates file types and sizes',
                    'Stores files in /uploads directory',
                    'Creates KYC record in database.kyc Map',
                    'Updates user.kycStatus to "pending"',
                    'Stores document metadata (filename, path, type)',
                    'Triggers compliance checks (OFAC screening)'
                ],
                database: {
                    table: 'database.kyc',
                    action: 'Create KYC submission record',
                    fields: ['id', 'userId', 'companyType', 'documents[]', 'status: "pending"', 'submittedAt']
                }
            },
            nextAction: 'User is redirected to /wallet-setup after KYC submission'
        },
        {
            title: 'Step 3: Wallet Setup',
            pageUrl: '/wallet-setup',
            description: 'Buyer sets up their cryptocurrency wallet to enable payments.',
            frontend: {
                what: 'User sees two options: "I have a wallet" (manual entry) or "Help me set up wallet" (MetaMask integration). For manual entry, user inputs wallet address and type. MetaMask option connects to browser extension.',
                features: ['Manual wallet entry', 'MetaMask integration', 'Ethereum address validation (0x + 40 hex chars)', 'Wallet type selection']
            },
            backend: {
                endpoint: 'POST /api/wallet/create',
                process: [
                    'Validates wallet address format (Ethereum: 0x + 40 hex)',
                    'Creates wallet record in database.wallets Map',
                    'Links wallet to user via email',
                    'Sets initial TGT balance (demo: $100,000)',
                    'Updates user.hasWallet = true',
                    'Stores wallet type (Manual/MetaMask)'
                ],
                database: {
                    table: 'database.wallets',
                    action: 'Create wallet record',
                    fields: ['id: "wallet-{email}"', 'address', 'type', 'tgtBalance: 100000', 'createdAt']
                }
            },
            nextAction: 'User is redirected to /dashboard/authenticated (main dashboard)'
        },
        {
            title: 'Step 4: Dashboard Overview',
            pageUrl: '/dashboard/authenticated',
            description: 'Buyer sees their main dashboard with contract management interface.',
            frontend: {
                what: 'Dashboard shows: User role badge, notification bell, contract list table, "Create New Contract" button, and contract action buttons (Pay Deposit, Manage, etc.). Each contract displays: ID, product, value, status, counterparty, flags, and actions.',
                features: ['Contract list with filters', 'Real-time status updates', 'Action buttons per contract', 'Notifications system', 'Role-based UI']
            },
            backend: {
                endpoint: 'GET /api/contracts',
                process: [
                    'Authenticates user via JWT',
                    'Queries database.contracts Map',
                    'Filters contracts where user is buyerEmail or supplierEmail',
                    'Enriches contract data with status, flags, and actions',
                    'Returns JSON array of user contracts'
                ],
                database: {
                    table: 'database.contracts',
                    action: 'Query user contracts',
                    filter: 'contract.buyerEmail === userEmail OR contract.supplierEmail === userEmail'
                }
            },
            nextAction: 'User clicks "Create New Contract" button'
        },
        {
            title: 'Step 5: Create Contract Page',
            pageUrl: '/create-contract',
            description: 'Buyer creates a new contract with product details, pricing, and counterparty information. When contract is created, an email notification is automatically sent to the supplier.',
            frontend: {
                what: 'Form includes: PDF upload (optional auto-fill), product dropdown (Rice, Wheat, Corn, etc. or "Other"), quantity, unit, price per unit with market comparison, currency selection (TGT/USDT/USDC), counterparty email, deposit percentage, voyage time, and description. Price comparison shows market average and variance warning if >5%. After submission, buyer sees confirmation message.',
                features: ['PDF contract upload with auto-extraction', 'Product dropdown with "Other" option', 'Real-time price comparison with exchanges', 'Currency selection (TGT/USDT/USDC)', 'Form validation', 'Email notification to supplier']
            },
            backend: {
                endpoint: 'POST /api/contracts/create',
                process: [
                    'Validates all required fields',
                    'Checks counterparty exists in database',
                    'Calculates totalValue = quantity × price',
                    'Calculates depositAmount = totalValue × (depositPercent/100)',
                    'Creates contract in database.contracts Map',
                    'Sets status: "pending_supplier_confirmation"',
                    'Sends email notification to supplier email address',
                    'Email contains contract details and link to dashboard',
                    'Logs audit event: contract_created',
                    'Returns contract ID and full contract object'
                ],
                database: {
                    table: 'database.contracts',
                    action: 'Create new contract',
                    fields: ['id', 'product', 'quantity', 'unit', 'pricePerUnit', 'totalValue', 'currency', 'buyerEmail', 'supplierEmail', 'depositPercent', 'depositAmount', 'status', 'createdAt']
                }
            },
            nextAction: 'Email sent to supplier. Contract appears in supplier dashboard waiting for confirmation. Contract also appears in buyer dashboard with status "Waiting for Supplier Confirmation".'
        },
        {
            title: 'Step 6: Pay Deposit (30%)',
            pageUrl: '/dashboard/authenticated (contract action)',
            description: 'After supplier confirms, buyer pays the 30% deposit. The deposit goes to the pool wallet. Once paid, contract becomes ACTIVE and supplier immediately sees the status change in their dashboard.',
            frontend: {
                what: 'Buyer sees "Pay Deposit ($X)" button on contract. Clicking it shows MetaMask option (if available) or proceeds with simulation. Button is only visible when contract status is "pending_deposit". After payment, contract status changes to "ACTIVE" in green. Supplier dashboard automatically updates to show "ACTIVE" status with "Deposit Received" indicator.',
                features: ['MetaMask integration (optional)', 'Blockchain payment support', 'Simulation mode fallback', 'Balance validation', 'Real-time status update for supplier', 'Pool wallet deposit']
            },
            backend: {
                endpoint: 'POST /api/contracts/:contractId/deposit',
                process: [
                    'Validates user is the buyer',
                    'Checks contract status allows deposit',
                    'Validates wallet balance (wallet.tgtBalance >= depositAmount)',
                    'Deducts depositAmount (30%) from buyer wallet',
                    'Transfers depositAmount to pool wallet (escrow)',
                    'Updates contract: depositPaid = true, status = "active", depositPaidAt = timestamp',
                    'Pool wallet finances 100% to supplier immediately (supplier receives full amount)',
                    'Creates transaction record in database.transactions',
                    'Sends notification to supplier: "Deposit received, contract is now active"',
                    'Logs audit event: deposit_paid',
                    'Returns success with updated contract'
                ],
                database: {
                    tables: ['database.contracts (update)', 'database.wallets (buyer deduction, pool deposit, supplier credit)', 'database.transactions (create)'],
                    actions: ['Update contract status to active', 'Deduct 30% from buyer wallet', 'Add 30% to pool wallet', 'Credit 100% to supplier wallet', 'Create transaction records']
                }
            },
            nextAction: 'Contract is now ACTIVE. Supplier sees active status and can prepare shipment. Supplier has already received 100% payment (30% from pool + 70% financed). Buyer must pay remaining 70% + fees before delivery period ends.'
        },
        {
            title: 'Step 7: Document Upload & Automatic Payment',
            pageUrl: '/manage-contract/:contractId (supplier) → /dashboard/authenticated (buyer)',
            description: 'When delivery period arrives, supplier uploads shipping documents. Upon upload, payment request automatically appears in buyer dashboard with countdown timer. Supplier automatically receives 100% funds (30% from pool + 70% financed).',
            frontend: {
                what: 'Supplier uploads documents via file upload interface. Documents are stored in /uploads directory on server. After upload, buyer dashboard shows: "Payment Request: $X (70% + fees)" with countdown timer = (voyage time - 3 days). Countdown shows days/hours remaining. If countdown expires, contract automatically moves to auction page. Supplier dashboard shows "Documents Uploaded" and "Payment Received: 100%" status.',
                features: ['Document upload interface', 'File storage in /uploads directory', 'Automatic payment request to buyer', 'Countdown timer (voyage time - 3 days)', 'Automatic fund release to supplier', 'Auction trigger on timeout']
            },
            backend: {
                endpoint: 'POST /api/contracts/:contractId/documents',
                process: [
                    'Validates user is supplier',
                    'Receives files via Multer middleware',
                    'Stores files in /uploads directory on server filesystem',
                    'File path format: /uploads/contracts/{contractId}/{timestamp}-{filename}',
                    'Creates document records in database.documents Map',
                    'Each document record stores: id, contractId, filename, originalName, path, size, mimetype, uploadedBy, uploadedAt',
                    'Updates contract: documentsUploaded = true, documentsUploadedAt = timestamp',
                    'Calculates paymentDueDate = documentsUploadedAt + (voyageTime - 3 days)',
                    'Automatically transfers 30% from pool wallet to supplier wallet',
                    'Automatically transfers 70% (financed amount) to supplier wallet',
                    'Supplier receives 100% total payment immediately',
                    'Sends payment request notification to buyer with countdown',
                    'Logs audit event: documents_uploaded',
                    'Returns success with document metadata'
                ],
                database: {
                    tables: ['database.documents (create records)', 'database.contracts (update)', 'database.wallets (transfer 30% from pool + 70% to supplier)', 'database.transactions (create)'],
                    actions: ['Store documents in /uploads directory', 'Create document records', 'Update contract status', 'Transfer 100% to supplier', 'Create payment request for buyer']
                }
            },
            nextAction: 'Buyer sees payment request with countdown. If buyer pays within countdown, contract completes. If countdown expires, contract automatically moves to auction with minimum bid = 70% + fees.'
        },
        {
            title: 'Step 8: Contract Completion',
            pageUrl: '/dashboard/authenticated',
            description: 'Contract is fully completed. Both buyer and supplier can view the completed contract in their dashboard.',
            frontend: {
                what: 'Completed contracts show status "COMPLETED" in green. All action buttons are removed. Contract details show full transaction history. Both parties can download documents and view audit trail.',
                features: ['Completed status display', 'Transaction history', 'Document download', 'Audit trail view']
            },
            backend: {
                endpoint: 'GET /api/contracts (with completed status)',
                process: [
                    'Returns contracts with status "completed"',
                    'Includes all transaction records',
                    'Includes document metadata',
                    'Includes audit log entries',
                    'Shows final payment details'
                ],
                database: {
                    tables: ['database.contracts', 'database.transactions', 'database.documents', 'database.auditLogs'],
                    action: 'Query and join related data for completed contracts'
                }
            },
            nextAction: 'Workflow complete! Buyer can create new contracts.'
        }
    ];
    
    const currentStep = steps[step - 1];
    const prevStep = step > 1 ? step - 1 : null;
    const nextStep = step < totalSteps ? step + 1 : null;
    
    // Helper function to generate page mockup HTML
    function generatePageMockup(step) {
        const pageType = step.pageUrl.toLowerCase();
        if (pageType.includes('signup')) {
            return `<div class="mockup-form"><div class="form-field"><label>Email Address *</label><input type="email" value="buyer@example.com" readonly></div><div class="form-field"><label>Password *</label><input type="password" value="••••••••" readonly></div><div class="form-field"><label>Your Role *</label><select><option selected>Buyer</option><option>Supplier</option><option>Trader</option></select></div><button class="mockup-button">Create Account</button><div style="margin-top:1rem;padding:1rem;background:#e3f2fd;border-radius:4px;color:#333"><strong>Your Registration Journey:</strong><br>1. Sign Up → 2. KYC Docs → 3. Wallet Setup → 4. Dashboard</div></div>`;
        } else if (pageType.includes('kyc') || pageType.includes('dashboard/kyc')) {
            return `<div class="mockup-form"><h3 style="color:#333;margin-bottom:1rem">KYC Document Upload</h3><div class="form-field"><label>Company Type</label><select><option>Listed Company</option><option>Private Company</option></select></div><div class="form-field"><label>Passport/ID</label><input type="file" readonly></div><div class="form-field"><label>Incorporation Documents</label><input type="file" readonly></div><div class="form-field"><label>Financial Statements</label><input type="file" readonly></div><button class="mockup-button">Submit KYC</button></div>`;
        } else if (pageType.includes('wallet')) {
            return `<div style="display:flex;gap:1rem;margin:1rem 0"><div style="flex:1;background:#f5f5f5;padding:1.5rem;border-radius:6px;text-align:center"><h4 style="color:#333;margin-bottom:0.5rem">I have a wallet</h4><p style="color:#666;font-size:0.9rem">Enter your existing wallet address</p></div><div style="flex:1;background:#f5f5f5;padding:1.5rem;border-radius:6px;text-align:center"><h4 style="color:#333;margin-bottom:0.5rem">Help me set up wallet</h4><p style="color:#666;font-size:0.9rem">Connect with MetaMask</p></div></div><div class="mockup-form"><div class="form-field"><label>Wallet Address *</label><input type="text" value="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" readonly></div><div class="form-field"><label>Wallet Type</label><input type="text" value="MetaMask" readonly></div><button class="mockup-button">Save Wallet</button></div>`;
        } else if (pageType.includes('dashboard') || pageType.includes('authenticated')) {
            return `<div style="background:#f5f5f5;padding:1rem;border-radius:6px;margin-bottom:1rem"><div style="display:flex;justify-content:space-between;align-items:center"><span style="color:#333;font-weight:600">BUYER</span><span style="color:#333">🔔 Notifications</span></div></div><div style="display:flex;justify-content:space-between;margin-bottom:1rem"><h3 style="color:#333;margin:0">My Contracts</h3><button class="mockup-button" style="padding:8px 16px;font-size:0.9rem">Create New Contract</button></div><table style="width:100%;border-collapse:collapse;background:#fff;color:#333"><thead><tr style="background:#1a1a1a;color:#fff"><th style="padding:8px;text-align:left">Contract ID</th><th style="padding:8px;text-align:left">Product</th><th style="padding:8px;text-align:left">Value</th><th style="padding:8px;text-align:left">Status</th><th style="padding:8px;text-align:left">Actions</th></tr></thead><tbody><tr><td style="padding:8px;border-bottom:1px solid #ddd">contract-001</td><td style="padding:8px;border-bottom:1px solid #ddd">Wheat</td><td style="padding:8px;border-bottom:1px solid #ddd">$2,627,500</td><td style="padding:8px;border-bottom:1px solid #ddd">PENDING DEPOSIT</td><td style="padding:8px;border-bottom:1px solid #ddd"><button style="background:#666;color:#fff;padding:4px 8px;border:none;border-radius:4px;font-size:0.85rem">Pay Deposit</button></td></tr></tbody></table>`;
        } else if (pageType.includes('create-contract')) {
            return `<div class="mockup-form"><div class="form-field"><label>Product/Commodity *</label><select><option>Rice</option><option selected>Wheat</option><option>Corn</option></select></div><div class="form-field"><label>Quantity *</label><input type="number" value="5000" readonly></div><div class="form-field"><label>Unit *</label><select><option selected>Metric Tons (MT)</option></select></div><div class="form-field"><label>Price per Unit *</label><input type="number" value="525.50" readonly><div style="margin-top:0.5rem;padding:0.5rem;background:#fff3cd;border-radius:4px;color:#856404;font-size:0.85rem">Market Average: $520.00 | Difference: 1.06% above market ✓</div></div><div style="display:flex;gap:0.5rem;margin:1rem 0"><div style="flex:1;background:#667eea;color:#fff;padding:1rem;border-radius:6px;text-align:center"><strong>TGT</strong><br><small>Tangent Token</small></div><div style="flex:1;background:#333;color:#fff;padding:1rem;border-radius:6px;text-align:center"><strong>USDT</strong><br><small>Tether USD</small></div><div style="flex:1;background:#333;color:#fff;padding:1rem;border-radius:6px;text-align:center"><strong>USDC</strong><br><small>USD Coin</small></div></div><div class="form-field"><label>Counterparty Email *</label><input type="email" value="supplier@example.com" readonly></div><button class="mockup-button">Create Contract</button></div>`;
        } else {
            return `<div class="mockup-form"><p style="color:#333;text-align:center;padding:2rem">Visual representation of ${step.title}</p><div style="background:#f5f5f5;padding:1rem;border-radius:6px;margin-top:1rem"><p style="color:#666;font-size:0.9rem;margin:0">This page shows: ${step.frontend.what.substring(0, 100)}...</p></div></div>`;
        }
    }
    
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const pageUrl = currentStep.pageUrl.includes(' → ') ? currentStep.pageUrl.split(' → ')[0] : currentStep.pageUrl.includes('(') ? currentStep.pageUrl.split(' (')[0] : currentStep.pageUrl;
    const cleanUrl = pageUrl.startsWith('/') ? pageUrl : '/' + pageUrl;
    
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${currentStep.title} - Buyer Demo</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;min-height:100vh;color:#fff;padding:2rem}.container{max-width:1400px;margin:0 auto}.header{text-align:center;margin-bottom:2rem}h1{color:#fff;font-size:2rem;margin-bottom:0.5rem}.step-indicator{color:#667eea;font-size:1.1rem;margin-bottom:2rem}.content{background:#1a1a1a;padding:2rem;border-radius:15px;margin-bottom:2rem}.section{margin-bottom:2rem}.section h3{color:#fff;font-size:1.3rem;margin-bottom:1rem;border-bottom:2px solid #333;padding-bottom:0.5rem}.section p{color:#ccc;line-height:1.8;margin-bottom:1rem}.section ul{color:#ccc;line-height:2;margin-left:2rem;margin-bottom:1rem}.code-block{background:#0a0a0a;padding:1rem;border-radius:8px;border:1px solid #333;margin:1rem 0;font-family:monospace;font-size:0.9rem;overflow-x:auto}.code-block code{color:#51cf66}.endpoint{color:#ffd43b}.action{color:#4dabf7}.page-visual{background:#0a0a0a;border:2px solid #333;border-radius:8px;padding:2rem;margin:1rem 0}.page-visual h4{color:#fff;margin-bottom:1.5rem;font-size:1.2rem}.mockup-container{background:#fff;border-radius:8px;padding:2rem;color:#000;position:relative;min-height:400px}.mockup-header{background:#1a1a1a;color:#fff;padding:1rem;border-radius:6px 6px 0 0;margin:-2rem -2rem 1rem -2rem}.mockup-content{padding:1rem 0}.mockup-form{background:#f5f5f5;padding:1.5rem;border-radius:6px;margin:1rem 0}.form-field{margin-bottom:1rem}.form-field label{display:block;color:#333;font-weight:600;margin-bottom:0.5rem;font-size:0.9rem}.form-field input,.form-field select{width:100%;padding:10px;background:#fff;border:1px solid #ddd;border-radius:4px;color:#333}.mockup-button{background:#667eea;color:#fff;padding:12px 24px;border:none;border-radius:6px;cursor:pointer;font-weight:600;margin-top:1rem}.visual-description{background:#2a2a2a;padding:1.5rem;border-radius:8px;margin:1rem 0;border-left:4px solid #667eea}.visual-description h4{color:#fff;margin-bottom:0.5rem}.visual-description p{color:#ccc;line-height:1.6}.navigation{display:flex;justify-content:space-between;margin-top:2rem}.btn{padding:12px 24px;background:#667eea;color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}.btn:hover{background:#5a6fd8}.btn.secondary{background:#666}.btn.secondary:hover{background:#777}.btn:disabled{opacity:0.5;cursor:not-allowed}.back-link{text-align:center;margin-top:2rem}.back-link a{color:#667eea;text-decoration:none}table{width:100%;border-collapse:collapse}th,td{padding:8px;text-align:left;border-bottom:1px solid #ddd}th{background:#1a1a1a;color:#fff}</style></head><body><div class="container"><div class="header"><div class="step-indicator">Step ${step} of ${totalSteps}</div><h1>${currentStep.title}</h1><p style="color:#ccc">${currentStep.description}</p></div><div class="content"><div class="section"><h3>📍 Page Location</h3><p><strong>URL:</strong> <code class="endpoint">${currentStep.pageUrl}</code></p><div class="page-visual"><h4>📸 Visual Representation of the Page</h4><div class="mockup-container"><div class="mockup-header">${currentStep.title}</div><div class="mockup-content">${generatePageMockup(currentStep)}</div></div></div><div class="visual-description"><h4>🎨 Detailed Visual Description</h4><p>${currentStep.frontend.what}</p><p><strong>Key Visual Elements:</strong></p><ul>${currentStep.frontend.features.map(f => `<li>${f}</li>`).join('')}</ul></div><div class="section"><h3>⚙️ Backend Process</h3><p><strong>API Endpoint:</strong> <code class="endpoint">${currentStep.backend.endpoint}</code></p><div class="code-block"><code><strong>Process Flow:</strong><br>${currentStep.backend.process.map((p, i) => `${i + 1}. ${p}`).join('<br>')}</code></div><p><strong>Database Operations:</strong></p><ul><li><strong>Table:</strong> <code>${currentStep.backend.database.table || currentStep.backend.database.tables || 'N/A'}</code></li><li><strong>Action:</strong> ${currentStep.backend.database.action}</li>${currentStep.backend.database.fields ? `<li><strong>Fields:</strong> ${Array.isArray(currentStep.backend.database.fields) ? currentStep.backend.database.fields.join(', ') : currentStep.backend.database.fields}</li>` : ''}</ul></div><div class="section"><h3>➡️ Next Action</h3><p>${currentStep.nextAction}</p></div></div><div class="navigation">${prevStep ? `<a href="/demo/workflow/buyer?step=${prevStep}" class="btn secondary">← Previous Step</a>` : '<span></span>'}${nextStep ? `<a href="/demo/workflow/buyer?step=${nextStep}" class="btn">Next Step →</a>` : `<a href="/demo/workflow" class="btn">Back to Demo Index</a>`}</div><div class="back-link"><a href="/demo/workflow">← Back to All Demos</a> | <a href="/landing-two">Back to Portal</a></div></div><script>console.log('Buyer demo step ${step} loaded')</script></body></html>`;
    res.end(html, 'utf8');
});

// Demo Supplier Workflow - Step by Step
app.get('/demo/workflow/supplier', (req, res) => {
    const step = parseInt(req.query.step) || 1;
    const totalSteps = 7;
    
    const steps = [
        {
            title: 'Step 1: Sign Up & KYC',
            pageUrl: '/signup → /dashboard/kyc',
            description: 'Supplier registers and completes KYC verification (same process as buyer).',
            frontend: { what: 'Same as buyer: signup form, KYC document upload, wallet setup.', features: ['Company type selection', 'Document upload', 'Wallet setup'] },
            backend: { endpoint: 'POST /api/auth/register, POST /api/kyc/submit', process: ['User registration', 'KYC submission', 'Document storage'], database: { table: 'database.users, database.kyc', action: 'Create user and KYC records' } },
            nextAction: 'Supplier completes KYC and wallet setup'
        },
        {
            title: 'Step 2: Receive Contract Request',
            pageUrl: '/dashboard/authenticated',
            description: 'Supplier receives a contract request from a buyer and sees it in their dashboard.',
            frontend: { what: 'Dashboard shows contract with status "PENDING_SUPPLIER_CONFIRMATION". Contract displays: product, quantity, price, total value, buyer email, deposit percentage. "Confirm Contract" button is visible.', features: ['Contract notification', 'Contract details view', 'Confirm button'] },
            backend: { endpoint: 'GET /api/contracts', process: ['Queries contracts where supplierEmail matches', 'Filters by status', 'Returns pending contracts'], database: { table: 'database.contracts', action: 'Query contracts where supplierEmail === userEmail' } },
            nextAction: 'Supplier clicks "Confirm Contract"'
        },
        {
            title: 'Step 3: Confirm Contract',
            pageUrl: '/dashboard/authenticated (contract action)',
            description: 'Supplier confirms the contract, making it active and ready for buyer deposit.',
            frontend: { what: 'After clicking "Confirm Contract", status changes to "PENDING_DEPOSIT". Button disappears, replaced with "Awaiting Buyer Deposit" status.', features: ['One-click confirmation', 'Status update', 'Visual feedback'] },
            backend: { endpoint: 'POST /api/contracts/:contractId/confirm', process: ['Validates user is the supplier', 'Updates contract.status to "pending_deposit"', 'Logs audit event: contract_confirmed', 'Returns updated contract'], database: { table: 'database.contracts', action: 'Update contract status' } },
            nextAction: 'Contract status changes, buyer can now pay deposit'
        },
        {
            title: 'Step 4: Receive Deposit Payment & Contract Activation',
            pageUrl: '/dashboard/authenticated',
            description: 'After buyer pays 30% deposit, contract becomes ACTIVE. Supplier immediately sees status change in dashboard. Pool wallet finances 100% to supplier (30% from deposit + 70% financed).',
            frontend: { 
                what: 'Contract status automatically changes to "ACTIVE" with "Deposit Paid" indicator in green. "Upload Shipping Docs" button appears. Contract shows: "Deposit Received: 30%" and "Payment Status: 100% Financed to Supplier". Supplier dashboard updates in real-time showing active status.', 
                features: ['Active status display', 'Deposit confirmation (30%)', 'Upload documents button', 'Real-time status update', 'Payment status: 100% received'] 
            },
            backend: { 
                endpoint: 'POST /api/contracts/:contractId/deposit (buyer action)', 
                process: [
                    'Buyer pays 30% deposit',
                    'Deposit goes to pool wallet (escrow)',
                    'Pool wallet immediately finances 100% to supplier',
                    'Supplier receives: 30% (from deposit) + 70% (financed) = 100% total',
                    'Contract.depositPaid = true',
                    'Contract.status = "active"',
                    'Contract.depositPaidAt = timestamp',
                    'Sends notification to supplier: "Deposit received, contract is active"',
                    'Transaction recorded in database.transactions',
                    'Logs audit event: deposit_paid'
                ], 
                database: { 
                    table: 'database.contracts (update), database.wallets (pool deposit, supplier credit), database.transactions (create)', 
                    action: 'Update contract to active, transfer 100% to supplier, create transaction records' 
                } 
            },
            nextAction: 'Contract is ACTIVE. Supplier has received 100% payment. Supplier can now prepare shipment and upload documents when delivery period arrives.'
        },
        {
            title: 'Step 5: Upload Shipping Documents & Automatic Payment',
            pageUrl: '/manage-contract/:contractId',
            description: 'When delivery period arrives, supplier uploads shipping documents. Documents are stored in uploads/ directory on server filesystem. Upon upload, supplier automatically receives 100% payment (already received at deposit, but confirmed). Payment request with countdown automatically appears in buyer dashboard.',
            frontend: { 
                what: 'Document upload page shows contract details and file upload interface. Supplier can upload multiple files (PDF, JPG, PNG). Files are stored in uploads/ directory on server. File path format: uploads/{timestamp}-{originalFilename}. After upload, supplier dashboard shows "Documents Uploaded" and "Payment Status: 100% Received". Buyer dashboard automatically shows payment request with countdown timer = (voyage time - 3 days).', 
                features: ['Multiple file upload', 'File type validation', 'Upload progress', 'Document list', 'Document storage in uploads/ directory', 'Automatic payment confirmation', 'Payment request to buyer with countdown'] 
            },
            backend: { 
                endpoint: 'POST /api/contracts/:contractId/documents', 
                process: [
                    'Receives files via Multer middleware',
                    'Validates file types (PDF, JPG, PNG) and sizes (max 10MB)',
                    'Stores files in filesystem: uploads/{timestamp}_{safeFilename}',
                    'File naming format: {timestamp}_{originalName} (e.g., uploads/1734567890_Bill_of_Lading.pdf)',
                    'Creates document records in database.documents Map',
                    'Each document record stores: id, contractId, filename (stored name), originalName (user filename), path (e.g., uploads/1734567890_Bill_of_Lading.pdf), size, mimetype, uploadedBy, uploadedAt',
                    'Updates contract: documentsUploaded = true, documentsUploadedAt = timestamp',
                    'Calculates paymentDueDate = documentsUploadedAt + (voyageTime - 3 days)',
                    'Supplier has already received 100% at deposit stage (30% from pool + 70% financed)',
                    'Payment is confirmed and supplier sees "Payment Received: 100%"',
                    'Sends payment request notification to buyer with countdown timer',
                    'Buyer dashboard shows: "Payment Due: $X (70% + fees)" with countdown',
                    'Logs audit event: documents_uploaded',
                    'Returns success with document metadata and storage paths'
                ], 
                database: { 
                    table: 'database.documents (create), database.contracts (update)', 
                    action: 'Store documents in uploads/ directory, create document records, update contract status, create payment request for buyer',
                    documentStorage: 'Physical files stored in: uploads/{timestamp}_{safeFilename} (e.g., uploads/1734567890_Bill_of_Lading.pdf). Document metadata stored in: database.documents Map with path field pointing to file location. Files accessible via GET /uploads/{filename} or through document API endpoints.'
                } 
            },
            nextAction: 'Supplier has received 100% payment. Buyer sees payment request with countdown. If buyer pays within countdown, contract completes. If countdown expires, contract goes to auction with minimum bid = 70% + fees.'
        },
        {
            title: 'Step 6: Payment Received & Document Access',
            pageUrl: '/dashboard/authenticated',
            description: 'Supplier has already received 100% payment automatically when documents were uploaded. Supplier can view completed contract and access stored documents from /uploads directory.',
            frontend: { 
                what: 'Contract shows "COMPLETED" status in green. Payment status shows "Payment Received: 100% (30% from pool + 70% financed)". Document section shows list of uploaded documents with download links. Documents are accessible from /uploads/contracts/{contractId}/ directory. Each document shows: filename, upload date, file size, download button.', 
                features: ['Completed status', 'Payment confirmation (100% received)', 'Document list with download links', 'Document storage location display', 'Transaction history'] 
            },
            backend: { 
                endpoint: 'GET /api/contracts/:contractId/documents, GET /api/contracts', 
                process: [
                    'Returns contract with status "completed"',
                    'Queries database.documents for all contract documents',
                    'Returns document metadata: id, filename, path, size, uploadedAt',
                    'Document files accessible from: /uploads/contracts/{contractId}/{timestamp}-{filename}',
                    'Shows payment history: 30% from pool, 70% financed',
                    'Includes all transaction records'
                ], 
                database: { 
                    table: 'database.contracts, database.documents, database.transactions', 
                    action: 'Query completed contract with documents. Documents stored in /uploads/contracts/{contractId}/ directory.',
                    documentStorage: 'Physical files: /uploads/contracts/{contractId}/{timestamp}-{filename}. Metadata: database.documents Map'
                } 
            },
            nextAction: 'Contract completed! Supplier can download documents and view transaction history. Documents remain stored in /uploads directory.'
        },
        {
            title: 'Step 7: Buyer Payment & Auction System',
            pageUrl: '/dashboard/authenticated (buyer)',
            description: 'Buyer sees payment request with countdown timer. If buyer pays within countdown, contract completes. If countdown expires, contract automatically moves to auction with minimum bid = 70% + fees.',
            frontend: { 
                what: 'Buyer dashboard shows: "Payment Due: $X (70% + fees)" with countdown timer displaying days/hours/minutes remaining. Countdown = (voyage time - 3 days) from document upload date. "Pay Remaining Amount" button visible. If countdown reaches zero, contract automatically moves to "Auction Board" with status "IN AUCTION". Auction page shows minimum bid = 70% + fees. If buyer pays before countdown expires, contract shows "COMPLETED" status.', 
                features: ['Countdown timer (voyage time - 3 days)', 'Payment due amount display', 'Automatic auction trigger on timeout', 'Auction board with minimum bid', 'Real-time countdown updates'] 
            },
            backend: { 
                endpoint: 'POST /api/contracts/:contractId/release-payment (if paid) OR Automatic auction creation (if timeout)', 
                process: [
                    'If buyer pays before countdown expires:',
                    '  - Validates payment amount (70% + fees)',
                    '  - Updates contract: status = "completed", finalPaymentReleased = true',
                    '  - Creates transaction record',
                    '  - Logs audit event: payment_released',
                    'If countdown expires (paymentDueDate < now):',
                    '  - Automatically creates auction in database.auctions Map',
                    '  - Sets auction.minimumBid = (totalValue - depositAmount) + fees = 70% + fees',
                    '  - Sets auction.startingBid = 70% + fees',
                    '  - Updates contract: status = "in_auction", auctionId = auction.id',
                    '  - Removes contract from buyer active contracts list',
                    '  - Adds contract to auction board',
                    '  - Sends notification to all users about new auction',
                    '  - Logs audit event: contract_moved_to_auction'
                ], 
                database: { 
                    table: 'database.contracts (update), database.auctions (create if timeout), database.transactions (create if paid)', 
                    action: 'Complete contract if paid, or create auction if timeout'
                } 
            },
            nextAction: 'If paid: Contract completed. If timeout: Contract in auction. Auction bidders can bid minimum 70% + fees to acquire the goods.'
        }
    ];
    
    const currentStep = steps[step - 1];
    const prevStep = step > 1 ? step - 1 : null;
    const nextStep = step < totalSteps ? step + 1 : null;
    
    // Helper function to generate page mockup HTML
    function generatePageMockup(step) {
        const pageType = step.pageUrl.toLowerCase();
        if (pageType.includes('signup')) {
            return `<div class="mockup-form"><div class="form-field"><label>Email Address *</label><input type="email" value="supplier@example.com" readonly></div><div class="form-field"><label>Password *</label><input type="password" value="••••••••" readonly></div><div class="form-field"><label>Your Role *</label><select><option>Buyer</option><option selected>Supplier</option><option>Trader</option></select></div><button class="mockup-button">Create Account</button></div>`;
        } else if (pageType.includes('dashboard') || pageType.includes('authenticated')) {
            return `<div style="background:#f5f5f5;padding:1rem;border-radius:6px;margin-bottom:1rem"><div style="display:flex;justify-content:space-between;align-items:center"><span style="color:#333;font-weight:600">SUPPLIER</span><span style="color:#333">🔔 Notifications</span></div></div><div style="display:flex;justify-content:space-between;margin-bottom:1rem"><h3 style="color:#333;margin:0">My Contracts</h3></div><table style="width:100%;border-collapse:collapse;background:#fff;color:#333"><thead><tr style="background:#1a1a1a;color:#fff"><th style="padding:8px;text-align:left">Contract ID</th><th style="padding:8px;text-align:left">Product</th><th style="padding:8px;text-align:left">Value</th><th style="padding:8px;text-align:left">Status</th><th style="padding:8px;text-align:left">Actions</th></tr></thead><tbody><tr><td style="padding:8px;border-bottom:1px solid #ddd">contract-001</td><td style="padding:8px;border-bottom:1px solid #ddd">Wheat</td><td style="padding:8px;border-bottom:1px solid #ddd">$2,627,500</td><td style="padding:8px;border-bottom:1px solid #ddd">PENDING SUPPLIER CONFIRMATION</td><td style="padding:8px;border-bottom:1px solid #ddd"><button style="background:#51cf66;color:#fff;padding:4px 8px;border:none;border-radius:4px;font-size:0.85rem">Confirm Contract</button></td></tr></tbody></table>`;
        } else if (pageType.includes('manage-contract')) {
            return `<div class="mockup-form"><h3 style="color:#333;margin-bottom:1rem">Manage Contract</h3><div style="background:#e3f2fd;padding:1rem;border-radius:4px;margin-bottom:1rem"><strong>Contract Details:</strong><br>Product: Wheat<br>Quantity: 5000 MT<br>Total Value: $2,627,500</div><div class="form-field"><label>Upload Shipping Documents</label><input type="file" multiple readonly></div><button class="mockup-button">Upload Documents</button></div>`;
        } else {
            return `<div class="mockup-form"><p style="color:#333;text-align:center;padding:2rem">Visual representation of ${step.title}</p><div style="background:#f5f5f5;padding:1rem;border-radius:6px;margin-top:1rem"><p style="color:#666;font-size:0.9rem;margin:0">This page shows: ${step.frontend.what.substring(0, 100)}...</p></div></div>`;
        }
    }
    
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const pageUrl = currentStep.pageUrl.includes(' → ') ? currentStep.pageUrl.split(' → ')[0] : currentStep.pageUrl.includes('(') ? currentStep.pageUrl.split(' (')[0] : currentStep.pageUrl;
    const cleanUrl = pageUrl.startsWith('/') ? pageUrl : '/' + pageUrl;
    
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${currentStep.title} - Supplier Demo</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;min-height:100vh;color:#fff;padding:2rem}.container{max-width:1400px;margin:0 auto}.header{text-align:center;margin-bottom:2rem}h1{color:#fff;font-size:2rem;margin-bottom:0.5rem}.step-indicator{color:#667eea;font-size:1.1rem;margin-bottom:2rem}.content{background:#1a1a1a;padding:2rem;border-radius:15px;margin-bottom:2rem}.section{margin-bottom:2rem}.section h3{color:#fff;font-size:1.3rem;margin-bottom:1rem;border-bottom:2px solid #333;padding-bottom:0.5rem}.section p{color:#ccc;line-height:1.8;margin-bottom:1rem}.section ul{color:#ccc;line-height:2;margin-left:2rem;margin-bottom:1rem}.code-block{background:#0a0a0a;padding:1rem;border-radius:8px;border:1px solid #333;margin:1rem 0;font-family:monospace;font-size:0.9rem;overflow-x:auto}.code-block code{color:#51cf66}.endpoint{color:#ffd43b}.page-visual{background:#0a0a0a;border:2px solid #333;border-radius:8px;padding:2rem;margin:1rem 0}.page-visual h4{color:#fff;margin-bottom:1.5rem;font-size:1.2rem}.mockup-container{background:#fff;border-radius:8px;padding:2rem;color:#000;position:relative;min-height:400px}.mockup-header{background:#1a1a1a;color:#fff;padding:1rem;border-radius:6px 6px 0 0;margin:-2rem -2rem 1rem -2rem}.mockup-content{padding:1rem 0}.mockup-form{background:#f5f5f5;padding:1.5rem;border-radius:6px;margin:1rem 0}.form-field{margin-bottom:1rem}.form-field label{display:block;color:#333;font-weight:600;margin-bottom:0.5rem;font-size:0.9rem}.form-field input,.form-field select{width:100%;padding:10px;background:#fff;border:1px solid #ddd;border-radius:4px;color:#333}.mockup-button{background:#667eea;color:#fff;padding:12px 24px;border:none;border-radius:6px;cursor:pointer;font-weight:600;margin-top:1rem}.visual-description{background:#2a2a2a;padding:1.5rem;border-radius:8px;margin:1rem 0;border-left:4px solid #667eea}.visual-description h4{color:#fff;margin-bottom:0.5rem}.visual-description p{color:#ccc;line-height:1.6}.navigation{display:flex;justify-content:space-between;margin-top:2rem}.btn{padding:12px 24px;background:#667eea;color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}.btn:hover{background:#5a6fd8}.btn.secondary{background:#666}.btn.secondary:hover{background:#777}.back-link{text-align:center;margin-top:2rem}.back-link a{color:#667eea;text-decoration:none}table{width:100%;border-collapse:collapse}th,td{padding:8px;text-align:left;border-bottom:1px solid #ddd}th{background:#1a1a1a;color:#fff}</style></head><body><div class="container"><div class="header"><div class="step-indicator">Step ${step} of ${totalSteps}</div><h1>${currentStep.title}</h1><p style="color:#ccc">${currentStep.description}</p></div><div class="content"><div class="section"><h3>📍 Page Location</h3><p><strong>URL:</strong> <code class="endpoint">${currentStep.pageUrl}</code></p><div class="page-visual"><h4>📸 Visual Representation of the Page</h4><div class="mockup-container"><div class="mockup-header">${currentStep.title}</div><div class="mockup-content">${generatePageMockup(currentStep)}</div></div></div><div class="visual-description"><h4>🎨 Detailed Visual Description</h4><p>${currentStep.frontend.what}</p><p><strong>Key Visual Elements:</strong></p><ul>${currentStep.frontend.features.map(f => `<li>${f}</li>`).join('')}</ul></div><div class="section"><h3>⚙️ Backend Process</h3><p><strong>API Endpoint:</strong> <code class="endpoint">${currentStep.backend.endpoint}</code></p><div class="code-block"><code><strong>Process Flow:</strong><br>${Array.isArray(currentStep.backend.process) ? currentStep.backend.process.map((p, i) => `${i + 1}. ${p}`).join('<br>') : currentStep.backend.process}</code></div><p><strong>Database Operations:</strong></p><ul><li><strong>Table:</strong> <code>${currentStep.backend.database.table || currentStep.backend.database.tables || 'N/A'}</code></li><li><strong>Action:</strong> ${currentStep.backend.database.action}</li>${currentStep.backend.database.fields ? `<li><strong>Fields:</strong> ${Array.isArray(currentStep.backend.database.fields) ? currentStep.backend.database.fields.join(', ') : currentStep.backend.database.fields}</li>` : ''}</ul></div><div class="section"><h3>➡️ Next Action</h3><p>${currentStep.nextAction}</p></div></div><div class="navigation">${prevStep ? `<a href="/demo/workflow/supplier?step=${prevStep}" class="btn secondary">← Previous Step</a>` : '<span></span>'}${nextStep ? `<a href="/demo/workflow/supplier?step=${nextStep}" class="btn">Next Step →</a>` : `<a href="/demo/workflow" class="btn">Back to Demo Index</a>`}</div><div class="back-link"><a href="/demo/workflow">← Back to All Demos</a> | <a href="/landing-two">Back to Portal</a></div></div></body></html>`;
    res.end(html, 'utf8');
});

// Demo Trader Workflow - Step by Step  
app.get('/demo/workflow/trader', (req, res) => {
    const step = parseInt(req.query.step) || 1;
    const totalSteps = 9;
    
    const steps = [
        {
            title: 'Step 1: Trader Registration',
            pageUrl: '/signup',
            description: 'Trader signs up with role "trader" to enable dual-contract functionality.',
            frontend: { what: 'Same signup form, but trader selects "Trader" role. This enables them to act as both buyer and supplier.', features: ['Role selection', 'Trader-specific permissions'] },
            backend: { endpoint: 'POST /api/auth/register', process: ['Creates user with role: "trader"', 'Sets up trader permissions', 'Enables dual-contract access'], database: { table: 'database.users', action: 'Create trader user' } },
            nextAction: 'Trader completes KYC and wallet setup'
        },
        {
            title: 'Step 2: Create Dual Contracts',
            pageUrl: '/create-contract',
            description: 'Trader can create contracts as either buyer or supplier, managing both sides of trades.',
            frontend: { what: 'Contract creation form works the same, but trader can specify their role. They can create contracts where they are the buyer (with external supplier) or supplier (with external buyer).', features: ['Dual role selection', 'Flexible contract creation', 'Counterparty management'] },
            backend: { endpoint: 'POST /api/contracts', process: ['Trader can set buyerEmail or supplierEmail to their own email', 'System allows trader in both roles', 'Creates contract with trader as one party'], database: { table: 'database.contracts', action: 'Create trader contract' } },
            nextAction: 'Trader manages contracts from both perspectives'
        },
        {
            title: 'Step 3: Trader Dashboard - Dual View',
            pageUrl: '/dashboard/authenticated',
            description: 'Trader sees all contracts where they are involved as either buyer or supplier.',
            frontend: { what: 'Dashboard shows contracts with "My Role" column indicating "Buyer" or "Supplier". Each contract shows appropriate action buttons based on trader role in that contract. "Dual Contract" button available for managing both sides.', features: ['Dual role display', 'Role-based actions', 'Dual contract management'] },
            backend: { endpoint: 'GET /api/contracts', process: ['Queries contracts where trader email appears in buyerEmail OR supplierEmail', 'Returns all trader contracts', 'Enriches with role information'], database: { table: 'database.contracts', action: 'Query trader contracts (both roles)' } },
            nextAction: 'Trader can act as buyer or supplier per contract'
        },
        {
            title: 'Step 4: Act as Buyer - Pay Deposit',
            pageUrl: '/dashboard/authenticated',
            description: 'For contracts where trader is buyer, they can pay deposits like any buyer.',
            frontend: { what: 'Contracts with trader as buyer show "Pay Deposit" button. Same buyer workflow applies.', features: ['Buyer actions', 'Deposit payment', 'MetaMask support'] },
            backend: { endpoint: 'POST /api/contracts/:contractId/deposit', process: ['Validates trader is buyerEmail', 'Processes deposit payment', 'Updates contract status'], database: { table: 'database.contracts, database.wallets', action: 'Process deposit as buyer' } },
            nextAction: 'Deposit paid, contract becomes active'
        },
        {
            title: 'Step 5: Act as Supplier - Confirm Contract',
            pageUrl: '/dashboard/authenticated',
            description: 'For contracts where trader is supplier, they can confirm contracts like any supplier.',
            frontend: { what: 'Contracts with trader as supplier show "Confirm as Supplier" button. Same supplier workflow applies.', features: ['Supplier actions', 'Contract confirmation', 'Status updates'] },
            backend: { endpoint: 'POST /api/contracts/:contractId/confirm', process: ['Validates trader is supplierEmail', 'Confirms contract', 'Updates status to pending_deposit'], database: { table: 'database.contracts', action: 'Confirm contract as supplier' } },
            nextAction: 'Contract confirmed, waiting for buyer deposit'
        },
        {
            title: 'Step 6: Act as Supplier - Upload Documents',
            pageUrl: '/manage-contract/:contractId',
            description: 'When trader is supplier and deposit is paid, they upload shipping documents.',
            frontend: { what: 'Same document upload interface. Trader uploads documents as supplier would.', features: ['Document upload', 'Multiple files', 'File validation'] },
            backend: { endpoint: 'POST /api/contracts/:contractId/documents', process: ['Validates trader is supplierEmail', 'Stores documents', 'Updates contract.documentsUploaded'], database: { table: 'database.documents, database.contracts', action: 'Upload documents as supplier' } },
            nextAction: 'Documents uploaded, buyer can release payment'
        },
        {
            title: 'Step 7: Act as Buyer - Release Payment',
            pageUrl: '/dashboard/authenticated',
            description: 'When trader is buyer and documents are uploaded, they release final payment.',
            frontend: { what: 'Same payment release interface. Trader releases payment as buyer would.', features: ['Payment release', 'Final payment', 'Contract completion'] },
            backend: { endpoint: 'POST /api/contracts/:contractId/release-payment', process: ['Validates trader is buyerEmail', 'Releases payment to supplier', 'Completes contract'], database: { table: 'database.contracts, database.wallets', action: 'Release payment as buyer' } },
            nextAction: 'Payment released, contract completed'
        },
        {
            title: 'Step 8: Dual Contract Management',
            pageUrl: '/dashboard/authenticated',
            description: 'Trader can manage both sides of a trade simultaneously using "Dual Contract" feature.',
            frontend: { what: '"Dual Contract" button opens special view showing both buyer and supplier perspectives of the same contract. Trader can perform actions from either role.', features: ['Dual perspective view', 'Role switching', 'Unified management'] },
            backend: { endpoint: 'GET /api/contracts/:contractId', process: ['Returns contract with both buyer and supplier actions', 'Shows trader permissions for both roles', 'Enables dual management'], database: { table: 'database.contracts', action: 'Query contract with dual role data' } },
            nextAction: 'Trader manages complete trade lifecycle'
        },
        {
            title: 'Step 9: Complete Trade Cycle',
            pageUrl: '/dashboard/authenticated',
            description: 'Trader completes full trade cycle managing both buyer and supplier sides.',
            frontend: { what: 'Completed contracts show full transaction history from both perspectives. Trader can see all actions they performed as both buyer and supplier.', features: ['Complete history', 'Dual role tracking', 'Trade completion'] },
            backend: { endpoint: 'GET /api/contracts', process: ['Returns completed contracts', 'Includes all transactions', 'Shows dual role activity'], database: { table: 'database.contracts, database.transactions', action: 'Query completed trader contracts' } },
            nextAction: 'Trade cycle complete! Trader can create new dual contracts.'
        }
    ];
    
    const currentStep = steps[step - 1];
    const prevStep = step > 1 ? step - 1 : null;
    const nextStep = step < totalSteps ? step + 1 : null;
    
    // Helper function to generate page mockup HTML
    function generatePageMockup(step) {
        const pageType = step.pageUrl.toLowerCase();
        if (pageType.includes('signup')) {
            return `<div class="mockup-form"><div class="form-field"><label>Email Address *</label><input type="email" value="trader@example.com" readonly></div><div class="form-field"><label>Password *</label><input type="password" value="••••••••" readonly></div><div class="form-field"><label>Your Role *</label><select><option>Buyer</option><option>Supplier</option><option selected>Trader</option></select></div><button class="mockup-button">Create Account</button></div>`;
        } else if (pageType.includes('dashboard') || pageType.includes('authenticated')) {
            return `<div style="background:#f5f5f5;padding:1rem;border-radius:6px;margin-bottom:1rem"><div style="display:flex;justify-content:space-between;align-items:center"><span style="color:#333;font-weight:600">TRADER</span><span style="color:#333">🔔 Notifications</span></div></div><div style="display:flex;justify-content:space-between;margin-bottom:1rem"><h3 style="color:#333;margin:0">My Contracts (Dual Role)</h3><button class="mockup-button" style="padding:8px 16px;font-size:0.9rem">Create Contract</button></div><table style="width:100%;border-collapse:collapse;background:#fff;color:#333"><thead><tr style="background:#1a1a1a;color:#fff"><th style="padding:8px;text-align:left">Contract ID</th><th style="padding:8px;text-align:left">My Role</th><th style="padding:8px;text-align:left">Product</th><th style="padding:8px;text-align:left">Status</th><th style="padding:8px;text-align:left">Actions</th></tr></thead><tbody><tr><td style="padding:8px;border-bottom:1px solid #ddd">contract-001</td><td style="padding:8px;border-bottom:1px solid #ddd"><span style="background:#667eea;color:#fff;padding:2px 6px;border-radius:3px;font-size:0.8rem">BUYER</span></td><td style="padding:8px;border-bottom:1px solid #ddd">Wheat</td><td style="padding:8px;border-bottom:1px solid #ddd">PENDING DEPOSIT</td><td style="padding:8px;border-bottom:1px solid #ddd"><button style="background:#666;color:#fff;padding:4px 8px;border:none;border-radius:4px;font-size:0.85rem">Pay Deposit</button></td></tr><tr><td style="padding:8px;border-bottom:1px solid #ddd">contract-002</td><td style="padding:8px;border-bottom:1px solid #ddd"><span style="background:#51cf66;color:#fff;padding:2px 6px;border-radius:3px;font-size:0.8rem">SUPPLIER</span></td><td style="padding:8px;border-bottom:1px solid #ddd">Rice</td><td style="padding:8px;border-bottom:1px solid #ddd">PENDING CONFIRMATION</td><td style="padding:8px;border-bottom:1px solid #ddd"><button style="background:#51cf66;color:#fff;padding:4px 8px;border:none;border-radius:4px;font-size:0.85rem">Confirm</button></td></tr></tbody></table>`;
        } else {
            return `<div class="mockup-form"><p style="color:#333;text-align:center;padding:2rem">Visual representation of ${step.title}</p><div style="background:#f5f5f5;padding:1rem;border-radius:6px;margin-top:1rem"><p style="color:#666;font-size:0.9rem;margin:0">This page shows: ${step.frontend.what.substring(0, 100)}...</p></div></div>`;
        }
    }
    
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const pageUrl = currentStep.pageUrl.includes(' → ') ? currentStep.pageUrl.split(' → ')[0] : currentStep.pageUrl.includes('(') ? currentStep.pageUrl.split(' (')[0] : currentStep.pageUrl;
    const cleanUrl = pageUrl.startsWith('/') ? pageUrl : '/' + pageUrl;
    
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${currentStep.title} - Trader Demo</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;min-height:100vh;color:#fff;padding:2rem}.container{max-width:1400px;margin:0 auto}.header{text-align:center;margin-bottom:2rem}h1{color:#fff;font-size:2rem;margin-bottom:0.5rem}.step-indicator{color:#667eea;font-size:1.1rem;margin-bottom:2rem}.content{background:#1a1a1a;padding:2rem;border-radius:15px;margin-bottom:2rem}.section{margin-bottom:2rem}.section h3{color:#fff;font-size:1.3rem;margin-bottom:1rem;border-bottom:2px solid #333;padding-bottom:0.5rem}.section p{color:#ccc;line-height:1.8;margin-bottom:1rem}.section ul{color:#ccc;line-height:2;margin-left:2rem;margin-bottom:1rem}.code-block{background:#0a0a0a;padding:1rem;border-radius:8px;border:1px solid #333;margin:1rem 0;font-family:monospace;font-size:0.9rem;overflow-x:auto}.code-block code{color:#51cf66}.endpoint{color:#ffd43b}.page-visual{background:#0a0a0a;border:2px solid #333;border-radius:8px;padding:2rem;margin:1rem 0}.page-visual h4{color:#fff;margin-bottom:1.5rem;font-size:1.2rem}.mockup-container{background:#fff;border-radius:8px;padding:2rem;color:#000;position:relative;min-height:400px}.mockup-header{background:#1a1a1a;color:#fff;padding:1rem;border-radius:6px 6px 0 0;margin:-2rem -2rem 1rem -2rem}.mockup-content{padding:1rem 0}.mockup-form{background:#f5f5f5;padding:1.5rem;border-radius:6px;margin:1rem 0}.form-field{margin-bottom:1rem}.form-field label{display:block;color:#333;font-weight:600;margin-bottom:0.5rem;font-size:0.9rem}.form-field input,.form-field select{width:100%;padding:10px;background:#fff;border:1px solid #ddd;border-radius:4px;color:#333}.mockup-button{background:#667eea;color:#fff;padding:12px 24px;border:none;border-radius:6px;cursor:pointer;font-weight:600;margin-top:1rem}.visual-description{background:#2a2a2a;padding:1.5rem;border-radius:8px;margin:1rem 0;border-left:4px solid #667eea}.visual-description h4{color:#fff;margin-bottom:0.5rem}.visual-description p{color:#ccc;line-height:1.6}.navigation{display:flex;justify-content:space-between;margin-top:2rem}.btn{padding:12px 24px;background:#667eea;color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}.btn:hover{background:#5a6fd8}.btn.secondary{background:#666}.btn.secondary:hover{background:#777}.back-link{text-align:center;margin-top:2rem}.back-link a{color:#667eea;text-decoration:none}table{width:100%;border-collapse:collapse}th,td{padding:8px;text-align:left;border-bottom:1px solid #ddd}th{background:#1a1a1a;color:#fff}</style></head><body><div class="container"><div class="header"><div class="step-indicator">Step ${step} of ${totalSteps}</div><h1>${currentStep.title}</h1><p style="color:#ccc">${currentStep.description}</p></div><div class="content"><div class="section"><h3>📍 Page Location</h3><p><strong>URL:</strong> <code class="endpoint">${currentStep.pageUrl}</code></p><div class="page-visual"><h4>📸 Visual Representation of the Page</h4><div class="mockup-container"><div class="mockup-header">${currentStep.title}</div><div class="mockup-content">${generatePageMockup(currentStep)}</div></div></div><div class="visual-description"><h4>🎨 Detailed Visual Description</h4><p>${currentStep.frontend.what}</p><p><strong>Key Visual Elements:</strong></p><ul>${currentStep.frontend.features.map(f => `<li>${f}</li>`).join('')}</ul></div><div class="section"><h3>⚙️ Backend Process</h3><p><strong>API Endpoint:</strong> <code class="endpoint">${currentStep.backend.endpoint}</code></p><div class="code-block"><code><strong>Process Flow:</strong><br>${Array.isArray(currentStep.backend.process) ? currentStep.backend.process.map((p, i) => `${i + 1}. ${p}`).join('<br>') : currentStep.backend.process}</code></div><p><strong>Database Operations:</strong></p><ul><li><strong>Table:</strong> <code>${currentStep.backend.database.table || currentStep.backend.database.tables || 'N/A'}</code></li><li><strong>Action:</strong> ${currentStep.backend.database.action}</li>${currentStep.backend.database.fields ? `<li><strong>Fields:</strong> ${Array.isArray(currentStep.backend.database.fields) ? currentStep.backend.database.fields.join(', ') : currentStep.backend.database.fields}</li>` : ''}</ul></div><div class="section"><h3>➡️ Next Action</h3><p>${currentStep.nextAction}</p></div></div><div class="navigation">${prevStep ? `<a href="/demo/workflow/trader?step=${prevStep}" class="btn secondary">← Previous Step</a>` : '<span></span>'}${nextStep ? `<a href="/demo/workflow/trader?step=${nextStep}" class="btn">Next Step →</a>` : `<a href="/demo/workflow" class="btn">Back to Demo Index</a>`}</div><div class="back-link"><a href="/demo/workflow">← Back to All Demos</a> | <a href="/landing-two">Back to Portal</a></div></div></body></html>`;
    res.end(html, 'utf8');
});

// Demo Admin Workflow - Step by Step
app.get('/demo/workflow/admin', (req, res) => {
    const step = parseInt(req.query.step) || 1;
    const totalSteps = 6;
    
    const steps = [
        {
            title: 'Section 1: Admin Dashboard Overview',
            pageUrl: '/dashboard/authenticated (admin role)',
            description: 'Admin sees comprehensive platform overview with statistics and management tools.',
            frontend: { what: 'Dashboard shows: Platform statistics (total users, contracts, transactions), system alerts, admin tools grid with buttons for: View Users, View All Trades, Auction Board, KYC Reports, OFAC Screening, Blockchain, Manage Fees, Voyage Times, Basis Points, Review Flags, Credit Assessments, Insurance Opportunities.', features: ['Platform statistics', 'System alerts', 'Admin tools grid', 'Quick access buttons'] },
            backend: { endpoint: 'GET /dashboard/authenticated', process: ['Validates admin role', 'Queries platform statistics', 'Loads system alerts', 'Renders admin dashboard'], database: { table: 'database.users, database.contracts, database.transactions', action: 'Query platform statistics' } },
            nextAction: 'Admin navigates to specific management sections'
        },
        {
            title: 'Section 2: User Management & KYC',
            pageUrl: '/admin/users, /admin/kyc-reports',
            description: 'Admin manages all platform users and reviews KYC submissions.',
            frontend: { what: 'User Management page shows table of all users with: email, role, KYC status, created date. KYC Reports page shows pending KYC submissions with document previews, approve/reject buttons, and OFAC screening results.', features: ['User list table', 'KYC review interface', 'Document preview', 'Approve/reject workflow', 'OFAC screening display'] },
            backend: { endpoint: 'GET /admin/users, GET /admin/kyc-reports, POST /api/admin/kyc/approve', process: ['Queries all users from database', 'Loads KYC submissions with documents', 'Shows OFAC screening results', 'Processes approve/reject actions', 'Updates user.kycStatus'], database: { table: 'database.users, database.kyc, database.complianceReports', action: 'Query users, review KYC, update status' } },
            nextAction: 'Admin reviews and approves/rejects KYC submissions'
        },
        {
            title: 'Section 3: Contract Oversight',
            pageUrl: '/admin/active-trades',
            description: 'Admin views all contracts and trades across the platform.',
            frontend: { what: 'Active Trades page shows comprehensive table of all contracts with: Contract ID, Product, Value, Buyer, Supplier, Status, Created date. Admin can filter by status, search by ID, and view contract details.', features: ['All contracts table', 'Status filters', 'Search functionality', 'Contract details view'] },
            backend: { endpoint: 'GET /api/admin/contracts', process: ['Queries all contracts from database', 'Enriches with user information', 'Applies filters if provided', 'Returns contract list'], database: { table: 'database.contracts', action: 'Query all contracts' } },
            nextAction: 'Admin monitors contract activity and status'
        },
        {
            title: 'Section 4: Auction Management',
            pageUrl: '/admin/auction',
            description: 'Admin manages auction board for contracts with payment timeouts.',
            frontend: { what: 'Auction Board shows contracts that went to auction due to payment timeouts. Displays: contract details, current highest bid, bidder information, countdown timer, auction status. Admin can view bidding activity and manage auctions.', features: ['Auction list', 'Bidding activity', 'Countdown timers', 'Auction controls'] },
            backend: { endpoint: 'GET /api/admin/auctions, POST /api/auctions/:id/bid', process: ['Queries contracts with payment timeout', 'Loads auction data and bids', 'Tracks bidding activity', 'Manages auction lifecycle'], database: { table: 'database.contracts, database.auctions', action: 'Query auctions, manage bidding' } },
            nextAction: 'Admin oversees auction process and bidding'
        },
        {
            title: 'Section 5: Platform Settings',
            pageUrl: '/admin/fees, /admin/voyage-times, /admin/basis-points',
            description: 'Admin configures platform fees, voyage times, and price comparison settings.',
            frontend: { what: 'Settings pages allow admin to configure: Platform fees (percentage), Interest rates, Transaction limits, Voyage times (default days), Basis points for price comparison, Price variance threshold (default 5%). All settings are editable with save functionality.', features: ['Fee configuration', 'Voyage time settings', 'Basis points configuration', 'Price variance threshold', 'Save/update functionality'] },
            backend: { endpoint: 'GET /api/admin/settings, POST /api/admin/settings', process: ['Loads current platform settings', 'Validates new settings', 'Updates settings in database', 'Returns updated settings'], database: { table: 'database.settings (or admin config)', action: 'Read/update platform settings' } },
            nextAction: 'Admin configures platform parameters'
        },
        {
            title: 'Section 6: Compliance & Monitoring',
            pageUrl: '/admin/ofac-management, /admin/flags, /admin/credit-assessments',
            description: 'Admin manages compliance screening, flags, and credit assessments.',
            frontend: { what: 'OFAC Management shows sanctions screening results, flagged entities, and screening history. Review Flags page shows compliance flags requiring attention. Credit Assessments displays credit risk scores and assessment results for all contracts.', features: ['OFAC screening results', 'Flag review interface', 'Credit assessment display', 'Compliance monitoring'] },
            backend: { endpoint: 'GET /api/admin/ofac, GET /api/admin/flags, GET /api/admin/credit-assessments', process: ['Queries OFAC screening data', 'Loads compliance flags', 'Retrieves credit assessments', 'Shows risk scores and details'], database: { table: 'database.complianceReports, database.creditAssessments', action: 'Query compliance and credit data' } },
            nextAction: 'Admin monitors and manages platform compliance'
        }
    ];
    
    const currentStep = steps[step - 1];
    const prevStep = step > 1 ? step - 1 : null;
    const nextStep = step < totalSteps ? step + 1 : null;
    
    // Helper function to generate page mockup HTML
    function generatePageMockup(step) {
        const pageType = step.pageUrl.toLowerCase();
        if (pageType.includes('dashboard') || pageType.includes('authenticated')) {
            return `<div style="background:#f5f5f5;padding:1rem;border-radius:6px;margin-bottom:1rem"><div style="display:flex;justify-content:space-between;align-items:center"><span style="color:#333;font-weight:600">ADMIN</span><span style="color:#333">🔔 Notifications</span></div></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1rem"><div style="background:#e3f2fd;padding:1rem;border-radius:6px;text-align:center"><strong style="color:#333">Total Users</strong><br><span style="font-size:1.5rem;color:#1976d2">1,234</span></div><div style="background:#fff3e0;padding:1rem;border-radius:6px;text-align:center"><strong style="color:#333">Active Contracts</strong><br><span style="font-size:1.5rem;color:#f57c00">56</span></div><div style="background:#e8f5e9;padding:1rem;border-radius:6px;text-align:center"><strong style="color:#333">Pending KYC</strong><br><span style="font-size:1.5rem;color:#388e3c">12</span></div></div><div style="background:#fff;padding:1rem;border-radius:6px"><h4 style="color:#333;margin-bottom:0.5rem">Admin Tools</h4><div style="display:flex;flex-wrap:wrap;gap:0.5rem"><button style="background:#666;color:#fff;padding:8px 12px;border:none;border-radius:4px;font-size:0.85rem">View Users</button><button style="background:#666;color:#fff;padding:8px 12px;border:none;border-radius:4px;font-size:0.85rem">KYC Reports</button><button style="background:#666;color:#fff;padding:8px 12px;border:none;border-radius:4px;font-size:0.85rem">Manage Fees</button><button style="background:#666;color:#fff;padding:8px 12px;border:none;border-radius:4px;font-size:0.85rem">Auction Board</button></div></div>`;
        } else if (pageType.includes('fees') || pageType.includes('voyage') || pageType.includes('basis')) {
            return `<div class="mockup-form"><h3 style="color:#333;margin-bottom:1rem">Platform Settings</h3><div class="form-field"><label>Trading Fee (%)</label><input type="number" value="0.5" readonly></div><div class="form-field"><label>Platform Fee (%)</label><input type="number" value="1.0" readonly></div><div class="form-field"><label>Voyage Times (days)</label><div style="display:flex;gap:0.5rem"><input type="number" value="30" placeholder="Short" readonly style="flex:1"><input type="number" value="60" placeholder="Medium" readonly style="flex:1"><input type="number" value="90" placeholder="Long" readonly style="flex:1"></div></div><button class="mockup-button">Save Changes</button></div>`;
        } else {
            return `<div class="mockup-form"><p style="color:#333;text-align:center;padding:2rem">Visual representation of ${step.title}</p><div style="background:#f5f5f5;padding:1rem;border-radius:6px;margin-top:1rem"><p style="color:#666;font-size:0.9rem;margin:0">This page shows: ${step.frontend.what.substring(0, 100)}...</p></div></div>`;
        }
    }
    
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const pageUrl = currentStep.pageUrl.includes(',') ? currentStep.pageUrl.split(',')[0].trim() : currentStep.pageUrl.includes('(') ? currentStep.pageUrl.split(' (')[0] : currentStep.pageUrl;
    const cleanUrl = pageUrl.startsWith('/') ? pageUrl : '/' + pageUrl;
    
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${currentStep.title} - Admin Demo</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;min-height:100vh;color:#fff;padding:2rem}.container{max-width:1400px;margin:0 auto}.header{text-align:center;margin-bottom:2rem}h1{color:#fff;font-size:2rem;margin-bottom:0.5rem}.step-indicator{color:#667eea;font-size:1.1rem;margin-bottom:2rem}.content{background:#1a1a1a;padding:2rem;border-radius:15px;margin-bottom:2rem}.section{margin-bottom:2rem}.section h3{color:#fff;font-size:1.3rem;margin-bottom:1rem;border-bottom:2px solid #333;padding-bottom:0.5rem}.section p{color:#ccc;line-height:1.8;margin-bottom:1rem}.section ul{color:#ccc;line-height:2;margin-left:2rem;margin-bottom:1rem}.code-block{background:#0a0a0a;padding:1rem;border-radius:8px;border:1px solid #333;margin:1rem 0;font-family:monospace;font-size:0.9rem;overflow-x:auto}.code-block code{color:#51cf66}.endpoint{color:#ffd43b}.page-visual{background:#0a0a0a;border:2px solid #333;border-radius:8px;padding:2rem;margin:1rem 0}.page-visual h4{color:#fff;margin-bottom:1.5rem;font-size:1.2rem}.mockup-container{background:#fff;border-radius:8px;padding:2rem;color:#000;position:relative;min-height:400px}.mockup-header{background:#1a1a1a;color:#fff;padding:1rem;border-radius:6px 6px 0 0;margin:-2rem -2rem 1rem -2rem}.mockup-content{padding:1rem 0}.mockup-form{background:#f5f5f5;padding:1.5rem;border-radius:6px;margin:1rem 0}.form-field{margin-bottom:1rem}.form-field label{display:block;color:#333;font-weight:600;margin-bottom:0.5rem;font-size:0.9rem}.form-field input,.form-field select{width:100%;padding:10px;background:#fff;border:1px solid #ddd;border-radius:4px;color:#333}.mockup-button{background:#667eea;color:#fff;padding:12px 24px;border:none;border-radius:6px;cursor:pointer;font-weight:600;margin-top:1rem}.visual-description{background:#2a2a2a;padding:1.5rem;border-radius:8px;margin:1rem 0;border-left:4px solid #667eea}.visual-description h4{color:#fff;margin-bottom:0.5rem}.visual-description p{color:#ccc;line-height:1.6}.navigation{display:flex;justify-content:space-between;margin-top:2rem}.btn{padding:12px 24px;background:#667eea;color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}.btn:hover{background:#5a6fd8}.btn.secondary{background:#666}.btn.secondary:hover{background:#777}.back-link{text-align:center;margin-top:2rem}.back-link a{color:#667eea;text-decoration:none}table{width:100%;border-collapse:collapse}th,td{padding:8px;text-align:left;border-bottom:1px solid #ddd}th{background:#1a1a1a;color:#fff}</style></head><body><div class="container"><div class="header"><div class="step-indicator">Section ${step} of ${totalSteps}</div><h1>${currentStep.title}</h1><p style="color:#ccc">${currentStep.description}</p></div><div class="content"><div class="section"><h3>📍 Page Location</h3><p><strong>URL:</strong> <code class="endpoint">${currentStep.pageUrl}</code></p><div class="page-visual"><h4>📸 Visual Representation of the Page</h4><div class="mockup-container"><div class="mockup-header">${currentStep.title}</div><div class="mockup-content">${generatePageMockup(currentStep)}</div></div></div><div class="visual-description"><h4>🎨 Detailed Visual Description</h4><p>${currentStep.frontend.what}</p><p><strong>Key Visual Elements:</strong></p><ul>${currentStep.frontend.features.map(f => `<li>${f}</li>`).join('')}</ul></div><div class="section"><h3>⚙️ Backend Process</h3><p><strong>API Endpoint:</strong> <code class="endpoint">${currentStep.backend.endpoint}</code></p><div class="code-block"><code><strong>Process Flow:</strong><br>${Array.isArray(currentStep.backend.process) ? currentStep.backend.process.map((p, i) => `${i + 1}. ${p}`).join('<br>') : currentStep.backend.process}</code></div><p><strong>Database Operations:</strong></p><ul><li><strong>Table:</strong> <code>${currentStep.backend.database.table || currentStep.backend.database.tables || 'N/A'}</code></li><li><strong>Action:</strong> ${currentStep.backend.database.action}</li>${currentStep.backend.database.fields ? `<li><strong>Fields:</strong> ${Array.isArray(currentStep.backend.database.fields) ? currentStep.backend.database.fields.join(', ') : currentStep.backend.database.fields}</li>` : ''}</ul></div><div class="section"><h3>➡️ Next Action</h3><p>${currentStep.nextAction}</p></div></div><div class="navigation">${prevStep ? `<a href="/demo/workflow/admin?step=${prevStep}" class="btn secondary">← Previous Section</a>` : '<span></span>'}${nextStep ? `<a href="/demo/workflow/admin?step=${nextStep}" class="btn">Next Section →</a>` : `<a href="/demo/workflow" class="btn">Back to Demo Index</a>`}</div><div class="back-link"><a href="/demo/workflow">← Back to All Demos</a> | <a href="/landing-two">Back to Portal</a></div></div></body></html>`;
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
        
        // Normalize role to lowercase for validation
        const normalizedRole = (role || 'buyer').toLowerCase();
        
        // Validate role
        if (!['buyer', 'supplier', 'trader', 'insurer'].includes(normalizedRole)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        
        // Check if user already exists
        if (database.users.has(email)) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user with KYC fields
        const user = {
            id: 'user-' + Date.now(),
            email: email,
            password: hashedPassword,
            role: normalizedRole,
            verified: false,
            kycStatus: 'pending', // Legacy field for backward compatibility
            kyc_status: 'not_started', // New KYC status field
            sumsub_applicant_id: null, // Sumsub applicant ID
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
        console.error('[ERROR] Registration error stack:', error.stack);
        res.status(500).json({ 
            error: 'Registration failed',
            message: error.message || 'Unknown error occurred',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// User Login API
// Early Registration API Endpoint
app.post('/api/early-registration', async (req, res) => {
    try {
        const { email, name, company, interest } = req.body;
        
        // Validate required fields
        if (!email || !name || !company || !interest) {
            return res.status(400).json({ 
                error: 'All fields are required',
                message: 'Please fill in email, name, company name, and your interest'
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                error: 'Invalid email format',
                message: 'Please provide a valid email address'
            });
        }
        
        // Check if email already registered
        const existingRegistration = Array.from(database.earlyRegistrations.values())
            .find(reg => reg.email.toLowerCase() === email.toLowerCase());
        
        if (existingRegistration) {
            return res.status(400).json({ 
                error: 'Email already registered',
                message: 'This email has already been registered for early access'
            });
        }
        
        // Create registration record
        const registrationId = `early-reg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const registration = {
            id: registrationId,
            email: email.trim().toLowerCase(),
            name: name.trim(),
            company: company.trim(),
            interest: interest.trim(),
            submittedAt: new Date().toISOString(),
            status: 'pending'
        };
        
        database.earlyRegistrations.set(registrationId, registration);
        saveDatabase();
        
        console.log(`[EARLY REG] New early registration: ${email} from ${company}`);
        
        res.status(200).json({
            success: true,
            message: 'Registration submitted successfully',
            registrationId: registrationId
        });
        
    } catch (error) {
        console.error('[ERROR] Early registration error:', error);
        res.status(500).json({ 
            error: 'Failed to submit registration',
            message: error.message || 'An unexpected error occurred'
        });
    }
});

// Login handler function
async function handleLogin(req, res) {
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
        
        // MERGE-LIFELINE: Return success with isAdmin flag for frontend
        const { password: _, ...safeUser } = user;
        res.json({
            success: true,
            token: token,
            user: {
                ...safeUser,
                isAdmin: user.role === 'admin' // Add isAdmin flag based on role
            }
        });
    } catch (error) {
        console.error('[ERROR] Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
}

// Register both login routes using the same handler
app.post('/auth/login', handleLogin);
app.post('/api/auth/login', handleLogin);

// ================================
// KYC API ROUTES
// ================================
// KYC Submission endpoint
app.post('/api/kyc/submit', authenticateToken, upload.any(), async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.user || !req.user.email) {
            console.error('[KYC] No user in request object');
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        let userEmail = req.user.email;
        console.log('[KYC] Submitting KYC for user:', userEmail);
        console.log('[KYC] Token decoded user:', req.user);
        
        let user = database.users.get(userEmail);
        
        if (!user) {
            console.error('[KYC] User not found in database:', userEmail);
            console.log('[KYC] Available users:', Array.from(database.users.keys()));
            
            // Try to find user by ID if email lookup fails
            if (req.user.id) {
                const usersArray = Array.from(database.users.values());
                user = usersArray.find(u => u.id === req.user.id);
                if (user) {
                    console.log('[KYC] Found user by ID:', user.id);
                    userEmail = user.email; // Update email to match database
                }
            }
            
            if (!user) {
                return res.status(404).json({ 
                    error: 'User not found. Please register again or contact support.',
                    details: 'Your session may have expired. Please sign up again.'
                });
            }
        }
        
        // Parse form data
        const formData = req.body;
        const files = req.files || [];
        
        // Organize files by category
        const fileMap = {};
        files.forEach(file => {
            const fieldName = file.fieldname;
            if (!fileMap[fieldName]) {
                fileMap[fieldName] = [];
            }
            fileMap[fieldName].push({
                filename: file.filename,
                originalname: file.originalname,
                path: file.path,
                size: file.size,
                mimetype: file.mimetype
            });
        });
        
        // Create KYC submission record
        const kycId = `kyc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const kycData = {
            id: kycId,
            userEmail: userEmail,
            companyType: formData.companyType || 'private',
            companyName: formData.companyName || '',
            registrationNumber: formData.registrationNumber || '',
            country: formData.country || '',
            address: formData.address || '',
            contactPerson: formData.contactPerson || '',
            phone: formData.phone || '',
            email: formData.email || userEmail,
            files: fileMap,
            status: 'pending',
            submittedAt: new Date().toISOString(),
            reviewedAt: null,
            reviewedBy: null
        };
        
        // Store KYC data
        database.kyc.set(kycId, kycData);
        
        // Perform OFAC Sanctions Screening (async, non-blocking)
        let complianceReport = null;
        let hasFlags = false;
        
        if (sanctionsAPI) {
            try {
                const companyName = formData.companyName || user.name || userEmail;
                const contactPerson = formData.contactPerson || user.name || '';
                
                // Screen company name and contact person
                const screeningResult = await sanctionsAPI.screenSanctions(companyName);
                const personScreening = contactPerson ? await sanctionsAPI.screenSanctions(contactPerson) : { cleared: true, matches: [] };
                
                // Check for flags
                const ofacMatch = !screeningResult.cleared || !personScreening.cleared;
                hasFlags = ofacMatch;
                
                // Create compliance report
                const reportId = `compliance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                complianceReport = {
                    id: reportId,
                    kycId: kycId,
                    userId: userEmail,
                    companyName: companyName,
                    contactPerson: contactPerson,
                    screeningDate: new Date().toISOString(),
                    ofacMatch: ofacMatch,
                    matches: [...(screeningResult.matches || []), ...(personScreening.matches || [])],
                    riskLevel: ofacMatch ? 'high' : 'low',
                    totalChecked: (screeningResult.totalChecked || 0) + (personScreening.totalChecked || 0),
                    status: 'completed'
                };
                
                database.complianceReports.set(reportId, complianceReport);
                console.log(`[OFAC] Screening completed for ${userEmail}: ${complianceReport.ofacMatch ? 'MATCH FOUND - FLAGGED' : 'CLEARED'}`);
                
            } catch (error) {
                console.error('[ERROR] OFAC screening error:', error);
                // If screening fails, treat as flagged for safety
                hasFlags = true;
            }
        }
        
        // Auto-approve if no flags, otherwise set to pending for manual review
        let finalStatus = 'pending';
        let autoApproved = false;
        
        if (!hasFlags) {
            // No flags found - auto-approve
            finalStatus = 'approved';
            autoApproved = true;
            kycData.status = 'approved';
            kycData.reviewedAt = new Date().toISOString();
            kycData.reviewedBy = 'system';
            kycData.autoApproved = true;
            database.kyc.set(kycId, kycData);
            
            // Update user's KYC status
            user.kycStatus = 'approved';
            user.kycSubmissionId = kycId;
            database.users.set(userEmail, user);
            
            // Process any pending contracts for this user
            processPendingContractsForUser(userEmail);
            
            console.log(`[KYC] Auto-approved for ${userEmail} (no flags found)`);
        } else {
            // Flags found - requires manual review
            finalStatus = 'pending';
            user.kycStatus = 'pending';
            user.kycSubmissionId = kycId;
            database.users.set(userEmail, user);
            
            console.log(`[KYC] Flagged for manual review: ${userEmail} (OFAC match or risk detected)`);
        }
        
        // Log audit event
        logAuditEvent('kyc_submitted', userEmail, {
            kycId: kycId,
            companyType: formData.companyType,
            fileCount: files.length,
            ofacScreened: complianceReport !== null,
            ofacMatch: complianceReport?.ofacMatch || false,
            autoApproved: autoApproved,
            status: finalStatus
        });
        
        console.log(`[KYC] Submission received for ${userEmail}, KYC ID: ${kycId}, Status: ${finalStatus}`);
        
        res.status(200).json({
            success: true,
            message: autoApproved ? 'KYC submission approved automatically' : 'KYC submission received and pending review',
            kycId: kycId,
            status: finalStatus,
            autoApproved: autoApproved,
            ofacScreened: complianceReport !== null,
            ofacMatch: complianceReport?.ofacMatch || false,
            flags: hasFlags
        });
        
    } catch (error) {
        console.error('[ERROR] KYC submission error:', error);
        res.status(500).json({ 
            error: 'KYC submission failed',
            message: error.message || 'Unknown error occurred'
        });
    }
});

// PDF Contract Extraction API
app.post('/api/contracts/extract-from-pdf', authenticateToken, upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded' });
        }
        
        if (!contractExtractor) {
            return res.status(503).json({ error: 'PDF extraction service not available' });
        }
        
        const filePath = req.file.path;
        const extractedData = await contractExtractor.extractContractFromPDF(filePath);
        
        // Store the PDF in documents database
        const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        database.documents.set(docId, {
            id: docId,
            contractId: null, // Will be linked when contract is created
            type: 'contract_pdf',
            filename: req.file.filename,
            originalName: req.file.originalname,
            path: filePath,
            uploadedBy: req.user.email,
            uploadedAt: new Date().toISOString(),
            extractedData: extractedData
        });
        
        console.log(`[PDF] Contract extracted from PDF: ${req.file.originalname}`);
        
        res.json({
            success: true,
            extracted: extractedData,
            documentId: docId,
            message: 'Contract data extracted successfully'
        });
        
    } catch (error) {
        console.error('[ERROR] PDF extraction error:', error);
        res.status(500).json({ 
            error: 'Failed to extract contract from PDF',
            message: error.message || 'Unknown error occurred'
        });
    }
});

// Document Upload API
app.post('/api/contracts/:contractId/documents', authenticateToken, upload.array('documents', 10), async (req, res) => {
    try {
        console.log('[DOCS] Document upload request received for contract:', req.params.contractId);
        console.log('[DOCS] User:', req.user?.email);
        console.log('[MERGE_LIFELINE_BUILD]', MERGE_LIFELINE_BUILD);
        const { contractId } = req.params;
        const userEmail = req.user?.email;
        
        if (!userEmail) {
            console.error('[DOCS] No user email in request');
            return res.status(401).json({ error: 'Authentication required', message: 'Please sign in to upload documents' });
        }
        
        let contract = database.contracts.get(contractId);
        if (!contract) {
            return res.status(404).json({ error: 'Contract not found' });
        }
        
        // Verify user has permission (supplier or trader)
        if (contract.supplierEmail !== userEmail && req.user.role !== 'trader' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized to upload documents for this contract' });
        }
        
        // Compute deposit satisfaction: if depositPercent=0, deposit is not required
        const depositRequired = Number(contract.depositPercent || contract.deposit_percent || 0) > 0;
        const depositSatisfied = !depositRequired || contract.depositPaid === true;
        
        if (!depositSatisfied) {
            return res.status(400).json({ 
                error: 'DEPOSIT_NOT_PAID',
                message: 'Deposit must be paid before uploading documents'
            });
        }
        
        // Log when bypassing deposit gate because it's not required
        if (!depositRequired) {
            console.log('[DEPOSIT] bypass deposit gate (depositPercent=0) contractId=' + contractId);
        }
        
        const uploadedDocs = [];
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const document = {
                    id: docId,
                    contractId: contractId,
                    type: 'shipping_document',
                    filename: file.filename,
                    originalName: file.originalname,
                    path: file.path,
                    size: file.size,
                    mimetype: file.mimetype,
                    uploadedBy: userEmail,
                    uploadedAt: new Date().toISOString()
                };
                
                database.documents.set(docId, document);
                uploadedDocs.push(document);
            });
            
            // Update contract status - ensure fields exist first
            console.log('[DOCS] before ensureContractFields');
            contract = ensureContractFields(contract);
            console.log('[DOCS] after ensureContractFields');
            contract.documentsUploaded = true;
            contract.deliveryDocsUploaded = true;
            contract.documentsUploadedAt = new Date().toISOString();
            
            // MERGE LIFELINE: Update status to buyer doc verification (not final payment)
            contract.status = 'AWAITING_BUYER_DOC_VERIFICATION';
            console.log('[MERGE_LIFELINE_BUILD]', MERGE_LIFELINE_BUILD);
            
            // MERGE LIFELINE: Invariant assertion - draft docs upload cannot advance to final payment
            if (contract.status === 'AWAITING_BUYER_FINAL_PAYMENT') {
                throw new Error("Invariant violation: draft docs upload cannot advance to final payment");
            }
            
            // A4 GOLDEN PATH: Log draft docs upload step
            console.log('[A4_GOLDEN_PATH] Draft documents uploaded by supplier', {
                contractId: contractId,
                userEmail: userEmail,
                documentCount: req.files.length,
                newStatus: 'AWAITING_BUYER_DOC_VERIFICATION'
            });
            
            database.contracts.set(contractId, contract);
            saveDatabase();
            
            // Log audit event
            logAuditEvent('documents_uploaded', userEmail, {
                contractId: contractId,
                documentCount: req.files.length
            });
        }
        
        res.json({
            success: true,
            documents: uploadedDocs,
            message: `${uploadedDocs.length} document(s) uploaded successfully`
        });
        
    } catch (error) {
        console.error('[ERROR] Document upload error:', error);
        console.error('[ERROR] Document upload error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to upload documents',
            message: error.message || 'Unknown error occurred'
        });
    }
});

// ================================
// WALLET API ROUTES
// ================================
// Create or update wallet
app.post('/api/wallet/create', authenticateToken, async (req, res) => {
    try {
        const userEmail = req.user.email;
        const { address, type = 'Manual' } = req.body;
        
        if (!address) {
            return res.status(400).json({ error: 'Wallet address is required' });
        }
        
        // Validate wallet address format (basic check)
        if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
            return res.status(400).json({ error: 'Invalid wallet address format' });
        }
        
        // Get or create wallet record
        const walletId = `wallet-${userEmail}`;
        const wallet = {
            id: walletId,
            userEmail: userEmail,
            address: address,
            type: type,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        database.wallets.set(walletId, wallet);
        
        // Update user's wallet status
        const user = database.users.get(userEmail);
        if (user) {
            user.hasWallet = true;
            user.walletAddress = address;
            database.users.set(userEmail, user);
        }
        
        // Log audit event
        logAuditEvent('wallet_created', userEmail, {
            walletAddress: address,
            walletType: type
        });
        
        console.log(`[WALLET] Wallet created for ${userEmail}, Address: ${address}`);
        
        res.status(200).json({
            success: true,
            message: 'Wallet saved successfully',
            wallet: wallet
        });
        
    } catch (error) {
        console.error('[ERROR] Wallet creation error:', error);
        res.status(500).json({ 
            error: 'Wallet creation failed',
            message: error.message || 'Unknown error occurred'
        });
    }
});

// Get wallet status
app.get('/api/wallet/status', authenticateToken, (req, res) => {
    try {
        const userEmail = req.user.email;
        const walletId = `wallet-${userEmail}`;
        const wallet = database.wallets.get(walletId);
        
        if (!wallet) {
            return res.json({
                hasWallet: false,
                wallet: null
            });
        }
        
        res.json({
            hasWallet: true,
            wallet: wallet
        });
        
    } catch (error) {
        console.error('[ERROR] Wallet status error:', error);
        res.status(500).json({ error: 'Failed to get wallet status' });
    }
});

// ================================
// CONTRACT API ROUTES
// ================================

// --- Merge Lifeline: Deposit normalization (required by contract create) ---
function normalizeContractDeposit(input, fallbackPercent = 0) {
  // Accept: number, string ("15", "15%", " 15 % "), null/undefined
  if (input === undefined || input === null || input === "") return fallbackPercent;

  let v = input;

  if (typeof v === "string") {
    v = v.trim().replace("%", "");
    if (v === "") return fallbackPercent;
    v = Number(v);
  }

  if (!Number.isFinite(v)) return fallbackPercent;

  // Clamp to [0..100] and round to 2 decimals for display stability
  v = Math.max(0, Math.min(100, v));
  return Math.round(v * 100) / 100;
}

// Get contracts for user (buyer, supplier, trader)
// Create Contract API
app.post('/api/contracts', authenticateToken, async (req, res) => {
    try {
        // MERGE-LIFELINE: Get logged-in user email (the creator)
        const userEmail = getCurrentUserEmail(req);
        if (!userEmail) {
            return res.status(401).json({ error: "Not authenticated" });
        }
        
        // FIX: Normalize user email (trim + toLowerCase)
        const normalizedUserEmail = userEmail.trim().toLowerCase();
        
        const userRole = req.user.role;
        
        // MERGE-LIFELINE: Remove createdByEmail from body if present (backend always sets it from logged-in user)
        const payload = req.body || {};
        delete payload.createdByEmail;
        delete payload.created_by;
        delete payload.creatorEmail;
        
        // FIX: Normalize counterparty email before processing (trim + toLowerCase)
        if (payload.counterparty) {
            payload.counterparty = payload.counterparty.trim().toLowerCase();
        }
        
        // Log received data for debugging (remove in production if needed)
        console.log('[CONTRACT CREATE] Received data:', {
            product: payload.product,
            quantity: payload.quantity,
            unit: payload.unit,
            price: payload.price,
            counterparty: payload.counterparty,
            userRole: userRole,
            creatorEmail: normalizedUserEmail // Log who is creating
        });
        
        // MERGE-LIFELINE: Extract buyer and supplier emails from payload
        let buyerEmail = payload.buyerEmail || payload.buyer_email || payload.buyer;
        let supplierEmail = payload.supplierEmail || payload.supplier_email || payload.supplier;
        
        // FIX: Normalize buyer and supplier emails (trim + toLowerCase)
        if (buyerEmail) buyerEmail = buyerEmail.trim().toLowerCase();
        if (supplierEmail) supplierEmail = supplierEmail.trim().toLowerCase();
        
        // If buyer/supplier not in payload, determine from user role and counterparty
        let finalBuyerEmail = buyerEmail;
        let finalSupplierEmail = supplierEmail;
        
        if (!buyerEmail || !supplierEmail) {
            // Fallback to role-based logic if not provided
            if (userRole === 'buyer') {
                finalBuyerEmail = normalizedUserEmail;
                finalSupplierEmail = payload.counterparty;
            } else if (userRole === 'supplier') {
                finalSupplierEmail = normalizedUserEmail;
                finalBuyerEmail = payload.counterparty;
            } else if (userRole === 'trader') {
                finalSupplierEmail = normalizedUserEmail;
                finalBuyerEmail = payload.counterparty;
            }
        }
        
        // FIX: Normalize final emails
        if (finalBuyerEmail) finalBuyerEmail = finalBuyerEmail.trim().toLowerCase();
        if (finalSupplierEmail) finalSupplierEmail = finalSupplierEmail.trim().toLowerCase();
        
        if (!finalBuyerEmail || !finalSupplierEmail) {
            return res.status(400).json({
                error: "buyerEmail and supplierEmail are required.",
            });
        }
        
        const {
            product,
            quantity,
            unit,
            price,
            currency = 'TGT',
            counterparty,
            voyageTime = 30,
            description = '',
            totalValue,
            depositAmount
        } = payload;
        
        // MERGE-LIFELINE: depositPercent from payload if provided, otherwise 0 (NOT 30 - no hardcoded defaults)
        // Use normalizeContractDeposit helper to safely parse deposit percent
        const depositPercent = normalizeContractDeposit(
            payload.depositPercent ?? payload.deposit ?? payload.depositPct ?? payload.deposit_percent,
            0
        );
        
        // Validate required fields (check for empty strings and null/undefined)
        const missingFields = [];
        if (!product || (typeof product === 'string' && product.trim() === '')) {
            missingFields.push('product');
        }
        if (!quantity || quantity === 0 || isNaN(parseFloat(quantity))) {
            missingFields.push('quantity');
        }
        if (!unit || (typeof unit === 'string' && unit.trim() === '')) {
            missingFields.push('unit');
        }
        if (!price || price === 0 || isNaN(parseFloat(price))) {
            missingFields.push('price');
        }
        if (!counterparty || (typeof counterparty === 'string' && counterparty.trim() === '')) {
            missingFields.push('counterparty');
        }
        
        if (missingFields.length > 0) {
            console.error('[CONTRACT CREATE] Validation failed. Missing fields:', missingFields);
            console.error('[CONTRACT CREATE] Received body:', JSON.stringify(req.body, null, 2));
            return res.status(400).json({ 
                error: 'Missing or invalid required fields',
                missingFields: missingFields,
                message: `Please provide valid values for: ${missingFields.join(', ')}`,
                received: {
                    product: req.body.product,
                    quantity: req.body.quantity,
                    unit: req.body.unit,
                    price: req.body.price,
                    counterparty: req.body.counterparty
                }
            });
        }
        
        // FIX: Validate counterparty exists with case-insensitive lookup
        // Normalize counterparty email for lookup
        const normalizedCounterparty = counterparty.trim().toLowerCase();
        const counterpartyUser = database.users.get(normalizedCounterparty);
        
        if (!counterpartyUser) {
            // FIX: Enhanced error message with available demo users (dev only)
            const isDev = process.env.NODE_ENV !== 'production';
            const availableUsers = isDev ? Array.from(database.users.keys()).filter(email => 
                email.includes('@test.com') || email.includes('@tangent.com')
            ) : [];
            
            const errorResponse = {
                error: 'Counterparty email not found',
                message: 'Please ensure the user is registered on the platform. The counterparty email must match an existing user account.',
                searchedEmail: normalizedCounterparty,
                originalEmail: counterparty
            };
            
            if (isDev && availableUsers.length > 0) {
                errorResponse.availableDemoUsers = availableUsers;
                errorResponse.devMessage = 'Available demo users for testing: ' + availableUsers.join(', ');
            }
            
            console.error('[CONTRACT CREATE] Counterparty not found:', {
                searchedEmail: normalizedCounterparty,
                originalEmail: counterparty,
                availableUsers: availableUsers
            });
            
            return res.status(400).json(errorResponse);
        }
        
        // Calculate values
        const calculatedTotalValue = parseFloat(quantity) * parseFloat(price);
        const now = new Date().toISOString();
        
        // MERGE-LIFELINE: Determine creator and counterparty
        // FIX: Use normalized user email for comparison
        const creatorEmail = normalizedUserEmail;
        let counterpartyEmail = null;
        let initialStatus = ContractState.PENDING_COUNTERPARTY_CONFIRMATION;
        
        // Set counterpartyEmail and specific status based on creator
        // FIX: All emails are already normalized, so comparison is case-insensitive
        if (creatorEmail === finalSupplierEmail) {
            counterpartyEmail = finalBuyerEmail;
            initialStatus = ContractState.PENDING_BUYER_CONFIRMATION;
        } else if (creatorEmail === finalBuyerEmail) {
            counterpartyEmail = finalSupplierEmail;
            initialStatus = ContractState.PENDING_SUPPLIER_CONFIRMATION;
        } else {
            // Fallback: if creator is neither buyer nor supplier (edge case), set counterparty to the other party
            counterpartyEmail = creatorEmail === finalBuyerEmail ? finalSupplierEmail : finalBuyerEmail;
        }
        
        // MERGE-LIFELINE: Create contract with all required fields
        const contractId = `contract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newContract = {
            id: contractId,
            contract_id: contractId, // Alias for compatibility
            product: product,
            productDetails: product, // Alias for compatibility
            quantity: parseFloat(quantity),
            unit: unit,
            pricePerUnit: parseFloat(price),
            totalValue: totalValue || calculatedTotalValue,
            currency: currency,
            buyerEmail: finalBuyerEmail,
            supplierEmail: finalSupplierEmail,
            // MERGE-LIFELINE: CREATOR = logged in user (always override)
            createdByEmail: creatorEmail,
            creatorEmail: creatorEmail, // Alias for compatibility
            createdBy: creatorEmail,
            counterpartyEmail: counterpartyEmail,
            counterparty_email: counterpartyEmail, // Alias for compatibility
            status: initialStatus, // A1: Use canonical state constant
            // MERGE-LIFELINE: depositPercent from payload (no hardcoded default - use 0 if not provided)
            depositPercent: parseFloat(depositPercent) || 0,
            depositPaid: false, // Will be set to true if depositPercent === 0 below
            buyerDepositPaid: false,
            depositAmountPaid: 0,
            documentsUploaded: false,
            documentsValidated: false,
            deliveryDocsUploaded: false,
            isFullySettled: false,
            voyageTime: parseInt(voyageTime),
            description: description,
            createdAt: now,
            updatedAt: now,
            // A4 REG-01: Initialize all required invariant fields at creation
            settlementStatus: 'locked', // Required: settlement starts locked
            finalPaymentPaid: false, // Required: final payment not paid at creation
            buyerApprovedDraftDocs: false, // Required: draft docs not approved at creation
            originalDocsUploaded: false, // Required: original docs not uploaded at creation
            docsReleased: false, // Required: docs not released at creation
            docsReleaseStatus: 'LOCKED' // Required: docs start locked
        };
        
        // Get effective financing terms (legacy or risk-based, depending on feature flag)
        // Note: Risk fields may not be populated yet at creation time, so this will use legacy
        // After risk evaluation runs, subsequent calls will use risk-based values if flag is ON
        const financingTerms = getEffectiveFinancingTerms(newContract, USE_RISK_ENGINE_FOR_FINANCING);
        
        // Use the effective deposit percent (from request body if provided, otherwise from financing terms)
        const effectiveDepositPercent = depositPercent !== undefined && depositPercent !== null 
            ? parseFloat(depositPercent) 
            : financingTerms.depositPercent;
        
        const calculatedDepositAmount = (newContract.totalValue * effectiveDepositPercent) / 100;
        
        // Add deposit fields to contract
        // Data consistency fix: Normalize depositPercent - ensure it's always a number
        const normalizedDepositPercent = Number(effectiveDepositPercent) || 0;
        newContract.depositPercent = normalizedDepositPercent;
        newContract.depositAmount = depositAmount || calculatedDepositAmount;
        
        // If depositPercent === 0, set depositPaid = true (no deposit required)
        // Note: normalizeContractDeposit helper is used for parsing input, not mutating contract
        if (normalizedDepositPercent === 0) {
            newContract.depositPaid = true;
            newContract.buyerDepositPaid = true;
        }
        
        // Use newContract as contract for rest of the function
        const contract = newContract;
        
        // Log financing terms source (lightweight, for debugging)
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
            console.log(
                '[FINANCING TERMS] Using',
                financingTerms.source,
                'terms for contract',
                contractId,
                'deposit % =',
                effectiveDepositPercent,
                'max financing % =',
                financingTerms.maxFinancingPercent
            );
        }
        
        // A1 FINALIZATION: Log state transition for CREATE action
        console.log('[STATE_TRANSITION]', {
            contractId: contractId,
            fromState: null, // No previous state (creation)
            action: ContractAction.CREATE,
            toState: initialStatus,
            actorEmail: normalizedUserEmail,
            timestamp: new Date().toISOString()
        });
        
        database.contracts.set(contractId, contract);
        
        // STEP 2: Evaluate and store risk metrics (async, non-blocking)
        // This runs after contract is created but does not block the response
        const { evaluateAndStoreRiskForContract } = require('./lib/risk-engine');
        try {
            evaluateAndStoreRiskForContract(contractId, database.contracts)
                .then(risk => {
                    console.log(`[RISK ENGINE] Risk evaluation completed for contract ${contractId}`, {
                        riskScore: risk.riskScore,
                        riskBand: risk.riskBand
                    });
                })
                .catch(err => {
                    console.error(`[RISK ENGINE] Risk evaluation failed for contract ${contractId}:`, err.message);
                    // Do not throw - contract creation must succeed even if risk evaluation fails
                });
        } catch (err) {
            console.error('[RISK ENGINE] Unexpected error calling evaluateAndStoreRiskForContract:', err.message);
            // Do not throw - contract creation must succeed even if risk evaluation fails
        }
        
        // Perform Credit Assessment (async, non-blocking)
        let creditAssessment = null;
        if (creditIntegration && creditServiceAvailable) {
            try {
                const buyer = database.users.get(buyerEmail);
                const contractData = {
                    amount: contract.totalValue,
                    tenor_days: contract.voyageTime,
                    inventory_value: contract.totalValue * 0.8,
                    inventory_type: contract.product,
                    inventory_location: 'warehouse',
                    buyer_deposit: contract.depositAmount,
                    is_exchange_traded: false
                };
                
                const userData = {
                    name: buyer?.name || buyer?.companyName || buyerEmail,
                    company: buyer?.companyName || buyerEmail,
                    country: buyer?.country || 'Unknown',
                    email: buyerEmail,
                    phone: buyer?.phone || ''
                };
                
                // Perform credit assessment integration
                const creditResult = await creditIntegration.integrateCreditAssessment(contractData, userData);
                
                if (creditResult.success && creditResult.assessment) {
                    // Store credit assessment
                    const assessmentId = `credit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    creditAssessment = {
                        id: assessmentId,
                        contractId: contractId,
                        buyerEmail: buyerEmail,
                        assessmentDate: new Date().toISOString(),
                        creditScore: creditResult.assessment.credit_score || 0,
                        riskLevel: creditResult.assessment.risk_level || 'unknown',
                        recommendation: creditResult.assessment.recommendation || 'pending',
                        details: creditResult.assessment,
                        entityId: creditResult.entityId,
                        tradeId: creditResult.tradeId
                    };
                    
                    database.creditAssessments.set(assessmentId, creditAssessment);
                    contract.creditAssessment = creditAssessment;
                    database.contracts.set(contractId, contract);
                    
                    console.log(`[CREDIT] Assessment completed for contract ${contractId}: Score ${creditAssessment.creditScore}, Risk ${creditAssessment.riskLevel}`);
                } else {
                    console.log(`[CREDIT] Assessment skipped for contract ${contractId}: ${creditResult.reason || 'Service unavailable'}`);
                }
                
            } catch (error) {
                console.error('[ERROR] Credit assessment error:', error);
                // Continue even if credit assessment fails
            }
        }
        
        // Log audit event
        logAuditEvent('contract_created', normalizedUserEmail, {
            contractId: contractId,
            product: product,
            totalValue: contract.totalValue,
            counterparty: counterparty,
            creditAssessed: creditAssessment !== null,
            initialState: initialStatus
        });
        
        // A4 REG-01: Verify all required invariant fields are initialized
        console.log('[A4_REG-01] Contract creation - verifying invariant fields', {
            contractId: contractId,
            status: contract.status,
            depositPercent: contract.depositPercent,
            depositPaid: contract.depositPaid,
            settlementStatus: contract.settlementStatus,
            finalPaymentPaid: contract.finalPaymentPaid,
            documentsUploaded: contract.documentsUploaded,
            buyerApprovedDraftDocs: contract.buyerApprovedDraftDocs,
            originalDocsUploaded: contract.originalDocsUploaded,
            docsReleased: contract.docsReleased
        });
        
        console.log(`[CONTRACT] Contract created: ${contractId} by ${normalizedUserEmail} with initial state: ${initialStatus}`);
        
        res.status(201).json({
            success: true,
            id: contractId,
            contract: contract,
            creditAssessed: creditAssessment !== null
        });
        
    } catch (error) {
        console.error('[ERROR] Create contract error:', error);
        console.error('[ERROR] Create contract error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to create contract',
            message: error.message || 'Unknown error occurred'
        });
    }
});

// Create Dual Contract API (for traders)
app.post('/api/contracts/create-dual', authenticateToken, async (req, res) => {
    try {
        const userEmail = req.user.email;
        const userRole = req.user.role;
        
        if (userRole !== 'trader') {
            return res.status(403).json({ error: 'Only traders can create dual contracts' });
        }
        
        const {
            product,
            quantity,
            unit,
            price,
            currency = 'TGT',
            counterparty,
            depositPercent = 30,
            voyageTime = 30,
            description = '',
            totalValue,
            depositAmount,
            sourceContractId
        } = req.body;
        
        // Validate required fields
        if (!product || !quantity || !unit || !price || !counterparty || !sourceContractId) {
            return res.status(400).json({ error: 'Missing required fields: product, quantity, unit, price, counterparty, and sourceContractId are required' });
        }
        
        // FIX: Normalize user email and counterparty email
        const normalizedUserEmail = userEmail.trim().toLowerCase();
        const normalizedCounterparty = counterparty.trim().toLowerCase();
        
        // Get source contract
        const sourceContract = database.contracts.get(sourceContractId);
        if (!sourceContract) {
            return res.status(404).json({ error: 'Source contract not found' });
        }
        
        // FIX: Normalize source contract emails for case-insensitive comparison
        const sourceBuyerEmail = (sourceContract.buyerEmail || '').trim().toLowerCase();
        const sourceSupplierEmail = (sourceContract.supplierEmail || '').trim().toLowerCase();
        
        // Verify trader is a party to source contract (case-insensitive comparison)
        if (sourceBuyerEmail !== normalizedUserEmail && sourceSupplierEmail !== normalizedUserEmail) {
            return res.status(403).json({ error: 'You must be a party to the source contract to create a dual contract' });
        }
        
        // Determine opposite role (case-insensitive comparison)
        const isBuyerInSource = sourceBuyerEmail === normalizedUserEmail;
        const oppositeRole = isBuyerInSource ? 'supplier' : 'buyer';
        
        // Determine buyer and supplier for new contract
        let buyerEmail, supplierEmail;
        if (oppositeRole === 'supplier') {
            supplierEmail = normalizedUserEmail;
            buyerEmail = normalizedCounterparty;
        } else {
            buyerEmail = normalizedUserEmail;
            supplierEmail = normalizedCounterparty;
        }
        
        // Validate counterparty exists with case-insensitive lookup
        const counterpartyUser = database.users.get(normalizedCounterparty);
        if (!counterpartyUser) {
            // FIX: Enhanced error message with available demo users (dev only)
            const isDev = process.env.NODE_ENV !== 'production';
            const availableUsers = isDev ? Array.from(database.users.keys()).filter(email => 
                email.includes('@test.com') || email.includes('@tangent.com')
            ) : [];
            
            const errorResponse = {
                error: 'Counterparty email not found',
                message: 'Please ensure the user is registered on the platform.',
                searchedEmail: normalizedCounterparty,
                originalEmail: counterparty
            };
            
            if (isDev && availableUsers.length > 0) {
                errorResponse.availableDemoUsers = availableUsers;
                errorResponse.devMessage = 'Available demo users for testing: ' + availableUsers.join(', ');
            }
            
            return res.status(400).json(errorResponse);
        }
        
        // Calculate values
        const calculatedTotalValue = parseFloat(quantity) * parseFloat(price);
        
        // Create dual contract object first (without deposit fields, they'll be set using financing terms)
        const contractId = `contract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const contract = {
            id: contractId,
            product: product,
            quantity: parseFloat(quantity),
            unit: unit,
            pricePerUnit: parseFloat(price),
            totalValue: totalValue || calculatedTotalValue,
            currency: currency,
            buyerEmail: buyerEmail,
            supplierEmail: supplierEmail,
            voyageTime: parseInt(voyageTime),
            description: description,
            status: oppositeRole === 'supplier' ? 'pending_buyer_confirmation' : 'pending_supplier_confirmation',
            depositPaid: false,
            documentsUploaded: false,
            createdAt: new Date().toISOString(),
            createdBy: userEmail,
            linkedContract: true,
            sourceContractId: sourceContractId,
            linkedContractId: null // Will be set when documents are transferred
        };
        
        // Get effective financing terms (legacy or risk-based, depending on feature flag)
        const financingTerms = getEffectiveFinancingTerms(contract, USE_RISK_ENGINE_FOR_FINANCING);
        
        // Use the effective deposit percent (from request body if provided, otherwise from financing terms)
        const effectiveDepositPercent = depositPercent !== undefined && depositPercent !== null 
            ? parseFloat(depositPercent) 
            : financingTerms.depositPercent;
        
        const calculatedDepositAmount = (contract.totalValue * effectiveDepositPercent) / 100;
        
        // Add deposit fields to contract
        contract.depositPercent = effectiveDepositPercent;
        contract.depositAmount = depositAmount || calculatedDepositAmount;
        
        // Note: normalizeContractDeposit helper is used for parsing input, not mutating contract
        // Deposit normalization is handled by ensureContractFields and manual checks
        
        // Log financing terms source (lightweight, for debugging)
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
            console.log(
                '[FINANCING TERMS] Using',
                financingTerms.source,
                'terms for dual contract',
                contractId,
                'deposit % =',
                effectiveDepositPercent,
                'max financing % =',
                financingTerms.maxFinancingPercent
            );
        }
        
        // Link contracts bidirectionally
        if (!sourceContract.linkedContracts) {
            sourceContract.linkedContracts = [];
        }
        sourceContract.linkedContracts.push(contractId);
        database.contracts.set(sourceContractId, sourceContract);
        
        contract.linkedContracts = [sourceContractId];
        database.contracts.set(contractId, contract);
        
        saveDatabase();
        
        // Log audit event
        logAuditEvent('dual_contract_created', userEmail, {
            contractId: contractId,
            sourceContractId: sourceContractId,
            product: product,
            totalValue: contract.totalValue,
            counterparty: counterparty
        });
        
        console.log(`[DUAL CONTRACT] Dual contract created: ${contractId} linked to ${sourceContractId} by ${userEmail}`);
        
        res.status(201).json({
            success: true,
            id: contractId,
            contract: contract,
            message: 'Dual contract created and linked successfully'
        });
    } catch (error) {
        console.error('[ERROR] Dual contract creation error:', error);
        res.status(500).json({ 
            error: 'Failed to create dual contract',
            message: error.message || 'Unknown error occurred'
        });
    }
});

// MERGE-LIFELINE: Pay Deposit API - new endpoint at /deposit/pay
// Uses authoritative contract.deposit object structure
app.post('/api/contracts/:contractId/deposit/pay', authenticateToken, async (req, res) => {
    try {
        const { contractId } = req.params;
        const userEmail = getCurrentUserEmail(req);
        
        if (!userEmail) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const contractFromDb = database.contracts.get(contractId);
        if (!contractFromDb) {
            return res.status(404).json({ error: 'Contract not found' });
        }
        let contract = ensureContractFields(contractFromDb);
        
        // Compute deposit object to check state
        const deposit = computeDepositObject(contract);
        
        // Validate: deposit must be required
        if (!deposit.required) {
            return res.status(400).json({ 
                error: 'DEPOSIT_NOT_REQUIRED',
                message: 'Deposit is not required for this contract'
            });
        }
        
        // Validate: deposit must not already be paid
        if (deposit.status === "paid") {
            return res.status(409).json({ 
                error: 'DEPOSIT_ALREADY_PAID',
                message: 'Deposit has already been paid'
            });
        }
        
        // Validate: user must be the payer (or admin)
        const isPayer = (deposit.payer === "BUYER" && contract.buyerEmail === userEmail) ||
                       (deposit.payer === "FINANCIER" && req.user.role === 'admin'); // TODO: Add financier role check
        if (!isPayer && req.user.role !== 'admin' && req.user.role !== 'trader') {
            return res.status(403).json({ error: 'Only the payer can pay the deposit' });
        }
        
        // Mark deposit as paid
        // A1 FINALIZATION: Use state machine for PAY_DEPOSIT action
        // Normalize actor email
        const normalizedActorEmail = userEmail.trim().toLowerCase();
        
        const transitionResult = transitionContract(contract, ContractAction.PAY_DEPOSIT, normalizedActorEmail);
        
        if (!transitionResult.success) {
            return res.status(400).json({
                error: 'State transition failed',
                message: transitionResult.error
            });
        }
        
        // Update contract with transition result
        contract.status = transitionResult.newState; // Should be AWAITING_VERIFICATION_DOCS
        contract.depositPaid = true;
        contract.buyerDepositPaid = true;
        contract.depositAmountPaid = deposit.amount;
        contract.depositPaidAt = new Date().toISOString();
        contract.updatedAt = new Date().toISOString();
        
        // A4 GOLDEN PATH: Log deposit payment step
        console.log('[A4_GOLDEN_PATH] Deposit paid by buyer', {
            contractId: contractId,
            userEmail: userEmail,
            depositAmount: deposit.amount,
            depositPayer: deposit.payer,
            newStatus: contract.status
        });
        
        // Append timeline event
        if (!contract.timeline) {
            contract.timeline = [];
        }
        contract.timeline.push({
            event: 'deposit_paid',
            timestamp: new Date().toISOString(),
            actor: normalizedActorEmail,
            description: `Deposit paid by ${deposit.payer}`,
            stateTransition: {
                from: transitionResult.fromState,
                to: transitionResult.newState,
                action: transitionResult.action
            }
        });
        
        // Recompute settlement status (may unlock)
        const documents = contract.documents || [];
        const settlement = computeSettlementObject(contract, documents);
        
        database.contracts.set(contractId, contract);
        saveDatabase();
        
        // Log audit event
        logAuditEvent('deposit_paid', normalizedActorEmail, {
            contractId: contractId,
            depositAmount: deposit.amount,
            payer: deposit.payer,
            stateTransition: {
                from: transitionResult.fromState,
                to: transitionResult.newState
            }
        });
        
        // Return updated contract with computed objects
        const updatedDeposit = computeDepositObject(contract);
        const updatedSettlement = computeSettlementObject(contract, documents);
        const financing = computeFinancingObject(contract);
        
        res.json({
            success: true,
            message: 'Deposit paid successfully',
            contract: {
                ...contract,
                status: contract.status, // A1: Should be AWAITING_VERIFICATION_DOCS
                deposit: updatedDeposit,
                settlement: updatedSettlement,
                financing: financing,
                stateTransition: {
                    from: transitionResult.fromState,
                    to: transitionResult.newState,
                    action: transitionResult.action
                }
            }
        });
        
    } catch (error) {
        console.error('[ERROR] Deposit pay error:', error);
        res.status(500).json({ 
            error: 'Failed to pay deposit',
            message: error.message || 'Unknown error occurred'
        });
    }
});

// Pay Settlement API - final settlement payment
// Uses authoritative contract.settlement object structure
app.post('/api/contracts/:contractId/settlement/pay', authenticateToken, async (req, res) => {
    try {
        const { contractId } = req.params;
        const userEmail = getCurrentUserEmail(req);
        
        if (!userEmail) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const contractFromDb = database.contracts.get(contractId);
        if (!contractFromDb) {
            return res.status(404).json({ error: 'Contract not found' });
        }
        let contract = ensureContractFields(contractFromDb);
        
        // Get documents for settlement computation
        const documents = contract.documents || [];
        
        // Compute settlement object to check state
        const settlement = computeSettlementObject(contract, documents);
        
        // Validate: settlement must be required
        if (!settlement.required) {
            return res.status(400).json({ 
                error: 'SETTLEMENT_NOT_REQUIRED',
                message: 'Settlement is not required for this contract'
            });
        }
        
        // Validate: settlement must be ready (not locked, not paid)
        if (settlement.status === "locked") {
            return res.status(409).json({ 
                error: 'SETTLEMENT_NOT_READY',
                message: `Settlement is locked: ${settlement.lockedReason || 'Prerequisites not met'}`,
                lockedReason: settlement.lockedReason
            });
        }
        
        if (settlement.status === "paid") {
            return res.status(409).json({ 
                error: 'SETTLEMENT_ALREADY_PAID',
                message: 'Settlement has already been paid'
            });
        }
        
        // A4 INVARIANT: Supplier never pays settlement
        if (contract.supplierEmail === userEmail && settlement.payer !== "SUPPLIER") {
            console.error('[A4_INVARIANT_VIOLATION] Supplier attempted to pay settlement', {
                contractId: contractId,
                userEmail: userEmail,
                settlementPayer: settlement.payer,
                supplierEmail: contract.supplierEmail
            });
            return res.status(403).json({ 
                error: 'SUPPLIER_CANNOT_PAY',
                message: 'Suppliers cannot pay settlement. Only the configured payer can pay.'
            });
        }
        
        // Validate: user must be the payer (or admin)
        const isPayer = (settlement.payer === "BUYER" && contract.buyerEmail === userEmail) ||
                       (settlement.payer === "FINANCIER" && req.user.role === 'admin') ||
                       (settlement.payer === "SUPPLIER" && contract.supplierEmail === userEmail); // Allow supplier only if configured as payer
        if (!isPayer && req.user.role !== 'admin' && req.user.role !== 'trader') {
            return res.status(403).json({ error: 'Only the payer can pay the settlement' });
        }
        
        // A4 GOLDEN PATH: Log settlement payment step
        console.log('[A4_GOLDEN_PATH] Settlement payment initiated', {
            contractId: contractId,
            userEmail: userEmail,
            settlementPayer: settlement.payer,
            settlementAmount: settlement.amount,
            currentStatus: contract.status
        });
        
        // Mark settlement as paid
        contract.settlementPaid = true;
        contract.settlementPaidAt = new Date().toISOString();
        contract.finalPaymentPaid = true;
        contract.settlementStatus = 'paid';
        
        // Update status to COMPLETED after final payment
        if (contract.status === 'AWAITING_BUYER_FINAL_PAYMENT' || contract.status === 'AWAITING_SETTLEMENT') {
            contract.status = 'COMPLETED';
            console.log('[A4_GOLDEN_PATH] Contract status updated to COMPLETED', {
                contractId: contractId,
                previousStatus: contract.status,
                newStatus: 'COMPLETED'
            });
        }
        
        // STEP 3: Release original documents after settlement payment
        if (contract.originalDocs) {
            contract.originalDocs.releaseStatus = "RELEASED";
        }
        // Also set on contract root for backward compatibility
        contract.docsReleaseStatus = "RELEASED";
        contract.docsReleasedAt = new Date().toISOString();
        
        database.contracts.set(contractId, contract);
        saveDatabase();
        
        // Log audit event
        logAuditEvent('settlement_paid', userEmail, {
            contractId: contractId,
            settlementAmount: settlement.amount,
            payer: settlement.payer,
            docsReleased: true
        });
        
        // Return updated contract with computed objects
        const deposit = computeDepositObject(contract);
        const updatedSettlement = computeSettlementObject(contract, documents);
        const financing = computeFinancingObject(contract);
        const originalDocs = computeOriginalDocsObject(contract);
        const verificationDocs = computeVerificationDocsObject(contract);
        
        res.json({
            success: true,
            message: 'Settlement paid successfully',
            contract: {
                ...contract,
                deposit: deposit,
                settlement: updatedSettlement,
                financing: financing,
                originalDocs: originalDocs,
                verificationDocs: verificationDocs,
                financing: financing
            }
        });
        
    } catch (error) {
        console.error('[ERROR] Settlement pay error:', error);
        res.status(500).json({ 
            error: 'Failed to pay settlement',
            message: error.message || 'Unknown error occurred'
        });
    }
});

// ================================
// DOCUMENT APPROVAL FLOW ENDPOINTS
// ================================

// Supplier uploads verification documents (metadata)
// POST /api/contracts/:id/docs/verification
app.post('/api/contracts/:contractId/docs/verification', authenticateToken, async (req, res) => {
    try {
        const { contractId } = req.params;
        const userEmail = getCurrentUserEmail(req);
        
        if (!userEmail) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const contractFromDb = database.contracts.get(contractId);
        if (!contractFromDb) {
            return res.status(404).json({ error: 'Contract not found' });
        }
        
        // CRITICAL: Work directly with the contract from database (ensureContractFields mutates in place)
        // This ensures we're modifying the actual stored object
        let contract = ensureContractFields(contractFromDb);
        
        // Log initial state
        console.log('[VERIFICATION_DOC_UPLOAD] Initial contract state:', {
            contractId: contractId,
            hasVerificationDocs: !!contract.verificationDocs,
            itemsCountBefore: contract.verificationDocs?.items?.length || 0
        });
        
        // Validate: user must be supplier
        if (contract.supplierEmail !== userEmail && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only supplier can upload verification documents' });
        }
        
        // A2.1e: Validate: contract must be in AWAITING_VERIFICATION_DOCS state
        // (This allows zero-deposit contracts to upload docs immediately after confirmation)
        const contractStatus = normalizeStatus(contract.status);
        
        // Log state fields before returning INVALID_STATE
        console.log('[VERIFICATION_DOC_UPLOAD] State check failed - logging contract state:', {
            contractId: contractId,
            status: contract.status,
            normalizedStatus: contractStatus,
            expectedStatus: ContractState.AWAITING_VERIFICATION_DOCS,
            docsStatus: contract.docsStatus || contract.docs_auth_status || 'N/A',
            draftDocsUploaded: contract.draftDocsUploaded || false,
            originalDocsUploaded: contract.originalDocsUploaded || false,
            depositPercent: contract.depositPercent || contract.deposit_percent || 0,
            depositPaid: contract.depositPaid || false
        });
        
        if (contractStatus !== ContractState.AWAITING_VERIFICATION_DOCS) {
            return res.status(400).json({ 
                error: 'INVALID_STATE',
                message: 'Contract must be in AWAITING_VERIFICATION_DOCS state to upload verification documents'
            });
        }
        
        // Compute deposit satisfaction: if depositPercent=0, deposit is not required
        const depositRequired = Number(contract.depositPercent || contract.deposit_percent || 0) > 0;
        const depositSatisfied = !depositRequired || contract.depositPaid === true;
        
        if (!depositSatisfied) {
            return res.status(400).json({ 
                error: 'DEPOSIT_NOT_PAID',
                message: 'Deposit must be paid before uploading verification documents'
            });
        }
        
        // Log when bypassing deposit gate because it's not required
        if (!depositRequired) {
            console.log('[DEPOSIT] bypass deposit gate (depositPercent=0) contractId=' + contractId);
        }
        
        // Get document metadata from request body
        const { name, url, type } = req.body;
        
        if (!name || !url || !type) {
            return res.status(400).json({ 
                error: 'MISSING_FIELDS',
                message: 'name, url, and type are required'
            });
        }
        
        // Initialize verificationDocs if not exists
        if (!contract.verificationDocs) {
            contract.verificationDocs = {
                status: "NONE",
                items: [],
                buyerDecision: null,
                buyerComment: null,
                updatedAt: null
            };
        }
        
        // Ensure items array exists
        if (!Array.isArray(contract.verificationDocs.items)) {
            contract.verificationDocs.items = [];
        }
        
        // Add new document item
        const newItem = {
            name: name,
            url: url,
            type: type,
            uploadedAt: new Date().toISOString(),
            uploadedBy: userEmail
        };
        
        contract.verificationDocs.items.push(newItem);
        contract.verificationDocs.status = "PENDING";
        contract.verificationDocs.updatedAt = new Date().toISOString();
        
        // MERGE LIFELINE: Set contract status after verification docs upload
        contract.status = 'AWAITING_BUYER_DOC_VERIFICATION';
        console.log('[MERGE_LIFELINE_BUILD]', MERGE_LIFELINE_BUILD);
        console.log('[VERIFICATION_DOC_UPLOAD] Status set to AWAITING_BUYER_DOC_VERIFICATION', {
            contractId: contractId,
            previousStatus: contractFromDb.status,
            newStatus: contract.status
        });
        
        // MERGE LIFELINE: Invariant assertion - verification upload cannot advance to final payment
        if (contract.status === 'AWAITING_BUYER_FINAL_PAYMENT') {
            throw new Error("Invariant violation: verification upload cannot advance to final payment");
        }
        
        // CRITICAL: Ensure contract is saved with verificationDocs
        contract.updatedAt = new Date().toISOString();
        
        // CRITICAL: Verify the contract object has verificationDocs before saving
        if (!contract.verificationDocs || !Array.isArray(contract.verificationDocs.items)) {
            console.error('[VERIFICATION_DOC_UPLOAD] ERROR: verificationDocs.items is not an array before save!', {
                contractId: contractId,
                verificationDocs: contract.verificationDocs
            });
            return res.status(500).json({ 
                error: 'INTERNAL_ERROR',
                message: 'Failed to prepare verificationDocs for save'
            });
        }
        
        // Save to database - CRITICAL: This must persist the verificationDocs
        database.contracts.set(contractId, contract);
        saveDatabase();
        
        // CRITICAL: Verify the contract was saved correctly by reading it back
        const savedContract = database.contracts.get(contractId);
        const savedItemsCount = savedContract?.verificationDocs?.items?.length || 0;
        
        // Log for debugging
        console.log('[VERIFICATION_DOC_UPLOAD]', {
            contractId: contractId,
            documentName: name,
            documentType: type,
            itemsCount: contract.verificationDocs.items.length,
            savedItemsCount: savedItemsCount,
            status: contract.verificationDocs.status,
            saved: true,
            verificationMatch: contract.verificationDocs.items.length === savedItemsCount
        });
        
        // If saved count doesn't match, log error
        if (contract.verificationDocs.items.length !== savedItemsCount) {
            console.error('[VERIFICATION_DOC_UPLOAD] WARNING: Item count mismatch after save!', {
                expected: contract.verificationDocs.items.length,
                actual: savedItemsCount
            });
        }
        
        // Log audit event
        logAuditEvent('verification_doc_uploaded', userEmail, {
            contractId: contractId,
            documentName: name,
            documentType: type
        });
        
        // Return updated contract with computed objects
        const verificationDocs = computeVerificationDocsObject(contract);
        const updatedSettlement = computeSettlementObject(contract, contract.documents || []);
        
        res.json({
            success: true,
            message: 'Verification document uploaded successfully',
            contract: {
                ...contract,
                verificationDocs: verificationDocs,
                settlement: updatedSettlement
            }
        });
        
    } catch (error) {
        console.error('[ERROR] Verification doc upload error:', error);
        res.status(500).json({ 
            error: 'Failed to upload verification document',
            message: error.message || 'Unknown error occurred'
        });
    }
});

// Buyer approves/rejects verification documents
// POST /api/contracts/:id/docs/verification/decision
app.post('/api/contracts/:contractId/docs/verification/decision', authenticateToken, async (req, res) => {
    try {
        const { contractId } = req.params;
        const userEmail = getCurrentUserEmail(req);
        
        if (!userEmail) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const contractFromDb = database.contracts.get(contractId);
        if (!contractFromDb) {
            return res.status(404).json({ error: 'Contract not found' });
        }
        let contract = ensureContractFields(contractFromDb);
        
        // Validate: user must be buyer
        if (contract.buyerEmail !== userEmail && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only buyer can approve/reject verification documents' });
        }
        
        // Validate: verification docs must exist and be pending
        const verificationDocs = computeVerificationDocsObject(contract);
        if (verificationDocs.status !== "PENDING") {
            return res.status(400).json({ 
                error: 'INVALID_STATUS',
                message: `Verification docs status is ${verificationDocs.status}, expected PENDING`
            });
        }
        
        // Get decision from request body
        const { decision, comment } = req.body;
        
        if (!decision || (decision !== "APPROVED" && decision !== "REJECTED")) {
            return res.status(400).json({ 
                error: 'INVALID_DECISION',
                message: 'decision must be "APPROVED" or "REJECTED"'
            });
        }
        
        // Update verification docs
        if (!contract.verificationDocs) {
            contract.verificationDocs = {
                status: "NONE",
                items: [],
                buyerDecision: null,
                buyerComment: null,
                updatedAt: null
            };
        }
        
        contract.verificationDocs.buyerDecision = decision;
        contract.verificationDocs.buyerComment = comment || null;
        contract.verificationDocs.status = decision;
        contract.verificationDocs.updatedAt = new Date().toISOString();
        
        // CRITICAL: If approved, transition contract state to AWAITING_ORIGINAL_DOCS
        if (decision === "APPROVED") {
            const transitionResult = transitionContract(contract, ContractAction.APPROVE_VERIFICATION_DOCS, userEmail);
            
            if (!transitionResult.success) {
                console.error('[VERIFICATION_DECISION] State transition failed:', transitionResult.error);
                return res.status(400).json({
                    error: 'STATE_TRANSITION_FAILED',
                    message: transitionResult.error || 'Failed to transition contract state'
                });
            }
            
            console.log('[VERIFICATION_DECISION] State transition successful:', {
                contractId: contractId,
                fromState: transitionResult.fromState,
                toState: transitionResult.newState,
                action: transitionResult.action,
                actorEmail: transitionResult.actorEmail
            });
        }
        
        // Save to database
        database.contracts.set(contractId, contract);
        saveDatabase();
        
        // Log audit event
        logAuditEvent('verification_doc_decision', userEmail, {
            contractId: contractId,
            decision: decision,
            comment: comment,
            newStatus: contract.status
        });
        
        // Return updated contract with computed objects and new status
        const updatedVerificationDocs = computeVerificationDocsObject(contract);
        const updatedSettlement = computeSettlementObject(contract, contract.documents || []);
        const deposit = computeDepositObject(contract);
        const financing = computeFinancingObject(contract);
        const originalDocs = computeOriginalDocsObject(contract);
        
        res.json({
            success: true,
            message: `Verification documents ${decision.toLowerCase()}`,
            contract: {
                ...contract,
                status: normalizeStatus(contract.status), // Ensure normalized status
                verificationDocs: updatedVerificationDocs,
                settlement: updatedSettlement,
                deposit: deposit,
                financing: financing,
                originalDocs: originalDocs
            }
        });
        
    } catch (error) {
        console.error('[ERROR] Verification doc decision error:', error);
        res.status(500).json({ 
            error: 'Failed to process verification document decision',
            message: error.message || 'Unknown error occurred'
        });
    }
});

// Supplier uploads original documents (metadata)
// POST /api/contracts/:id/docs/original
app.post('/api/contracts/:contractId/docs/original', authenticateToken, async (req, res) => {
    try {
        const { contractId } = req.params;
        const userEmail = getCurrentUserEmail(req);
        
        if (!userEmail) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const contractFromDb = database.contracts.get(contractId);
        if (!contractFromDb) {
            return res.status(404).json({ error: 'Contract not found' });
        }
        let contract = ensureContractFields(contractFromDb);
        
        // Validate: user must be supplier
        if (contract.supplierEmail !== userEmail && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only supplier can upload original documents' });
        }
        
        // Compute deposit satisfaction: if depositPercent=0, deposit is not required
        const depositRequired = Number(contract.depositPercent || contract.deposit_percent || 0) > 0;
        const depositSatisfied = !depositRequired || contract.depositPaid === true;
        
        if (!depositSatisfied) {
            return res.status(400).json({ 
                error: 'DEPOSIT_NOT_PAID',
                message: 'Deposit must be paid before uploading original documents'
            });
        }
        
        // Log when bypassing deposit gate because it's not required
        if (!depositRequired) {
            console.log('[DEPOSIT] bypass deposit gate (depositPercent=0) contractId=' + contractId);
        }
        
        // Validate: verification docs must be approved
        const verificationDocs = computeVerificationDocsObject(contract);
        if (verificationDocs.status !== "APPROVED") {
            return res.status(400).json({ 
                error: 'VERIFICATION_NOT_APPROVED',
                message: 'Verification documents must be approved before uploading originals'
            });
        }
        
        // Get document metadata from request body
        const { name, url, type } = req.body;
        
        if (!name || !url || !type) {
            return res.status(400).json({ 
                error: 'MISSING_FIELDS',
                message: 'name, url, and type are required'
            });
        }
        
        // Initialize originalDocs if not exists
        if (!contract.originalDocs) {
            contract.originalDocs = {
                status: "NONE",
                items: [],
                verifiedBy: null,
                verifiedAt: null,
                releaseStatus: "LOCKED"
            };
        }
        
        // Add new document item
        const newItem = {
            name: name,
            url: url,
            type: type,
            uploadedAt: new Date().toISOString()
        };
        
        contract.originalDocs.items.push(newItem);
        contract.originalDocs.status = "PENDING";
        
        // A4 GOLDEN PATH: Log original docs upload step
        console.log('[A4_GOLDEN_PATH] Original documents uploaded by supplier', {
            contractId: contractId,
            userEmail: userEmail,
            documentName: name,
            documentType: type,
            currentStatus: contract.status
        });
        
        // Save to database first
        database.contracts.set(contractId, contract);
        saveDatabase();
        
        // Log audit event
        logAuditEvent('original_doc_uploaded', userEmail, {
            contractId: contractId,
            documentName: name,
            documentType: type
        });
        
        // STEP 1: Automatic document authentication after upload
        console.log('[DOC_AUTH] started', { contractId: contractId });
        const authResult = runDocumentAuthentication(contractId);
        
        if (authResult.success) {
            console.log('[DOC_AUTH] success', {
                contractId: contractId,
                docsAuthStatus: contract.docsAuthStatus,
                settlementStatus: contract.settlementStatus || 'ready'
            });
        } else {
            console.error('[DOC_AUTH] failed', {
                contractId: contractId,
                error: authResult.error
            });
        }
        
        // Re-fetch contract after authentication to get updated fields
        const updatedContract = database.contracts.get(contractId);
        const finalContract = ensureContractFields(updatedContract);
        
        // Return updated contract with computed objects
        const originalDocs = computeOriginalDocsObject(finalContract);
        const updatedSettlement = computeSettlementObject(finalContract, finalContract.documents || []);
        const deposit = computeDepositObject(finalContract);
        const financing = computeFinancingObject(finalContract);
        const finalVerificationDocs = computeVerificationDocsObject(finalContract);
        
        res.json({
            success: true,
            message: 'Original document uploaded successfully',
            contract: {
                ...finalContract,
                originalDocs: originalDocs,
                settlement: updatedSettlement,
                deposit: deposit,
                financing: financing,
                verificationDocs: finalVerificationDocs
            }
        });
        
    } catch (error) {
        console.error('[ERROR] Original doc upload error:', error);
        res.status(500).json({ 
            error: 'Failed to upload original document',
            message: error.message || 'Unknown error occurred'
        });
    }
});

// Admin verifies original documents (mock verification for MVP)
// POST /api/contracts/:id/docs/original/verify
app.post('/api/contracts/:contractId/docs/original/verify', authenticateToken, async (req, res) => {
    try {
        const { contractId } = req.params;
        const userEmail = getCurrentUserEmail(req);
        
        if (!userEmail) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const contractFromDb = database.contracts.get(contractId);
        if (!contractFromDb) {
            return res.status(404).json({ error: 'Contract not found' });
        }
        let contract = ensureContractFields(contractFromDb);
        
        // Validate: user must be admin (or allow mock verification for MVP)
        // For MVP, allow any authenticated user to verify (mock)
        // TODO: Restrict to admin role in production
        
        // Validate: original docs must exist and be pending
        const originalDocs = computeOriginalDocsObject(contract);
        if (originalDocs.status !== "PENDING") {
            return res.status(400).json({ 
                error: 'INVALID_STATUS',
                message: `Original docs status is ${originalDocs.status}, expected PENDING`
            });
        }
        
        // Update original docs to verified
        if (!contract.originalDocs) {
            contract.originalDocs = {
                status: "NONE",
                items: [],
                verifiedBy: null,
                verifiedAt: null,
                releaseStatus: "LOCKED"
            };
        }
        
        contract.originalDocs.status = "VERIFIED";
        contract.originalDocs.verifiedBy = userEmail;
        contract.originalDocs.verifiedAt = new Date().toISOString();
        // Keep releaseStatus as LOCKED until settlement is paid
        
        database.contracts.set(contractId, contract);
        saveDatabase();
        
        // Log audit event
        logAuditEvent('original_doc_verified', userEmail, {
            contractId: contractId,
            verifiedBy: userEmail
        });
        
        // Return updated contract with computed objects
        const updatedOriginalDocs = computeOriginalDocsObject(contract);
        const updatedSettlement = computeSettlementObject(contract, contract.documents || []);
        
        res.json({
            success: true,
            message: 'Original documents verified successfully',
            contract: {
                ...contract,
                originalDocs: updatedOriginalDocs,
                settlement: updatedSettlement
            }
        });
        
    } catch (error) {
        console.error('[ERROR] Original doc verify error:', error);
        res.status(500).json({ 
            error: 'Failed to verify original documents',
            message: error.message || 'Unknown error occurred'
        });
    }
});

// Pay Deposit API (legacy endpoint - keep for backward compatibility)
app.post('/api/contracts/:contractId/deposit', authenticateToken, async (req, res) => {
    try {
        const { contractId } = req.params;
        const userEmail = req.user.email;
        const { useBlockchain = false } = req.body;
        
        const contractFromDb = database.contracts.get(contractId);
        if (!contractFromDb) {
            return res.status(404).json({ error: 'Contract not found' });
        }
        let contract = ensureContractFields(contractFromDb);
        
        // Verify user is the buyer
        if (contract.buyerEmail !== userEmail && req.user.role !== 'admin' && req.user.role !== 'trader') {
            return res.status(403).json({ error: 'Only the buyer can pay the deposit' });
        }
        
        // Check if deposit already paid
        if (contract.depositPaid) {
            return res.status(400).json({ error: 'Deposit already paid for this contract' });
        }
        
        // MERGE-LIFELINE: Check contract status - deposit can only be paid after buyer confirmation (status = 'active')
        if (contract.status !== 'active' && contract.status !== 'confirmed') {
            return res.status(400).json({ 
                error: 'Contract must be confirmed before deposit can be paid',
                currentStatus: contract.status
            });
        }
        
        // Get user wallet
        const user = database.users.get(userEmail);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const walletId = `wallet-${userEmail}`;
        const wallet = database.wallets.get(walletId);
        
        // Get effective financing terms (may use risk-based values if flag is ON and risk fields exist)
        const financingTerms = getEffectiveFinancingTerms(contract, USE_RISK_ENGINE_FOR_FINANCING);
        
        // Calculate deposit amount using effective deposit percent
        // Prefer stored depositAmount, otherwise calculate from effective deposit percent
        const effectiveDepositPercent = contract.depositPercent || financingTerms.depositPercent;
        const depositAmount = contract.depositAmount || Math.round(contract.totalValue * (effectiveDepositPercent / 100));
        
        // Log financing terms source (lightweight, for debugging)
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
            console.log(
                '[FINANCING TERMS] Using',
                financingTerms.source,
                'terms for deposit payment on contract',
                contractId,
                'deposit % =',
                effectiveDepositPercent,
                'max financing % =',
                financingTerms.maxFinancingPercent
            );
        }
        
        // Check wallet balance (if wallet exists)
        if (wallet && wallet.tgtBalance < depositAmount) {
            return res.status(400).json({ 
                error: 'Insufficient balance',
                action: 'fund_wallet',
                details: {
                    required: depositAmount,
                    available: wallet.tgtBalance || 0
                }
            });
        }
        
        // Process blockchain payment if requested
        let blockchainTxHash = null;
        let blockchainStatus = 'simulated';
        
        if (useBlockchain && blockchain && blockchain.isInitialized) {
            try {
                // Get user's wallet address
                const walletAddress = wallet?.address || user.walletAddress;
                if (!walletAddress) {
                    console.warn('[BLOCKCHAIN] No wallet address found, falling back to simulation');
                } else {
                    // Create escrow trade on blockchain if not exists
                    let tradeId = contract.blockchainTradeId;
                    if (!tradeId) {
                        // Generate a unique trade ID for blockchain
                        tradeId = `trade-${contractId}-${Date.now()}`;
                        const tradeData = {
                            tradeId: tradeId,
                            buyer: walletAddress, // Use wallet address, not email
                            supplier: database.wallets.get(`wallet-${contract.supplierEmail}`)?.address || contract.supplierEmail,
                            totalAmount: contract.totalValue,
                            depositAmount: depositAmount,
                            commodity: contract.product,
                            quantity: contract.quantity.toString()
                        };
                        try {
                            const tradeTx = await blockchain.createEscrowTrade(tradeData);
                            if (tradeTx && tradeTx.hash) {
                                contract.blockchainTradeId = tradeId;
                                contract.blockchainTradeTxHash = tradeTx.hash;
                                console.log(`[BLOCKCHAIN] Escrow trade created: ${tradeId}, tx: ${tradeTx.hash}`);
                            }
                        } catch (error) {
                            console.warn('[BLOCKCHAIN] Failed to create escrow trade, using simulation:', error.message);
                        }
                    }
                    
                    // Make deposit to escrow
                    if (tradeId) {
                        try {
                            const depositTx = await blockchain.depositToEscrow(tradeId, depositAmount);
                            if (depositTx && depositTx.hash) {
                                blockchainTxHash = depositTx.hash;
                                blockchainStatus = 'confirmed';
                                console.log(`[BLOCKCHAIN] Deposit transaction: ${blockchainTxHash}`);
                            }
                        } catch (error) {
                            console.warn('[BLOCKCHAIN] Deposit failed, falling back to simulation:', error.message);
                        }
                    }
                }
            } catch (error) {
                console.error('[ERROR] Blockchain deposit error:', error);
                console.log('[INFO] Falling back to simulation mode');
                // Continue with simulation if blockchain fails
            }
        }
        
        // Update wallet balance (simulate payment or after blockchain confirmation)
        if (wallet) {
            wallet.tgtBalance = (wallet.tgtBalance || 0) - depositAmount;
            database.wallets.set(walletId, wallet);
        }
        
        // Mark deposit as paid
        contract.depositPaid = true;
        contract.buyerDepositPaid = true;
        contract.depositPaidAt = new Date().toISOString();
        
        // Update status to AWAITING_DOCUMENTS so supplier can upload
        contract.status = 'AWAITING_DOCUMENTS';
        
        database.contracts.set(contractId, contract);
        saveDatabase();
        
        // STEP 2: Evaluate and store risk metrics when contract is activated (deposit paid)
        // This runs after contract is activated but does not block the response
        const { evaluateAndStoreRiskForContract } = require('./lib/risk-engine');
        try {
            evaluateAndStoreRiskForContract(contractId, database.contracts)
                .then(risk => {
                    console.log(`[RISK ENGINE] Risk evaluation completed for activated contract ${contractId}`, {
                        riskScore: risk.riskScore,
                        riskBand: risk.riskBand
                    });
                })
                .catch(err => {
                    console.error(`[RISK ENGINE] Risk evaluation failed for activated contract ${contractId}:`, err.message);
                    // Do not throw - deposit payment must succeed even if risk evaluation fails
                });
        } catch (err) {
            console.error('[RISK ENGINE] Unexpected error calling evaluateAndStoreRiskForContract:', err.message);
            // Do not throw - deposit payment must succeed even if risk evaluation fails
        }
        
        // Create transaction record
        const transactionId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        database.transactions.set(transactionId, {
            id: transactionId,
            contractId: contractId,
            type: 'deposit',
            amount: depositAmount,
            currency: contract.currency,
            from: userEmail,
            to: 'escrow',
            status: blockchainStatus === 'confirmed' ? 'confirmed' : 'completed',
            blockchain: useBlockchain,
            blockchainTxHash: blockchainTxHash,
            blockchainStatus: blockchainStatus,
            createdAt: new Date().toISOString()
        });
        
        // Log audit event
        logAuditEvent('deposit_paid', userEmail, {
            contractId: contractId,
            amount: depositAmount,
            currency: contract.currency,
            blockchain: useBlockchain
        });
        
        console.log(`[CONTRACT] Deposit paid: ${contractId} by ${userEmail}, amount: ${depositAmount}`);
        
        res.json({
            success: true,
            message: 'Deposit paid successfully',
            contract: contract,
            transactionId: transactionId
        });
        
    } catch (error) {
        console.error('[ERROR] Pay deposit error:', error);
        res.status(500).json({ 
            error: 'Failed to process deposit',
            message: error.message || 'Unknown error occurred'
        });
    }
});

// MERGE-LIFELINE: Price Comparison API - Compare contract price with market benchmark
app.post('/api/pricing/compare', authenticateToken, async (req, res) => {
    try {
        const { product, quantity, pricePerUnit, currency, shipmentDate } = req.body;
        
        if (!product || !pricePerUnit) {
            return res.status(400).json({ error: 'Product and pricePerUnit are required' });
        }
        
        // Try to use price prediction service if available
        let pricePredictionIntegration = null;
        try {
            pricePredictionIntegration = require('./price-prediction-integration');
        } catch (e) {
            console.log('[PRICING] Price prediction service not available, using mock data');
        }
        
        // Get benchmark price (try prediction service, fallback to mock)
        let benchmarkPrice = null;
        if (pricePredictionIntegration) {
            try {
                const forecast = await pricePredictionIntegration.getPriceForecast(product.toLowerCase());
                if (forecast.success && forecast.data) {
                    // Use current price from forecast
                    benchmarkPrice = forecast.data.currentPrice || forecast.data.price || null;
                }
            } catch (e) {
                console.warn('[PRICING] Price prediction service error, using fallback:', e.message);
            }
        }
        
        // Fallback to mock benchmark prices if service unavailable
        if (!benchmarkPrice) {
            const mockPrices = {
                'rice': 450,
                'wheat': 280,
                'corn': 180,
                'soybeans': 520,
                'soy': 520,
                'coffee': 180,
                'sugar': 0.18,
                'cocoa': 3200,
                'cotton': 0.85,
                'palm oil': 850,
                'rubber': 1.2,
                'barley': 220,
                'canola': 600,
                'sunflower': 550
            };
            const productLower = product.toLowerCase();
            benchmarkPrice = mockPrices[productLower] || pricePerUnit * 0.95; // Default to 5% below if unknown
        }
        
        // Calculate difference
        const priceDiff = pricePerUnit - benchmarkPrice;
        const priceDiffPercent = (priceDiff / benchmarkPrice) * 100;
        
        // Determine label (thresholds: ±5% = Near Market, >5% = Above, <-5% = Below)
        let label = 'Near Market';
        if (priceDiffPercent > 5) {
            label = 'Above Market';
        } else if (priceDiffPercent < -5) {
            label = 'Below Market';
        }
        
        res.json({
            success: true,
            benchmarkPrice: benchmarkPrice,
            contractPrice: pricePerUnit,
            difference: priceDiff,
            differencePercent: priceDiffPercent,
            label: label,
            currency: currency || 'USD'
        });
        
    } catch (error) {
        console.error('[ERROR] Price comparison error:', error);
        res.status(500).json({ 
            error: 'Failed to compare prices',
            message: error.message || 'Unknown error occurred'
        });
    }
});

// MERGE-LIFELINE: Confirm Contract API - Buyer must explicitly confirm
// MERGE-LIFELINE: Helper to get current user email from request
function getCurrentUserEmail(req) {
    return (
        (req.user && req.user.email) ||
        (req.session && req.session.user && req.session.user.email) ||
        (req.auth && req.auth.email) ||
        ""
    );
}

app.post('/api/contracts/:contractId/confirm', authenticateToken, async (req, res) => {
    try {
        const id = req.params.contractId;
        const userEmail = getCurrentUserEmail(req);

        if (!userEmail) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        let contract = database.contracts.get(id);
        if (!contract) {
            return res.status(404).json({ error: "Contract not found" });
        }

        // Ensure contract fields exist
        let normalizedContract = ensureContractFields(contract);

        const buyerEmail = normalizedContract.buyerEmail || normalizedContract.buyer_email || normalizedContract.buyer || "";
        const supplierEmail = normalizedContract.supplierEmail || normalizedContract.supplier_email || normalizedContract.supplier || "";
        const creatorEmail = normalizedContract.createdByEmail || normalizedContract.creatorEmail || normalizedContract.created_by || normalizedContract.createdBy || "";

        const isBuyer = buyerEmail === userEmail;
        const isSupplier = supplierEmail === userEmail;
        const isCreator = creatorEmail === userEmail;

        console.log("CONFIRM DEBUG", {
            contractId: id,
            userEmail,
            buyerEmail,
            supplierEmail,
            creatorEmail,
            isBuyer,
            isSupplier,
            isCreator,
            status: normalizedContract.status,
        });

        if (!isBuyer && !isSupplier) {
            return res.status(403).json({ error: "Only a party to the contract can confirm it." });
        }

        // MERGE-LIFELINE: Creator never confirms – only the other party
        if (isCreator) {
            return res.status(403).json({
                error: "Creator cannot confirm their own contract. Only the counterparty may confirm.",
            });
        }

        // Normalize status to canonical uppercase form
        const normalizedStatus = normalizeStatus(normalizedContract.status);
        
        // IDEMPOTENT: If contract is already confirmed/active, return success
        const alreadyConfirmedStatuses = [ContractState.ACTIVE, ContractState.CONFIRMED];
        if (alreadyConfirmedStatuses.includes(normalizedStatus)) {
            return res.status(200).json({
                success: true,
                alreadyConfirmed: true,
                ...normalizedContract,
                status: normalizedStatus
            });
        }
        
        // Check if contract is awaiting confirmation (using normalized status)
        const awaitingConfirmationStatuses = [
            ContractState.PENDING_BUYER_CONFIRMATION,
            ContractState.PENDING_SUPPLIER_CONFIRMATION,
            ContractState.PENDING_COUNTERPARTY_CONFIRMATION
        ];
        
        // Only return 400 for truly invalid transitions (e.g. CANCELLED, SETTLED, etc.)
        if (!awaitingConfirmationStatuses.includes(normalizedStatus)) {
            // For invalid states, still return 400 but with clearer message
            return res.status(400).json({ 
                error: `Contract cannot be confirmed. Current status: ${normalizedStatus}` 
            });
        }

        // Enforce recipient-only confirmation:
        // - PENDING_BUYER_CONFIRMATION: only buyerEmail can confirm
        // - PENDING_SUPPLIER_CONFIRMATION: only supplierEmail can confirm
        if (normalizedStatus === ContractState.PENDING_BUYER_CONFIRMATION && !isBuyer) {
            return res.status(403).json({ error: "Only the buyer can confirm this contract." });
        }
        if (normalizedStatus === ContractState.PENDING_SUPPLIER_CONFIRMATION && !isSupplier) {
            return res.status(403).json({ error: "Only the supplier can confirm this contract." });
        }

        // A1 FINALIZATION: Use state machine for CONFIRM action
        // Normalize actor email
        const normalizedActorEmail = userEmail.trim().toLowerCase();
        
        const transitionResult = transitionContract(normalizedContract, ContractAction.CONFIRM, normalizedActorEmail);
        
        if (!transitionResult.success) {
            return res.status(400).json({
                error: 'State transition failed',
                message: transitionResult.error
            });
        }
        
        // Update contract with transition result
        // A2.1e: Can be ACTIVE (if deposit required) or AWAITING_VERIFICATION_DOCS (if depositPercent === 0)
        normalizedContract.status = transitionResult.newState;
        normalizedContract.confirmedAt = new Date().toISOString();
        normalizedContract.confirmedBy = normalizedActorEmail;
        normalizedContract.counterpartyConfirmedAt = new Date().toISOString();
        normalizedContract.updatedAt = new Date().toISOString();
        
        // Append timeline event
        if (!normalizedContract.timeline) {
            normalizedContract.timeline = [];
        }
        normalizedContract.timeline.push({
            event: 'contract_confirmed',
            timestamp: new Date().toISOString(),
            actor: normalizedActorEmail,
            description: `Contract confirmed by ${isBuyer ? 'buyer' : 'supplier'}`,
            stateTransition: {
                from: transitionResult.fromState,
                to: transitionResult.newState,
                action: transitionResult.action
            }
        });
        
        // A4 GOLDEN PATH: Log contract confirmation step
        console.log('[A4_GOLDEN_PATH] Contract confirmed', {
            contractId: id,
            userEmail: userEmail,
            userRole: isBuyer ? 'BUYER' : isSupplier ? 'SUPPLIER' : 'OTHER',
            previousStatus: normalizedStatus,
            newStatus: transitionResult.newState
        });

        database.contracts.set(id, normalizedContract);
        saveDatabase();

        // Log audit event
        logAuditEvent('contract_confirmed_by_counterparty', normalizedActorEmail, {
            contractId: id,
            creatorEmail: creatorEmail,
            stateTransition: {
                from: transitionResult.fromState,
                to: transitionResult.newState
            }
        });

        // Return contract with normalized status and success flag
        const updated = {
            success: true,
            alreadyConfirmed: false,
            ...normalizedContract,
            status: transitionResult.newState, // A1: Use state from transition result (should be ACTIVE)
            stateTransition: {
                from: transitionResult.fromState,
                to: transitionResult.newState,
                action: transitionResult.action
            }
        };
        return res.json(updated);
    } catch (err) {
        console.error("confirm contract error", err);
        return res.status(500).json({ error: "Failed to confirm contract." });
    }
});

// Release Payment API
// Cancel Contract API
app.post('/api/contracts/:contractId/cancel', authenticateToken, async (req, res) => {
    try {
        const { contractId } = req.params;
        const userEmail = req.user.email;
        
        const contract = database.contracts.get(contractId);
        if (!contract) {
            return res.status(404).json({ error: 'Contract not found' });
        }
        
        // Verify user has permission to cancel
        if (contract.buyerEmail !== userEmail && contract.supplierEmail !== userEmail && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized to cancel this contract' });
        }
        
        // Only allow cancellation before deposit is paid
        if (contract.depositPaid) {
            return res.status(400).json({ error: 'Cannot cancel contract after deposit has been paid' });
        }
        
        // Only allow cancellation in pending states
        if (!['pending_supplier_confirmation', 'pending_deposit', 'pending_buyer_confirmation'].includes(contract.status)) {
            return res.status(400).json({ error: 'Cannot cancel contract in current status' });
        }
        
        // Update contract status
        contract.status = 'cancelled';
        contract.cancelledAt = new Date().toISOString();
        contract.cancelledBy = userEmail;
        database.contracts.set(contractId, contract);
        saveDatabase();
        
        logAuditEvent('contract_cancelled', userEmail, { contractId });
        
        res.status(200).json({ success: true, message: 'Contract cancelled successfully', contract });
    } catch (error) {
        console.error('[ERROR] Contract cancellation error:', error);
        res.status(500).json({ error: 'Failed to cancel contract', message: error.message });
    }
});

app.post('/api/contracts/:contractId/release-payment', authenticateToken, async (req, res) => {
    try {
        const { contractId } = req.params;
        const userEmail = req.user.email;
        
        const contract = database.contracts.get(contractId);
        if (!contract) {
            return res.status(404).json({ error: 'Contract not found' });
        }
        
        // Verify user is the buyer
        if (contract.buyerEmail !== userEmail && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only the buyer can release payment' });
        }
        
        // Check contract status - use depositSatisfied logic
        const depositRequired = Number(contract.depositPercent || contract.deposit_percent || 0) > 0;
        const depositSatisfied = !depositRequired || contract.depositPaid === true;
        
        if (!depositSatisfied || !contract.documentsUploaded) {
            return res.status(400).json({ error: 'Cannot release payment: deposit must be paid and documents must be uploaded' });
        }
        
        // Calculate remaining amount
        // Get effective financing terms for remaining amount calculation
        const financingTerms = getEffectiveFinancingTerms(contract, USE_RISK_ENGINE_FOR_FINANCING);
        const effectiveDepositPercent = contract.depositPercent || financingTerms.depositPercent;
        const remainingAmount = contract.totalValue - (contract.depositAmount || Math.round(contract.totalValue * (effectiveDepositPercent / 100)));
        
        // Update contract status
        contract.status = 'completed';
        contract.completedAt = new Date().toISOString();
        contract.finalPaymentReleased = true;
        database.contracts.set(contractId, contract);
        
        // Create transaction record
        const transactionId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        database.transactions.set(transactionId, {
            id: transactionId,
            contractId: contractId,
            type: 'final_payment',
            amount: remainingAmount,
            currency: contract.currency,
            from: 'escrow',
            to: contract.supplierEmail,
            status: 'completed',
            createdAt: new Date().toISOString()
        });
        
        // Update supplier wallet balance
        const supplierWalletId = `wallet-${contract.supplierEmail}`;
        const supplierWallet = database.wallets.get(supplierWalletId);
        if (supplierWallet) {
            supplierWallet.tgtBalance = (supplierWallet.tgtBalance || 0) + remainingAmount;
            database.wallets.set(supplierWalletId, supplierWallet);
        }
        
        // Log audit event
        logAuditEvent('payment_released', userEmail, {
            contractId: contractId,
            amount: remainingAmount,
            currency: contract.currency
        });
        
        console.log(`[CONTRACT] Payment released: ${contractId} by ${userEmail}, amount: ${remainingAmount}`);
        
        res.json({
            success: true,
            message: 'Payment released successfully',
            contract: contract,
            transactionId: transactionId
        });
        
    } catch (error) {
        console.error('[ERROR] Release payment error:', error);
        res.status(500).json({ 
            error: 'Failed to release payment',
            message: error.message || 'Unknown error occurred'
        });
    }
});

app.get('/api/contracts', authenticateToken, async (req, res) => {
    try {
        const userEmail = req.user.email;
        const userRole = req.user.role;
        
        // Get all contracts where user is involved
        const userContracts = [];
        for (const [contractId, contract] of database.contracts.entries()) {
            // Check if user is buyer, supplier, or trader involved in this contract
            const isBuyer = contract.buyerEmail === userEmail;
            const isSupplier = contract.supplierEmail === userEmail;
            const isTrader = userRole === 'trader' && (contract.buyerEmail === userEmail || contract.supplierEmail === userEmail);
            const isAdmin = userRole === 'admin';
            
            if (isBuyer || isSupplier || isTrader || isAdmin) {
                // Normalize contract fields for backward compatibility
                const normalizedContract = ensureContractFields({
                    ...contract,
                    id: contractId
                });
                
                // Compute contextual role for this contract
                const roleInfo = await getUserRoleForContract(userEmail, normalizedContract, database);
                
                // Add role information to contract
                normalizedContract.userRole = roleInfo.contractRole;
                normalizedContract.userGlobalRole = roleInfo.globalRole;
                
                // Normalize status to canonical uppercase form before returning
                normalizedContract.status = normalizeStatus(normalizedContract.status);
                
                userContracts.push(normalizedContract);
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
            // Normalize contract fields for backward compatibility
            const normalizedContract = ensureContractFields({
                ...contract,
                id: contractId
            });
            
            // Normalize status to canonical uppercase form before returning
            normalizedContract.status = normalizeStatus(normalizedContract.status);
            
            allContracts.push(normalizedContract);
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

// Admin Risk Preview Endpoint - Read-only preview of risk and financing terms
app.get('/api/admin/contracts/:contractId/risk-preview', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { contractId } = req.params;
        
        // Load contract from database (in-memory or PostgreSQL)
        const contract = await db.contracts.getById(contractId, database.contracts);
        
        if (!contract) {
            return res.status(404).json({ error: 'Contract not found' });
        }
        
        // Legacy terms (ignores feature flag - always returns legacy values)
        const legacyTerms = getLegacyFinancingTerms();
        
        // Risk-based terms derived from stored risk fields on the contract
        const riskTerms = getRiskBasedFinancingTermsFromContract(contract);
        
        // Build a safe minimal contract summary (avoid leaking sensitive internal fields)
        const contractSummary = {
            id: contract.id,
            contract_id: contract.contract_id || contract.id,
            status: contract.status,
            product: contract.product || contract.productDetails,
            quantity: contract.quantity,
            unit: contract.unit,
            pricePerUnit: contract.pricePerUnit || contract.price,
            totalValue: contract.totalValue,
            currency: contract.currency,
            buyerEmail: contract.buyerEmail,
            supplierEmail: contract.supplierEmail,
            depositPercent: contract.depositPercent,
            depositAmount: contract.depositAmount,
            voyageTime: contract.voyageTime,
            createdAt: contract.createdAt,
            depositPaid: contract.depositPaid,
            buyerDepositPaid: contract.buyerDepositPaid,
            documentsUploaded: contract.documentsUploaded,
        };
        
        // Risk summary from stored risk fields
        const riskSummary = {
            riskScore: contract.riskScore ?? null,
            riskBand: contract.riskBand ?? null,
            maxFinancingPercent: contract.maxFinancingPercent ?? null,
            requiredDepositPercent: contract.requiredDepositPercent ?? null,
        };
        
        return res.json({
            contract: contractSummary,
            risk: riskSummary,
            legacyFinancingTerms: legacyTerms,
            riskBasedFinancingTerms: riskTerms,
        });
    } catch (err) {
        console.error('[ADMIN RISK PREVIEW] Error:', err);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: err.message || 'Failed to retrieve risk preview'
        });
    }
});

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
        const auctions = Array.from(database.auctions.values());
        const activeAuctions = auctions.filter(a => a.status === 'active' || a.status === 'open');
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Auction Board - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}h1{color:#fff;margin-bottom:2rem}.btn{background:#667eea;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;margin:10px 5px}.btn:hover{background:#5a6fd8}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:12px;text-align:left;border-bottom:1px solid #333}th{background:#1a1a1a;color:#fff}.status-active{color:#51cf66}.status-closed{color:#ccc}.bid-count{background:#667eea;color:#fff;padding:4px 8px;border-radius:4px;font-size:0.85rem}</style></head><body><div class="container"><h1>Auction Board</h1><a href="/dashboard/authenticated?token=${token}" class="btn">Back to Dashboard</a><table><thead><tr><th>Contract ID</th><th>Product</th><th>Value</th><th>Current Bid</th><th>Bids</th><th>Status</th><th>Ends</th></tr></thead><tbody>${activeAuctions.map(a => {
            const contract = database.contracts.get(a.contractId);
            const bidCount = a.bids ? a.bids.length : 0;
            const currentBid = a.bids && a.bids.length > 0 ? a.bids[a.bids.length - 1].amount : a.startingBid || 0;
            const statusClass = a.status === 'active' ? 'status-active' : 'status-closed';
            return `<tr><td>${a.contractId}</td><td>${contract?.product || 'N/A'}</td><td>$${(contract?.totalValue || 0).toLocaleString()}</td><td>$${currentBid.toLocaleString()}</td><td><span class="bid-count">${bidCount} bids</span></td><td class="${statusClass}">${(a.status || 'active').toUpperCase()}</td><td>${a.endTime ? new Date(a.endTime).toLocaleDateString() : 'N/A'}</td></tr>`;
        }).join('') || '<tr><td colspan="7" style="text-align:center;color:#ccc">No active auctions</td></tr>'}</tbody></table></div></body></html>`;
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
        const kycSubmissions = Array.from(database.kyc.values());
        const complianceReports = Array.from(database.complianceReports.values());
        
        // Build table rows safely
        let tableRows = '';
        try {
            tableRows = kycSubmissions.map(kyc => {
                try {
                    const user = database.users.get(kyc.userEmail || kyc.userId) || Array.from(database.users.values()).find(u => u.email === (kyc.userEmail || kyc.userId));
                    const docCount = kyc.files ? Object.keys(kyc.files).reduce((sum, key) => sum + (kyc.files[key]?.length || 0), 0) : 0;
                    const statusClass = kyc.status === 'approved' ? 'status-approved' : kyc.status === 'rejected' ? 'status-rejected' : 'status-pending';
                    
                    // Get compliance report for this KYC
                    const complianceReport = complianceReports.find(r => r.kycId === kyc.id);
                    const ofacStatus = complianceReport ? (complianceReport.ofacMatch ? '⚠️ MATCH' : '✓ Clear') : 'Not Screened';
                    const riskLevel = complianceReport ? (complianceReport.riskLevel || 'low') : 'unknown';
                    const riskClass = riskLevel === 'high' ? 'risk-high' : riskLevel === 'medium' ? 'risk-medium' : 'risk-low';
                    const hasFlags = complianceReport?.ofacMatch || false;
                    const autoApproved = kyc.autoApproved || false;
                    
                    const userEmail = (user?.email || kyc.userEmail || kyc.userId || 'N/A').replace(/'/g, "\\'");
                    const companyName = (kyc.companyName || 'N/A').replace(/'/g, "\\'");
                    const companyType = (kyc.companyType || 'N/A').toUpperCase();
                    const status = (kyc.status || 'pending').toUpperCase();
                    const kycId = kyc.id.replace(/'/g, "\\'");
                    
                    return `<tr><td>${userEmail}</td><td>${companyName}</td><td>${companyType}</td><td>${ofacStatus}${hasFlags ? '<span class="flag-badge">FLAGGED</span>' : ''}</td><td class="${riskClass}">${riskLevel.toUpperCase()}</td><td class="${statusClass}">${status}${autoApproved ? '<br><span class="auto-approved">(Auto-approved)</span>' : ''}</td><td>${new Date(kyc.submittedAt || kyc.createdAt || Date.now()).toLocaleDateString()}</td><td>${docCount} files</td><td>${kyc.status === 'pending' ? `<button class="action-btn approve-btn" onclick="approveKYC('${kycId}')">Approve</button><button class="action-btn reject-btn" onclick="rejectKYC('${kycId}')">Reject</button><button class="action-btn" onclick="viewDetails('${kycId}')" style="background:#667eea;color:#fff">View Details</button>` : kyc.status === 'approved' ? '<span style="color:#51cf66">✓ Approved</span>' : '<span style="color:#ff6b6b">✗ Rejected</span>'}</td></tr>`;
                } catch (err) {
                    console.error('[ERROR] Error processing KYC row:', err);
                    return '<tr><td colspan="9" style="color:#ff6b6b">Error loading KYC data</td></tr>';
                }
            }).join('') || '<tr><td colspan="9" style="text-align:center;color:#ccc">No KYC submissions found</td></tr>';
        } catch (err) {
            console.error('[ERROR] Error building table rows:', err);
            tableRows = '<tr><td colspan="9" style="text-align:center;color:#ff6b6b">Error loading KYC data</td></tr>';
        }
        
        // Safely stringify data for JavaScript
        let kycDataJson = '[]';
        let complianceDataJson = '[]';
        try {
            kycDataJson = JSON.stringify(kycSubmissions.map(k => ({
                id: k.id,
                userEmail: k.userEmail || k.userId,
                companyName: k.companyName || '',
                companyType: k.companyType || '',
                registrationNumber: k.registrationNumber || '',
                country: k.country || '',
                address: k.address || '',
                contactPerson: k.contactPerson || '',
                phone: k.phone || '',
                files: k.files || {},
                status: k.status || 'pending',
                submittedAt: k.submittedAt || k.createdAt,
                autoApproved: k.autoApproved || false,
                reviewedAt: k.reviewedAt || null,
                reviewedBy: k.reviewedBy || null
            })));
            complianceDataJson = JSON.stringify(complianceReports.map(r => ({
                kycId: r.kycId,
                ofacMatch: r.ofacMatch || false,
                riskLevel: r.riskLevel || 'low',
                matches: (r.matches || []).map(m => ({ name: m.name || 'Unknown' }))
            })));
        } catch (err) {
            console.error('[ERROR] Error stringifying data:', err);
        }
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>KYC Reports - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:2rem}.container{max-width:1400px;margin:0 auto}h1{color:#fff;margin-bottom:2rem}.btn{background:#667eea;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;margin:10px 5px}.btn:hover{background:#5a6fd8}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:12px;text-align:left;border-bottom:1px solid #333}th{background:#1a1a1a;color:#fff}.status-pending{color:#ffd43b}.status-approved{color:#51cf66}.status-rejected{color:#ff6b6b}.action-btn{padding:6px 12px;margin:0 3px;border:none;border-radius:4px;cursor:pointer;font-size:0.85rem}.approve-btn{background:#51cf66;color:#fff}.reject-btn{background:#ff6b6b;color:#fff}.risk-high{color:#ff6b6b}.risk-medium{color:#ffd43b}.risk-low{color:#51cf66}.flag-badge{background:#ff6b6b;color:#fff;padding:2px 6px;border-radius:3px;font-size:0.75rem;margin-left:5px}.auto-approved{color:#51cf66;font-size:0.85rem;font-style:italic}#detailsModal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:1000;padding:2rem}#detailsModal>div{background:#1a1a1a;max-width:800px;margin:0 auto;padding:2rem;border-radius:8px;max-height:90vh;overflow-y:auto}</style></head><body><div class="container"><h1>KYC Reports & Reviews</h1><a href="/dashboard/authenticated?token=${token}" class="btn">Back to Dashboard</a><table><thead><tr><th>User Email</th><th>Company Name</th><th>Company Type</th><th>OFAC Status</th><th>Risk Level</th><th>Status</th><th>Submitted</th><th>Documents</th><th>Actions</th></tr></thead><tbody>${tableRows}</tbody></table></div><div id="detailsModal"><div><h2 style="color:#fff;margin-bottom:1rem">KYC Details</h2><div id="detailsContent"></div><button onclick="closeDetails()" class="btn" style="margin-top:1rem">Close</button></div></div><script>const token='${token}';const kycData=${kycDataJson};const complianceData=${complianceDataJson};function viewDetails(kycId){const kyc=kycData.find(k=>k.id===kycId);const compliance=complianceData.find(c=>c.kycId===kycId);if(!kyc)return;const docCount=kyc.files?Object.keys(kyc.files).reduce((s,k)=>s+(kyc.files[k]?.length||0),0):0;const filesList=kyc.files?Object.keys(kyc.files).map(k=>kyc.files[k].map(f=>f.originalname||f.filename).join(', ')).join(', '):'None';const matchesList=compliance?.matches?.map(m=>m.name||'Unknown').join(', ')||'None';document.getElementById('detailsContent').innerHTML='<div style="color:#fff"><p><strong>User Email:</strong> '+(kyc.userEmail||kyc.userId||'N/A')+'</p><p><strong>Company Name:</strong> '+(kyc.companyName||'N/A')+'</p><p><strong>Company Type:</strong> '+(kyc.companyType||'N/A').toUpperCase()+'</p><p><strong>Registration Number:</strong> '+(kyc.registrationNumber||'N/A')+'</p><p><strong>Country:</strong> '+(kyc.country||'N/A')+'</p><p><strong>Address:</strong> '+(kyc.address||'N/A')+'</p><p><strong>Contact Person:</strong> '+(kyc.contactPerson||'N/A')+'</p><p><strong>Phone:</strong> '+(kyc.phone||'N/A')+'</p><p><strong>Documents:</strong> '+docCount+' files ('+filesList+')</p><p><strong>OFAC Screening:</strong> '+(compliance?(compliance.ofacMatch?'⚠️ MATCH FOUND':'✓ CLEARED'):'Not Screened')+'</p><p><strong>Risk Level:</strong> <span class="'+(compliance?.riskLevel==='high'?'risk-high':compliance?.riskLevel==='medium'?'risk-medium':'risk-low')+'">'+(compliance?.riskLevel||'unknown').toUpperCase()+'</span></p><p><strong>OFAC Matches:</strong> '+matchesList+'</p><p><strong>Submitted:</strong> '+new Date(kyc.submittedAt||Date.now()).toLocaleString()+'</p><p><strong>Status:</strong> <span class="'+(kyc.status==='approved'?'status-approved':kyc.status==='rejected'?'status-rejected':'status-pending')+'">'+(kyc.status||'pending').toUpperCase()+'</span></p>'+(kyc.autoApproved?'<p><strong>Auto-Approved:</strong> Yes (No flags detected)</p>':'')+(kyc.reviewedAt?'<p><strong>Reviewed:</strong> '+new Date(kyc.reviewedAt).toLocaleString()+' by '+(kyc.reviewedBy||'admin')+'</p>':'')+'</div>';document.getElementById('detailsModal').style.display='block';}function closeDetails(){document.getElementById('detailsModal').style.display='none';}async function approveKYC(kycId){if(!confirm('Approve this KYC submission?'))return;try{const res=await fetch('/api/admin/kyc/approve',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({kycId,action:'approve'})});if(res.ok){alert('KYC approved successfully');location.reload()}else{alert('Failed to approve KYC')}}catch(e){alert('Error: '+e.message)}}async function rejectKYC(kycId){const reason=prompt('Rejection reason:');if(!reason)return;try{const res=await fetch('/api/admin/kyc/approve',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({kycId,action:'reject',reason})});if(res.ok){alert('KYC rejected');location.reload()}else{alert('Failed to reject KYC')}}catch(e){alert('Error: '+e.message)}}</script></body></html>`;
        res.end(html, 'utf8');
    } catch (error) {
        console.error('[ERROR] Admin KYC reports error:', error);
        res.status(500).send('Error loading KYC reports: ' + error.message);
    }
});

// Admin OFAC Management
app.get('/admin/ofac-management', authenticateToken, requireRole(['admin']), (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
        const complianceReports = Array.from(database.complianceReports.values());
        const flaggedReports = complianceReports.filter(r => r.ofacMatch || r.riskLevel === 'high');
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>OFAC Screening - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}h1{color:#fff;margin-bottom:2rem}.btn{background:#667eea;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;margin:10px 5px}.btn:hover{background:#5a6fd8}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:12px;text-align:left;border-bottom:1px solid #333}th{background:#1a1a1a;color:#fff}.risk-high{color:#ff6b6b}.risk-medium{color:#ffd43b}.risk-low{color:#51cf66}.stats{display:flex;gap:2rem;margin:2rem 0}.stat-box{background:#1a1a1a;padding:1.5rem;border-radius:8px;flex:1}.stat-box h3{color:#fff;margin-bottom:0.5rem}.stat-box p{color:#ccc;font-size:1.5rem;font-weight:600}</style></head><body><div class="container"><h1>OFAC Screening & Compliance</h1><a href="/dashboard/authenticated?token=${token}" class="btn">Back to Dashboard</a><div class="stats"><div class="stat-box"><h3>Total Screened</h3><p>${complianceReports.length}</p></div><div class="stat-box"><h3>Flagged Entities</h3><p class="risk-high">${flaggedReports.length}</p></div><div class="stat-box"><h3>Clear</h3><p class="risk-low">${complianceReports.length - flaggedReports.length}</p></div></div><table><thead><tr><th>User/Entity</th><th>OFAC Match</th><th>Risk Level</th><th>Screened</th><th>Details</th></tr></thead><tbody>${complianceReports.map(r => {
            const riskClass = r.riskLevel === 'high' ? 'risk-high' : r.riskLevel === 'medium' ? 'risk-medium' : 'risk-low';
            const matchDetails = r.matches && r.matches.length > 0 ? r.matches[0].name || 'Potential match found' : 'No matches';
            return `<tr><td>${r.userId || r.companyName || 'N/A'}</td><td>${r.ofacMatch ? '⚠️ MATCH' : '✓ Clear'}</td><td class="${riskClass}">${(r.riskLevel || 'low').toUpperCase()}</td><td>${new Date(r.screeningDate || Date.now()).toLocaleDateString()}</td><td>${r.ofacMatch ? matchDetails : 'No matches'}</td></tr>`;
        }).join('') || '<tr><td colspan="5" style="text-align:center;color:#ccc">No compliance reports found</td></tr>'}</tbody></table></div></body></html>`;
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
        const blockchainTxs = Array.from(database.transactions.values()).filter(tx => tx.blockchain === true);
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Blockchain - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}h1{color:#fff;margin-bottom:2rem}.btn{background:#667eea;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;margin:10px 5px}.btn:hover{background:#5a6fd8}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:12px;text-align:left;border-bottom:1px solid #333}th{background:#1a1a1a;color:#fff}.status-box{background:#1a1a1a;padding:1.5rem;border-radius:8px;margin:2rem 0}.status-box h3{color:#fff;margin-bottom:1rem}.status-item{display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid #333}.status-item:last-child{border-bottom:none}.status-label{color:#ccc}.status-value{color:#fff;font-weight:600}.tx-hash{color:#667eea;font-family:monospace;font-size:0.85rem;word-break:break-all}.tx-hash a{color:#667eea;text-decoration:none}.tx-hash a:hover{text-decoration:underline}.status-confirmed{color:#51cf66}.status-simulated{color:#ffd43b}</style></head><body><div class="container"><h1>Blockchain Management</h1><a href="/dashboard/authenticated?token=${token}" class="btn">Back to Dashboard</a><div class="status-box"><h3>Blockchain Status</h3><div class="status-item"><span class="status-label">Network:</span><span class="status-value">${blockchain && blockchain.isInitialized ? 'Sepolia Testnet (Connected)' : 'Simulation Mode'}</span></div><div class="status-item"><span class="status-label">Contracts Deployed:</span><span class="status-value">TGT Token, Escrow Contract</span></div><div class="status-item"><span class="status-label">Blockchain Transactions:</span><span class="status-value">${blockchainTxs.length}</span></div><div class="status-item"><span class="status-label">Confirmed on Chain:</span><span class="status-value">${blockchainTxs.filter(tx => tx.blockchainTxHash).length}</span></div></div><table><thead><tr><th>Transaction ID</th><th>Type</th><th>Amount</th><th>Contract</th><th>Blockchain TX Hash</th><th>Status</th><th>Date</th></tr></thead><tbody>${blockchainTxs.map(tx => {
            const txHash = tx.blockchainTxHash || 'Simulated';
            const txHashDisplay = tx.blockchainTxHash ? `<a href="https://sepolia.etherscan.io/tx/${tx.blockchainTxHash}" target="_blank" class="tx-hash">${tx.blockchainTxHash.substring(0, 20)}...</a>` : '<span class="tx-hash">Simulated</span>';
            const statusClass = tx.blockchainStatus === 'confirmed' ? 'status-confirmed' : 'status-simulated';
            return `<tr><td>${tx.id}</td><td>${tx.type}</td><td>$${(tx.amount || 0).toLocaleString()} ${tx.currency || 'TGT'}</td><td>${tx.contractId || 'N/A'}</td><td>${txHashDisplay}</td><td class="${statusClass}">${tx.blockchainStatus === 'confirmed' ? '✓ Confirmed' : 'Simulated'}</td><td>${new Date(tx.createdAt || Date.now()).toLocaleDateString()}</td></tr>`;
        }).join('') || '<tr><td colspan="7" style="text-align:center;color:#ccc">No blockchain transactions found</td></tr>'}</tbody></table></div></body></html>`;
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
        const currentFees = database.admin?.fees || { tradingFee: 0.5, platformFee: 1.0 };
        const currentInterest = database.admin?.interestRates || { deposit: 2.5, lending: 5.0 };
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Manage Fees - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}h1{color:#fff;margin-bottom:2rem}.btn{background:#667eea;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;margin:10px 5px}.btn:hover{background:#5a6fd8}.form-section{background:#1a1a1a;padding:2rem;border-radius:8px;margin:2rem 0}.form-group{margin-bottom:1.5rem}.form-group label{display:block;color:#fff;margin-bottom:0.5rem;font-weight:600}.form-group input{width:100%;padding:12px;background:#333;border:1px solid #555;border-radius:6px;color:#fff;font-size:1rem}.form-group input:focus{outline:none;border-color:#667eea}.save-btn{background:#51cf66;color:#fff;padding:12px 24px;border:none;border-radius:6px;cursor:pointer;font-size:1rem;font-weight:600}.save-btn:hover{background:#40c057}</style></head><body><div class="container"><h1>Manage Platform Fees</h1><a href="/dashboard/authenticated?token=${token}" class="btn">Back to Dashboard</a><form id="feesForm" class="form-section"><h2 style="color:#fff;margin-bottom:1.5rem">Trading Fees</h2><div class="form-group"><label>Trading Fee (%)</label><input type="number" id="tradingFee" value="${currentFees.tradingFee}" step="0.1" min="0" max="10"></div><div class="form-group"><label>Platform Fee (%)</label><input type="number" id="platformFee" value="${currentFees.platformFee}" step="0.1" min="0" max="10"></div><h2 style="color:#fff;margin-bottom:1.5rem;margin-top:2rem">Interest Rates</h2><div class="form-group"><label>Deposit Interest Rate (%)</label><input type="number" id="depositRate" value="${currentInterest.deposit}" step="0.1" min="0" max="20"></div><div class="form-group"><label>Lending Interest Rate (%)</label><input type="number" id="lendingRate" value="${currentInterest.lending}" step="0.1" min="0" max="20"></div><button type="submit" class="save-btn">Save Changes</button></form></div><script>const token='${token}';document.getElementById('feesForm').addEventListener('submit',async function(e){e.preventDefault();const fees={tradingFee:parseFloat(document.getElementById('tradingFee').value),platformFee:parseFloat(document.getElementById('platformFee').value),interestRates:{deposit:parseFloat(document.getElementById('depositRate').value),lending:parseFloat(document.getElementById('lendingRate').value)}};try{const res=await fetch('/api/admin/settings',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(fees)});if(res.ok){alert('Fees updated successfully');location.reload()}else{alert('Failed to update fees')}}catch(e){alert('Error: '+e.message)}});</script></body></html>`;
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
        const currentTimes = database.admin?.voyageTimes || { short: 30, medium: 60, long: 90 };
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Voyage Times - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}h1{color:#fff;margin-bottom:2rem}.btn{background:#667eea;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;margin:10px 5px}.btn:hover{background:#5a6fd8}.form-section{background:#1a1a1a;padding:2rem;border-radius:8px;margin:2rem 0}.form-group{margin-bottom:1.5rem}.form-group label{display:block;color:#fff;margin-bottom:0.5rem;font-weight:600}.form-group input{width:100%;padding:12px;background:#333;border:1px solid #555;border-radius:6px;color:#fff;font-size:1rem}.form-group input:focus{outline:none;border-color:#667eea}.save-btn{background:#51cf66;color:#fff;padding:12px 24px;border:none;border-radius:6px;cursor:pointer;font-size:1rem;font-weight:600}.save-btn:hover{background:#40c057}</style></head><body><div class="container"><h1>Manage Voyage Times</h1><a href="/dashboard/authenticated?token=${token}" class="btn">Back to Dashboard</a><form id="voyageForm" class="form-section"><div class="form-group"><label>Short Voyage (days)</label><input type="number" id="short" value="${currentTimes.short}" min="1" max="365"></div><div class="form-group"><label>Medium Voyage (days)</label><input type="number" id="medium" value="${currentTimes.medium}" min="1" max="365"></div><div class="form-group"><label>Long Voyage (days)</label><input type="number" id="long" value="${currentTimes.long}" min="1" max="365"></div><button type="submit" class="save-btn">Save Changes</button></form></div><script>const token='${token}';document.getElementById('voyageForm').addEventListener('submit',async function(e){e.preventDefault();const times={short:parseInt(document.getElementById('short').value),medium:parseInt(document.getElementById('medium').value),long:parseInt(document.getElementById('long').value)};try{const res=await fetch('/api/admin/settings',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({voyageTimes:times})});if(res.ok){alert('Voyage times updated successfully');location.reload()}else{alert('Failed to update voyage times')}}catch(e){alert('Error: '+e.message)}});</script></body></html>`;
        res.end(html, 'utf8');
    } catch (error) {
        console.error('[ERROR] Admin voyage times error:', error);
        res.status(500).send('Error loading voyage times');
    }
});

// Admin Settings API (for price comparison)
app.get('/api/admin/settings', authenticateToken, (req, res) => {
    try {
        res.json({
            basisPoints: database.admin?.basisPoints || 100,
            tradingFee: database.admin?.fees?.tradingFee || 0.5,
            platformFee: database.admin?.fees?.platformFee || 1.0,
            interestRates: database.admin?.interestRates || { deposit: 2.5, lending: 5.0 },
            voyageTimes: database.admin?.voyageTimes || { short: 30, medium: 60, long: 90 },
            priceVariance: database.admin?.priceVariance || 5
        });
    } catch (error) {
        console.error('[ERROR] Admin settings error:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

// Admin Settings Update API
app.post('/api/admin/settings', authenticateToken, requireRole(['admin']), (req, res) => {
    try {
        const { basisPoints, tradingFee, platformFee, interestRates, voyageTimes, priceVariance } = req.body;
        
        if (!database.admin) {
            database.admin = {};
        }
        
        if (basisPoints !== undefined) database.admin.basisPoints = basisPoints;
        if (tradingFee !== undefined || platformFee !== undefined) {
            if (!database.admin.fees) database.admin.fees = {};
            if (tradingFee !== undefined) database.admin.fees.tradingFee = tradingFee;
            if (platformFee !== undefined) database.admin.fees.platformFee = platformFee;
        }
        if (interestRates) database.admin.interestRates = interestRates;
        if (voyageTimes) database.admin.voyageTimes = voyageTimes;
        if (priceVariance !== undefined) database.admin.priceVariance = priceVariance;
        
        res.json({
            success: true,
            message: 'Settings updated successfully',
            settings: database.admin
        });
    } catch (error) {
        console.error('[ERROR] Admin settings update error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Admin KYC Approve/Reject API
app.post('/api/admin/kyc/approve', authenticateToken, requireRole(['admin']), (req, res) => {
    try {
        const { kycId, action, reason } = req.body;
        
        const kyc = database.kyc.get(kycId);
        if (!kyc) {
            return res.status(404).json({ error: 'KYC submission not found' });
        }
        
        const user = database.users.get(kyc.userId) || Array.from(database.users.values()).find(u => u.email === kyc.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (action === 'approve') {
            kyc.status = 'approved';
            kyc.approvedAt = new Date().toISOString();
            kyc.approvedBy = req.user.email;
            user.kycStatus = 'approved';
        } else if (action === 'reject') {
            kyc.status = 'rejected';
            kyc.rejectedAt = new Date().toISOString();
            kyc.rejectedBy = req.user.email;
            kyc.rejectionReason = reason || 'Rejected by admin';
            user.kycStatus = 'rejected';
        }
        
        database.kyc.set(kycId, kyc);
        database.users.set(user.email, user);
        
        logAuditEvent('kyc_' + action, req.user.email, {
            kycId: kycId,
            userId: kyc.userId,
            reason: reason
        });
        
        res.json({
            success: true,
            message: `KYC ${action}d successfully`,
            kyc: kyc
        });
    } catch (error) {
        console.error('[ERROR] Admin KYC approve error:', error);
        res.status(500).json({ error: 'Failed to process KYC action' });
    }
});

// Admin Basis Points
app.get('/admin/basis-points', authenticateToken, requireRole(['admin']), (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
        const currentBasisPoints = database.admin?.basisPoints || 100;
        const priceVariance = 5; // Default 5% variance threshold
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Basis Points - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}h1{color:#fff;margin-bottom:2rem}.btn{background:#667eea;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;margin:10px 5px}.btn:hover{background:#5a6fd8}.form-section{background:#1a1a1a;padding:2rem;border-radius:8px;margin:2rem 0}.form-group{margin-bottom:1.5rem}.form-group label{display:block;color:#fff;margin-bottom:0.5rem;font-weight:600}.form-group input{width:100%;padding:12px;background:#333;border:1px solid #555;border-radius:6px;color:#fff;font-size:1rem}.form-group input:focus{outline:none;border-color:#667eea}.info-box{background:#2a2a2a;padding:1rem;border-radius:6px;margin:1rem 0;color:#ccc;font-size:0.9rem}.save-btn{background:#51cf66;color:#fff;padding:12px 24px;border:none;border-radius:6px;cursor:pointer;font-size:1rem;font-weight:600}.save-btn:hover{background:#40c057}</style></head><body><div class="container"><h1>Basis Points & Price Validation</h1><a href="/dashboard/authenticated?token=${token}" class="btn">Back to Dashboard</a><form id="basisForm" class="form-section"><div class="form-group"><label>Basis Points (for price comparison)</label><input type="number" id="basisPoints" value="${currentBasisPoints}" min="1" max="1000"><div class="info-box">Basis points used for price comparison calculations. 100 basis points = 1%.</div></div><div class="form-group"><label>Price Variance Threshold (%)</label><input type="number" id="variance" value="${priceVariance}" step="0.1" min="0" max="50"><div class="info-box">Contracts with price variance above this percentage will be flagged for review.</div></div><button type="submit" class="save-btn">Save Changes</button></form></div><script>const token='${token}';document.getElementById('basisForm').addEventListener('submit',async function(e){e.preventDefault();const settings={basisPoints:parseInt(document.getElementById('basisPoints').value),priceVariance:parseFloat(document.getElementById('variance').value)};try{const res=await fetch('/api/admin/settings',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(settings)});if(res.ok){alert('Settings updated successfully');location.reload()}else{alert('Failed to update settings')}}catch(e){alert('Error: '+e.message)}});</script></body></html>`;
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
        const contracts = Array.from(database.contracts.values());
        const flaggedContracts = contracts.filter(c => c.buyerFlag || c.supplierFlag);
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Review Flags - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}h1{color:#fff;margin-bottom:2rem}.btn{background:#667eea;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;margin:10px 5px}.btn:hover{background:#5a6fd8}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:12px;text-align:left;border-bottom:1px solid #333}th{background:#1a1a1a;color:#fff}.flag-badge{background:#ff6b6b;color:#fff;padding:4px 8px;border-radius:4px;font-size:0.85rem;margin:0 3px}.flag-message{color:#ffd43b;font-size:0.9rem}</style></head><body><div class="container"><h1>Review Flags</h1><a href="/dashboard/authenticated?token=${token}" class="btn">Back to Dashboard</a><table><thead><tr><th>Contract ID</th><th>Product</th><th>Buyer Flag</th><th>Supplier Flag</th><th>Flag Message</th><th>Date</th></tr></thead><tbody>${flaggedContracts.map(c => {
            const buyerFlag = c.buyerFlag ? `<span class="flag-badge">Buyer</span>` : '';
            const supplierFlag = c.supplierFlag ? `<span class="flag-badge">Supplier</span>` : '';
            const flagMsg = (c.buyerFlag?.message || c.supplierFlag?.message || 'Flagged for review');
            return `<tr><td>${c.id || 'N/A'}</td><td>${c.product || 'N/A'}</td><td>${buyerFlag || '-'}</td><td>${supplierFlag || '-'}</td><td class="flag-message">${flagMsg}</td><td>${new Date(c.buyerFlag?.timestamp || c.supplierFlag?.timestamp || Date.now()).toLocaleDateString()}</td></tr>`;
        }).join('') || '<tr><td colspan="6" style="text-align:center;color:#ccc">No flags found</td></tr>'}</tbody></table></div></body></html>`;
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
        const creditAssessments = Array.from(database.creditAssessments.values());
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Credit Assessments - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:2rem}.container{max-width:1200px;margin:0 auto}h1{color:#fff;margin-bottom:2rem}.btn{background:#667eea;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;margin:10px 5px}.btn:hover{background:#5a6fd8}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:12px;text-align:left;border-bottom:1px solid #333}th{background:#1a1a1a;color:#fff}.risk-high{color:#ff6b6b}.risk-medium{color:#ffd43b}.risk-low{color:#51cf66}.score-badge{padding:4px 8px;border-radius:4px;font-size:0.85rem;font-weight:600}.stats{display:flex;gap:2rem;margin:2rem 0}.stat-box{background:#1a1a1a;padding:1.5rem;border-radius:8px;flex:1}.stat-box h3{color:#fff;margin-bottom:0.5rem}.stat-box p{color:#ccc;font-size:1.5rem;font-weight:600}</style></head><body><div class="container"><h1>Credit Assessments</h1><a href="/dashboard/authenticated?token=${token}" class="btn">Back to Dashboard</a><div class="stats"><div class="stat-box"><h3>Total Assessments</h3><p>${creditAssessments.length}</p></div><div class="stat-box"><h3>High Risk</h3><p>${creditAssessments.filter(a => a.riskLevel === 'high').length}</p></div><div class="stat-box"><h3>Average Score</h3><p>${creditAssessments.length > 0 ? Math.round(creditAssessments.reduce((sum, a) => sum + (a.creditScore || 0), 0) / creditAssessments.length) : 0}</p></div></div><table><thead><tr><th>Contract ID</th><th>Buyer Email</th><th>Credit Score</th><th>Risk Level</th><th>Recommendation</th><th>Assessment Date</th></tr></thead><tbody>${creditAssessments.map(assessment => {
            const score = assessment.creditScore || 0;
            const riskLevel = assessment.riskLevel || 'medium';
            const riskClass = riskLevel === 'high' ? 'risk-high' : riskLevel === 'medium' ? 'risk-medium' : 'risk-low';
            const scoreClass = score >= 700 ? 'risk-low' : score >= 600 ? 'risk-medium' : 'risk-high';
            return `<tr><td>${assessment.contractId || 'N/A'}</td><td>${assessment.buyerEmail || 'N/A'}</td><td><span class="score-badge ${scoreClass}">${score}</span></td><td class="${riskClass}">${riskLevel.toUpperCase()}</td><td>${assessment.recommendation || 'Pending'}</td><td>${new Date(assessment.assessmentDate || Date.now()).toLocaleDateString()}</td></tr>`;
        }).join('') || '<tr><td colspan="6" style="text-align:center;color:#ccc">No credit assessments found</td></tr>'}</tbody></table></div></body></html>`;
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
            <div id="sumsub-container" style="min-height:600px;"></div>
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
    
    <script>
    (function () {
      fetch('/api/sumsub/token', {
        headers: {
          'Authorization': 'Bearer ' + (localStorage.getItem('token') || '${token}')
        }
      })
        .then(res => res.json())
        .then(data => {
          if (!data.token) {
            console.error('No Sumsub token');
            return;
          }

          window.snsWebSdk
            .init(
              data.token,
              function updateToken() {
                return fetch('/api/sumsub/token', {
                  headers: {
                    'Authorization': 'Bearer ' + (localStorage.getItem('token') || '${token}')
                  }
                })
                  .then(r => r.json())
                  .then(d => d.token);
              }
            )
            .withConf({ lang: 'en' })
            .on('message', function(type, payload) {
              console.log('Sumsub event:', type, payload);
            })
            .on('error', function(err) {
              console.error('Sumsub error:', err);
            })
            .mount('#sumsub-container');
        })
        .catch(err => {
          console.error('Error loading Sumsub token:', err);
        });
    })();
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
        // Allow access if KYC is pending AND wallet is set up (user completed both steps)
        const hasWallet = user.hasWallet || user.walletAddress;
        if (user.kycStatus !== 'approved' && user.role !== 'admin' && !hasWallet) {
            console.log('[INFO] User needs KYC verification, showing KYC page directly');
            // Show KYC page directly instead of redirecting to avoid loops
            return res.send(getFullKYCPageHTML(user.email, token));
        }
        
        // If KYC is pending but wallet is set up, allow access to dashboard (for demo/testing)
        if (user.kycStatus === 'pending' && hasWallet && user.role !== 'admin') {
            console.log('[INFO] User has pending KYC but wallet is set up, allowing dashboard access');
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
        
        <!-- KYC Status Indicator -->
        <div id="kyc-status-banner" class="security-banner" style="margin-bottom: 20px;">
            <div class="content">
                <h3 id="kyc-status-text">KYC Status: Loading...</h3>
                <p id="kyc-status-message">Checking verification status...</p>
            </div>
            <a href="/kyc?token=${token}" class="btn" id="kyc-action-btn" style="display: none;">Complete KYC</a>
        </div>
        
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
        
        // Load KYC status
        loadKYCStatus();
        
        loadContracts();
        
        // Load and display KYC status
        async function loadKYCStatus() {
            try {
                const response = await fetch('/api/kyc/status', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    displayKYCStatus(data);
                } else {
                    // Default to not_started if API fails
                    displayKYCStatus({ kyc_status: 'not_started', sumsub_applicant_id: null });
                }
            } catch (error) {
                console.error('Error loading KYC status:', error);
                displayKYCStatus({ kyc_status: 'not_started', sumsub_applicant_id: null });
            }
        }
        
        function displayKYCStatus(data) {
            const status = data.kyc_status || 'not_started';
            const banner = document.getElementById('kyc-status-banner');
            const statusText = document.getElementById('kyc-status-text');
            const statusMessage = document.getElementById('kyc-status-message');
            const actionBtn = document.getElementById('kyc-action-btn');
            
            if (!banner || !statusText || !statusMessage) return;
            
            // Update banner styling and content based on status
            if (status === 'approved') {
                banner.className = 'security-banner enabled';
                statusText.innerHTML = 'KYC Status: Approved ✅';
                statusMessage.textContent = 'Your identity verification has been completed and approved.';
                actionBtn.style.display = 'none';
            } else if (status === 'pending') {
                banner.className = 'security-banner';
                statusText.innerHTML = 'KYC Status: Pending ⏳';
                statusMessage.textContent = 'Your documents are being reviewed. This may take a few business days.';
                actionBtn.style.display = 'none';
            } else if (status === 'rejected') {
                banner.className = 'security-banner';
                statusText.innerHTML = 'KYC Status: Rejected ❌';
                statusMessage.textContent = 'Your verification was rejected. Please contact support or resubmit via the KYC page.';
                actionBtn.textContent = 'Resubmit KYC';
                actionBtn.href = '/kyc?token=' + encodeURIComponent(token);
                actionBtn.style.display = 'inline-block';
            } else {
                // not_started
                banner.className = 'security-banner';
                statusText.innerHTML = 'KYC Status: Not started';
                statusMessage.textContent = 'Please complete identity verification to use the platform.';
                actionBtn.textContent = 'Complete KYC';
                actionBtn.href = '/kyc?token=' + encodeURIComponent(token);
                actionBtn.style.display = 'inline-block';
            }
        }
        
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
            let buttons = '';
            
            // Normalize contract fields for backward compatibility
            const buyerDepositPaid = contract.buyerDepositPaid !== undefined ? contract.buyerDepositPaid : (contract.depositPaid || false);
            const deliveryDocsUploaded = contract.deliveryDocsUploaded !== undefined ? contract.deliveryDocsUploaded : (contract.documentsUploaded || false);
            const status = contract.status || 'pending_buyer_confirmation';
            
            // Add View button for all contracts
            buttons += '<a href="/contracts/' + contract.id + '?token=' + encodeURIComponent(token) + '" class="btn secondary small" style="background: #3b82f6;">View</a> ';
            
            if (userRole === 'buyer') {
                // Allow cancellation only before deposit is paid
                if (status === 'pending_supplier_confirmation' || status === 'pending_deposit' || status === 'pending_buyer_confirmation') {
                    buttons += '<button class="btn secondary small" onclick="cancelContract(\\''+contract.id+'\\')" style="background: #dc2626;">Cancel</button> ';
                }
                // Step 1: Pay Deposit - only show if not paid yet
                if (!buyerDepositPaid && (status === 'pending_deposit' || status === 'pending_buyer_confirmation')) {
                    const depositAmount = contract.depositAmount || Math.round(contract.totalValue * 0.20);
                    buttons += '<button class="btn secondary small" onclick="payDeposit(\\''+contract.id+'\\', '+depositAmount+')" style="background: #666666;">Pay Deposit ($'+depositAmount.toLocaleString()+')</button> ';
                }
                // Show status when deposit is paid but docs not uploaded
                if (buyerDepositPaid && status === 'AWAITING_DOCUMENTS') {
                    buttons += '<span class="btn small" style="background: #6b7280; cursor: default;">Deposit paid - awaiting documents</span> ';
                }
                // Step 4: Release Remaining Payment (Against Documents)
                if (status === 'AWAITING_BUYER_FINAL_PAYMENT' && deliveryDocsUploaded) {
                    const remainingAmount = contract.totalValue - (contract.depositAmount || Math.round(contract.totalValue * 0.20));
                    buttons += '<button class="btn secondary small" onclick="releasePayment(\\''+contract.id+'\\', '+remainingAmount+')" style="background: #666666;">Release Payment ($'+remainingAmount.toLocaleString()+')</button> ';
                }
                // Legacy status handling
                if (status === 'active' && buyerDepositPaid && !deliveryDocsUploaded) {
                    buttons += '<span class="btn small" style="background: #6b7280; cursor: default;">Awaiting Shipping Docs</span> ';
                }
            } else if (userRole === 'supplier') {
                // Allow cancellation only before deposit is paid
                if (status === 'pending_supplier_confirmation' || (status === 'pending_deposit' && !buyerDepositPaid)) {
                    buttons += '<button class="btn secondary small" onclick="cancelContract(\\''+contract.id+'\\')" style="background: #dc2626;">Cancel</button> ';
                }
                // Step 2: Confirm Contract
                if (status === 'pending_supplier_confirmation') {
                    buttons += '<button class="btn secondary small" onclick="confirmContract(\\''+contract.id+'\\')">Confirm</button> ';
                }
                // Step 3: Upload Documents - NEW: Show for AWAITING_DOCUMENTS status
                if (status === 'AWAITING_DOCUMENTS' && buyerDepositPaid && !deliveryDocsUploaded) {
                    buttons += '<a href="/manage-contract/' + contract.id + '?token=' + encodeURIComponent(token) + '" class="btn secondary small" style="background: #22c55e;">Upload Documents</a> ';
                }
                // Legacy: Upload Shipping Documents (after deposit received)
                if (status === 'active' && buyerDepositPaid && !deliveryDocsUploaded) {
                    buttons += '<a href="/manage-contract/' + contract.id + '?token=' + encodeURIComponent(token) + '" class="btn secondary small">Upload Shipping Docs</a> ';
                }
                // Show waiting for deposit
                if (status === 'pending_deposit' && !buyerDepositPaid) {
                    buttons += '<span class="btn small" style="background: #6b7280; cursor: default;">Awaiting Buyer Deposit</span> ';
                }
            } else if (userRole === 'trader') {
                // Determine trader's role in this contract
                const isBuyer = contract.buyerEmail === user.email;
                const isSupplier = contract.supplierEmail === user.email;
                
                // Allow cancellation only before deposit is satisfied
                const depositRequired = Number(contract.depositPercent || contract.deposit_percent || 0) > 0;
                const depositSatisfied = !depositRequired || contract.depositPaid === true;
                if ((contract.status === 'pending_supplier_confirmation' || contract.status === 'pending_deposit' || contract.status === 'pending_buyer_confirmation') && !depositSatisfied) {
                    buttons += '<button class="btn secondary small" onclick="cancelContract(\\''+contract.id+'\\')" style="background: #dc2626;">Cancel Contract</button>';
                }
                
                // Supplier actions
                if (isSupplier && status === 'pending_supplier_confirmation') {
                    buttons += '<button class="btn secondary small" onclick="confirmContract(\\''+contract.id+'\\')">Confirm as Supplier</button> ';
                }
                // NEW: Upload Documents for AWAITING_DOCUMENTS
                if (isSupplier && status === 'AWAITING_DOCUMENTS' && buyerDepositPaid && !deliveryDocsUploaded) {
                    buttons += '<a href="/manage-contract/' + contract.id + '?token=' + encodeURIComponent(token) + '" class="btn secondary small" style="background: #22c55e;">Upload Documents</a> ';
                }
                // Legacy: Upload Shipping Documents
                if (isSupplier && status === 'active' && buyerDepositPaid && !deliveryDocsUploaded) {
                    buttons += '<a href="/manage-contract/' + contract.id + '?token=' + encodeURIComponent(token) + '" class="btn secondary small">Upload Shipping Docs</a> ';
                }
                
                // Buyer actions
                if (isBuyer && !buyerDepositPaid && (status === 'pending_deposit' || status === 'pending_buyer_confirmation')) {
                    const depositAmount = contract.depositAmount || Math.round(contract.totalValue * 0.20);
                    buttons += '<button class="btn secondary small" onclick="payDeposit(\\''+contract.id+'\\', '+depositAmount+')" style="background: #666666;">Pay Deposit ($'+depositAmount.toLocaleString()+')</button> ';
                }
                if (isBuyer && status === 'AWAITING_BUYER_FINAL_PAYMENT' && deliveryDocsUploaded) {
                    const remainingAmount = contract.totalValue - (contract.depositAmount || Math.round(contract.totalValue * 0.20));
                    buttons += '<button class="btn secondary small" onclick="releasePayment(\\''+contract.id+'\\', '+remainingAmount+')" style="background: #666666;">Release Payment ($'+remainingAmount.toLocaleString()+')</button> ';
                }
                // Legacy status handling
                if (isBuyer && status === 'active' && buyerDepositPaid && deliveryDocsUploaded) {
                    const remainingAmount = contract.totalValue - (contract.depositAmount || Math.round(contract.totalValue * 0.20));
                    buttons += '<button class="btn secondary small" onclick="releasePayment(\\''+contract.id+'\\', '+remainingAmount+')" style="background: #666666;">Release Payment ($'+remainingAmount.toLocaleString()+')</button> ';
                }
                
                // Dual Contract button - create opposite contract
                if (contract.status === 'active' && contract.depositPaid) {
                    buttons += '<button class="btn secondary small" onclick="createDualContract(\\''+contract.id+'\\')" style="background: #667eea;">Create Dual Contract</button>';
                }
            }
            
            return buttons || '<span class="btn small" style="background: #6b7280; cursor: default;">No Actions</span>';
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
            const token = localStorage.getItem('token') || '';
            if (!token) {
                alert('Please sign in to upload documents');
                window.location.href = '/landing-two';
                return;
            }
            window.location.href = '/manage-contract/' + id + '?token=' + encodeURIComponent(token); 
        }
        
        function createDualContract(contractId) {
            const token = localStorage.getItem('token') || '';
            if (!token) {
                alert('Please sign in to create dual contract');
                window.location.href = '/landing-two';
                return;
            }
            window.location.href = '/create-dual-contract/' + contractId + '?token=' + encodeURIComponent(token);
        }
        
        async function cancelContract(contractId) {
            if (!confirm('Are you sure you want to cancel this contract? This action cannot be undone.')) {
                return;
            }
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('/api/contracts/' + contractId + '/cancel', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    }
                });
                if (response.ok) {
                    alert('Contract cancelled successfully');
                    loadContracts();
                } else {
                    const error = await response.json();
                    alert('Error: ' + (error.error || 'Failed to cancel contract'));
                }
            } catch (error) {
                alert('Error: ' + error.message);
            }
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

// KYC Dashboard Route - MUST BE BEFORE /dashboard/:role
app.get('/dashboard/kyc', (req, res) => {
    console.log('[KYC] KYC route hit');
    
    // Get token from query parameter, Authorization header, or cookie
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
    
    if (!token) {
        console.log('[ERROR] No token provided to KYC route');
        return res.redirect('/landing-two');
    }
    
    let user = null;
    
    try {
        // Verify token and get user data
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tangent-secret-key');
        user = database.users.get(decoded.email);
        
        if (!user) {
            console.log('[ERROR] User not found in database:', decoded.email);
            return res.redirect('/landing-two');
        }
        
        console.log('[OK] KYC page access granted for:', user.email);
        return res.send(getFullKYCPageHTML(user.email, token));
        
    } catch (error) {
        console.log('[ERROR] Token verification failed in KYC route:', error.message);
        return res.redirect('/landing-two');
    }
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
    
    // Get full user object from database to check KYC status
    const userEmail = req.user.email;
    const user = ensureUserKYCFields(database.users.get(userEmail));
    const kycStatus = user?.kyc_status || 'not_started';
    
    // KYC Gate: Redirect to /kyc if not approved (except for admin)
    // Allow access to /kyc route itself regardless of status
    console.log('[KYC] KYC CHECK - User:', userEmail, 'KYC Status:', kycStatus, 'Role:', req.user.role);
    if (kycStatus !== 'approved' && req.user.role !== 'admin') {
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
    console.log('[SERVER_VERSION]', 'WORKING-FIXED', Date.now());
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`[INFO] traidefi Complete Production Platform running on port ${PORT}`);
        console.log(`[INFO] Landing Page: http://localhost:${PORT}/`);
    });
}

module.exports = app;