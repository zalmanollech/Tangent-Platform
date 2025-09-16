import React, { useState, useEffect } from 'react';
import { useWallet } from '../wallet';

function WalletStatus() {
  const { hasProvider, account, isSepolia, error, connect } = useWallet();
  const [balance, setBalance] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

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

  const getStatusColor = () => {
    if (!hasProvider) return '#6b7280';
    if (!account) return '#f59e0b';
    if (isSepolia) return '#16a34a';
    return '#ef4444';
  };

  const getStatusText = () => {
    if (!hasProvider) return 'No Wallet';
    if (!account) return 'Not Connected';
    if (isSepolia) return 'Connected';
    return 'Wrong Network';
  };

  const getStatusIcon = () => {
    if (!hasProvider) return '❌';
    if (!account) return '🔌';
    if (isSepolia) return '✅';
    return '⚠️';
  };

  if (!hasProvider) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: 'rgba(107, 114, 128, 0.1)',
        border: '1px solid rgba(107, 114, 128, 0.3)',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 500,
        color: '#6b7280'
      }}>
        <span>{getStatusIcon()}</span>
        <span>{getStatusText()}</span>
      </div>
    );
  }

  if (!account) {
    return (
      <button
        onClick={connect}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          border: 'none',
          borderRadius: 20,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          color: 'white',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
        }}
        onMouseOver={(e) => e.target.style.transform = 'translateY(-1px)'}
        onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
      >
        <span>🔌</span>
        <span>Connect Wallet</span>
      </button>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          background: isSepolia 
            ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' 
            : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          border: 'none',
          borderRadius: 20,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          color: 'white',
          transition: 'all 0.2s ease',
          boxShadow: isSepolia 
            ? '0 2px 4px rgba(22, 163, 74, 0.3)' 
            : '0 2px 4px rgba(239, 68, 68, 0.3)'
        }}
        onMouseOver={(e) => e.target.style.transform = 'translateY(-1px)'}
        onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
      >
        <span>{getStatusIcon()}</span>
        <span>{getStatusText()}</span>
        <svg 
          width="12" 
          height="12" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          style={{ 
            transform: showDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
          }}
        >
          <polyline points="6,9 12,15 18,9"/>
        </svg>
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 8,
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          zIndex: 1000,
          minWidth: 280,
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 8
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 14,
                fontWeight: 700
              }}>
                {account.slice(2, 4).toUpperCase()}
              </div>
              <div>
                <div style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#1f2937',
                  fontFamily: 'monospace'
                }}>
                  {account.slice(0, 6)}...{account.slice(-4)}
                </div>
                <div style={{
                  fontSize: 12,
                  color: '#6b7280'
                }}>
                  {getStatusText()}
                </div>
              </div>
            </div>
            {balance && (
              <div style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#1f2937'
              }}>
                {formatBalance(balance)} ETH
              </div>
            )}
          </div>

          {/* Menu Items */}
          <div style={{ padding: '8px 0' }}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(account);
                setShowDropdown(false);
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: 14,
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                transition: 'background 0.2s ease'
              }}
              onMouseOver={(e) => e.target.style.background = '#f9fafb'}
              onMouseOut={(e) => e.target.style.background = 'none'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copy Address
            </button>

            <button
              onClick={() => {
                window.open(`https://sepolia.etherscan.io/address/${account}`, '_blank');
                setShowDropdown(false);
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: 14,
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                transition: 'background 0.2s ease'
              }}
              onMouseOver={(e) => e.target.style.background = '#f9fafb'}
              onMouseOut={(e) => e.target.style.background = 'none'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15,3 21,3 21,9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              View on Etherscan
            </button>

            {!isSepolia && (
              <button
                onClick={() => {
                  connect();
                  setShowDropdown(false);
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'background 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#f9fafb'}
                onMouseOut={(e) => e.target.style.background = 'none'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                </svg>
                Switch to Sepolia
              </button>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {showDropdown && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}

export default WalletStatus;
