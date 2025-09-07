const { ethers } = require('ethers');
const crypto = require('crypto');

// Trade Management Service
class TradeService {
  constructor() {
    this.tradeStatuses = {
      'draft': 'Draft',
      'pending_deposit': 'Pending Deposit',
      'deposit_received': 'Deposit Received',
      'pending_advance': 'Pending Advance',
      'advance_paid': 'Advance Paid',
      'documents_uploaded': 'Documents Uploaded',
      'key_issued': 'Key Issued',
      'final_payment_pending': 'Final Payment Pending',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'disputed': 'Disputed'
    };

    this.documentTypes = {
      0: 'eBL (Electronic Bill of Lading)',
      1: 'Commercial Invoice',
      2: 'Packing List',
      3: 'Certificate of Origin',
      4: 'Insurance Certificate'
    };

    this.riskLevels = {
      'low': { score: 0, color: 'green', description: 'Low Risk' },
      'medium': { score: 1, color: 'yellow', description: 'Medium Risk' },
      'high': { score: 2, color: 'red', description: 'High Risk' }
    };
  }

  // Create a new trade
  async createTrade(tradeData) {
    const trade = {
      id: this.generateTradeId(),
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      
      // Parties
      supplier: tradeData.supplier,
      buyer: tradeData.buyer,
      trader: tradeData.trader || null,
      
      // Trade details
      commodity: tradeData.commodity || '',
      quantity: tradeData.quantity || 0,
      unit: tradeData.unit || 'MT',
      price: tradeData.price || 0,
      totalValue: tradeData.totalValue || 0,
      currency: tradeData.currency || 'USD',
      
      // Financial structure
      depositPercentage: tradeData.depositPercentage || 30,
      advancePercentage: tradeData.advancePercentage || 70,
      depositAmount: 0,
      advanceAmount: 0,
      finalAmount: 0,
      
      // Payment tracking
      payments: {
        deposit: { amount: 0, status: 'pending', txHash: null, timestamp: null },
        advance: { amount: 0, status: 'pending', txHash: null, timestamp: null },
        final: { amount: 0, status: 'pending', txHash: null, timestamp: null }
      },
      
      // Document management
      documents: [],
      documentKey: null,
      keyIssuedAt: null,
      
      // Risk assessment
      riskLevel: 'medium',
      riskFactors: [],
      
      // Timeline
      timeline: [{
        status: 'draft',
        timestamp: new Date().toISOString(),
        description: 'Trade created',
        actor: tradeData.createdBy || 'system'
      }],
      
      // Metadata
      metadata: {
        incoterms: tradeData.incoterms || 'FOB',
        portOfLoading: tradeData.portOfLoading || '',
        portOfDischarge: tradeData.portOfDischarge || '',
        expectedDelivery: tradeData.expectedDelivery || '',
        specialInstructions: tradeData.specialInstructions || ''
      }
    };

    // Calculate financial amounts
    this.calculateFinancials(trade);
    
    // Assess initial risk
    this.assessRisk(trade);

    return trade;
  }

  // Calculate financial amounts
  calculateFinancials(trade) {
    const totalValue = trade.totalValue;
    const depositPct = trade.depositPercentage / 100;
    const advancePct = trade.advancePercentage / 100;
    
    trade.depositAmount = Math.round(totalValue * depositPct * 100) / 100;
    trade.advanceAmount = Math.round(totalValue * advancePct * 100) / 100;
    trade.finalAmount = Math.round((totalValue - trade.depositAmount - trade.advanceAmount) * 100) / 100;
    
    // Update payment amounts
    trade.payments.deposit.amount = trade.depositAmount;
    trade.payments.advance.amount = trade.advanceAmount;
    trade.payments.final.amount = trade.finalAmount;
  }

