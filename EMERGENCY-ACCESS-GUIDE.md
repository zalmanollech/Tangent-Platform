# Emergency Access Guide
*Backup method to create admin accounts if regular setup fails*

## 🆘 **If Admin Setup Page Doesn't Work**

If you can't access `/admin-setup`, use this emergency method:

### **Step 1: Deploy Emergency Routes**

```bash
git add .
git commit -m "Add emergency setup routes for admin account creation"
git push origin main
```

### **Step 2: Create Your Admin Account via API**

Use this method with any REST API client (Postman, curl, or browser console):

#### **Method A: Using Browser Console**

1. **Visit your Railway URL**: https://tangent-platform-production.up.railway.app/
2. **Open browser console** (F12 → Console tab)
3. **Paste this code** (update with your details):

```javascript
fetch('/emergency/create-admin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    secretKey: 'tangent-emergency-2024-setup',
    name: 'Your Name',
    email: 'ollech@gmail.com',
    password: 'your-secure-password'
  })
})
.then(response => response.json())
.then(data => {
  console.log('Result:', data);
  if (data.success) {
    alert('✅ Admin account created! You can now login.');
    // Store the token for immediate access
    localStorage.setItem('authToken', data.token);
    window.location.href = '/portal';
  } else {
    alert('❌ Error: ' + data.error);
  }
})
.catch(error => {
  console.error('Error:', error);
  alert('❌ Request failed: ' + error.message);
});
```

#### **Method B: Using curl (if you have it)**

```bash
curl -X POST https://tangent-platform-production.up.railway.app/emergency/create-admin \
  -H "Content-Type: application/json" \
  -d '{
    "secretKey": "tangent-emergency-2024-setup",
    "name": "Your Name",
    "email": "ollech@gmail.com", 
    "password": "your-secure-password"
  }'
```

### **Step 3: Create Dudi's Account**

Repeat the same process with Dudi's details:

```javascript
fetch('/emergency/create-admin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    secretKey: 'tangent-emergency-2024-setup',
    name: 'Dudi',
    email: 'dudiollech@gmail.com',
    password: 'dudi-secure-password'
  })
})
.then(response => response.json())
.then(data => console.log('Dudi account:', data));
```

### **Step 4: Update Email/Password Later**

If you need to change email or password later:

```javascript
fetch('/emergency/update-user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    secretKey: 'tangent-emergency-2024-setup',
    email: 'ollech@gmail.com',           // Current email
    newEmail: 'admin@tangent-protocol.com', // New email (optional)
    newPassword: 'new-secure-password'      // New password (optional)
  })
})
.then(response => response.json())
.then(data => console.log('Update result:', data));
```

## 🔒 **Security Notes**

- **Secret key** prevents unauthorized account creation
- **Emergency routes** should be disabled after setup
- **Accounts created** have full admin privileges
- **Tokens returned** provide immediate access

## ✅ **After Account Creation**

1. **Test login**: Click "Team Portal" → use your credentials
2. **Access platform**: Should reach full dashboard
3. **Disable emergency**: Remove emergency routes for security

## 🎯 **Expected Results**

After creating accounts:
- ✅ You can login with ollech@gmail.com + password
- ✅ Dudi can login with dudiollech@gmail.com + password  
- ✅ Both have full admin access to platform
- ✅ Public still sees landing page only

## 🚀 **Quick Start**

**Just run the git commands above, then use the browser console method!** It's the easiest way to create your admin accounts if the regular setup page doesn't work.

The browser console method will:
1. Create your account
2. Store the login token
3. Redirect you to the platform automatically

**Ready to try this backup method?** 🛠️
