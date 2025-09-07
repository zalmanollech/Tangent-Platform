const stripe = require('stripe');
const { config } = require('./config');
const logger = require('./logger');
const emailService = require('./email');

class PaymentService {
  constructor() {
    this.stripe = null;
    this.isConfigured = false;
    this.initialize();
  }

  initialize() {
    try {
      if (config.services.payments?.stripe?.secretKey) {
        this.stripe = stripe(config.services.payments.stripe.secretKey);
        this.isConfigured = true;
        logger.info('Stripe payment service initialized successfully');
      } else {
        logger.warn('Stripe not configured - payment features will be disabled');
        this.isConfigured = false;
      }
    } catch (error) {
      logger.error('Failed to initialize payment service', { error: error.message });
      this.isConfigured = false;
    }
  }

  // Create a payment intent for trade deposits
  async createTradeDepositPayment(tradeData, customerData) {
    if (!this.isConfigured) {
      throw new Error('Payment service not configured');
    }

    try {
      const amount = Math.round(tradeData.depositAmount * 100); // Convert to cents
      
      // Create or retrieve customer
      let customer;
      try {
        const customers = await this.stripe.customers.list({
          email: customerData.email,
          limit: 1
        });
        
        if (customers.data.length > 0) {
          customer = customers.data[0];
        } else {
          customer = await this.stripe.customers.create({
            email: customerData.email,
            name: customerData.fullName,
            metadata: {
              userId: customerData.userId,
              role: customerData.role
            }
          });
        }
      } catch (customerError) {
        logger.error('Failed to create/retrieve customer', { error: customerError.message });
        throw customerError;
      }

      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        customer: customer.id,
        metadata: {
          type: 'trade_deposit',
          tradeId: tradeData.id,
          userId: customerData.userId,
          commodity: tradeData.commodity,
          quantity: tradeData.quantity.toString()
        },
        description: `Trade deposit for ${tradeData.commodity} (${tradeData.quantity} units)`,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      logger.info('Payment intent created for trade deposit', {
        paymentIntentId: paymentIntent.id,
        tradeId: tradeData.id,
        amount: tradeData.depositAmount,
        customerId: customer.id
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        customerId: customer.id,
        amount: tradeData.depositAmount
      };

    } catch (error) {
      logger.error('Failed to create trade deposit payment', {
        tradeId: tradeData.id,
        error: error.message
      });
      throw error;
    }
  }

  // Create payment intent for final trade payment
  async createFinalTradePayment(tradeData, customerData) {
    if (!this.isConfigured) {
      throw new Error('Payment service not configured');
    }

    try {
      const remainingAmount = tradeData.totalValue - tradeData.depositAmount;
      const amount = Math.round(remainingAmount * 100); // Convert to cents
      
      // Get existing customer
      const customers = await this.stripe.customers.list({
        email: customerData.email,
        limit: 1
      });
      
      if (customers.data.length === 0) {
        throw new Error('Customer not found. Please contact support.');
      }
      
      const customer = customers.data[0];

      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        customer: customer.id,
        metadata: {
          type: 'trade_final_payment',
          tradeId: tradeData.id,
          userId: customerData.userId,
          commodity: tradeData.commodity
        },
        description: `Final payment for ${tradeData.commodity} trade`,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      logger.info('Payment intent created for final trade payment', {
        paymentIntentId: paymentIntent.id,
        tradeId: tradeData.id,
        amount: remainingAmount,
        customerId: customer.id
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        customerId: customer.id,
        amount: remainingAmount
      };

    } catch (error) {
      logger.error('Failed to create final trade payment', {
        tradeId: tradeData.id,
        error: error.message
      });
      throw error;
    }
  }

  // Process subscription payment for platform fees
  async createSubscriptionPayment(planData, customerData) {
    if (!this.isConfigured) {
      throw new Error('Payment service not configured');
    }

    try {
      // Create or retrieve customer
      let customer;
      const customers = await this.stripe.customers.list({
        email: customerData.email,
        limit: 1
      });
      
      if (customers.data.length > 0) {
        customer = customers.data[0];
      } else {
        customer = await this.stripe.customers.create({
          email: customerData.email,
          name: customerData.fullName,
          metadata: {
            userId: customerData.userId,
            role: customerData.role
          }
        });
      }

      // Create or retrieve price
      let price;
      try {
        const prices = await this.stripe.prices.list({
          lookup_keys: [planData.planId],
          limit: 1
        });
        
        if (prices.data.length > 0) {
          price = prices.data[0];
        } else {
          // Create new price
          price = await this.stripe.prices.create({
            unit_amount: Math.round(planData.monthlyAmount * 100),
            currency: 'usd',
            recurring: {
              interval: 'month',
            },
            product_data: {
              name: planData.planName,
              description: planData.description
            },
            lookup_key: planData.planId,
          });
        }
      } catch (priceError) {
        logger.error('Failed to create/retrieve price', { error: priceError.message });
        throw priceError;
      }

      // Create subscription
      const subscription = await this.stripe.subscriptions.create({
        customer: customer.id,
        items: [{
          price: price.id,
        }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId: customerData.userId,
          planId: planData.planId
        }
      });

      logger.info('Subscription created', {
        subscriptionId: subscription.id,
        customerId: customer.id,
        planId: planData.planId
      });

      return {
        subscriptionId: subscription.id,
        clientSecret: subscription.latest_invoice.payment_intent.client_secret,
        customerId: customer.id
      };

    } catch (error) {
      logger.error('Failed to create subscription', {
        planId: planData.planId,
        error: error.message
      });
      throw error;
    }
  }

  // Handle webhook events
  async handleWebhook(body, signature) {
    if (!this.isConfigured) {
      throw new Error('Payment service not configured');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        body,
        signature,
        config.services.payments.stripe.webhookSecret
      );

      logger.info('Stripe webhook received', { 
        type: event.type, 
        id: event.id 
      });

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object);
          break;
        
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object);
          break;
        
        case 'invoice.payment_succeeded':
          await this.handleSubscriptionPaymentSuccess(event.data.object);
          break;
        
        case 'invoice.payment_failed':
          await this.handleSubscriptionPaymentFailure(event.data.object);
          break;
        
        case 'customer.subscription.deleted':
          await this.handleSubscriptionCancellation(event.data.object);
          break;
        
        default:
          logger.info('Unhandled webhook event type', { type: event.type });
      }

