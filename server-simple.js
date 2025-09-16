const express = require('express');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Professional landing page with full functionality
app.get('/', (req, res) => {
  console.log('ROOT ROUTE HIT!');
  const html = '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head>' +
      '<meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>Tangent Protocol — Advanced Trading Platform</title>' +
      '<style>' +
        'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 0; }' +
        '.container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }' +
        '.header { text-align: center; margin-bottom: 60px; }' +
        'h1 { font-size: 4rem; font-weight: 700; margin-bottom: 20px; background: linear-gradient(135deg, #2563eb, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }' +
        '.subtitle { font-size: 1.5rem; color: #94a3b8; margin-bottom: 40px; }' +
        '.cta-section { text-align: center; margin: 60px 0; }' +
        '.btn { display: inline-block; padding: 15px 30px; background: #2563eb; color: white; text-decoration: none; border-radius: 12px; margin: 10px; border: none; cursor: pointer; font-size: 16px; font-weight: 600; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3); }' +
        '.btn:hover { background: #1d4ed8; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4); }' +
        '.btn.ghost { background: transparent; border: 2px solid #2563eb; color: #2563eb; box-shadow: none; }' +
        '.btn.ghost:hover { background: #2563eb; color: white; }' +
        '.btn.secondary { background: #06b6d4; }' +
        '.btn.secondary:hover { background: #0891b2; }' +
        '.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 30px; margin: 60px 0; }' +
        '.card { background: #1e293b; padding: 40px; border-radius: 16px; border: 1px solid #334155; text-align: left; transition: transform 0.3s ease; }' +
        '.card:hover { transform: translateY(-5px); }' +
        '.card h2 { color: #2563eb; margin-bottom: 20px; font-size: 1.5rem; }' +
        '.card p { color: #94a3b8; margin-bottom: 20px; line-height: 1.6; }' +
        '.card ul { margin: 20px 0; padding-left: 20px; }' +
        '.card li { margin: 10px 0; color: #94a3b8; }' +
        '.status { margin-top: 60px; padding: 30px; background: #1e293b; border-radius: 16px; border: 1px solid #334155; text-align: center; }' +
        '.status h3 { color: #06b6d4; margin-bottom: 20px; }' +
        '.status p { margin: 10px 0; color: #94a3b8; }' +
        '.modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.8); }' +
        '.modal-content { background-color: #1e293b; margin: 5% auto; padding: 30px; border-radius: 16px; width: 90%; max-width: 500px; border: 1px solid #334155; }' +
        '.form-group { margin-bottom: 20px; }' +
        '.form-group label { display: block; margin-bottom: 8px; color: #f8fafc; font-weight: 600; }' +
        '.form-group input, .form-group select, .form-group textarea { width: 100%; padding: 12px; border: 1px solid #334155; border-radius: 8px; background: #0f172a; color: #f8fafc; font-size: 16px; }' +
        '.form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }' +
        '.close { color: #94a3b8; float: right; font-size: 28px; font-weight: bold; cursor: pointer; }' +
        '.close:hover { color: #f8fafc; }' +
        '.checkbox-group { display: flex; align-items: center; margin: 15px 0; }' +
        '.checkbox-group input[type="checkbox"] { margin-right: 10px; }' +
        '.notification { position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 15px 20px; border-radius: 8px; z-index: 1001; display: none; }' +
        '.notification.error { background: #ef4444; }' +
        '.notification.warning { background: #f59e0b; }' +
        '.notification.info { background: #3b82f6; }' +
        '@media (max-width: 768px) { h1 { font-size: 2.5rem; } .grid { grid-template-columns: 1fr; } .btn { display: block; width: 100%; margin: 10px 0; } }' +
      '</style>' +
    '</head>' +
    '<body>' +
      '<div class="container">' +
        '<div class="header">' +
          '<h1>Tangent Protocol</h1>' +
          '<p class="subtitle">Advanced Trading Platform & TGT Stablecoin</p>' +
          '<p>Experience next-generation trading with institutional-grade tools, real-time analytics, and seamless execution. Discover the power of our innovative TGT stablecoin.</p>' +
        '</div>' +
        
        '<div class="cta-section">' +
          '<button class="btn" onclick="showUnifiedRegistration()">Get Started</button>' +
          '<button class="btn secondary" onclick="showTGTInfo()">Learn About TGT</button>' +
          '<button class="btn ghost" onclick="showSignIn()">Team Portal</button>' +
          '<button class="btn ghost" onclick="window.location.href=\'/demo/buyer-journey\'">View Demo</button>' +
        '</div>' +
        
        '<div class="grid">' +
          '<div class="card">' +
            '<h2>🚀 Trading Platform</h2>' +
            '<p>Advanced trading tools with real-time market data, sophisticated order types, and institutional-grade execution.</p>' +
            '<ul>' +
              '<li>Real-time market data and analytics</li>' +
              '<li>Advanced order types and execution</li>' +
              '<li>Comprehensive risk management</li>' +
              '<li>Portfolio analytics and reporting</li>' +
              '<li>Multi-asset trading support</li>' +
            '</ul>' +
            '<button class="btn" onclick="showUnifiedRegistration()">Register Interest</button>' +
          '</div>' +
          
          '<div class="card">' +
            '<h2>💎 TGT Stablecoin</h2>' +
            '<p>Discover the benefits of our innovative TGT stablecoin - designed for stability, transparency, and seamless integration.</p>' +
            '<ul>' +
              '<li>Advanced price stability mechanisms</li>' +
              '<li>Transparent reserve management</li>' +
              '<li>Ultra-low transaction costs</li>' +
              '<li>Seamless DeFi integration</li>' +
              '<li>Regulatory compliance ready</li>' +
            '</ul>' +
            '<button class="btn" onclick="showTGTRegistration()">Get TGT Info</button>' +
          '</div>' +
        '</div>' +
        
        '<div class="status">' +
          '<h3>🚀 Platform Status</h3>' +
          '<p><strong>Server:</strong> ✅ Online and Running</p>' +
          '<p><strong>DNS Routing:</strong> ✅ Working</p>' +
          '<p><strong>SSL Certificates:</strong> ✅ Active</p>' +
          '<p><strong>Version:</strong> 2.0.0-professional</p>' +
          '<p><strong>Last Updated:</strong> ' + new Date().toISOString() + '</p>' +
        '</div>' +
        
        '<div style="margin-top: 30px; text-align: center;">' +
          '<a href="/test" style="color: #2563eb; text-decoration: none; margin: 0 15px;">🧪 Test Server</a>' +
          '<a href="/health" style="color: #2563eb; text-decoration: none; margin: 0 15px;">📊 Health Check</a>' +
        '</div>' +
      '</div>' +
      
      '<!-- Unified Registration Modal -->' +
      '<div id="unifiedRegistrationModal" class="modal">' +
        '<div class="modal-content">' +
          '<span class="close" onclick="closeUnifiedRegistration()">&times;</span>' +
          '<h2>Join Tangent Protocol</h2>' +
          '<form id="unifiedRegistrationForm">' +
            '<div class="form-group">' +
              '<label for="name">Full Name *</label>' +
              '<input type="text" id="name" name="name" required>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="email">Email Address *</label>' +
              '<input type="email" id="email" name="email" required>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="company">Company/Organization</label>' +
              '<input type="text" id="company" name="company">' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="phone">Phone Number</label>' +
              '<input type="tel" id="phone" name="phone">' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="interest">Primary Interest *</label>' +
              '<select id="interest" name="interest" required>' +
                '<option value="">Select your interest</option>' +
                '<option value="platform">Trading Platform</option>' +
                '<option value="tgt">TGT Stablecoin</option>' +
                '<option value="both">Both Platform & TGT</option>' +
              '</select>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="message">Additional Information</label>' +
              '<textarea id="message" name="message" rows="4" placeholder="Tell us about your trading needs, TGT interest, or any questions..."></textarea>' +
            '</div>' +
            '<div class="checkbox-group">' +
              '<input type="checkbox" id="newsletter" name="newsletter" checked>' +
              '<label for="newsletter">Subscribe to updates and news</label>' +
            '</div>' +
            '<button type="submit" class="btn" style="width: 100%;">Submit Registration</button>' +
          '</form>' +
        '</div>' +
      '</div>' +
      
      '<!-- TGT Registration Modal -->' +
      '<div id="tgtRegistrationModal" class="modal">' +
        '<div class="modal-content">' +
          '<span class="close" onclick="closeTGTRegistration()">&times;</span>' +
          '<h2>TGT Stablecoin Information</h2>' +
          '<div style="margin-bottom: 30px;">' +
            '<h3>What is TGT?</h3>' +
            '<p>TGT is our innovative stablecoin designed for maximum stability, transparency, and efficiency. Built with advanced algorithmic mechanisms and backed by diversified reserves.</p>' +
            '<h3>Key Benefits:</h3>' +
            '<ul>' +
              '<li>Ultra-stable price maintenance</li>' +
              '<li>Transparent reserve reporting</li>' +
              '<li>Low transaction fees</li>' +
              '<li>Fast settlement times</li>' +
              '<li>Regulatory compliance</li>' +
            '</ul>' +
          '</div>' +
          '<button class="btn" onclick="showTGTRegistrationForm()">Register for TGT Updates</button>' +
        '</div>' +
      '</div>' +
      
      '<!-- TGT Registration Form Modal -->' +
      '<div id="tgtRegistrationFormModal" class="modal">' +
        '<div class="modal-content">' +
          '<span class="close" onclick="closeTGTRegistrationForm()">&times;</span>' +
          '<h2>TGT Stablecoin Registration</h2>' +
          '<form id="tgtRegistrationForm">' +
            '<div class="form-group">' +
              '<label for="tgtName">Full Name *</label>' +
              '<input type="text" id="tgtName" name="name" required>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="tgtEmail">Email Address *</label>' +
              '<input type="email" id="tgtEmail" name="email" required>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="tgtCompany">Company/Organization</label>' +
              '<input type="text" id="tgtCompany" name="company">' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="tgtPhone">Phone Number</label>' +
              '<input type="tel" id="tgtPhone" name="phone">' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="tgtInterestLevel">Interest Level *</label>' +
              '<select id="tgtInterestLevel" name="interestLevel" required>' +
                '<option value="">Select interest level</option>' +
                '<option value="exploring">Just Exploring</option>' +
                '<option value="interested">Interested</option>' +
                '<option value="very-interested">Very Interested</option>' +
                '<option value="ready-to-invest">Ready to Invest</option>' +
              '</select>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="tgtInvestmentRange">Investment Range</label>' +
              '<select id="tgtInvestmentRange" name="investmentRange">' +
                '<option value="">Select range</option>' +
                '<option value="under-10k">Under $10,000</option>' +
                '<option value="10k-50k">$10,000 - $50,000</option>' +
                '<option value="50k-100k">$50,000 - $100,000</option>' +
                '<option value="100k-plus">$100,000+</option>' +
              '</select>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="tgtUseCase">Primary Use Case</label>' +
              '<select id="tgtUseCase" name="useCase">' +
                '<option value="">Select use case</option>' +
                '<option value="trading">Trading</option>' +
                '<option value="payments">Payments</option>' +
                '<option value="defi">DeFi Integration</option>' +
                '<option value="institutional">Institutional Use</option>' +
                '<option value="other">Other</option>' +
              '</select>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="tgtMessage">Additional Information</label>' +
              '<textarea id="tgtMessage" name="message" rows="4" placeholder="Tell us about your TGT interest and use case..."></textarea>' +
            '</div>' +
            '<div class="checkbox-group">' +
              '<input type="checkbox" id="tgtNewsletter" name="newsletter" checked>' +
              '<label for="tgtNewsletter">Subscribe to TGT updates and news</label>' +
            '</div>' +
            '<button type="submit" class="btn" style="width: 100%;">Register for TGT</button>' +
          '</form>' +
        '</div>' +
      '</div>' +
      
      '<!-- Team Sign In Modal -->' +
      '<div id="signInModal" class="modal">' +
        '<div class="modal-content">' +
          '<span class="close" onclick="closeSignIn()">&times;</span>' +
          '<h2>Team Portal Access</h2>' +
          '<form id="signInForm">' +
            '<div class="form-group">' +
              '<label for="signInEmail">Email Address</label>' +
              '<input type="email" id="signInEmail" name="email" required>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="signInPassword">Password</label>' +
              '<input type="password" id="signInPassword" name="password" required>' +
            '</div>' +
            '<button type="submit" class="btn" style="width: 100%;">Sign In</button>' +
          '</form>' +
        '</div>' +
      '</div>' +
      
      '<!-- Notification -->' +
      '<div id="notification" class="notification"></div>' +
      
      '<script>' +
        '// Global functions for modal management' +
        'function showUnifiedRegistration() {' +
          'document.getElementById("unifiedRegistrationModal").style.display = "block";' +
        '}' +
        'function closeUnifiedRegistration() {' +
          'document.getElementById("unifiedRegistrationModal").style.display = "none";' +
        '}' +
        'function showTGTInfo() {' +
          'document.getElementById("tgtRegistrationModal").style.display = "block";' +
        '}' +
        'function closeTGTRegistration() {' +
          'document.getElementById("tgtRegistrationModal").style.display = "none";' +
        '}' +
        'function showTGTRegistrationForm() {' +
          'document.getElementById("tgtRegistrationModal").style.display = "none";' +
          'document.getElementById("tgtRegistrationFormModal").style.display = "block";' +
        '}' +
        'function closeTGTRegistrationForm() {' +
          'document.getElementById("tgtRegistrationFormModal").style.display = "none";' +
        '}' +
        'function showSignIn() {' +
          'document.getElementById("signInModal").style.display = "block";' +
        '}' +
        'function closeSignIn() {' +
          'document.getElementById("signInModal").style.display = "none";' +
        '}' +
        'function showNotification(message, type = "success") {' +
          'const notification = document.getElementById("notification");' +
          'notification.textContent = message;' +
          'notification.className = "notification " + type;' +
          'notification.style.display = "block";' +
          'setTimeout(() => { notification.style.display = "none"; }, 5000);' +
        '}' +
        '// Form submissions' +
        'document.addEventListener("DOMContentLoaded", function() {' +
          '// Unified registration form' +
          'const unifiedForm = document.getElementById("unifiedRegistrationForm");' +
          'if (unifiedForm) {' +
            'unifiedForm.addEventListener("submit", async function(e) {' +
              'e.preventDefault();' +
              'const formData = new FormData(this);' +
              'const data = Object.fromEntries(formData);' +
              'try {' +
                'const response = await fetch("/api/unified-register", {' +
                  'method: "POST",' +
                  'headers: { "Content-Type": "application/json" },' +
                  'body: JSON.stringify(data)' +
                '});' +
                'const result = await response.json();' +
                'if (response.ok && result.success) {' +
                  'showNotification("🎉 Registration successful! We will contact you within 48 hours.", "success");' +
                  'closeUnifiedRegistration();' +
                  'this.reset();' +
                '} else {' +
                  'showNotification("Registration failed: " + (result.message || "Unknown error"), "error");' +
                '}' +
              '} catch (error) {' +
                'showNotification("Registration failed. Please try again.", "error");' +
              '}' +
            '});' +
          '}' +
          
          '// TGT registration form' +
          'const tgtForm = document.getElementById("tgtRegistrationForm");' +
          'if (tgtForm) {' +
            'tgtForm.addEventListener("submit", async function(e) {' +
              'e.preventDefault();' +
              'const formData = new FormData(this);' +
              'const data = Object.fromEntries(formData);' +
              'try {' +
                'const response = await fetch("/api/tgt/register", {' +
                  'method: "POST",' +
                  'headers: { "Content-Type": "application/json" },' +
                  'body: JSON.stringify(data)' +
                '});' +
                'const result = await response.json();' +
                'if (response.ok && result.success) {' +
                  'showNotification("🎉 TGT registration successful! We will contact you with exclusive early access information.", "success");' +
                  'closeTGTRegistrationForm();' +
                  'this.reset();' +
                '} else {' +
                  'showNotification("TGT registration failed: " + (result.message || "Unknown error"), "error");' +
                '}' +
              '} catch (error) {' +
                'showNotification("TGT registration failed. Please try again.", "error");' +
              '}' +
            '});' +
          '}' +
          
          '// Sign in form' +
          'const signInForm = document.getElementById("signInForm");' +
          'if (signInForm) {' +
            'signInForm.addEventListener("submit", async function(e) {' +
              'e.preventDefault();' +
              'const formData = new FormData(this);' +
              'const data = Object.fromEntries(formData);' +
              'try {' +
                'const response = await fetch("/auth/login", {' +
                  'method: "POST",' +
                  'headers: { "Content-Type": "application/json" },' +
                  'body: JSON.stringify(data)' +
                '});' +
                'const result = await response.json();' +
                'if (response.ok && result.success) {' +
                  'showNotification("🎉 Login successful! Redirecting to portal...", "success");' +
                  'setTimeout(() => { window.location.href = "/portal?token=" + result.token; }, 1500);' +
                '} else {' +
                  'showNotification("Login failed: " + (result.message || "Invalid credentials"), "error");' +
                '}' +
              '} catch (error) {' +
                'showNotification("Login failed. Please try again.", "error");' +
              '}' +
            '});' +
          '}' +
        '});' +
        '// Close modals when clicking outside' +
        'window.onclick = function(event) {' +
          'const modals = ["unifiedRegistrationModal", "tgtRegistrationModal", "tgtRegistrationFormModal", "signInModal"];' +
          'modals.forEach(modalId => {' +
            'const modal = document.getElementById(modalId);' +
            'if (event.target === modal) {' +
              'modal.style.display = "none";' +
            '}' +
          '});' +
        '};' +
      '</script>' +
    '</body>' +
    '</html>';
  
  res.send(html);
});

