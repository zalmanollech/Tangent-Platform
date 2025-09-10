# Domain Migration Guide
*Move your platform from Railway subdomain to your custom domain with access control*

## 🔒 **IMPORTANT: Access Control Summary**

After following this guide:
- **Public visitors** → Will see your professional landing page at `your-domain.com`
- **Unauthorized users** → Cannot access the platform (redirected to landing page)
- **Your team only** → Can access the platform with proper credentials
- **You continue developing** → No disruption to your workflow

---

## 📋 **Pre-Migration Checklist**

### 1. Update Platform Access Configuration

Edit `config.platform-access.js` and add your team's email addresses:

```javascript
authorizedUsers: [
  'your-email@domain.com',        // ← Replace with your actual email
  'teammate1@company.com',        // ← Add your team members
  'teammate2@company.com',
  // Add more team members as needed
],
```

### 2. Set Environment Variables

In Railway dashboard, add/update these environment variables:

```bash
# Security
PLATFORM_ACCESS_KEY=your-super-secret-platform-key-here

# Domain (update when you configure custom domain)
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Existing variables (keep these)
NODE_ENV=production
JWT_SECRET=your-existing-jwt-secret
ADMIN_KEY=your-existing-admin-key
```

---

## 🌐 **Domain Setup Options**

### **Option A: Single Domain with Path-Based Access (Recommended)**

```
your-domain.com          → Public landing page
your-domain.com/portal   → Platform (team access only)
your-domain.com/admin    → Admin panel (team access only)
```

**Advantages:**
- Simpler DNS setup
- Single SSL certificate
- Easier to manage

### **Option B: Subdomain-Based Access**

```
your-domain.com              → Public landing page  
platform.your-domain.com    → Platform (team access only)
admin.your-domain.com       → Admin panel (team access only)
```

**Advantages:**
- Complete separation
- Can use different designs
- More professional appearance

---

## 🚀 **Implementation Steps**

### **Step 1: Configure DNS (Choose Option A or B)**

#### **For Option A (Single Domain):**
```
A Record:     your-domain.com → Railway IP
CNAME Record: www.your-domain.com → your-domain.com
```

#### **For Option B (Subdomains):**
```
A Record:     your-domain.com → Railway IP
CNAME Record: www.your-domain.com → your-domain.com
CNAME Record: platform.your-domain.com → your-railway-app.railway.app
CNAME Record: admin.your-domain.com → your-railway-app.railway.app
```

### **Step 2: Update Railway Configuration**

1. **Add Custom Domain in Railway:**
   - Go to Railway dashboard
   - Select your project
   - Go to Settings → Domains
   - Add your custom domain(s)

2. **Update Environment Variables:**
   ```bash
   ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com,https://platform.your-domain.com
   ```

### **Step 3: Deploy Updated Code**

```bash
# Commit your changes
git add .
git commit -m "Add domain migration and access control"
git push origin main

# Railway will automatically redeploy
```

### **Step 4: Test Access Control**

1. **Test Public Access:**
   - Visit `https://your-domain.com`
   - Should see professional landing page
   - Try clicking "Team Access" → should require credentials

2. **Test Platform Access:**
   - Try visiting `https://your-domain.com/portal` without login
   - Should redirect to landing page with access denied message
   - Sign in with team credentials → should access platform

3. **Test Team Access:**
   - Sign in with authorized team email → should work
   - Try with non-authorized email → should be denied

---

## 🔧 **Troubleshooting**

### **Issue: "Platform access denied" for team member**

**Solution:** Add their email to `config.platform-access.js`:
```javascript
authorizedUsers: [
  'existing@emails.com',
  'new-team-member@company.com',  // ← Add this
],
```

### **Issue: Public can still access platform**

**Solution:** Check that access control middleware is properly loaded:
1. Verify `lib/access-control.js` exists
2. Check server.js includes: `app.use(routeHandler);`
3. Restart the application

### **Issue: Domain not working**

**Solution:** 
1. Check DNS propagation: `nslookup your-domain.com`
2. Verify Railway domain configuration
3. Check SSL certificate status in Railway

### **Issue: CORS errors after domain change**

**Solution:** Update CORS origins in Railway environment:
```bash
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

---

## 🛡️ **Security Features Implemented**

### **Multi-Layer Protection:**

1. **Route-Level Protection:**
   - `/portal/*` → Requires authentication + authorization
   - `/admin/*` → Requires authentication + authorization  
   - `/api/*` → Requires authentication + authorization

2. **User Authorization:**
   - JWT token validation
   - Email whitelist checking
   - Role-based access control

3. **Admin Override:**
   - Emergency access with `PLATFORM_ACCESS_KEY`
   - For troubleshooting and emergency situations

4. **Audit Logging:**
   - All unauthorized access attempts logged
   - Security events tracked
   - Failed login attempts monitored

### **What Happens When Unauthorized User Tries to Access Platform:**

```
1. User visits /portal
2. System checks for valid JWT token
3. If no token → Redirect to landing page
4. If token exists → Verify email is authorized
5. If not authorized → Redirect to landing page with message
6. If authorized → Allow access to platform
```

---

## 📈 **Managing Access (Adding/Removing Team Members)**

### **Add New Team Member:**

1. **Edit configuration:**
   ```javascript
   // config.platform-access.js
   authorizedUsers: [
     'existing@team.com',
     'new-member@team.com',  // ← Add here
   ],
   ```

2. **Deploy update:**
   ```bash
   git add config.platform-access.js
   git commit -m "Add new team member access"
   git push origin main
   ```

### **Remove Team Member:**

1. **Remove from configuration:**
   ```javascript
   // Remove their email from authorizedUsers array
   ```

2. **Deploy update** (same as above)

### **Emergency Access:**

If you need to give someone temporary access without code deployment:

```bash
# They can add this to their request:
https://your-domain.com/portal?platformKey=your-secret-platform-key
```

**⚠️ Important:** Change `PLATFORM_ACCESS_KEY` regularly and keep it secret!

---

## ✅ **Final Verification Checklist**

After migration, verify:

- [ ] `your-domain.com` shows professional landing page
- [ ] Public visitors cannot access `/portal` 
- [ ] Team members can sign in and access platform
- [ ] Non-team emails are denied access
- [ ] All platform features work on new domain
- [ ] SSL certificate is active
- [ ] No CORS errors in browser console

---

## 🎯 **Result: Perfect Access Control**

**✅ Public Experience:**
- Professional landing page
- Clear value proposition  
- Contact form for inquiries
- No platform access

**✅ Team Experience:**
- Seamless platform access
- All development features preserved
- Secure authentication
- Full functionality maintained

**✅ Security:**
- Multi-layer protection
- Comprehensive logging
- Easy access management
- Emergency override capability

Your platform is now enterprise-ready with proper access control! 🚀
