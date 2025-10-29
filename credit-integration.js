/**
 * TANGENT-BRIDGE-v4 Credit Risk Integration Layer
 * 
 * This module provides seamless integration between Tangent Platform
 * and the TANGENT-BRIDGE-v4 credit risk assessment system.
 * 
 * Features:
 * - Non-disruptive integration (existing KYC remains untouched)
 * - Automatic credit assessment after contract upload
 * - Circuit breaker pattern for resilience
 * - Feature flags for easy enable/disable
 * - Comprehensive logging and monitoring
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const CREDIT_SERVICE_CONFIG = {
    baseURL: process.env.CREDIT_SERVICE_URL || 'http://localhost:8001',
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

// Feature Flags
const FEATURE_FLAGS = {
    CREDIT_ASSESSMENT_ENABLED: process.env.CREDIT_ASSESSMENT_ENABLED !== 'false',
    AUTO_ASSESSMENT_ENABLED: process.env.AUTO_ASSESSMENT_ENABLED !== 'false',
    ADMIN_NOTIFICATIONS_ENABLED: process.env.ADMIN_NOTIFICATIONS_ENABLED !== 'false'
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
    if (now - circuitBreakerState.lastFailureTime > CREDIT_SERVICE_CONFIG.circuitBreakerTimeout) {
        // Reset circuit breaker
        circuitBreakerState.isOpen = false;
        circuitBreakerState.failures = 0;
        console.log('🔄 Circuit breaker reset - attempting to reconnect to credit service');
        return false;
    }
    
    return true;
}

function recordFailure() {
    circuitBreakerState.failures++;
    circuitBreakerState.lastFailureTime = Date.now();
    
    if (circuitBreakerState.failures >= CREDIT_SERVICE_CONFIG.circuitBreakerThreshold) {
        circuitBreakerState.isOpen = true;
        console.warn('⚠️ Circuit breaker opened - credit service appears to be down');
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
            url: `${CREDIT_SERVICE_CONFIG.baseURL}${url}`,
            timeout: CREDIT_SERVICE_CONFIG.timeout,
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
        // Only log errors if it's not a connection refused error (service not running)
        const isConnectionError = error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED') || 
                                 error.code === 'ETIMEDOUT' || error.message.includes('timeout');
        
        if (!isConnectionError || attempt >= CREDIT_SERVICE_CONFIG.retryAttempts) {
            // Log actual errors, but not connection refused on final attempt
            if (attempt >= CREDIT_SERVICE_CONFIG.retryAttempts && isConnectionError) {
                // Silent on final connection error - service just isn't running
            } else {
                console.error(`❌ Credit service request failed (attempt ${attempt}):`, error.message);
            }
        }
        
        if (attempt < CREDIT_SERVICE_CONFIG.retryAttempts) {
            await new Promise(resolve => setTimeout(resolve, CREDIT_SERVICE_CONFIG.retryDelay));
            return makeRequestWithRetry(method, url, data, attempt + 1);
        }
        
        recordFailure();
        throw error;
    }
}

/**
 * Credit Service Health Check
 */
async function checkCreditServiceHealth() {
    if (!FEATURE_FLAGS.CREDIT_ASSESSMENT_ENABLED) {
        return { status: 'disabled', message: 'Credit assessment disabled via feature flag' };
    }
    
    if (isCircuitBreakerOpen()) {
        return { status: 'circuit_open', message: 'Circuit breaker is open - credit service unavailable' };
    }
    
    try {
        const health = await makeRequestWithRetry('GET', '/health');
        return { status: 'healthy', data: health };
    } catch (error) {
        return { status: 'unhealthy', message: error.message };
    }
}

/**
 * Create Entity in Credit Service
 */
async function createCreditEntity(entityData) {
    if (!FEATURE_FLAGS.CREDIT_ASSESSMENT_ENABLED) {
        return { success: false, reason: 'Credit assessment disabled' };
    }
    
    if (isCircuitBreakerOpen()) {
        return { success: false, reason: 'Credit service unavailable (circuit breaker open)' };
    }
    
    try {
        const entity = await makeRequestWithRetry('POST', '/entities', {
            name: entityData.name,
            country: entityData.country || 'Unknown',
            entity_type: entityData.entity_type || 'company',
            registration_number: entityData.registration_number,
            address: entityData.address,
            contact_email: entityData.email,
            contact_phone: entityData.phone
        });
        
        console.log(`✅ Created credit entity: ${entity.id} for ${entityData.name}`);
        return { success: true, entity };
        
    } catch (error) {
        console.error('❌ Failed to create credit entity:', error.message);
        console.error('❌ Full error:', error);
        if (error.response) {
            console.error('❌ Response status:', error.response.status);
            console.error('❌ Response data:', error.response.data);
        }
        return { success: false, reason: error.message };
    }
}

