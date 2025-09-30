const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Deploy TGT and TangentEscrow contracts to Sepolia testnet
 */
async function deployContracts() {
    console.log('🚀 Starting contract deployment to Sepolia testnet...');
    
    const onchainDir = path.join(__dirname, '..', 'onchain');
    
    // Check if hardhat project exists
    if (!fs.existsSync(path.join(onchainDir, 'package.json'))) {
        console.error('❌ Hardhat project not found in onchain directory');
        process.exit(1);
    }
    
    try {
        // Set environment variables for deployment
        const env = {
            ...process.env,
            SEPOLIA_RPC_URL: process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
            SEPOLIA_PRIVATE_KEY: process.env.PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001'
        };
        
        console.log('📝 Environment configured:');
        console.log('- RPC URL:', env.SEPOLIA_RPC_URL);
        console.log('- Network: Sepolia testnet');
        
        // Run deployment
        return new Promise((resolve, reject) => {
            const deployProcess = spawn('npx', ['hardhat', 'run', 'scripts/deploy.js', '--network', 'sepolia'], {
                cwd: onchainDir,
                env: env,
                stdio: 'pipe'
            });
            
            let output = '';
            let errorOutput = '';
            
            deployProcess.stdout.on('data', (data) => {
                const str = data.toString();
                output += str;
                console.log(str.trim());
            });
            
            deployProcess.stderr.on('data', (data) => {
                const str = data.toString();
                errorOutput += str;
                console.error(str.trim());
            });
            
            deployProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Contract deployment completed successfully');
                    
                    // Parse deployment output for contract addresses
                    const tgtMatch = output.match(/TGT deployed: (0x[a-fA-F0-9]{40})/);
                    const escrowMatch = output.match(/Escrow deployed: (0x[a-fA-F0-9]{40})/);
                    
                    const result = {
                        success: true,
                        tgtAddress: tgtMatch ? tgtMatch[1] : null,
                        escrowAddress: escrowMatch ? escrowMatch[1] : null,
                        output: output,
                        network: 'sepolia'
                    };
                    
                    resolve(result);
                } else {
                    console.error(`❌ Deployment failed with exit code ${code}`);
                    reject(new Error(`Deployment failed: ${errorOutput}`));
                }
            });
        });
        
    } catch (error) {
        console.error('❌ Deployment error:', error.message);
        throw error;
    }
}

/**
 * Update config file with deployed contract addresses
 */
function updateConfigWithAddresses(tgtAddress, escrowAddress) {
    const configPath = path.join(__dirname, '..', 'config.env');
    
    try {
        let config = fs.readFileSync(configPath, 'utf8');
        
        // Update TGT address
        if (tgtAddress) {
            config = config.replace(/TGT_ADDRESS=.*/, `TGT_ADDRESS=${tgtAddress}`);
        }
        
        // Update Escrow address
        if (escrowAddress) {
            config = config.replace(/ESCROW_ADDRESS=.*/, `ESCROW_ADDRESS=${escrowAddress}`);
        }
        
        fs.writeFileSync(configPath, config);
        console.log('✅ Config file updated with contract addresses');
        
    } catch (error) {
        console.error('❌ Failed to update config file:', error.message);
    }
}

// Export for use by server
module.exports = {
    deployContracts,
    updateConfigWithAddresses
};

// Allow running as standalone script
if (require.main === module) {
    deployContracts()
        .then(result => {
            console.log('\n🎉 Deployment Summary:');
            console.log('- TGT Address:', result.tgtAddress);
            console.log('- Escrow Address:', result.escrowAddress);
            console.log('- Network: Sepolia');
            
            // Update config file
            if (result.tgtAddress && result.escrowAddress) {
                updateConfigWithAddresses(result.tgtAddress, result.escrowAddress);
            }
        })
        .catch(error => {
            console.error('❌ Deployment failed:', error.message);
            process.exit(1);
        });
}
