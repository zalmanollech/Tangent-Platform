# Tangent Platform - Offline Development Guide
*Complete guide for working without internet connection*

## 🛫 Working Offline on Your Flight

### Prerequisites Checklist
- ✅ Node.js installed
- ✅ All npm dependencies installed (`npm install` completed)
- ✅ VS Code or preferred editor
- ✅ This guide downloaded

## 🚀 Starting the Platform Offline

### 1. Start the Server
```bash
cd tangent-supplier-web-clean
npm start
```

### 2. Access the Platform
Open browser to: `http://localhost:4000`

## 🔧 Development Tasks You Can Do Offline

### ✅ Frontend Development
- **Modify HTML pages** in portal routes (server.js lines 318-561)
- **Update CSS styling** in public/theme.css
- **Enhance mobile responsiveness** with public/mobile-responsive.css
- **Add JavaScript features** with public/mobile-responsive.js

### ✅ Backend API Development
- **Add new routes** in routes/ folder
- **Modify business logic** in lib/ modules
- **Update database schemas** in lib/database-postgres.js
- **Enhance search functionality** in lib/search.js

### ✅ Configuration & Settings
- **Environment variables** in config.env
- **Feature toggles** in lib/config.js
- **Logging configuration** in lib/logger.js

### ✅ Testing
```bash
npm test  # Run existing tests
```

## 📁 Key Files to Focus On

### **Core Server**
- `server.js` - Main server (548 lines)
- `lib/config.js` - Configuration management
- `lib/security.js` - Authentication & security

### **API Routes**
- `routes/auth.js` - User authentication
- `routes/trades.js` - Trading functionality  
- `routes/kyc.js` - KYC document management
- `routes/payments.js` - Payment processing
- `routes/blockchain.js` - Smart contract interaction
- `routes/search.js` - Advanced search

### **Frontend Assets**
- `public/theme.css` - Main styling
- `public/mobile-responsive.css` - Mobile framework
- `public/mobile-responsive.js` - Mobile JavaScript
- `public/websocket-client.js` - Real-time features

## 🎯 Suggested Offline Projects

### 1. UI/UX Improvements
```javascript
// Enhance the KYC page styling
// File: server.js (lines 318-561)
// Add better form validation feedback
// Improve mobile experience
```

### 2. Add New Trading Features
```javascript
// File: routes/trades.js
// Add trade templates
// Implement trade favorites
// Create trade history filters
```

### 3. Dashboard Enhancements
```javascript
// Create user dashboard widgets
// Add analytics charts
// Implement notification center
```

### 4. Mobile App Features
```javascript
// File: public/mobile-responsive.js
// Add offline caching
// Implement touch gestures
// Create mobile-specific features
```

## 🗄️ Database Development

### JSON Database (Works Offline)
- **Location**: `data.json`
- **Manager**: `lib/database.js`
- **All CRUD operations** work offline

### PostgreSQL (Requires Setup)
- **Install PostgreSQL locally** before flight
- **Configure connection** in config.env
- **Run migrations** with lib/database-postgres.js

## 🧪 Testing Offline

### Run Tests
```bash
npm test                    # All tests
npm test auth.test.js      # Authentication tests
npm test -- --watch       # Watch mode
```

### Manual Testing
1. **User Registration**: http://localhost:4000/portal/auth
2. **Trade Creation**: http://localhost:4000/portal/trade
3. **KYC Upload**: http://localhost:4000/portal/kyc
4. **Admin Panel**: http://localhost:4000/portal/admin

## 🎨 Frontend Customization

### Modify Portal Pages
```javascript
// Edit HTML directly in server.js
// Functions: pageHome, pageTrade, pageAdmin, pageKYC
// Lines: 318-561 in server.js
```

### Style Updates
```css
/* public/theme.css */
/* Change colors, fonts, layouts */
/* All changes reflect immediately */
```

### Mobile Improvements
```css
/* public/mobile-responsive.css */
/* Enhance mobile experience */
/* Add touch-friendly interactions */
```

## 🔍 Debugging Without Internet

### Server Logs
```bash
# Check logs in real-time
tail -f logs/combined.log
tail -f logs/error.log
```

### Browser DevTools
- **Console**: Check JavaScript errors
- **Network**: Monitor API calls
- **Application**: Check localStorage
- **Mobile**: Test responsive design

## 💾 Save Your Work

### Git Commands (Offline)
```bash
git add .
git commit -m "Flight development: [describe changes]"
# Push when you have internet again
```

### Backup Files
```bash
# Create backup of your changes
cp server.js server-flight-backup.js
cp -r lib/ lib-backup/
cp -r routes/ routes-backup/
```

## 🛠️ Common Development Tasks

### 1. Add New Route
```javascript
// routes/new-feature.js
const express = require('express');
const router = express.Router();

router.get('/test', (req, res) => {
  res.json({ message: 'New feature works!' });
});

module.exports = router;
```

```javascript
// Add to server.js
const newFeatureRoutes = require('./routes/new-feature');
app.use('/api/new-feature', newFeatureRoutes);
```

### 2. Modify Database Schema
```javascript
// lib/database.js - for JSON database
// Add new fields to defaultDBSchema

// lib/database-postgres.js - for PostgreSQL
// Add new tables in createTables() method
```

### 3. Add New API Endpoint
```javascript
// Example: Add to routes/trades.js
router.get('/favorites', authMiddleware.requireAuth, (req, res) => {
  // Implementation here
});
```

### 4. Update Frontend
```html
<!-- Modify HTML in server.js pageXXX functions -->
<div class="new-feature">
  <h3>New Feature</h3>
  <button onclick="handleNewFeature()">Click Me</button>
</div>
```

## 🎯 Priority Tasks for Flight

### High Impact, Low Internet Dependency:
1. **Polish UI/UX** - Make it look more professional
2. **Add form validations** - Better user experience  
3. **Enhance mobile experience** - Touch-friendly interface
4. **Create user dashboard** - Better data visualization
5. **Add trade templates** - Streamline trade creation
6. **Improve error messages** - Better user feedback

## 📚 Documentation to Read

### Platform Architecture
- Review `README.md` for overall structure
- Study `lib/` modules to understand functionality
- Examine `routes/` for API endpoints

### Code Comments
- All files have detailed comments
- Function documentation explains purpose
- Configuration options are documented

## 🚨 Emergency Fixes

### Server Won't Start
```bash
# Check for syntax errors
node -c server.js

# Check dependencies
npm install

# Check ports
netstat -an | findstr :4000
```

### Database Issues
```javascript
// Reset JSON database
// Delete data.json and restart server
// Server will recreate with default data
```

## 🎉 When You're Back Online

### Push Your Changes
```bash
git push origin main
```

### Update Dependencies (if needed)
```bash
npm update
```

### Test Online Features
- Email notifications
- Payment processing  
- WebSocket real-time features
- External API integrations

---

## 💡 Pro Tips for Offline Development

1. **Use browser bookmarks** for quick navigation
2. **Keep this guide open** as reference
3. **Work in small increments** and test frequently
4. **Focus on UI/UX improvements** - high impact, no internet needed
5. **Document your changes** for when we reconnect

Have a great flight and productive coding session! ✈️👨‍💻