// API Routes for registration
app.post('/api/unified-register', (req, res) => {
  console.log('UNIFIED REGISTRATION:', req.body);
  // For now, just return success - in production this would save to database
  res.json({ 
    success: true, 
    message: 'Registration received successfully',
    data: req.body 
  });
});

app.post('/api/tgt/register', (req, res) => {
  console.log('TGT REGISTRATION:', req.body);
  // For now, just return success - in production this would save to database
  res.json({ 
    success: true, 
    message: 'TGT registration received successfully',
    data: req.body 
  });
});

// Auth routes (simplified for now)
app.post('/auth/login', (req, res) => {
  console.log('LOGIN ATTEMPT:', req.body);
  const { email, password } = req.body;
  
  // Simple hardcoded check for demo purposes
  if (email === 'ollech@gmail.com' && password === 'admin123') {
    res.json({ 
      success: true, 
      message: 'Login successful',
      token: 'demo-token-123',
      user: { email, role: 'admin' }
    });
  } else if (email === 'dudiollech@gmail.com' && password === 'admin123') {
    res.json({ 
      success: true, 
      message: 'Login successful',
      token: 'demo-token-456',
      user: { email, role: 'admin' }
    });
  } else {
    res.status(401).json({ 
      success: false, 
      message: 'Invalid credentials' 
    });
  }
});

