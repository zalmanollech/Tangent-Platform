# Fix Both Issues: Branding + PayPal Guest Checkout

**Issues:**
1. Landing page shows "Tangent Protocol" instead of "Traidefi" on `traidefi.ai`
2. PayPal guest checkout (credit card option) not showing

---

## ✅ Issue 1: Branding Fix

**What I fixed:**
- Enhanced brand detection to be more explicit
- Added support for `x-forwarded-host` header (for proxies)
- Improved domain matching logic
- Added better debug logging

**Changes made:**
- More explicit checks for `traidefi.ai` domain
- Support for `www.traidefi.ai`
- Better handling of forwarded headers

**Status:** ✅ Fixed in code (will work after deployment)

---

## ⚠️ Issue 2: PayPal Guest Checkout

**Problem:** Guest checkout (credit card option) not showing

**Root Cause:** 
- API parameter alone is not enough
- Must enable "PayPal Account Optional" in PayPal Business account settings

**What I fixed:**
- Moved `payment_method` to correct location in API (purchase_units level)
- Created guide for enabling in PayPal dashboard

**What you need to do:**
1. **Log in to PayPal Business account**
2. **Go to Account Settings → Website Payments**
3. **Click "Update" next to "Website Preferences"**
4. **Enable "PayPal Account Optional"**
5. **Save changes**

**See:** `PAYPAL-GUEST-CHECKOUT-ENABLE.md` for detailed instructions

---

## 📋 Next Steps

1. **Wait for Railway redeploy** (automatic after code push)
2. **Enable guest checkout in PayPal** (see guide above)
3. **Test both:**
   - Landing page should show "Traidefi" on `traidefi.ai`
   - PayPal should show "Pay with Credit or Debit Card" option

---

## 🧪 Testing

**After Railway redeploys:**

1. **Test Branding:**
   - Visit: `https://traidefi.ai`
   - Should see: "Traidefi" (not "Tangent Protocol")

2. **Test PayPal Guest Checkout:**
   - Go to Credit Report tool
   - Fill form and click "Continue to Payment"
   - Should see: "Pay with Credit or Debit Card" at bottom

**If branding still wrong:**
- Clear browser cache
- Check Railway logs for `[BRAND]` messages
- Share what you see in logs

**If PayPal still missing:**
- Verify you enabled "PayPal Account Optional" in PayPal
- Try incognito window
- Use email not associated with PayPal account

---

**Last Updated:** November 4, 2025

