# Email Service Setup Guide

## Choose Your Email Provider

### Option 1: Gmail SMTP (Easiest - Free)
**Best for:** Quick testing, personal projects  
**Cost:** Free (with Gmail account)  
**Setup Time:** 5 minutes

### Option 2: Resend (Recommended for Production)
**Best for:** Production apps, professional emails  
**Cost:** Free tier: 3,000 emails/month  
**Setup Time:** 10 minutes

### Option 3: SendGrid
**Best for:** High volume  
**Cost:** Free tier: 100 emails/day  
**Setup Time:** 10 minutes

---

## Option 1: Gmail SMTP Setup

### Step 1: Enable 2-Step Verification
1. Go to **https://myaccount.google.com**
2. Click **"Security"** in left menu
3. Find **"2-Step Verification"**
4. Click and enable it (follow prompts)

### Step 2: Generate App Password
1. After enabling 2-Step Verification, go back to Security
2. Find **"App passwords"** (or go directly: **https://myaccount.google.com/apppasswords**)
3. Select:
   - **App:** Mail
   - **Device:** Other (Custom name)
   - **Name:** Traidefi
4. Click **"Generate"**
5. **Copy the 16-character password** (looks like: `abcd efgh ijkl mnop`)
6. Remove spaces if needed: `abcdefghijklmnop`

### Step 3: Update config.env
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

**Replace:**
- `your_email@gmail.com` with your Gmail address
- `abcdefghijklmnop` with your generated app password

---

## Option 2: Resend Setup (Recommended)

### Step 1: Sign Up
1. Go to **https://resend.com**
2. Click **"Sign Up"** (free tier available)
3. Create account (use email, Google, or GitHub)

### Step 2: Verify Domain (Optional but Recommended)
1. In Resend dashboard, go to **"Domains"**
2. Click **"Add Domain"**
3. Enter: `traidefi.ai`
4. Add the DNS records Resend provides to GoDaddy
5. Wait for verification (can take up to 48 hours)

**OR Use Resend's Test Domain (For Now):**
- You can use `onboarding@resend.dev` for testing
- Later verify `traidefi.ai` domain

### Step 3: Get API Key
1. In Resend dashboard, go to **"API Keys"**
2. Click **"Create API Key"**
3. Name it: `Traidefi Production`
4. Select permissions: **"Sending access"**
5. Click **"Add"**
6. **Copy the API key** (starts with `re_...`)

### Step 4: Update config.env
**Note:** Resend integration needs to be implemented in `lib/email-service.js`.  
For now, use Gmail SMTP, or let me know if you want Resend integrated first.

---

## Option 3: SendGrid Setup

### Step 1: Sign Up
1. Go to **https://sendgrid.com**
2. Click **"Start for free"**
3. Create account

### Step 2: Verify Sender Email
1. In SendGrid dashboard, go to **"Settings" → "Sender Authentication"**
2. Click **"Verify a Single Sender"**
3. Enter your email address
4. Check email and verify

### Step 3: Create API Key
1. Go to **"Settings" → "API Keys"**
2. Click **"Create API Key"**
3. Name: `Traidefi`
4. Permissions: **"Full Access"** or **"Restricted Access" → "Mail Send"**
5. Click **"Create & View"**
6. **Copy the API key** (starts with `SG....`)

### Step 4: Update config.env
**Note:** SendGrid integration needs to be implemented.  
For now, use Gmail SMTP.

---

## Recommended: Start with Gmail SMTP

**Why Gmail SMTP?**
- ✅ Works immediately
- ✅ No additional signup needed
- ✅ Free
- ✅ Already implemented in the code

**Steps:**
1. Enable 2-Step Verification in Gmail
2. Generate App Password
3. Update config.env (see Option 1 above)
4. Test it!

You can always switch to Resend or SendGrid later.

---

## After Configuration

1. **Update config.env** with your chosen provider's credentials
2. **Restart your server** (if running)
3. **Test email:** Make a test purchase and check if email arrives

---

## Testing Email

After configuring, test it:
1. Make a test purchase (Credit Report or Insurance Quote)
2. Check your email inbox
3. You should receive a "Report Ready" email

If emails don't arrive:
- Check spam folder
- Verify credentials in config.env
- Check server logs for email errors

