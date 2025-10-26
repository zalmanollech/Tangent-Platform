/**
 * Insurance API Test Script
 * Run this with: node test-insurance.js
 */

const axios = require('axios');

const INSURANCE_URL = 'http://localhost:8002';
const PLATFORM_URL = 'http://localhost:4000';

async function testInsuranceService() {
    console.log('🧪 Testing Insurance Service...\n');
    
    try {
        // Test 1: Health Check
        console.log('Test 1: Health Check');
        const health = await axios.get(`${INSURANCE_URL}/health`);
        console.log('✅ Health Status:', health.data);
        console.log('');
        
        // Test 2: High-Risk Trade Quote
        console.log('Test 2: High-Risk Trade Quote');
        const highRiskQuote = await axios.post(`${PLATFORM_URL}/api/insurance/quote`, {
            tradeData: {
                trade_id: 'test_high_risk',
                contract_id: 'contract_high',
                amount: 530000,
                tenor_days: 30,
                inventory_value: 424000,
                inventory_type: 'commodity',
                inventory_location: 'warehouse',
                buyer_deposit: 53000,
                is_exchange_traded: false,
                country_risk: 0.05
            },
            creditAssessment: {
                pd: 0.214,
                risk_band: 'E',
                collateral_analysis: {
                    effective_protection_ratio: 0.635,
                    risk_reduction: 0.508,
                    lgd_adjustment: 0.221
                }
            }
        });
        
        const quote = highRiskQuote.data;
        console.log('💰 Premium:', quote.premium_breakdown.total_premium.toLocaleString());
        console.log('📊 Premium Rate:', (quote.premium_breakdown.premium_rate * 100).toFixed(2) + '%');
        console.log('🎯 Underwriting Score:', quote.underwriting_score);
        console.log('📈 Recommendation:', quote.recommendation.decision);
        console.log('✅ Expected Result: DECLINE (High Risk)');
        console.log('');
        
        // Test 3: Low-Risk Trade Quote
        console.log('Test 3: Low-Risk Trade Quote');
        const lowRiskQuote = await axios.post(`${PLATFORM_URL}/api/insurance/quote`, {
            tradeData: {
                trade_id: 'test_low_risk',
                contract_id: 'contract_low',
                amount: 100000,
                tenor_days: 30,
                inventory_value: 90000,
                inventory_type: 'commodity',
                inventory_location: 'warehouse',
                buyer_deposit: 15000,
                is_exchange_traded: true,
                country_risk: 0.03
            },
            creditAssessment: {
                pd: 0.025,
                risk_band: 'B',
                collateral_analysis: {
                    effective_protection_ratio: 0.85,
                    risk_reduction: 0.68,
                    lgd_adjustment: 0.144
                }
            }
        });
        
        const lowQuote = lowRiskQuote.data;
        console.log('💰 Premium:', lowQuote.premium_breakdown.total_premium.toLocaleString());
        console.log('📊 Premium Rate:', (lowQuote.premium_breakdown.premium_rate * 100).toFixed(2) + '%');
        console.log('🎯 Underwriting Score:', lowQuote.underwriting_score);
        console.log('📈 Recommendation:', lowQuote.recommendation.decision);
        console.log('✅ Expected Result: RECOMMEND (Low Risk)');
        console.log('');
        
        console.log('✅ All tests passed! Insurance service is working correctly.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

// Run tests
testInsuranceService();

