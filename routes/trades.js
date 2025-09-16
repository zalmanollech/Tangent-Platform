const express = require('express');
const router = express.Router();
const { getDatabase } = require('../lib/database');
const { authMiddleware, validationRules, handleValidationErrors } = require('../lib/security');
const { logUtils } = require('../lib/logger');
const websocketService = require('../lib/websocket');
const { config } = require('../lib/config');
const { ethers } = require('ethers');

// Helper function to calculate trade financials
function calculateTradeFinancials(trade, settings = {}) {
  const qty = Number(trade.quantity || trade.qty || 0);
  const unitPrice = Number(trade.unitPrice || trade.price || 0);
  const totalValue = qty * unitPrice;
  
  const depositPct = Number(trade.depositPct || trade.depositPercentage || 30);
  const financePct = Number(trade.financePct || trade.advancePercentage || 70);
  
  const feePercent = settings.feePercent || config.defaults.feePercent;
  const insurancePremiumPercent = settings.insurancePremiumPercent || config.defaults.insurancePremiumPercent;
  
  const depositAmount = (totalValue * depositPct) / 100;
  const advanceAmount = (totalValue * financePct) / 100;
  const platformFee = totalValue * (feePercent / 100);
  const insurancePremium = trade.insuranceApplied ? (totalValue * (insurancePremiumPercent / 100)) : 0;
  
  return {
    ...trade,
    totalValue,
    depositAmount,
    advanceAmount,
    platformFee,
    insurancePremium,
    netAmount: totalValue - platformFee - insurancePremium
  };
}

// Helper function to check blockchain integration
function isBlockchainEnabled() {
  return Boolean(config.blockchain.sepoliaRpcUrl && config.blockchain.escrowAddress);
}

