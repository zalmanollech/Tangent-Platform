# Phase 1 Local Testing Guide

**Date:** January 29, 2025  
**Status:** Testing in Progress

---

## ✅ Test 1: Legal Acceptance Checkbox - COMPLETED
- ✅ Checkbox visible and functional
- ✅ Links to legal documents work
- ✅ Form validation prevents submission without checkbox
- ✅ Registration redirects correctly to KYC page

---

## 🧪 Test 2: Enhanced Password Policies

### UI Testing (Signup Page)
1. **Go to:** `http://localhost:4000/signup`
2. **Test Password Strength Meter:**
   - Enter weak password: `123` → Should show red/weak indicator
   - Enter medium password: `Password1` → Should show yellow/medium indicator
   - Enter strong password: `Password123!` → Should show green/strong indicator
3. **Test Password Requirements:**
   - Try submitting with password missing requirements
   - Verify each requirement turns green when met
4. **Test Backend Validation:**
   - Try submitting form with weak password (< 3/5 score)
   - Should show error message and prevent submission

### Expected Results:
- ✅ Password strength meter updates in real-time
- ✅ Requirements list shows which criteria are met
- ✅ Form submission blocked for weak passwords
- ✅ Backend rejects passwords that don't meet criteria

---

## 🔍 Test 3: Audit Trail System

### Prerequisites:
- Need admin account or admin token
- Test user should have registered/logged in

### API Testing Steps:

1. **Get Admin Token:**
   - Login as admin user
   - Get token from browser localStorage or login response

2. **Test Audit Logs Endpoint:**
   ```bash
   # Get all audit logs (last 100)
   curl -X GET "http://localhost:4000/api/admin/audit-logs" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   
   # Get filtered audit logs (user_registered events only)
   curl -X GET "http://localhost:4000/api/admin/audit-logs?action=user_registered" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   
   # Get more logs
   curl -X GET "http://localhost:4000/api/admin/audit-logs?limit=500" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

3. **Verify Audit Events:**
   - Register a new user → Should create `user_registered` event
   - Login → Should create `user_login` event
   - Check audit logs → Should see these events

### Expected Results:
- ✅ API returns JSON with audit logs
- ✅ Logs include: action, userId, timestamp, details
- ✅ Can filter by action type
- ✅ Logs are sorted by timestamp (newest first)
- ✅ Registration and login events are logged

---

## 🔐 Test 4: Session Management

### API Testing Steps:

1. **View All Active Sessions:**
   ```bash
   curl -X GET "http://localhost:4000/api/admin/sessions" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

2. **Verify Session Data:**
   - Login as a user
   - Check sessions endpoint
   - Should see session with:
     - User ID
     - IP address
     - User agent
     - Creation time
     - Last activity
     - Expiration time

3. **Test Session Termination:**
   ```bash
   # Get session ID from previous response
   curl -X POST "http://localhost:4000/api/admin/sessions/SESSION_ID/terminate" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

4. **Verify Session Cleanup:**
   - Check sessions endpoint again
   - Terminated session should be removed
   - Audit log should show `session_terminated` event

### Expected Results:
- ✅ Sessions endpoint returns active sessions
- ✅ Session includes all tracking data (IP, user agent, etc.)
- ✅ Can terminate sessions remotely
- ✅ Terminated sessions are removed
- ✅ Session termination logged in audit trail

---

## 💾 Test 5: Automated Backup System

### File System Testing:

1. **Check Backup Directory:**
   ```bash
   # Windows PowerShell
   dir backups\
   
   # Should see backup files like:
   # backup-2025-01-29T10-30-00-000Z.json
   ```

2. **Verify Backup Files:**
   - Check if backup files exist in `backups/` directory
   - Backup files should be JSON format
   - Should contain all database collections

3. **Check Backup Content:**
   - Open a backup file
   - Verify it contains:
     - Users
     - Contracts
     - KYC data
     - Wallets
     - Sessions
     - Audit logs (last 1000)
     - Admin settings

### API Testing (Manual Backup):

1. **Trigger Manual Backup:**
   ```bash
   curl -X POST "http://localhost:4000/api/admin/backup" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

2. **Verify Backup Created:**
   - Check `backups/` directory
   - New backup file should be created
   - Response should include backup file name and timestamp

3. **Check Backup Cleanup:**
   - Create more than 10 backups (manually or wait)
   - Old backups should be automatically deleted
   - Only last 10 backups should remain

### Expected Results:
- ✅ Backup files created in `backups/` directory
- ✅ Backups contain all database collections
- ✅ Manual backup trigger works via API
- ✅ Backup creation logged in audit trail
- ✅ Old backups cleaned up (keeps last 10)
- ✅ Backups scheduled every 6 hours (check server logs)

---

## 📋 Quick Test Checklist

### UI Tests (No Admin Required):
- [ ] Password strength meter works
- [ ] Password requirements display correctly
- [ ] Weak passwords are rejected
- [ ] Legal checkbox validation works

### API Tests (Admin Required):
- [ ] `/api/admin/audit-logs` - Returns audit logs
- [ ] `/api/admin/audit-logs?action=user_registered` - Filters work
- [ ] `/api/admin/sessions` - Returns active sessions
- [ ] `/api/admin/sessions/:id/terminate` - Terminates session
- [ ] `/api/admin/backup` - Creates backup manually

### Integration Tests:
- [ ] Registration creates audit log
- [ ] Login creates session
- [ ] Session activity updates on requests
- [ ] Backup created on server startup
- [ ] Backup scheduled every 6 hours

---

## 🛠️ Testing Tools

### Browser Console:
- Open browser DevTools (F12)
- Check Console tab for JavaScript logs
- Check Network tab for API requests

### PowerShell/Command Line:
```powershell
# Test API endpoints
Invoke-WebRequest -Uri "http://localhost:4000/api/admin/audit-logs" -Headers @{"Authorization"="Bearer YOUR_TOKEN"} | ConvertFrom-Json

# Check backup files
Get-ChildItem backups\ | Sort-Object LastWriteTime -Descending | Select-Object -First 5
```

### Postman/Insomnia:
- Import API endpoints
- Set Authorization header with Bearer token
- Test all admin endpoints

---

## 📝 Notes

- Server running on: `http://localhost:4000`
- Admin endpoints require: `Authorization: Bearer <token>` header
- Backup files location: `backups/` directory
- Audit logs kept in memory (last 10,000)
- Sessions expire after 24 hours

---

## 🎯 Next Steps After Testing

1. Document any issues found
2. Fix any bugs discovered
3. Update test results document
4. Commit fixes if needed
5. Prepare for Phase 2 features

