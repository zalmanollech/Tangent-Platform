import React, { useState, useEffect } from 'react';
import { useWallet } from '../wallet';

function WalletConnect() {
  const { hasProvider, account, shortAccount, isSepolia, error, connect, networkName } = useWallet();
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);

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

  if (!hasProvider) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#666', fontSize: 14 }}>MetaMask not found</span>
        <button 
          onClick={() => window.open('https://metamask.io/download/', '_blank')}
          style={{
            padding: '8px 12px',
            background: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 12
          }}
        >
          Install MetaMask
        </button>
      </div>
    );
  }

  if (!account) {
    return (
      <button 
        onClick={connect}
        disabled={loading}
        style={{
          padding: '10px 16px',
          background: '#111',
          color: 'white',
          border: 'none',
          borderRadius: 12,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
      >
        {loading ? 'Connecting...' : 'Connect Wallet'}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {/* Network Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div 
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isSepolia ? '#16a34a' : '#f59e0b'
          }}
        />
        <span style={{ fontSize: 12, color: '#666' }}>
          {isSepolia ? 'Sepolia' : 'Wrong Network'}
        </span>
      </div>

      {/* Account Info */}
      <div style={{ 
        background: '#f8f9fa', 
        border: '1px solid #e9ecef', 
        borderRadius: 12, 
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        <div style={{ fontSize: 12, color: '#666' }}>
          {account.slice(0, 6)}...{account.slice(-4)}
        </div>
        {balance && (
          <div style={{ fontSize: 12, color: '#666' }}>
            {formatBalance(balance)} ETH
          </div>
        )}
      </div>

      {/* Switch Network Button */}
      {!isSepolia && (
        <button 
          onClick={connect}
          style={{
            padding: '6px 12px',
            background: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 12
          }}
        >
          Switch to Sepolia
        </button>
      )}

      {/* Error Display */}
      {error && (
        <div style={{ 
          color: '#dc2626', 
          fontSize: 12, 
          background: '#fef2f2', 
          padding: '4px 8px', 
          borderRadius: 6,
          border: '1px solid #fecaca'
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default WalletConnect;
