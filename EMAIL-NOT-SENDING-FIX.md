# Email Not Sending - Troubleshooting Guide

**Issue:** PayPal payment works, but no email sent and nothing in Resend dashboard  
**Status:** Troubleshooting

---

## 🔍 Step 1: Check Railway Logs (Most Important!)

**This will show exactly what's happening:**

1. **Go to Railway dashboard:**
   - Your project → **"Logs"** tab

2. **Look for these messages:**
   - `[INFO] Report ready email sent to: user@example.com` ✅
   - `[ERROR] Failed to send report ready email: [error]` ❌
   - `[WARN] Resend client not available. Skipping email send.` ⚠️
   - `[WARN] Resend API key not configured. Email service disabled.` ⚠️
   - `[ERROR] Resend email error: [error]` ❌

**What to look for:**
- Any email-related errors
- Warnings about Resend not being configured
- Stack traces showing where email failed

**Share the error messages you see!**

---

## 🔍 Step 2: Verify Railway Environment Variables

**Check Railway has all email variables:**

1. **Go to Railway → Variables tab**
2. **Verify these are set:**
   - `EMAIL_PROVIDER` = `resend` ✅
   - `FROM_EMAIL` = `onboarding@resend.dev` ✅
   - `FROM_NAME` = `Traidefi` ✅
   - `RESEND_API_KEY` = (your new key) ⚠️ **Check this!**

3. **If any are missing:**
   - Add them immediately
   - Railway will auto-redeploy

---

## 🔍 Step 3: Verify Resend API Key

**Check if Resend API key is valid:**

1. **Go to Resend dashboard:**
   - https://resend.com
   - Log in
   - Go to **"API Keys"** section

2. **Check:**
   - Is the key active? (not revoked)
   - Does it match the one in Railway?
   - Does it have "Sending Only" permissions?

3. **If key is different:**
   - Update Railway `RESEND_API_KEY` with correct key

---

## 🔍 Step 4: Check Email Service Initialization

**Check if email service is initializing:**

1. **Check Railway logs for:**
   - `[INFO] Email service (Resend) initialized successfully` ✅
   - `[WARN] Resend API key not configured. Email service disabled.` ❌
   - `[ERROR] Email service initialization failed: [error]` ❌

2. **If you see initialization errors:**
   - Check `RESEND_API_KEY` is set in Railway
   - Verify key is correct
   - Check key hasn't been revoked

---

## 🔍 Step 5: Check If Email Function is Called

**Verify email function is being invoked:**

1. **Check Railway logs for:**
   - `[INFO] Credit report generated and saved for purchase: [id]` ✅
   - `[INFO] Report ready email sent to: [email]` ✅ (should be here!)
   - `[ERROR] Failed to send report ready email: [error]` ❌

2. **If you see "Credit report generated" but NO "email sent" message:**
   - Email function might not be called
   - Or email is failing silently

---

## 🚨 Common Issues & Fixes

### Issue 1: "Resend API key not configured"
**Symptom:** Logs show `[WARN] Resend API key not configured. Email service disabled.`

**Fix:**
- Check Railway `RESEND_API_KEY` is set
- Verify key is correct (matches Resend dashboard)
- Restart Railway deployment after adding key

---

### Issue 2: "Resend client not available"
**Symptom:** Logs show `[WARN] Resend client not available. Skipping email send.`

**Fix:**
- Check email service initialization
- Verify `RESEND_API_KEY` is valid
- Check if key has proper permissions

---

### Issue 3: "Resend email error"
**Symptom:** Logs show `[ERROR] Resend email error: [error details]`

**Fix:**
- Check error message in logs
- Common errors:
  - Invalid API key
  - API key revoked
  - Rate limit exceeded
  - Invalid email address

---

### Issue 4: Email Function Not Called
**Symptom:** No email logs at all (no success, no error)

**Possible causes:**
- Email function not being invoked
- Exception caught silently
- Email sending code path not reached

**Fix:**
- Check Railway logs for report generation
- Verify `payerEmail` is available
- Check if email function is being called

---

## 🧪 Quick Test

**Test email service directly:**

1. **Make another test purchase**
2. **Immediately check Railway logs:**
   - Look for email-related messages
   - Check for errors
   - Share what you see

3. **Check Resend dashboard:**
   - Go to https://resend.com → Emails/Logs
   - Look for any emails (even failed ones)
   - Check for error messages

---

## 📋 Diagnostic Checklist

- [ ] Check Railway logs for email errors
- [ ] Verify `EMAIL_PROVIDER=resend` in Railway
- [ ] Verify `RESEND_API_KEY` is set in Railway
- [ ] Verify `FROM_EMAIL=onboarding@resend.dev` in Railway
- [ ] Verify `FROM_NAME=Traidefi` in Railway
- [ ] Check Resend dashboard for API key status
- [ ] Verify API key matches Railway
- [ ] Check if API key is active (not revoked)
- [ ] Check Railway logs for email initialization messages
- [ ] Check Railway logs for email sending attempts

---

## 🎯 Most Likely Issue

**Based on symptoms:**
- Payment works ✅
- No email sent ❌
- Nothing in Resend dashboard ❌

**Most likely:**
1. `RESEND_API_KEY` not set in Railway ⚠️
2. `EMAIL_PROVIDER` not set to `resend` ⚠️
3. Email service not initializing ⚠️
4. Email function not being called ⚠️

**Check Railway logs first** - they will show exactly what's wrong!

---

**Last Updated:** November 4, 2025

