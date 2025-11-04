# GoDaddy DNS Setup for Traidefi.ai

## Step-by-Step Guide to Add CNAME Records

### 1. Log in to GoDaddy
- Go to https://www.godaddy.com
- Click "Sign In" (top right)
- Enter your credentials

### 2. Navigate to DNS Management
1. After signing in, click **"My Products"** (top menu)
2. Find **"Domains"** section
3. Click on **`traidefi.ai`** domain name
4. Look for **"DNS"** or **"Manage DNS"** button/tab
5. Click on it to open DNS management page

### 3. Add CNAME Records

You need to add TWO CNAME records:

#### Record 1: Root Domain (traidefi.ai)
1. Click **"Add"** button (usually at the top or bottom of the DNS records table)
2. Select record type: **"CNAME"**
3. Fill in:
   - **Name/Host**: Leave empty or enter `@` (represents root domain)
   - **Value/Points to**: Your Railway URL (e.g., `tangent-platform-production.up.railway.app`)
   - **TTL**: `600` (default is fine)
4. Click **"Save"** or **"Add Record"**

**Note:** Some providers don't allow CNAME on root domain (@). If GoDaddy doesn't allow this:
- You may need to use an **A record** instead
- Or use Railway's provided IP address
- Or contact GoDaddy support for guidance

#### Record 2: www Subdomain (www.traidefi.ai)
1. Click **"Add"** button again
2. Select record type: **"CNAME"**
3. Fill in:
   - **Name/Host**: `www`
   - **Value/Points to**: Same Railway URL (e.g., `tangent-platform-production.up.railway.app`)
   - **TTL**: `600` (default is fine)
4. Click **"Save"** or **"Add Record"**

### 4. Verify Records

After adding, you should see:
```
Type    Name    Value                                      TTL
CNAME   @       tangent-platform-production.up.railway.app 600
CNAME   www     tangent-platform-production.up.railway.app 600
```

### 5. Configure in Railway

**Important:** After adding DNS records, you also need to configure the domain in Railway:

1. Go to your Railway project dashboard
2. Go to **Settings** → **Domains** (or **Networking** → **Domains**)
3. Click **"Add Custom Domain"**
4. Add both:
   - `traidefi.ai`
   - `www.traidefi.ai`
5. Railway will verify the DNS records (may take a few minutes)

### 6. Wait for Propagation

DNS changes can take:
- **Immediate to 5 minutes** (usually)
- **Up to 48 hours** (rarely, but possible)
- Most changes propagate within **15-60 minutes**

You can check DNS propagation with:
- https://www.whatsmydns.net
- Enter `traidefi.ai` and check CNAME records

---

## Alternative: If CNAME on Root Doesn't Work

If GoDaddy doesn't allow CNAME on root domain (`@`), use these alternatives:

### Option A: Use A Record (IP Address)
1. Get Railway's IP address (contact Railway support or check their docs)
2. Add **A Record**:
   - Type: **A**
   - Name: `@` or leave empty
   - Value: Railway's IP address
   - TTL: `600`

### Option B: Use Subdomain Only
1. Skip root domain CNAME
2. Only add `www.traidefi.ai` CNAME
3. Set up redirect from `traidefi.ai` → `www.traidefi.ai` in Railway

---

## Troubleshooting

### Records Not Showing Up?
- Wait 10-15 minutes and refresh the page
- Clear browser cache
- Try incognito/private browsing mode

### Domain Not Working?
- Verify DNS propagation: https://www.whatsmydns.net
- Check Railway domain settings are correct
- Verify CNAME value matches exactly (no trailing spaces)
- Make sure Railway has the domain added in their dashboard

### Still Need Help?
- GoDaddy Support: https://www.godaddy.com/help
- Railway Support: Check Railway dashboard → Support

---

## Quick Reference

**Your Railway URL:** (Get this from Railway dashboard)
- Example: `tangent-platform-production.up.railway.app`

**Records to Add:**
1. CNAME: `@` → `railway-url.up.railway.app`
2. CNAME: `www` → `railway-url.up.railway.app`

**Time to Take Effect:** 15-60 minutes typically

