# How to Find Supabase Connection String

## Step 1: Go to API Settings (NOT Database Settings)

1. In the left sidebar, click **Settings** (the gear icon at the bottom)
2. Click **API** (or "Data API")

## Step 2: Find Connection String

Once on the API Settings page, look for:
- **Connection string** section
- **Database** tab or section
- **Connection pooling** section

The connection string should be in one of these formats:

### Transaction Mode (Port 6543) - Recommended for servers
```
postgresql://postgres.qqqfkszxkuxvqyisphti:[YOUR-PASSWORD]@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres
```

### Session Mode (Port 6543)
```
postgresql://postgres.qqqfkszxkuxvqyisphti:[YOUR-PASSWORD]@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres
```

### Direct Connection (Port 5432)
```
postgresql://postgres.qqqfkszxkuxvqyisphti:[YOUR-PASSWORD]@db.qqqfkszxkuxvqyisphti.supabase.co:5432/postgres
```

## Alternative: Check Database Overview Page

1. In left sidebar, click **Database** (top section)
2. Look for a "Connection string" or "Connection info" card
3. It might show the connection string there

## If You Still Can't Find It:

1. Go to Settings → **General**
2. Look for "Connection string" or "Database URL"
3. Or check the **Project Settings** section

