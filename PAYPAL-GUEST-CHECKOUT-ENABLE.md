# Enable PayPal Guest Checkout (Credit Card Option)

**Issue:** PayPal guest checkout (credit card option) not showing  
**Solution:** Enable "PayPal Account Optional" in PayPal Business account settings

---

## 🚨 Important: PayPal Business Account Setting Required

**The API parameter alone is not enough!** You must enable guest checkout in your PayPal Business account settings.

---

## ✅ Step-by-Step: Enable Guest Checkout in PayPal

### Step 1: Log in to PayPal Business Account

1. **Go to PayPal Business:** https://www.paypal.com/business
2. **Log in** with your business account

### Step 2: Navigate to Website Preferences

1. **Go to Account Settings:**
   - Click on your profile icon (top right)
   - Click "Account Settings"

2. **Find Website Payments:**
   - Click "Website Payments" (left sidebar)
   - Click "Update" next to "Website Preferences"

### Step 3: Enable PayPal Account Optional

1. **Find "PayPal Account Optional" setting**
2. **Select "On"** (or "Yes")
3. **Save your changes**

**This setting allows buyers to check out using a debit or credit card without logging into PayPal.**

---

## ✅ What This Does

**After enabling:**
- ✅ Customers can pay with credit/debit card without PayPal account
- ✅ "Pay with Credit or Debit Card" option appears at bottom of PayPal page
- ✅ "Log in to PayPal" option still available at top

---

## 🔍 Why It Might Still Not Show

**Even with settings enabled, guest checkout might not appear if:**

1. **Customer's email is associated with existing PayPal account:**
   - PayPal may prompt to log in instead
   - Use a different email to test

2. **Browser cookies/cache:**
   - Clear browser cache
   - Use incognito/private window to test

3. **Geographical restrictions:**
   - Some countries/regions don't support guest checkout
   - Check PayPal's regional support

4. **Account not fully verified:**
   - Business account must be fully verified
   - Complete all required verification steps

---

## 📋 Checklist

- [ ] Logged into PayPal Business account
- [ ] Navigated to Account Settings → Website Payments
- [ ] Found "Website Preferences"
- [ ] Enabled "PayPal Account Optional"
- [ ] Saved changes
- [ ] Tested with incognito window
- [ ] Used email not associated with PayPal account

---

## 🧪 Testing

**After enabling in PayPal:**

1. **Clear browser cache** (or use incognito)
2. **Go to Credit Report tool**
3. **Fill out form and click "Continue to Payment"**
4. **You should see:**
   - "Pay with Credit or Debit Card" link at bottom ✅
   - "Log in to PayPal" option at top ✅

**If you still don't see it:**
- Wait 5-10 minutes for settings to propagate
- Try different browser/incognito mode
- Check if account is fully verified

---

**Last Updated:** November 4, 2025

