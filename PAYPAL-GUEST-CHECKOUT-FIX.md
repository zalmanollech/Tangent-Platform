# PayPal Guest Checkout Fix - Enable Credit Card Option

**Issue:** PayPal no longer shows "Pay with Credit Card" option  
**Fix:** Added `payment_method.payee_preferred: 'UNRESTRICTED'` to enable guest checkout

---

## ✅ What Was Fixed

**Added to PayPal order creation:**
```javascript
payment_method: {
    payee_preferred: 'UNRESTRICTED'  // Enable guest checkout (credit card without PayPal account)
}
```

**This enables:**
- ✅ "Pay with Credit Card" option (without PayPal account)
- ✅ PayPal account login option (still available)
- ✅ Guest checkout for customers without PayPal accounts

---

## 📋 How It Works

**Before:**
- PayPal only showed "Log in to PayPal" option
- Required users to have a PayPal account

**After:**
- PayPal shows both options:
  - "Pay with Credit Card" (guest checkout) ✅
  - "Log in to PayPal" (for PayPal account holders) ✅

---

## 🚀 Next Steps

1. **Wait for Railway redeploy** (automatic after code push)
2. **Test PayPal payment** again
3. **You should now see:**
   - "Pay with Credit Card" option at the bottom of PayPal page
   - "Log in to PayPal" option at the top

---

## 🔍 Testing

**After Railway redeploys:**

1. **Go to Credit Report tool**
2. **Fill out form and click "Continue to Payment"**
3. **You should see PayPal page with:**
   - "Pay with Credit Card" link at the bottom
   - "Log in" button at the top

**If you still don't see it:**
- Make sure you're using PayPal Sandbox (not Live)
- Guest checkout might not be available in all countries/regions
- Some PayPal accounts may have restrictions

---

## 📝 Notes

**Guest checkout availability:**
- ✅ Works in most countries
- ✅ Requires PayPal Business account (not Personal)
- ✅ May require additional PayPal account setup/verification
- ⚠️ Some countries may not support guest checkout

**If guest checkout still doesn't appear:**
- Check PayPal Business account settings
- Verify account is fully verified
- Contact PayPal support if needed

---

**Last Updated:** November 4, 2025

