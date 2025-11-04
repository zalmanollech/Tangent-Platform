// Email Service for Traidefi
// Handles sending emails for report notifications, verification, etc.

const nodemailer = require('nodemailer');
const { Resend } = require('resend');

const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'resend'; // Default to resend
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@traidefi.ai';
const FROM_NAME = process.env.FROM_NAME || 'Traidefi';

// Nodemailer configuration (for SMTP)
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

// Resend configuration (if using Resend)
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// SendGrid configuration (if using SendGrid)
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

let transporter = null;
let resendClient = null;

/**
 * Initialize email transporter
 */
async function initEmailService() {
    try {
        console.log('[INFO] Initializing email service with provider:', EMAIL_PROVIDER);
        console.log('[INFO] Resend API key present:', RESEND_API_KEY ? 'Yes (key: ' + RESEND_API_KEY.substring(0, 10) + '...)' : 'No');
        
        if (EMAIL_PROVIDER === 'nodemailer') {
            if (!SMTP_USER || !SMTP_PASS) {
                console.warn('[WARN] SMTP credentials not configured. Email service disabled.');
                return null;
            }
            
            transporter = nodemailer.createTransport({
                host: SMTP_HOST,
                port: SMTP_PORT,
                secure: SMTP_PORT === 465, // true for 465, false for other ports
                auth: {
                    user: SMTP_USER,
                    pass: SMTP_PASS
                }
            });
            
            // Verify connection
            await transporter.verify();
            console.log('[INFO] Email service (Nodemailer) initialized successfully');
            return transporter;
        } else if (EMAIL_PROVIDER === 'resend') {
            if (!RESEND_API_KEY) {
                console.error('[ERROR] Resend API key not configured. Email service disabled. Please set RESEND_API_KEY in Railway.');
                return null;
            }
            
            resendClient = new Resend(RESEND_API_KEY);
            console.log('[INFO] Email service (Resend) initialized successfully with API key:', RESEND_API_KEY.substring(0, 10) + '...');
            return resendClient;
        } else if (EMAIL_PROVIDER === 'sendgrid') {
            // SendGrid will be implemented if needed
            console.log('[INFO] SendGrid email provider selected (not yet implemented)');
            return null;
        }
        
        return null;
    } catch (error) {
        console.error('[ERROR] Email service initialization failed:', error.message);
        return null;
    }
}

/**
 * Send email using nodemailer
 */