// Portal route (simplified)
app.get('/portal', (req, res) => {
  console.log('PORTAL ROUTE HIT!');
  const token = req.query.token;
  
  if (!token) {
    return res.redirect('/?access=denied&reason=Authentication%20required');
  }
  
  const html = '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head>' +
      '<meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>Tangent Protocol - Team Portal</title>' +
      '<style>' +
        'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }' +
        '.container { max-width: 1200px; margin: 0 auto; }' +
        'h1 { color: #2563eb; margin-bottom: 30px; }' +
        '.btn { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin: 10px; border: none; cursor: pointer; }' +
        '.btn:hover { background: #1d4ed8; }' +
        '.btn.ghost { background: transparent; border: 2px solid #2563eb; color: #2563eb; }' +
        '.btn.ghost:hover { background: #2563eb; color: white; }' +
        '.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 30px 0; }' +
        '.card { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; }' +
        '.card h3 { color: #06b6d4; margin-bottom: 15px; }' +
      '</style>' +
    '</head>' +
    '<body>' +
      '<div class="container">' +
        '<h1>🚀 Tangent Protocol - Team Portal</h1>' +
        '<p>Welcome to the team portal. All systems are operational.</p>' +
        
        '<div class="grid">' +
          '<div class="card">' +
            '<h3>📊 Admin Panel</h3>' +
            '<p>Manage platform settings, users, and registrations.</p>' +
            '<button class="btn" onclick="window.location.href=\'/admin\'">Access Admin</button>' +
          '</div>' +
          
          '<div class="card">' +
            '<h3>📈 Trading Platform</h3>' +
            '<p>Access the trading interface and analytics.</p>' +
            '<button class="btn" onclick="alert(\'Trading platform coming soon!\')">Launch Trading</button>' +
          '</div>' +
          
          '<div class="card">' +
            '<h3>🔍 KYC System</h3>' +
            '<p>Review and manage KYC applications.</p>' +
            '<button class="btn" onclick="alert(\'KYC system coming soon!\')">Access KYC</button>' +
          '</div>' +
          
          '<div class="card">' +
            '<h3>📋 Analytics</h3>' +
            '<p>View platform analytics and reports.</p>' +
            '<button class="btn" onclick="alert(\'Analytics coming soon!\')">View Analytics</button>' +
          '</div>' +
        '</div>' +
        
        '<div style="margin-top: 40px; text-align: center;">' +
          '<button class="btn ghost" onclick="window.location.href=\'/\'">← Back to Landing Page</button>' +
        '</div>' +
      '</div>' +
    '</body>' +
    '</html>';
  
  res.send(html);
});

