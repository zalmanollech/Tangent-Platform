import React from 'react';

function TransactionStatus({ loading, error, txHash, onClose }) {
  if (!loading && !error && !txHash) return null;

  const getStatusColor = () => {
    if (error) return '#dc2626';
    if (txHash) return '#16a34a';
    return '#3b82f6';
  };

  const getStatusText = () => {
    if (error) return 'Transaction Failed';
    if (txHash) return 'Transaction Confirmed';
    return 'Processing Transaction...';
  };

  const getStatusIcon = () => {
    if (error) return '❌';
    if (txHash) return '✅';
    return '⏳';
  };

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      background: 'white',
      border: `2px solid ${getStatusColor()}`,
      borderRadius: 12,
      padding: 16,
      minWidth: 300,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 1000
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{getStatusIcon()}</span>
          <span style={{ fontWeight: 600, color: getStatusColor() }}>
            {getStatusText()}
          </span>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 18,
              cursor: 'pointer',
              color: '#666'
            }}
          >
            ×
          </button>
        )}
      </div>

      {loading && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ 
            width: '100%', 
            height: 4, 
            background: '#e5e7eb', 
            borderRadius: 2,
            overflow: 'hidden'
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)',
              animation: 'pulse 2s ease-in-out infinite'
            }} />
          </div>
        </div>
      )}

      {error && (
        <div style={{ 
          color: '#dc2626', 
          fontSize: 14, 
          background: '#fef2f2', 
          padding: 8, 
          borderRadius: 6,
          border: '1px solid #fecaca',
          marginBottom: 8
        }}>
          {error}
        </div>
      )}

      {txHash && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Transaction Hash:</div>
          <div style={{ 
            fontFamily: 'monospace', 
            fontSize: 12, 
            background: '#f8f9fa', 
            padding: 6, 
            borderRadius: 4,
            wordBreak: 'break-all'
          }}>
            {txHash}
          </div>
          <a 
            href={`https://sepolia.etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              marginTop: 4,
              fontSize: 12,
              color: '#3b82f6',
              textDecoration: 'none'
            }}
          >
            View on Etherscan →
          </a>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default TransactionStatus;
