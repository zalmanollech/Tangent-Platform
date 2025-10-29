/**
 * TANGENT Insurance Integration Layer
 * 
 * This module provides seamless integration between Tangent Platform
 * and the Insurance Actuarial Service.
 * 
 * Features:
 * - Non-disruptive integration (existing functionality remains untouched)
 * - Automatic insurance quote generation
 * - Circuit breaker pattern for resilience
 * - Comprehensive logging and monitoring
 */

const axios = require('axios');

// Configuration
const INSURANCE_SERVICE_CONFIG = {
    baseURL: process.env.INSURANCE_SERVICE_URL || 'http://localhost:8002',
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
    circuitBreakerThreshold: 5, // failures before opening circuit
    circuitBreakerTimeout: 60000, // 1 minute
};

// Circuit Breaker State
let circuitBreakerState = {
    failures: 0,
    lastFailureTime: null,
    isOpen: false
};

/**
 * Circuit Breaker Implementation
 */
function isCircuitBreakerOpen() {
    if (!circuitBreakerState.isOpen) {
        return false;
    }
    
    // Check if timeout has passed
    const now = Date.now();
    if (now - circuitBreakerState.lastFailureTime > INSURANCE_SERVICE_CONFIG.circuitBreakerTimeout) {
        // Reset circuit breaker
        circuitBreakerState.isOpen = false;
        circuitBreakerState.failures = 0;
        console.log('🔄 Insurance circuit breaker reset - attempting to reconnect');
        return false;
    }
    
    return true;
}

function recordFailure() {
    circuitBreakerState.failures++;
    circuitBreakerState.lastFailureTime = Date.now();
    
    if (circuitBreakerState.failures >= INSURANCE_SERVICE_CONFIG.circuitBreakerThreshold) {
        circuitBreakerState.isOpen = true;
        console.warn('⚠️ Insurance circuit breaker opened - service appears to be down');
    }
}

function recordSuccess() {
    circuitBreakerState.failures = 0;
    circuitBreakerState.isOpen = false;
}

/**
 * HTTP Client with Retry Logic
 */
async function makeRequestWithRetry(method, url, data = null, attempt = 1) {
    try {
        const config = {
            method,
            url: `${INSURANCE_SERVICE_CONFIG.baseURL}${url}`,
            timeout: INSURANCE_SERVICE_CONFIG.timeout,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Tangent-Platform/1.0'
            }
        };
        
        if (data) {
            config.data = data;
        }
        
        const response = await axios(config);
        recordSuccess();
        return response.data;
        
    } catch (error) {
        const isConnectionError = error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED') || 
                                 error.code === 'ETIMEDOUT' || error.message.includes('timeout');
        
        if (!isConnectionError || attempt >= INSURANCE_SERVICE_CONFIG.retryAttempts) {
            if (attempt >= INSURANCE_SERVICE_CONFIG.retryAttempts && isConnectionError) {
                // Silent on final connection error - service just isn't running
            } else {
                console.error(`❌ Insurance service request failed (attempt ${attempt}):`, error.message);
            }
        }
        
        if (attempt < INSURANCE_SERVICE_CONFIG.retryAttempts) {
            await new Promise(resolve => setTimeout(resolve, INSURANCE_SERVICE_CONFIG.retryDelay));
            return makeRequestWithRetry(method, url, data, attempt + 1);
        }
        
        recordFailure();
        throw error;
    }
}

/**
 * Check Insurance Service Health
 */
async function checkInsuranceServiceHealth() {
    if (isCircuitBreakerOpen()) {
        return { status: 'unhealthy', message: 'Circuit breaker open', service: 'insurance' };
    }
    
    try {
        const response = await makeRequestWithRetry('GET', '/health');
        return { ...response, service: 'insurance' };
    } catch (error) {
        return { status: 'unhealthy', message: error.message, service: 'insurance' };
    }
}

/**
 * Get Insurance Quote
 */
async function getInsuranceQuote(tradeData, creditAssessment) {
    if (isCircuitBreakerOpen()) {
        return { 
            success: false, 
            error: 'Insurance service unavailable (circuit breaker open)' 
        };
    }
    
    try {
        const quote = await makeRequestWithRetry('POST', '/quote', {
            trade_data: tradeData,
            credit_assessment: creditAssessment
        });
        
        console.log(`✅ Insurance quote generated for trade ${tradeData.trade_id || tradeData.contract_id}`);
        return quote;
        
    } catch (error) {
        console.error('❌ Failed to get insurance quote:', error.message);
        return { 
            success: false, 
            error: error.message 
        };
    }
}

module.exports = {
    checkInsuranceServiceHealth,
    getInsuranceQuote
};

