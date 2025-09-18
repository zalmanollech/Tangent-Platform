// src/components/WalletStatus.jsx
// Browser-compatible React component
const { useState, useEffect } = React;

function WalletStatus() {
    const [walletData, setWalletData] = useState(null);

    useEffect(() => {
        if (window.useWallet) {
            const data = window.useWallet();
            setWalletData(data);
        }
    }, []);

    if (!walletData) {
        return React.createElement('div', {
            style: {
                padding: '0.5rem 1rem',
                background: '#f3f4f6',
                borderRadius: '8px',
                fontSize: '0.9rem',
                color: '#666'
            }
        }, '🔌 Wallet loading...');
    }

    const { account, shortAccount, isSepolia, networkName, hasProvider } = walletData;

    if (!hasProvider) {
        return React.createElement('div', {
            style: {
                padding: '0.5rem 1rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                fontSize: '0.9rem',
                color: '#991b1b'
            }
        }, '❌ No wallet detected');
    }

    if (!account) {
        return React.createElement('div', {
            style: {
                padding: '0.5rem 1rem',
                background: '#fffbeb',
                border: '1px solid #fed7aa',
                borderRadius: '8px',
                fontSize: '0.9rem',
                color: '#92400e'
            }
        }, '🔗 Wallet disconnected');
    }

    return React.createElement('div', {
        style: {
            padding: '0.5rem 1rem',
            background: isSepolia ? '#dcfce7' : '#fef3c7',
            border: `1px solid ${isSepolia ? '#bbf7d0' : '#fde68a'}`,
            borderRadius: '8px',
            fontSize: '0.9rem',
            color: isSepolia ? '#166534' : '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
        }
    }, [
        React.createElement('span', { key: 'icon' }, '🟢'),
        React.createElement('span', { key: 'account' }, shortAccount),
        React.createElement('span', { 
            key: 'network',
            style: { fontSize: '0.8rem', opacity: 0.8 }
        }, networkName || 'Unknown')
    ]);
}

// Make WalletStatus available globally
window.WalletStatus = WalletStatus;