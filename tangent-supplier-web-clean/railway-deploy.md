# Railway Deployment Instructions

## Step 1: Fix Configuration Files ✅
All configuration files have been updated for Railway compatibility.

## Step 2: Deploy to Railway

### Option A: Using Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy the project
railway deploy
```

### Option B: Using GitHub Integration
1. Push your code to GitHub
2. Connect GitHub repository to Railway
3. Railway will auto-deploy

## Step 3: Set Environment Variables in Railway Dashboard

**Required Environment Variables:**
```
NODE_ENV=production
JWT_SECRET=your-super-secure-jwt-secret-32-chars-minimum
ADMIN_KEY=your-secure-admin-key-here
```

**Optional but Recommended:**
```
RATE_LIMIT_MAX_REQUESTS=50
LOG_LEVEL=info
```

## Step 4: Add PostgreSQL Database
1. In Railway dashboard, click "Add Service"
2. Select "PostgreSQL" 
3. Railway will automatically set DATABASE_URL

## Step 5: Verify Deployment
After deployment, check:
- Health endpoint: `https://your-app.railway.app/health`
- Main app: `https://your-app.railway.app/portal`

## Common Issues & Solutions

### Issue 1: Port Binding Error
✅ **Fixed**: Server now binds to `0.0.0.0` automatically in production

### Issue 2: Build Failing
✅ **Fixed**: Updated nixpacks.toml with correct commands

### Issue 3: CORS Errors
✅ **Fixed**: CORS now includes Railway domains automatically

### Issue 4: Database Connection
✅ **Fixed**: Automatically uses PostgreSQL when DATABASE_URL is provided

### Issue 5: Environment Variables
⚠️ **Action Required**: You must set JWT_SECRET and ADMIN_KEY in Railway dashboard

## Test Your Deployment

1. **Health Check**: `GET /health`
2. **Registration**: Try creating a new account
3. **Login**: Test authentication
4. **KYC**: Upload a document
5. **Trade Creation**: Create a sample trade

## Environment Variables Guide

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| NODE_ENV | Yes | Set to production | `production` |
| JWT_SECRET | Yes | Secure JWT signing key | 32+ character string |
| ADMIN_KEY | Yes | Admin authentication key | Secure password |
| DATABASE_URL | Auto | PostgreSQL connection | Auto-set by Railway |
| PORT | Auto | Server port | Auto-set by Railway |

## After Successful Deployment

1. **Update CORS**: If using custom domain, add it to ALLOWED_ORIGINS
2. **Set up monitoring**: Consider adding error tracking
3. **SSL Certificate**: Railway provides HTTPS automatically
4. **Custom Domain**: Add your domain in Railway dashboard

## Troubleshooting Commands

```bash
# Check logs
railway logs

# Open shell in deployed environment
railway shell

# Check environment variables
railway variables

# Force redeploy
railway deploy --force
```

Your deployment should now work correctly! 🚀