// Get all trades (with filtering)
router.get('/', authMiddleware.optionalAuth, (req, res) => {
  try {
    const db = getDatabase();
    const { status, commodity, limit = 50, offset = 0 } = req.query;
    
    let trades = db.find('trades');
    
    // Apply filters
    if (status) {
      trades = trades.filter(t => t.status === status);
    }
    if (commodity) {
      trades = trades.filter(t => t.commodity?.toLowerCase().includes(commodity.toLowerCase()));
    }
    
    // Sort by creation date (newest first)
    trades.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Apply pagination
    const paginatedTrades = trades.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    // Calculate financials for each trade
    const settings = db.getAll().settings || {};
    const enrichedTrades = paginatedTrades.map(trade => calculateTradeFinancials(trade, settings));
    
    res.json({
      success: true,
      trades: enrichedTrades,
      pagination: {
        total: trades.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
    
  } catch (error) {
    logUtils.logError(error, { action: 'list_trades' }, req);
    res.status(500).json({ error: 'Failed to list trades' });
  }
});

// Get user's trades
router.get('/my-trades', authMiddleware.requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    
    // Find trades where user is buyer or supplier
    const trades = db.find('trades').filter(trade => 
      trade.buyerId === userId || trade.supplierId === userId
    );
    
    // Sort by creation date (newest first)
    trades.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Calculate financials
    const settings = db.getAll().settings || {};
    const enrichedTrades = trades.map(trade => calculateTradeFinancials(trade, settings));
    
    res.json({
      success: true,
      trades: enrichedTrades
    });
    
  } catch (error) {
    logUtils.logError(error, { action: 'get_my_trades' }, req);
    res.status(500).json({ error: 'Failed to get your trades' });
  }
});

// Get specific trade
router.get('/:id', authMiddleware.optionalAuth, (req, res) => {
  try {
    const db = getDatabase();
    const tradeId = req.params.id;
    
    const trade = db.findById('trades', tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    
    // Check if user has access to this trade
    if (req.user && trade.buyerId !== req.user.id && trade.supplierId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Calculate financials
    const settings = db.getAll().settings || {};
    const enrichedTrade = calculateTradeFinancials(trade, settings);
    
    res.json({
      success: true,
      trade: enrichedTrade
    });
    
  } catch (error) {
    logUtils.logError(error, { action: 'get_trade' }, req);
    res.status(500).json({ error: 'Failed to get trade' });
  }
});

// Create new trade
router.post('/', authMiddleware.requireAuth, validationRules.trade, handleValidationErrors, async (req, res) => {
  try {
    const db = getDatabase();
    const {
      commodity,
      quantity,
      unitPrice,
      supplier,
      buyer,
      depositPct = 30,
      financePct = 70,
      incoterms = 'FOB',
      insuranceApplied = false,
      description
    } = req.body;
    
    // Validate percentages add up correctly
    if (depositPct + financePct !== 100) {
      return res.status(400).json({ error: 'Deposit and finance percentages must total 100%' });
    }
    
    // Validate addresses are different
    if (supplier === buyer) {
      return res.status(400).json({ error: 'Supplier and buyer addresses must be different' });
    }
    
    // Create trade record
    const tradeData = {
      commodity: commodity.trim(),
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      supplier,
      buyer,
      depositPct: Number(depositPct),
      financePct: Number(financePct),
      incoterms,
      insuranceApplied: Boolean(insuranceApplied),
      description: description?.trim() || '',
      status: 'created',
      creatorId: req.user.id,
      creatorRole: req.user.role,
      buyerDepositPaid: false,
      supplierConfirmed: false,
      docsUploaded: false,
      keyIssued: false,
      finalPaymentMade: false,
      completed: false,
      blockchainTxHash: null,
      blockchainTradeId: null
    };
    
    const trade = db.create('trades', tradeData);
    
    // Calculate financials
    const settings = db.getAll().settings || {};
    const enrichedTrade = calculateTradeFinancials(trade, settings);
    
    // Log trade creation
    logUtils.logBusiness('trade_created', {
      tradeId: trade.id,
      commodity,
      totalValue: enrichedTrade.totalValue,
      supplier,
      buyer
    }, req.user.id);
    
    // If blockchain is enabled, attempt to create on-chain trade
    if (isBlockchainEnabled()) {
      try {
        // This would be implemented with actual blockchain interaction
        logUtils.logBlockchain('trade_creation_initiated', {
          tradeId: trade.id,
          supplier,
          buyer,
          amount: enrichedTrade.totalValue
        }, req.user.id);
      } catch (blockchainError) {
        logUtils.logError(blockchainError, { action: 'blockchain_trade_creation', tradeId: trade.id }, req);
        // Continue without blockchain for now
      }
    }
    
    // Broadcast new trade to all subscribers
    websocketService.broadcastNewTrade(enrichedTrade);
    
    // Notify users if they're specified
    if (supplier !== req.user.id) {
      websocketService.notifyUser(supplier, 'new_trade_as_supplier', enrichedTrade);
    }
    if (buyer !== req.user.id) {
      websocketService.notifyUser(buyer, 'new_trade_as_buyer', enrichedTrade);
    }
    
    res.status(201).json({
      success: true,
      message: 'Trade created successfully',
      trade: enrichedTrade
    });
    
  } catch (error) {
    logUtils.logError(error, { action: 'create_trade' }, req);
    res.status(500).json({ error: 'Failed to create trade' });
  }
});

// Update trade status
router.patch('/:id/status', authMiddleware.requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const tradeId = req.params.id;
    const { status, notes } = req.body;
    
    const validStatuses = [
      'created', 'awaiting_deposit', 'deposit_paid', 'confirmed',
      'documents_uploaded', 'documents_verified', 'key_issued',
      'final_payment_made', 'completed', 'cancelled', 'disputed'
    ];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const trade = db.findById('trades', tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    
    // Check if user has permission to update this trade
    if (trade.buyerId !== req.user.id && trade.supplierId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Update trade
    const updates = {
      status,
      statusUpdatedAt: new Date().toISOString(),
      statusUpdatedBy: req.user.id
    };
    
    if (notes) {
      updates.statusNotes = [...(trade.statusNotes || []), {
        note: notes,
        addedBy: req.user.id,
        addedAt: new Date().toISOString()
      }];
    }
    
    const updatedTrade = db.update('trades', tradeId, updates);
    
    // Calculate financials
    const settings = db.getAll().settings || {};
    const enrichedTrade = calculateTradeFinancials(updatedTrade, settings);
    
    // Log status update
    logUtils.logBusiness('trade_status_updated', {
      tradeId,
      oldStatus: trade.status,
      newStatus: status,
      notes
    }, req.user.id);
    
    res.json({
      success: true,
      message: 'Trade status updated successfully',
      trade: enrichedTrade
    });
    
  } catch (error) {
    logUtils.logError(error, { action: 'update_trade_status' }, req);
    res.status(500).json({ error: 'Failed to update trade status' });
  }
});

// Make deposit
router.post('/:id/deposit', authMiddleware.requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const tradeId = req.params.id;
    const { txHash } = req.body;
    
    const trade = db.findById('trades', tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    
    // Check if user is the buyer
    if (trade.buyer !== req.user.address && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the buyer can make deposits' });
    }
    
    // Check if deposit already made
    if (trade.buyerDepositPaid) {
      return res.status(400).json({ error: 'Deposit already paid' });
    }
    
    // Update trade
    const updates = {
      buyerDepositPaid: true,
      depositPaidAt: new Date().toISOString(),
      depositTxHash: txHash || null,
      status: trade.supplierConfirmed ? 'confirmed' : 'awaiting_supplier_confirmation'
    };
    
    const updatedTrade = db.update('trades', tradeId, updates);
    
    // Calculate financials
    const settings = db.getAll().settings || {};
    const enrichedTrade = calculateTradeFinancials(updatedTrade, settings);
    
    // Log deposit
    logUtils.logBusiness('trade_deposit_made', {
      tradeId,
      depositAmount: enrichedTrade.depositAmount,
      txHash
    }, req.user.id);
    
    if (txHash) {
      logUtils.logBlockchain('deposit_made', {
        tradeId,
        txHash,
        amount: enrichedTrade.depositAmount
      }, req.user.id);
    }
    
    res.json({
      success: true,
      message: 'Deposit recorded successfully',
      trade: enrichedTrade
    });
    
  } catch (error) {
    logUtils.logError(error, { action: 'make_deposit' }, req);
    res.status(500).json({ error: 'Failed to record deposit' });
  }
});

// Confirm trade (supplier)
router.post('/:id/confirm', authMiddleware.requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const tradeId = req.params.id;
    
    const trade = db.findById('trades', tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    
    // Check if user is the supplier
    if (trade.supplier !== req.user.address && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the supplier can confirm trades' });
    }
    
    // Check if already confirmed
    if (trade.supplierConfirmed) {
      return res.status(400).json({ error: 'Trade already confirmed' });
    }
    
    // Update trade
    const updates = {
      supplierConfirmed: true,
      confirmedAt: new Date().toISOString(),
      status: trade.buyerDepositPaid ? 'confirmed' : 'awaiting_deposit'
    };
    
    const updatedTrade = db.update('trades', tradeId, updates);
    
    // Calculate financials
    const settings = db.getAll().settings || {};
    const enrichedTrade = calculateTradeFinancials(updatedTrade, settings);
    
    // Log confirmation
    logUtils.logBusiness('trade_confirmed', {
      tradeId,
      confirmedBy: req.user.id
    }, req.user.id);
    
    res.json({
      success: true,
      message: 'Trade confirmed successfully',
      trade: enrichedTrade
    });
    
  } catch (error) {
    logUtils.logError(error, { action: 'confirm_trade' }, req);
    res.status(500).json({ error: 'Failed to confirm trade' });
  }
});

// Get trade analytics
router.get('/analytics/summary', authMiddleware.requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const { timeframe = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    switch (timeframe) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    const trades = db.find('trades').filter(trade => 
      new Date(trade.createdAt) >= startDate
    );
    
    // Calculate analytics
    const settings = db.getAll().settings || {};
    const analytics = {
      totalTrades: trades.length,
      totalValue: 0,
      completedTrades: 0,
      pendingTrades: 0,
      averageTradeValue: 0,
      topCommodities: {},
      statusDistribution: {},
      volumeByDay: {}
    };
    
    trades.forEach(trade => {
      const enrichedTrade = calculateTradeFinancials(trade, settings);
      
      analytics.totalValue += enrichedTrade.totalValue;
      
      if (trade.status === 'completed') {
        analytics.completedTrades++;
      } else {
        analytics.pendingTrades++;
      }
      
      // Count commodities
      if (trade.commodity) {
        analytics.topCommodities[trade.commodity] = (analytics.topCommodities[trade.commodity] || 0) + 1;
      }
      
      // Count statuses
      analytics.statusDistribution[trade.status] = (analytics.statusDistribution[trade.status] || 0) + 1;
      
      // Volume by day
      const day = trade.createdAt.split('T')[0];
      analytics.volumeByDay[day] = (analytics.volumeByDay[day] || 0) + enrichedTrade.totalValue;
    });
    
    analytics.averageTradeValue = trades.length > 0 ? analytics.totalValue / trades.length : 0;
    
    res.json({
      success: true,
      analytics,
      timeframe
    });
    
  } catch (error) {
    logUtils.logError(error, { action: 'get_trade_analytics' }, req);
    res.status(500).json({ error: 'Failed to get trade analytics' });
  }
});

module.exports = router;
