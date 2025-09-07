const express = require('express');
const router = express.Router();
const { getDatabase } = require('../lib/database-enhanced');
const { authMiddleware } = require('../lib/security');
const { logUtils } = require('../lib/logger');
const blockchainService = require('../lib/blockchain');
const websocketService = require('../lib/websocket');

// Get blockchain status
router.get('/status', authMiddleware.requireAuth, async (req, res) => {
  try {
    const status = blockchainService.getStatus();
    
    res.json({
      success: true,
      blockchain: status
    });

  } catch (error) {
    logUtils.logError(error, { action: 'get_blockchain_status' }, req);
    res.status(500).json({ error: 'Failed to get blockchain status' });
  }
});

// Deploy TGT contract (admin only)
router.post('/deploy/tgt', authMiddleware.requireAdmin, async (req, res) => {
  try {
    if (!blockchainService.isReady()) {
      return res.status(503).json({ error: 'Blockchain service not ready' });
    }

    const { initialSupply } = req.body;
    
    const deployment = await blockchainService.deployTGTContract(
      req.user.id,
      initialSupply
    );

    // Log deployment
    logUtils.logBusiness('tgt_contract_deployed', {
      contractAddress: deployment.address,
      deployer: req.user.id,
      initialSupply
    }, req.user.id);

    res.json({
      success: true,
      message: 'TGT contract deployed successfully',
      contractAddress: deployment.address,
      transactionHash: deployment.transaction.hash
    });

  } catch (error) {
    logUtils.logError(error, { action: 'deploy_tgt_contract' }, req);
    res.status(500).json({ error: 'Failed to deploy TGT contract' });
  }
});

// Deploy Escrow contract (admin only)
router.post('/deploy/escrow', authMiddleware.requireAdmin, async (req, res) => {
  try {
    if (!blockchainService.isReady()) {
      return res.status(503).json({ error: 'Blockchain service not ready' });
    }

    const { tgtTokenAddress } = req.body;
    
    if (!tgtTokenAddress) {
      return res.status(400).json({ error: 'TGT token address required' });
    }

    const deployment = await blockchainService.deployEscrowContract(tgtTokenAddress);

    // Log deployment
    logUtils.logBusiness('escrow_contract_deployed', {
      contractAddress: deployment.address,
      tgtTokenAddress,
      deployer: req.user.id
    }, req.user.id);

    res.json({
      success: true,
      message: 'Escrow contract deployed successfully',
      contractAddress: deployment.address,
      transactionHash: deployment.transaction.hash
    });

  } catch (error) {
    logUtils.logError(error, { action: 'deploy_escrow_contract' }, req);
    res.status(500).json({ error: 'Failed to deploy escrow contract' });
  }
});

