const nodemailer = require('nodemailer');
const { config } = require('./config');
const logger = require('./logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.initialize();
  }

  initialize() {
    try {
      // Configure email transporter based on environment
      if (config.services.email.smtp.host) {
        this.transporter = nodemailer.createTransporter({
          host: config.services.email.smtp.host,
          port: config.services.email.smtp.port,
          secure: config.services.email.smtp.secure,
          auth: {
            user: config.services.email.smtp.user,
            pass: config.services.email.smtp.pass
          }
        });
        this.isConfigured = true;
        logger.info('Email service initialized successfully', { service: 'smtp' });
      } else {
        // Development mode - use Ethereal for testing
        this.createTestAccount();
        return;
      }


    } catch (error) {
      logger.error('Failed to initialize email service', { error: error.message });
      this.isConfigured = false;
    }
  }

  async createTestAccount() {
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransporter({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      this.isConfigured = true;
      logger.info('Email service initialized with test account', { 
        user: testAccount.user,
        preview: 'https://ethereal.email'
      });
    } catch (error) {
      logger.error('Failed to create test email account', { error: error.message });
    }
  }

  async sendEmail(to, subject, html, text = null) {
    if (!this.isConfigured) {
      logger.warn('Email service not configured, skipping email send');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const mailOptions = {
        from: `"Tangent Platform" <${config.services.email.from}>`,
        to,
        subject,
        html,
        text: text || this.stripHtml(html)
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully', { 
        to, 
        subject, 
        messageId: info.messageId,
        preview: nodemailer.getTestMessageUrl(info)
      });

      return { 
        success: true, 
        messageId: info.messageId,
        preview: nodemailer.getTestMessageUrl(info)
      };
    } catch (error) {
      logger.error('Failed to send email', { 
        to, 
        subject, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '');
  }

  // Email Templates
  async sendVerificationEmail(email, verificationToken, userName) {
    const verificationUrl = `http://localhost:${config.server.port}/auth/verify?token=${verificationToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 30px; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 Welcome to Tangent Platform</h1>
          </div>
          <div class="content">
            <h2>Hi ${userName},</h2>
            <p>Thank you for joining Tangent Platform! Please verify your email address to complete your registration.</p>
            
            <p>Click the button below to verify your email:</p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
            
            <p><strong>This verification link will expire in 24 hours.</strong></p>
            
            <p>If you didn't create an account with Tangent Platform, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2025 Tangent Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, 'Verify Your Tangent Platform Account', html);
  }

  async sendPasswordResetEmail(email, resetToken, userName) {
    const resetUrl = `http://localhost:${config.server.port}/auth/reset-password?token=${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; text-align: center; padding: 30px; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #f5576c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hi ${userName},</h2>
            <p>We received a request to reset your password for your Tangent Platform account.</p>
            
            <p>Click the button below to reset your password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #f5576c;">${resetUrl}</p>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong>
              <ul>
                <li>This reset link will expire in 1 hour</li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Your password will remain unchanged until you click the link above</li>
              </ul>
            </div>
          </div>
          <div class="footer">
            <p>© 2025 Tangent Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, 'Reset Your Tangent Platform Password', html);
  }

  async sendKYCStatusEmail(email, userName, status, message = '') {
    const statusColors = {
      approved: '#10b981',
      rejected: '#ef4444',
      pending: '#f59e0b'
    };

    const statusMessages = {
      approved: 'Your KYC verification has been approved! You can now access all platform features.',
      rejected: 'Your KYC verification was not approved. Please review the feedback and resubmit.',
      pending: 'Your KYC documents are being reviewed. We\'ll notify you once the review is complete.'
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${statusColors[status]}; color: white; text-align: center; padding: 30px; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .status-badge { display: inline-block; background: ${statusColors[status]}; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; text-transform: uppercase; margin: 10px 0; }
          .message { background: white; padding: 20px; border-radius: 6px; border-left: 4px solid ${statusColors[status]}; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 KYC Status Update</h1>
          </div>
          <div class="content">
            <h2>Hi ${userName},</h2>
            <p>We have an update on your KYC verification status:</p>
            
            <div class="status-badge">${status.toUpperCase()}</div>
            
            <div class="message">
              <p><strong>${statusMessages[status]}</strong></p>
              ${message ? `<p><em>Additional notes:</em> ${message}</p>` : ''}
            </div>
            
            ${status === 'rejected' ? `
              <p>To resubmit your KYC documents, please <a href="http://localhost:${config.server.port}/portal/kyc">visit your KYC portal</a>.</p>
            ` : ''}
            
            ${status === 'approved' ? `
              <p>You can now access all platform features including trading and advanced tools.</p>
            ` : ''}
          </div>
          <div class="footer">
            <p>© 2025 Tangent Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, `KYC Status Update: ${status.charAt(0).toUpperCase() + status.slice(1)}`, html);
  }

  async sendTradeNotificationEmail(email, userName, tradeData, notificationType) {
    const notifications = {
      new_trade: {
        subject: 'New Trade Opportunity Available',
        title: '📈 New Trade Available',
        message: `A new trade for ${tradeData.commodity} is available on the platform.`
      },
      trade_match: {
        subject: 'Trade Match Found',
        title: '🎯 Trade Match Found',
        message: `Your trade request for ${tradeData.commodity} has been matched!`
      },
      trade_completed: {
        subject: 'Trade Completed',
        title: '✅ Trade Completed',
        message: `Your trade for ${tradeData.commodity} has been successfully completed.`
      }
    };

    const notification = notifications[notificationType];
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); color: white; text-align: center; padding: 30px; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .trade-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }
          .button { display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${notification.title}</h1>
          </div>
          <div class="content">
            <h2>Hi ${userName},</h2>
            <p>${notification.message}</p>
            
            <div class="trade-card">
              <h3>Trade Details:</h3>
              <p><strong>Commodity:</strong> ${tradeData.commodity}</p>
              <p><strong>Quantity:</strong> ${tradeData.quantity}</p>
              <p><strong>Price:</strong> $${tradeData.price}</p>
              <p><strong>Type:</strong> ${tradeData.type}</p>
              ${tradeData.deadline ? `<p><strong>Deadline:</strong> ${new Date(tradeData.deadline).toLocaleDateString()}</p>` : ''}
            </div>
            
            <a href="http://localhost:${config.server.port}/portal/trade" class="button">View Trade Details</a>
          </div>
          <div class="footer">
            <p>© 2025 Tangent Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, notification.subject, html);
  }
}

// Export singleton instance
module.exports = new EmailService();
