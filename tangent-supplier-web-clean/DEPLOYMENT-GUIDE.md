# Tangent Platform - Deployment Guide
*How to share your platform with testers and deploy to production*

## 🚀 Quick Deployment Options

### 1. Local Network Sharing (Immediate)
```bash
# Already configured - just run:
npm start

# Find your IP address:
ipconfig  # Windows
ifconfig  # Mac/Linux

# Share with testers:
http://YOUR_IP:4000
# Example: http://192.168.1.100:4000
```

### 2. Ngrok (Public URL in 30 seconds)
```bash
# Install ngrok from https://ngrok.com
# Start server:
npm start

# In new terminal:
ngrok http 4000

# Share the public URL shown (e.g., https://abc123.ngrok.io)
```

### 3. Railway (Free Cloud Hosting)
```bash
npm install -g @railway/cli
railway login
railway deploy

# Get your public URL from Railway dashboard
```

## 🔐 Demo Accounts for Testers

### Pre-created Test Accounts
```javascript
// Buyers
Email: buyer@test.com
Password: test123

Email: buyer2@test.com  
Password: test123

// Suppliers  
Email: supplier@test.com
Password: test123

Email: supplier2@test.com
Password: test123

// Admin
Email: admin@tangent.com
Password: admin123
```

### Test Data Included
- ✅ Sample trades (Sugar, Rice, Wheat)
- ✅ Sample users with different roles
- ✅ Sample KYC submissions
- ✅ Price feed data
- ✅ Platform settings

## 🎯 Testing Scenarios for Users

### Scenario 1: New User Registration
1. Go to main page
2. Click "Register" 
3. Fill form and submit
4. Check email verification flow

### Scenario 2: Create a Trade
1. Login as buyer/supplier
2. Go to Trade Portal
3. Create new trade
4. Test real-time updates

### Scenario 3: KYC Process
1. Go to KYC Portal
2. Select entity type (Public/Private Company)
3. Upload documents
4. Admin can review submissions

### Scenario 4: Mobile Experience
1. Open on mobile device
2. Test touch interface
3. Check responsive design
4. Test mobile navigation

## 🌐 Production Deployment

### Environment Variables for Production
```bash
# Required for production
NODE_ENV=production
PORT=4000
HOST=0.0.0.0

# Security (CHANGE THESE!)
JWT_SECRET=your-super-secure-jwt-secret-here
ADMIN_KEY=your-admin-key-here

# Database (PostgreSQL recommended)
DATABASE_URL=postgresql://user:pass@host:5432/tangent_platform

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Payments (optional)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Blockchain (optional)
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
```

### Railway Deployment
```bash
# 1. Install CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Deploy
railway deploy

# 4. Set environment variables in Railway dashboard
# 5. Connect PostgreSQL database (Railway provides free tier)
```

### Render Deployment
```yaml
# render.yaml (auto-deploy from GitHub)
services:
  - type: web
    name: tangent-platform
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: JWT_SECRET
        generateValue: true
      - key: DATABASE_URL
        fromDatabase:
          name: tangent-db
          property: connectionString

databases:
  - name: tangent-db
    databaseName: tangent_platform
    user: tangent_user
```

### Heroku Deployment
```bash
# 1. Install Heroku CLI
# 2. Login
heroku login

# 3. Create app
heroku create tangent-platform-live

# 4. Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# 5. Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -hex 32)

# 6. Deploy
git push heroku main
```

## 🔒 Security Checklist for Production

### ✅ Required Changes
- [ ] Change JWT_SECRET to strong random value
- [ ] Change ADMIN_KEY to secure password
- [ ] Set NODE_ENV=production
- [ ] Use HTTPS (automatic on most platforms)
- [ ] Configure real SMTP for emails
- [ ] Set up PostgreSQL database
- [ ] Enable rate limiting (already configured)
- [ ] Configure CORS for your domain

### ✅ Optional Enhancements
- [ ] Set up monitoring (Sentry, DataDog)
- [ ] Configure CDN for static assets
- [ ] Set up backup strategy
- [ ] Configure SSL certificates
- [ ] Set up custom domain

## 📱 Mobile Testing

### Responsive Breakpoints
- **Mobile**: < 768px
- **Tablet**: 768px - 1023px  
- **Desktop**: > 1024px

### Test Devices
- iPhone (Safari)
- Android (Chrome)
- iPad (Safari)
- Various screen sizes

### Mobile Features
- ✅ Touch-friendly buttons (44px minimum)
- ✅ Swipe gestures
- ✅ Mobile navigation
- ✅ Responsive tables
- ✅ Touch feedback

## 🧪 Testing Checklist

### Core Functionality
- [ ] User registration/login
- [ ] Trade creation and management
- [ ] KYC document upload
- [ ] Admin panel access
- [ ] Real-time notifications
- [ ] Mobile responsiveness

### Advanced Features
- [ ] Email notifications (if SMTP configured)
- [ ] Payment processing (if Stripe configured)
- [ ] WebSocket real-time updates
- [ ] Advanced search and filters
- [ ] Database operations
- [ ] File uploads

### Browser Compatibility
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile browsers

## 📊 Monitoring & Analytics

### Built-in Logging
- All requests logged to `logs/combined.log`
- Errors logged to `logs/error.log`
- Security events in `logs/security.log`
- Business events in `logs/audit.log`

### Health Check Endpoint
```
GET /health
# Returns platform status and metrics
```

### Admin Dashboard
```
GET /portal/admin
# Shows platform statistics and management tools
```

## 🎯 Demo Script for Presentations

### 5-Minute Demo Flow
1. **Homepage** - Show platform overview
2. **Registration** - Create new user account
3. **KYC** - Upload documents, show entity selection
4. **Trade Creation** - Create sample trade
5. **Real-time Updates** - Show WebSocket notifications
6. **Mobile View** - Switch to mobile/responsive view
7. **Admin Panel** - Show management capabilities

### Key Features to Highlight
- ✨ Real-time trade updates
- ✨ Secure KYC document handling
- ✨ Mobile-responsive design
- ✨ Professional authentication
- ✨ Comprehensive logging
- ✨ Modern security features

## 🆘 Troubleshooting

### Common Issues
```bash
# Port already in use
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# Permission errors
npm install --no-optional

# Database connection issues
# Check DATABASE_URL format
# Ensure PostgreSQL is running

# Email not working
# Verify SMTP credentials
# Check firewall settings
```

### Getting Help
- Check `logs/error.log` for detailed errors
- Use browser DevTools for frontend issues
- Test API endpoints with Postman/curl
- Check environment variables are set correctly

---

## 🚀 Ready to Share!

Your Tangent Platform is now ready for testing and production deployment. Choose the option that best fits your needs:

- **Quick testing**: Use ngrok or local network
- **Serious testing**: Deploy to Railway/Render
- **Production**: Follow security checklist and deploy to cloud

Happy testing! 🎉