async function sendEmailWithNodemailer(to, subject, html, text) {
    try {
        if (!transporter) {
            await initEmailService();
        }
        
        if (!transporter) {
            console.warn('[WARN] Email transporter not available. Skipping email send.');
            return false;
        }
        
        const mailOptions = {
            from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
            to: to,
            subject: subject,
            text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
            html: html
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log('[INFO] Email sent successfully:', info.messageId);
        return true;
    } catch (error) {
        console.error('[ERROR] Email send error:', error.message);
        return false;
    }
}

/**
 * Send email using Resend
 */
async function sendEmailWithResend(to, subject, html, text) {
    try {
        console.log('[INFO] sendEmailWithResend called with provider:', EMAIL_PROVIDER, 'resendClient:', resendClient ? 'initialized' : 'null');
        if (!resendClient) {
            console.log('[INFO] Resend client not initialized, calling initEmailService...');
            await initEmailService();
        }
        
        if (!resendClient) {
            console.error('[ERROR] Resend client not available after initialization. Check RESEND_API_KEY in Railway.');
            return false;
        }
        
        const { data, error } = await resendClient.emails.send({
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to: [to],
            subject: subject,
            html: html,
            text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for text version
        });
        
        if (error) {
            console.error('[ERROR] Resend email error:', error);
            return false;
        }
        
        console.log('[INFO] Email sent successfully via Resend:', data?.id);
        return true;
    } catch (error) {
        console.error('[ERROR] Email send error:', error.message);
        return false;
    }
}

/**
 * Send email (generic function)
 */
async function sendEmail(to, subject, html, text) {
    try {
        console.log('[INFO] Attempting to send email via provider:', EMAIL_PROVIDER, 'to:', to);
        if (EMAIL_PROVIDER === 'nodemailer') {
            return await sendEmailWithNodemailer(to, subject, html, text);
        } else if (EMAIL_PROVIDER === 'resend') {
            return await sendEmailWithResend(to, subject, html, text);
        } else {
            console.error('[ERROR] Email provider not implemented:', EMAIL_PROVIDER, 'Please set EMAIL_PROVIDER to "resend" or "nodemailer"');
            return false;
        }
    } catch (error) {
        console.error('[ERROR] Email send error:', error.message);
        console.error('[ERROR] Error stack:', error.stack);
        return false;
    }
}

/**
 * Send report ready email
 */
async function sendReportReadyEmail(userEmail, reportType, reportId, pdfUrl, reportDetails) {
    try {
        const reportName = reportType === 'credit-report' ? 'Credit Report' : 'Insurance Quote';
        const reportScore = reportDetails?.score ? ` (Score: ${reportDetails.score})` : '';
        const premiumRange = reportDetails?.premiumMin && reportDetails?.premiumMax 
            ? ` (Premium: ${reportDetails.premiumMin}% - ${reportDetails.premiumMax}%)` 
            : '';
        
        const subject = `Your ${reportName} is Ready - Traidefi`;
        const viewUrl = `${process.env.BASE_URL || 'http://localhost:4000'}/my-reports?email=${encodeURIComponent(userEmail)}`;
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your ${reportName} is Ready</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        h1 {
            color: #000;
            font-size: 24px;
            margin: 0 0 10px 0;
        }
        .success-icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
        .content {
            margin: 30px 0;
        }
        .btn {
            display: inline-block;
            padding: 15px 30px;
            background: #000;
            color: #fff;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 10px 5px;
            text-align: center;
        }
        .btn:hover {
            background: #333;
        }
        .btn-secondary {
            background: #10b981;
        }
        .btn-secondary:hover {
            background: #059669;
        }
        .info-box {
            background: #f9fafb;
            border-left: 4px solid #06b6d4;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="success-icon">✅</div>
            <h1>Your ${reportName} is Ready!</h1>
        </div>
        
        <div class="content">
            <p>Hello,</p>
            <p>Your ${reportName} has been generated successfully${reportScore}${premiumRange}.</p>
            
            <div class="info-box">
                <strong>Report Details:</strong><br>
                Report ID: #${reportId}<br>
                ${reportType === 'credit-report' && reportDetails?.score ? `Credit Score: ${reportDetails.score}` : ''}
                ${reportType === 'insurance-quote' && reportDetails?.premiumMin && reportDetails?.premiumMax 
                    ? `Premium Range: ${reportDetails.premiumMin}% - ${reportDetails.premiumMax}%` 
                    : ''}
            </div>
            
            <p>You can view and download your report using the buttons below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${viewUrl}" class="btn">View in Dashboard</a>
                ${pdfUrl ? `<a href="${pdfUrl}" class="btn btn-secondary">Download PDF</a>` : ''}
            </div>
            
            <p>If you have any questions, please don't hesitate to contact us.</p>
        </div>
        
        <div class="footer">
            <p>Best regards,<br><strong>Traidefi Team</strong></p>
            <p>This is an automated email. Please do not reply.</p>
        </div>
    </div>
</body>
</html>
        `;
        
        const text = `
Your ${reportName} is Ready!

Hello,

Your ${reportName} has been generated successfully${reportScore}${premiumRange}.

Report Details:
- Report ID: #${reportId}
${reportType === 'credit-report' && reportDetails?.score ? `- Credit Score: ${reportDetails.score}` : ''}
${reportType === 'insurance-quote' && reportDetails?.premiumMin && reportDetails?.premiumMax 
    ? `- Premium Range: ${reportDetails.premiumMin}% - ${reportDetails.premiumMax}%` 
    : ''}

View your report: ${viewUrl}
${pdfUrl ? `Download PDF: ${pdfUrl}` : ''}

If you have any questions, please don't hesitate to contact us.

Best regards,
Traidefi Team
        `;
        
        const emailSent = await sendEmail(userEmail, subject, html, text);
        if (!emailSent) {
            console.error('[ERROR] Failed to send report ready email: Email service returned false');
            return false;
        }
        return true;
    } catch (error) {
        console.error('[ERROR] Failed to send report ready email:', error.message);
        return false;
    }
}

/**
 * Send verification email (for future use)
 */
async function sendVerificationEmail(userEmail, verificationToken) {
    try {
        const subject = 'Verify Your Email - Traidefi';
        const verificationUrl = `${process.env.BASE_URL || 'http://localhost:4000'}/verify-email?token=${verificationToken}&email=${encodeURIComponent(userEmail)}`;
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Verify Your Email</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .container {
            background: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .btn {
            display: inline-block;
            padding: 15px 30px;
            background: #000;
            color: #fff;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Verify Your Email</h1>
        <p>Please click the button below to verify your email address:</p>
        <a href="${verificationUrl}" class="btn">Verify Email</a>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #06b6d4;">${verificationUrl}</p>
    </div>
</body>
</html>
        `;
        
        return await sendEmail(userEmail, subject, html);
    } catch (error) {
        console.error('[ERROR] Failed to send verification email:', error.message);
        return false;
    }
}

// Initialize email service on module load
initEmailService().catch(error => {
    console.error('[ERROR] Failed to initialize email service:', error);
});

module.exports = {
    sendEmail,
    sendReportReadyEmail,
    sendVerificationEmail,
    initEmailService
};