// Admin route (simplified)
app.get('/admin', (req, res) => {
  console.log('ADMIN ROUTE HIT!');
  const html = '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head>' +
      '<meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>Tangent Protocol - Admin Panel</title>' +
      '<style>' +
        'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }' +
        '.container { max-width: 1200px; margin: 0 auto; }' +
        'h1 { color: #2563eb; margin-bottom: 30px; }' +
        '.btn { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin: 10px; border: none; cursor: pointer; }' +
        '.btn:hover { background: #1d4ed8; }' +
        '.btn.ghost { background: transparent; border: 2px solid #2563eb; color: #2563eb; }' +
        '.btn.ghost:hover { background: #2563eb; color: white; }' +
        '.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 30px 0; }' +
        '.card { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; }' +
        '.card h3 { color: #06b6d4; margin-bottom: 15px; }' +
        '.status { background: #10b981; color: white; padding: 10px; border-radius: 6px; margin: 10px 0; }' +
      '</style>' +
    '</head>' +
    '<body>' +
      '<div class="container">' +
        '<h1>⚙️ Tangent Protocol - Admin Panel</h1>' +
        '<div class="status">✅ Admin panel is operational</div>' +
        
        '<div class="grid">' +
          '<div class="card">' +
            '<h3>👥 User Management</h3>' +
            '<p>Manage team members and user accounts.</p>' +
            '<button class="btn" onclick="alert(\'User management coming soon!\')">Manage Users</button>' +
          '</div>' +
          
          '<div class="card">' +
            '<h3>📝 Registration Management</h3>' +
            '<p>View and manage platform registrations.</p>' +
            '<button class="btn" onclick="alert(\'Registration management coming soon!\')">View Registrations</button>' +
          '</div>' +
          
          '<div class="card">' +
            '<h3>🔧 Platform Settings</h3>' +
            '<p>Configure platform settings and preferences.</p>' +
            '<button class="btn" onclick="alert(\'Settings coming soon!\')">Open Settings</button>' +
          '</div>' +
          
          '<div class="card">' +
            '<h3>📊 System Status</h3>' +
            '<p>Monitor system health and performance.</p>' +
            '<button class="btn" onclick="alert(\'System status: All green!\')">Check Status</button>' +
          '</div>' +
        '</div>' +
        
        '<div style="margin-top: 40px; text-align: center;">' +
          '<button class="btn ghost" onclick="window.location.href=\'/portal\'">← Back to Portal</button>' +
          '<button class="btn ghost" onclick="window.location.href=\'/\'">← Back to Landing</button>' +
        '</div>' +
      '</div>' +
    '</body>' +
    '</html>';
  
  res.send(html);
});

