# Blockchain Configuration Guide

## Current Status
✅ Blockchain code is ready and functional
⚠️ Currently in **simulation mode** (needs configuration)

## To Enable Blockchain

### 1. Set Environment Variable
```bash
BLOCKCHAIN_ENABLED=true
```

### 2. Configure Blockchain Settings

The blockchain service reads from `config.blockchain` object. You need to set these environment variables or configure in your config file:

#### Required Settings:
- `SEPOLIA_RPC_URL` - Ethereum Sepolia testnet RPC endpoint
  - Example: `https://sepolia.infura.io/v3/YOUR_PROJECT_ID`
  - Or: `https://rpc.sepolia.org`
  
- `SEPOLIA_PRIVATE_KEY` - Private key for signing transactions (with 0x prefix)
  - Example: `0x1234567890abcdef...`
  
- `TGT_CONTRACT_ADDRESS` - Deployed TGT token contract address
  - Example: `0x1234567890abcdef...`
  
- `ESCROW_CONTRACT_ADDRESS` - Deployed escrow contract address
  - Example: `0xabcdef1234567890...`

### 3. Configuration File Structure

The `lib/blockchain.js` expects a config object with this structure:

```javascript
config.blockchain = {
  sepoliaRpcUrl: process.env.SEPOLIA_RPC_URL,
  privateKey: process.env.SEPOLIA_PRIVATE_KEY,
  tgtAddress: process.env.TGT_CONTRACT_ADDRESS,
  escrowAddress: process.env.ESCROW_CONTRACT_ADDRESS
}
```

### 4. Deploy Contracts (if not already deployed)

If contracts are not deployed, use the deployment script:

```bash
cd onchain
npm install
npx hardhat run scripts/deploy.js --network sepolia
```

This will deploy:
- TGT Token Contract
- TangentEscrow Contract

### 5. Verify Configuration

After setting environment variables, restart the server. You should see:

```
[INFO] Initializing blockchain integration...
[INFO] Connected to blockchain network { chainId: 11155111, name: 'sepolia' }
[INFO] Blockchain signer initialized { address: '0x...' }
[INFO] TGT contract initialized { address: '0x...' }
[INFO] Escrow contract initialized { address: '0x...' }
[INFO] Blockchain service initialized successfully
```

### 6. Railway Deployment

For Railway deployment, add these environment variables in Railway dashboard:
- `BLOCKCHAIN_ENABLED=true`
- `SEPOLIA_RPC_URL=your_rpc_url`
- `SEPOLIA_PRIVATE_KEY=your_private_key`
- `TGT_CONTRACT_ADDRESS=your_tgt_address`
- `ESCROW_CONTRACT_ADDRESS=your_escrow_address`

### Current Behavior

- **Simulation Mode**: When blockchain is not configured, all operations are simulated
- **Real Mode**: When configured, transactions are sent to Sepolia testnet
- **Fallback**: If blockchain fails, operations automatically fall back to simulation

### Testing

Once enabled, test with:
1. Create a contract
2. Make a deposit (will use blockchain if `useBlockchain=true`)
3. Check `/admin/blockchain` page for transaction hashes
4. View transactions on Sepolia Etherscan


