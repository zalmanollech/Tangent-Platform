# PayPal Setup Guide for Traidefi

## 🎯 Goal
Set up PayPal Business account and get API credentials for payment processing.

---

## Step 1: Create PayPal Business Account

1. **Go to PayPal Business:**
   - Visit: https://www.paypal.com/business
   - Click "Sign Up"

2. **Choose Account Type:**
   - Select "Business Account"
   - Click "Next"

3. **Complete Registration:**
   - Enter your business email address
   - Create a password
   - Fill in business details:
     - Business name: Your company name (or "Traidefi" if personal)
     - Business type: Choose appropriate (e.g., "Individual" if personal)
     - Business address
     - Phone number
   - Click "Continue"

4. **Verify Email:**
   - Check your email
   - Click the verification link from PayPal

5. **Complete Business Profile:**
   - Fill in any additional required information
   - Add business details (if applicable)

---

## Step 2: Access Developer Dashboard

1. **Log in to PayPal:**
   - Go to https://www.paypal.com
   - Log in with your business account

2. **Navigate to Developer Portal:**
   - Click on your profile/name (top right)
   - Go to "Developer" or visit: https://developer.paypal.com
   - Or click: Account Settings → Developer

3. **Access My Apps & Credentials:**
   - In Developer Dashboard, click "My Apps & Credentials" (left sidebar)
   - Or go directly to: https://developer.paypal.com/dashboard/applications/sandbox

---

## Step 3: Create REST App (Sandbox)

1. **Click "Create App":**
   - In "My Apps & Credentials" section
   - Click the "Create App" button (top right)

2. **Fill in App Details:**
   - **App Name:** `Traidefi Tools` (or your preferred name)
   - **Merchant:** Select your business account (should auto-select)
   - **Environment:** Make sure "Sandbox" is selected (we'll do Live later)

3. **Click "Create App"**

---

## Step 4: Get Sandbox Credentials

1. **Find Your New App:**
   - You'll see "Traidefi Tools" in your apps list
   - Click on it to view details

2. **Copy Credentials:**
   - You'll see two important values:
     
     **Client ID:**
     - Looks like: `Ae...` or `AZ...`
     - Click the "Copy" icon next to it
     - Save it somewhere safe
     
     **Secret:**
     - Click "Show" to reveal it
     - Looks like: `EP...` or similar
     - Click "Copy" to copy it
     - **⚠️ IMPORTANT:** Save this immediately - you can only see it once!
     - Save it somewhere safe

3. **What You Need to Share:**
   - Client ID: `Ae...` (or `AZ...`)
   - Secret: `EP...` (or similar)
   - Currency preference: USD or NIS (for Israeli accounts, probably NIS)

---

## Step 5: Test Sandbox Account (Optional but Recommended)

1. **Create Sandbox Test Account:**
   - In Developer Dashboard, go to "Accounts" (left sidebar)
   - Click "Create Account"
   - Choose "Business" or "Personal"
   - Create test account with:
     - Email (any email, e.g., `buyer@test-traidefi.com`)
     - Password
   - This lets you test payments without real money

2. **Test Payment Flow:**
   - You can test with these sandbox accounts later
   - No real money will be used

---

## Step 6: Add Credentials to Your Project

Once you have the credentials, you can:

**Option A: Share with me**
- Just tell me:
  - Client ID: `Ae...`
  - Secret: `EP...`
  - Currency: USD or NIS
- I'll add them to your code and config

**Option B: Add to config.env yourself**
- Open `config.env` file
- Find these lines (around line 35-38):
  ```
  # PayPal Configuration (Optional)
  # PAYPAL_CLIENT_ID=your_paypal_client_id
  # PAYPAL_CLIENT_SECRET=your_paypal_secret
  # PAYPAL_ENVIRONMENT=sandbox
  ```
- Uncomment and fill in:
  ```
  PAYPAL_CLIENT_ID=Ae...your_client_id_here
  PAYPAL_CLIENT_SECRET=EP...your_secret_here
  PAYPAL_ENVIRONMENT=sandbox
  PAYPAL_CURRENCY=USD
  ```
- Save the file

---

## Step 7: Live Credentials (Later - For Production)

When you're ready for production:

1. **Go back to Developer Dashboard**
2. **Switch to "Live" tab** (top of the page)
3. **Create App for Live Environment**
   - Same process as sandbox
   - Name: `Traidefi Tools - Live`
   - Environment: "Live"
4. **Get Live Credentials**
   - Copy Client ID and Secret
   - Add to config.env:
     ```
     PAYPAL_CLIENT_ID=live_client_id
     PAYPAL_CLIENT_SECRET=live_secret
     PAYPAL_ENVIRONMENT=live
     ```

---

## ✅ Checklist

- [ ] PayPal Business account created
- [ ] Email verified
- [ ] Developer Dashboard accessed
- [ ] Sandbox REST App created
- [ ] Client ID copied
- [ ] Secret copied and saved
- [ ] Currency preference decided (USD or NIS)
- [ ] Credentials shared with AI or added to config.env

---

## 💡 Need Help?

If you get stuck:

1. **Can't find Developer Dashboard:**
   - Try: https://developer.paypal.com
   - Or: Log in → Account Settings → Developer

2. **Can't create app:**
   - Make sure you're logged in with Business account
   - Check that your account is fully verified

3. **Secret disappeared:**
   - You can reset it in the app settings
   - Click "Show" → "Reset Secret"

4. **Currency questions:**
   - USD: Works globally, most common
   - NIS: Israeli Shekel, use if targeting Israeli market
   - You can support both later

---

## 🚀 Once You Have Credentials:

Tell me:
- **"I have PayPal credentials: Client ID = Ae..., Secret = EP..., Currency = USD/NIS"**

Then I'll:
1. Add PayPal integration to the code
2. Set up checkout flow
3. Configure webhooks
4. Test payment flow

**Ready to start? Begin with Step 1 above!**

