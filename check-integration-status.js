/**
 * Check if Credit Integration is Working
 * 
 * Run this in your browser console to check the status
 */

async function checkCreditIntegrationStatus() {
    console.log('🔍 Checking Credit Integration Status...');
    
    // Check 1: Look for credit integration messages in console
    console.log('\n📋 Check 1: Console Messages');
    console.log('Look for messages like:');
    console.log('  - "🔗 Starting credit risk assessment for contract:"');
    console.log('  - "✅ Credit assessment completed:"');
    console.log('  - "⚠️ Credit integration not available"');
    
    // Check 2: Test the API endpoint
    console.log('\n📋 Check 2: API Endpoint Test');
    try {
        const response = await fetch('/api/admin/credit-status');
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Credit Integration API Response:', data);
            if (data.available) {
                console.log('✅ Credit integration is available!');
            } else {
                console.log('⚠️ Credit integration not available');
            }
        } else {
            console.log('❌ API endpoint not accessible');
        }
    } catch (error) {
        console.log('❌ Cannot connect to API:', error.message);
    }
    
    // Check 3: Look for credit assessment in contract
    console.log('\n📋 Check 3: Check Contract for Credit Assessment');
    try {
        // Try to get a contract and check if it has credit assessment data
        const contracts = localStorage.getItem('contracts') || '[]';
        const contractList = JSON.parse(contracts);
        
        if (contractList.length > 0) {
            console.log('Found contracts:', contractList.length);
            contractList.forEach((contract, index) => {
                if (contract.creditAssessment) {
                    console.log(`✅ Contract ${index} has credit assessment:`, contract.creditAssessment);
                }
            });
        } else {
            console.log('No contracts found in localStorage');
        }
    } catch (error) {
        console.log('Could not check contracts:', error.message);
    }
    
    // Check 4: Server Logs Check
    console.log('\n📋 Check 4: Check Server Terminal');
    console.log('Look at the server terminal where Tangent Platform is running');
    console.log('You should see messages like:');
    console.log('  - "✅ TANGENT-BRIDGE-v4 Credit Integration loaded successfully"');
    console.log('  - "🔗 Starting credit risk assessment for contract:"');
    
    console.log('\n🎯 SUMMARY:');
    console.log('1. Check server terminal logs for integration messages');
    console.log('2. Check browser console (F12) for credit assessment messages');
    console.log('3. Credit assessment runs asynchronously after contract creation');
    console.log('4. Check /api/admin/credit-reports for assessment reports');
}

// Run the check
checkCreditIntegrationStatus();
