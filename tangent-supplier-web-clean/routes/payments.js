const express = require('express');
const router = express.Router();
const { getDatabase } = require('../lib/database-enhanced');
const { authMiddleware, validationRules, handleValidationErrors } = require('../lib/security');
const { logUtils } = require('../lib/logger');
const paymentService = require('../lib/payments');
const websocketService = require('../lib/websocket');
const emailService = require('../lib/email');

// Create payment intent for trade deposit
router.post('/trade/:tradeId/deposit', authMiddleware.requireAuth, async (req, res) => {
  try {
    if (!paymentService.isConfigured()) {
      return res.status(503).json({ error: 'Payment service not available' });
    }

    const db = await getDatabase();
    const tradeId = req.params.tradeId;
    
    const trade = await db.findById('trades', tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    // Check if user is the buyer
    if (trade.buyer !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the buyer can make deposit payments' });
    }

    // Check if deposit already paid
    if (trade.buyer_deposit_paid || trade.buyerDepositPaid) {
      return res.status(400).json({ error: 'Deposit already paid for this trade' });
    }

    const customerData = {
      userId: req.user.id,
      email: req.user.email,
      fullName: req.user.fullName || req.user.email.split('@')[0],
      role: req.user.role
    };

    const paymentIntent = await paymentService.createTradeDepositPayment(trade, customerData);

    // Log payment initiation
    logUtils.logBusiness('payment_initiated', {
      type: 'trade_deposit',
      tradeId: trade.id,
      amount: trade.depositAmount || (trade.total_value * (trade.deposit_pct / 100)),
      paymentIntentId: paymentIntent.paymentIntentId
    }, req.user.id);

    res.json({
      success: true,
      clientSecret: paymentIntent.clientSecret,
      paymentIntentId: paymentIntent.paymentIntentId,
      amount: paymentIntent.amount
    });

  } catch (error) {
    logUtils.logError(error, { action: 'create_deposit_payment', tradeId: req.params.tradeId }, req);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Create payment intent for final trade payment
router.post('/trade/:tradeId/final-payment', authMiddleware.requireAuth, async (req, res) => {
  try {
    if (!paymentService.isConfigured()) {
      return res.status(503).json({ error: 'Payment service not available' });
    }

    const db = await getDatabase();
    const tradeId = req.params.tradeId;
    
    const trade = await db.findById('trades', tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    // Check if user is the buyer
    if (trade.buyer !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the buyer can make final payments' });
    }

    // Check if deposit was paid and trade is ready for final payment
    if (!trade.buyer_deposit_paid && !trade.buyerDepositPaid) {
      return res.status(400).json({ error: 'Deposit must be paid before final payment' });
    }

    if (!trade.supplier_confirmed && !trade.supplierConfirmed) {
      return res.status(400).json({ error: 'Supplier must confirm before final payment' });
    }

    // Check if final payment already made
    if (trade.final_payment_made || trade.finalPaymentMade) {
      return res.status(400).json({ error: 'Final payment already made for this trade' });
    }

    const customerData = {
      userId: req.user.id,
      email: req.user.email,
      fullName: req.user.fullName || req.user.email.split('@')[0],
      role: req.user.role
    };

    const paymentIntent = await paymentService.createFinalTradePayment(trade, customerData);

    // Log payment initiation
    logUtils.logBusiness('payment_initiated', {
      type: 'trade_final_payment',
      tradeId: trade.id,
      amount: paymentIntent.amount,
      paymentIntentId: paymentIntent.paymentIntentId
    }, req.user.id);

    res.json({
      success: true,
      clientSecret: paymentIntent.clientSecret,
      paymentIntentId: paymentIntent.paymentIntentId,
      amount: paymentIntent.amount
    });

  } catch (error) {
    logUtils.logError(error, { action: 'create_final_payment', tradeId: req.params.tradeId }, req);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Create subscription for premium features
router.post('/subscription', authMiddleware.requireAuth, async (req, res) => {
  try {
    if (!paymentService.isConfigured()) {
      return res.status(503).json({ error: 'Payment service not available' });
    }

    const { planId } = req.body;
    
    // Define available plans
    const plans = {
      'premium_trader': {
        planId: 'premium_trader',
        planName: 'Premium Trader',
        description: 'Advanced trading features and lower fees',
        monthlyAmount: 49.99
      },
      'professional_trader': {
        planId: 'professional_trader',
        planName: 'Professional Trader',
        description: 'Full access to all platform features',
        monthlyAmount: 99.99
      }
    };

    if (!plans[planId]) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    const planData = plans[planId];
    const customerData = {
      userId: req.user.id,
      email: req.user.email,
      fullName: req.user.fullName || req.user.email.split('@')[0],
      role: req.user.role
    };

    const subscription = await paymentService.createSubscriptionPayment(planData, customerData);

    // Log subscription creation
    logUtils.logBusiness('subscription_initiated', {
      planId,
      subscriptionId: subscription.subscriptionId,
      monthlyAmount: planData.monthlyAmount
    }, req.user.id);

    res.json({
      success: true,
      clientSecret: subscription.clientSecret,
      subscriptionId: subscription.subscriptionId
    });

  } catch (error) {
    logUtils.logError(error, { action: 'create_subscription' }, req);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Handle Stripe webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe signature' });
    }

    const result = await paymentService.handleWebhook(req.body, signature);
    
    res.json(result);

  } catch (error) {
    logUtils.logError(error, { action: 'process_webhook' }, req);
    res.status(400).json({ error: 'Webhook handling failed' });
  }
});

// Get payment status
router.get('/payment-intent/:paymentIntentId', authMiddleware.requireAuth, async (req, res) => {
  try {
    if (!paymentService.isConfigured()) {
      return res.status(503).json({ error: 'Payment service not available' });
    }

    const { paymentIntentId } = req.params;
    
    const paymentIntent = await paymentService.getPaymentIntent(paymentIntentId);
    
    // Basic security check - ensure user can access this payment intent
    if (paymentIntent.metadata.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      success: true,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      created: paymentIntent.created,
      metadata: paymentIntent.metadata
    });

  } catch (error) {
    logUtils.logError(error, { action: 'get_payment_status', paymentIntentId: req.params.paymentIntentId }, req);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
});

// Get user's payment methods
router.get('/payment-methods', authMiddleware.requireAuth, async (req, res) => {
  try {
    if (!paymentService.isConfigured()) {
      return res.status(503).json({ error: 'Payment service not available' });
    }

    // Find user's Stripe customer ID (you'd store this in the database)
    // For now, we'll try to find by email
    const customers = await paymentService.stripe.customers.list({
      email: req.user.email,
      limit: 1
    });

    if (customers.data.length === 0) {
      return res.json({
        success: true,
        paymentMethods: []
      });
    }

    const customerId = customers.data[0].id;
    const paymentMethods = await paymentService.getCustomerPaymentMethods(customerId);

    // Return safe payment method data (no sensitive info)
    const safePaymentMethods = paymentMethods.map(pm => ({
      id: pm.id,
      type: pm.type,
      card: pm.card ? {
        brand: pm.card.brand,
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year
      } : null,
      created: pm.created
    }));

    res.json({
      success: true,
      paymentMethods: safePaymentMethods
    });

  } catch (error) {
    logUtils.logError(error, { action: 'get_payment_methods' }, req);
    res.status(500).json({ error: 'Failed to get payment methods' });
  }
});

// Create refund
router.post('/refund', authMiddleware.requireAdmin, async (req, res) => {
  try {
    if (!paymentService.isConfigured()) {
      return res.status(503).json({ error: 'Payment service not available' });
    }

    const { paymentIntentId, amount, reason } = req.body;
    
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID required' });
    }

    const refund = await paymentService.refundPayment(paymentIntentId, amount, reason);

    // Log refund
    logUtils.logBusiness('refund_created', {
      refundId: refund.id,
      paymentIntentId,
      amount: refund.amount / 100,
      reason
    }, req.user.id);

    res.json({
      success: true,
      refundId: refund.id,
      amount: refund.amount / 100,
      status: refund.status
    });

  } catch (error) {
    logUtils.logError(error, { action: 'create_refund' }, req);
    res.status(500).json({ error: 'Failed to create refund' });
  }
});

// Get available plans
router.get('/plans', async (req, res) => {
  try {
    const plans = [
      {
        id: 'premium_trader',
        name: 'Premium Trader',
        description: 'Advanced trading features and lower fees',
        monthlyPrice: 49.99,
        features: [
          'Lower platform fees (0.5% vs 0.75%)',
          'Advanced analytics dashboard',
          'Priority customer support',
          'Early access to new features'
        ]
      },
      {
        id: 'professional_trader',
        name: 'Professional Trader',
        description: 'Full access to all platform features',
        monthlyPrice: 99.99,
        features: [
          'Lowest platform fees (0.25%)',
          'Unlimited trades',
          'Advanced risk management tools',
          'Dedicated account manager',
          'Custom reporting',
          'API access'
        ]
      }
    ];

    res.json({
      success: true,
      plans
    });

  } catch (error) {
    logUtils.logError(error, { action: 'get_plans' }, req);
    res.status(500).json({ error: 'Failed to get plans' });
  }
});

// Create payment link for trade
router.post('/trade/:tradeId/payment-link', authMiddleware.requireAuth, async (req, res) => {
  try {
    if (!paymentService.isConfigured()) {
      return res.status(503).json({ error: 'Payment service not available' });
    }

    const db = await getDatabase();
    const tradeId = req.params.tradeId;
    
    const trade = await db.findById('trades', tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    // Check if user has permission to create payment link
    if (trade.creator_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const customerData = {
      userId: req.user.id,
      email: req.user.email,
      fullName: req.user.fullName || req.user.email.split('@')[0],
      role: req.user.role
    };

    const paymentLink = await paymentService.createPaymentLink(trade, customerData);

    // Log payment link creation
    logUtils.logBusiness('payment_link_created', {
      tradeId: trade.id,
      paymentLinkId: paymentLink.id,
      amount: trade.depositAmount || (trade.total_value * (trade.deposit_pct / 100))
    }, req.user.id);

    res.json({
      success: true,
      paymentLinkId: paymentLink.id,
      url: paymentLink.url
    });

  } catch (error) {
    logUtils.logError(error, { action: 'create_payment_link', tradeId: req.params.tradeId }, req);
    res.status(500).json({ error: 'Failed to create payment link' });
  }
});

module.exports = router;


