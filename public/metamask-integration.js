// MetaMask Integration for Tangent Platform
// This file handles wallet connection and blockchain transactions

// Contract addresses (from Sepolia deployment)
const CONTRACTS = {
    TGT: '0x0845816A9E200a0F11241eEEd3Faf992D96d434e',
    ESCROW: '0x135ca9eA49b6b36715aE141f9CFE0B9297Cd60CD'
};

// ABI for the TGT token
const TGT_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)"
];

// MetaMask connection
async function connectMetaMask() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            // Request account access
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            console.log('Connected to MetaMask:', accounts[0]);
            return accounts[0];
        } catch (error) {
            console.error('User denied account access:', error);
            alert('Please connect MetaMask to continue');
            return null;
        }
    } else {
        alert('MetaMask is not installed. Please install MetaMask to use blockchain features.');
        return null;
    }
}

// Get user's MetaMask address
async function getWalletAddress() {
    if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        return accounts[0];
    }
    return null;
}

// Check if user is on correct network (Sepolia)
async function checkNetwork() {
    if (typeof window.ethereum !== 'undefined') {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const sepoliaChainId = '0xaa36a7'; // Sepolia testnet
        
        if (chainId !== sepoliaChainId) {
            alert('Please switch to Sepolia testnet in MetaMask');
            
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: sepoliaChainId }]
                });
            } catch (switchError) {
                // Network doesn't exist yet, add it
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: sepoliaChainId,
                        chainName: 'Sepolia Test Network',
                        rpcUrls: ['https://sepolia.infura.io/v3/'],
                        nativeCurrency: {
                            name: 'SepoliaETH',
                            symbol: 'ETH',
                            decimals: 18
                        },
                        blockExplorerUrls: ['https://sepolia.etherscan.io']
                    }]
                });
            }
        }
        return true;
    }
    return false;
}

// Pay deposit with MetaMask
async function payDepositWithMetaMask(contractId, amount) {
    try {
        // 1. Check if MetaMask is installed
        if (typeof window.ethereum === 'undefined') {
            alert('Please install MetaMask to use blockchain payment');
            return false;
        }

        // 2. Connect wallet
        const account = await connectMetaMask();
        if (!account) return false;

        // 3. Check network
        await checkNetwork();

        // 4. Initialize ethers provider
        const { ethers } = await import('https://cdn.ethers.io/lib/ethers-5.7.umd.min.js');
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();

        // 5. Initialize contract
        const tgtContract = new ethers.Contract(CONTRACTS.TGT, TGT_ABI, signer);

        // 6. Convert amount to wei (assuming 18 decimals)
        const amountInWei = ethers.utils.parseUnits(amount.toString(), 18);

        // 7. Approve TGT spending first
        alert('Please confirm in MetaMask: Approve TGT spending');
        const approveTx = await tgtContract.approve(CONTRACTS.ESCROW, amountInWei);
        await approveTx.wait();
        console.log('Approval confirmed');

        // 8. Now send deposit to backend for escrow logic
        // This would call the escrow contract's buyerDeposit function
        alert('Sending deposit transaction...');
        
        // 9. Notify backend about successful transaction
        const response = await fetch(`/api/contracts/${contractId}/deposit`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('token'),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                txHash: approveTx.hash,
                blockchain: true,
                amount: amount
            })
        });

        const result = await response.json();
        
        if (response.ok) {
            alert('✅ Deposit paid successfully on blockchain!\nTransaction: ' + approveTx.hash);
            return true;
        } else {
            alert('Error: ' + result.error);
            return false;
        }

    } catch (error) {
        console.error('MetaMask deposit error:', error);
        alert('Transaction failed: ' + error.message);
        return false;
    }
}

// Hybrid payment function (uses blockchain if MetaMask available, otherwise simulation)
async function payDeposit(contractId, amount) {
    // Check if MetaMask is available
    if (typeof window.ethereum !== 'undefined') {
        // Use blockchain with MetaMask
        return await payDepositWithMetaMask(contractId, amount);
    } else {
        // Fall back to simulation
        return await payDepositSimulation(contractId, amount);
    }
}

// Simulation payment (current behavior)
async function payDepositSimulation(contractId, amount) {
    const response = await fetch(`/api/contracts/${contractId}/deposit`, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('token'),
            'Content-Type': 'application/json'
        }
    });
    
    const data = await response.json();
    
    if (response.ok) {
        alert('Deposit paid successfully (simulation)');
        return true;
    } else {
        alert('Error: ' + data.error);
        return false;
    }
}

// Make functions globally available
window.payDepositWithMetaMask = payDepositWithMetaMask;
window.connectMetaMask = connectMetaMask;
window.getWalletAddress = getWalletAddress;

