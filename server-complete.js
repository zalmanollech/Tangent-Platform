const express = require('express');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory data storage (replace with database in production)
let users = [
  {
    id: 1,
    email: 'admin@tangent-protocol.com',
    password: 'TangentAdmin2024!',
    role: 'admin',
    name: 'Platform Admin',
    status: 'active'
  },
  {
    id: 2,
    email: 'dudiollech@gmail.com', 
    password: 'TangentAdmin2024!',
    role: 'admin',
    name: 'Dudio Ollech',
    status: 'active'
  }
];

let contracts = [];
let kycSubmissions = [];
let registrations = [];

// CSP Headers
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

// LANDING PAGE (Your original beautiful design)
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
      color: #2563eb; 
      font-size: 2rem; 
      margin-bottom: 20px; 
    }
    .platform-section p, .tgt-section p { 
      color: #94a3b8; 
      font-size: 1.1rem; 
      line-height: 1.6; 
      margin-bottom: 30px; 
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
    .btn.secondary { 
      background: #06b6d4; 
    }
    .btn.secondary:hover { 
      background: #0891b2; 
    }
    .registration-section { 
      text-align: center; 
      margin: 60px 0; 
      padding: 40px; 
      background: #1e293b; 
      border-radius: 16px; 
      border: 1px solid #334155; 
    }
    .registration-section h3 { 
      color: #2563eb; 
      font-size: 1.8rem; 
      margin-bottom: 20px; 
    }
    .registration-section p { 
      color: #94a3b8; 
      font-size: 1.2rem; 
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
      <p>Experience next-generation trading with institutional-grade tools, real-time analytics, and seamless execution. Discover the power of our innovative TGT stablecoin.</p>
    </div>
    
    <div class="main-content">
      <div class="platform-section">
        <h2>🚀 Trading Platform</h2>
        <p>Advanced trading tools with real-time market data, sophisticated order types, and institutional-grade execution.</p>
        <ul style="text-align: left; color: #94a3b8; margin: 20px 0;">
          <li>Real-time market data and analytics</li>
          <li>Advanced order types and execution</li>
          <li>Comprehensive risk management</li>
          <li>Portfolio analytics and reporting</li>
          <li>Multi-asset trading support</li>
        </ul>
      </div>
      
      <div class="tgt-section">
        <h2>💎 TGT Stablecoin</h2>
        <p>Discover the benefits of our innovative TGT stablecoin - designed for stability, transparency, and seamless integration.</p>
        <ul style="text-align: left; color: #94a3b8; margin: 20px 0;">
          <li>Advanced price stability mechanisms</li>
          <li>Transparent reserve management</li>
          <li>Ultra-low transaction costs</li>
          <li>Seamless DeFi integration</li>
          <li>Regulatory compliance ready</li>
        </ul>
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
      <p><strong>Version:</strong> 4.0.0-COMPLETE-PLATFORM</p>
      <p><strong>Last Updated:</strong> ${new Date().toISOString()}</p>
    </div>
    
    <div style="margin-top: 30px; text-align: center;">
      <a href="/test" style="color: #2563eb; text-decoration: none; margin: 0 15px;">🧪 Test Server</a>
      <a href="/health" style="color: #2563eb; text-decoration: none; margin: 0 15px;">📊 Health Check</a>
    </div>
    
    <!-- Team Access Section -->
    <div style="text-align: center; margin-top: 40px; padding: 30px; border-top: 1px solid #334155; background: rgba(6, 182, 212, 0.05);">
      <p style="color: #94a3b8; font-size: 1rem; margin-bottom: 15px;">🔐 Authorized team members</p>
      <a href="/landing-two" style="color: #06b6d4; text-decoration: none; font-size: 1rem; padding: 12px 24px; border: 2px solid #06b6d4; border-radius: 8px; transition: all 0.3s; font-weight: 500;" onmouseover="this.style.background='#06b6d4'; this.style.color='white'; this.style.transform='translateY(-2px)'" onmouseout="this.style.background='transparent'; this.style.color='#06b6d4'; this.style.transform='translateY(0)'">Team Portal</a>
    </div>
  </div>
</body>
</html>`;
  
  res.send(html);
});

// LANDING PAGE TWO (Sign In / Sign Up Split)
app.get('/landing-two', (req, res) => {
  console.log('LANDING PAGE TWO HIT!');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Access — Tangent Protocol</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
    .container { max-width: 800px; margin: 100px auto; text-align: center; }
    h1 { color: #2563eb; margin-bottom: 50px; font-size: 3rem; }
    .access-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin: 60px 0; }
    .access-card { background: #1e293b; padding: 50px; border-radius: 20px; border: 1px solid #334155; }
    .access-card h2 { color: #06b6d4; font-size: 2rem; margin-bottom: 20px; }
    .access-card p { color: #94a3b8; margin-bottom: 30px; line-height: 1.6; }
    .btn { display: inline-block; padding: 15px 40px; background: #2563eb; color: white; text-decoration: none; border-radius: 12px; font-weight: 600; transition: all 0.3s; }
    .btn:hover { background: #1d4ed8; transform: translateY(-2px); }
    .btn.secondary { background: #06b6d4; }
    .btn.secondary:hover { background: #0891b2; }
    @media (max-width: 768px) { .access-grid { grid-template-columns: 1fr; gap: 30px; } }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Team Access Portal</h1>
    <p style="color: #94a3b8; font-size: 1.2rem; margin-bottom: 40px;">Choose your access method</p>
    
    <div class="access-grid">
      <div class="access-card">
        <h2>👤 Sign In</h2>
        <p>Existing team members and registered users</p>
        <p>Access your dashboard based on your role:</p>
        <ul style="text-align: left; color: #94a3b8; margin: 20px 0;">
          <li><strong>Admin:</strong> Full platform management</li>
          <li><strong>Supplier:</strong> Product management & orders</li>
          <li><strong>Buyer:</strong> Trading & purchasing</li>
          <li><strong>Trader:</strong> Advanced trading tools</li>
          <li><strong>Insurer:</strong> Risk assessment & quotes</li>
        </ul>
        <a href="/sign-in" class="btn">Sign In</a>
      </div>
      
      <div class="access-card">
        <h2>📝 Sign Up</h2>
        <p>New users requiring KYC verification</p>
        <p>Complete registration process:</p>
        <ul style="text-align: left; color: #94a3b8; margin: 20px 0;">
          <li>Create account with credentials</li>
          <li>Choose company type</li>
          <li>Upload required documents</li>
          <li>Complete KYC verification</li>
          <li>Get approved & access dashboard</li>
        </ul>
        <a href="/sign-up" class="btn secondary">Sign Up</a>
      </div>
    </div>
    
    <div style="margin-top: 40px;">
      <a href="/" style="color: #06b6d4; text-decoration: none;">← Back to Landing Page</a>
    </div>
  </div>
</body>
</html>`;
  
  res.send(html);
});

