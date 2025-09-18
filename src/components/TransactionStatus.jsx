// src/components/TransactionStatus.jsx
// Browser-compatible React component
const { useState, useEffect } = React;

function TransactionStatus({ loading, error, txHash, onClose }) {
    if (!loading && !error && !txHash) return null;

    return React.createElement('div', {
        style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }
    }, React.createElement('div', {
        style: {
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '400px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
        }
    }, [
        React.createElement('div', {
            key: 'header',
            style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem'
            }
        }, [
            React.createElement('h3', {
                key: 'title',
                style: { margin: 0, color: '#333' }
            }, 'Transaction Status'),
            React.createElement('button', {
                key: 'close',
                onClick: onClose,
                style: {
                    background: 'none',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: '#666'
                }
            }, '×')
        ]),
        
        loading && React.createElement('div', {
            key: 'loading',
            style: { marginBottom: '1rem' }
        }, [
            React.createElement('div', {
                key: 'spinner',
                style: {
                    width: '40px',
                    height: '40px',
                    border: '4px solid #f3f4f6',
                    borderTop: '4px solid #3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 1rem'
                }
            }),
            React.createElement('p', {
                key: 'loading-text',
                style: { color: '#666', margin: 0 }
            }, 'Processing transaction...')
        ]),
        
        error && React.createElement('div', {
            key: 'error',
            style: {
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
            }
        }, [
            React.createElement('div', {
                key: 'error-icon',
                style: { fontSize: '2rem', marginBottom: '0.5rem' }
            }, '❌'),
            React.createElement('p', {
                key: 'error-text',
                style: { color: '#991b1b', margin: 0, fontSize: '0.9rem' }
            }, error)
        ]),
        
        txHash && React.createElement('div', {
            key: 'success',
            style: {
                background: '#dcfce7',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
            }
        }, [
            React.createElement('div', {
                key: 'success-icon',
                style: { fontSize: '2rem', marginBottom: '0.5rem' }
            }, '✅'),
            React.createElement('p', {
                key: 'success-text',
                style: { color: '#166534', margin: '0 0 0.5rem', fontWeight: '600' }
            }, 'Transaction Successful!'),
            React.createElement('p', {
                key: 'tx-hash',
                style: {
                    color: '#15803d',
                    margin: 0,
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                    wordBreak: 'break-all'
                }
            }, `TX: ${txHash}`)
        ])
    ]));
}

// Add CSS animation for spinner
if (!document.getElementById('transaction-status-styles')) {
    const style = document.createElement('style');
    style.id = 'transaction-status-styles';
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

// Make TransactionStatus available globally
window.TransactionStatus = TransactionStatus;