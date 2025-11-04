# Supabase Storage Setup Guide

## Step-by-Step Instructions

### Step 1: Access Supabase Dashboard
1. Go to **https://supabase.com**
2. Sign in to your account
3. Select your project (the one with database `qqqfkszxkuxvqyisphti`)

### Step 2: Create Storage Bucket
1. In your Supabase project, click **"Storage"** in the left sidebar
2. Click **"New bucket"** button (top right)
3. Fill in:
   - **Name:** `traidefi-reports`
   - **Public bucket:** ✅ **Check this box** (important for public PDF access)
   - **File size limit:** Leave default or set (e.g., 50MB)
   - **Allowed MIME types:** Leave empty (allows all file types)
4. Click **"Create bucket"**

### Step 3: Get Your Supabase Anon Key
1. In Supabase project, click **"Settings"** (gear icon, bottom left)
2. Click **"API"** in the settings menu
3. Find **"Project API keys"** section
4. Look for **"anon"** `public` key
5. **Copy this key** (it looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

### Step 4: Update config.env
1. Open `config.env` in your project
2. Find the Storage Configuration section
3. Add/update:
   ```env
   SUPABASE_KEY=your_anon_key_here
   SUPABASE_BUCKET=traidefi-reports
   ```
4. Save the file

### Step 5: Test Storage (Optional)
You can test if storage is working after updating config.env.

---

## Quick Reference

**Your Supabase Project:**
- URL: `https://qqqfkszxkuxvqyisphti.supabase.co`
- Bucket Name: `traidefi-reports`
- Bucket Type: **Public** ✅

**What You Need:**
1. Supabase anon key (from Settings → API)
2. Bucket name: `traidefi-reports`
3. Update config.env with these values

---

## Troubleshooting

**Bucket not showing up?**
- Make sure you clicked "Create bucket" and it saved
- Refresh the Storage page

**Can't find API key?**
- Go to Settings → API (not Settings → General)
- Look for "Project API keys" section
- Use the "anon" `public` key (not the "service_role" key)

**Getting 403 errors?**
- Make sure bucket is set to **Public**
- Check bucket name matches exactly: `traidefi-reports`

