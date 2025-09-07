import React, { useState, useEffect } from 'react';

const BlockchainIntegration = ({ userRole, onTransactionUpdate }) => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [account, setAccount] = useState(null);
  const [network, setNetwork] = useState(null);
  const [balances, setBalances] = useState({ eth: '0', tgt: '0' });
  const [contracts, setContracts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [transactions, setTransactions] = useState([]);

  // Initialize blockchain connection
  useEffect(() => {
    initializeBlockchain();
  }, []);

  const initializeBlockchain = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if MetaMask is installed
      if (!window.ethereum) {
        throw new Error('MetaMask not detected. Please install MetaMask to continue.');
      }

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts.length === 0) {
        throw new Error('No accounts found. Please connect your MetaMask wallet.');
      }

      // Get provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      // Check if on correct network (Sepolia)
      if (network.chainId !== 11155111n) {
        throw new Error('Please switch to Sepolia testnet to continue.');
      }

      // Get balances
      const ethBalance = await provider.getBalance(address);
      const tgtBalance = await getTGTBalance(address, provider);

      setConnectionStatus('connected');
      setAccount(address);
      setNetwork(network);
      setBalances({
        eth: ethers.formatEther(ethBalance),
        tgt: tgtBalance
      });

      // Initialize contracts
      await initializeContracts(provider, signer);

      console.log('✅ Blockchain connection established');

    } catch (error) {
      console.error('Blockchain initialization error:', error);
      setError(error.message);
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const getTGTBalance = async (address, provider) => {
    try {
      const tgtAddress = '0xe91899Be4C9BDa5816DB885966a29cf90732bb9B';
      const tgtABI = [
        "function balanceOf(address owner) view returns (uint256)",
        "function decimals() view returns (uint8)"
      ];
      
      const tgtContract = new ethers.Contract(tgtAddress, tgtABI, provider);
      const balance = await tgtContract.balanceOf(address);
      const decimals = await tgtContract.decimals();
      
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      console.error('TGT balance error:', error);
      return '0';
    }
  };

  const initializeContracts = async (provider, signer) => {
    try {
      const tgtAddress = '0xe91899Be4C9BDa5816DB885966a29cf90732bb9B';
      const escrowAddress = '0xdCFC79c81901903D59eEb4d548661C8CD0c98f87';
      
      const tgtABI = [
        "function balanceOf(address owner) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)"
      ];
      
      const escrowABI = [
        "function createTrade(address supplier, address buyer, string memory commodity, uint256 quantity, uint256 totalValue, uint256 depositAmount, uint256 advanceAmount) returns (uint256)",
        "function buyerDeposit(uint256 tradeId, uint256 amount) returns (bool)",
        "function payAdvance(uint256 tradeId, uint256 amount) returns (bool)",
        "function acceptDocsAndIssueKey(uint256 tradeId, string memory documentHash) returns (string memory)",
        "function payFinal(uint256 tradeId, uint256 amount) returns (bool)",
        "function claimDocs(uint256 tradeId, string memory documentKey) returns (bool)",
        "function trades(uint256) view returns (address supplier, address buyer, string memory commodity, uint256 quantity, uint256 totalValue, uint256 depositAmount, uint256 advanceAmount, uint8 status, uint256 createdAt)"
      ];

      const tgtContract = new ethers.Contract(tgtAddress, tgtABI, signer);
      const escrowContract = new ethers.Contract(escrowAddress, escrowABI, signer);

      setContracts({ tgt: tgtContract, escrow: escrowContract });

    } catch (error) {
      console.error('Contract initialization error:', error);
      throw error;
    }
  };

  const switchToSepolia = async () => {
    try {
      setLoading(true);
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }], // Sepolia chain ID
      });
      await initializeBlockchain();
    } catch (error) {
      if (error.code === 4902) {
        // Network not added, add it
        await addSepoliaNetwork();
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const addSepoliaNetwork = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0xaa36a7',
          chainName: 'Sepolia Test Network',
          nativeCurrency: {
            name: 'SepoliaETH',
            symbol: 'ETH',
            decimals: 18
          },
          rpcUrls: ['https://sepolia.infura.io/v3/YOUR_PROJECT_ID'],
          blockExplorerUrls: ['https://sepolia.etherscan.io']
        }]
      });
      await initializeBlockchain();
    } catch (error) {
      setError(error.message);
    }
  };

  const createTrade = async (tradeData) => {
    try {
      setLoading(true);
      setError(null);

      const {
        supplier,
        buyer,
        commodity,
        quantity,
        price,
        depositPercentage,
        advancePercentage
      } = tradeData;

      const totalValue = ethers.parseEther(price.toString());
      const depositAmount = (totalValue * BigInt(depositPercentage)) / BigInt(100);
      const advanceAmount = (totalValue * BigInt(advancePercentage)) / BigInt(100);

      const tx = await contracts.escrow.createTrade(
        supplier,
        buyer,
        commodity,
        quantity,
        totalValue,
        depositAmount,
        advanceAmount
      );

      console.log(`📝 Trade creation transaction: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      const newTransaction = {
        id: Date.now(),
        type: 'create_trade',
        hash: tx.hash,
        status: 'success',
        timestamp: new Date().toISOString(),
        details: `Trade created: ${commodity} - ${quantity} units`
      };

      setTransactions(prev => [newTransaction, ...prev]);
      if (onTransactionUpdate) onTransactionUpdate(newTransaction);

      return {
        success: true,
        txHash: tx.hash,
        tradeId: receipt.logs[0]?.args?.tradeId?.toString() || 'unknown'
      };

    } catch (error) {
      console.error('Trade creation error:', error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const makeDeposit = async (tradeId, amount) => {
    try {
      setLoading(true);
      setError(null);

      const depositAmount = ethers.parseEther(amount.toString());
      
      // Approve TGT spending
      const approveTx = await contracts.tgt.approve(contracts.escrow.target, depositAmount);
      await approveTx.wait();

      // Make deposit
      const tx = await contracts.escrow.buyerDeposit(tradeId, depositAmount);
      const receipt = await tx.wait();

      const newTransaction = {
        id: Date.now(),
        type: 'deposit',
        hash: tx.hash,
        status: 'success',
        timestamp: new Date().toISOString(),
        details: `Deposit made: ${amount} TGT`
      };

      setTransactions(prev => [newTransaction, ...prev]);
      if (onTransactionUpdate) onTransactionUpdate(newTransaction);

      return { success: true, txHash: tx.hash };

    } catch (error) {
      console.error('Deposit error:', error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const makeAdvance = async (tradeId, amount) => {
    try {
      setLoading(true);
      setError(null);

      const advanceAmount = ethers.parseEther(amount.toString());
      
      // Approve TGT spending
      const approveTx = await contracts.tgt.approve(contracts.escrow.target, advanceAmount);
      await approveTx.wait();

      // Make advance payment
      const tx = await contracts.escrow.payAdvance(tradeId, advanceAmount);
      const receipt = await tx.wait();

      const newTransaction = {
        id: Date.now(),
        type: 'advance',
        hash: tx.hash,
        status: 'success',
        timestamp: new Date().toISOString(),
        details: `Advance payment: ${amount} TGT`
      };

      setTransactions(prev => [newTransaction, ...prev]);
      if (onTransactionUpdate) onTransactionUpdate(newTransaction);

      return { success: true, txHash: tx.hash };

    } catch (error) {
      console.error('Advance payment error:', error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const issueDocumentKey = async (tradeId, documentHash) => {
    try {
      setLoading(true);
      setError(null);

      const tx = await contracts.escrow.acceptDocsAndIssueKey(tradeId, documentHash);
      const receipt = await tx.wait();

      const newTransaction = {
        id: Date.now(),
        type: 'issue_key',
        hash: tx.hash,
        status: 'success',
        timestamp: new Date().toISOString(),
        details: `Document key issued for trade ${tradeId}`
      };

      setTransactions(prev => [newTransaction, ...prev]);
      if (onTransactionUpdate) onTransactionUpdate(newTransaction);

      return { success: true, txHash: tx.hash };

    } catch (error) {
      console.error('Document key issuance error:', error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const makeFinalPayment = async (tradeId, amount) => {
    try {
      setLoading(true);
      setError(null);

      const finalAmount = ethers.parseEther(amount.toString());
      
      // Approve TGT spending
      const approveTx = await contracts.tgt.approve(contracts.escrow.target, finalAmount);
      await approveTx.wait();

      // Make final payment
      const tx = await contracts.escrow.payFinal(tradeId, finalAmount);
      const receipt = await tx.wait();

      const newTransaction = {
        id: Date.now(),
        type: 'final_payment',
        hash: tx.hash,
        status: 'success',
        timestamp: new Date().toISOString(),
        details: `Final payment: ${amount} TGT`
      };

      setTransactions(prev => [newTransaction, ...prev]);
      if (onTransactionUpdate) onTransactionUpdate(newTransaction);

      return { success: true, txHash: tx.hash };

    } catch (error) {
      console.error('Final payment error:', error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const claimDocuments = async (tradeId, documentKey) => {
    try {
      setLoading(true);
      setError(null);

      const tx = await contracts.escrow.claimDocs(tradeId, documentKey);
      const receipt = await tx.wait();

      const newTransaction = {
        id: Date.now(),
        type: 'claim_docs',
        hash: tx.hash,
        status: 'success',
        timestamp: new Date().toISOString(),
        details: `Documents claimed for trade ${tradeId}`
      };

      setTransactions(prev => [newTransaction, ...prev]);
      if (onTransactionUpdate) onTransactionUpdate(newTransaction);

      return { success: true, txHash: tx.hash };

    } catch (error) {
      console.error('Document claim error:', error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const getTransactionStatus = async (txHash) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const tx = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);
      
      return {
        success: true,
        status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'pending',
        receipt: receipt
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const refreshBalances = async () => {
    if (!account) return;
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const ethBalance = await provider.getBalance(account);
      const tgtBalance = await getTGTBalance(account, provider);
      
      setBalances({
        eth: ethers.formatEther(ethBalance),
        tgt: tgtBalance
      });
    } catch (error) {
      console.error('Balance refresh error:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'connected': '#10b981',
      'disconnected': '#6b7280',
      'error': '#ef4444',
      'loading': '#f59e0b'
    };
    return colors[status] || '#6b7280';
  };

  const getTransactionTypeColor = (type) => {
    const colors = {
      'create_trade': '#3b82f6',
      'deposit': '#10b981',
      'advance': '#f59e0b',
      'issue_key': '#8b5cf6',
      'final_payment': '#ef4444',
      'claim_docs': '#06b6d4'
    };
    return colors[type] || '#6b7280';
  };

  return (
    <div className="blockchain-integration">
      <style jsx>{`
        .blockchain-integration {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid #e5e7eb;
        }

        .title {
          font-size: 24px;
          font-weight: bold;
          color: #1f2937;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .connection-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .account-info {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }

        .info-item {
          background: #f9fafb;
          padding: 15px;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }

        .info-label {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 5px;
        }

        .info-value {
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover {
          background: #2563eb;
        }

        .btn-secondary {
          background: #6b7280;
          color: white;
        }

        .btn-secondary:hover {
          background: #4b5563;
        }

        .btn-success {
          background: #10b981;
          color: white;
        }

        .btn-success:hover {
          background: #059669;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .transactions-section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
        }

        .transaction-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          border-bottom: 1px solid #e5e7eb;
        }

        .transaction-item:last-child {
          border-bottom: none;
        }

        .transaction-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .transaction-type {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          color: white;
        }

        .transaction-details {
          font-size: 14px;
          color: #374151;
        }

        .transaction-hash {
          font-size: 12px;
          color: #6b7280;
          font-family: monospace;
        }

        .transaction-time {
          font-size: 12px;
          color: #6b7280;
        }

        .error-message {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 20px;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }
      `}</style>

      <div className="header">
        <h2 className="title">Blockchain Integration</h2>
        <div className="status-indicator" style={{ backgroundColor: getStatusColor(connectionStatus) + '20' }}>
          <div className="status-dot" style={{ backgroundColor: getStatusColor(connectionStatus) }}></div>
          {connectionStatus === 'connected' ? 'Connected' : 
           connectionStatus === 'error' ? 'Error' : 
           connectionStatus === 'loading' ? 'Connecting...' : 'Disconnected'}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading && (
        <div className="loading">
          Processing blockchain transaction...
        </div>
      )}

      {connectionStatus === 'disconnected' && (
        <div className="connection-card">
          <h3>Connect to Blockchain</h3>
          <p>Connect your MetaMask wallet to interact with the Tangent Platform on the blockchain.</p>
          <button className="btn btn-primary" onClick={initializeBlockchain}>
            Connect MetaMask
          </button>
        </div>
      )}

      {connectionStatus === 'error' && (
        <div className="connection-card">
          <h3>Connection Error</h3>
          <p>There was an error connecting to the blockchain. Please try again.</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-primary" onClick={initializeBlockchain}>
              Retry Connection
            </button>
            <button className="btn btn-secondary" onClick={switchToSepolia}>
              Switch to Sepolia
            </button>
          </div>
        </div>
      )}

      {connectionStatus === 'connected' && (
        <>
          <div className="connection-card">
            <h3>Account Information</h3>
            <div className="account-info">
              <div className="info-item">
                <div className="info-label">Account Address</div>
                <div className="info-value" style={{ fontFamily: 'monospace', fontSize: '14px' }}>
                  {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'N/A'}
                </div>
              </div>
              <div className="info-item">
                <div className="info-label">Network</div>
                <div className="info-value">{network?.name || 'Unknown'}</div>
              </div>
              <div className="info-item">
                <div className="info-label">ETH Balance</div>
                <div className="info-value">{parseFloat(balances.eth).toFixed(4)} ETH</div>
              </div>
              <div className="info-item">
                <div className="info-label">TGT Balance</div>
                <div className="info-value">{parseFloat(balances.tgt).toFixed(2)} TGT</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={refreshBalances}>
                Refresh Balances
              </button>
              <button className="btn btn-secondary" onClick={switchToSepolia}>
                Switch Network
              </button>
            </div>
          </div>

          <div className="transactions-section">
            <h3>Recent Transactions</h3>
            {transactions.length === 0 ? (
              <div className="empty-state">
                <p>No transactions yet</p>
              </div>
            ) : (
              <div>
                {transactions.map(tx => (
                  <div key={tx.id} className="transaction-item">
                    <div className="transaction-info">
                      <div
                        className="transaction-type"
                        style={{ backgroundColor: getTransactionTypeColor(tx.type) }}
                      >
                        {tx.type.replace('_', ' ').toUpperCase()}
                      </div>
                      <div>
                        <div className="transaction-details">{tx.details}</div>
                        <div className="transaction-hash">{tx.hash}</div>
                      </div>
                    </div>
                    <div className="transaction-time">
                      {new Date(tx.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default BlockchainIntegration;
