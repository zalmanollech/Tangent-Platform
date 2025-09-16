import React, { useState, useEffect } from 'react';
import { useWallet } from '../wallet';

function EnhancedWalletConnect() {
  const { hasProvider, account, shortAccount, isSepolia, error, connect, networkName } = useWallet();
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showFullAddress, setShowFullAddress] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (account && isSepolia) {
      fetchBalance();
    }
  }, [account, isSepolia]);

  const fetchBalance = async () => {
    if (!window.ethereum || !account) return;
    try {
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const balance = await provider.getBalance(account);
      setBalance(balance);
    } catch (e) {
      console.error('Failed to fetch balance:', e);
    }
  };

  const formatBalance = (balance) => {
    if (!balance) return '0.00';
    return (Number(balance) / 1e18).toFixed(4);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const getNetworkBadgeColor = () => {
    if (!hasProvider) return '#6b7280';
    if (isSepolia) return '#16a34a';
    return '#f59e0b';
  };

  const getNetworkBadgeText = () => {
    if (!hasProvider) return 'No Wallet';
    if (isSepolia) return 'Sepolia';
    return 'Wrong Network';
  };

  if (!hasProvider) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12,
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
        border: '1px solid #374151',
        borderRadius: 16,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: getNetworkBadgeColor()
        }} />
        <span style={{ color: '#9ca3af', fontSize: 14, fontWeight: 500 }}>
          MetaMask not found
        </span>
        <button 
          onClick={() => window.open('https://metamask.io/download/', '_blank')}
          style={{
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)'
          }}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-1px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          Install MetaMask
        </button>
      </div>
    );
  }

  if (!account) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
        border: '1px solid #374151',
        borderRadius: 16,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#6b7280'
        }} />
        <span style={{ color: '#9ca3af', fontSize: 14, fontWeight: 500 }}>
          Wallet not connected
        </span>
        <button 
          onClick={connect}
          disabled={loading}
          style={{
            padding: '10px 20px',
            background: loading 
              ? '#6b7280' 
              : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
            boxShadow: loading 
              ? 'none' 
              : '0 4px 6px -1px rgba(59, 130, 246, 0.3)'
          }}
          onMouseOver={(e) => !loading && (e.target.style.transform = 'translateY(-1px)')}
          onMouseOut={(e) => !loading && (e.target.style.transform = 'translateY(0)')}
        >
          {loading ? (
            <>
              <div style={{
                width: 16,
                height: 16,
                border: '2px solid #ffffff40',
                borderTop: '2px solid #ffffff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Connecting...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3 4-3 9-3 9 1.34 9 3z"/>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
              </svg>
              Connect Wallet
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 16,
      padding: '16px 20px',
      background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
      border: '1px solid #374151',
      borderRadius: 20,
      boxShadow: '0 8px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
    }}>
      {/* Network Status Badge */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 8,
        padding: '8px 12px',
        background: isSepolia ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
        border: `1px solid ${isSepolia ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
        borderRadius: 12
      }}>
        <div 
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: getNetworkBadgeColor(),
            boxShadow: `0 0 8px ${getNetworkBadgeColor()}40`
          }}
        />
        <span style={{ 
          fontSize: 13, 
          fontWeight: 600,
          color: isSepolia ? '#22c55e' : '#f59e0b'
        }}>
          {getNetworkBadgeText()}
        </span>
      </div>

      {/* Account Info */}
      <div style={{ 
        background: 'rgba(255, 255, 255, 0.05)', 
        border: '1px solid rgba(255, 255, 255, 0.1)', 
        borderRadius: 16, 
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minWidth: 200
      }}>
        {/* Account Avatar */}
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 12,
          fontWeight: 700
        }}>
          {account.slice(2, 4).toUpperCase()}
        </div>

        {/* Account Details */}
        <div style={{ flex: 1 }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            marginBottom: 2
          }}>
            <span style={{ 
              fontSize: 14, 
              fontWeight: 600,
              color: '#f9fafb',
              cursor: 'pointer',
              fontFamily: 'monospace'
            }}
            onClick={() => setShowFullAddress(!showFullAddress)}
            >
              {showFullAddress ? account : `${account.slice(0, 6)}...${account.slice(-4)}`}
            </span>
            <button
              onClick={() => copyToClipboard(account)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s ease'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
              onMouseOut={(e) => e.target.style.background = 'none'}
            >
              {copySuccess ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              )}
            </button>
          </div>
          {balance && (
            <div style={{ 
              fontSize: 12, 
              color: '#9ca3af',
              fontWeight: 500
            }}>
              {formatBalance(balance)} ETH
            </div>
          )}
        </div>
      </div>

      {/* Switch Network Button */}
      {!isSepolia && (
        <button 
          onClick={connect}
          style={{
            padding: '10px 16px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.3)'
          }}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-1px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
          </svg>
          Switch to Sepolia
        </button>
      )}

      {/* Error Display */}
      {error && (
        <div style={{ 
          color: '#dc2626', 
          fontSize: 12, 
          background: 'rgba(220, 38, 38, 0.1)', 
          padding: '8px 12px', 
          borderRadius: 10,
          border: '1px solid rgba(220, 38, 38, 0.2)',
          fontWeight: 500
        }}>
          {error}
        </div>
      )}

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default EnhancedWalletConnect;
