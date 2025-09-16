const express = require('express');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Access Control Middleware
app.use('/portal', (req, res, next) => {
  // For now, allow access - you can add authentication later
  console.log('Portal access requested:', req.path);
  next();
});

app.use('/admin', (req, res, next) => {
  // For now, allow access - you can add authentication later
  console.log('Admin access requested:', req.path);
  next();
});

// Add CSP headers for Google Analytics
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
    "connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com",
    "img-src 'self' data: https://www.google-analytics.com",
    "style-src 'self' 'unsafe-inline'",
    "frame-src 'self'"
  ].join('; '));
  next();
});

// Original Landing Page with Split Layout
app.get('/', (req, res) => {
  console.log('ROOT ROUTE HIT!');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tangent Protocol — Advanced Trading Platform & TGT Stablecoin</title>
  
  <!-- Google Analytics 4 -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${process.env.GA_MEASUREMENT_ID || 'G-CBKJR8V7QB'}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'granted' });
    gtag('js', new Date());
    gtag('config', '${process.env.GA_MEASUREMENT_ID || 'G-CBKJR8V7QB'}', { 
      anonymize_ip: true, 
      allow_google_signals: false 
    });
  </script>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      background: #0f172a; 
      color: #f8fafc; 
      margin: 0; 
      padding: 0; 
    }
    .container { 
      max-width: 1400px; 
      margin: 0 auto; 
      padding: 40px 20px; 
    }
    .header { 
      text-align: center; 
      margin-bottom: 80px; 
    }
    h1 { 
      font-size: 4rem; 
      font-weight: 700; 
      margin-bottom: 20px; 
      background: linear-gradient(135deg, #2563eb, #06b6d4); 
      -webkit-background-clip: text; 
      -webkit-text-fill-color: transparent; 
      background-clip: text; 
    }
    .subtitle { 
      font-size: 1.5rem; 
      color: #94a3b8; 
      margin-bottom: 40px; 
    }
    .main-content { 
      display: grid; 
      grid-template-columns: 1fr 1fr; 
      gap: 60px; 
      margin: 80px 0; 
    }
    .platform-section, .tgt-section { 
      background: #1e293b; 
      padding: 50px; 
      border-radius: 20px; 
      border: 1px solid #334155; 
      text-align: center; 
    }
    .platform-section h2, .tgt-section h2 { 
      font-size: 2.5rem; 
      margin-bottom: 30px; 
    }
    .platform-section h2 { 
      color: #2563eb; 
    }
    .tgt-section h2 { 
      color: #06b6d4; 
    }
    .section-description { 
      font-size: 1.2rem; 
      color: #94a3b8; 
      margin-bottom: 40px; 
      line-height: 1.6; 
    }
    .features-list { 
      text-align: left; 
      margin: 30px 0; 
    }
    .features-list ul { 
      list-style: none; 
      padding: 0; 
    }
    .features-list li { 
      padding: 12px 0; 
      color: #cbd5e1; 
      font-size: 1.1rem; 
      border-bottom: 1px solid #334155; 
    }
    .features-list li:last-child { 
      border-bottom: none; 
    }
    .features-list li::before { 
      content: "✓ "; 
      color: #10b981; 
      font-weight: bold; 
      margin-right: 10px; 
    }
    .registration-section { 
      margin-top: 80px; 
      text-align: center; 
      padding: 50px; 
      background: #1e293b; 
      border-radius: 16px; 
      border: 1px solid #334155; 
    }
    .registration-section h3 { 
      color: #2563eb; 
      margin-bottom: 20px; 
      font-size: 2rem; 
    }
    .registration-section p { 
      color: #94a3b8; 
      margin-bottom: 30px; 
      font-size: 1.2rem; 
    }
    .btn { 
      display: inline-block; 
      padding: 15px 30px; 
      background: #2563eb; 
      color: white; 
      text-decoration: none; 
      border-radius: 12px; 
      margin: 10px; 
      border: none; 
      cursor: pointer; 
      font-size: 16px; 
      font-weight: 600; 
      transition: all 0.3s ease; 
      box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3); 
    }
    .btn:hover { 
      background: #1d4ed8; 
      transform: translateY(-2px); 
      box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4); 
    }
    .btn.ghost { 
      background: transparent; 
      border: 2px solid #2563eb; 
      color: #2563eb; 
      box-shadow: none; 
    }
    .btn.ghost:hover { 
      background: #2563eb; 
      color: white; 
    }
    .status { 
      margin-top: 60px; 
      padding: 30px; 
      background: #1e293b; 
      border-radius: 16px; 
      border: 1px solid #334155; 
      text-align: center; 
    }
    .status h3 { 
      color: #06b6d4; 
      margin-bottom: 20px; 
    }
    .status p { 
      margin: 10px 0; 
      color: #94a3b8; 
    }
    .modal { 
      display: none; 
      position: fixed; 
      z-index: 1000; 
      left: 0; 
      top: 0; 
      width: 100%; 
      height: 100%; 
      background-color: rgba(0,0,0,0.8); 
    }
    .modal-content { 
      background-color: #1e293b; 
      margin: 5% auto; 
      padding: 30px; 
      border-radius: 16px; 
      width: 90%; 
      max-width: 500px; 
      border: 1px solid #334155; 
    }
    .form-group { 
      margin-bottom: 20px; 
    }
    .form-group label { 
      display: block; 
      margin-bottom: 8px; 
      color: #f8fafc; 
      font-weight: 600; 
    }
    .form-group input, .form-group select, .form-group textarea { 
      width: 100%; 
      padding: 12px; 
      border: 1px solid #334155; 
      border-radius: 8px; 
      background: #0f172a; 
      color: #f8fafc; 
      font-size: 16px; 
    }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { 
      outline: none; 
      border-color: #2563eb; 
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); 
    }
    .close { 
      color: #94a3b8; 
      float: right; 
      font-size: 28px; 
      font-weight: bold; 
      cursor: pointer; 
    }
    .close:hover { 
      color: #f8fafc; 
    }
    .checkbox-group { 
      display: flex; 
      align-items: center; 
      margin: 15px 0; 
    }
    .checkbox-group input[type="checkbox"] { 
      margin-right: 10px; 
    }
    .notification { 
      position: fixed; 
      top: 20px; 
      right: 20px; 
      background: #10b981; 
      color: white; 
      padding: 15px 20px; 
      border-radius: 8px; 
      z-index: 1001; 
      display: none; 
    }
    .notification.error { 
      background: #ef4444; 
    }
    .notification.warning { 
      background: #f59e0b; 
    }
    .notification.info { 
      background: #3b82f6; 
    }
    @media (max-width: 768px) { 
      h1 { font-size: 2.5rem; } 
      .main-content { grid-template-columns: 1fr; gap: 40px; }
      .platform-section, .tgt-section { padding: 30px; }
      .btn { display: block; width: 100%; margin: 10px 0; } 
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Tangent Protocol</h1>
      <p class="subtitle">Advanced Trading Platform & TGT Stablecoin</p>
    </div>
    
    <div class="main-content">
      <!-- Platform Section -->
      <div class="platform-section">
        <h2>🚀 Trading Platform</h2>
        <p class="section-description">
          Experience next-generation trading with institutional-grade tools, real-time analytics, and seamless execution.
        </p>
        <div class="features-list">
          <ul>
            <li>Real-time market data and analytics</li>
            <li>Advanced order types and execution</li>
            <li>Comprehensive risk management</li>
            <li>Portfolio analytics and reporting</li>
            <li>Multi-asset trading support</li>
            <li>Institutional-grade security</li>
          </ul>
        </div>
      </div>
      
      <!-- TGT Stablecoin Section -->
      <div class="tgt-section">
        <h2>💎 TGT Stablecoin</h2>
        <p class="section-description">
          Discover the benefits of our innovative TGT stablecoin - designed for stability, transparency, and seamless integration.
        </p>
        <div class="features-list">
          <ul>
            <li>Advanced price stability mechanisms</li>
            <li>Transparent reserve management</li>
            <li>Ultra-low transaction costs</li>
            <li>Seamless DeFi integration</li>
            <li>Regulatory compliance ready</li>
            <li>Fast settlement times</li>
          </ul>
        </div>
      </div>
    </div>
    
    <!-- Registration Section -->
    <div class="registration-section">
      <h3>Get Started with Tangent Protocol</h3>
      <p>Join the future of trading and discover the power of TGT stablecoin</p>
      <div style="margin: 30px 0;">
        <button class="btn" onclick="window.location.href='/register'">Register Interest (Early Access)</button>
        <button class="btn secondary" onclick="window.location.href='/tgt-info'">Learn About TGT</button>
      </div>
    </div>
    
    
    <div class="status">
      <h3>🚀 Platform Status</h3>
      <p><strong>Server:</strong> ✅ Online and Running</p>
      <p><strong>DNS Routing:</strong> ✅ Working</p>
      <p><strong>SSL Certificates:</strong> ✅ Active</p>
      <p><strong>Version:</strong> 2.0.2-WORKING-BUTTONS-${Date.now()}</p>
      <p><strong>Last Updated:</strong> ${new Date().toISOString()}</p>
    </div>
    
    <div style="margin-top: 30px; text-align: center;">
      <a href="/test" style="color: #2563eb; text-decoration: none; margin: 0 15px;">🧪 Test Server</a>
      <a href="/health" style="color: #2563eb; text-decoration: none; margin: 0 15px;">📊 Health Check</a>
      <a href="/button-test" style="color: #2563eb; text-decoration: none; margin: 0 15px;">🔧 Button Test</a>
      <button onclick="showUnifiedRegistration()" style="color: #2563eb; background: none; border: 1px solid #2563eb; padding: 5px 10px; margin: 0 15px; border-radius: 4px; cursor: pointer;">🔧 Test Modal</button>
    </div>
    
    <!-- Team Access Section -->
    <div style="text-align: center; margin-top: 40px; padding: 30px; border-top: 1px solid #334155; background: rgba(6, 182, 212, 0.05);">
      <p style="color: #94a3b8; font-size: 1rem; margin-bottom: 15px;">🔐 Authorized team members</p>
      <a href="/login" style="color: #06b6d4; text-decoration: none; font-size: 1rem; padding: 12px 24px; border: 2px solid #06b6d4; border-radius: 8px; transition: all 0.3s; font-weight: 500;" onmouseover="this.style.background='#06b6d4'; this.style.color='white'; this.style.transform='translateY(-2px)'" onmouseout="this.style.background='transparent'; this.style.color='#06b6d4'; this.style.transform='translateY(0)'">Team Portal</a>
    </div>
  </div>
  
  <!-- Unified Registration Modal -->
  <div id="unifiedRegistrationModal" class="modal">
    <div class="modal-content">
      <span class="close" onclick="closeUnifiedRegistration()">&times;</span>
      <h2>Join Tangent Protocol</h2>
      <form id="unifiedRegistrationForm">
        <div class="form-group">
          <label for="name">Full Name *</label>
          <input type="text" id="name" name="name" required>
        </div>
        <div class="form-group">
          <label for="email">Email Address *</label>
          <input type="email" id="email" name="email" required>
        </div>
        <div class="form-group">
          <label for="company">Company/Organization</label>
          <input type="text" id="company" name="company">
        </div>
        <div class="form-group">
          <label for="phone">Phone Number</label>
          <input type="tel" id="phone" name="phone">
        </div>
        <div class="form-group">
          <label for="interest">Primary Interest *</label>
          <select id="interest" name="interest" required>
            <option value="">Select your interest</option>
            <option value="platform">Trading Platform</option>
            <option value="tgt">TGT Stablecoin</option>
            <option value="both">Both Platform & TGT</option>
          </select>
        </div>
        <div class="form-group">
          <label for="message">Additional Information</label>
          <textarea id="message" name="message" rows="4" placeholder="Tell us about your trading needs, TGT interest, or any questions..."></textarea>
        </div>
        <div class="checkbox-group">
          <input type="checkbox" id="newsletter" name="newsletter" checked>
          <label for="newsletter">Subscribe to updates and news</label>
        </div>
        <button type="submit" class="btn" style="width: 100%;">Submit Registration</button>
      </form>
    </div>
  </div>
  
  <!-- TGT Registration Modal -->
  <div id="tgtRegistrationModal" class="modal">
    <div class="modal-content">
      <span class="close" onclick="closeTGTRegistration()">&times;</span>
      <h2>TGT Stablecoin Information</h2>
      <div style="margin-bottom: 30px;">
        <h3>What is TGT?</h3>
        <p>TGT is our innovative stablecoin designed for maximum stability, transparency, and efficiency. Built with advanced algorithmic mechanisms and backed by diversified reserves.</p>
        <h3>Key Benefits:</h3>
        <ul>
          <li>Ultra-stable price maintenance</li>
          <li>Transparent reserve reporting</li>
          <li>Low transaction fees</li>
          <li>Fast settlement times</li>
          <li>Regulatory compliance</li>
        </ul>
      </div>
      <button class="btn" onclick="showTGTRegistrationForm()">Register for TGT Updates</button>
    </div>
  </div>
  
  <!-- TGT Registration Form Modal -->
  <div id="tgtRegistrationFormModal" class="modal">
    <div class="modal-content">
      <span class="close" onclick="closeTGTRegistrationForm()">&times;</span>
      <h2>TGT Stablecoin Registration</h2>
      <form id="tgtRegistrationForm">
        <div class="form-group">
          <label for="tgtName">Full Name *</label>
          <input type="text" id="tgtName" name="name" required>
        </div>
        <div class="form-group">
          <label for="tgtEmail">Email Address *</label>
          <input type="email" id="tgtEmail" name="email" required>
        </div>
        <div class="form-group">
          <label for="tgtCompany">Company/Organization</label>
          <input type="text" id="tgtCompany" name="company">
        </div>
        <div class="form-group">
          <label for="tgtPhone">Phone Number</label>
          <input type="tel" id="tgtPhone" name="phone">
        </div>
        <div class="form-group">
          <label for="tgtInterestLevel">Interest Level *</label>
          <select id="tgtInterestLevel" name="interestLevel" required>
            <option value="">Select interest level</option>
            <option value="exploring">Just Exploring</option>
            <option value="interested">Interested</option>
            <option value="very-interested">Very Interested</option>
            <option value="ready-to-invest">Ready to Invest</option>
          </select>
        </div>
        <div class="form-group">
          <label for="tgtInvestmentRange">Investment Range</label>
          <select id="tgtInvestmentRange" name="investmentRange">
            <option value="">Select range</option>
            <option value="under-10k">Under $10,000</option>
            <option value="10k-50k">$10,000 - $50,000</option>
            <option value="50k-100k">$50,000 - $100,000</option>
            <option value="100k-plus">$100,000+</option>
          </select>
        </div>
        <div class="form-group">
          <label for="tgtUseCase">Primary Use Case</label>
          <select id="tgtUseCase" name="useCase">
            <option value="">Select use case</option>
            <option value="trading">Trading</option>
            <option value="payments">Payments</option>
            <option value="defi">DeFi Integration</option>
            <option value="institutional">Institutional Use</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="form-group">
          <label for="tgtMessage">Additional Information</label>
          <textarea id="tgtMessage" name="message" rows="4" placeholder="Tell us about your TGT interest and use case..."></textarea>
        </div>
        <div class="checkbox-group">
          <input type="checkbox" id="tgtNewsletter" name="newsletter" checked>
          <label for="tgtNewsletter">Subscribe to TGT updates and news</label>
        </div>
        <button type="submit" class="btn" style="width: 100%;">Register for TGT</button>
      </form>
    </div>
  </div>
  
  
  <!-- Notification -->
  <div id="notification" class="notification"></div>
  
  <script>
    // Global functions for modal management
    function showUnifiedRegistration() {
      console.log('Opening unified registration modal');
      const modal = document.getElementById("unifiedRegistrationModal");
      if (modal) {
        modal.style.display = "block";
        modal.style.zIndex = "10000";
        modal.style.position = "fixed";
        modal.style.top = "0";
        modal.style.left = "0";
        modal.style.width = "100%";
        modal.style.height = "100%";
        console.log('Unified registration modal opened successfully');
        // Force visibility
        setTimeout(() => {
          if (modal.style.display === "block") {
            console.log('Modal is visible');
          } else {
            console.error('Modal not visible after timeout');
          }
        }, 100);
      } else {
        console.error('Unified registration modal not found!');
        alert('Registration modal not found. Please refresh the page.');
      }
    }
    
    function closeUnifiedRegistration() {
      document.getElementById("unifiedRegistrationModal").style.display = "none";
    }
    
    function showTGTInfo() {
      console.log('Opening TGT info modal');
      const modal = document.getElementById("tgtRegistrationModal");
      if (modal) {
        modal.style.display = "block";
        modal.style.zIndex = "10000";
        modal.style.position = "fixed";
        modal.style.top = "0";
        modal.style.left = "0";
        modal.style.width = "100%";
        modal.style.height = "100%";
        console.log('TGT modal opened successfully');
      } else {
        console.error('TGT modal not found!');
        alert('TGT modal not found. Please refresh the page.');
      }
    }
    
    function closeTGTRegistration() {
      document.getElementById("tgtRegistrationModal").style.display = "none";
    }
    
    function showTGTRegistrationForm() {
      document.getElementById("tgtRegistrationModal").style.display = "none";
      document.getElementById("tgtRegistrationFormModal").style.display = "block";
    }
    
    function closeTGTRegistrationForm() {
      document.getElementById("tgtRegistrationFormModal").style.display = "none";
    }
    
    
    function showNotification(message, type = "success") {
      const notification = document.getElementById("notification");
      notification.textContent = message;
      notification.className = "notification " + type;
      notification.style.display = "block";
      setTimeout(() => { notification.style.display = "none"; }, 5000);
    }
    
    // Google Analytics 4 tracking functions
    function trackLead(formId = 'early_access') {
      if (typeof gtag !== 'undefined') {
        gtag('event', 'lead', { form_id: formId });
      }
    }
    
    function trackOutbound(linkUrl) {
      if (typeof gtag !== 'undefined') {
        gtag('event', 'outbound_click', { link_url: linkUrl });
      }
    }
    
    // Track outbound clicks automatically
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a[href]');
      if (!link) return;
      
      const isOutbound = link.host !== location.host;
      if (isOutbound) {
        trackOutbound(link.href);
      }
    }, true);
    
    // Form submissions
    document.addEventListener("DOMContentLoaded", function() {
      console.log('DOM loaded, setting up event listeners');
      
      // Unified registration form
      const unifiedForm = document.getElementById("unifiedRegistrationForm");
      if (unifiedForm) {
        unifiedForm.addEventListener("submit", async function(e) {
          e.preventDefault();
          console.log('Unified registration form submitted');
          const formData = new FormData(this);
          const data = Object.fromEntries(formData);
          try {
            const response = await fetch("/api/unified-register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data)
            });
            const result = await response.json();
            if (response.ok && result.success) {
              showNotification("🎉 Registration successful! We will contact you within 48 hours.", "success");
              trackLead('unified_registration');
              closeUnifiedRegistration();
              this.reset();
            } else {
              showNotification("Registration failed: " + (result.message || "Unknown error"), "error");
            }
          } catch (error) {
            showNotification("Registration failed. Please try again.", "error");
          }
        });
      }
      
      // TGT registration form
      const tgtForm = document.getElementById("tgtRegistrationForm");
      if (tgtForm) {
        tgtForm.addEventListener("submit", async function(e) {
          e.preventDefault();
          console.log('TGT registration form submitted');
          const formData = new FormData(this);
          const data = Object.fromEntries(formData);
          try {
            const response = await fetch("/api/tgt/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data)
            });
            const result = await response.json();
            if (response.ok && result.success) {
              showNotification("🎉 TGT registration successful! We will contact you with exclusive early access information.", "success");
              trackLead('tgt_registration');
              closeTGTRegistrationForm();
              this.reset();
            } else {
              showNotification("TGT registration failed: " + (result.message || "Unknown error"), "error");
            }
          } catch (error) {
            showNotification("TGT registration failed. Please try again.", "error");
          }
        });
      }
      
    });
    
    // Close modals when clicking outside
    window.onclick = function(event) {
      const modals = ["unifiedRegistrationModal", "tgtRegistrationModal", "tgtRegistrationFormModal"];
      modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (event.target === modal) {
          modal.style.display = "none";
        }
      });
    };
  </script>
