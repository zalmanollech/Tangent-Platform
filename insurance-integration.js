/**
 * Insurance Integration Module
 * Integrates insurance quotes with Tangent Platform
 */

const axios = require('axios');

// Configuration
const INSURANCE_SERVICE_CONFIG = {
    baseURL: process.env.INSURANCE_SERVICE_URL || 'http://localhost:8002',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000
};

/**
 * Get insurance quote for a trade
 */
async function getInsuranceQuote(tradeData, creditAssessment) {
    try {
        const response = await axios.post(
            `${INSURANCE_SERVICE_CONFIG.baseURL}/quote`,
            {
                trade_data: tradeData,
                credit_assessment: creditAssessment
            },
            {
                timeout: INSURANCE_SERVICE_CONFIG.timeout
            }
        );
        
        console.log('✅ Insurance quote generated:', {
            contractId: tradeData.contract_id,
            underwritingScore: response.data.underwriting_score,
            recommendation: response.data.recommendation.decision,
            premium: response.data.premium_breakdown.total_premium
        });
        
        return response.data;
    } catch (error) {
        console.error('❌ Failed to get insurance quote:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get all insurance opportunities
 */
async function getInsuranceOpportunities(contracts) {
    try {
        const response = await axios.post(
            `${INSURANCE_SERVICE_CONFIG.baseURL}/opportunities`,
            contracts,
            {
                timeout: INSURANCE_SERVICE_CONFIG.timeout
            }
        );
        
        return response.data;
    } catch (error) {
        console.error('❌ Failed to get insurance opportunities:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Check insurance service health
 */
async function checkInsuranceServiceHealth() {
    try {
        const response = await axios.get(`${INSURANCE_SERVICE_CONFIG.baseURL}/health`);
        return { status: 'healthy', data: response.data };
    } catch (error) {
        return { status: 'unhealthy', message: error.message };
    }
}

module.exports = {
    getInsuranceQuote,
    getInsuranceOpportunities,
    checkInsuranceServiceHealth
};

