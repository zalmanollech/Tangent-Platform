# How to Get Gmail Credentials

## What You Need:

1. **Gmail Email Address** - Your Gmail account (e.g., `youremail@gmail.com`)
2. **Gmail App Password** - A special password for apps (not your regular Gmail password!)

---

## Step-by-Step: Get Gmail App Password

### Step 1: Enable 2-Step Verification
**Required:** You must have 2-Step Verification enabled before you can generate App Passwords.

1. Go to **https://myaccount.google.com**
2. Click **"Security"** (left menu)
3. Find **"2-Step Verification"** section
4. Click **"Get started"** or **"Turn on"**
5. Follow the prompts to enable it
   - It will ask for your phone number
   - Google will send you a verification code
   - Enter the code to verify

**Note:** If 2-Step Verification is already enabled, skip to Step 2.

---

### Step 2: Generate App Password
**After 2-Step Verification is enabled:**

1. Go directly to: **https://myaccount.google.com/apppasswords**
   - Or: Google Account → Security → 2-Step Verification → App passwords (scroll down)

2. You'll see a page titled **"App passwords"**

3. If prompted, sign in again

4. You'll see a form:
   - **Select app:** Choose **"Mail"**
   - **Select device:** Choose **"Other (Custom name)"**
   - **Name:** Enter **"Traidefi"** (or any name you like)

5. Click **"Generate"** button

6. **Google will show you a 16-character password:**
   - It looks like: `abcd efgh ijkl mnop` (with spaces)
   - **Remove the spaces:** `abcdefghijklmnop`
   - **Copy this password** - You'll only see it once!

---

### Step 3: Use These Credentials

You now have:
1. **Gmail Address:** `your_email@gmail.com` (your Gmail account)
2. **App Password:** `abcdefghijklmnop` (the 16-character password you generated)

---

## Quick Reference:

**Gmail SMTP Settings:**
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP User: your_email@gmail.com
SMTP Password: abcdefghijklmnop (the app password)
```

---

## Important Notes:

**⚠️ DO NOT use your regular Gmail password!**
- You MUST generate an App Password
- Regular Gmail password won't work for SMTP
- App passwords are safer and can be revoked anytime

**🔐 Security:**
- App passwords are application-specific
- You can revoke them anytime from the same page
- If you lose the app password, generate a new one

**📧 Email Address:**
- Use your Gmail address (the one you're logged into)
- Can be `youremail@gmail.com` or any Gmail account you control

---

## Troubleshooting:

**Can't find App Passwords page?**
- Make sure 2-Step Verification is enabled first
- Go directly to: https://myaccount.google.com/apppasswords
- Try a different browser or incognito mode

**"App passwords" option is grayed out?**
- 2-Step Verification must be enabled first
- Go to Security → 2-Step Verification → Enable it

**App password not working?**
- Make sure you removed spaces from the password
- Make sure you copied the full 16 characters
- Generate a new one if needed

**Don't want to use 2-Step Verification?**
- Unfortunately, Google requires 2-Step Verification for App Passwords
- It's a security feature
- Or consider using Resend instead (no 2-Step needed)

---

## What You Need to Share:

Once you have both:
1. ✅ Your Gmail email address (e.g., `youremail@gmail.com`)
2. ✅ Your 16-character App Password (e.g., `abcdefghijklmnop`)

I'll add them to your `config.env` file!

