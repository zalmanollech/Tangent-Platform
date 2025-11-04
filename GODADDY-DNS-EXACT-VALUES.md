# GoDaddy DNS Records for traidefi.ai

## Your Railway URL
**Railway URL:** `tangent-platform-production.up.railway.app`

## Records to Add in GoDaddy

### Record 1: Root Domain (traidefi.ai)
**Type:** CNAME (or A record if CNAME not allowed on root)  
**Name/Host:** Leave empty or enter `@`  
**Value/Points to:** `tangent-platform-production.up.railway.app`  
**TTL:** 600 (default)

**Note:** If GoDaddy doesn't allow CNAME on root domain:
- Use **A Record** instead
- You'll need Railway's IP address (contact Railway support)

### Record 2: www Subdomain (www.traidefi.ai)
**Type:** CNAME  
**Name/Host:** `www`  
**Value/Points to:** `tangent-platform-production.up.railway.app`  
**TTL:** 600 (default)

## After Adding DNS Records

1. **Wait for propagation** (15-60 minutes)
2. **Test the domain**: Visit `https://traidefi.ai` and `https://www.traidefi.ai`
3. **The domain will work** even if Railway doesn't show it in the dashboard (because you hit the limit)

## How to Verify DNS is Working

1. Visit: https://www.whatsmydns.net
2. Enter: `traidefi.ai`
3. Select: CNAME record type
4. Check if it points to: `tangent-platform-production.up.railway.app`

## Important Notes

- You **DON'T need to add** `traidefi.ai` as a custom domain in Railway (you hit the limit anyway)
- The DNS records will work on their own
- Railway will serve the traffic when someone visits `traidefi.ai`
- Your server code will detect `traidefi.ai` domain and show Traidefi branding automatically