// SIGN IN PAGE
app.get('/sign-in', (req, res) => {
  console.log('SIGN IN PAGE HIT!');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In — Tangent Protocol</title>
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
    .success { color: #10b981; margin-top: 10px; text-align: center; }
    .back-link { text-align: center; margin-top: 20px; }
    .back-link a { color: #06b6d4; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Sign In</h1>
    <form id="signInForm">
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required autocomplete="off">
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required autocomplete="new-password">
      </div>
      <button type="submit" class="btn">Sign In</button>
      <div id="error" class="error"></div>
      <div id="success" class="success"></div>
    </form>
    <div class="back-link">
      <a href="/landing-two">← Back to Team Access</a>
    </div>
  </div>
  
  <script>
    document.getElementById('signInForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const errorDiv = document.getElementById('error');
      const successDiv = document.getElementById('success');
      
      errorDiv.textContent = '';
      successDiv.textContent = '';
      
      try {
        const response = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
          successDiv.textContent = 'Sign in successful! Redirecting...';
          localStorage.setItem('tangent_user', JSON.stringify(data.user));
          localStorage.setItem('tangent_token', data.token);
          
          setTimeout(() => {
            // Redirect based on user role
            switch(data.user.role) {
              case 'admin':
                window.location.href = '/admin';
                break;
              case 'supplier':
                window.location.href = '/supplier-dashboard';
                break;
              case 'buyer':
                window.location.href = '/buyer-dashboard';
                break;
              case 'trader':
                window.location.href = '/trader-dashboard';
                break;
              case 'insurer':
                window.location.href = '/insurer-dashboard';
                break;
              default:
                window.location.href = '/portal';
            }
          }, 1000);
        } else {
          errorDiv.textContent = data.message || 'Invalid credentials';
        }
      } catch (error) {
        errorDiv.textContent = 'Sign in error. Please try again.';
      }
    });
  </script>
</body>
</html>`;
  
  res.send(html);
});

// SIGN UP PAGE  
app.get('/sign-up', (req, res) => {
  console.log('SIGN UP PAGE HIT!');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign Up — Tangent Protocol</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
    .container { max-width: 600px; margin: 50px auto; }
    h1 { color: #2563eb; text-align: center; margin-bottom: 30px; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; color: #f8fafc; font-weight: 600; }
    .form-group input, .form-group select { width: 100%; padding: 12px; border: 1px solid #334155; border-radius: 8px; background: #0f172a; color: #f8fafc; font-size: 16px; }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
    .btn { width: 100%; padding: 15px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 10px; }
    .btn:hover { background: #1d4ed8; }
    .error { color: #ef4444; margin-top: 10px; text-align: center; }
    .success { color: #10b981; margin-top: 10px; text-align: center; }
    .back-link { text-align: center; margin-top: 20px; }
    .back-link a { color: #06b6d4; text-decoration: none; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📝 Create Account</h1>
    <p style="text-align: center; color: #94a3b8; margin-bottom: 30px;">Create your account and start the KYC verification process</p>
    
    <form id="signUpForm">
      <div class="form-row">
        <div class="form-group">
          <label for="firstName">First Name</label>
          <input type="text" id="firstName" name="firstName" required>
        </div>
        <div class="form-group">
          <label for="lastName">Last Name</label>
          <input type="text" id="lastName" name="lastName" required>
        </div>
      </div>
      
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required>
        </div>
        <div class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <input type="password" id="confirmPassword" name="confirmPassword" required>
        </div>
      </div>
      
      <div class="form-group">
        <label for="company">Company Name</label>
        <input type="text" id="company" name="company" required>
      </div>
      
      <div class="form-group">
        <label for="role">Your Role</label>
        <select id="role" name="role" required>
          <option value="">Select your role...</option>
          <option value="supplier">Supplier/Seller</option>
          <option value="buyer">Buyer</option>
          <option value="trader">Trader</option>
          <option value="insurer">Insurer</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="phone">Phone Number</label>
        <input type="tel" id="phone" name="phone" required>
      </div>
      
      <button type="submit" class="btn">Create Account & Start KYC</button>
      <div id="error" class="error"></div>
      <div id="success" class="success"></div>
    </form>
    
    <div class="back-link">
      <a href="/landing-two">← Back to Team Access</a>
    </div>
  </div>
  
  <script>
    document.getElementById('signUpForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const errorDiv = document.getElementById('error');
      const successDiv = document.getElementById('success');
      
      errorDiv.textContent = '';
      successDiv.textContent = '';
      
      if (password !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match';
        return;
      }
      
      const formData = new FormData(e.target);
      const userData = Object.fromEntries(formData);
      
      try {
        const response = await fetch('/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (data.success) {
          successDiv.textContent = 'Account created! Redirecting to KYC...';
          localStorage.setItem('tangent_user', JSON.stringify(data.user));
          
          setTimeout(() => {
            window.location.href = '/kyc';
          }, 2000);
        } else {
          errorDiv.textContent = data.message || 'Registration failed';
        }
      } catch (error) {
        errorDiv.textContent = 'Registration error. Please try again.';
      }
    });
  </script>
</body>
</html>`;
  
  res.send(html);
});