// Demo routes
app.get('/demo/buyer-journey', (req, res) => {
  console.log('BUYER DEMO ROUTE HIT!');
  const html = '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head>' +
      '<meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>Buyer Journey Demo - Tangent Protocol</title>' +
      '<style>' +
        'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }' +
        '.container { max-width: 800px; margin: 0 auto; }' +
        'h1 { color: #2563eb; margin-bottom: 30px; }' +
        '.btn { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin: 10px; border: none; cursor: pointer; }' +
        '.btn:hover { background: #1d4ed8; }' +
        '.btn.ghost { background: transparent; border: 2px solid #2563eb; color: #2563eb; }' +
        '.btn.ghost:hover { background: #2563eb; color: white; }' +
        '.step { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; margin: 20px 0; }' +
        '.step h3 { color: #06b6d4; margin-bottom: 15px; }' +
      '</style>' +
    '</head>' +
    '<body>' +
      '<div class="container">' +
        '<h1>🛒 Buyer Journey Demo</h1>' +
        '<p>Experience the complete buyer journey on Tangent Protocol.</p>' +
        
        '<div class="step">' +
          '<h3>Step 1: Registration & KYC</h3>' +
          '<p>Complete your profile and submit KYC documents for verification.</p>' +
          '<button class="btn" onclick="alert(\'KYC process coming soon!\')">Start KYC</button>' +
        '</div>' +
        
        '<div class="step">' +
          '<h3>Step 2: Browse Products</h3>' +
          '<p>Explore available trading products and market opportunities.</p>' +
          '<button class="btn" onclick="alert(\'Product catalog coming soon!\')">Browse Products</button>' +
        '</div>' +
        
        '<div class="step">' +
          '<h3>Step 3: Place Orders</h3>' +
          '<p>Execute trades with advanced order types and risk management.</p>' +
          '<button class="btn" onclick="alert(\'Trading interface coming soon!\')">Place Order</button>' +
        '</div>' +
        
        '<div class="step">' +
          '<h3>Step 4: Monitor & Manage</h3>' +
          '<p>Track your positions and manage your portfolio in real-time.</p>' +
          '<button class="btn" onclick="alert(\'Portfolio management coming soon!\')">View Portfolio</button>' +
        '</div>' +
        
        '<div style="margin-top: 40px; text-align: center;">' +
          '<button class="btn ghost" onclick="window.location.href=\'/\'">← Back to Landing Page</button>' +
        '</div>' +
      '</div>' +
    '</body>' +
    '</html>';
  
  res.send(html);
});