  // Assess trade risk
  assessRisk(trade) {
    const riskFactors = [];
    let riskScore = 0;

    // Check total value
    if (trade.totalValue > 1000000) {
      riskFactors.push('High value trade (>$1M)');
      riskScore += 2;
    } else if (trade.totalValue > 500000) {
      riskFactors.push('Medium value trade (>$500K)');
      riskScore += 1;
    }

    // Check deposit percentage
    if (trade.depositPercentage < 20) {
      riskFactors.push('Low deposit percentage (<20%)');
      riskScore += 2;
    } else if (trade.depositPercentage < 30) {
      riskFactors.push('Below standard deposit percentage (<30%)');
      riskScore += 1;
    }

    // Check commodity type
    const highRiskCommodities = ['oil', 'gas', 'precious metals', 'rare earth'];
    if (highRiskCommodities.some(commodity => 
      trade.commodity.toLowerCase().includes(commodity))) {
      riskFactors.push('High-risk commodity');
      riskScore += 1;
    }

    // Check delivery timeline
    const deliveryDate = new Date(trade.metadata.expectedDelivery);
    const now = new Date();
    const daysToDelivery = Math.ceil((deliveryDate - now) / (1000 * 60 * 60 * 24));
    
    if (daysToDelivery < 30) {
      riskFactors.push('Short delivery timeline (<30 days)');
      riskScore += 1;
    }

    // Determine risk level
    if (riskScore >= 4) {
      trade.riskLevel = 'high';
    } else if (riskScore >= 2) {
      trade.riskLevel = 'medium';
    } else {
      trade.riskLevel = 'low';
    }

    trade.riskFactors = riskFactors;
  }

  // Update trade status
  updateTradeStatus(trade, newStatus, actor = 'system', description = null) {
    const oldStatus = trade.status;
    trade.status = newStatus;
    trade.updatedAt = new Date().toISOString();

    // Add to timeline
    trade.timeline.push({
      status: newStatus,
      timestamp: new Date().toISOString(),
      description: description || `${oldStatus} → ${newStatus}`,
      actor: actor
    });

    // Update payment statuses based on trade status
    this.updatePaymentStatuses(trade, newStatus);
  }

  // Update payment statuses based on trade status
  updatePaymentStatuses(trade, status) {
    switch (status) {
      case 'deposit_received':
        trade.payments.deposit.status = 'completed';
        break;
      case 'advance_paid':
        trade.payments.advance.status = 'completed';
        break;
      case 'completed':
        trade.payments.final.status = 'completed';
        break;
    }
  }

  // Add document to trade
  addDocument(trade, documentData) {
    const document = {
      id: this.generateDocumentId(),
      type: documentData.type,
      typeName: this.documentTypes[documentData.type] || 'Unknown',
      name: documentData.name,
      hash: documentData.hash,
      uri: documentData.uri,
      uploadedBy: documentData.uploadedBy,
      uploadedAt: new Date().toISOString(),
      verified: false,
      verificationHash: null
    };

    trade.documents.push(document);
    trade.updatedAt = new Date().toISOString();

    // Update status if this is the first document
    if (trade.documents.length === 1) {
      this.updateTradeStatus(trade, 'documents_uploaded', documentData.uploadedBy, 'First document uploaded');
    }

    return document;
  }

  // Issue document key
  issueDocumentKey(trade, issuedBy) {
    if (trade.documents.length === 0) {
      throw new Error('No documents available to issue key for');
    }

    // Generate document key
    const documentHashes = trade.documents.map(doc => doc.hash).join('');
    trade.documentKey = crypto.createHash('sha256').update(documentHashes).digest('hex');
    trade.keyIssuedAt = new Date().toISOString();

    // Update status
    this.updateTradeStatus(trade, 'key_issued', issuedBy, 'Document key issued to buyer');

    return trade.documentKey;
  }

  // Record payment
  recordPayment(trade, paymentType, amount, txHash, paidBy) {
    if (!trade.payments[paymentType]) {
      throw new Error(`Invalid payment type: ${paymentType}`);
    }

    const payment = trade.payments[paymentType];
    payment.amount = amount;
    payment.status = 'completed';
    payment.txHash = txHash;
    payment.timestamp = new Date().toISOString();
    payment.paidBy = paidBy;

    // Update trade status based on payment type
    switch (paymentType) {
      case 'deposit':
        this.updateTradeStatus(trade, 'deposit_received', paidBy, '30% deposit received');
        break;
      case 'advance':
        this.updateTradeStatus(trade, 'advance_paid', paidBy, '70% advance payment received');
        break;
      case 'final':
        this.updateTradeStatus(trade, 'completed', paidBy, 'Final payment received - Trade completed');
        break;
    }

    return payment;
  }