</body>
</html>`;
  
  res.send(html);
});

// KYC Page
app.get('/kyc', (req, res) => {
  console.log('KYC ROUTE HIT!');
  const type = req.query.type;
  
  if (!type) {
    return res.redirect('/?error=Please select KYC type');
  }
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KYC Verification - Tangent Protocol</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #2563eb; margin-bottom: 30px; }
    .btn { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin: 10px; border: none; cursor: pointer; }
    .btn:hover { background: #1d4ed8; }
    .btn.ghost { background: transparent; border: 2px solid #2563eb; color: #2563eb; }
    .btn.ghost:hover { background: #2563eb; color: white; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; color: #f8fafc; font-weight: 600; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 12px; border: 1px solid #334155; border-radius: 8px; background: #0f172a; color: #f8fafc; font-size: 16px; }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
    .upload-area { border: 2px dashed #334155; padding: 40px; text-align: center; border-radius: 8px; margin: 20px 0; }
    .upload-area:hover { border-color: #2563eb; }
    .card { background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #334155; margin: 20px 0; }
    .card h3 { color: #06b6d4; margin-bottom: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 KYC Verification</h1>
    <p>Complete your Know Your Customer verification to access the platform</p>
    
    <div class="card">
      <h3>Account Type: ${type === 'private' ? 'Private Person' : 'Public Listed Company'}</h3>
      <p>Please upload the required documents for verification</p>
    </div>
    
    <form id="kycForm">
      ${type === 'private' ? `
        <div class="card">
          <h3>Personal Documents Required</h3>
          <div class="form-group">
            <label>Government ID (Passport, Driver's License, National ID)</label>
            <div class="upload-area">
              <p>Click to upload or drag and drop</p>
              <input type="file" name="governmentId" accept="image/*,.pdf" required>
            </div>
          </div>
          <div class="form-group">
            <label>Proof of Address (Utility bill, Bank statement, Tax document)</label>
            <div class="upload-area">
              <p>Click to upload or drag and drop</p>
              <input type="file" name="proofOfAddress" accept="image/*,.pdf" required>
            </div>
          </div>
          <div class="form-group">
            <label>Proof of Income (Bank statement, Tax return, Salary certificate)</label>
            <div class="upload-area">
              <p>Click to upload or drag and drop</p>
              <input type="file" name="proofOfIncome" accept="image/*,.pdf" required>
            </div>
          </div>
        </div>
      ` : `
        <div class="card">
          <h3>Public Company Documents Required</h3>
          <div class="form-group">
            <label>Certificate of Incorporation</label>
            <div class="upload-area">
              <p>Click to upload or drag and drop</p>
              <input type="file" name="certificateOfIncorporation" accept="image/*,.pdf" required>
            </div>
          </div>
          <div class="form-group">
            <label>Articles of Association</label>
            <div class="upload-area">
              <p>Click to upload or drag and drop</p>
              <input type="file" name="articlesOfAssociation" accept="image/*,.pdf" required>
            </div>
          </div>
          <div class="form-group">
            <label>Annual Report (Latest 2 years)</label>
            <div class="upload-area">
              <p>Click to upload or drag and drop</p>
              <input type="file" name="annualReport" accept="image/*,.pdf" required>
            </div>
          </div>
          <div class="form-group">
            <label>Audited Financial Statements (Latest 2 years)</label>
            <div class="upload-area">
              <p>Click to upload or drag and drop</p>
              <input type="file" name="financialStatements" accept="image/*,.pdf" required>
            </div>
          </div>
          <div class="form-group">
            <label>Stock Exchange Listing Certificate</label>
            <div class="upload-area">
              <p>Click to upload or drag and drop</p>
              <input type="file" name="listingCertificate" accept="image/*,.pdf" required>
            </div>
          </div>
          <div class="form-group">
            <label>Beneficial Ownership Declaration</label>
            <div class="upload-area">
              <p>Click to upload or drag and drop</p>
              <input type="file" name="beneficialOwnership" accept="image/*,.pdf" required>
            </div>
          </div>
        </div>
      `}
      
      <div class="card">
        <h3>Additional Information</h3>
        <div class="form-group">
          <label for="kycNotes">Additional Notes (Optional)</label>
          <textarea id="kycNotes" name="notes" rows="4" placeholder="Any additional information that might help with verification..."></textarea>
        </div>
      </div>
      
      <button type="submit" class="btn" style="width: 100%;">Submit KYC Application</button>
    </form>
    
    <div style="margin-top: 40px; text-align: center;">
      <button class="btn ghost" onclick="window.location.href='/'">← Back to Landing Page</button>
    </div>
  </div>
  
  <script>
    document.getElementById("kycForm").addEventListener("submit", async function(e) {
      e.preventDefault();
      console.log('KYC form submitted');
      const formData = new FormData(this);
      try {
        const response = await fetch("/api/kyc/submit", {
          method: "POST",
          body: formData
        });
        const result = await response.json();
        if (response.ok && result.success) {
          alert("🎉 KYC application submitted successfully! You will be notified once verification is complete.");
          window.location.href = "/dashboard";
        } else {
          alert("KYC submission failed: " + (result.message || "Unknown error"));
        }
      } catch (error) {
        alert("KYC submission failed. Please try again.");
      }
    });
  </script>
</body>
</html>`;
  
  res.send(html);
});

