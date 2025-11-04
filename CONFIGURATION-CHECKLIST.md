# Configuration Checklist - Supabase Storage & Email

## ✅ Step-by-Step Guide

### Part 1: Supabase Storage Setup

#### Step 1: Create Storage Bucket
1. Go to **https://supabase.com** → Sign in
2. Select your project (database: `qqqfkszxkuxvqyisphti`)
3. Click **"Storage"** in left sidebar
4. Click **"New bucket"** button
5. Fill in:
   - **Name:** `traidefi-reports`
   - **Public bucket:** ✅ **CHECK THIS** (important!)
   - Leave other fields as default
6. Click **"Create bucket"**

#### Step 2: Get Supabase API Key
1. In Supabase project, click **"Settings"** (gear icon, bottom left)
2. Click **"API"** in settings menu
3. Find **"Project API keys"** section
4. Copy the **"anon"** `public` key (long string starting with `eyJhbGci...`)

#### Step 3: Update config.env
1. Open `config.env` in your project
2. Find this section:
   ```env
   # SUPABASE_KEY=your_supabase_anon_key_here (get from Supabase dashboard)
   # SUPABASE_BUCKET=traidefi-reports
   ```
3. Uncomment and fill in:
   ```env
   SUPABASE_KEY=paste_your_anon_key_here
   SUPABASE_BUCKET=traidefi-reports
   ```
4. Save file

---

### Part 2: Email Service Setup

#### Choose Email Provider:

**Option A: Gmail SMTP (Easiest - Recommended to Start)**
1. Go to **https://myaccount.google.com/apppasswords**
2. Generate App Password:
   - Select app: **Mail**
   - Select device: **Other (Custom name)**
   - Name: **Traidefi**
   - Click **Generate**
3. **Copy the 16-character password** (remove spaces)
4. Update `config.env`:
   ```env
   EMAIL_PROVIDER=nodemailer
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=paste_your_app_password_here
   ```

**Option B: Resend (Recommended for Production)**
1. Sign up at **https://resend.com**
2. Get API key from dashboard
3. Update `config.env` (note: Resend integration needs implementation)
4. Or start with Gmail SMTP now, switch to Resend later

---

### Part 3: Update BASE_URL (Already Done ✅)
- Updated to: `BASE_URL=https://traidefi.ai`

---

## Quick Copy-Paste for config.env

After you get your credentials, update `config.env` with:

### Supabase Storage:
```env
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_BUCKET=traidefi-reports
```

### Gmail SMTP:
```env
EMAIL_PROVIDER=nodemailer
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=abcdefghijklmnop
FROM_EMAIL=noreply@traidefi.ai
FROM_NAME=Traidefi
BASE_URL=https://traidefi.ai
```

---

## After Configuration

1. ✅ **Save** `config.env`
2. ✅ **Restart your server** (if running locally)
3. ✅ **Test** by making a test purchase
4. ✅ **Check** email inbox for notification
5. ✅ **Check** PDF upload to Supabase Storage

---

## What to Do Now:

1. **Set up Supabase Storage:**
   - Create bucket: `traidefi-reports` (public)
   - Get anon key from Settings → API
   - Add to config.env

2. **Set up Email (Gmail SMTP recommended):**
   - Generate Gmail App Password
   - Add to config.env

3. **Share your values:**
   - Share your Supabase anon key (or add it to config.env yourself)
   - Share your Gmail credentials (or add them yourself)

4. **Test:**
   - Make a test purchase
   - Verify email arrives
   - Verify PDF is uploaded to Supabase

---

## Need Help?

Tell me when you've:
- ✅ Created the Supabase bucket
- ✅ Got your Supabase anon key
- ✅ Chosen email provider (Gmail or Resend)
- ✅ Got your email credentials

I can help you update `config.env` or test the configuration!

