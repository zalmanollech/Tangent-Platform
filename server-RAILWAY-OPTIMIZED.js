// Tangent Platform - Railway Optimized Version
// This version uses external HTML templates to reduce file size

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Simple in-memory database for Railway
let database = {
    users: [
        {
            id: 'admin-1',
            email: 'admin@tangent.com',
            password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO8G', // TangentAdmin2024!
            role: 'admin',
            isActive: true
        }
    ],
    contracts: [],
    admin: {
        fees: { platformFee: 2.5, auctionFee: 5.0 },
        interestRates: { deposit: 8.5, penalty: 2.0 }
    }
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1] || req.query.token;

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'tangent-secret-key', (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Helper function to load HTML templates
function loadTemplate(templateName) {
    try {
        const templatePath = path.join(__dirname, 'templates', templateName + '.html');
        if (fs.existsSync(templatePath)) {
            return fs.readFileSync(templatePath, 'utf8');
        }
    } catch (error) {
        console.log('Template not found, using inline HTML');
    }
    return null;
}

// Routes
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html><head><title>Tangent Platform</title></head>
        <body style="font-family: system-ui; background: #0f172a; color: white; text-align: center; padding: 2rem;">
            <h1>🚀 Tangent Platform</h1>
            <p>Secure Commodity Trading & Blockchain Finance</p>
            <div style="margin: 2rem;">
                <a href="/landing-two" style="background: #2563eb; color: white; padding: 1rem 2rem; text-decoration: none; border-radius: 8px; margin: 1rem;">Access Portal</a>
                <a href="/demo-main" style="background: #f59e0b; color: black; padding: 1rem 2rem; text-decoration: none; border-radius: 8px; margin: 1rem;">🎭 Demo</a>
            </div>
        </body></html>
    `);
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        message: 'Tangent Platform is running',
        version: 'Railway-Optimized'
    });
});

app.get('/landing-two', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html><head><title>Tangent Platform - Access Portal</title>
        <style>
            body { font-family: system-ui; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; margin: 0; padding: 2rem; }
            .container { max-width: 800px; margin: 0 auto; text-align: center; }
            .btn { display: inline-block; padding: 1rem 2rem; margin: 1rem; text-decoration: none; border-radius: 8px; font-weight: bold; }
            .btn-signin { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; }
            .btn-signup { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; }
            .btn-demo { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: black; }
        </style></head>
        <body>
            <div class="container">
                <h1>🚀 Tangent Platform</h1>
                <p>Secure Commodity Trading & Blockchain Finance</p>
                <div>
                    <a href="/signin" class="btn btn-signin">🔐 Sign In</a>
                    <a href="/signup" class="btn btn-signup">✨ Sign Up</a>
                    <a href="/demo-main" class="btn btn-demo">🎭 Demo</a>
                </div>
            </div>
        </body></html>
    `);
});

