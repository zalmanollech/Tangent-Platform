# Fix Both Issues: Branding + SSL Certificate

**Issues:**
1. Landing page shows "Tangent Protocol" instead of "Traidefi"
2. SSL certificate error (`NET::ERR_CERT_COMMON_NAME_INVALID`)

---

## ✅ Issue 1: Branding Fixed

**What I did:**
- Enhanced brand detection to prioritize `traidefi.ai` domain
- Made it case-insensitive
- Improved domain matching logic

**Status:** ✅ Fixed in code (will work after deployment)

---

## ⚠️ Issue 2: SSL Certificate Error

**Why it happens:**
- Railway doesn't know about `traidefi.ai` as a custom domain yet
- No SSL certificate provisioned for `traidefi.ai`
- Browser sees certificate mismatch

**Solution: Add Custom Domain in Railway**

### Step-by-Step:

1. **Go to Railway Dashboard:**
   - Visit: https://railway.app
   - Log in
   - Click on your project (e.g., "tangent-platform")

2. **Add Custom Domain:**
   - Go to **"Settings"** tab (or **"Domains"** tab)
   - Find **"Custom Domains"** section
   - Click **"Add Domain"** or **"Add Custom Domain"**
   - Enter: `traidefi.ai`
   - Click **"Add"** or **"Save"**

3. **Add www Subdomain (Optional):**
   - In same section, click **"Add Domain"** again
   - Enter: `www.traidefi.ai`
   - Click **"Add"**

4. **Wait for SSL Provisioning:**
   - Railway automatically requests SSL certificate from Let's Encrypt
   - Takes **5-10 minutes**
   - You'll see status in Railway dashboard
   - Once ready, shows "SSL Active" or green checkmark

5. **Verify DNS (If Needed):**
   - Make sure GoDaddy DNS is correct:
     - **A Record** for `@` → Railway IP address
     - **CNAME** for `www` → Railway domain (e.g., `tangent-platform-production.up.railway.app`)

---

## 🧪 After Fixing SSL

1. **Wait 5-10 minutes** after adding domain in Railway
2. **Clear browser cache** (or use incognito mode)
3. Visit: `https://traidefi.ai`
4. Should see:
   - ✅ **Green padlock** (not red warning)
   - ✅ **"Traidefi"** in title and header (not "Tangent Protocol")
   - ✅ No SSL errors

---

## 📋 Quick Checklist

- [x] Branding code fixed ✅
- [ ] Add `traidefi.ai` in Railway → Settings → Custom Domains
- [ ] Add `www.traidefi.ai` in Railway (optional)
- [ ] Wait 5-10 minutes for SSL certificate
- [ ] Test `https://traidefi.ai` (should work)
- [ ] Verify "Traidefi" branding shows correctly

---

## 🎯 Summary

**Issue 1 (Branding):** ✅ Fixed in code - will work after deployment

**Issue 2 (SSL):** ⚠️ **Action Required** - Add custom domain in Railway

**Most Important:** Add `traidefi.ai` as custom domain in Railway to fix SSL error!

---

**Last Updated:** November 4, 2025

