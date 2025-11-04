# Gmail SMTP Setup for ollech@gmail.com

## Quick Steps:

### Step 1: Generate App Password for ollech@gmail.com
1. Make sure you're signed into **ollech@gmail.com** (not zalman@tangent-protocol.com)
2. Go to: **https://myaccount.google.com/apppasswords**
3. Sign in with: **ollech@gmail.com**
4. Generate App Password:
   - Select app: **"Mail"**
   - Select device: **"Other (Custom name)"**
   - Name: **"Traidefi"**
   - Click **"Generate"**
5. Copy the 16-character password (remove spaces)

### Step 2: Share the Password
- Email: **ollech@gmail.com**
- App Password: `xxxxxxxxxxxxxxxx` (16 characters)

I'll update config.env with your credentials!

---

## About "Sign in with Google" vs App Passwords:

**What Google is telling you:**
- Google prefers "Sign in with Google" (OAuth) for apps
- App Passwords are for "less secure apps" that don't support OAuth

**For email sending (SMTP):**
- SMTP requires App Password (can't use OAuth)
- This is normal and safe for email sending
- App Passwords are still secure (they're app-specific)

**Why Google shows that warning:**
- Google discourages App Passwords for browser apps (use OAuth instead)
- But for email sending via SMTP, App Passwords are the standard way
- It's safe to use App Passwords for email/SMTP

---

## After Setup:

Once you share the App Password:
- I'll update `config.env` with `ollech@gmail.com` and the App Password
- Your emails will be sent from `noreply@traidefi.ai` (display name)
- But they'll be sent via your Gmail SMTP

---

**Ready?** Generate the App Password for `ollech@gmail.com` and share it here!