/**
 * Perform General KYC in Credit Service
 */
async function performCreditKYC(entityId) {
    if (!FEATURE_FLAGS.CREDIT_ASSESSMENT_ENABLED) {
        return { success: false, reason: 'Credit assessment disabled' };
    }
    
    if (isCircuitBreakerOpen()) {
        return { success: false, reason: 'Credit service unavailable (circuit breaker open)' };
    }
    
    try {
        const kycResult = await makeRequestWithRetry('POST', `/kyc/general/${entityId}`);
        console.log(`✅ Credit KYC completed for entity ${entityId}: ${kycResult.status}`);
        return { success: true, kyc: kycResult };
        
    } catch (error) {
        console.error('❌ Failed to perform credit KYC:', error.message);
        return { success: false, reason: error.message };
    }
}

/**
 * Create Trade in Credit Service
 */
async function createCreditTrade(tradeData) {
    if (!FEATURE_FLAGS.CREDIT_ASSESSMENT_ENABLED) {
        return { success: false, reason: 'Credit assessment disabled' };
    }
    
    if (isCircuitBreakerOpen()) {
        return { success: false, reason: 'Credit service unavailable (circuit breaker open)' };
    }
    
    try {
        const trade = await makeRequestWithRetry('POST', '/trades', {
            buyer_id: tradeData.buyer_id,
            amount: tradeData.amount,
            tenor_days: tradeData.tenor_days,
            inventory_value: tradeData.inventory_value,
            inventory_type: tradeData.inventory_type,
            inventory_location: tradeData.inventory_location,
            buyer_deposit: tradeData.buyer_deposit,
            is_exchange_traded: tradeData.is_exchange_traded,
            exchange_name: tradeData.exchange_name,
            exchange_grade: tradeData.exchange_grade
        });
        
        console.log(`✅ Created credit trade: ${trade.id} for amount ${tradeData.amount}`);
        return { success: true, trade };
        
    } catch (error) {
        console.error('❌ Failed to create credit trade:', error.message);
        return { success: false, reason: error.message };
    }
}

/**
 * Perform Credit Assessment
 */
async function performCreditAssessment(tradeId) {
    if (!FEATURE_FLAGS.CREDIT_ASSESSMENT_ENABLED) {
        return { success: false, reason: 'Credit assessment disabled' };
    }
    
    if (isCircuitBreakerOpen()) {
        return { success: false, reason: 'Credit service unavailable (circuit breaker open)' };
    }
    
    try {
        const assessment = await makeRequestWithRetry('POST', `/kyc/trade/${tradeId}`);
        console.log(`✅ Credit assessment completed for trade ${tradeId}: ${assessment.decision}`);
        return { success: true, assessment };
        
    } catch (error) {
        console.error('❌ Failed to perform credit assessment:', error.message);
        return { success: false, reason: error.message };
    }
}

/**
 * Send Assessment Report to Admin Dashboard
 */
function sendAssessmentReportToAdmin(assessment, tradeData, originalContract) {
    if (!FEATURE_FLAGS.ADMIN_NOTIFICATIONS_ENABLED) {
        console.log('📊 Admin notifications disabled - assessment report not sent');
        return;
    }
    
    const report = {
        timestamp: new Date().toISOString(),
        tradeId: assessment.trade_id,
        contractId: originalContract.id,
        buyerName: tradeData.buyer_name,
        amount: tradeData.amount,
        decision: assessment.decision,
        riskBand: assessment.risk_band,
        riskScore: assessment.adjusted_pd,
        confidence: assessment.confidence,
        recommendations: assessment.recommendations,
        flags: assessment.flags || [],
        assessmentDetails: {
            generalKYC: assessment.general_kyc_status,
            tradeSpecificKYC: assessment.trade_specific_kyc_status,
            collateralAnalysis: assessment.collateral_analysis,
            creditScore: assessment.credit_score,
            expertRules: assessment.expert_rules_applied
        }
    };
    
    // Log the report
    console.log('📊 Credit Assessment Report:', JSON.stringify(report, null, 2));
    
    // Save to file for admin review
    const reportPath = path.join(__dirname, 'logs', 'credit-assessments.json');
    const logDir = path.dirname(reportPath);
    
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Append to assessment log
    let assessments = [];
    if (fs.existsSync(reportPath)) {
        try {
            assessments = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        } catch (error) {
            console.warn('⚠️ Could not read existing assessment log, creating new one');
        }
    }
    
    assessments.push(report);
    fs.writeFileSync(reportPath, JSON.stringify(assessments, null, 2));
    
    console.log(`📄 Assessment report saved to: ${reportPath}`);
}

