// src/wallet.js
// Browser-compatible wallet utilities
const { useState, useEffect } = React;

// Mock Web3 provider for development
const mockProvider = {
    request: async ({ method, params }) => {
        console.log('Mock wallet request:', method, params);
        
        if (method === 'eth_requestAccounts') {
            return ['0x1234567890123456789012345678901234567890'];
        }
        if (method === 'eth_chainId') {
            return '0xaa36a7'; // Sepolia testnet
        }
        if (method === 'wallet_switchEthereumChain') {
            return true;
        }
        return null;
    }
};

// Wallet hook implementation
function useWallet() {
    const [hasProvider, setHasProvider] = useState(false);
    const [account, setAccount] = useState(null);
    const [chainId, setChainId] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Check for MetaMask
        if (window.ethereum) {
            setHasProvider(true);
        } else {
            console.log('MetaMask not detected, using mock wallet');
            setHasProvider(true); // Use mock for development
        }
    }, []);

    const connect = async () => {
        try {
            setError(null);
            const provider = window.ethereum || mockProvider;
            
            const accounts = await provider.request({
                method: 'eth_requestAccounts'
            });
            
            if (accounts.length > 0) {
                setAccount(accounts[0]);
                
                const chainId = await provider.request({
                    method: 'eth_chainId'
                });
                setChainId(chainId);
            }
        } catch (err) {
            console.error('Wallet connection error:', err);
            setError(err.message || 'Failed to connect wallet');
        }
    };

    const shortAccount = account ? 
        `${account.slice(0, 6)}...${account.slice(-4)}` : null;
    
    const isSepolia = chainId === '0xaa36a7';
    const networkName = isSepolia ? 'Sepolia' : chainId ? 'Unknown' : null;

    return {
        hasProvider,
        account,
        shortAccount,
        isSepolia,
        error,
        connect,
        networkName,
        chainId
    };
}

// Make useWallet available globally
window.useWallet = useWallet;