# Resend Setup Guide - Using zalman@tangent-protocol.com

## Why Resend is Better:
✅ No App Password needed  
✅ Works with zalman@tangent-protocol.com  
✅ Professional email service  
✅ Better delivery rates  
✅ Free tier: 3,000 emails/month  
✅ Built for production apps  

---

## Step-by-Step Setup:

### Step 1: Sign Up for Resend
1. Go to **https://resend.com**
2. Click **"Sign Up"** (top right)
3. Create account:
   - Use email: `zalman@tangent-protocol.com` (or any email)
   - Sign up with email, Google, or GitHub

### Step 2: Verify Your Domain (Optional but Recommended)
**For production, verify `traidefi.ai` domain:**

1. In Resend dashboard, go to **"Domains"**
2. Click **"Add Domain"**
3. Enter: `traidefi.ai`
4. Resend will show DNS records to add
5. Add these DNS records to GoDaddy:
   - **TXT record** for domain verification
   - **MX records** for receiving (if needed)
   - **SPF/DKIM records** for better delivery
6. Wait for verification (can take up to 48 hours)

**OR Use Resend's Test Domain (For Now):**
- For immediate testing, you can use: `onboarding@resend.dev`
- But verify your domain later for production

### Step 3: Get API Key
1. In Resend dashboard, go to **"API Keys"**
2. Click **"Create API Key"**
3. Fill in:
   - **Name:** `Traidefi Production`
   - **Permission:** Select **"Sending access"** (or Full access)
4. Click **"Add"**
5. **Copy the API key** (starts with `re_...`)
   - **Important:** You'll only see it once! Copy it now.

### Step 4: Share API Key
- Share the API key with me
- I'll update `config.env` with it
- Email will be ready to use!

---

## What I've Already Set Up:

✅ Installed Resend package  
✅ Implemented Resend support in `lib/email-service.js`  
✅ Updated `config.env` to use Resend  
✅ Set FROM_EMAIL to `zalman@tangent-protocol.com`  

**Just need:** Your Resend API key!

---

## After Setup:

Once you share the API key:
1. I'll update `config.env`
2. Emails will send from: `zalman@tangent-protocol.com` ✅
3. Display name: "Traidefi"
4. Professional emails ready!

---

## Quick Start (Without Domain Verification):

**For immediate testing:**
1. Sign up at resend.com
2. Get API key
3. Share it with me
4. I'll update config

**Note:** Without domain verification, you might need to use Resend's test domain temporarily, or Resend might allow sending from zalman@tangent-protocol.com if it's already verified in their system.

---

## Benefits Over Gmail SMTP:

- ✅ No App Password hassles
- ✅ Better deliverability
- ✅ Professional service
- ✅ Better tracking
- ✅ Works with zalman@tangent-protocol.com
- ✅ Production-ready

**Ready to set up Resend?** Sign up and get your API key!

