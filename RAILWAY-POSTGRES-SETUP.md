# Railway PostgreSQL Setup Guide

## Step 1: Update DATABASE_URL in Railway

1. Go to Railway Dashboard → Your Project → Tangent-Platform Service
2. Click on **Variables** tab
3. Find or create `DATABASE_URL` variable
4. Set the value to:
   ```
   postgresql://postgres:${PGPASSWORD}@postgres.railway.internal:5432/railway
   ```
   **Important:** Replace `${PGPASSWORD}` with the actual value from Railway Postgres service variables.

### How to get PGPASSWORD:
1. In Railway Dashboard, go to your **Postgres** service
2. Click on **Variables** tab
3. Find `PGPASSWORD` variable
4. Copy its value
5. Replace `${PGPASSWORD}` in the DATABASE_URL above

### Example:
If `PGPASSWORD` is `abc123xyz`, then `DATABASE_URL` should be:
```
postgresql://postgres:abc123xyz@postgres.railway.internal:5432/railway
```

## Step 2: Redeploy Service

1. After updating `DATABASE_URL`, Railway will auto-redeploy
2. Or manually trigger redeploy: Railway Dashboard → Tangent-Platform → Deployments → Redeploy

## Step 3: Verify Connection

After deployment, check the logs. You should see:

```
[DB] Initializing PostgreSQL connection...
[DB] DATABASE_URL: postgresql://postgres:****@postgres.railway.internal:5432/railway
[DB] Detected Railway internal connection - SSL disabled
[DB] Testing database connection...
[DB] ✅ Connected to PostgreSQL via Railway (internal)
[DB] Creating database tables (if they do not exist)...
[DB] ✅ Tables created or already exist
[DB] Tables: users, contracts, kyc, wallets, transactions, documents, auctions, audit_logs
[INFO] ✅ PostgreSQL database initialized - using database instead of in-memory Maps
[DB] Loading X users from database into cache...
[DB] Users loaded into cache successfully
[INFO] Database mode: PostgreSQL ✅
[INFO] All user operations will be persisted to PostgreSQL
```

## Step 4: Test Signup

1. Go to your deployed app
2. Sign up with a new user (e.g., `test@example.com`)
3. Check Railway → Postgres → Database → Data → users table
4. You should see the new user row

## Troubleshooting

### If connection fails:
- Verify `DATABASE_URL` format is correct
- Check that `PGPASSWORD` is correct
- Ensure Postgres service is running
- Check Railway logs for detailed error messages

### If tables don't create:
- Check logs for SQL errors
- Verify database permissions
- Check that `DATABASE_URL` points to correct database

### If signup doesn't create user:
- Check server logs for errors
- Verify `usersDB.set()` is being called
- Check PostgreSQL logs in Railway
