const express = require('express');
const router = express.Router();
const { getDatabase } = require('../lib/database');
const { logUtils } = require('../lib/logger');
const { validationRules, handleValidationErrors } = require('../lib/security');
const emailService = require('../lib/email');

// TGT Registration endpoint
router.post('/register', async (req, res) => {
  try {
    const db = getDatabase();
    const {
      name,
      email,
      company,
      phone,
      interestLevel,
      investmentRange,
      useCase,
      message,
      newsletter
    } = req.body;

    // Validate required fields
    if (!name || !email || !interestLevel || !useCase) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'email', 'interestLevel', 'useCase']
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }

    // Check if email already registered for TGT
    const existingRegistration = db.data.tgtRegistrations?.find(reg => 
      reg.email.toLowerCase() === email.toLowerCase()
    );

    if (existingRegistration) {
      logUtils.logInfo('TGT registration attempt with existing email', { email }, req);
      return res.status(400).json({
        error: 'Email already registered for TGT early access',
        message: 'You are already on our TGT early access list. We will contact you soon!'
      });
    }

    // Create TGT registration record
    const tgtRegistration = {
      id: `tgt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      company: company?.trim() || '',
      phone: phone?.trim() || '',
      interestLevel,
      investmentRange: investmentRange || '',
      useCase,
      message: message?.trim() || '',
      newsletter: Boolean(newsletter),
      registeredAt: new Date().toISOString(),
      status: 'pending',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || '',
      source: 'landing_page'
    };

    // Initialize TGT registrations array if it doesn't exist
    if (!db.data.tgtRegistrations) {
      db.data.tgtRegistrations = [];
    }

    // Add registration
    db.data.tgtRegistrations.push(tgtRegistration);
    db.save();

    // Send confirmation email to user
    try {
      await emailService.sendTGTRegistrationConfirmation(email, name);
    } catch (emailError) {
      logUtils.logError(emailError, { 
        action: 'send_tgt_confirmation_email', 
        registrationId: tgtRegistration.id 
      }, req);
      // Don't fail the registration if email fails
    }

    // Send notification to admin
    try {
      await emailService.sendTGTRegistrationNotification(tgtRegistration);
    } catch (emailError) {
      logUtils.logError(emailError, { 
        action: 'send_tgt_admin_notification', 
        registrationId: tgtRegistration.id 
      }, req);
    }

    // Log successful registration
    logUtils.logInfo('TGT registration successful', {
      registrationId: tgtRegistration.id,
      email: email,
      interestLevel: interestLevel,
      useCase: useCase
    }, req);

    // Return success response (without sensitive data)
    res.status(201).json({
      success: true,
      message: 'Thank you for your interest in TGT! We will contact you within 48 hours.',
      registrationId: tgtRegistration.id,
      data: {
        name: tgtRegistration.name,
        email: tgtRegistration.email,
        interestLevel: tgtRegistration.interestLevel,
        useCase: tgtRegistration.useCase,
        registeredAt: tgtRegistration.registeredAt
      }
    });

  } catch (error) {
    logUtils.logError(error, { action: 'tgt_registration' }, req);
    res.status(500).json({
      error: 'Registration failed',
      message: 'There was an error processing your registration. Please try again.'
    });
  }
});

// Get TGT registration statistics (admin only)
router.get('/stats', async (req, res) => {
  try {
    const db = getDatabase();
    const registrations = db.data.tgtRegistrations || [];

    const stats = {
      total: registrations.length,
      byInterestLevel: {},
      byUseCase: {},
      byInvestmentRange: {},
      recentRegistrations: registrations
        .sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt))
        .slice(0, 10)
        .map(reg => ({
          id: reg.id,
          name: reg.name,
          email: reg.email,
          interestLevel: reg.interestLevel,
          useCase: reg.useCase,
          registeredAt: reg.registeredAt
        }))
    };

    // Calculate statistics
    registrations.forEach(reg => {
      // By interest level
      stats.byInterestLevel[reg.interestLevel] = 
        (stats.byInterestLevel[reg.interestLevel] || 0) + 1;

      // By use case
      stats.byUseCase[reg.useCase] = 
        (stats.byUseCase[reg.useCase] || 0) + 1;

      // By investment range (if provided)
      if (reg.investmentRange) {
        stats.byInvestmentRange[reg.investmentRange] = 
          (stats.byInvestmentRange[reg.investmentRange] || 0) + 1;
      }
    });

    res.json(stats);

  } catch (error) {
    logUtils.logError(error, { action: 'get_tgt_stats' }, req);
    res.status(500).json({
      error: 'Failed to retrieve statistics'
    });
  }
});

// Export TGT registrations (admin only)
router.get('/export', async (req, res) => {
  try {
    const db = getDatabase();
    const registrations = db.data.tgtRegistrations || [];

    // Set CSV headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=tgt-registrations.csv');

    // Create CSV content
    const csvHeaders = [
      'ID', 'Name', 'Email', 'Company', 'Phone', 'Interest Level', 
      'Investment Range', 'Use Case', 'Message', 'Newsletter', 
      'Registered At', 'Status', 'IP Address'
    ].join(',');

    const csvRows = registrations.map(reg => [
      reg.id,
      `"${reg.name}"`,
      reg.email,
      `"${reg.company || ''}"`,
      `"${reg.phone || ''}"`,
      reg.interestLevel,
      reg.investmentRange || '',
      reg.useCase,
      `"${(reg.message || '').replace(/"/g, '""')}"`,
      reg.newsletter ? 'Yes' : 'No',
      reg.registeredAt,
      reg.status,
      reg.ipAddress || ''
    ].join(','));

    const csvContent = [csvHeaders, ...csvRows].join('\n');
    res.send(csvContent);

    logUtils.logInfo('TGT registrations exported', { 
      count: registrations.length 
    }, req);

  } catch (error) {
    logUtils.logError(error, { action: 'export_tgt_registrations' }, req);
    res.status(500).json({
      error: 'Export failed'
    });
  }
});

module.exports = router;