// Dashboard Page
app.get('/dashboard', (req, res) => {
  console.log('DASHBOARD ROUTE HIT!');
  // For now, allow access without token - you can add authentication later
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - Tangent Protocol</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #2563eb; margin-bottom: 30px; }
    .nav { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #334155; }
    .nav a { color: #06b6d4; text-decoration: none; margin-right: 20px; padding: 8px 16px; border-radius: 6px; transition: all 0.3s; }
    .nav a:hover { background: #06b6d4; color: white; }
    .btn { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin: 10px; border: none; cursor: pointer; }
    .btn:hover { background: #1d4ed8; }
    .btn.ghost { background: transparent; border: 2px solid #2563eb; color: #2563eb; }
    .btn.ghost:hover { background: #2563eb; color: white; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 30px 0; }
    .card { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; }
    .card h3 { color: #06b6d4; margin-bottom: 15px; }
    .status { background: #10b981; color: white; padding: 10px; border-radius: 6px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/portal">Home</a>
      <a href="/admin">Admin</a>
      <a href="/dashboard">Dashboard</a>
      <a href="/portal/kyc">KYC</a>
      <a href="/portal/trade">Trade</a>
      <a href="/portal/analytics">Analytics</a>
      <a href="/">Landing Page</a>
    </div>
    
    <h1>📊 Tangent Protocol Dashboard</h1>
    <div class="status">✅ Welcome to your dashboard</div>
    
    <div class="grid">
      <div class="card">
        <h3>💼 Upload Transactions</h3>
        <p>Upload and manage your trading transactions</p>
        <button class="btn" onclick="window.location.href='/portal/trade'">Upload Transactions</button>
      </div>
      
      <div class="card">
        <h3>💳 Make Payments</h3>
        <p>Process payments and manage your account</p>
        <button class="btn" onclick="window.location.href='/portal/insurance'">Make Payment</button>
      </div>
      
      <div class="card">
        <h3>📈 Trading Platform</h3>
        <p>Access the trading interface</p>
        <button class="btn" onclick="window.location.href='/portal/trade'">Launch Trading</button>
      </div>
      
      <div class="card">
        <h3>📋 Portfolio</h3>
        <p>View your portfolio and positions</p>
        <button class="btn" onclick="window.location.href='/portal/analytics'">View Portfolio</button>
      </div>
      
      <div class="card">
        <h3>🔍 KYC Status</h3>
        <p>Check your verification status</p>
        <button class="btn" onclick="window.location.href='/portal/kyc'">Check Status</button>
      </div>
      
      <div class="card">
        <h3>⚙️ Settings</h3>
        <p>Manage your account settings</p>
        <button class="btn" onclick="window.location.href='/admin'">Open Settings</button>
      </div>
    </div>
    
    <div style="margin-top: 40px; text-align: center;">
      <button class="btn ghost" onclick="window.location.href='/'">← Back to Landing Page</button>
    </div>
  </div>
</body>
</html>`;
  
  res.send(html);
});

// API Routes for registration
app.post('/api/unified-register', (req, res) => {
  console.log('UNIFIED REGISTRATION:', req.body);
  res.json({ 
    success: true, 
    message: 'Registration received successfully',
    data: req.body 
  });
});

app.post('/api/tgt/register', (req, res) => {
  console.log('TGT REGISTRATION:', req.body);
  res.json({ 
    success: true, 
    message: 'TGT registration received successfully',
    data: req.body 
  });
});

// Auth routes
app.post('/auth/login', (req, res) => {
  console.log('LOGIN ATTEMPT:', req.body);
  const { email, password } = req.body;
  
  // Simple hardcoded check for demo purposes
  if (email === 'admin@tangent-protocol.com' && password === 'TangentAdmin2024!') {
    res.json({ 
      success: true, 
      message: 'Login successful',
      token: 'demo-token-123',
      user: { email, role: 'admin' }
    });
  } else if (email === 'dudiollech@gmail.com' && password === 'TangentAdmin2024!') {
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

app.post('/auth/register', (req, res) => {
  console.log('REGISTRATION ATTEMPT:', req.body);
  const { email, password, userType } = req.body;
  
  // For now, just return success - in production this would save to database
  res.json({ 
    success: true, 
    message: 'Registration successful',
    token: 'demo-token-' + Date.now(),
    user: { email, role: 'user', type: userType }
  });
});

// KYC API
app.post('/api/kyc/submit', (req, res) => {
  console.log('KYC SUBMISSION:', req.body);
  // For now, just return success - in production this would save to database
  res.json({ 
    success: true, 
    message: 'KYC application submitted successfully'
  });
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

// Button Test Page
app.get('/button-test', (req, res) => {
  console.log('BUTTON TEST ROUTE HIT!');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Button Test — Tangent Platform</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      background: #0f172a; 
      color: #f8fafc; 
      margin: 0; 
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #06b6d4; margin-bottom: 30px; }
    .test-section { 
      background: #1e293b; 
      padding: 20px; 
      border-radius: 8px; 
      margin-bottom: 20px; 
    }
    .btn { 
      display: inline-block; 
      padding: 15px 30px; 
      background: #2563eb; 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      margin: 10px; 
      transition: background 0.3s;
      cursor: pointer;
      border: none;
    }
    .btn:hover { background: #1d4ed8; }
    .btn.secondary { background: #374151; }
    .btn.secondary:hover { background: #4b5563; }
    .status { margin-left: 10px; font-weight: bold; }
    .working { color: #10b981; }
    .broken { color: #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔧 Button Test Page</h1>
    
    <div class="test-section">
      <h2>Landing Page Buttons</h2>
      <button class="btn" onclick="testModal('unifiedRegistrationModal')">Register Interest Modal</button>
      <button class="btn secondary" onclick="testModal('tgtRegistrationModal')">Learn About TGT Modal</button>
      <span class="status" id="modal-status">Click buttons to test</span>
    </div>
    
    <div class="test-section">
      <h2>Navigation Links</h2>
      <a href="/portal" class="btn">Team Portal</a>
      <a href="/admin" class="btn">Admin Panel</a>
      <a href="/dashboard" class="btn">Dashboard</a>
      <a href="/" class="btn">Landing Page</a>
    </div>
    
    <div class="test-section">
      <h2>Portal Features</h2>
      <a href="/portal/kyc" class="btn">KYC System</a>
      <a href="/portal/trade" class="btn">Trade Desk</a>
      <a href="/portal/analytics" class="btn">Analytics</a>
      <a href="/portal/auctions" class="btn">Auctions</a>
      <a href="/portal/insurance" class="btn">Insurance</a>
      <a href="/portal/interactive-demo" class="btn">Interactive Demo</a>
    </div>
    
    <div class="test-section">
      <h2>Test Results</h2>
      <div id="test-results">
        <p>Click buttons above to test functionality...</p>
      </div>
    </div>
  </div>
  
  <script>
    function testModal(modalId) {
      const modal = document.getElementById(modalId);
      const status = document.getElementById('modal-status');
      const results = document.getElementById('test-results');
      
      if (modal) {
        modal.style.display = 'block';
        status.innerHTML = '<span class="working">✅ Modal opened successfully</span>';
        results.innerHTML += '<p class="working">✅ ' + modalId + ' modal works</p>';
        
        // Close modal after 2 seconds
        setTimeout(() => {
          modal.style.display = 'none';
        }, 2000);
      } else {
        status.innerHTML = '<span class="broken">❌ Modal not found</span>';
        results.innerHTML += '<p class="broken">❌ ' + modalId + ' modal not found</p>';
      }
    }
    
    // Test all modals on page load
    window.onload = function() {
      const modals = ['unifiedRegistrationModal', 'tgtRegistrationModal', 'tgtRegistrationFormModal'];
      const results = document.getElementById('test-results');
      
      modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
          results.innerHTML += '<p class="working">✅ ' + modalId + ' exists</p>';
        } else {
          results.innerHTML += '<p class="broken">❌ ' + modalId + ' missing</p>';
        }
      });
    };
  </script>
</body>
</html>`;
  
  res.send(html);
});

// Page Functions
function pageHome() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tangent Protocol — Advanced Trading Platform & TGT Stablecoin</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      background: #0f172a; 
      color: #f8fafc; 
      margin: 0; 
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #06b6d4; margin-bottom: 30px; }
    .nav { margin-bottom: 30px; }
    .nav a { color: #94a3b8; text-decoration: none; margin-right: 20px; }
    .nav a:hover { color: #06b6d4; }
    .card { background: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .btn { 
      display: inline-block; 
      padding: 15px 30px; 
      background: #2563eb; 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      margin: 10px; 
      transition: background 0.3s;
      cursor: pointer;
      border: none;
    }
    .btn:hover { background: #1d4ed8; }
    .grid { display: grid; gap: 20px; }
    .grid-3 { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/portal">Home</a>
      <a href="/admin">Admin</a>
      <a href="/dashboard">Dashboard</a>
      <a href="/">Landing Page</a>
    </div>
    <h1>🚀 Tangent Platform Dashboard</h1>
    <div class="card">
      <h2>Welcome to Your Trading Dashboard</h2>
      <p>Manage your trades, track performance, and access advanced trading tools.</p>
    </div>
    <div class="card">
      <h2>Quick Actions</h2>
      <div class="grid grid-3">
        <button class="btn" onclick="window.location.href='/portal/kyc'">
          📋 Submit KYC
        </button>
        <button class="btn" onclick="window.location.href='/portal/trade'">
          💼 Trade Desk
        </button>
        <button class="btn" onclick="window.location.href='/portal/analytics'">
          📊 Analytics
        </button>
        <button class="btn" onclick="window.location.href='/portal/auctions'">
          🏆 Auctions
        </button>
        <button class="btn" onclick="window.location.href='/portal/insurance'">
          🛡️ Insurance
        </button>
        <button class="btn" onclick="window.location.href='/portal/interactive-demo'">
          🎮 Interactive Demo
        </button>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function pageCompleteAdmin() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tangent Platform — Admin Panel</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      background: #0f172a; 
      color: #f8fafc; 
      margin: 0; 
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #06b6d4; margin-bottom: 30px; }
    .nav { margin-bottom: 30px; }
    .nav a { color: #94a3b8; text-decoration: none; margin-right: 20px; }
    .nav a:hover { color: #06b6d4; }
    .card { background: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .btn { 
      display: inline-block; 
      padding: 15px 30px; 
      background: #2563eb; 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      margin: 10px; 
      transition: background 0.3s;
      cursor: pointer;
      border: none;
    }
    .btn:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/portal">Home</a>
      <a href="/admin">Admin</a>
      <a href="/dashboard">Dashboard</a>
      <a href="/">Landing Page</a>
    </div>
    <h1>⚙️ Admin Panel</h1>
    <div class="card">
      <h2>Platform Management</h2>
      <p>Manage platform settings, user accounts, and system configuration.</p>
      <div style="margin-top: 20px;">
        <button class="btn" onclick="showNotification('User management coming soon!', 'info')">👥 Manage Users</button>
        <button class="btn" onclick="window.location.href='/portal/kyc'">📋 Review KYC</button>
        <button class="btn" onclick="showNotification('Platform settings coming soon!', 'info')">⚙️ Platform Settings</button>
        <button class="btn" onclick="window.location.href='/portal/analytics'">📊 System Analytics</button>
      </div>
    </div>
    <div class="card">
      <h3>System Status</h3>
      <p>• Server: ✅ Online</p>
      <p>• Database: ✅ Connected</p>
      <p>• GA4: ✅ Tracking</p>
      <p>• Buttondown: ✅ Integrated</p>
    </div>
  </div>
  
  <script>
    function showNotification(message, type = 'info') {
      alert(message);
    }
  </script>
</body>
</html>`;
}

function pageKYC() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KYC Verification — Tangent Platform</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      background: #0f172a; 
      color: #f8fafc; 
      margin: 0; 
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #06b6d4; margin-bottom: 30px; }
    .nav { margin-bottom: 30px; }
    .nav a { color: #94a3b8; text-decoration: none; margin-right: 20px; }
    .nav a:hover { color: #06b6d4; }
    .card { background: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .btn { 
      display: inline-block; 
      padding: 15px 30px; 
      background: #2563eb; 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      margin: 10px; 
      transition: background 0.3s;
      cursor: pointer;
      border: none;
    }
    .btn:hover { background: #1d4ed8; }
    .in { 
      width: 100%; 
      padding: 12px; 
      border: 1px solid #334155; 
      border-radius: 6px; 
      background: #1e293b; 
      color: #f8fafc; 
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/portal">Home</a>
      <a href="/admin">Admin</a>
      <a href="/dashboard">Dashboard</a>
      <a href="/">Landing Page</a>
    </div>
    <h1>📋 KYC Verification</h1>
    <div class="card">
      <h2>Complete your Know Your Customer verification</h2>
      <p>Upload the required documents for verification:</p>
      
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
      
      <script>
        function submitKYC() {
          const files = document.querySelectorAll('input[type="file"]');
          let hasFiles = false;
          
          files.forEach(file => {
            if (file.files.length > 0) {
              hasFiles = true;
            }
          });
          
          if (!hasFiles) {
            alert('Please upload at least one document before submitting.');
            return;
          }
          
          alert('KYC documents submitted successfully! You will receive confirmation within 24 hours.');
          window.location.href = '/dashboard';
        }
      </script>
    </div>
  </div>
  
</body>
</html>`;
}

function pageTrade() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trade Desk — Tangent Platform</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      background: #0f172a; 
      color: #f8fafc; 
      margin: 0; 
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #06b6d4; margin-bottom: 30px; }
    .nav { margin-bottom: 30px; }
    .nav a { color: #94a3b8; text-decoration: none; margin-right: 20px; }
    .nav a:hover { color: #06b6d4; }
    .card { background: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/portal">Home</a>
      <a href="/admin">Admin</a>
      <a href="/dashboard">Dashboard</a>
      <a href="/">Landing Page</a>
    </div>
    <h1>💼 Trade Desk</h1>
    <div class="card">
      <h2>Trading Interface</h2>
      <p>Execute trades with advanced tools and real-time market data.</p>
      <p><strong>Status:</strong> Advanced trading tools coming soon...</p>
    </div>
  </div>
</body>
</html>`;
}

function pageAnalytics() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analytics — Tangent Platform</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      background: #0f172a; 
      color: #f8fafc; 
      margin: 0; 
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #06b6d4; margin-bottom: 30px; }
    .nav { margin-bottom: 30px; }
    .nav a { color: #94a3b8; text-decoration: none; margin-right: 20px; }
    .nav a:hover { color: #06b6d4; }
    .card { background: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/portal">Home</a>
      <a href="/admin">Admin</a>
      <a href="/dashboard">Dashboard</a>
      <a href="/">Landing Page</a>
    </div>
    <h1>📊 Analytics Dashboard</h1>
    <div class="card">
      <h2>Performance Metrics</h2>
      <p>Track your trading performance and market insights.</p>
      <p><strong>Status:</strong> Analytics dashboard coming soon...</p>
    </div>
  </div>
</body>
</html>`;
}

function pageAuctions() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auctions — Tangent Platform</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      background: #0f172a; 
      color: #f8fafc; 
      margin: 0; 
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #06b6d4; margin-bottom: 30px; }
    .nav { margin-bottom: 30px; }
    .nav a { color: #94a3b8; text-decoration: none; margin-right: 20px; }
    .nav a:hover { color: #06b6d4; }
    .card { background: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/portal">Home</a>
      <a href="/admin">Admin</a>
      <a href="/dashboard">Dashboard</a>
      <a href="/">Landing Page</a>
    </div>
    <h1>🏆 Auctions</h1>
    <div class="card">
      <h2>Trading Auctions</h2>
      <p>Participate in trading auctions and competitive bidding.</p>
      <p><strong>Status:</strong> Auction system coming soon...</p>
    </div>
  </div>
</body>
</html>`;
}

function pageInsurance() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Insurance — Tangent Platform</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      background: #0f172a; 
      color: #f8fafc; 
      margin: 0; 
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #06b6d4; margin-bottom: 30px; }
    .nav { margin-bottom: 30px; }
    .nav a { color: #94a3b8; text-decoration: none; margin-right: 20px; }
    .nav a:hover { color: #06b6d4; }
    .card { background: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/portal">Home</a>
      <a href="/admin">Admin</a>
      <a href="/dashboard">Dashboard</a>
      <a href="/">Landing Page</a>
    </div>
    <h1>🛡️ Insurance</h1>
    <div class="card">
      <h2>Trade Insurance</h2>
      <p>Protect your trades with comprehensive insurance coverage.</p>
      <p><strong>Status:</strong> Insurance system coming soon...</p>
    </div>
  </div>
</body>
</html>`;
}

function pageInteractiveDemo() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interactive Demo — Tangent Platform</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      background: #0f172a; 
      color: #f8fafc; 
      margin: 0; 
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #06b6d4; margin-bottom: 30px; }
    .nav { margin-bottom: 30px; }
    .nav a { color: #94a3b8; text-decoration: none; margin-right: 20px; }
    .nav a:hover { color: #06b6d4; }
    .card { background: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/portal">Home</a>
      <a href="/admin">Admin</a>
      <a href="/dashboard">Dashboard</a>
      <a href="/">Landing Page</a>
    </div>
    <h1>🎮 Interactive Demo</h1>
    <div class="card">
      <h2>Platform Demo</h2>
      <p>Experience the platform features through interactive demonstrations.</p>
      <p><strong>Status:</strong> Interactive demo coming soon...</p>
    </div>
  </div>
</body>
</html>`;
}

// Registration Page
app.get('/register', (req, res) => {
  console.log('REGISTRATION PAGE ROUTE HIT!');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Register — Tangent Protocol</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
    .container { max-width: 600px; margin: 100px auto; }
    h1 { color: #2563eb; text-align: center; margin-bottom: 30px; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; color: #f8fafc; font-weight: 600; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 12px; border: 1px solid #334155; border-radius: 8px; background: #0f172a; color: #f8fafc; font-size: 16px; }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
    .btn { width: 100%; padding: 15px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 10px; }
    .btn:hover { background: #1d4ed8; }
    .error { color: #ef4444; margin-top: 10px; text-align: center; }
    .success { color: #10b981; margin-top: 10px; text-align: center; }
    .back-link { text-align: center; margin-top: 20px; }
    .back-link a { color: #06b6d4; text-decoration: none; }
    .interest-group { margin: 20px 0; }
    .interest-group label { display: block; margin: 10px 0; }
    .interest-group input[type="checkbox"] { margin-right: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Join Tangent Protocol</h1>
    <p style="text-align: center; color: #94a3b8; margin-bottom: 30px;">Register your interest in our advanced trading platform and TGT stablecoin</p>
    
    <form id="registrationForm">
      <div class="form-group">
        <label for="name">Full Name *</label>
        <input type="text" id="name" name="name" required>
      </div>
      
      <div class="form-group">
        <label for="email">Email Address *</label>
        <input type="email" id="email" name="email" required>
      </div>
      
      <div class="form-group">
        <label for="company">Company/Organization</label>
        <input type="text" id="company" name="company">
      </div>
      
      <div class="form-group">
        <label for="phone">Phone Number</label>
        <input type="tel" id="phone" name="phone">
      </div>
      
      <div class="interest-group">
        <label style="font-weight: 600; margin-bottom: 15px;">I'm interested in: *</label>
        <label>
          <input type="checkbox" name="interests" value="trading_platform">
          Trading Platform
        </label>
        <label>
          <input type="checkbox" name="interests" value="tgt_stablecoin">
          TGT Stablecoin
        </label>
        <label>
          <input type="checkbox" name="interests" value="both">
          Both Platform & TGT
        </label>
      </div>
      
      <div class="form-group">
        <label for="message">Additional Information</label>
        <textarea id="message" name="message" rows="4" placeholder="Tell us about your trading needs, TGT interest, or any questions..."></textarea>
      </div>
      
      <label style="display: block; margin: 20px 0;">
        <input type="checkbox" id="newsletter" name="newsletter" checked style="margin-right: 10px;">
        Subscribe to updates and exclusive offers
      </label>
      
      <button type="submit" class="btn">Submit Registration</button>
      <div id="error" class="error"></div>
      <div id="success" class="success"></div>
    </form>
    
    <div class="back-link">
      <a href="/">← Back to Landing Page</a>
    </div>
  </div>
  
  <script>
    document.getElementById('registrationForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const errorDiv = document.getElementById('error');
      const successDiv = document.getElementById('success');
      
      // Check if at least one interest is selected
      const interests = document.querySelectorAll('input[name="interests"]:checked');
      if (interests.length === 0) {
        errorDiv.textContent = 'Please select at least one area of interest.';
        return;
      }
      
      const formData = new FormData(this);
      const data = Object.fromEntries(formData);
      
      try {
        const response = await fetch('/api/unified-register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          successDiv.textContent = '🎉 Registration successful! We will contact you within 48 hours.';
          errorDiv.textContent = '';
          this.reset();
          
          // Redirect to landing page after 3 seconds
          setTimeout(() => {
            window.location.href = '/';
          }, 3000);
        } else {
          errorDiv.textContent = 'Registration failed: ' + (result.message || 'Unknown error');
          successDiv.textContent = '';
        }
      } catch (error) {
        errorDiv.textContent = 'Registration failed. Please try again.';
        successDiv.textContent = '';
      }
    });
  </script>
</body>
</html>`;
  res.send(html);
});

// TGT Information Page
app.get('/tgt-info', (req, res) => {
  console.log('TGT INFO PAGE ROUTE HIT!');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TGT Stablecoin — Tangent Protocol</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #2563eb; text-align: center; margin-bottom: 30px; }
    .tgt-info { background: #1e293b; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
    .tgt-info h2 { color: #06b6d4; margin-bottom: 20px; }
    .tgt-info ul { margin: 20px 0; padding-left: 20px; }
    .tgt-info li { margin: 10px 0; color: #94a3b8; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; color: #f8fafc; font-weight: 600; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 12px; border: 1px solid #334155; border-radius: 8px; background: #0f172a; color: #f8fafc; font-size: 16px; }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
    .btn { width: 100%; padding: 15px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 10px; }
    .btn:hover { background: #1d4ed8; }
    .error { color: #ef4444; margin-top: 10px; text-align: center; }
    .success { color: #10b981; margin-top: 10px; text-align: center; }
    .back-link { text-align: center; margin-top: 20px; }
    .back-link a { color: #06b6d4; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>💎 TGT Stablecoin</h1>
    
    <div class="tgt-info">
      <h2>What is TGT?</h2>
      <p>TGT is our innovative stablecoin designed for maximum stability, transparency, and efficiency. Built with advanced algorithmic mechanisms and backed by diversified reserves.</p>
      
      <h2>Key Benefits:</h2>
      <ul>
        <li>Ultra-stable price maintenance through advanced algorithms</li>
        <li>Transparent reserve reporting and real-time audits</li>
        <li>Ultra-low transaction fees (0.1% vs 2-5% traditional)</li>
        <li>Fast settlement times (seconds vs days)</li>
        <li>Full regulatory compliance and oversight</li>
        <li>Seamless DeFi integration and interoperability</li>
        <li>Institutional-grade security and custody</li>
      </ul>
      
      <h2>Use Cases:</h2>
      <ul>
        <li>Trading and portfolio management</li>
        <li>Cross-border payments and remittances</li>
        <li>DeFi protocols and yield farming</li>
        <li>Institutional treasury management</li>
        <li>E-commerce and merchant payments</li>
      </ul>
    </div>
    
    <h2 style="color: #06b6d4; margin-top: 40px;">Get TGT Information & Early Access</h2>
    <p style="color: #94a3b8; margin-bottom: 30px;">Fill out the form below to receive exclusive TGT information and early access opportunities.</p>
    
    <form id="tgtForm">
      <div class="form-group">
        <label for="tgtName">Full Name *</label>
        <input type="text" id="tgtName" name="name" required>
      </div>
      
      <div class="form-group">
        <label for="tgtEmail">Email Address *</label>
        <input type="email" id="tgtEmail" name="email" required>
      </div>
      
      <div class="form-group">
        <label for="tgtCompany">Company/Organization</label>
        <input type="text" id="tgtCompany" name="company">
      </div>
      
      <div class="form-group">
        <label for="tgtPhone">Phone Number</label>
        <input type="tel" id="tgtPhone" name="phone">
      </div>
      
      <div class="form-group">
        <label for="tgtInterestLevel">Interest Level *</label>
        <select id="tgtInterestLevel" name="interestLevel" required>
          <option value="">Select interest level</option>
          <option value="exploring">Just Exploring</option>
          <option value="interested">Interested</option>
          <option value="very-interested">Very Interested</option>
          <option value="ready-to-invest">Ready to Invest</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="tgtInvestmentRange">Investment Range</label>
        <select id="tgtInvestmentRange" name="investmentRange">
          <option value="">Select range</option>
          <option value="under-10k">Under $10,000</option>
          <option value="10k-50k">$10,000 - $50,000</option>
          <option value="50k-100k">$50,000 - $100,000</option>
          <option value="100k-plus">$100,000+</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="tgtUseCase">Primary Use Case</label>
        <select id="tgtUseCase" name="useCase">
          <option value="">Select use case</option>
          <option value="trading">Trading</option>
          <option value="payments">Payments</option>
          <option value="defi">DeFi Integration</option>
          <option value="institutional">Institutional Use</option>
          <option value="other">Other</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="tgtMessage">Questions or Additional Information</label>
        <textarea id="tgtMessage" name="message" rows="4" placeholder="Tell us about your TGT interest and use case..."></textarea>
      </div>
      
      <label style="display: block; margin: 20px 0;">
        <input type="checkbox" id="tgtNewsletter" name="newsletter" checked style="margin-right: 10px;">
        Subscribe to TGT updates and exclusive offers
      </label>
      
      <button type="submit" class="btn">Get TGT Information</button>
      <div id="error" class="error"></div>
      <div id="success" class="success"></div>
    </form>
    
    <div class="back-link">
      <a href="/">← Back to Landing Page</a>
    </div>
  </div>
  
  <script>
    document.getElementById('tgtForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const errorDiv = document.getElementById('error');
      const successDiv = document.getElementById('success');
      
      const formData = new FormData(this);
      const data = Object.fromEntries(formData);
      
      try {
        const response = await fetch('/api/tgt/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          successDiv.textContent = '🎉 TGT registration successful! We will contact you with exclusive early access information.';
          errorDiv.textContent = '';
          this.reset();
          
          // Redirect to landing page after 3 seconds
          setTimeout(() => {
            window.location.href = '/';
          }, 3000);
        } else {
          errorDiv.textContent = 'TGT registration failed: ' + (result.message || 'Unknown error');
          successDiv.textContent = '';
        }
      } catch (error) {
        errorDiv.textContent = 'TGT registration failed. Please try again.';
        successDiv.textContent = '';
      }
    });
  </script>
</body>
</html>`;
  res.send(html);
});

// Login Page
app.get('/login', (req, res) => {
  console.log('LOGIN PAGE ROUTE HIT!');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Login — Tangent Protocol</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
    .container { max-width: 400px; margin: 100px auto; }
    h1 { color: #2563eb; text-align: center; margin-bottom: 30px; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; color: #f8fafc; font-weight: 600; }
    .form-group input { width: 100%; padding: 12px; border: 1px solid #334155; border-radius: 8px; background: #0f172a; color: #f8fafc; font-size: 16px; }
    .form-group input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
    .btn { width: 100%; padding: 15px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 10px; }
    .btn:hover { background: #1d4ed8; }
    .error { color: #ef4444; margin-top: 10px; text-align: center; }
    .back-link { text-align: center; margin-top: 20px; }
    .back-link a { color: #06b6d4; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Team Portal Login</h1>
    <form id="loginForm" autocomplete="off">
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required autocomplete="off">
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required autocomplete="new-password">
      </div>
      <button type="submit" class="btn">Login to Portal</button>
      <div id="error" class="error"></div>
    </form>
    <div class="back-link">
      <a href="/">← Back to Landing Page</a>
    </div>
  </div>
  
  <script>
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const errorDiv = document.getElementById('error');
      
      try {
        const response = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
          // Store token and redirect to portal
          localStorage.setItem('tangent_token', data.token);
          localStorage.setItem('tangent_user', JSON.stringify(data.user));
          window.location.href = '/portal';
        } else {
          errorDiv.textContent = data.message || 'Login failed';
        }
      } catch (error) {
        errorDiv.textContent = 'Login error: ' + error.message;
      }
    });
  </script>
</body>
</html>`;
  res.send(html);
});

// Portal Routes (Team Access)
app.get('/portal', (req, res) => {
  console.log('PORTAL ROUTE HIT!');
  
  // Check for token in query params or headers
  const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    // Redirect to login page
    return res.redirect('/login');
  }
  
  res.send(pageHome());
});

app.get('/admin', (req, res) => {
  console.log('ADMIN ROUTE HIT!');
  
  // Check for token in query params or headers
  const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    // Redirect to login page
    return res.redirect('/login');
  }
  
  res.send(pageCompleteAdmin());
});

// Portal Sub-routes
app.get('/portal/kyc', (req, res) => {
  console.log('PORTAL KYC ROUTE HIT!');
  res.send(pageKYC());
});

app.get('/portal/trade', (req, res) => {
  console.log('PORTAL TRADE ROUTE HIT!');
  res.send(pageTrade());
});

app.get('/portal/analytics', (req, res) => {
  console.log('PORTAL ANALYTICS ROUTE HIT!');
  res.send(pageAnalytics());
});

app.get('/portal/auctions', (req, res) => {
  console.log('PORTAL AUCTIONS ROUTE HIT!');
  res.send(pageAuctions());
});

app.get('/portal/insurance', (req, res) => {
  console.log('PORTAL INSURANCE ROUTE HIT!');
  res.send(pageInsurance());
});

app.get('/portal/interactive-demo', (req, res) => {
  console.log('PORTAL INTERACTIVE DEMO ROUTE HIT!');
  res.send(pageInteractiveDemo());
});

// Thanks Page (after Buttondown form submission)
app.get('/thanks', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thanks! — Tangent Protocol</title>
  
  <!-- Google Analytics 4 -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${process.env.GA_MEASUREMENT_ID || 'G-CBKJR8V7QB'}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'granted' });
    gtag('js', new Date());
    gtag('config', '${process.env.GA_MEASUREMENT_ID || 'G-CBKJR8V7QB'}', { 
      anonymize_ip: true, 
      allow_google_signals: false 
    });
    gtag('event', 'visit_thanks');
  </script>
  
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      background: #0f172a; 
      color: #f8fafc; 
      margin: 0; 
      padding: 0; 
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      padding: 40px 20px; 
      text-align: center;
    }
    h1 { 
      color: #06b6d4; 
      margin-bottom: 20px; 
      font-size: 2rem; 
    }
    p { 
      color: #94a3b8; 
      margin-bottom: 20px; 
      font-size: 1.1rem; 
      line-height: 1.6;
    }
    ul { 
      text-align: left; 
      color: #94a3b8; 
      margin: 20px 0; 
    }
    .btn { 
      display: inline-block; 
      padding: 12px 24px; 
      background: #2563eb; 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      margin: 10px; 
      transition: background 0.3s;
    }
    .btn:hover { 
      background: #1d4ed8; 
    }
    .btn.secondary { 
      background: #374151; 
    }
    .btn.secondary:hover { 
      background: #4b5563; 
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Thanks! Please confirm your email.</h1>
    <p>We just sent a confirmation email. Click the link inside to complete your subscription.</p>
    <ul>
      <li>Didn't get it? Check spam.</li>
      <li>Wait two minutes and try again if needed.</li>
    </ul>
    <div>
      <a href="/" class="btn">Back to homepage</a>
      <a href="https://t.me/your_channel" target="_blank" class="btn secondary">Join our Telegram</a>
    </div>
  </div>
</body>
</html>`;
  
  res.send(html);
});

// Confirmed Page (after email confirmation)
app.get('/confirmed', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're In! — Tangent Protocol</title>
  
  <!-- Google Analytics 4 -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${process.env.GA_MEASUREMENT_ID || 'G-CBKJR8V7QB'}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'granted' });
    gtag('js', new Date());
    gtag('config', '${process.env.GA_MEASUREMENT_ID || 'G-CBKJR8V7QB'}', { 
      anonymize_ip: true, 
      allow_google_signals: false 
    });
    gtag('event', 'visit_confirmed');
  </script>
  
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      background: #0f172a; 
      color: #f8fafc; 
      margin: 0; 
      padding: 0; 
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      padding: 40px 20px; 
      text-align: center;
    }
    h1 { 
      color: #06b6d4; 
      margin-bottom: 20px; 
      font-size: 2rem; 
    }
    p { 
      color: #94a3b8; 
      margin-bottom: 20px; 
      font-size: 1.1rem; 
      line-height: 1.6;
    }
    ul { 
      text-align: left; 
      color: #94a3b8; 
      margin: 20px 0; 
    }
    .btn { 
      display: inline-block; 
      padding: 12px 24px; 
      background: #2563eb; 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      margin: 10px; 
      transition: background 0.3s;
    }
    .btn:hover { 
      background: #1d4ed8; 
    }
    .btn.secondary { 
      background: #374151; 
    }
    .btn.secondary:hover { 
      background: #4b5563; 
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>You're in — Tangent Early Access</h1>
    <p>Welcome! We'll send short updates and occasional invites to private walk-throughs.</p>
    <ul>
      <li>Say hello in Telegram with your role (Supplier / Trader / Buyer / Insurer / Dev / Investor).</li>
      <li>Watch for a quick intro email soon.</li>
    </ul>
    <div>
      <a href="/" class="btn">Back to homepage</a>
      <a href="https://t.me/your_channel" target="_blank" class="btn secondary">Join our Telegram</a>
    </div>
  </div>
</body>
</html>`;
  
  res.send(html);
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 ORIGINAL DESIGN SERVER RUNNING ON PORT ${PORT}`);
});
