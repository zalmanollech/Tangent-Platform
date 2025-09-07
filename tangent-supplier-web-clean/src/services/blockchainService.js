const { ethers } = require('ethers');

// Enhanced Blockchain Service
class BlockchainService {
  constructor() {
    this.networks = {
      sepolia: {
        chainId: 11155111,
        name: 'Sepolia Testnet',
        rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID',
        explorerUrl: 'https://sepolia.etherscan.io',
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18
        }
      },
      mainnet: {
        chainId: 1,
        name: 'Ethereum Mainnet',
        rpcUrl: process.env.MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
        explorerUrl: 'https://etherscan.io',
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18
        }
      }
    };

    this.contracts = {
      tgt: {
        address: process.env.TGT_ADDRESS || '0xe91899Be4C9BDa5816DB885966a29cf90732bb9B',
        abi: require('../abi/tgt.json')
      },
      escrow: {
        address: process.env.ESCROW_ADDRESS || '0xdCFC79c81901903D59eEb4d548661C8CD0c98f87',
        abi: require('../abi/vault.json')
      }
    };

    this.provider = null;
    this.signer = null;
    this.contracts = {};
    this.currentNetwork = null;
  }

  // Initialize provider and contracts
  async initialize() {
    try {
      // Check if we're in a browser environment
      if (typeof window !== 'undefined' && window.ethereum) {
        this.provider = new ethers.BrowserProvider(window.ethereum);
        this.signer = await this.provider.getSigner();
        
        // Get current network
        const network = await this.provider.getNetwork();
        this.currentNetwork = network;
        
        console.log(`🌐 Connected to ${network.name} (Chain ID: ${network.chainId})`);
        
        // Initialize contracts
        await this.initializeContracts();
        
        return {
          success: true,
          network: network,
          address: await this.signer.getAddress()
        };
      } else {
        throw new Error('MetaMask not detected. Please install MetaMask.');
      }
    } catch (error) {
      console.error('Blockchain initialization error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Initialize contract instances
  async initializeContracts() {
    try {
      // TGT Token Contract
      this.contracts.tgt = new ethers.Contract(
        this.contracts.tgt.address,
        this.contracts.tgt.abi,
        this.signer
      );

      // Escrow Contract
      this.contracts.escrow = new ethers.Contract(
        this.contracts.escrow.address,
        this.contracts.escrow.abi,
        this.signer
      );

      console.log('✅ Contracts initialized');
    } catch (error) {
      console.error('Contract initialization error:', error);
      throw error;
    }
  }

  // Check if connected to correct network
  async checkNetwork() {
    if (!this.provider) {
      return { correct: false, error: 'Not connected to blockchain' };
    }

    try {
      const network = await this.provider.getNetwork();
      const expectedChainId = this.networks.sepolia.chainId;
      
      if (network.chainId !== expectedChainId) {
        return {
          correct: false,
          current: network,
          expected: this.networks.sepolia,
          error: `Please switch to Sepolia testnet (Chain ID: ${expectedChainId})`
        };
      }

      return { correct: true, network };
    } catch (error) {
      return { correct: false, error: error.message };
    }
  }

  // Switch to Sepolia network
  async switchToSepolia() {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${this.networks.sepolia.chainId.toString(16)}` }],
      });
      return { success: true };
    } catch (error) {
      if (error.code === 4902) {
        // Network not added, add it
        return await this.addSepoliaNetwork();
      }
      return { success: false, error: error.message };
    }
  }

  // Add Sepolia network to MetaMask
  async addSepoliaNetwork() {
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: `0x${this.networks.sepolia.chainId.toString(16)}`,
          chainName: this.networks.sepolia.name,
          nativeCurrency: this.networks.sepolia.nativeCurrency,
          rpcUrls: [this.networks.sepolia.rpcUrl],
          blockExplorerUrls: [this.networks.sepolia.explorerUrl]
        }]
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get account balance
  async getBalance(address = null) {
    try {
      const targetAddress = address || await this.signer.getAddress();
      const balance = await this.provider.getBalance(targetAddress);
      return {
        success: true,
        balance: ethers.formatEther(balance),
        wei: balance.toString()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get TGT token balance
  async getTGTBalance(address = null) {
    try {
      const targetAddress = address || await this.signer.getAddress();
      const balance = await this.contracts.tgt.balanceOf(targetAddress);
      const decimals = await this.contracts.tgt.decimals();
      
      return {
        success: true,
        balance: ethers.formatUnits(balance, decimals),
        raw: balance.toString()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Create a new trade on-chain
  async createTrade(tradeData) {
    try {
      const {
        supplier,
        buyer,
        commodity,
        quantity,
        price,
        depositPercentage,
        advancePercentage
      } = tradeData;

      // Convert values to wei
      const totalValue = ethers.parseEther(price.toString());
      const depositAmount = (totalValue * BigInt(depositPercentage)) / BigInt(100);
      const advanceAmount = (totalValue * BigInt(advancePercentage)) / BigInt(100);

      // Call createTrade function
      const tx = await this.contracts.escrow.createTrade(
        supplier,
        buyer,
        commodity,
        quantity,
        totalValue,
        depositAmount,
        advanceAmount
      );

      console.log(`📝 Trade creation transaction: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: tx.hash,
        receipt: receipt,
        tradeId: receipt.logs[0]?.args?.tradeId?.toString() || 'unknown'
      };
    } catch (error) {
      console.error('Trade creation error:', error);
      return { success: false, error: error.message };
    }
  }

  // Make deposit payment
  async makeDeposit(tradeId, amount) {
    try {
      const depositAmount = ethers.parseEther(amount.toString());
      
      // First, approve TGT spending
      const approveTx = await this.contracts.tgt.approve(
        this.contracts.escrow.address,
        depositAmount
      );
      await approveTx.wait();

      // Then make the deposit
      const tx = await this.contracts.escrow.buyerDeposit(tradeId, depositAmount);
      
      console.log(`💰 Deposit transaction: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: tx.hash,
        receipt: receipt
      };
    } catch (error) {
      console.error('Deposit error:', error);
      return { success: false, error: error.message };
    }
  }

  // Make advance payment
  async makeAdvance(tradeId, amount) {
    try {
      const advanceAmount = ethers.parseEther(amount.toString());
      
      // First, approve TGT spending
      const approveTx = await this.contracts.tgt.approve(
        this.contracts.escrow.address,
        advanceAmount
      );
      await approveTx.wait();

      // Then make the advance payment
      const tx = await this.contracts.escrow.payAdvance(tradeId, advanceAmount);
      
      console.log(`💸 Advance payment transaction: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: tx.hash,
        receipt: receipt
      };
    } catch (error) {
      console.error('Advance payment error:', error);
      return { success: false, error: error.message };
    }
  }

  // Issue document key
  async issueDocumentKey(tradeId, documentHash) {
    try {
      const tx = await this.contracts.escrow.acceptDocsAndIssueKey(
        tradeId,
        documentHash
      );
      
      console.log(`🔑 Document key issuance transaction: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: tx.hash,
        receipt: receipt,
        documentKey: receipt.logs[0]?.args?.documentKey || 'unknown'
      };
    } catch (error) {
      console.error('Document key issuance error:', error);
      return { success: false, error: error.message };
    }
  }

  // Make final payment
  async makeFinalPayment(tradeId, amount) {
    try {
      const finalAmount = ethers.parseEther(amount.toString());
      
      // First, approve TGT spending
      const approveTx = await this.contracts.tgt.approve(
        this.contracts.escrow.address,
        finalAmount
      );
      await approveTx.wait();

      // Then make the final payment
      const tx = await this.contracts.escrow.payFinal(tradeId, finalAmount);
      
      console.log(`💳 Final payment transaction: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: tx.hash,
        receipt: receipt
      };
    } catch (error) {
      console.error('Final payment error:', error);
      return { success: false, error: error.message };
    }
  }

  // Claim documents
  async claimDocuments(tradeId, documentKey) {
    try {
      const tx = await this.contracts.escrow.claimDocs(tradeId, documentKey);
      
      console.log(`📄 Document claim transaction: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: tx.hash,
        receipt: receipt
      };
    } catch (error) {
      console.error('Document claim error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get trade details from blockchain
  async getTradeDetails(tradeId) {
    try {
      const trade = await this.contracts.escrow.trades(tradeId);
      
      return {
        success: true,
        trade: {
          id: tradeId,
          supplier: trade.supplier,
          buyer: trade.buyer,
          commodity: trade.commodity,
          quantity: trade.quantity.toString(),
          totalValue: ethers.formatEther(trade.totalValue),
          depositAmount: ethers.formatEther(trade.depositAmount),
          advanceAmount: ethers.formatEther(trade.advanceAmount),
          status: trade.status,
          createdAt: new Date(trade.createdAt * 1000).toISOString()
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get transaction status
  async getTransactionStatus(txHash) {
    try {
      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      return {
        success: true,
        transaction: tx,
        receipt: receipt,
        status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'pending'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Estimate gas for transaction
  async estimateGas(method, ...args) {
    try {
      const gasEstimate = await method.estimateGas(...args);
      return {
        success: true,
        gasEstimate: gasEstimate.toString(),
        gasPrice: (await this.provider.getFeeData()).gasPrice?.toString() || '0'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get current account
  async getCurrentAccount() {
    try {
      if (!this.signer) {
        return { success: false, error: 'Not connected' };
      }
      
      const address = await this.signer.getAddress();
      const balance = await this.getBalance(address);
      const tgtBalance = await this.getTGTBalance(address);
      
      return {
        success: true,
        address: address,
        ethBalance: balance.balance,
        tgtBalance: tgtBalance.balance
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Listen for contract events
  async listenForEvents(eventName, callback) {
    try {
      const contract = this.contracts.escrow;
      const filter = contract.filters[eventName]();
      
      contract.on(filter, callback);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Stop listening for events
  async stopListening(eventName) {
    try {
      const contract = this.contracts.escrow;
      contract.removeAllListeners(eventName);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get contract addresses
  getContractAddresses() {
    return {
      tgt: this.contracts.tgt.address,
      escrow: this.contracts.escrow.address,
      network: this.currentNetwork?.name || 'unknown'
    };
  }

  // Check if contracts are deployed
  async checkContractDeployment() {
    try {
      const tgtCode = await this.provider.getCode(this.contracts.tgt.address);
      const escrowCode = await this.provider.getCode(this.contracts.escrow.address);
      
      return {
        success: true,
        tgtDeployed: tgtCode !== '0x',
        escrowDeployed: escrowCode !== '0x',
        addresses: this.getContractAddresses()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new BlockchainService();