/**
 * Main Integration Function - Called after contract upload
 */
async function integrateCreditAssessment(contractData, userData) {
    console.log('🔗 Starting TANGENT-BRIDGE-v4 Credit Integration...');
    
    // Check if credit assessment is enabled
    if (!FEATURE_FLAGS.CREDIT_ASSESSMENT_ENABLED) {
        console.log('📝 Credit assessment disabled - skipping integration');
        return { success: true, skipped: true, reason: 'Credit assessment disabled' };
    }
    
    // Check circuit breaker
    if (isCircuitBreakerOpen()) {
        console.log('⚠️ Circuit breaker open - credit service unavailable');
        return { success: false, reason: 'Credit service unavailable' };
    }
    
    try {
        // Step 1: Create entity in credit service
        console.log('👤 Creating entity in credit service...');
        const entityResult = await createCreditEntity({
            name: userData.name || userData.company || 'Unknown Entity',
            country: userData.country || 'Unknown',
            email: userData.email,
            phone: userData.phone,
            entity_type: 'company'
        });
        
        if (!entityResult.success) {
            throw new Error(`Failed to create entity: ${entityResult.reason}`);
        }
        
        const entityId = entityResult.entity.id;
        
        // Step 2: Perform general KYC
        console.log('🔍 Performing general KYC...');
        const kycResult = await performCreditKYC(entityId);
        
        if (!kycResult.success) {
            throw new Error(`Failed to perform KYC: ${kycResult.reason}`);
        }
        
        // Step 3: Create trade
        console.log('📄 Creating trade in credit service...');
        const tradeResult = await createCreditTrade({
            buyer_id: entityId,
            amount: contractData.amount || 0,
            tenor_days: contractData.tenor_days || 30,
            inventory_value: contractData.inventory_value || contractData.amount * 0.8,
            inventory_type: contractData.inventory_type || 'commodity',
            inventory_location: contractData.inventory_location || 'warehouse',
            buyer_deposit: contractData.buyer_deposit || contractData.amount * 0.1,
            is_exchange_traded: contractData.is_exchange_traded || false,
            exchange_name: contractData.exchange_name,
            exchange_grade: contractData.exchange_grade
        });
        
        if (!tradeResult.success) {
            throw new Error(`Failed to create trade: ${tradeResult.reason}`);
        }
        
        const tradeId = tradeResult.trade.id;
        
        // Step 4: Perform credit assessment
        console.log('🧮 Performing credit assessment...');
        const assessmentResult = await performCreditAssessment(tradeId);
        
        if (!assessmentResult.success) {
            throw new Error(`Failed to perform assessment: ${assessmentResult.reason}`);
        }
        
        // Step 5: Send report to admin
        console.log('📊 Sending assessment report to admin...');
        sendAssessmentReportToAdmin(assessmentResult.assessment, {
            buyer_id: entityId,
            buyer_name: userData.name || userData.company,
            amount: contractData.amount,
            tenor_days: contractData.tenor_days
        }, contractData);
        
        console.log('✅ Credit integration completed successfully!');
        
        return {
            success: true,
            entityId,
            tradeId,
            assessment: assessmentResult.assessment,
            decision: assessmentResult.assessment.decision,
            riskBand: assessmentResult.assessment.risk_band,
            riskScore: assessmentResult.assessment.adjusted_pd
        };
        
    } catch (error) {
        console.error('❌ Credit integration failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get Integration Status
 */
function getIntegrationStatus() {
    return {
        featureFlags: FEATURE_FLAGS,
        circuitBreaker: {
            isOpen: circuitBreakerState.isOpen,
            failures: circuitBreakerState.failures,
            lastFailureTime: circuitBreakerState.lastFailureTime
        },
        config: {
            creditServiceURL: CREDIT_SERVICE_CONFIG.baseURL,
            timeout: CREDIT_SERVICE_CONFIG.timeout,
            retryAttempts: CREDIT_SERVICE_CONFIG.retryAttempts
        }
    };
}

module.exports = {
    integrateCreditAssessment,
    checkCreditServiceHealth,
    getIntegrationStatus,
    FEATURE_FLAGS
};