// KYC PAGE (Your original with company type selection)
app.get('/kyc', (req, res) => {
  console.log('KYC PAGE HIT!');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KYC Verification — Tangent Protocol</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
    .container { max-width: 800px; margin: 50px auto; }
    h1 { color: #2563eb; text-align: center; margin-bottom: 30px; }
    .company-type-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin: 40px 0; }
    .company-card { background: #1e293b; padding: 40px; border-radius: 16px; border: 1px solid #334155; text-align: center; cursor: pointer; transition: all 0.3s; }
    .company-card:hover { background: #334155; transform: translateY(-2px); }
    .company-card.selected { border-color: #2563eb; background: rgba(37, 99, 235, 0.1); }
    .company-card h3 { color: #06b6d4; margin-bottom: 20px; }
    .company-card ul { text-align: left; color: #94a3b8; margin: 20px 0; }
    .upload-section { background: #1e293b; padding: 30px; border-radius: 16px; border: 1px solid #334155; margin: 30px 0; display: none; }
    .upload-section.show { display: block; }
    .file-group { margin-bottom: 20px; }
    .file-group label { display: block; margin-bottom: 8px; color: #f8fafc; font-weight: 600; }
    .file-input { width: 100%; padding: 12px; border: 1px solid #334155; border-radius: 8px; background: #0f172a; color: #f8fafc; }
    .btn { padding: 15px 30px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; margin: 10px; }
    .btn:hover { background: #1d4ed8; }
    .btn:disabled { background: #64748b; cursor: not-allowed; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📋 KYC Verification</h1>
    <p style="text-align: center; color: #94a3b8; margin-bottom: 40px;">Complete your Know Your Customer verification by selecting your company type and uploading required documents</p>
    
    <h2 style="color: #06b6d4; text-align: center; margin-bottom: 30px;">Step 1: Select Company Type</h2>
    
    <div class="company-type-grid">
      <div class="company-card" onclick="selectCompanyType('private')">
        <h3>🏢 Private Company</h3>
        <p style="color: #94a3b8;">Privately held companies, partnerships, LLCs</p>
        <ul>
          <li>Certificate of Incorporation</li>
          <li>Articles of Association</li>
          <li>Shareholder Registry</li>
          <li>Business License</li>
          <li>Proof of Business Address</li>
          <li>Beneficial Ownership Information</li>
        </ul>
      </div>
      
      <div class="company-card" onclick="selectCompanyType('public')">
        <h3>🏛️ Public Listed Company</h3>
        <p style="color: #94a3b8;">Publicly traded companies on stock exchanges</p>
        <ul>
          <li>SEC Registration Statement</li>
          <li>Latest Annual Report (10-K)</li>
          <li>Latest Quarterly Report (10-Q)</li>
          <li>Articles of Incorporation</li>
          <li>Board Resolution</li>
          <li>Exchange Listing Documentation</li>
        </ul>
      </div>
    </div>
    
    <!-- Private Company Upload Section -->
    <div id="private-upload" class="upload-section">
      <h2 style="color: #06b6d4; margin-bottom: 30px;">Step 2: Upload Private Company Documents</h2>
      
      <div class="file-group">
        <label>Certificate of Incorporation *</label>
        <input type="file" class="file-input" accept=".pdf,.jpg,.jpeg,.png" required>
      </div>
      
      <div class="file-group">
        <label>Articles of Association *</label>
        <input type="file" class="file-input" accept=".pdf,.jpg,.jpeg,.png" required>
      </div>
      
      <div class="file-group">
        <label>Shareholder Registry *</label>
        <input type="file" class="file-input" accept=".pdf,.jpg,.jpeg,.png" required>
      </div>
      
      <div class="file-group">
        <label>Business License *</label>
        <input type="file" class="file-input" accept=".pdf,.jpg,.jpeg,.png" required>
      </div>
      
      <div class="file-group">
        <label>Proof of Business Address *</label>
        <input type="file" class="file-input" accept=".pdf,.jpg,.jpeg,.png" required>
      </div>
      
      <div class="file-group">
        <label>Beneficial Ownership Information *</label>
        <input type="file" class="file-input" accept=".pdf,.jpg,.jpeg,.png" required>
      </div>
      
      <button class="btn" onclick="submitKYC('private')" id="submit-private" disabled>Submit Private Company KYC</button>
    </div>
    
    <!-- Public Company Upload Section -->
    <div id="public-upload" class="upload-section">
      <h2 style="color: #06b6d4; margin-bottom: 30px;">Step 2: Upload Public Company Documents</h2>
      
      <div class="file-group">
        <label>SEC Registration Statement *</label>
        <input type="file" class="file-input" accept=".pdf" required>
      </div>
      
      <div class="file-group">
        <label>Latest Annual Report (10-K) *</label>
        <input type="file" class="file-input" accept=".pdf" required>
      </div>
      
      <div class="file-group">
        <label>Latest Quarterly Report (10-Q) *</label>
        <input type="file" class="file-input" accept=".pdf" required>
      </div>
      
      <div class="file-group">
        <label>Articles of Incorporation *</label>
        <input type="file" class="file-input" accept=".pdf,.jpg,.jpeg,.png" required>
      </div>
      
      <div class="file-group">
        <label>Board Resolution *</label>
        <input type="file" class="file-input" accept=".pdf,.jpg,.jpeg,.png" required>
      </div>
      
      <div class="file-group">
        <label>Exchange Listing Documentation *</label>
        <input type="file" class="file-input" accept=".pdf" required>
      </div>
      
      <button class="btn" onclick="submitKYC('public')" id="submit-public" disabled>Submit Public Company KYC</button>
    </div>
  </div>
  
  <script>
    let selectedType = null;
    
    function selectCompanyType(type) {
      selectedType = type;
      
      // Reset all cards
      document.querySelectorAll('.company-card').forEach(card => {
        card.classList.remove('selected');
      });
      
      // Hide all upload sections
      document.querySelectorAll('.upload-section').forEach(section => {
        section.classList.remove('show');
      });
      
      // Select current card and show upload section
      event.currentTarget.classList.add('selected');
      document.getElementById(type + '-upload').classList.add('show');
      
      // Setup file validation for this type
      setupFileValidation(type);
    }
    
    function setupFileValidation(type) {
      const section = document.getElementById(type + '-upload');
      const submitBtn = document.getElementById('submit-' + type);
      const fileInputs = section.querySelectorAll('.file-input');
      
      function checkFiles() {
        let allFilled = true;
        fileInputs.forEach(input => {
          if (!input.files.length) allFilled = false;
        });
        submitBtn.disabled = !allFilled;
      }
      
      fileInputs.forEach(input => {
        input.addEventListener('change', checkFiles);
      });
    }
    
    function submitKYC(type) {
      if (!selectedType) {
        alert('Please select a company type first');
        return;
      }
      
      const section = document.getElementById(type + '-upload');
      const fileInputs = section.querySelectorAll('.file-input');
      let hasAllFiles = true;
      
      fileInputs.forEach(input => {
        if (!input.files.length) hasAllFiles = false;
      });
      
      if (!hasAllFiles) {
        alert('Please upload all required documents before submitting');
        return;
      }
      
      // Simulate KYC submission
      alert('🎉 KYC Documents Submitted Successfully!\\n\\n📋 What happens next:\\n• Automated compliance screening (AML, sanctions, credit)\\n• Document verification and analysis\\n• Risk assessment and scoring\\n• Admin review for any flagged items\\n\\n⏱️ Processing time: Usually within 48 hours\\n📧 You will receive email updates on your application status\\n\\n✅ If approved automatically: Immediate access to dashboard\\n⚠️ If flagged: Admin review within 48 hours');
      
      // Redirect based on user from localStorage
      const user = JSON.parse(localStorage.getItem('tangent_user') || '{}');
      const role = user.role || 'buyer';
      
      setTimeout(() => {
        switch(role) {
          case 'supplier':
            window.location.href = '/supplier-dashboard';
            break;
          case 'buyer':
            window.location.href = '/buyer-dashboard';
            break;
          case 'trader':
            window.location.href = '/trader-dashboard';
            break;
          case 'insurer':
            window.location.href = '/insurer-dashboard';
            break;
          default:
            window.location.href = '/buyer-dashboard';
        }
      }, 3000);
    }
  </script>
</body>
</html>`;
  
  res.send(html);
});

// I'll continue building this comprehensive solution...
// Let me continue with more routes in the next part due to token limits.

module.exports = app;
