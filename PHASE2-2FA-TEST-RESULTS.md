# Phase 2 Feature 1: Two-Factor Authentication (2FA) - Testing Guide

**Date:** January 29, 2025  
**Status:** ✅ **READY FOR TESTING**

---

## 🧪 Testing Checklist

### Prerequisites
- ✅ Server running (`npm start`)
- ✅ Test user account (or create one)
- ✅ Authenticator app installed (Google Authenticator, Authy, Microsoft Authenticator, etc.)
- ✅ Browser with developer console open

---

## Test 1: Access 2FA Setup Page ✅

**Steps:**
1. Log in to your account at `/signin`
2. Navigate to `/settings/2fa?token=YOUR_TOKEN`
   - Or add a link in your dashboard to this page
3. **Expected Result:**
   - Page loads showing "❌ Disabled" status badge
   - "Enable Two-Factor Authentication" button visible
   - Information box explaining what 2FA is

**Test Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 2: Generate QR Code ✅

**Steps:**
1. On the 2FA setup page, click "Enable Two-Factor Authentication"
2. **Expected Result:**
   - QR code appears
   - Manual entry key displayed below QR code
   - Verification code input field appears
   - "Verify & Enable" button appears

**Test Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 3: Scan QR Code with Authenticator App ✅

**Steps:**
1. Open your authenticator app (Google Authenticator, Authy, etc.)
2. Scan the QR code displayed on the page
3. **Expected Result:**
   - Account added to authenticator app
   - 6-digit code appears in app
   - Code refreshes every 30 seconds

**Test Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 4: Verify and Enable 2FA ✅

**Steps:**
1. Enter the 6-digit code from your authenticator app
2. Click "Verify & Enable"
3. **Expected Result:**
   - Success message: "2FA enabled successfully!"
   - Backup codes displayed (10 codes)
   - Warning message to save backup codes
   - Page shows "✅ Enabled" status badge

**Test Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 5: Save Backup Codes ✅

**Steps:**
1. Copy all 10 backup codes to a safe location
2. Click "I've Saved These Codes"
3. **Expected Result:**
   - Page reloads
   - Shows 2FA enabled status
   - "Disable 2FA" and "Regenerate Backup Codes" buttons visible

**Test Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 6: Login with 2FA Enabled ✅

**Steps:**
1. Log out of your account
2. Go to `/signin`
3. Enter email and password
4. Click "Sign In"
5. **Expected Result:**
   - Email and password fields become disabled
   - 2FA code input field appears
   - Message: "Please enter your two-factor authentication code"
   - Button text changes to "Verify & Sign In"

**Test Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 7: Enter Valid 2FA Code ✅

**Steps:**
1. Enter the current 6-digit code from your authenticator app
2. Click "Verify & Sign In"
3. **Expected Result:**
   - Login successful
   - Redirected to dashboard
   - Token stored in localStorage

**Test Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 8: Enter Invalid 2FA Code ✅

**Steps:**
1. Log out
2. Attempt login with 2FA enabled
3. Enter an incorrect 6-digit code (e.g., "000000")
4. Click "Verify & Sign In"
5. **Expected Result:**
   - Error message: "Invalid two-factor authentication code"
   - Can retry with correct code

**Test Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 9: Use Backup Code ✅

**Steps:**
1. Log out
2. Attempt login with 2FA enabled
3. Enter one of your backup codes (8 digits) instead of TOTP code
4. Click "Verify & Sign In"
5. **Expected Result:**
   - Login successful
   - Backup code is consumed (cannot be used again)
   - Redirected to dashboard

**Test Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 10: Regenerate Backup Codes ✅

**Steps:**
1. While logged in, go to `/settings/2fa?token=YOUR_TOKEN`
2. Click "Regenerate Backup Codes"
3. Confirm the action
4. **Expected Result:**
   - New backup codes displayed
   - Old backup codes are invalidated
   - Success message shown

**Test Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 11: Disable 2FA ✅

**Steps:**
1. On 2FA settings page, click "Disable 2FA"
2. Enter your password when prompted
3. **Expected Result:**
   - Success message: "2FA disabled successfully"
   - Page reloads showing "❌ Disabled" status
   - Can login without 2FA code

**Test Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 12: Disable 2FA with Wrong Password ✅

**Steps:**
1. Click "Disable 2FA"
2. Enter incorrect password
3. **Expected Result:**
   - Error message: "Invalid password"
   - 2FA remains enabled

**Test Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 13: Check 2FA Status API ✅

**Steps:**
1. Open browser console
2. Run:
```javascript
fetch('/api/auth/2fa/status', {
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
})
.then(r => r.json())
.then(console.log)
```
3. **Expected Result:**
   - Returns JSON: `{ enabled: true/false, enabledAt: "...", hasBackupCodes: true/false }`

**Test Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 14: Audit Trail Logging ✅

**Steps:**
1. Check server terminal/console
2. Perform various 2FA actions (enable, disable, login)
3. **Expected Result:**
   - Audit log entries appear in console:
     - `2fa_setup_initiated`
     - `2fa_enabled`
     - `2fa_verification_success`
     - `2fa_verification_failed`
     - `2fa_backup_code_used`
     - `2fa_disabled`

**Test Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Test 15: Manual Entry Key ✅

**Steps:**
1. On 2FA setup page, instead of scanning QR code
2. Copy the manual entry key
3. Add account manually in authenticator app using the key
4. Verify with code from app
5. **Expected Result:**
   - Manual entry works
   - Code verification succeeds

**Test Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## 🐛 Known Issues / Bugs Found

**Issue 1:**
- Description:
- Steps to reproduce:
- Expected behavior:
- Actual behavior:

**Issue 2:**
- Description:
- Steps to reproduce:
- Expected behavior:
- Actual behavior:

---

## ✅ Overall Test Results

- **Total Tests:** 15
- **Passed:** ___
- **Failed:** ___
- **Status:** ⬜ Ready for Production / ⬜ Needs Fixes

---

## 📝 Notes

_Add any additional observations or feedback here:_

---

**Tested By:** _________________  
**Date:** _________________  
**Server Version:** `server-WORKING-FIXED.js`  
**Commit:** _________________

