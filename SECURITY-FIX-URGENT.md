# ⚠️ CRITICAL SECURITY FIX - URGENT

## Issue: API Keys Exposed on GitHub

GitGuardian detected that the following secrets were exposed in your GitHub repository:
- ✅ PayPal OAuth2 Keys (Client ID & Secret)
- ✅ PostgreSQL URI (Database connection string with password)
- ✅ Resend API Key
- ✅ Supabase Key (anon key)

---

## 🚨 IMMEDIATE ACTIONS REQUIRED

### Step 1: Rotate All Exposed Credentials (DO THIS FIRST!)

#### 1. PayPal Credentials
1. Go to https://developer.paypal.com/
2. Log in to your PayPal Developer account
3. Navigate to "My Apps & Credentials"
4. **Revoke the old Client ID** (or create a new app)
5. Generate **new Client ID and Secret**
6. Update `config.env` with new credentials

#### 2. Database Password
1. Go to Supabase Dashboard
2. Navigate to "Settings" → "Database"
3. **Change the database password**
4. Get new connection string
5. Update `config.env` with new `DATABASE_URL`

#### 3. Resend API Key
1. Go to https://resend.com/api-keys
2. Log in to your Resend account
3. **Revoke the old API key**
4. Generate **new API key**
5. Update `config.env` with new `RESEND_API_KEY`

#### 4. Supabase Anon Key
1. Go to Supabase Dashboard
2. Navigate to "Settings" → "API"
3. **Regenerate the anon key** (if possible)
4. Update `config.env` with new `SUPABASE_KEY`

---

## 🔧 Step 2: Remove Secrets from Git History

### Option A: Remove File from Git (Recommended)
```bash
# Remove config.env from Git tracking
git rm --cached config.env

# Commit the removal
git commit -m "Remove config.env from repository (security fix)"

# Push to GitHub
git push
```

### Option B: Clean Git History (If you need to remove from history)
**Warning:** This rewrites Git history. Only do this if you're the only one working on this repo.

```bash
# Remove file from all commits
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch config.env" --prune-empty --tag-name-filter cat -- --all

# Force push (DANGEROUS - only if you're sure)
git push origin --force --all
```

---

## ✅ Step 3: Prevent Future Exposures

### 1. Verify `.gitignore` includes `config.env`
The `.gitignore` file should contain:
```
config.env
.env
*.env
```

### 2. Create `.env.example` for Reference
Create a template file that shows what variables are needed (without real values):
```env
# Example: Copy this to config.env and fill in your real values
PAYPAL_CLIENT_ID=your_paypal_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_client_secret_here
DATABASE_URL=postgresql://user:password@host:port/database
RESEND_API_KEY=your_resend_api_key_here
SUPABASE_KEY=your_supabase_key_here
```

### 3. Never Commit Secrets
- Always check `git status` before committing
- Use environment variables in production (Railway, Vercel)
- Keep secrets local or in secure vaults

---

## 📋 Step 4: Verify Fix

After rotating credentials:
1. ✅ Test PayPal payment flow
2. ✅ Test database connection
3. ✅ Test email sending
4. ✅ Verify no secrets in Git: `git log -p -- config.env` (should show nothing)

---

## 🎯 Priority Order

1. **IMMEDIATE:** Rotate all exposed credentials (Step 1)
2. **URGENT:** Remove config.env from Git (Step 2)
3. **IMPORTANT:** Create .env.example (Step 3)
4. **VERIFY:** Test everything works (Step 4)

---

**Last Updated:** Current Session  
**Status:** CRITICAL - Fix immediately