// Get TGT balance
router.get('/tgt/balance/:address', authMiddleware.requireAuth, async (req, res) => {
  try {
    if (!blockchainService.isContractsReady()) {
      return res.status(503).json({ error: 'Blockchain contracts not ready' });
    }

    const { address } = req.params;
    
    // Basic security check - users can only check their own balance unless admin
    if (address !== req.user.walletAddress && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const balance = await blockchainService.getTGTBalance(address);

    res.json({
      success: true,
      address,
      balance
    });

  } catch (error) {
    logUtils.logError(error, { action: 'get_tgt_balance', address: req.params.address }, req);
    res.status(500).json({ error: 'Failed to get TGT balance' });
  }
});

// Transfer TGT tokens (admin only for now)
router.post('/tgt/transfer', authMiddleware.requireAdmin, async (req, res) => {
  try {
    if (!blockchainService.isContractsReady()) {
      return res.status(503).json({ error: 'Blockchain contracts not ready' });
    }

    const { to, amount } = req.body;
    
    if (!to || !amount) {
      return res.status(400).json({ error: 'Recipient address and amount required' });
    }

    const tx = await blockchainService.transferTGT(to, amount);

    // Log transfer
    logUtils.logBusiness('tgt_transfer', {
      to,
      amount,
      txHash: tx.hash,
      from: req.user.id
    }, req.user.id);

    res.json({
      success: true,
      message: 'TGT transfer completed',
      transactionHash: tx.hash,
      to,
      amount
    });

  } catch (error) {
    logUtils.logError(error, { action: 'transfer_tgt' }, req);
    res.status(500).json({ error: 'Failed to transfer TGT tokens' });
  }
});

// Mint TGT tokens (admin only)
router.post('/tgt/mint', authMiddleware.requireAdmin, async (req, res) => {
  try {
    if (!blockchainService.isContractsReady()) {
      return res.status(503).json({ error: 'Blockchain contracts not ready' });
    }

    const { to, amount } = req.body;
    
    if (!to || !amount) {
      return res.status(400).json({ error: 'Recipient address and amount required' });
    }

    const tx = await blockchainService.mintTGT(to, amount);

    // Log minting
    logUtils.logBusiness('tgt_mint', {
      to,
      amount,
      txHash: tx.hash,
      minter: req.user.id
    }, req.user.id);

    res.json({
      success: true,
      message: 'TGT tokens minted successfully',
      transactionHash: tx.hash,
      to,
      amount
    });

  } catch (error) {
    logUtils.logError(error, { action: 'mint_tgt' }, req);
    res.status(500).json({ error: 'Failed to mint TGT tokens' });
  }
});

// Create escrow trade
router.post('/escrow/trade', authMiddleware.requireAuth, async (req, res) => {
  try {
    if (!blockchainService.isContractsReady()) {
      return res.status(503).json({ error: 'Blockchain contracts not ready' });
    }

    const db = await getDatabase();
    const { tradeId } = req.body;
    
    if (!tradeId) {
      return res.status(400).json({ error: 'Trade ID required' });
    }

    // Get trade from database
    const trade = await db.findById('trades', tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    // Check permissions
    if (trade.creator_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if trade already exists on blockchain
    if (trade.blockchain_trade_id) {
      return res.status(400).json({ error: 'Trade already exists on blockchain' });
    }

    const tradeData = {
      tradeId: trade.id,
      buyer: trade.buyer,
      supplier: trade.supplier,
      totalAmount: trade.total_value || (trade.quantity * trade.unit_price),
      depositAmount: trade.deposit_amount || (trade.total_value * (trade.deposit_pct / 100)),
      commodity: trade.commodity,
      quantity: trade.quantity
    };

    const tx = await blockchainService.createEscrowTrade(tradeData);

    // Update trade with blockchain info
    await db.update('trades', trade.id, {
      blockchain_trade_id: trade.id,
      blockchain_tx_hash: tx.hash,
      blockchain_status: 'created'
    });

    // Log blockchain trade creation
    logUtils.logBusiness('blockchain_trade_created', {
      tradeId: trade.id,
      txHash: tx.hash,
      totalAmount: tradeData.totalAmount
    }, req.user.id);

    // Notify via WebSocket
    websocketService.broadcastTradeUpdate(trade.id, {
      type: 'blockchain_created',
      txHash: tx.hash
    });

    res.json({
      success: true,
      message: 'Escrow trade created on blockchain',
      transactionHash: tx.hash,
      tradeId: trade.id
    });

  } catch (error) {
    logUtils.logError(error, { action: 'create_escrow_trade' }, req);
    res.status(500).json({ error: 'Failed to create escrow trade' });
  }
});

// Make deposit to escrow
router.post('/escrow/deposit', authMiddleware.requireAuth, async (req, res) => {
  try {
    if (!blockchainService.isContractsReady()) {
      return res.status(503).json({ error: 'Blockchain contracts not ready' });
    }

    const db = await getDatabase();
    const { tradeId, amount } = req.body;
    
    if (!tradeId || !amount) {
      return res.status(400).json({ error: 'Trade ID and amount required' });
    }

    // Get trade from database
    const trade = await db.findById('trades', tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    // Check if user is the buyer
    if (trade.buyer !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the buyer can make deposits' });
    }

    const tx = await blockchainService.depositToEscrow(tradeId, amount);

    // Update trade status
    await db.update('trades', trade.id, {
      buyer_deposit_paid: true,
      blockchain_deposit_tx: tx.hash
    });

    // Log deposit
    logUtils.logBusiness('blockchain_deposit', {
      tradeId: trade.id,
      amount,
      txHash: tx.hash,
      buyer: req.user.id
    }, req.user.id);

    // Notify via WebSocket
    websocketService.broadcastTradeUpdate(trade.id, {
      type: 'deposit_made',
      amount,
      txHash: tx.hash
    });

    res.json({
      success: true,
      message: 'Deposit made to escrow',
      transactionHash: tx.hash,
      amount
    });

  } catch (error) {
    logUtils.logError(error, { action: 'escrow_deposit' }, req);
    res.status(500).json({ error: 'Failed to make escrow deposit' });
  }
});

// Confirm delivery
router.post('/escrow/confirm-delivery', authMiddleware.requireAuth, async (req, res) => {
  try {
    if (!blockchainService.isContractsReady()) {
      return res.status(503).json({ error: 'Blockchain contracts not ready' });
    }

    const db = await getDatabase();
    const { tradeId } = req.body;
    
    if (!tradeId) {
      return res.status(400).json({ error: 'Trade ID required' });
    }

    // Get trade from database
    const trade = await db.findById('trades', tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    // Check if user is the supplier
    if (trade.supplier !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the supplier can confirm delivery' });
    }

    const tx = await blockchainService.confirmDelivery(tradeId);

    // Update trade status
    await db.update('trades', trade.id, {
      supplier_confirmed: true,
      docs_uploaded: true,
      blockchain_delivery_tx: tx.hash
    });

    // Log delivery confirmation
    logUtils.logBusiness('blockchain_delivery_confirmed', {
      tradeId: trade.id,
      txHash: tx.hash,
      supplier: req.user.id
    }, req.user.id);

    // Notify via WebSocket
    websocketService.broadcastTradeUpdate(trade.id, {
      type: 'delivery_confirmed',
      txHash: tx.hash
    });

    res.json({
      success: true,
      message: 'Delivery confirmed on blockchain',
      transactionHash: tx.hash
    });

  } catch (error) {
    logUtils.logError(error, { action: 'confirm_delivery' }, req);
    res.status(500).json({ error: 'Failed to confirm delivery' });
  }
});

// Release funds (buyer confirms receipt)
router.post('/escrow/release-funds', authMiddleware.requireAuth, async (req, res) => {
  try {
    if (!blockchainService.isContractsReady()) {
      return res.status(503).json({ error: 'Blockchain contracts not ready' });
    }

    const db = await getDatabase();
    const { tradeId } = req.body;
    
    if (!tradeId) {
      return res.status(400).json({ error: 'Trade ID required' });
    }

    // Get trade from database
    const trade = await db.findById('trades', tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    // Check if user is the buyer or admin
    if (trade.buyer !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the buyer can release funds' });
    }

    const tx = await blockchainService.releaseFunds(tradeId);

    // Update trade status to completed
    await db.update('trades', trade.id, {
      completed: true,
      final_payment_made: true,
      status: 'completed',
      blockchain_release_tx: tx.hash
    });

    // Log fund release
    logUtils.logBusiness('blockchain_funds_released', {
      tradeId: trade.id,
      txHash: tx.hash,
      buyer: req.user.id
    }, req.user.id);

    // Notify via WebSocket
    websocketService.broadcastTradeUpdate(trade.id, {
      type: 'funds_released',
      txHash: tx.hash,
      status: 'completed'
    });

    res.json({
      success: true,
      message: 'Funds released to supplier',
      transactionHash: tx.hash
    });

  } catch (error) {
    logUtils.logError(error, { action: 'release_funds' }, req);
    res.status(500).json({ error: 'Failed to release funds' });
  }
});

// Get escrow trade status
router.get('/escrow/trade/:tradeId', authMiddleware.requireAuth, async (req, res) => {
  try {
    if (!blockchainService.isContractsReady()) {
      return res.status(503).json({ error: 'Blockchain contracts not ready' });
    }

    const { tradeId } = req.params;
    
    const tradeStatus = await blockchainService.getEscrowTradeStatus(tradeId);

    res.json({
      success: true,
      trade: tradeStatus
    });

  } catch (error) {
    logUtils.logError(error, { action: 'get_escrow_status', tradeId: req.params.tradeId }, req);
    res.status(500).json({ error: 'Failed to get escrow trade status' });
  }
});

// Get gas prices
router.get('/gas-price', authMiddleware.requireAuth, async (req, res) => {
  try {
    if (!blockchainService.isReady()) {
      return res.status(503).json({ error: 'Blockchain service not ready' });
    }

    const gasData = await blockchainService.getGasPrice();

    res.json({
      success: true,
      gas: gasData
    });

  } catch (error) {
    logUtils.logError(error, { action: 'get_gas_price' }, req);
    res.status(500).json({ error: 'Failed to get gas price' });
  }
});

// Get ETH balance
router.get('/balance/:address', authMiddleware.requireAuth, async (req, res) => {
  try {
    if (!blockchainService.isReady()) {
      return res.status(503).json({ error: 'Blockchain service not ready' });
    }

    const { address } = req.params;
    
    // Security check
    if (address !== req.user.walletAddress && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const balance = await blockchainService.getBalance(address);

    res.json({
      success: true,
      address,
      balance
    });

  } catch (error) {
    logUtils.logError(error, { action: 'get_eth_balance', address: req.params.address }, req);
    res.status(500).json({ error: 'Failed to get ETH balance' });
  }
});

// Wait for transaction confirmation
router.get('/transaction/:txHash/wait', authMiddleware.requireAuth, async (req, res) => {
  try {
    if (!blockchainService.isReady()) {
      return res.status(503).json({ error: 'Blockchain service not ready' });
    }

    const { txHash } = req.params;
    const { confirmations = 1 } = req.query;
    
    const receipt = await blockchainService.waitForTransaction(txHash, parseInt(confirmations));

    res.json({
      success: true,
      receipt: {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        confirmations: receipt.confirmations,
        status: receipt.status,
        gasUsed: receipt.gasUsed.toString()
      }
    });

  } catch (error) {
    logUtils.logError(error, { action: 'wait_for_transaction', txHash: req.params.txHash }, req);
    res.status(500).json({ error: 'Failed to wait for transaction' });
  }
});

// Admin: Pause escrow contract
router.post('/escrow/pause', authMiddleware.requireAdmin, async (req, res) => {
  try {
    if (!blockchainService.isContractsReady()) {
      return res.status(503).json({ error: 'Blockchain contracts not ready' });
    }

    const tx = await blockchainService.pauseEscrow();

    logUtils.logBusiness('escrow_paused', {
      txHash: tx.hash,
      admin: req.user.id
    }, req.user.id);

    res.json({
      success: true,
      message: 'Escrow contract paused',
      transactionHash: tx.hash
    });

  } catch (error) {
    logUtils.logError(error, { action: 'pause_escrow' }, req);
    res.status(500).json({ error: 'Failed to pause escrow' });
  }
});

// Admin: Unpause escrow contract
router.post('/escrow/unpause', authMiddleware.requireAdmin, async (req, res) => {
  try {
    if (!blockchainService.isContractsReady()) {
      return res.status(503).json({ error: 'Blockchain contracts not ready' });
    }

    const tx = await blockchainService.unpauseEscrow();

    logUtils.logBusiness('escrow_unpaused', {
      txHash: tx.hash,
      admin: req.user.id
    }, req.user.id);

    res.json({
      success: true,
      message: 'Escrow contract unpaused',
      transactionHash: tx.hash
    });

  } catch (error) {
    logUtils.logError(error, { action: 'unpause_escrow' }, req);
    res.status(500).json({ error: 'Failed to unpause escrow' });
  }
});

module.exports = router;


