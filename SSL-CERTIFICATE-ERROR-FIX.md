# SSL Certificate Error Fix - traidefi.ai

**Error:** `NET::ERR_CERT_COMMON_NAME_INVALID`  
**Meaning:** The SSL certificate doesn't match the domain `traidefi.ai`

---

## 🔍 Why This Happens

The error `NET::ERR_CERT_COMMON_NAME_INVALID` means:
- Your browser tried to connect to `https://traidefi.ai`
- Railway presented an SSL certificate
- But the certificate is for a different domain (like `www.traidefi.ai` or Railway's default domain)
- The certificate doesn't include `traidefi.ai` as a valid domain

---

## ✅ Solution: Add Custom Domain in Railway

**Railway needs to know about your custom domain to provision SSL certificates.**

### Step 1: Add Custom Domain in Railway

1. Go to **Railway dashboard** (https://railway.app)
2. Log in
3. Click on your project (e.g., "tangent-platform")
4. Go to **"Settings"** tab (or **"Domains"** tab)
5. Look for **"Custom Domains"** section
6. Click **"Add Domain"** or **"Add Custom Domain"**
7. Enter: `traidefi.ai`
8. Click **"Add"** or **"Save"**
9. Railway will automatically provision an SSL certificate (takes 5-10 minutes)

### Step 2: Add www Subdomain (Optional but Recommended)

1. In same **"Custom Domains"** section
2. Click **"Add Domain"** again
3. Enter: `www.traidefi.ai`
4. Click **"Add"**
5. Railway will provision SSL for this too

### Step 3: Wait for SSL Provisioning

- Railway automatically requests SSL certificates from Let's Encrypt
- Takes **5-10 minutes** to provision
- You'll see a status indicator in Railway dashboard
- Once ready, you'll see "SSL Active" or green checkmark

---

## 🔍 Verify DNS Configuration

**Make sure your DNS is correct:**

### In GoDaddy:
1. **A Record** for `@` (root domain):
   - **Name:** `@` (or leave empty)
   - **Type:** A
   - **Value:** Railway's IP address (check Railway dashboard)
   - **TTL:** 600

2. **CNAME Record** for `www`:
   - **Name:** `www`
   - **Type:** CNAME
   - **Value:** `tangent-platform-production.up.railway.app` (or your Railway domain)
   - **TTL:** 600

---

## 🧪 Test After SSL Provisioning

1. **Wait 5-10 minutes** after adding domain in Railway
2. **Clear browser cache** (or use incognito mode)
3. Visit: `https://traidefi.ai`
4. Should see **green padlock** (not red warning)
5. Should show "Traidefi" branding (not "Tangent Protocol")

---

## ⚠️ Common Issues

### Issue 1: "Domain not verified" in Railway
**Solution:**
- Check DNS records are correct
- Wait for DNS propagation (can take up to 48 hours)
- Verify A record points to correct Railway IP

### Issue 2: SSL still not working after 10 minutes
**Solution:**
- Check Railway logs for SSL errors
- Verify domain is correctly added in Railway
- Try removing and re-adding the domain
- Contact Railway support if needed

### Issue 3: Works for www but not root domain
**Solution:**
- Make sure both `traidefi.ai` and `www.traidefi.ai` are added in Railway
- Check both A record and CNAME record are correct
- Wait for both SSL certificates to provision

---

## 📋 Quick Checklist

- [ ] Add `traidefi.ai` as custom domain in Railway
- [ ] Add `www.traidefi.ai` as custom domain in Railway
- [ ] Wait 5-10 minutes for SSL provisioning
- [ ] Verify DNS records are correct in GoDaddy
- [ ] Test `https://traidefi.ai` (should show green padlock)
- [ ] Test `https://www.traidefi.ai` (should work too)
- [ ] Clear browser cache and test again

---

## 🎯 Summary

**The SSL error happens because Railway doesn't know about your custom domain yet.**

**Fix:**
1. Add `traidefi.ai` in Railway → Settings → Custom Domains
2. Wait 5-10 minutes for SSL certificate
3. Test again

**After this, the SSL error will be gone and the domain will work!**

---

**Last Updated:** November 4, 2025

