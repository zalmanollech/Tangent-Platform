const { ethers } = require('ethers');
const { config } = require('./config');
const logger = require('./logger');

// Import contract ABIs (these would come from your compiled contracts)
const TGT_ABI = require('../onchain/artifacts/contracts/TGT.sol/TGT.json').abi;
const ESCROW_ABI = require('../onchain/artifacts/contracts/TangentEscrow.sol/TangentEscrow.json').abi;

class BlockchainService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.tgtContract = null;
    this.escrowContract = null;
    this.isInitialized = false;
    this.networkId = null;
  }

  async initialize() {
    try {
      const blockchainConfig = config.blockchain;
      
      if (!blockchainConfig.sepoliaRpcUrl) {
        logger.warn('Blockchain RPC URL not configured - blockchain features will be disabled');
        return this;
      }

      // Initialize provider
      this.provider = new ethers.JsonRpcProvider(blockchainConfig.sepoliaRpcUrl);
      
      // Test connection
      const network = await this.provider.getNetwork();
      this.networkId = network.chainId;
      logger.info('Connected to blockchain network', { 
        chainId: this.networkId, 
        name: network.name 
      });

      // Initialize signer if private key is provided
      if (blockchainConfig.privateKey) {
        this.signer = new ethers.Wallet(blockchainConfig.privateKey, this.provider);
        logger.info('Blockchain signer initialized', { 
          address: this.signer.address 
        });
      }

      // Initialize contracts if addresses are provided
      if (blockchainConfig.tgtAddress) {
        this.tgtContract = new ethers.Contract(
          blockchainConfig.tgtAddress,
          TGT_ABI,
          this.signer || this.provider
        );
        logger.info('TGT contract initialized', { 
          address: blockchainConfig.tgtAddress 
        });
      }

      if (blockchainConfig.escrowAddress) {
        this.escrowContract = new ethers.Contract(
          blockchainConfig.escrowAddress,
          ESCROW_ABI,
          this.signer || this.provider
        );
        logger.info('Escrow contract initialized', { 
          address: blockchainConfig.escrowAddress 
        });
      }

      this.isInitialized = true;
      return this;

    } catch (error) {
      logger.error('Failed to initialize blockchain service', { error: error.message });
      this.isInitialized = false;
      return this;
    }
  }

  // Smart Contract Deployment
  async deployTGTContract(deployerAddress, initialSupply = ethers.parseEther("1000000")) {
    if (!this.signer) {
      throw new Error('Signer required for contract deployment');
    }

    try {
      const TGT = await ethers.getContractFactory("TGT", this.signer);
      const tgtContract = await TGT.deploy(initialSupply);
      await tgtContract.waitForDeployment();

      const contractAddress = await tgtContract.getAddress();
      
      logger.info('TGT contract deployed', {
        address: contractAddress,
        deployer: deployerAddress,
        initialSupply: ethers.formatEther(initialSupply)
      });

      this.tgtContract = tgtContract;
      return {
        address: contractAddress,
        transaction: tgtContract.deploymentTransaction()
      };

    } catch (error) {
      logger.error('TGT contract deployment failed', { error: error.message });
      throw error;
    }
  }

  async deployEscrowContract(tgtTokenAddress) {
    if (!this.signer) {
      throw new Error('Signer required for contract deployment');
    }

    if (!tgtTokenAddress) {
      throw new Error('TGT token address required for escrow deployment');
    }

    try {
      const TangentEscrow = await ethers.getContractFactory("TangentEscrow", this.signer);
      const escrowContract = await TangentEscrow.deploy(tgtTokenAddress);
      await escrowContract.waitForDeployment();

      const contractAddress = await escrowContract.getAddress();
      
      logger.info('Escrow contract deployed', {
        address: contractAddress,
        tgtTokenAddress
      });

      this.escrowContract = escrowContract;
      return {
        address: contractAddress,
        transaction: escrowContract.deploymentTransaction()
      };

    } catch (error) {
      logger.error('Escrow contract deployment failed', { error: error.message });
      throw error;
    }
  }

  // TGT Token Operations
  async getTGTBalance(address) {
    if (!this.tgtContract) {
      throw new Error('TGT contract not initialized');
    }

    try {
      const balance = await this.tgtContract.balanceOf(address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error('Failed to get TGT balance', { address, error: error.message });
      throw error;
    }
  }

  async transferTGT(to, amount) {
    if (!this.tgtContract || !this.signer) {
      throw new Error('TGT contract and signer required for transfer');
    }

    try {
      const amountWei = ethers.parseEther(amount.toString());
      const tx = await this.tgtContract.transfer(to, amountWei);
      await tx.wait();

      logger.info('TGT transfer completed', {
        to,
        amount,
        txHash: tx.hash
      });

      return tx;

    } catch (error) {
      logger.error('TGT transfer failed', { to, amount, error: error.message });
      throw error;
    }
  }

  async mintTGT(to, amount) {
    if (!this.tgtContract || !this.signer) {
      throw new Error('TGT contract and signer required for minting');
    }

    try {
      const amountWei = ethers.parseEther(amount.toString());
      const tx = await this.tgtContract.mint(to, amountWei);
      await tx.wait();

      logger.info('TGT minting completed', {
        to,
        amount,
        txHash: tx.hash
      });

      return tx;

    } catch (error) {
      logger.error('TGT minting failed', { to, amount, error: error.message });
      throw error;
    }
  }

  // Escrow Operations
  async createEscrowTrade(tradeData) {
    if (!this.escrowContract || !this.signer) {
      throw new Error('Escrow contract and signer required');
    }

    try {
      const {
        tradeId,
        buyer,
        supplier,
        totalAmount,
        depositAmount,
        commodity,
        quantity
      } = tradeData;

      const totalAmountWei = ethers.parseEther(totalAmount.toString());
      const depositAmountWei = ethers.parseEther(depositAmount.toString());

      // Create trade in escrow contract
      const tx = await this.escrowContract.createTrade(
        tradeId,
        buyer,
        supplier,
        totalAmountWei,
        depositAmountWei,
        commodity,
        quantity.toString()
      );

      await tx.wait();

      logger.info('Escrow trade created', {
        tradeId,
        buyer,
        supplier,
        totalAmount,
        txHash: tx.hash
      });

      return tx;

    } catch (error) {
      logger.error('Failed to create escrow trade', { 
        tradeId: tradeData.tradeId, 
        error: error.message 
      });
      throw error;
    }
  }

  async depositToEscrow(tradeId, amount) {
    if (!this.escrowContract || !this.signer) {
      throw new Error('Escrow contract and signer required');
    }

    try {
      const amountWei = ethers.parseEther(amount.toString());
      
      // First approve TGT tokens for escrow contract
      if (this.tgtContract) {
        const approveTx = await this.tgtContract.approve(
          await this.escrowContract.getAddress(),
          amountWei
        );
        await approveTx.wait();
      }

      // Make deposit
      const tx = await this.escrowContract.makeDeposit(tradeId, amountWei);
      await tx.wait();

      logger.info('Escrow deposit completed', {
        tradeId,
        amount,
        txHash: tx.hash
      });

      return tx;

    } catch (error) {
      logger.error('Escrow deposit failed', { tradeId, amount, error: error.message });
      throw error;
    }
  }

  async confirmDelivery(tradeId) {
    if (!this.escrowContract || !this.signer) {
      throw new Error('Escrow contract and signer required');
    }

    try {
      const tx = await this.escrowContract.confirmDelivery(tradeId);
      await tx.wait();

      logger.info('Delivery confirmed', {
        tradeId,
        txHash: tx.hash
      });

      return tx;

    } catch (error) {
      logger.error('Failed to confirm delivery', { tradeId, error: error.message });
      throw error;
    }
  }

  async releaseFunds(tradeId) {
    if (!this.escrowContract || !this.signer) {
      throw new Error('Escrow contract and signer required');
    }

    try {
      const tx = await this.escrowContract.releaseFunds(tradeId);
      await tx.wait();

      logger.info('Funds released', {
        tradeId,
        txHash: tx.hash
      });

      return tx;

    } catch (error) {
      logger.error('Failed to release funds', { tradeId, error: error.message });
      throw error;
    }
  }

  async getEscrowTradeStatus(tradeId) {
    if (!this.escrowContract) {
      throw new Error('Escrow contract not initialized');
    }

    try {
      const trade = await this.escrowContract.getTrade(tradeId);
      
      return {
        tradeId: trade.tradeId,
        buyer: trade.buyer,
        supplier: trade.supplier,
        totalAmount: ethers.formatEther(trade.totalAmount),
        depositAmount: ethers.formatEther(trade.depositAmount),
        status: trade.status,
        commodity: trade.commodity,
        quantity: trade.quantity.toString(),
        createdAt: new Date(Number(trade.createdAt) * 1000).toISOString(),
        depositPaid: trade.depositPaid,
        delivered: trade.delivered,
        completed: trade.completed
      };

    } catch (error) {
      logger.error('Failed to get escrow trade status', { tradeId, error: error.message });
      throw error;
    }
  }

  // Utility functions
  async getGasPrice() {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      const gasPrice = await this.provider.getFeeData();
      return {
        gasPrice: ethers.formatUnits(gasPrice.gasPrice || 0, 'gwei'),
        maxFeePerGas: ethers.formatUnits(gasPrice.maxFeePerGas || 0, 'gwei'),
        maxPriorityFeePerGas: ethers.formatUnits(gasPrice.maxPriorityFeePerGas || 0, 'gwei')
      };
    } catch (error) {
      logger.error('Failed to get gas price', { error: error.message });
      throw error;
    }
  }

  async getBalance(address) {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error('Failed to get ETH balance', { address, error: error.message });
      throw error;
    }
  }

  async waitForTransaction(txHash, confirmations = 1) {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      const receipt = await this.provider.waitForTransaction(txHash, confirmations);
      return receipt;
    } catch (error) {
      logger.error('Failed to wait for transaction', { txHash, error: error.message });
      throw error;
    }
  }

  // Admin functions
  async pauseEscrow() {
    if (!this.escrowContract || !this.signer) {
      throw new Error('Escrow contract and admin signer required');
    }

    try {
      const tx = await this.escrowContract.pause();
      await tx.wait();

      logger.info('Escrow contract paused', { txHash: tx.hash });
      return tx;

    } catch (error) {
      logger.error('Failed to pause escrow', { error: error.message });
      throw error;
    }
  }

  async unpauseEscrow() {
    if (!this.escrowContract || !this.signer) {
      throw new Error('Escrow contract and admin signer required');
    }

    try {
      const tx = await this.escrowContract.unpause();
      await tx.wait();

      logger.info('Escrow contract unpaused', { txHash: tx.hash });
      return tx;

    } catch (error) {
      logger.error('Failed to unpause escrow', { error: error.message });
      throw error;
    }
  }

  // Contract event listening
  setupEventListeners() {
    if (!this.isInitialized) {
      logger.warn('Cannot setup event listeners - blockchain service not initialized');
      return;
    }

    // TGT Token events
    if (this.tgtContract) {
      this.tgtContract.on('Transfer', (from, to, amount, event) => {
        logger.info('TGT Transfer event', {
          from,
          to,
          amount: ethers.formatEther(amount),
          txHash: event.transactionHash
        });
      });
    }

    // Escrow events
    if (this.escrowContract) {
      this.escrowContract.on('TradeCreated', (tradeId, buyer, supplier, totalAmount, event) => {
        logger.info('Escrow TradeCreated event', {
          tradeId,
          buyer,
          supplier,
          totalAmount: ethers.formatEther(totalAmount),
          txHash: event.transactionHash
        });
      });

      this.escrowContract.on('DepositMade', (tradeId, buyer, amount, event) => {
        logger.info('Escrow DepositMade event', {
          tradeId,
          buyer,
          amount: ethers.formatEther(amount),
          txHash: event.transactionHash
        });
      });

      this.escrowContract.on('DeliveryConfirmed', (tradeId, supplier, event) => {
        logger.info('Escrow DeliveryConfirmed event', {
          tradeId,
          supplier,
          txHash: event.transactionHash
        });
      });

      this.escrowContract.on('FundsReleased', (tradeId, supplier, amount, event) => {
        logger.info('Escrow FundsReleased event', {
          tradeId,
          supplier,
          amount: ethers.formatEther(amount),
          txHash: event.transactionHash
        });
      });
    }

    logger.info('Blockchain event listeners setup complete');
  }

  // Status check
  isReady() {
    return this.isInitialized && this.provider && this.signer;
  }

  isContractsReady() {
    return this.isReady() && this.tgtContract && this.escrowContract;
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      hasProvider: !!this.provider,
      hasSigner: !!this.signer,
      hasTGTContract: !!this.tgtContract,
      hasEscrowContract: !!this.escrowContract,
      networkId: this.networkId,
      signerAddress: this.signer?.address || null,
      ready: this.isReady(),
      contractsReady: this.isContractsReady()
    };
  }
}

// Export singleton instance
module.exports = new BlockchainService();