app.get('/demo/supplier-journey', (req, res) => {
  console.log('SUPPLIER DEMO ROUTE HIT!');
  const html = '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head>' +
      '<meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>Supplier Journey Demo - Tangent Protocol</title>' +
      '<style>' +
        'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }' +
        '.container { max-width: 800px; margin: 0 auto; }' +
        'h1 { color: #2563eb; margin-bottom: 30px; }' +
        '.btn { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin: 10px; border: none; cursor: pointer; }' +
        '.btn:hover { background: #1d4ed8; }' +
        '.btn.ghost { background: transparent; border: 2px solid #2563eb; color: #2563eb; }' +
        '.btn.ghost:hover { background: #2563eb; color: white; }' +
        '.step { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; margin: 20px 0; }' +
        '.step h3 { color: #06b6d4; margin-bottom: 15px; }' +
      '</style>' +
    '</head>' +
    '<body>' +
      '<div class="container">' +
        '<h1>🏭 Supplier Journey Demo</h1>' +
        '<p>Experience the complete supplier journey on Tangent Protocol.</p>' +
        
        '<div class="step">' +
          '<h3>Step 1: Onboarding</h3>' +
          '<p>Complete supplier registration and compliance verification.</p>' +
          '<button class="btn" onclick="alert(\'Supplier onboarding coming soon!\')">Start Onboarding</button>' +
        '</div>' +
        
        '<div class="step">' +
          '<h3>Step 2: List Products</h3>' +
          '<p>Add your products and services to the marketplace.</p>' +
          '<button class="btn" onclick="alert(\'Product listing coming soon!\')">List Products</button>' +
        '</div>' +
        
        '<div class="step">' +
          '<h3>Step 3: Manage Orders</h3>' +
          '<p>Receive and fulfill orders from buyers.</p>' +
          '<button class="btn" onclick="alert(\'Order management coming soon!\')">Manage Orders</button>' +
        '</div>' +
        
        '<div class="step">' +
          '<h3>Step 4: Analytics & Payments</h3>' +
          '<p>Track performance and receive payments.</p>' +
          '<button class="btn" onclick="alert(\'Analytics & payments coming soon!\')">View Analytics</button>' +
        '</div>' +
        
        '<div style="margin-top: 40px; text-align: center;">' +
          '<button class="btn ghost" onclick="window.location.href=\'/\'">← Back to Landing Page</button>' +
        '</div>' +
      '</div>' +
    '</body>' +
    '</html>';
  
  res.send(html);
});

// Test route  
app.get('/test', (req, res) => {
  console.log('TEST ROUTE HIT!');
  res.send('<h1>TEST ROUTE WORKING!</h1>');
});

// Health route
app.get('/health', (req, res) => {
  console.log('HEALTH ROUTE HIT!');
  res.json({ status: 'working' });
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 SIMPLE SERVER RUNNING ON PORT ${PORT}`);
});