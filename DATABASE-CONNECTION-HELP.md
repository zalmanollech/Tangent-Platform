# Database Connection Help

## Issue: "Tenant or user not found"

The connection string format might be incorrect for Supabase's connection pooler.

## How to Get the Correct Connection String:

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project: **traidefi-db**

### Step 2: Get Connection String
1. Go to: **Settings** → **Database**
2. Scroll down to **Connection string** section
3. Look for tabs: **URI**, **Session mode**, **Transaction mode**
4. Select **Transaction mode** (recommended for server applications)
5. Click **Copy** to copy the connection string

### Step 3: Update config.env
Replace the DATABASE_URL in `config.env` with the exact string from Supabase (it should look like):

```
DATABASE_URL=postgresql://postgres.qqqfkszxkuxvqyisphti:[YOUR-PASSWORD]@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres
```

**Important:** 
- The username format might be different (could be just `postgres` or `postgres.{project-ref}`)
- Make sure you're using the **Transaction mode** connection string for pooling
- If Transaction mode doesn't work, try **Session mode**

### Step 4: Test Connection
After updating `config.env`, restart the server and try accessing `/admin/purchases` again.

---

## Alternative: Use Direct Connection (Port 5432)

If the pooler doesn't work, you can try the direct connection:

1. In Supabase Dashboard → Settings → Database
2. Find **Connection string** → **URI** tab (NOT pooler)
3. Copy that connection string
4. It should look like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
5. Update `config.env` with this connection string

**Note:** Direct connection (port 5432) has connection limits, so pooler (port 6543) is preferred for production.

