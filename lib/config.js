// Configuration module for blockchain and other services
// Reads from environment variables

module.exports = {
    blockchain: {
        sepoliaRpcUrl: process.env.SEPOLIA_RPC_URL || null,
        privateKey: process.env.SEPOLIA_PRIVATE_KEY || process.env.BLOCKCHAIN_PRIVATE_KEY || null,
        tgtAddress: process.env.TGT_CONTRACT_ADDRESS || process.env.TGT_ADDRESS || null,
        escrowAddress: process.env.ESCROW_CONTRACT_ADDRESS || process.env.ESCROW_ADDRESS || null,
        network: process.env.BLOCKCHAIN_NETWORK || 'sepolia'
    }
};