app.get('/demo-main', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html><head><title>Tangent Platform - Demo</title>
        <style>
            body { font-family: system-ui; background: #0f172a; color: white; margin: 0; padding: 2rem; }
            .container { max-width: 1200px; margin: 0 auto; text-align: center; }
            .demo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; margin: 2rem 0; }
            .workflow-card { background: #1e293b; border-radius: 12px; padding: 2rem; cursor: pointer; border: 1px solid #334155; }
            .workflow-card:hover { transform: translateY(-4px); border-color: #2563eb; }
            .buyer { border-left: 4px solid #2563eb; }
            .supplier { border-left: 4px solid #059669; }
            .trader { border-left: 4px solid #7c3aed; }
        </style></head>
        <body>
            <div class="container">
                <h1>🎯 Platform Demo Workflows</h1>
                <p>Experience the complete journey for each role</p>
                <div class="demo-grid">
                    <div class="workflow-card buyer" onclick="window.location.href='/demo/buyer/step1-signup'">
                        <h3>🛒 Buyer Journey</h3>
                        <p>Complete contract creation and payment flow</p>
                    </div>
                    <div class="workflow-card supplier" onclick="window.location.href='/demo/supplier/step1-new-contract'">
                        <h3>🏭 Supplier Journey</h3>
                        <p>Contract fulfillment and document upload</p>
                    </div>
                    <div class="workflow-card trader" onclick="window.location.href='/demo/trader/step1-dashboard'">
                        <h3>📈 Trader Journey</h3>
                        <p>Dual contract management and arbitrage</p>
                    </div>
                </div>
                <div style="margin: 2rem;">
                    <a href="/demo/workflow" style="background: #dc2626; color: white; padding: 1rem 2rem; text-decoration: none; border-radius: 8px;">Complete Workflow Demo</a>
                </div>
            </div>
        </body></html>
    `);
});

app.get('/demo/workflow', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html><head><title>Complete Workflow Demo</title>
        <style>
            body { font-family: system-ui; background: #0f172a; color: white; margin: 0; padding: 2rem; }
            .container { max-width: 1200px; margin: 0 auto; }
            .role-tabs { display: flex; gap: 1rem; margin: 2rem 0; }
            .role-tab { background: #374151; color: white; padding: 1rem 2rem; border: none; border-radius: 8px; cursor: pointer; }
            .role-tab.active { background: #dc2626; }
            .workflow-section { display: none; }
            .workflow-section.active { display: block; }
            .steps-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin: 2rem 0; }
            .step-card { background: #1e293b; border-radius: 12px; padding: 2rem; border: 1px solid #334155; }
            .step-btn { background: #dc2626; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 1rem; }
        </style></head>
        <body>
            <div class="container">
                <h1>🎯 Complete Workflow Demo</h1>
                <div class="role-tabs">
                    <button class="role-tab active" onclick="showRole('admin')">👑 Admin Flow</button>
                    <button class="role-tab" onclick="showRole('buyer')">🛒 Buyer Flow</button>
                    <button class="role-tab" onclick="showRole('supplier')">🏭 Supplier Flow</button>
                    <button class="role-tab" onclick="showRole('trader')">📈 Trader Flow</button>
                </div>
                
                <div id="admin-flow" class="workflow-section active">
                    <h2>👑 Admin Platform Management</h2>
                    <div class="steps-grid">
                        <div class="step-card">
                            <h3>Dashboard Overview</h3>
                            <p>Platform statistics and system alerts</p>
                            <a href="/demo/admin/step1-dashboard" class="step-btn">View Dashboard</a>
                        </div>
                        <div class="step-card">
                            <h3>User Management & KYC</h3>
                            <p>Review registrations and OFAC screening</p>
                            <a href="/demo/admin/step2-user-management" class="step-btn">Manage Users</a>
                        </div>
                        <div class="step-card">
                            <h3>Auction Management</h3>
                            <p>Handle payment timeouts and auctions</p>
                            <a href="/demo/admin/step4-auction-management" class="step-btn">Auction Dashboard</a>
                        </div>
                        <div class="step-card">
                            <h3>Platform Settings</h3>
                            <p>Configure fees and system parameters</p>
                            <a href="/demo/admin/step5-platform-settings" class="step-btn">System Settings</a>
                        </div>
                    </div>
                </div>
                
                <div id="buyer-flow" class="workflow-section">
                    <h2>🛒 Buyer Contract Flow</h2>
                    <p>Complete buyer journey from signup to contract completion</p>
                </div>
                
                <div id="supplier-flow" class="workflow-section">
                    <h2>🏭 Supplier Contract Flow</h2>
                    <p>Complete supplier journey from contract notification to payment</p>
                </div>
                
                <div id="trader-flow" class="workflow-section">
                    <h2>📈 Trader Arbitrage Flow</h2>
                    <p>Complete trader journey managing dual contracts</p>
                </div>
            </div>
            
            <script>
                function showRole(role) {
                    document.querySelectorAll('.workflow-section').forEach(s => s.classList.remove('active'));
                    document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
                    document.getElementById(role + '-flow').classList.add('active');
                    event.target.classList.add('active');
                }
            </script>
        </body></html>
    `);
});

// Simplified admin demo routes (key functionality only)
app.get('/demo/admin/step1-dashboard', (req, res) => {
    res.send('<h1>Admin Dashboard</h1><p>Platform statistics and alerts</p><a href="/demo/workflow">← Back</a>');
});

app.get('/demo/admin/step2-user-management', (req, res) => {
    res.send('<h1>User Management</h1><p>KYC reviews and OFAC screening</p><a href="/demo/workflow">← Back</a>');
});

app.get('/demo/admin/step4-auction-management', (req, res) => {
    res.send('<h1>Auction Management</h1><p>Payment timeouts and live auctions</p><a href="/demo/workflow">← Back</a>');
});

app.get('/demo/admin/step5-platform-settings', (req, res) => {
    res.send('<h1>Platform Settings</h1><p>Fee configuration and system status</p><a href="/demo/workflow">← Back</a>');
});

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = database.users.find(u => u.email === email);
        
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'tangent-secret-key',
            { expiresIn: '24h' }
        );

        res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Catch all
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', (err) => {
    if (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }
    console.log(`✅ TANGENT PLATFORM RUNNING ON PORT ${PORT}`);
    console.log(`🌐 Landing Page: http://localhost:${PORT}/`);
    console.log(`🎭 Demo: http://localhost:${PORT}/demo-main`);
});

module.exports = app;
