// Cloudflare Worker for traidefi.ai routing
// This worker rewrites the Host header so Railway recognizes the request

export default {
  async fetch(request, env) {
    // Get the original URL
    const url = new URL(request.url);
    
    // Railway URL - replace with your actual Railway domain
    // Check Railway dashboard to see which domain is configured
    const RAILWAY_URL = 'tangent-protocol.com'; // CHANGE THIS to your Railway domain
    
    // Only process requests for traidefi.ai
    if (url.hostname === 'traidefi.ai' || url.hostname === 'www.traidefi.ai') {
      // Create new request to Railway
      const railwayUrl = `https://${RAILWAY_URL}${url.pathname}${url.search}`;
      
      // Clone request headers
      const headers = new Headers(request.headers);
      
      // Set Host header to Railway domain
      headers.set('Host', RAILWAY_URL);
      
      // Preserve original request headers
      headers.set('X-Forwarded-Host', url.hostname);
      headers.set('X-Original-Host', url.hostname);
      
      // Forward request to Railway
      const railwayRequest = new Request(railwayUrl, {
        method: request.method,
        headers: headers,
        body: request.body,
      });
      
      // Fetch from Railway
      const response = await fetch(railwayRequest);
      
      // Return response
      return response;
    }
    
    // For other domains, pass through
    return fetch(request);
  }
}






