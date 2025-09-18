// src/components/EnhancedWalletConnect.jsx
// Browser-compatible React component
const { useState, useEffect } = React;

function EnhancedWalletConnect() {
    const [walletData, setWalletData] = useState(null);
    const [connecting, setConnecting] = useState(false);

    useEffect(() => {
        if (window.useWallet) {
            const data = window.useWallet();
            setWalletData(data);
        }
    }, []);

    const handleConnect = async () => {
        if (!walletData || !walletData.connect) return;
        
        setConnecting(true);
        try {
            await walletData.connect();
            // Refresh wallet data
            const newData = window.useWallet();
            setWalletData(newData);
        } catch (error) {
            console.error('Connection failed:', error);
        } finally {
            setConnecting(false);
        }
    };

    if (!walletData) {
        return React.createElement('div', {
            style: { padding: '1rem', textAlign: 'center' }
        }, 'Loading wallet connection...');
    }

    const { hasProvider, account, error } = walletData;

    if (!hasProvider) {
        return React.createElement('div', {
            style: {
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '12px',
                padding: '1.5rem',
                textAlign: 'center'
            }
        }, [
            React.createElement('h3', {
                key: 'title',
                style: { margin: '0 0 1rem', color: '#991b1b' }
            }, '🦊 MetaMask Required'),
            React.createElement('p', {
                key: 'description',
                style: { margin: '0 0 1rem', color: '#7f1d1d' }
            }, 'Please install MetaMask to connect your wallet.'),
            React.createElement('a', {
                key: 'install-link',
                href: 'https://metamask.io/download/',
                target: '_blank',
                rel: 'noopener noreferrer',
                style: {
                    background: '#f97316',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: '600',
                    display: 'inline-block'
                }
            }, 'Install MetaMask')
        ]);
    }

    if (account) {
        return React.createElement('div', {
            style: {
                background: '#dcfce7',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                padding: '1.5rem',
                textAlign: 'center'
            }
        }, [
            React.createElement('h3', {
                key: 'title',
                style: { margin: '0 0 1rem', color: '#166534' }
            }, '✅ Wallet Connected'),
            React.createElement('p', {
                key: 'account',
                style: { 
                    margin: '0',
                    color: '#15803d',
                    fontFamily: 'monospace',
                    background: '#f0fdf4',
                    padding: '0.5rem',
                    borderRadius: '6px'
                }
            }, walletData.shortAccount)
        ]);
    }

    return React.createElement('div', {
        style: {
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '12px',
            padding: '1.5rem',
            textAlign: 'center'
        }
    }, [
        React.createElement('h3', {
            key: 'title',
            style: { margin: '0 0 1rem', color: '#0c4a6e' }
        }, '🔗 Connect Wallet'),
        React.createElement('p', {
            key: 'description',
            style: { margin: '0 0 1rem', color: '#075985' }
        }, 'Connect your MetaMask wallet to access blockchain features.'),
        React.createElement('button', {
            key: 'connect-button',
            onClick: handleConnect,
            disabled: connecting,
            style: {
                background: connecting ? '#9ca3af' : '#0ea5e9',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: connecting ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s'
            }
        }, connecting ? '🔄 Connecting...' : '🦊 Connect MetaMask'),
        error && React.createElement('div', {
            key: 'error',
            style: {
                marginTop: '1rem',
                color: '#dc2626',
                fontSize: '0.9rem',
                background: '#fef2f2',
                padding: '0.5rem',
                borderRadius: '6px'
            }
        }, `Error: ${error}`)
    ]);
}

// Make EnhancedWalletConnect available globally
window.EnhancedWalletConnect = EnhancedWalletConnect;