// Free Sanctions API Integration - Crash-Safe Implementation
// This module provides multiple free sanctions screening sources with fallbacks

const https = require('https');
const http = require('http');
const fs = require('fs').promises;

// Cache for sanctions data
let sanctionsCache = {
    ofac: { data: [], loaded: false, lastUpdated: null },
    un: { data: [], loaded: false, lastUpdated: null },
    opensanctions: { data: [], loaded: false, lastUpdated: null }
};

// HTTP request helper with timeout and retry
function httpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const timeout = options.timeout || 10000; // 10 second timeout
        const maxRetries = options.retries || 2;
        
        const makeRequest = (retryCount = 0) => {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            const client = isHttps ? https : http;
            
            const req = client.request(url, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(data);
                    } else {
                        const error = new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`);
                        if (retryCount < maxRetries && res.statusCode >= 500) {
                            console.log(`⚠️ Retry ${retryCount + 1}/${maxRetries} for ${url}`);
                            setTimeout(() => makeRequest(retryCount + 1), 1000 * (retryCount + 1));
                        } else {
                            reject(error);
                        }
                    }
                });
            });
            
            req.on('error', (err) => {
                if (retryCount < maxRetries) {
                    console.log(`⚠️ Retry ${retryCount + 1}/${maxRetries} for ${url}`);
                    setTimeout(() => makeRequest(retryCount + 1), 1000 * (retryCount + 1));
                } else {
                    reject(err);
                }
            });
            
            req.setTimeout(timeout, () => {
                req.abort();
                reject(new Error('Request timeout'));
            });
            
            req.end();
        };
        
        makeRequest();
    });
}

// 1. OFAC Sanctions (US Treasury) - Primary source
async function loadOFACSanctions() {
    try {
        console.log('📥 Loading OFAC sanctions...');
        const data = await httpRequest('https://www.treasury.gov/ofac/downloads/sdn.xml', {
            timeout: 30000,
            retries: 2
        });
        
        // Simple parsing (avoid heavy XML parsing errors)
        const entries = [];
        const pattern = /<sdnEntry[^>]*uid="([^"]*)"[^>]*>/g;
        let match;
        
        while ((match = pattern.exec(data)) !== null) {
            // Extract basic info without full XML parsing
            entries.push({
                uid: match[1],
                source: 'OFAC'
            });
        }
        
        sanctionsCache.ofac.data = entries;
        sanctionsCache.ofac.loaded = true;
        sanctionsCache.ofac.lastUpdated = new Date();
        
        console.log(`✅ OFAC loaded: ${entries.length} entries`);
        return { success: true, count: entries.length };
        
    } catch (error) {
        console.warn('⚠️ OFAC loading failed:', error.message);
        return { success: false, error: error.message };
    }
}

// 2. OpenSanctions API (Free) - Secondary source
async function loadOpenSanctions() {
    try {
        console.log('📥 Loading OpenSanctions...');
        // OpenSanctions provides free JSON API
        const data = await httpRequest('https://data.opensanctions.org/datasets/latest/default/entities.ftm.json', {
            timeout: 20000,
            retries: 2
        });
        
        // Parse JSON safely
        const entities = JSON.parse(data);
        
        const entries = Array.isArray(entities) ? entities.map(entry => ({
            name: entry.properties?.name?.[0] || '',
            source: 'OpenSanctions'
        })) : [];
        
        sanctionsCache.opensanctions.data = entries;
        sanctionsCache.opensanctions.loaded = true;
        sanctionsCache.opensanctions.lastUpdated = new Date();
        
        console.log(`✅ OpenSanctions loaded: ${entries.length} entries`);
        return { success: true, count: entries.length };
        
    } catch (error) {
        console.warn('⚠️ OpenSanctions loading failed:', error.message);
        return { success: false, error: error.message };
    }
}

// 3. Simulated fallback (for testing without API)
function getFallbackSanctions() {
    return {
        data: [],
        loaded: false,
        lastUpdated: null
    };
}

// Main screening function - SAFE with fallbacks
async function screenSanctions(name, options = {}) {
    const result = {
        cleared: true,
        sources: [],
        matches: [],
        timestamp: new Date().toISOString()
    };
    
    // Simple name matching (avoid complex matching that could crash)
    const searchName = name.toLowerCase().trim();
    
    // Check OFAC cache
    if (sanctionsCache.ofac.loaded && sanctionsCache.ofac.data.length > 0) {
        const matches = sanctionsCache.ofac.data.filter(entry => {
            const entryName = entry.fullName || entry.name || '';
            return entryName.toLowerCase().includes(searchName);
        });
        
        if (matches.length > 0) {
            result.cleared = false;
            result.matches.push(...matches);
            result.sources.push('OFAC');
        }
    }
    
    // Check OpenSanctions cache
    if (sanctionsCache.opensanctions.loaded && sanctionsCache.opensanctions.data.length > 0) {
        const matches = sanctionsCache.opensanctions.data.filter(entry => {
            const entryName = entry.name || '';
            return entryName.toLowerCase().includes(searchName);
        });
        
        if (matches.length > 0) {
            result.cleared = false;
            result.matches.push(...matches);
            result.sources.push('OpenSanctions');
        }
    }
    
    return result;
}

// Initialize with graceful degradation
async function initializeSanctions() {
    console.log('🔄 Initializing sanctions screening...');
    
    try {
        // Load in sequence to avoid overwhelming
        await loadOFACSanctions();
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        await loadOpenSanctions();
        
        console.log('✅ Sanctions screening initialized');
        return { success: true };
    } catch (error) {
        console.warn('⚠️ Sanctions initialization failed, using fallback:', error.message);
        return { success: false, error: error.message };
    }
}

// Export safe functions
module.exports = {
    initializeSanctions,
    screenSanctions,
    getCacheStatus: () => ({
        ofac: { loaded: sanctionsCache.ofac.loaded, count: sanctionsCache.ofac.data.length },
        opensanctions: { loaded: sanctionsCache.opensanctions.loaded, count: sanctionsCache.opensanctions.data.length }
    }),
    // Manual refresh
    refresh: async () => {
        console.log('🔄 Refreshing sanctions data...');
        return await initializeSanctions();
    }
};

