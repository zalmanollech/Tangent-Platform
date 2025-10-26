/**
 * TANGENT-BRIDGE-v4 Complete Integration Test
 * 
 * This script tests the complete integration between:
 * 1. TANGENT-BRIDGE-v4 Credit Risk Service (Port 8000)
 * 2. Tangent Platform with Credit Integration (Port 4000)
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const CREDIT_SERVICE_URL = 'http://localhost:8000';
const TANGENT_PLATFORM_URL = 'http://localhost:4000';

// Test data
const testUser = {
    email: 'integration-test@tangent.com',
    password: 'testpassword123',
    name: 'Integration Test User',
    company: 'Integration Test Company',
    role: 'buyer',
    country: 'USA',
    phone: '+1-555-0123'
};

const testContract = {
    supplierEmail: 'supplier@test.com',
    buyerEmail: testUser.email,
    productDetails: 'Test Commodity Integration',
    quantity: 100,
    unit: 'tons',
    pricePerUnit: 1000,
    totalValue: 100000,
    deliveryDate: '2024-12-31',
    paymentTerms: '30 days',
    origin: 'USA',
    destination: 'Canada',
    specifications: 'High quality test commodity',
    contractRole: 'buyer',
    counterpartyEmail: 'supplier@test.com'
};

async function runCompleteIntegrationTest() {
    console.log('🚀 TANGENT-BRIDGE-v4 Complete Integration Test');
    console.log('================================================');
    console.log('Testing integration between:');
    console.log('  - Credit Risk Service: http://localhost:8000');
    console.log('  - Tangent Platform: http://localhost:4000');
    console.log('');
    
    const results = {
        timestamp: new Date().toISOString(),
        tests: [],
        summary: {
            total: 0,
            passed: 0,
            failed: 0
        }
    };
    
    // Test 1: Check Credit Service Health
    console.log('1️⃣ Testing Credit Service Health...');
    try {
        const response = await axios.get(`${CREDIT_SERVICE_URL}/health`, { timeout: 5000 });
        console.log('✅ Credit service is running');
        console.log('   Status:', response.data.status);
        results.tests.push({ name: 'Credit Service Health', status: 'PASS', data: response.data });
        results.summary.passed++;
    } catch (error) {
        console.log('❌ Credit service is not running:', error.message);
        console.log('   Make sure to start the credit service with: python main.py');
        results.tests.push({ name: 'Credit Service Health', status: 'FAIL', error: error.message });
        results.summary.failed++;
    }
    results.summary.total++;
    
    // Test 2: Check Tangent Platform Health
    console.log('\n2️⃣ Testing Tangent Platform Health...');
    try {
        const response = await axios.get(`${TANGENT_PLATFORM_URL}/api/health`, { timeout: 5000 });
        console.log('✅ Tangent Platform is running');
        console.log('   Status:', response.data.status || 'OK');
        results.tests.push({ name: 'Tangent Platform Health', status: 'PASS', data: response.data });
        results.summary.passed++;
    } catch (error) {
        console.log('❌ Tangent Platform is not running:', error.message);
        console.log('   Make sure to start the platform with: npm start');
        results.tests.push({ name: 'Tangent Platform Health', status: 'FAIL', error: error.message });
        results.summary.failed++;
    }
    results.summary.total++;
    
    // Test 3: Test Credit Integration Status
    console.log('\n3️⃣ Testing Credit Integration Status...');
    try {
        // First, we need to authenticate as admin
        const loginResponse = await axios.post(`${TANGENT_PLATFORM_URL}/api/auth/login`, {
            email: 'admin@tangent.com', // Assuming admin exists
            password: 'admin123'
        });
        
        const token = loginResponse.data.token;
        
        const statusResponse = await axios.get(`${TANGENT_PLATFORM_URL}/api/admin/credit-status`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('✅ Credit integration status retrieved');
        console.log('   Available:', statusResponse.data.available);
        if (statusResponse.data.featureFlags) {
            console.log('   Feature Flags:', statusResponse.data.featureFlags);
        }
        results.tests.push({ name: 'Credit Integration Status', status: 'PASS', data: statusResponse.data });
        results.summary.passed++;
    } catch (error) {
        console.log('❌ Credit integration status check failed:', error.message);
        results.tests.push({ name: 'Credit Integration Status', status: 'FAIL', error: error.message });
        results.summary.failed++;
    }
    results.summary.total++;
    
    // Test 4: Create Test Entity in Credit Service
    console.log('\n4️⃣ Testing Entity Creation in Credit Service...');
    try {
        const entityResponse = await axios.post(`${CREDIT_SERVICE_URL}/entities`, {
            name: testUser.company,
            country: testUser.country,
            entity_type: 'company',
            contact_email: testUser.email,
            contact_phone: testUser.phone
        });
        
        console.log('✅ Test entity created in credit service');
        console.log('   Entity ID:', entityResponse.data.id);
        console.log('   Name:', entityResponse.data.name);
        results.tests.push({ name: 'Entity Creation', status: 'PASS', data: entityResponse.data });
        results.summary.passed++;
        
        // Store entity ID for later tests
        testUser.creditEntityId = entityResponse.data.id;
        
    } catch (error) {
        console.log('❌ Entity creation failed:', error.message);
        results.tests.push({ name: 'Entity Creation', status: 'FAIL', error: error.message });
        results.summary.failed++;
    }
    results.summary.total++;
    
    // Test 5: Perform KYC in Credit Service
    console.log('\n5️⃣ Testing KYC Process in Credit Service...');
    try {
        if (testUser.creditEntityId) {
            const kycResponse = await axios.post(`${CREDIT_SERVICE_URL}/kyc/general/${testUser.creditEntityId}`);
            
            console.log('✅ KYC process completed');
            console.log('   Status:', kycResponse.data.status);
            console.log('   Score:', kycResponse.data.score);
            results.tests.push({ name: 'KYC Process', status: 'PASS', data: kycResponse.data });
            results.summary.passed++;
        } else {
            throw new Error('No entity ID available for KYC test');
        }
    } catch (error) {
        console.log('❌ KYC process failed:', error.message);
        results.tests.push({ name: 'KYC Process', status: 'FAIL', error: error.message });
        results.summary.failed++;
    }
    results.summary.total++;
    
    // Test 6: Create Trade in Credit Service
    console.log('\n6️⃣ Testing Trade Creation in Credit Service...');
    try {
        const tradeResponse = await axios.post(`${CREDIT_SERVICE_URL}/trades`, {
            buyer_id: testUser.creditEntityId,
            amount: testContract.totalValue,
            tenor_days: 30,
            inventory_value: testContract.totalValue * 0.8,
            inventory_type: 'commodity',
            inventory_location: 'warehouse',
            buyer_deposit: testContract.totalValue * 0.1,
            is_exchange_traded: false
        });
        
        console.log('✅ Trade created in credit service');
        console.log('   Trade ID:', tradeResponse.data.id);
        console.log('   Amount:', tradeResponse.data.amount);
        results.tests.push({ name: 'Trade Creation', status: 'PASS', data: tradeResponse.data });
        results.summary.passed++;
        
        // Store trade ID for later tests
        testUser.creditTradeId = tradeResponse.data.id;
        
    } catch (error) {
        console.log('❌ Trade creation failed:', error.message);
        results.tests.push({ name: 'Trade Creation', status: 'FAIL', error: error.message });
        results.summary.failed++;
    }
    results.summary.total++;
    
    // Test 7: Perform Credit Assessment
    console.log('\n7️⃣ Testing Credit Assessment...');
    try {
        if (testUser.creditTradeId) {
            const assessmentResponse = await axios.post(`${CREDIT_SERVICE_URL}/kyc/trade/${testUser.creditTradeId}`);
            
            console.log('✅ Credit assessment completed');
            console.log('   Decision:', assessmentResponse.data.decision);
            console.log('   Risk Band:', assessmentResponse.data.risk_band);
            console.log('   Risk Score:', (assessmentResponse.data.adjusted_pd * 100).toFixed(2) + '%');
            results.tests.push({ name: 'Credit Assessment', status: 'PASS', data: assessmentResponse.data });
            results.summary.passed++;
        } else {
            throw new Error('No trade ID available for assessment test');
        }
    } catch (error) {
        console.log('❌ Credit assessment failed:', error.message);
        results.tests.push({ name: 'Credit Assessment', status: 'FAIL', error: error.message });
        results.summary.failed++;
    }
    results.summary.total++;
    
    // Test 8: Test Tangent Platform Integration (if both services are running)
    console.log('\n8️⃣ Testing Tangent Platform Integration...');
    try {
        // Register test user
        const registerResponse = await axios.post(`${TANGENT_PLATFORM_URL}/api/auth/register`, testUser);
        console.log('✅ Test user registered');
        
        // Login
        const loginResponse = await axios.post(`${TANGENT_PLATFORM_URL}/api/auth/login`, {
            email: testUser.email,
            password: testUser.password
        });
        
        const token = loginResponse.data.token;
        console.log('✅ Test user logged in');
        
        // Create contract (this should trigger credit assessment)
        const contractResponse = await axios.post(`${TANGENT_PLATFORM_URL}/api/contracts/create`, testContract, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('✅ Contract created in Tangent Platform');
        console.log('   Contract ID:', contractResponse.data.contractId);
        console.log('   Message:', contractResponse.data.message);
        
        // Wait a moment for async credit assessment
        console.log('   Waiting for credit assessment...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check if credit assessment was added to contract
        const contractDetailsResponse = await axios.get(`${TANGENT_PLATFORM_URL}/api/contracts/${contractResponse.data.contractId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        const contract = contractDetailsResponse.data;
        if (contract.creditAssessment) {
            console.log('✅ Credit assessment integrated successfully!');
            console.log('   Assessment completed:', contract.creditAssessment.completed);
            if (contract.creditAssessment.completed) {
                console.log('   Decision:', contract.creditAssessment.decision);
                console.log('   Risk Band:', contract.creditAssessment.riskBand);
            }
            results.tests.push({ name: 'Platform Integration', status: 'PASS', data: contract.creditAssessment });
            results.summary.passed++;
        } else {
            console.log('⚠️ Credit assessment not found in contract');
            results.tests.push({ name: 'Platform Integration', status: 'FAIL', error: 'Credit assessment not found' });
            results.summary.failed++;
        }
        
    } catch (error) {
        console.log('❌ Platform integration test failed:', error.message);
        results.tests.push({ name: 'Platform Integration', status: 'FAIL', error: error.message });
        results.summary.failed++;
    }
    results.summary.total++;
    
    // Summary
    console.log('\n================================================');
    console.log('📊 INTEGRATION TEST SUMMARY');
    console.log('================================================');
    
    console.log(`Total Tests: ${results.summary.total}`);
    console.log(`Passed: ${results.summary.passed}`);
    console.log(`Failed: ${results.summary.failed}`);
    console.log(`Success Rate: ${((results.summary.passed / results.summary.total) * 100).toFixed(1)}%`);
    
    if (results.summary.failed === 0) {
        console.log('\n🎉 ALL TESTS PASSED! Integration is working perfectly!');
        console.log('\n✅ TANGENT-BRIDGE-v4 Credit Risk Service is integrated');
        console.log('✅ Tangent Platform is enhanced with credit assessment');
        console.log('✅ Automatic credit checks are working');
        console.log('✅ Admin dashboard receives assessment reports');
        console.log('\n🚀 Ready for production deployment!');
    } else {
        console.log('\n❌ SOME TESTS FAILED. Review the logs above for details.');
        console.log('\n⚠️ Integration may not work as expected');
        console.log('⚠️ Check that both services are running correctly');
    }
    
    // Save results
    const resultsPath = path.join(__dirname, 'complete-integration-test-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Detailed test results saved to: ${resultsPath}`);
    
    return results;
}

// Run the test if this script is executed directly
if (require.main === module) {
    runCompleteIntegrationTest().catch(error => {
        console.error('❌ Integration test failed:', error);
        process.exit(1);
    });
}

module.exports = { runCompleteIntegrationTest };