      return { received: true };

    } catch (error) {
      logger.error('Webhook handling failed', { error: error.message });
      throw error;
    }
  }

  async handlePaymentSuccess(paymentIntent) {
    try {
      const { metadata } = paymentIntent;
      const { type, tradeId, userId } = metadata;

      logger.info('Payment succeeded', {
        paymentIntentId: paymentIntent.id,
        type,
        tradeId,
        userId,
        amount: paymentIntent.amount / 100
      });

      if (type === 'trade_deposit') {
        // Update trade status
        // This would typically update the database
        logger.info('Trade deposit payment completed', { tradeId });
        
        // Send notification email
        // You would get user details from database and send email
        
      } else if (type === 'trade_final_payment') {
        // Complete the trade
        logger.info('Final trade payment completed', { tradeId });
        
        // Update trade status to completed
        // Send completion notifications
      }

    } catch (error) {
      logger.error('Failed to handle payment success', { 
        paymentIntentId: paymentIntent.id,
        error: error.message 
      });
    }
  }

  async handlePaymentFailure(paymentIntent) {
    try {
      const { metadata } = paymentIntent;
      const { type, tradeId, userId } = metadata;

      logger.warn('Payment failed', {
        paymentIntentId: paymentIntent.id,
        type,
        tradeId,
        userId,
        amount: paymentIntent.amount / 100,
        failureReason: paymentIntent.last_payment_error?.message
      });

      // Send failure notification
      // Update trade status if needed
      // Possibly retry or escalate

    } catch (error) {
      logger.error('Failed to handle payment failure', { 
        paymentIntentId: paymentIntent.id,
        error: error.message 
      });
    }
  }

  async handleSubscriptionPaymentSuccess(invoice) {
    try {
      const { subscription, customer } = invoice;
      
      logger.info('Subscription payment succeeded', {
        invoiceId: invoice.id,
        subscriptionId: subscription,
        customerId: customer,
        amount: invoice.amount_paid / 100
      });

      // Update user subscription status
      // Send receipt email

    } catch (error) {
      logger.error('Failed to handle subscription payment success', { 
        invoiceId: invoice.id,
        error: error.message 
      });
    }
  }

  async handleSubscriptionPaymentFailure(invoice) {
    try {
      const { subscription, customer } = invoice;
      
      logger.warn('Subscription payment failed', {
        invoiceId: invoice.id,
        subscriptionId: subscription,
        customerId: customer,
        amount: invoice.amount_due / 100
      });

      // Send payment failure notification
      // Possibly suspend account features

    } catch (error) {
      logger.error('Failed to handle subscription payment failure', { 
        invoiceId: invoice.id,
        error: error.message 
      });
    }
  }

  async handleSubscriptionCancellation(subscription) {
    try {
      logger.info('Subscription cancelled', {
        subscriptionId: subscription.id,
        customerId: subscription.customer
      });

      // Update user subscription status
      // Send cancellation confirmation

    } catch (error) {
      logger.error('Failed to handle subscription cancellation', { 
        subscriptionId: subscription.id,
        error: error.message 
      });
    }
  }

  // Utility methods
  async getCustomer(customerId) {
    if (!this.isConfigured) {
      throw new Error('Payment service not configured');
    }

    try {
      return await this.stripe.customers.retrieve(customerId);
    } catch (error) {
      logger.error('Failed to retrieve customer', { customerId, error: error.message });
      throw error;
    }
  }

  async getPaymentIntent(paymentIntentId) {
    if (!this.isConfigured) {
      throw new Error('Payment service not configured');
    }

    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      logger.error('Failed to retrieve payment intent', { paymentIntentId, error: error.message });
      throw error;
    }
  }

  async getSubscription(subscriptionId) {
    if (!this.isConfigured) {
      throw new Error('Payment service not configured');
    }

    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      logger.error('Failed to retrieve subscription', { subscriptionId, error: error.message });
      throw error;
    }
  }

  async refundPayment(paymentIntentId, amount = null, reason = 'requested_by_customer') {
    if (!this.isConfigured) {
      throw new Error('Payment service not configured');
    }

    try {
      const refundData = {
        payment_intent: paymentIntentId,
        reason
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to cents
      }

      const refund = await this.stripe.refunds.create(refundData);

      logger.info('Refund created', {
        refundId: refund.id,
        paymentIntentId,
        amount: refund.amount / 100,
        reason
      });

      return refund;

    } catch (error) {
      logger.error('Failed to create refund', { 
        paymentIntentId, 
        error: error.message 
      });
      throw error;
    }
  }

  // Get payment methods for a customer
  async getCustomerPaymentMethods(customerId) {
    if (!this.isConfigured) {
      throw new Error('Payment service not configured');
    }

    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data;

    } catch (error) {
      logger.error('Failed to retrieve payment methods', { 
        customerId, 
        error: error.message 
      });
      throw error;
    }
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId) {
    if (!this.isConfigured) {
      throw new Error('Payment service not configured');
    }

    try {
      const subscription = await this.stripe.subscriptions.cancel(subscriptionId);

      logger.info('Subscription cancelled', {
        subscriptionId,
        canceledAt: subscription.canceled_at
      });

      return subscription;

    } catch (error) {
      logger.error('Failed to cancel subscription', { 
        subscriptionId, 
        error: error.message 
      });
      throw error;
    }
  }

  // Generate payment link for quick payments
  async createPaymentLink(tradeData, customerData) {
    if (!this.isConfigured) {
      throw new Error('Payment service not configured');
    }

    try {
      const amount = Math.round(tradeData.depositAmount * 100);

      const paymentLink = await this.stripe.paymentLinks.create({
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Trade Deposit: ${tradeData.commodity}`,
              description: `Deposit for ${tradeData.quantity} units of ${tradeData.commodity}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        }],
        metadata: {
          type: 'trade_deposit',
          tradeId: tradeData.id,
          userId: customerData.userId
        }
      });

      logger.info('Payment link created', {
        paymentLinkId: paymentLink.id,
        tradeId: tradeData.id,
        amount: tradeData.depositAmount
      });

      return paymentLink;

    } catch (error) {
      logger.error('Failed to create payment link', {
        tradeId: tradeData.id,
        error: error.message
      });
      throw error;
    }
  }

  isConfigured() {
    return this.isConfigured;
  }
}

// Export singleton instance
module.exports = new PaymentService();



