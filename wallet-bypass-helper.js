/**
 * TANGENT PLATFORM WALLET BYPASS FOR TESTING
 * 
 * This script helps you bypass the wallet connection issue
 * by providing test wallet addresses and credentials.
 */

console.log('🔧 TANGENT PLATFORM WALLET BYPASS');
console.log('==================================');
console.log('');
console.log('You can use any of these test wallet addresses:');
console.log('');

// Test wallet addresses
const testWallets = [
    {
        address: 'tgt_test_wallet_001',
        password: 'test123',
        balance: 10000,
        description: 'Primary test wallet'
    },
    {
        address: 'tgt_test_wallet_002', 
        password: 'test123',
        balance: 5000,
        description: 'Secondary test wallet'
    },
    {
        address: 'tgt_demo_user_wallet',
        password: 'demo123',
        balance: 25000,
        description: 'Demo user wallet'
    }
];

testWallets.forEach((wallet, index) => {
    console.log(`${index + 1}. ${wallet.description}`);
    console.log(`   Address: ${wallet.address}`);
    console.log(`   Password: ${wallet.password}`);
    console.log(`   Balance: $${wallet.balance.toLocaleString()} TGT`);
    console.log('');
});

console.log('📋 INSTRUCTIONS:');
console.log('================');
console.log('');
console.log('1. Go to the wallet connection page');
console.log('2. Select "I Have a TGT Wallet"');
console.log('3. Use any of the addresses above');
console.log('4. Use the corresponding password');
console.log('5. Click "Connect Wallet & Continue"');
console.log('');
console.log('✅ This will allow you to proceed to the dashboard!');
console.log('');
console.log('🔄 ALTERNATIVE: If you have an Ethereum address,');
console.log('   you can now use it directly (it will be converted to TGT format)');
console.log('');
console.log('   Example Ethereum address: 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6');
console.log('   Will be converted to: tgt_742d35cc6634c0532925a3b8d4c9db96c4b4d8b6');
console.log('');

// Export for potential use in other scripts
module.exports = { testWallets };


