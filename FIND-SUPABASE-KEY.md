# How to Find Your Supabase Anon Key

## Step-by-Step with Exact Locations:

### Step 1: Go to Supabase Dashboard
1. Open browser and go to **https://supabase.com**
2. Click **"Sign In"** (top right) if not already signed in
3. Sign in with your account

### Step 2: Select Your Project
1. You'll see a list of projects
2. Click on the project that has database `qqqfkszxkuxvqyisphti`
   - This should be your Tangent/Traidefi project
   - Project URL: `https://qqqfkszxkuxvqyisphti.supabase.co`

### Step 3: Open Settings
1. Look at the **left sidebar** in Supabase dashboard
2. Scroll down to find **"Settings"** (gear icon ⚙️)
3. Click on **"Settings"**

### Step 4: Go to API Section
1. In Settings, you'll see a menu:
   - General
   - **API** ← Click this one
   - Database
   - Auth
   - Storage
   - etc.
2. Click **"API"** in the settings menu

### Step 5: Find Project API Keys
1. In the API settings page, look for **"Project API keys"** section
2. You'll see two keys:
   - **"anon"** `public` - This is the one you need! ✅
   - **"service_role"** `secret` - Don't use this one (it's secret)
3. Find the **"anon"** key
4. It's a long string that starts with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
5. There should be a **"Copy"** button or icon next to it
6. Click **"Copy"** to copy the key

### Step 6: Share the Key
- Paste the copied key here
- I'll add it to your `config.env` file

---

## Visual Guide:

```
Supabase Dashboard
├── Left Sidebar
│   ├── Table Editor
│   ├── SQL Editor
│   ├── Storage
│   ├── ...
│   └── Settings ⚙️ ← Click here
│       ├── General
│       ├── API ← Click here
│       ├── Database
│       └── ...
│
└── Main Content Area
    └── Project API keys section
        ├── anon public ← This is your key! ✅
        └── service_role secret ← Don't use this
```

---

## Alternative: Direct URL
If you're logged in, you can go directly to:
**https://supabase.com/dashboard/project/[your-project-id]/settings/api**

Replace `[your-project-id]` with your project ID (the part before `.supabase.co` in your URL)

---

## What the Key Looks Like:
- Very long string (around 200+ characters)
- Starts with: `eyJhbGc...`
- Looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFx...`
- There's a "Copy" button/icon next to it

---

## Troubleshooting:

**Can't find Settings?**
- Make sure you're logged in
- Check if you have access to the project
- Try refreshing the page

**Can't see API section?**
- Click Settings first, then API should appear in the menu
- Make sure you're in the right project

**Key looks too short?**
- Make sure you copied the full key
- It should be a very long string (200+ characters)

