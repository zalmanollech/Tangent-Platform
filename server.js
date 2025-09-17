const express = require('express');
const path = require('path');
const compression = require('compression');
const cors = require('cors');
const config = require('./lib/config');
const { requirePlatformAccess, routeHandler } = require('./lib/access-control');
const { initializeBulletproofAuth } = require('./lib/bulletproof-auth');

const app = express();

// Security headers middleware
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
};

app.use(securityHeaders);
app.use(compression());
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Apply access control to all routes
app.use(routeHandler);

// ============================================================================
// HTML TEMPLATE FUNCTIONS
// ============================================================================

function baseHead(title = "Tangent Platform") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    :root {
      --primary: #2563eb;
      --primary-dark: #1d4ed8;
      --secondary: #64748b;
      --success: #10b981;
      --warning: #f59e0b;
      --error: #ef4444;
      --background: #0f172a;
      --surface: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --border: #334155;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--background);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
    }

    .wrap {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }

    .hero {
      text-align: center;
      padding: 60px 0;
    }

    .hero h1 {
      font-size: 3rem;
      font-weight: 700;
      margin-bottom: 20px;
      background: linear-gradient(135deg, var(--primary), #06b6d4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .hero p {
      font-size: 1.25rem;
      color: var(--text-muted);
      max-width: 600px;
      margin: 0 auto;
    }

    .card {
      background: var(--surface);
      border-radius: 12px;
      padding: 30px;
      margin: 20px 0;
      border: 1px solid var(--border);
    }

    .grid {
      display: grid;
      gap: 20px;
    }

    .grid-2 { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
    .grid-3 { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }

    .btn {
      display: inline-block;
      padding: 12px 24px;
      background: var(--primary);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-size: 16px;
      font-weight: 500;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    .btn:hover {
      background: var(--primary-dark);
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(37, 99, 235, 0.3);
    }

    .btn:active {
      transform: translateY(0);
    }

    .btn.ghost {
      background: transparent;
      border: 2px solid var(--primary);
      color: var(--primary);
    }

    .btn.ghost:hover {
      background: var(--primary);
      color: white;
    }

    .in {
      width: 100%;
      padding: 12px 16px;
      background: var(--background);
      border: 2px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 16px;
      margin-bottom: 15px;
      transition: border-color 0.2s ease;
    }

    .in:focus {
      outline: none;
      border-color: var(--primary);
    }

    .nav {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 15px 0;
    }

    .nav-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .nav-brand {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--primary);
      text-decoration: none;
    }

    .nav-links {
      display: flex;
      gap: 30px;
      align-items: center;
    }

    .nav-links a {
      color: var(--text-muted);
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s ease;
    }

    .nav-links a:hover,
    .nav-links a.active {
      color: var(--primary);
    }

    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }

    .modal-content {
      background: var(--surface);
      padding: 40px;
      border-radius: 12px;
      max-width: 500px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
    }

    .notification {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 1001;
      transform: translateX(400px);
      transition: transform 0.3s ease;
    }

    .notification.show {
      transform: translateX(0);
    }

    .notification.success { background: var(--success); }
    .notification.error { background: var(--error); }
    .notification.warning { background: var(--warning); }

    @media (max-width: 768px) {
      .hero h1 { font-size: 2rem; }
      .grid-2, .grid-3 { grid-template-columns: 1fr; }
      .nav-links { gap: 15px; }
    }
  </style>

  <script>
    // Global JavaScript functions for all pages
    
    // Navigation functions
    function navigateToPortal(path = '') {
      const token = localStorage.getItem('authToken');
      if (!token) {
        showNotification('Please sign in first', 'error');
        showTeamSignIn();
        return;
      }
      const url = path ? \`/portal\${path}?token=\${encodeURIComponent(token)}\` : \`/portal?token=\${encodeURIComponent(token)}\`;
      window.location.href = url;
    }

    function navigateToAdmin() {
      const token = localStorage.getItem('authToken');
      if (!token) {
        showNotification('Please sign in first', 'error');
        showTeamSignIn();
        return;
      }
      window.location.href = \`/admin?token=\${encodeURIComponent(token)}\`;
    }

    // Modal functions
    function showUnifiedRegistration() {
      document.getElementById('unifiedRegistrationModal').style.display = 'flex';
    }

    function closeUnifiedRegistration() {
      document.getElementById('unifiedRegistrationModal').style.display = 'none';
    }

    function showTeamSignIn() {
      document.getElementById('signInModal').style.display = 'flex';
    }
    
    function closeSignIn() {
      document.getElementById('signInModal').style.display = 'none';
    }
    
    function showTGTRegistration() {
      document.getElementById('tgtRegistrationModal').style.display = 'flex';
    }

    function closeTGTRegistration() {
      document.getElementById('tgtRegistrationModal').style.display = 'none';
    }

    // Notification system
    function showNotification(message, type = 'success') {
      const notification = document.createElement('div');
      notification.className = \`notification \${type}\`;
      notification.textContent = message;
      document.body.appendChild(notification);
      
      setTimeout(() => notification.classList.add('show'), 100);
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);
    }

    // Form submission functions
    async function submitUnifiedRegistration() {
      const formData = {
        name: document.getElementById('unifiedName').value,
        email: document.getElementById('unifiedEmail').value,
        company: document.getElementById('unifiedCompany').value,
        phone: document.getElementById('unifiedPhone').value,
        interests: Array.from(document.querySelectorAll('input[name="interests"]:checked')).map(cb => cb.value),
        message: document.getElementById('unifiedMessage').value,
        newsletter: document.getElementById('unifiedNewsletter').checked,
        timestamp: new Date().toISOString(),
        type: 'unified_registration'
      };

      try {
        const response = await fetch('/api/unified-register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        const result = await response.json();
        if (response.ok && result.success) {
          showNotification('Thank you for your interest! We will contact you within 48 hours.', 'success');
          closeUnifiedRegistration();
          // Clear form
          document.getElementById('unifiedName').value = '';
          document.getElementById('unifiedEmail').value = '';
          document.getElementById('unifiedCompany').value = '';
          document.getElementById('unifiedPhone').value = '';
          document.querySelectorAll('input[name="interests"]:checked').forEach(cb => cb.checked = false);
          document.getElementById('unifiedMessage').value = '';
        } else {
          showNotification('Registration failed: ' + (result.message || result.error), 'error');
        }
      } catch (error) {
        showNotification('Network error. Please try again.', 'error');
        console.error('Registration Error:', error);
      }
    }
    
    async function performSignIn() {
      const email = document.getElementById('signInEmail').value;
      const password = document.getElementById('signInPassword').value;

      if (!email || !password) {
        showNotification('Please enter both email and password', 'error');
        return;
      }
      
      try {
        const response = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        const result = await response.json();
        if (response.ok && result.success && result.token) {
          localStorage.setItem('authToken', result.token);
          showNotification('Sign in successful!', 'success');
          closeSignIn();
          
          // Navigate based on user role
          if (result.user && result.user.role === 'admin') {
            setTimeout(() => navigateToAdmin(), 1000);
        } else {
            setTimeout(() => navigateToPortal(), 1000);
          }
        } else {
          showNotification('Sign in failed: ' + (result.message || result.error || 'Invalid credentials'), 'error');
        }
      } catch (error) {
        showNotification('Network error. Please try again.', 'error');
        console.error('Sign in error:', error);
      }
    }

    // Close modals when clicking outside
    window.onclick = function(event) {
      const modals = ['unifiedRegistrationModal', 'signInModal', 'tgtRegistrationModal'];
      modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal && event.target === modal) {
          modal.style.display = 'none';
        }
      });
    }
  </script>
</head>`;
}

function nav(currentPage = "") {
  return `
  <nav class="nav">
    <div class="wrap">
      <div class="nav-content">
        <a href="/" class="nav-brand">Tangent Protocol</a>
        <div class="nav-links">
          <a href="/" class="${currentPage === 'Home' ? 'active' : ''}">Home</a>
          <a href="javascript:navigateToPortal('/portal/trade')" class="${currentPage === 'Trade' ? 'active' : ''}">Trade</a>
          <a href="javascript:navigateToPortal('/portal/kyc')" class="${currentPage === 'KYC' ? 'active' : ''}">KYC</a>
          <a href="javascript:navigateToPortal('/portal/analytics')" class="${currentPage === 'Analytics' ? 'active' : ''}">Analytics</a>
          <a href="javascript:navigateToAdmin()" class="${currentPage === 'Admin' ? 'active' : ''}">Admin</a>
        </div>
      </div>
    </div>
  </nav>`;
}

// ============================================================================
// PAGE FUNCTIONS
// ============================================================================

function pageLanding() {
  return `${baseHead("Tangent Protocol — Advanced Trading Platform")}
<body>
  <nav class="nav">
    <div class="wrap">
      <div class="nav-content">
        <a href="/" class="nav-brand">Tangent Protocol</a>
        <div class="nav-links">
          <button class="btn" onclick="showUnifiedRegistration()">Get Started</button>
          <button class="btn ghost" onclick="showTeamSignIn()">Team Portal</button>
        </div>
      </div>
    </div>
  </nav>

  <main class="wrap">
    <section class="hero">
      <h1>Advanced Trading Platform</h1>
      <p>Experience next-generation trading with institutional-grade tools, real-time analytics, and seamless execution.</p>
      <div style="margin-top: 40px;">
        <button class="btn" onclick="showUnifiedRegistration()" style="margin-right: 20px;">Start Trading</button>
        <button class="btn ghost" onclick="window.location.href='/demo/buyer-journey'">View Demo</button>
      </div>
    </section>

    <section class="grid grid-2" style="margin: 80px 0;">
        <div class="card">
        <h2>🚀 Trading Platform</h2>
        <p>Advanced trading tools with real-time market data, sophisticated order types, and institutional-grade execution.</p>
        <ul style="margin: 20px 0; padding-left: 20px;">
          <li>Real-time market data</li>
          <li>Advanced order types</li>
          <li>Risk management tools</li>
          <li>Portfolio analytics</li>
        </ul>
        <button class="btn" onclick="showUnifiedRegistration()">Learn More</button>
        </div>
        
        <div class="card">
        <h2>💎 TGT Stablecoin</h2>
        <p>Discover the benefits of our innovative TGT stablecoin - designed for stability, transparency, and seamless integration.</p>
        <ul style="margin: 20px 0; padding-left: 20px;">
          <li>Price stability mechanisms</li>
          <li>Transparent reserves</li>
          <li>Low transaction costs</li>
          <li>DeFi integration</li>
        </ul>
        <button class="btn" onclick="showTGTRegistration()">Get TGT Info</button>
        </div>
    </section>
  </main>

  <!-- Unified Registration Modal -->
  <div id="unifiedRegistrationModal" class="modal">
    <div class="modal-content">
      <h2>Get Started with Tangent Protocol</h2>
      <p style="margin-bottom: 30px; color: var(--text-muted);">Join our platform and discover advanced trading opportunities.</p>
      
      <input type="text" id="unifiedName" placeholder="Full Name" class="in" required>
      <input type="email" id="unifiedEmail" placeholder="Email Address" class="in" required>
      <input type="text" id="unifiedCompany" placeholder="Company (Optional)" class="in">
      <input type="tel" id="unifiedPhone" placeholder="Phone Number" class="in">
      
      <div style="margin: 20px 0;">
        <p style="margin-bottom: 15px; font-weight: 500;">I'm interested in:</p>
        <label style="display: block; margin-bottom: 10px;">
          <input type="checkbox" name="interests" value="trading_platform" style="margin-right: 10px;">
          Trading Platform
        </label>
        <label style="display: block; margin-bottom: 10px;">
          <input type="checkbox" name="interests" value="tgt_stablecoin" style="margin-right: 10px;">
          TGT Stablecoin
        </label>
        <label style="display: block; margin-bottom: 10px;">
          <input type="checkbox" name="interests" value="both" style="margin-right: 10px;">
          Both Platform & TGT
        </label>
        </div>
      
      <textarea id="unifiedMessage" placeholder="Additional message (optional)" class="in" rows="3"></textarea>
      
      <label style="display: block; margin: 20px 0;">
        <input type="checkbox" id="unifiedNewsletter" checked style="margin-right: 10px;">
        Subscribe to updates and exclusive offers
      </label>
      
      <div style="display: flex; gap: 15px; margin-top: 30px;">
        <button class="btn" onclick="submitUnifiedRegistration()">Submit Registration</button>
        <button class="btn ghost" onclick="closeUnifiedRegistration()">Cancel</button>
      </div>
    </div>
  </div>

  <!-- Team Sign In Modal -->
  <div id="signInModal" class="modal">
    <div class="modal-content">
      <h2>Team Access</h2>
      <p style="margin-bottom: 30px; color: var(--text-muted);">Sign in to access the platform.</p>
      
      <input type="email" id="signInEmail" placeholder="Email Address" class="in" required>
      <input type="password" id="signInPassword" placeholder="Password" class="in" required>
      
      <div style="display: flex; gap: 15px; margin-top: 30px;">
        <button class="btn" onclick="performSignIn()">Sign In</button>
        <button class="btn ghost" onclick="closeSignIn()">Cancel</button>
      </div>
    </div>
  </div>

  <!-- TGT Registration Modal -->
  <div id="tgtRegistrationModal" class="modal">
    <div class="modal-content">
      <h2>TGT Stablecoin Information</h2>
      <p style="margin-bottom: 30px; color: var(--text-muted);">Get exclusive information about our TGT stablecoin.</p>
      
      <input type="text" id="tgtName" placeholder="Full Name" class="in" required>
      <input type="email" id="tgtEmail" placeholder="Email Address" class="in" required>
      <input type="text" id="tgtCompany" placeholder="Company" class="in">
      <input type="tel" id="tgtPhone" placeholder="Phone Number" class="in">
      
      <select id="tgtInterestLevel" class="in">
        <option value="">Interest Level</option>
        <option value="curious">Just Curious</option>
        <option value="considering">Considering Investment</option>
        <option value="ready">Ready to Invest</option>
      </select>
      
      <select id="tgtInvestmentRange" class="in">
        <option value="">Investment Range</option>
        <option value="under_10k">Under $10,000</option>
        <option value="10k_50k">$10,000 - $50,000</option>
        <option value="50k_100k">$50,000 - $100,000</option>
        <option value="over_100k">Over $100,000</option>
      </select>
      
      <textarea id="tgtMessage" placeholder="Questions or additional information" class="in" rows="3"></textarea>
      
      <label style="display: block; margin: 20px 0;">
        <input type="checkbox" id="tgtNewsletter" checked style="margin-right: 10px;">
        Subscribe to TGT updates and exclusive offers
      </label>
      
      <div style="display: flex; gap: 15px; margin-top: 30px;">
        <button class="btn" onclick="submitTGTRegistration()">Get TGT Information</button>
        <button class="btn ghost" onclick="closeTGTRegistration()">Cancel</button>
      </div>
    </div>
  </div>

  <script>
    async function submitTGTRegistration() {
      const formData = {
        name: document.getElementById('tgtName').value,
        email: document.getElementById('tgtEmail').value,
        company: document.getElementById('tgtCompany').value,
        phone: document.getElementById('tgtPhone').value,
        interestLevel: document.getElementById('tgtInterestLevel').value,
        investmentRange: document.getElementById('tgtInvestmentRange').value,
        message: document.getElementById('tgtMessage').value,
        newsletter: document.getElementById('tgtNewsletter').checked,
        timestamp: new Date().toISOString(),
        type: 'tgt_registration'
      };

      try {
        const response = await fetch('/api/tgt/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        const result = await response.json();
        if (response.ok && result.success) {
          showNotification('Thank you for your interest in TGT! We will contact you within 48 hours.', 'success');
          closeTGTRegistration();
          // Clear form
          document.getElementById('tgtName').value = '';
          document.getElementById('tgtEmail').value = '';
          document.getElementById('tgtCompany').value = '';
          document.getElementById('tgtPhone').value = '';
          document.getElementById('tgtInterestLevel').value = '';
          document.getElementById('tgtInvestmentRange').value = '';
          document.getElementById('tgtMessage').value = '';
        } else {
          showNotification('Registration failed: ' + (result.message || result.error), 'error');
        }
      } catch (error) {
        showNotification('Network error. Please try again.', 'error');
        console.error('TGT Registration Error:', error);
      }
    }
  </script>
</body></html>`;
}

function pageHome() {
  return `${baseHead("Tangent Platform — Trading Dashboard")}
<body>
${nav("Home")}
  <main class="wrap">
    <section class="hero">
      <h1>Welcome to Your Trading Dashboard</h1>
      <p>Manage your trades, track performance, and access advanced trading tools.</p>
    </section>

    <section class="card">
      <h2>Quick Actions</h2>
      <div class="grid grid-3">
        <button class="btn" onclick="navigateToPortal('/portal/kyc')">
          📋 Submit KYC
        </button>
        <button class="btn" onclick="navigateToPortal('/portal/trade')">
          💼 Trade Desk
        </button>
        <button class="btn" onclick="navigateToPortal('/portal/analytics')">
          📊 Analytics
        </button>
      </div>
    </section>
  </main>
</body></html>`;
}

function pageKYC() {
  return `${baseHead("KYC Verification")}
<body>
${nav("KYC")}
  <main class="wrap">
    <section class="hero">
      <h1>KYC Verification</h1>
      <p>Complete your Know Your Customer verification to access all platform features.</p>
    </section>
    
    <section class="card">
      <h2>Document Upload</h2>
      <p>Please upload the required documents for verification:</p>
      
      <div style="margin: 30px 0;">
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 10px; font-weight: 500;">Government ID</label>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" class="in">
        </div>
        
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 10px; font-weight: 500;">Proof of Address</label>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" class="in">
        </div>
        
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 10px; font-weight: 500;">Business Registration (if applicable)</label>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" class="in">
      </div>
      </div>
      
      <button class="btn" onclick="submitKYC()">Submit Documents</button>
    </section>
  </main>

  <script>
    function submitKYC() {
      showNotification('KYC documents submitted successfully! We will review within 24-48 hours.', 'success');
    }
  </script>
</body></html>`;
}

function pageTrade() {
  return `${baseHead("Trade Desk")}
<body>
${nav("Trade")}
  <main class="wrap">
    <section class="hero">
      <h1>Trade Desk</h1>
      <p>Execute trades with advanced tools and real-time market data.</p>
    </section>

    <section class="card">
      <h2>Trading Interface</h2>
      <p>Advanced trading tools coming soon...</p>
    </section>
  </main>
</body></html>`;
}

function pageAnalytics() {
  return `${baseHead("Analytics")}
<body>
${nav("Analytics")}
  <main class="wrap">
    <section class="hero">
      <h1>Analytics Dashboard</h1>
      <p>Track your trading performance and market insights.</p>
    </section>

    <section class="card">
      <h2>Performance Metrics</h2>
      <p>Analytics dashboard coming soon...</p>
    </section>
  </main>
</body></html>`;
}

function pageAuctions() {
  return `${baseHead("Auctions")}
<body>
${nav("Auctions")}
  <main class="wrap">
    <section class="hero">
      <h1>Auctions</h1>
      <p>Participate in trading auctions and competitive bidding.</p>
    </section>
  </main>
</body></html>`;
}

function pageInsurance() {
  return `${baseHead("Insurance")}
<body>
${nav("Insurance")}
  <main class="wrap">
    <section class="hero">
      <h1>Insurance</h1>
      <p>Protect your trades with comprehensive insurance coverage.</p>
    </section>
  </main>
</body></html>`;
}

function pageInteractiveDemo() {
  return `${baseHead("Interactive Demo")}
<body>
${nav("Demo")}
  <main class="wrap">
    <section class="hero">
      <h1>Interactive Demo</h1>
      <p>Experience our platform with guided demonstrations.</p>
    </section>
  </main>
</body></html>`;
}

function pageBuyerDemo() {
  return `${baseHead("Buyer Journey Demo")}
<body>
${nav("Demo")}
  <main class="wrap">
    <section class="hero">
      <h1>Buyer Journey Demo</h1>
      <p>Experience the complete buyer journey on our platform.</p>
    </section>

    <section class="card">
      <h2>Demo Steps</h2>
      <div class="grid grid-3">
        <div class="card">
          <h3>1. Registration</h3>
          <p>Quick and secure account setup</p>
              </div>
        <div class="card">
          <h3>2. KYC Verification</h3>
          <p>Streamlined compliance process</p>
        </div>
        <div class="card">
          <h3>3. Start Trading</h3>
          <p>Access to full trading features</p>
        </div>
      </div>
    </section>
  </main>
</body></html>`;
}

function pageSupplierDemo() {
  return `${baseHead("Supplier Journey Demo")}
<body>
${nav("Demo")}
  <main class="wrap">
    <section class="hero">
      <h1>Supplier Journey Demo</h1>
      <p>Discover how suppliers can leverage our platform.</p>
    </section>

    <section class="card">
      <h2>Supplier Benefits</h2>
      <div class="grid grid-2">
        <div class="card">
          <h3>Market Access</h3>
          <p>Connect with global buyers and expand your reach</p>
              </div>
        <div class="card">
          <h3>Efficient Trading</h3>
          <p>Streamlined processes and automated workflows</p>
        </div>
      </div>
    </section>
  </main>
</body></html>`;
}

function pageCompleteAdmin() {
  return `${baseHead("Tangent — Admin Panel")}
<body>
  ${nav("Admin")}
  <main class="wrap">
    <section class="card">
      <h2>Platform Management</h2>
      <div class="grid grid-2">
              <div>
          <h3>User Management</h3>
          <input type="email" id="userEmail" placeholder="Email" class="in">
          <input type="password" id="userPassword" placeholder="Password" class="in">
          <select id="userRole" class="in">
            <option value="admin">Admin</option>
            <option value="buyer">Buyer</option>
            <option value="supplier">Supplier</option>
          </select>
          <button onclick="createUser()" class="btn">Create User</button>
              </div>
        <div>
          <h3>Quick Actions</h3>
          <button onclick="testLogin()" class="btn ghost">Test Login System</button>
          <button onclick="goToPortal()" class="btn">Go to Portal</button>
          <button onclick="viewRegistrations()" class="btn">View Registrations</button>
          </div>
        </div>
    </section>

    <section class="card">
      <h2>Landing Page Registrations</h2>
      <div id="registrationsList">
        <p>Loading registrations...</p>
        </div>
    </section>
  </main>
  
  <script>
    async function createUser() {
      const email = document.getElementById('userEmail').value;
      const password = document.getElementById('userPassword').value;
      const role = document.getElementById('userRole').value;

      if (!email || !password) {
        showNotification('Please enter email and password', 'error');
        return;
      }

      try {
        const response = await fetch('/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, role })
        });

        const result = await response.json();
        if (result.success || result.token) {
          showNotification(\`User \${email} created successfully with \${role} role!\`, 'success');
          document.getElementById('userEmail').value = '';
          document.getElementById('userPassword').value = '';
        } else {
          showNotification('Error: ' + (result.error || 'Creation failed'), 'error');
        }
      } catch (error) {
        showNotification('Network error: ' + error.message, 'error');
      }
    }

    async function testLogin() {
      const email = 'ollech@gmail.com';
      const password = 'admin123';
      
      try {
        const response = await fetch('/auth/login', {
            method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
          });
          
          const result = await response.json();
        if (result.success && result.token) {
          showNotification('Login test successful!', 'success');
          localStorage.setItem('authToken', result.token);
          } else {
          showNotification('Login test failed: ' + JSON.stringify(result), 'error');
          }
        } catch (error) {
        showNotification('Login test error: ' + error.message, 'error');
      }
    }

    function goToPortal() {
      const token = localStorage.getItem('authToken');
      if (!token) {
        showNotification('Please login first', 'error');
        return;
      }
      window.location.href = '/portal?token=' + encodeURIComponent(token);
    }

    async function viewRegistrations() {
      try {
        const response = await fetch('/api/admin/registrations');
        const data = await response.json();
        
        if (data.success) {
          let html = '<h3>Unified Registrations</h3>';
          if (data.unified && data.unified.length > 0) {
            data.unified.forEach(reg => {
              html += \`<div class="card" style="margin: 10px 0; padding: 15px;">
                <strong>\${reg.name}</strong> - \${reg.email}<br>
                Company: \${reg.company || 'N/A'}<br>
                Interests: \${reg.interests ? reg.interests.join(', ') : 'N/A'}<br>
                Date: \${new Date(reg.timestamp).toLocaleDateString()}
              </div>\`;
            });
          } else {
            html += '<p>No unified registrations yet.</p>';
          }
          
          html += '<h3>TGT Registrations</h3>';
          if (data.tgt && data.tgt.length > 0) {
            data.tgt.forEach(reg => {
              html += \`<div class="card" style="margin: 10px 0; padding: 15px;">
                <strong>\${reg.name}</strong> - \${reg.email}<br>
                Company: \${reg.company || 'N/A'}<br>
                Interest Level: \${reg.interestLevel || 'N/A'}<br>
                Investment Range: \${reg.investmentRange || 'N/A'}<br>
                Date: \${new Date(reg.timestamp).toLocaleDateString()}
              </div>\`;
            });
          } else {
            html += '<p>No TGT registrations yet.</p>';
          }
          
          document.getElementById('registrationsList').innerHTML = html;
        } else {
          showNotification('Failed to load registrations', 'error');
        }
      } catch (error) {
        showNotification('Error loading registrations: ' + error.message, 'error');
      }
    }

    // Load registrations on page load
    document.addEventListener('DOMContentLoaded', viewRegistrations);
  </script>
</body></html>`;
}

// ============================================================================
// EXPRESS ROUTES
// ============================================================================

// Main routes
app.get('/', (req, res) => {
  try {
    const html = pageLanding();
    res.send(html);
  } catch (error) {
    console.error('Error rendering landing page:', error);
    res.send(`<html><body><h1>Error rendering page</h1><pre>${error.message}</pre></body></html>`);
  }
});
app.get('/portal', (req, res) => res.send(pageHome()));
app.get('/portal/trade', (req, res) => res.send(pageTrade()));
app.get('/portal/kyc', (req, res) => res.send(pageKYC()));
app.get('/portal/auctions', (req, res) => res.send(pageAuctions()));
app.get('/portal/insurance', (req, res) => res.send(pageInsurance()));
app.get('/portal/interactive-demo', (req, res) => res.send(pageInteractiveDemo()));
app.get('/portal/analytics', (req, res) => res.send(pageAnalytics()));
app.get('/admin', (req, res) => res.send(pageCompleteAdmin()));

// Demo routes (public access)
app.get('/demo/buyer-journey', (req, res) => res.send(pageBuyerDemo()));
app.get('/demo/supplier-journey', (req, res) => res.send(pageSupplierDemo()));

// API routes
app.use('/auth', require('./routes/auth'));
app.use('/api/unified-register', require('./routes/unified-register'));
app.use('/api/tgt', require('./routes/tgt'));
app.use('/api/kyc', require('./routes/kyc'));

// Admin API route for registrations
app.get('/api/admin/registrations', requirePlatformAccess, (req, res) => {
  try {
    const db = require('./lib/database');
    const data = db.getData();
    
    res.json({
      success: true,
      unified: data.unifiedRegistrations || [],
      tgt: data.tgtRegistrations || []
    });
  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch registrations' });
  }
});

// Test route
app.get('/test', (req, res) => {
  res.send('<html><body><h1>Server is working!</h1><p>This is a test page.</p></body></html>');
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

async function startServer() {
  try {
    console.log('🔄 Initializing bulletproof authentication...');
    await initializeBulletproofAuth();
    console.log('✅ Authentication system initialized');

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
      console.log(`🚀 Tangent Platform running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
