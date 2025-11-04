# Email Root Cause - RESEND_API_KEY Issue

**Status:** EMAIL_PROVIDER is set, but emails still not sending  
**Root Cause:** Likely `RESEND_API_KEY` not set or invalid

---

## 🔍 The Real Issue

**From your Railway logs:**
- `[WARN] SMTP credentials not configured. Email service disabled.`
- `[WARN] Email transporter not available. Skipping email send.`

**This means:**
- Email service is trying to use **nodemailer (SMTP)** instead of **Resend**
- OR Resend initialization is failing

**Why this happens:**
1. `EMAIL_PROVIDER` might not be read correctly
2. OR `RESEND_API_KEY` is missing/invalid
3. OR Resend client fails to initialize

---

## ✅ Critical Variable: RESEND_API_KEY

**`RESEND_API_KEY` is the most important one!**

**Without it:**
- Resend client can't initialize
- Email service falls back to nodemailer
- Nodemailer fails (no SMTP credentials)
- Email is skipped

**Check Railway:**
- `RESEND_API_KEY` = (your key - starts with `re_`)
- Should match the key in Resend dashboard

---

## 🔍 How to Verify

### Step 1: Check Railway Variables

**Go to Railway → Variables tab, verify:**

- [ ] `EMAIL_PROVIDER` = `resend` ✅ (you said this is set)
- [ ] `RESEND_API_KEY` = (your key - starts with `re_`) ⚠️ **CHECK THIS!**
- [ ] `FROM_EMAIL` = `onboarding@resend.dev` (optional, has default)
- [ ] `FROM_NAME` = `Traidefi` (optional, has default)

**Most Important:** `RESEND_API_KEY` must be set!

---

### Step 2: Check Railway Logs

**After Railway redeploys, check logs for:**

1. **Email service initialization:**
   - `[INFO] Email service (Resend) initialized successfully` ✅
   - `[ERROR] Resend API key not configured` ❌

2. **Email sending attempts:**
   - `[INFO] Attempting to send email via provider: resend` ✅
   - `[INFO] Email sent successfully via Resend: [id]` ✅
   - `[ERROR] Resend email error: [error]` ❌

---

### Step 3: Test After Adding RESEND_API_KEY

**If `RESEND_API_KEY` was missing:**

1. **Add it to Railway:**
   - Variable: `RESEND_API_KEY`
   - Value: (your new key from Resend)

2. **Wait for Railway redeploy** (1-2 minutes)

3. **Make another test purchase**

4. **Check Railway logs:**
   - Should see: `[INFO] Email service (Resend) initialized successfully`
   - Should see: `[INFO] Email sent successfully via Resend: [id]`

5. **Check Resend dashboard:**
   - Should show email sent
   - Should show delivery status

---

## 🚨 Most Likely Issue

**`RESEND_API_KEY` is not set in Railway!**

**Why:**
- `FROM_EMAIL` and `FROM_NAME` are optional (have defaults)
- `RESEND_API_KEY` is **required** for Resend to work
- Without it, Resend client can't initialize
- Service falls back to nodemailer
- Nodemailer fails (no SMTP credentials)
- Email is skipped

---

## ✅ Quick Fix

**Add to Railway:**

1. **Variable:** `RESEND_API_KEY`
2. **Value:** (your new Resend API key - starts with `re_`)
3. **Save** and wait for redeploy

**Then test again!**

---

## 📋 Checklist

- [x] `EMAIL_PROVIDER` = `resend` ✅ (you confirmed)
- [ ] `RESEND_API_KEY` = (your key) ⚠️ **CHECK THIS!**
- [ ] `FROM_EMAIL` = `onboarding@resend.dev` (optional)
- [ ] `FROM_NAME` = `Traidefi` (optional)

**Most Important:** Verify `RESEND_API_KEY` is set in Railway!

---

**Last Updated:** November 4, 2025

