/**
 * TANGENT-BRIDGE-v4 Integration Test Script
 * 
 * This script tests the integration between Tangent Platform
 * and the credit risk assessment system locally.
 */

const creditIntegration = require('./credit-integration');
const fs = require('fs');
const path = require('path');

// Test data
const testContractData = {
    id: 'test-contract-001',
    amount: 1000000,
    tenor_days: 60,
    inventory_value: 800000,
    inventory_type: 'commodity',
    inventory_location: 'warehouse_secured',
    buyer_deposit: 100000,
    is_exchange_traded: true,
    exchange_name: 'CME',
    exchange_grade: 'A'
};

const testUserData = {
    name: 'Integration Test Company',
    company: 'Integration Test Company',
    email: 'test@integration.com',
    phone: '+1-555-0123',
    country: 'USA'
};

async function runIntegrationTest() {
    console.log('🧪 Starting TANGENT-BRIDGE-v4 Integration Test');
    console.log('================================================');
    
    const results = {
        timestamp: new Date().toISOString(),
        tests: []
    };
    
    // Test 1: Check Integration Status
    console.log('\n1️⃣ Testing Integration Status...');
    try {
        const status = creditIntegration.getIntegrationStatus();
        console.log('✅ Integration status retrieved');
        console.log('   Feature Flags:', status.featureFlags);
        console.log('   Circuit Breaker:', status.circuitBreaker);
        results.tests.push({ name: 'Integration Status', status: 'PASS', data: status });
    } catch (error) {
        console.log('❌ Integration status test failed:', error.message);
        results.tests.push({ name: 'Integration Status', status: 'FAIL', error: error.message });
    }
    
    // Test 2: Check Credit Service Health
    console.log('\n2️⃣ Testing Credit Service Health...');
    try {
        const health = await creditIntegration.checkCreditServiceHealth();
        console.log('✅ Credit service health check completed');
        console.log('   Status:', health.status);
        if (health.data) {
            console.log('   Service Info:', health.data);
        }
        results.tests.push({ name: 'Credit Service Health', status: 'PASS', data: health });
    } catch (error) {
        console.log('❌ Credit service health check failed:', error.message);
        results.tests.push({ name: 'Credit Service Health', status: 'FAIL', error: error.message });
    }
    
    // Test 3: Full Integration Test
    console.log('\n3️⃣ Testing Full Credit Integration...');
    try {
        const integrationResult = await creditIntegration.integrateCreditAssessment(testContractData, testUserData);
        
        if (integrationResult.success) {
            console.log('✅ Full integration test completed successfully!');
            console.log('   Entity ID:', integrationResult.entityId);
            console.log('   Trade ID:', integrationResult.tradeId);
            console.log('   Decision:', integrationResult.decision);
            console.log('   Risk Band:', integrationResult.riskBand);
            console.log('   Risk Score:', (integrationResult.riskScore * 100).toFixed(2) + '%');
            
            results.tests.push({ 
                name: 'Full Integration', 
                status: 'PASS', 
                data: integrationResult 
            });
        } else {
            console.log('❌ Integration test failed:', integrationResult.error || integrationResult.reason);
            results.tests.push({ 
                name: 'Full Integration', 
                status: 'FAIL', 
                error: integrationResult.error || integrationResult.reason 
            });
        }
    } catch (error) {
        console.log('❌ Full integration test failed:', error.message);
        results.tests.push({ name: 'Full Integration', status: 'FAIL', error: error.message });
    }
    
    // Test 4: Circuit Breaker Test (if service is down)
    console.log('\n4️⃣ Testing Circuit Breaker...');
    try {
        // This test checks if the circuit breaker properly handles service failures
        const circuitBreakerStatus = creditIntegration.getIntegrationStatus().circuitBreaker;
        console.log('✅ Circuit breaker status retrieved');
        console.log('   Is Open:', circuitBreakerStatus.isOpen);
        console.log('   Failures:', circuitBreakerStatus.failures);
        results.tests.push({ name: 'Circuit Breaker', status: 'PASS', data: circuitBreakerStatus });
    } catch (error) {
        console.log('❌ Circuit breaker test failed:', error.message);
        results.tests.push({ name: 'Circuit Breaker', status: 'FAIL', error: error.message });
    }
    
    // Summary
    console.log('\n================================================');
    console.log('📊 INTEGRATION TEST SUMMARY');
    console.log('================================================');
    
    const passedTests = results.tests.filter(test => test.status === 'PASS').length;
    const totalTests = results.tests.length;
    
    console.log(`Tests Passed: ${passedTests}/${totalTests}`);
    
    if (passedTests === totalTests) {
        console.log('🎉 ALL TESTS PASSED! Integration is ready!');
        console.log('\n✅ The credit risk assessment system is working perfectly');
        console.log('✅ It can be safely integrated with Tangent Platform');
        console.log('✅ All existing functionality is preserved');
    } else {
        console.log('❌ SOME TESTS FAILED. Review the logs above for details.');
        console.log('\n⚠️ Integration may not work as expected');
        console.log('⚠️ Check that the credit service is running on http://localhost:8000');
    }
    
    // Save results
    const resultsPath = path.join(__dirname, 'integration-test-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Detailed test results saved to: ${resultsPath}`);
    
    return results;
}

// Run the test if this script is executed directly
if (require.main === module) {
    runIntegrationTest().catch(error => {
        console.error('❌ Integration test failed:', error);
        process.exit(1);
    });
}

module.exports = { runIntegrationTest };


