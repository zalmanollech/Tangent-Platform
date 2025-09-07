// Temporary email service stub to prevent crashes
const { logger } = require('./logger');

class EmailService {
  constructor() {
    this.isConfigured = false;
    logger.info('Email service initialized (stub mode)');
  }

  async createTestAccount() {
    logger.info('Email test account creation skipped (stub mode)');
    return null;
  }

  async sendEmail() {
    logger.info('Email sending skipped (stub mode)');
    return { success: true, message: 'Email service disabled' };
  }

  async sendKYCStatusEmail() {
    return this.sendEmail();
  }

  async sendTradeNotification() {
    return this.sendEmail();
  }

  async sendPasswordReset() {
    return this.sendEmail();
  }

  async sendWelcomeEmail() {
    return this.sendEmail();
  }
}

module.exports = new EmailService();