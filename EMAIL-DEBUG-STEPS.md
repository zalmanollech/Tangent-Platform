# Email Debug Steps - Quick Checklist

**Issue:** No email sent, nothing in Resend dashboard  
**Action:** Check Railway logs first!

---

## 🔍 Step 1: Check Railway Logs (Do This First!)

**This will show exactly what's wrong:**

1. **Go to Railway dashboard:**
   - Your project → **"Logs"** tab
   - Look for recent logs (after your test purchase)

2. **Search for these messages:**
   - `email` (search for "email" in logs)
   - `resend` (search for "resend" in logs)
   - `Report ready email` (search for this)

3. **What you should see:**
   - ✅ `[INFO] Report ready email sent to: [email]` (if working)
   - ❌ `[ERROR] Failed to send report ready email: [error]` (if error)
   - ⚠️ `[WARN] Resend API key not configured` (if missing)

**Share what you see in Railway logs!**

---

## 🔍 Step 2: Verify Railway Variables

**Check Railway has email variables:**

Go to Railway → Variables tab, verify:

- [ ] `EMAIL_PROVIDER` = `resend`
- [ ] `RESEND_API_KEY` = (your new key - starts with `re_`)
- [ ] `FROM_EMAIL` = `onboarding@resend.dev`
- [ ] `FROM_NAME` = `Traidefi`

**If any are missing, add them now!**

---

## 🔍 Step 3: Check Resend API Key

**Verify key is valid:**

1. **Go to Resend dashboard:**
   - https://resend.com → API Keys
   - Find your key
   - Is it active? (not revoked)

2. **Compare with Railway:**
   - Does Railway `RESEND_API_KEY` match Resend dashboard?
   - If different, update Railway

---

## 🚨 Most Likely Issues

**Based on symptoms:**

1. **`RESEND_API_KEY` not set in Railway** ⚠️
   - **Fix:** Add `RESEND_API_KEY` to Railway

2. **`EMAIL_PROVIDER` not set to `resend`** ⚠️
   - **Fix:** Add `EMAIL_PROVIDER=resend` to Railway

3. **Email service not initializing** ⚠️
   - **Fix:** Check Railway logs for initialization errors

---

## 📋 Quick Action Items

**Do now:**
1. ✅ Check Railway logs for email errors
2. ✅ Verify `EMAIL_PROVIDER=resend` in Railway
3. ✅ Verify `RESEND_API_KEY` is set in Railway
4. ✅ Verify key matches Resend dashboard

**Then:**
5. ✅ Make another test purchase
6. ✅ Check Railway logs again
7. ✅ Check Resend dashboard again

---

**Most Important:** Check Railway logs first - they will show exactly what's wrong!

---

**Last Updated:** November 4, 2025

