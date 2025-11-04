# Traidefi Setup Checklist - What You Need to Do

## ✅ COMPLETED (Done by AI)
- [x] Brand detection middleware added
- [x] Traidefi landing page with Tools focus
- [x] `/tools` hub page created
- [x] `/tools/credit-report` form page created
- [x] `/tools/insurance-quote` form page created
- [x] Vercel project imported from GitHub

## 🔧 WHAT YOU NEED TO DO NOW

### 1. GoDaddy DNS Configuration (Point traidefi.ai to Vercel)

**Step-by-step:**

1. **Log in to GoDaddy:**
   - Go to https://godaddy.com
   - Sign in with your account

2. **Find Domain Management:**
   - Click "My Products" or "Domains"
   - Find `traidefi.ai` in your domain list
   - Click on `traidefi.ai` or click "DNS" button

3. **Configure DNS Records:**
   
   **If you're using Vercel (recommended):**
   
   a. In Vercel:
      - Go to your project → Settings → Domains
      - Click "Add Domain"
      - Enter `traidefi.ai` and click "Add"
      - Vercel will show you DNS instructions (usually CNAME records)
   
   b. In GoDaddy:
      - Delete any existing A records for `@` (root)
      - Delete any existing CNAME records for `www`
      - Add **CNAME record**:
        - **Type:** CNAME
        - **Host:** @ (or leave blank/root)
        - **Points to:** `cname.vercel-dns.com` (Vercel will tell you the exact value)
        - **TTL:** 3600 (or default)
      - Add **CNAME record for www:**
        - **Type:** CNAME
        - **Host:** www
        - **Points to:** `cname.vercel-dns.com` (same as above)
        - **TTL:** 3600

   **Alternative: If using Railway only:**
   
   - Get your Railway domain (e.g., `traidefi.railway.app`)
   - In GoDaddy:
     - Add **CNAME record:**
       - **Type:** CNAME
       - **Host:** @
       - **Points to:** `traidefi.railway.app` (your Railway domain)
     - Add **CNAME record for www:**
       - **Type:** CNAME
       - **Host:** www
       - **Points to:** `traidefi.railway.app`

4. **Wait for DNS Propagation:**
   - DNS changes take 1-24 hours to propagate
   - You can check with: https://www.whatsmydns.net/#CNAME/traidefi.ai

**Quick Video Guide:**
- GoDaddy has video tutorials: Search "GoDaddy DNS CNAME setup" on YouTube

---

### 2. PayPal Business Account Setup

1. **Create PayPal Business Account:**
   - Go to https://www.paypal.com/business
   - Click "Sign Up" → Choose "Business Account"
   - Complete registration

2. **Create REST App:**
   - Log in to PayPal Business Dashboard
   - Go to: Developer → My Apps & Credentials
   - Click "Create App"
   - **App Name:** Traidefi Tools
   - **Merchant:** Your business
   - Click "Create App"

3. **Get Sandbox Credentials:**
   - Under your new app, you'll see:
     - **Client ID** (looks like: `Ae...`)
     - **Secret** (click "Show" to reveal)
   - Copy both values

4. **Get Live Credentials (later):**
   - Same process, but click "Live" tab instead of "Sandbox"

5. **Add to config.env:**
   - Open `config.env` file
   - Update these lines:
     ```
     PAYPAL_CLIENT_ID=your_sandbox_client_id_here
     PAYPAL_CLIENT_SECRET=your_sandbox_secret_here
     PAYPAL_ENVIRONMENT=sandbox
     ```

---

### 3. Postgres Database Setup

**Option A: Supabase (Recommended - Free tier available)**
1. Go to https://supabase.com
2. Sign up for free account
3. Click "New Project"
4. Fill in:
   - **Name:** traidefi-db
   - **Database Password:** (create strong password, save it!)
   - **Region:** Choose closest to you
5. Wait for project to be created (~2 minutes)
6. Go to: Settings → Database
7. Find "Connection string" → Copy "URI" format
   - Looks like: `postgresql://postgres:password@db.xxx.supabase.co:5432/postgres`
8. Add to config.env:
   ```
   DATABASE_URL=postgresql://postgres:your_password@db.xxx.supabase.co:5432/postgres
   ```

**Option B: Neon (Alternative - Free tier)**
1. Go to https://neon.tech
2. Sign up
3. Create new project
4. Copy connection string
5. Add to config.env (same format as above)

**Option C: Railway (If you prefer)**
1. In Railway dashboard → New → Database → Postgres
2. Copy DATABASE_URL from Railway
3. Add to config.env

---

### 4. Storage Setup (For PDF files)

**Option A: Supabase Storage (Recommended - if using Supabase for DB)**
1. In your Supabase project → Storage
2. Create new bucket:
   - **Name:** traidefi-reports
   - **Public:** Yes (or No if you want signed URLs)
3. Add to config.env:
   ```
   STORAGE_TYPE=supabase
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_KEY=your_anon_key_here
   SUPABASE_BUCKET=traidefi-reports
   ```

**Option B: AWS S3**
1. Create AWS account → S3
2. Create bucket: `traidefi-reports`
3. Create IAM user with S3 access
4. Get Access Key ID and Secret Access Key
5. Add to config.env:
   ```
   STORAGE_TYPE=s3
   AWS_ACCESS_KEY_ID=your_key_here
   AWS_SECRET_ACCESS_KEY=your_secret_here
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=traidefi-reports
   ```

---

### 5. Email Provider Setup

**Option A: Resend (Recommended - Easy setup)**
1. Go to https://resend.com
2. Sign up (free tier: 3,000 emails/month)
3. Verify your domain (or use their test domain for now)
4. Get API key from dashboard
5. Add to config.env:
   ```
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_your_api_key_here
   FROM_EMAIL=noreply@traidefi.ai
   ```

**Option B: SendGrid**
1. Go to https://sendgrid.com
2. Sign up (free tier: 100 emails/day)
3. Verify sender email
4. Create API key
5. Add to config.env:
   ```
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=SG.your_api_key_here
   FROM_EMAIL=noreply@traidefi.ai
   ```

---

## 📋 Quick Summary Checklist

- [ ] Configure GoDaddy DNS (point traidefi.ai to Vercel/Railway)
- [ ] Create PayPal Business account + get sandbox credentials
- [ ] Create Postgres database (Supabase/Neon/Railway)
- [ ] Set up storage (Supabase Storage or S3)
- [ ] Set up email provider (Resend or SendGrid)
- [ ] Update `config.env` with all credentials
- [ ] Share credentials with AI (or I'll help you add them to Vercel env vars)

---

## 🚀 Once You Complete These:

Once you've done the above, say:
- **"I've completed the checklist"** or
- **"I need help with [specific item]"** 

Then I'll:
1. Add PayPal integration (checkout, webhooks)
2. Connect to your database
3. Set up purchase → job → email flow
4. Create dashboard for "My Reports" and "My Quotes"
5. Add admin panel

---

## 💡 Need Help?

If you get stuck on any step:
1. Take a screenshot of what you see
2. Tell me exactly where you are
3. I'll guide you through that specific step

**Next immediate action:** Start with GoDaddy DNS configuration since you have the domain there already!



