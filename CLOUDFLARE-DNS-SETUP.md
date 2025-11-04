# Cloudflare DNS Setup for traidefi.ai → Railway

**Goal:** Point `traidefi.ai` to your Railway deployment (tangent-protocol.com)

---

## ✅ Step 1: Get Railway URL

**In Railway Dashboard:**
1. Go to **Railway Dashboard:** https://railway.app
2. Click on **"Tangent-Platform"** service
3. Click **"Settings"** tab
4. Find **"Domains"** or **"Custom Domains"** section
5. Look for the Railway-generated domain (e.g., `tangent-platform-production.up.railway.app`)
6. **Copy this URL** - you'll need it for Cloudflare DNS

**OR** check your Railway service's **"Deployments"** tab for the public URL.

**Common Railway URL format:**
- `tangent-platform-production.up.railway.app`
- `tangent-platform-staging.up.railway.app`
- Or similar Railway subdomain

---

## ✅ Step 2: Go to Cloudflare Dashboard

1. **Go to Cloudflare:** https://dash.cloudflare.com
2. **Log in** (if needed)
3. **Click on `traidefi.ai`** domain (left sidebar)

---

## ✅ Step 3: Add DNS Records

**In Cloudflare Dashboard → DNS → Records:**

### Option A: Using CNAME (Recommended)

**Add CNAME record:**
1. **Click "Add record"**
2. **Type:** `CNAME`
3. **Name:** `@` (or leave blank for root domain)
4. **Target:** Your Railway URL (e.g., `tangent-platform-production.up.railway.app`)
5. **Proxy status:** 
   - **Orange cloud** (Proxied) = Cloudflare handles SSL ✅
   - **Gray cloud** (DNS only) = Railway handles SSL
6. **TTL:** Auto
7. **Click "Save"**

**Note:** Some DNS providers don't allow CNAME on root (`@`). If that's the case, use Option B.

### Option B: Using A Record (If CNAME not allowed)

**Add A record:**
1. **Click "Add record"**
2. **Type:** `A`
3. **Name:** `@` (or leave blank for root domain)
4. **IPv4 address:** Get Railway IP address (see below)
5. **Proxy status:** 
   - **Orange cloud** (Proxied) = Cloudflare handles SSL ✅
   - **Gray cloud** (DNS only) = Railway handles SSL
6. **TTL:** Auto
7. **Click "Save"**

**To get Railway IP address:**
```bash
# In terminal, run:
nslookup tangent-platform-production.up.railway.app
# Or
dig tangent-platform-production.up.railway.app
```

**Copy the IP address** and use it in the A record.

### Option C: Using Cloudflare Proxy (Recommended for SSL)

**If using Cloudflare proxy (orange cloud):**
1. **DNS record should point to Railway URL/IP**
2. **Cloudflare will handle SSL automatically**
3. **No need to configure SSL in Railway**

**If using DNS only (gray cloud):**
1. **Railway needs to handle SSL**
2. **May need to add `traidefi.ai` as custom domain in Railway**

---

## ✅ Step 4: Add www Subdomain (Optional)

**Add CNAME record for www:**
1. **Click "Add record"**
2. **Type:** `CNAME`
3. **Name:** `www`
4. **Target:** Your Railway URL (same as above)
5. **Proxy status:** Orange cloud (Proxied) ✅
6. **TTL:** Auto
7. **Click "Save"**

---

## ✅ Step 5: Verify DNS Propagation

**Wait 5-10 minutes for DNS to propagate, then test:**

### Test 1: Check DNS Records
```bash
# In terminal, run:
nslookup traidefi.ai
# Should show Cloudflare nameservers or Railway IP/domain
```

### Test 2: Check Website
1. **Visit:** `https://traidefi.ai`
2. **Should see:** Traidefi landing page (not 404)
3. **If still 404:** Wait for DNS propagation (up to 48 hours, usually 5-10 minutes)

---

## 🔍 Troubleshooting

### Issue 1: Still Getting 404

**Cause:** Railway doesn't recognize `traidefi.ai` as a custom domain

**Solution:**
1. **Go to Railway → Tangent-Platform → Settings**
2. **Find "Custom Domains" section**
3. **Try to add `traidefi.ai`** (may fail if Railway limit reached)
4. **If fails:** Use Cloudflare proxy (orange cloud) - Cloudflare handles routing

### Issue 2: SSL Certificate Error

**Cause:** SSL not configured correctly

**Solution:**
- **If using Cloudflare proxy (orange cloud):** Cloudflare handles SSL automatically ✅
- **If using DNS only (gray cloud):** Railway needs to provision SSL for `traidefi.ai`

### Issue 3: DNS Not Propagating

**Cause:** DNS changes take time to propagate

**Solution:**
- **Wait 5-10 minutes** (usually enough)
- **Up to 48 hours** for full global propagation
- **Check DNS propagation:** https://www.whatsmydns.net/#A/traidefi.ai

### Issue 4: Wrong Website Showing

**Cause:** DNS pointing to wrong location

**Solution:**
1. **Check Cloudflare DNS records** - should point to Railway URL
2. **Check Railway domain** - should be correct
3. **Clear browser cache** - may be showing cached version

---

## 📋 Quick Checklist

- [ ] Get Railway URL from Railway dashboard
- [ ] Go to Cloudflare → traidefi.ai → DNS
- [ ] Add CNAME record for `@` pointing to Railway URL
- [ ] Set proxy status to **Orange cloud** (Proxied) ✅
- [ ] Add CNAME record for `www` (optional)
- [ ] Wait 5-10 minutes for DNS propagation
- [ ] Test `https://traidefi.ai` - should see Traidefi landing page
- [ ] If still 404, check Railway custom domain settings

---

## 🚨 Important Notes

**Railway One-Domain Limit:**
- Railway free tier allows **one custom domain** per service
- If `tangent-protocol.com` is already configured, you may not be able to add `traidefi.ai` in Railway
- **Solution:** Use Cloudflare proxy to handle multiple domains

**Cloudflare Proxy vs DNS Only:**
- **Orange cloud (Proxied):** Cloudflare handles SSL, DDoS protection, caching ✅
- **Gray cloud (DNS only):** Railway handles SSL, direct connection

**Recommended Setup:**
- Use **Cloudflare proxy (orange cloud)** for `traidefi.ai`
- Cloudflare handles SSL automatically
- No need to configure domain in Railway
- Better performance and security

---

**Last Updated:** November 4, 2025

