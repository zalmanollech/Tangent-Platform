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

  async sendTGTRegistrationConfirmation(email, name) {
    logger.info('TGT registration confirmation email would be sent', { email, name });
    return this.sendEmail();
  }

  async sendTGTRegistrationNotification(registrationData) {
    logger.info('TGT admin notification email would be sent', { 
      email: registrationData.email,
      interestLevel: registrationData.interestLevel 
    });
    return this.sendEmail();
  }

  async sendVerificationEmail(email, token, username) {
    logger.info('Verification email would be sent', { email, username });
    return this.sendEmail();
  }

  async sendUnifiedRegistrationConfirmation(email, name, interests) {
    logger.info('Unified registration confirmation email would be sent', { 
      email, 
      name, 
      interests 
    });
    return this.sendEmail();
  }

  async sendUnifiedRegistrationNotification(registrationData) {
    logger.info('Unified admin notification email would be sent', { 
      email: registrationData.email,
      interests: registrationData.interests 
    });
    return this.sendEmail();
  }
}

module.exports = new EmailService();