  // Get trade summary
  getTradeSummary(trade) {
    return {
      id: trade.id,
      status: trade.status,
      statusName: this.tradeStatuses[trade.status],
      supplier: trade.supplier,
      buyer: trade.buyer,
      commodity: trade.commodity,
      quantity: trade.quantity,
      unit: trade.unit,
      totalValue: trade.totalValue,
      currency: trade.currency,
      riskLevel: trade.riskLevel,
      riskFactors: trade.riskFactors,
      createdAt: trade.createdAt,
      updatedAt: trade.updatedAt,
      progress: this.calculateProgress(trade),
      payments: {
        deposit: { ...trade.payments.deposit, percentage: trade.depositPercentage },
        advance: { ...trade.payments.advance, percentage: trade.advancePercentage },
        final: { ...trade.payments.final, percentage: 100 - trade.depositPercentage - trade.advancePercentage }
      },
      documentsCount: trade.documents.length,
      hasDocumentKey: !!trade.documentKey
    };
  }

  // Calculate trade progress
  calculateProgress(trade) {
    let progress = 0;
    
    if (trade.payments.deposit.status === 'completed') progress += 30;
    if (trade.payments.advance.status === 'completed') progress += 40;
    if (trade.documents.length > 0) progress += 10;
    if (trade.documentKey) progress += 10;
    if (trade.payments.final.status === 'completed') progress += 10;
    
    return Math.min(100, progress);
  }

  // Generate trade ID
  generateTradeId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `TRD-${timestamp}-${random}`.toUpperCase();
  }

  // Generate document ID
  generateDocumentId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `DOC-${timestamp}-${random}`.toUpperCase();
  }

  // Validate trade data
  validateTradeData(tradeData) {
    const errors = [];

    if (!tradeData.supplier) {
      errors.push('Supplier address is required');
    }

    if (!tradeData.buyer) {
      errors.push('Buyer address is required');
    }

    if (!tradeData.commodity) {
      errors.push('Commodity type is required');
    }

    if (!tradeData.quantity || tradeData.quantity <= 0) {
      errors.push('Valid quantity is required');
    }

    if (!tradeData.price || tradeData.price <= 0) {
      errors.push('Valid price is required');
    }

    if (tradeData.depositPercentage < 10 || tradeData.depositPercentage > 50) {
      errors.push('Deposit percentage must be between 10% and 50%');
    }

    if (tradeData.advancePercentage < 30 || tradeData.advancePercentage > 80) {
      errors.push('Advance percentage must be between 30% and 80%');
    }

    if (tradeData.depositPercentage + tradeData.advancePercentage >= 100) {
      errors.push('Deposit and advance percentages must total less than 100%');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Get trade statistics
  getTradeStatistics(trades) {
    const stats = {
      total: trades.length,
      byStatus: {},
      byRiskLevel: {},
      totalValue: 0,
      averageValue: 0,
      completedTrades: 0,
      activeTrades: 0
    };

    trades.forEach(trade => {
      // Count by status
      stats.byStatus[trade.status] = (stats.byStatus[trade.status] || 0) + 1;
      
      // Count by risk level
      stats.byRiskLevel[trade.riskLevel] = (stats.byRiskLevel[trade.riskLevel] || 0) + 1;
      
      // Sum total value
      stats.totalValue += trade.totalValue;
      
      // Count completed and active trades
      if (trade.status === 'completed') {
        stats.completedTrades++;
      } else if (!['cancelled', 'disputed'].includes(trade.status)) {
        stats.activeTrades++;
      }
    });

    stats.averageValue = stats.total > 0 ? stats.totalValue / stats.total : 0;

    return stats;
  }
}

module.exports = new TradeService();
