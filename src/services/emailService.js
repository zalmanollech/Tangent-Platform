const nodemailer = require('nodemailer');

// Email configuration
const emailConfig = {
  // For development, you can use a service like Gmail or a testing service
  // For production, use a proper email service like SendGrid, AWS SES, etc.
  development: {
    service: 'gmail', // or use smtp settings
    auth: {
      user: process.env.EMAIL_USER || 'your-email@gmail.com',
      pass: process.env.EMAIL_PASS || 'your-app-password'
    }
  },
  
  // SMTP configuration for production
  production: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  }
};

// Create email transporter
const createTransporter = () => {
  const config = process.env.NODE_ENV === 'production' 
    ? emailConfig.production 
    : emailConfig.development;
    
  return nodemailer.createTransport(config);
};

// Email templates
const emailTemplates = {
  // Welcome email template
  welcome: (userEmail, userName) => ({
    subject: 'Welcome to Tangent Platform',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Tangent Platform!</h2>
        <p>Hello ${userName || 'there'},</p>
        <p>Welcome to Tangent Platform - your gateway to secure commodity trading and financing.</p>
        <p>Your account has been successfully created with email: <strong>${userEmail}</strong></p>
        <p>To get started:</p>
        <ul>
          <li>Complete your KYC verification</li>
          <li>Connect your wallet</li>
          <li>Set up two-factor authentication for enhanced security</li>
        </ul>
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        <p>Best regards,<br>The Tangent Team</p>
      </div>
    `,
    text: `Welcome to Tangent Platform! Your account has been created with email: ${userEmail}`
  }),

  // 2FA setup email template
  twoFactorSetup: (userEmail, backupCodes) => ({
    subject: 'Two-Factor Authentication Setup - Tangent Platform',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Two-Factor Authentication Setup</h2>
        <p>Hello,</p>
        <p>You have successfully set up two-factor authentication for your Tangent Platform account.</p>
        <p><strong>Important:</strong> Please save these backup codes in a secure location. You can use them to access your account if you lose your authenticator device:</p>
        <div style="background-color: #f5f5f5; padding: 15px; margin: 15px 0; border-radius: 5px;">
          <h3>Backup Codes:</h3>
          <ul>
            ${backupCodes.map(code => `<li><code>${code}</code></li>`).join('')}
          </ul>
        </div>
        <p><strong>Security Tip:</strong> Each backup code can only be used once. Store them in a safe place!</p>
        <p>If you did not set up 2FA, please contact our support team immediately.</p>
        <p>Best regards,<br>The Tangent Team</p>
      </div>
    `,
    text: `Two-Factor Authentication has been set up for your account. Backup codes: ${backupCodes.join(', ')}`
  }),

  // Trade notification email template
  tradeNotification: (userEmail, tradeType, tradeDetails) => ({
    subject: `Trade ${tradeType} - Tangent Platform`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Trade ${tradeType}</h2>
        <p>Hello,</p>
        <p>A new trade has been ${tradeType.toLowerCase()} on Tangent Platform.</p>
        <div style="background-color: #f5f5f5; padding: 15px; margin: 15px 0; border-radius: 5px;">
          <h3>Trade Details:</h3>
          <p><strong>Trade ID:</strong> ${tradeDetails.id}</p>
          <p><strong>Amount:</strong> ${tradeDetails.amount} TGT</p>
          <p><strong>Status:</strong> ${tradeDetails.status}</p>
          <p><strong>Created:</strong> ${new Date(tradeDetails.createdAt).toLocaleString()}</p>
        </div>
        <p>Please log in to your account to view more details and take any required actions.</p>
        <p>Best regards,<br>The Tangent Team</p>
      </div>
    `,
    text: `Trade ${tradeType}: ID ${tradeDetails.id}, Amount: ${tradeDetails.amount} TGT, Status: ${tradeDetails.status}`
  }),

  // Security alert email template
  securityAlert: (userEmail, alertType, details) => ({
    subject: `Security Alert - ${alertType} - Tangent Platform`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">Security Alert</h2>
        <p>Hello,</p>
        <p>We detected a security event on your Tangent Platform account:</p>
        <div style="background-color: #ffebee; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #d32f2f;">
          <h3>Alert Details:</h3>
          <p><strong>Type:</strong> ${alertType}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Details:</strong> ${details}</p>
        </div>
        <p>If this activity was not authorized by you, please:</p>
        <ul>
          <li>Change your password immediately</li>
          <li>Review your account activity</li>
          <li>Contact our support team</li>
        </ul>
        <p>If you authorized this activity, you can safely ignore this email.</p>
        <p>Best regards,<br>The Tangent Security Team</p>
      </div>
    `,
    text: `Security Alert: ${alertType} - ${details}`
  })
};

// Email service class
class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.initialize();
  }

  async initialize() {
    try {
      this.transporter = createTransporter();
      
      // Verify connection configuration
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await this.transporter.verify();
        this.isConfigured = true;
        console.log('✅ Email service configured successfully');
      } else {
        console.log('⚠️ Email service not configured - set EMAIL_USER and EMAIL_PASS environment variables');
      }
    } catch (error) {
      console.error('❌ Email service configuration failed:', error.message);
      this.isConfigured = false;
    }
  }

  async sendEmail(to, subject, html, text) {
    if (!this.isConfigured) {
      console.log('📧 Email not sent (service not configured):', { to, subject });
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: to,
        subject: subject,
        html: html,
        text: text
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('📧 Email sent successfully:', { to, subject, messageId: result.messageId });
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  async sendWelcomeEmail(userEmail, userName) {
    const template = emailTemplates.welcome(userEmail, userName);
    return await this.sendEmail(userEmail, template.subject, template.html, template.text);
  }

  async send2FASetupEmail(userEmail, backupCodes) {
    const template = emailTemplates.twoFactorSetup(userEmail, backupCodes);
    return await this.sendEmail(userEmail, template.subject, template.html, template.text);
  }

  async sendTradeNotificationEmail(userEmail, tradeType, tradeDetails) {
    const template = emailTemplates.tradeNotification(userEmail, tradeType, tradeDetails);
    return await this.sendEmail(userEmail, template.subject, template.html, template.text);
  }

  async sendSecurityAlertEmail(userEmail, alertType, details) {
    const template = emailTemplates.securityAlert(userEmail, alertType, details);
    return await this.sendEmail(userEmail, template.subject, template.html, template.text);
  }

  // Bulk email sending
  async sendBulkEmail(recipients, subject, html, text) {
    const results = [];
    
    for (const recipient of recipients) {
      const result = await this.sendEmail(recipient, subject, html, text);
      results.push({ recipient, ...result });
    }
    
    return results;
  }

  // Email validation
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = {
  emailService,
  emailTemplates,
  emailConfig
};
