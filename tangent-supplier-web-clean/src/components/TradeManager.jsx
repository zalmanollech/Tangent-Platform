import React, { useState, useEffect } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { useWallet } from '../wallet';

function TradeManager({ userRole }) {
  const { account, isSepolia } = useWallet();
  const {
    loading,
    error,
    txHash,
    createTrade,
    buyerDeposit,
    acceptDocsAndIssueKey,
    payFinal,
    claimDocs,
    getTGTBalance,
    getTGTAllowance,
    approveTGT,
    formatUnits,
    parseUnits,
    hashString,
    TGT_ADDRESS,
    ESCROW_ADDRESS
  } = useTransactions();

  const [trades, setTrades] = useState([]);
  const [tgtBalance, setTgtBalance] = useState('0');
  const [allowance, setAllowance] = useState('0');
  const [newTrade, setNewTrade] = useState({
    supplier: '',
    buyer: '',
    amount: '',
    depositPct: 30,
    financePct: 70
  });
  const [activeTrade, setActiveTrade] = useState(null);
  const [tradeKey, setTradeKey] = useState('');

  useEffect(() => {
    if (account && isSepolia) {
      loadBalances();
    }
  }, [account, isSepolia]);

  const loadBalances = async () => {
    try {
      const balance = await getTGTBalance(account);
      const allowanceAmount = await getTGTAllowance(account, ESCROW_ADDRESS);
      setTgtBalance(formatUnits(balance, 2)); // TGT has 2 decimals
      setAllowance(formatUnits(allowanceAmount, 2));
    } catch (err) {
      console.error('Failed to load balances:', err);
    }
  };

  const handleCreateTrade = async () => {
    if (!newTrade.supplier || !newTrade.buyer || !newTrade.amount) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const amount = parseUnits(newTrade.amount, 2);
      await createTrade(
        newTrade.supplier,
        newTrade.buyer,
        amount,
        newTrade.depositPct,
        newTrade.financePct
      );
      setNewTrade({ supplier: '', buyer: '', amount: '', depositPct: 30, financePct: 70 });
      loadBalances();
    } catch (err) {
      console.error('Failed to create trade:', err);
    }
  };

  const handleBuyerDeposit = async (tradeId, amount) => {
    try {
      // First approve if needed
      const requiredAmount = parseUnits(amount, 2);
      const currentAllowance = await getTGTAllowance(account, ESCROW_ADDRESS);
      
      if (currentAllowance < requiredAmount) {
        await approveTGT(ESCROW_ADDRESS, requiredAmount);
        await loadBalances();
      }

      await buyerDeposit(tradeId, requiredAmount);
      loadBalances();
    } catch (err) {
      console.error('Failed to make deposit:', err);
    }
  };

  const handleIssueKey = async (tradeId) => {
    if (!tradeKey) {
      alert('Please enter a trade key');
      return;
    }

    try {
      const keyHash = hashString(tradeKey);
      const finalDeadline = Math.floor(Date.now() / 1000) + (14 * 24 * 60 * 60); // 14 days
      await acceptDocsAndIssueKey(tradeId, keyHash, finalDeadline);
      setTradeKey('');
    } catch (err) {
      console.error('Failed to issue key:', err);
    }
  };

  const handlePayFinal = async (tradeId, amount) => {
    try {
      const finalAmount = parseUnits(amount, 2);
      await payFinal(tradeId, finalAmount);
      loadBalances();
    } catch (err) {
      console.error('Failed to pay final amount:', err);
    }
  };

  const handleClaimDocs = async (tradeId, key) => {
    try {
      await claimDocs(tradeId, key);
    } catch (err) {
      console.error('Failed to claim docs:', err);
    }
  };

  if (!account || !isSepolia) {
    return (
      <div style={{ 
        padding: 20, 
        textAlign: 'center', 
        color: '#666',
        background: '#f8f9fa',
        borderRadius: 12,
        border: '1px solid #e9ecef'
      }}>
        Please connect your wallet and switch to Sepolia network to manage trades.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Balance Display */}
      <div style={{ 
        background: '#f8f9fa', 
        border: '1px solid #e9ecef', 
        borderRadius: 12, 
        padding: 16 
      }}>
        <h3 style={{ margin: '0 0 12px 0' }}>Wallet Status</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#666' }}>TGT Balance</div>
            <div style={{ fontWeight: 600 }}>{tgtBalance} TGT</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#666' }}>Escrow Allowance</div>
            <div style={{ fontWeight: 600 }}>{allowance} TGT</div>
          </div>
        </div>
      </div>

      {/* Create Trade (Admin only) */}
      {userRole === 'admin' && (
        <div style={{ 
          background: 'white', 
          border: '1px solid #e9ecef', 
          borderRadius: 12, 
          padding: 16 
        }}>
          <h3 style={{ margin: '0 0 16px 0' }}>Create New Trade</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input
                type="text"
                placeholder="Supplier Address"
                value={newTrade.supplier}
                onChange={(e) => setNewTrade({ ...newTrade, supplier: e.target.value })}
                style={{ padding: 10, border: '1px solid #ddd', borderRadius: 8 }}
              />
              <input
                type="text"
                placeholder="Buyer Address"
                value={newTrade.buyer}
                onChange={(e) => setNewTrade({ ...newTrade, buyer: e.target.value })}
                style={{ padding: 10, border: '1px solid #ddd', borderRadius: 8 }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <input
                type="number"
                placeholder="Trade Amount (TGT)"
                value={newTrade.amount}
                onChange={(e) => setNewTrade({ ...newTrade, amount: e.target.value })}
                style={{ padding: 10, border: '1px solid #ddd', borderRadius: 8 }}
              />
              <input
                type="number"
                placeholder="Deposit %"
                value={newTrade.depositPct}
                onChange={(e) => setNewTrade({ ...newTrade, depositPct: parseInt(e.target.value) })}
                style={{ padding: 10, border: '1px solid #ddd', borderRadius: 8 }}
              />
              <input
                type="number"
                placeholder="Finance %"
                value={newTrade.financePct}
                onChange={(e) => setNewTrade({ ...newTrade, financePct: parseInt(e.target.value) })}
                style={{ padding: 10, border: '1px solid #ddd', borderRadius: 8 }}
              />
            </div>
            <button
              onClick={handleCreateTrade}
              disabled={loading}
              style={{
                padding: '12px 24px',
                background: '#111',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              {loading ? 'Creating...' : 'Create Trade'}
            </button>
          </div>
        </div>
      )}

      {/* Trade Actions */}
      <div style={{ 
        background: 'white', 
        border: '1px solid #e9ecef', 
        borderRadius: 12, 
        padding: 16 
      }}>
        <h3 style={{ margin: '0 0 16px 0' }}>Trade Actions</h3>
        
        {/* Buyer Deposit */}
        {userRole === 'buyer' && (
          <div style={{ marginBottom: 16 }}>
            <h4>Make Deposit</h4>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                placeholder="Trade ID"
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6, width: 100 }}
              />
              <input
                type="number"
                placeholder="Amount (TGT)"
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6, width: 120 }}
              />
              <button
                onClick={() => handleBuyerDeposit(1, '100')} // Demo values
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  background: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                Deposit
              </button>
            </div>
          </div>
        )}

        {/* Supplier Issue Key */}
        {userRole === 'supplier' && (
          <div style={{ marginBottom: 16 }}>
            <h4>Issue Trade Key</h4>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                placeholder="Trade ID"
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6, width: 100 }}
              />
              <input
                type="text"
                placeholder="Trade Key"
                value={tradeKey}
                onChange={(e) => setTradeKey(e.target.value)}
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6, flex: 1 }}
              />
              <button
                onClick={() => handleIssueKey(1)} // Demo trade ID
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                Issue Key
              </button>
            </div>
          </div>
        )}

        {/* Final Payment */}
        {userRole === 'buyer' && (
          <div style={{ marginBottom: 16 }}>
            <h4>Pay Final Amount</h4>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                placeholder="Trade ID"
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6, width: 100 }}
              />
              <input
                type="number"
                placeholder="Amount (TGT)"
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6, width: 120 }}
              />
              <button
                onClick={() => handlePayFinal(1, '70')} // Demo values
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                Pay Final
              </button>
            </div>
          </div>
        )}

        {/* Claim Documents */}
        <div>
          <h4>Claim Documents</h4>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              placeholder="Trade ID"
              style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6, width: 100 }}
            />
            <input
              type="text"
              placeholder="Trade Key"
              style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6, flex: 1 }}
            />
            <button
              onClick={() => handleClaimDocs(1, 'demo-key')} // Demo values
              disabled={loading}
              style={{
                padding: '8px 16px',
                background: '#7c3aed',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              Claim Docs
            </button>
          </div>
        </div>
      </div>

      {/* Contract Addresses */}
      <div style={{ 
        background: '#f8f9fa', 
        border: '1px solid #e9ecef', 
        borderRadius: 12, 
        padding: 16 
      }}>
        <h3 style={{ margin: '0 0 12px 0' }}>Contract Addresses</h3>
        <div style={{ fontSize: 12, color: '#666' }}>
          <div>TGT Token: <code>{TGT_ADDRESS}</code></div>
          <div>Escrow: <code>{ESCROW_ADDRESS}</code></div>
        </div>
      </div>
    </div>
  );
}

export default TradeManager;
