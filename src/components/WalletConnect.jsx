// Basic wallet connect component
const { useState } = React;

function WalletConnect() {
    return React.createElement('button', {
        style: {
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            cursor: 'pointer'
        }
    }, 'Connect Wallet');
}

window.WalletConnect = WalletConnect;