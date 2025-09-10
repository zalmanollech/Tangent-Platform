const express = require('express');
const router = express.Router();
const { getDatabase } = require('../lib/database');
const { logUtils } = require('../lib/logger');
const emailService = require('../lib/email');

// Unified registration endpoint for both platform and TGT interests
router.post('/', async (req, res) => {
  try {
    const db = getDatabase();
    const {
      name,
      email,
      company,
      phone,
      interests,
      message,
      newsletter
    } = req.body;

    // Validate required fields
    if (!name || !email || !interests || !Array.isArray(interests) || interests.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'email', 'interests']
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }

    // Validate interests
    const validInterests = ['platform', 'tgt', 'both'];
    const invalidInterests = interests.filter(interest => !validInterests.includes(interest));
    if (invalidInterests.length > 0) {
      return res.status(400).json({
        error: 'Invalid interest values',
        validOptions: validInterests
      });
    }

    // Check if email already registered
    const existingRegistration = db.data.unifiedRegistrations?.find(reg => 
      reg.email.toLowerCase() === email.toLowerCase()
    );

    if (existingRegistration) {
      // Update existing registration with new interests
      const updatedInterests = [...new Set([...existingRegistration.interests, ...interests])];
      existingRegistration.interests = updatedInterests;
      existingRegistration.updatedAt = new Date().toISOString();
      
      if (message && message.trim()) {
        existingRegistration.message = message.trim();
      }
      
      db.save();

      logUtils.logInfo('Unified registration updated', { 
        email: email,
        newInterests: interests,
        allInterests: updatedInterests 
      }, req);

      return res.json({
        success: true,
        message: 'Your registration has been updated with new interests!',
        registrationId: existingRegistration.id,
        interests: updatedInterests
      });
    }

    // Create new registration record
    const registration = {
      id: `unified_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      company: company?.trim() || '',
      phone: phone?.trim() || '',
      interests: interests,
      message: message?.trim() || '',
      newsletter: Boolean(newsletter),
      registeredAt: new Date().toISOString(),
      status: 'pending',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || '',
      source: 'landing_page'
    };

    // Initialize unified registrations array if it doesn't exist
    if (!db.data.unifiedRegistrations) {
      db.data.unifiedRegistrations = [];
    }

    // Add registration
    db.data.unifiedRegistrations.push(registration);
    db.save();

    // Send confirmation email to user
    try {
      await emailService.sendUnifiedRegistrationConfirmation(email, name, interests);
    } catch (emailError) {
      logUtils.logError(emailError, { 
        action: 'send_unified_confirmation_email', 
        registrationId: registration.id 
      }, req);
    }

    // Send notification to admin
    try {
      await emailService.sendUnifiedRegistrationNotification(registration);
    } catch (emailError) {
      logUtils.logError(emailError, { 
        action: 'send_unified_admin_notification', 
        registrationId: registration.id 
      }, req);
    }

    // Log successful registration
    logUtils.logInfo('Unified registration successful', {
      registrationId: registration.id,
      email: email,
      interests: interests,
      hasCompany: Boolean(company),
      hasPhone: Boolean(phone)
    }, req);

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Thank you for your interest! We will contact you within 48 hours.',
      registrationId: registration.id,
      data: {
        name: registration.name,
        email: registration.email,
        interests: registration.interests,
        registeredAt: registration.registeredAt
      }
    });

  } catch (error) {
    logUtils.logError(error, { action: 'unified_registration' }, req);
    res.status(500).json({
      error: 'Registration failed',
      message: 'There was an error processing your registration. Please try again.'
    });
  }
});

// Get unified registration statistics (admin only)
router.get('/stats', async (req, res) => {
  try {
    const db = getDatabase();
    const registrations = db.data.unifiedRegistrations || [];

    const stats = {
      total: registrations.length,
      byInterest: {
        platform: 0,
        tgt: 0,
        both: 0
      },
      newsletter: {
        subscribed: 0,
        total: registrations.length
      },
      recentRegistrations: registrations
        .sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt))
        .slice(0, 15)
        .map(reg => ({
          id: reg.id,
          name: reg.name,
          email: reg.email,
          interests: reg.interests,
          company: reg.company,
          registeredAt: reg.registeredAt
        }))
    };

    // Calculate statistics
    registrations.forEach(reg => {
      // Count by interest
      if (reg.interests.includes('both')) {
        stats.byInterest.both++;
      } else {
        if (reg.interests.includes('platform')) {
          stats.byInterest.platform++;
        }
        if (reg.interests.includes('tgt')) {
          stats.byInterest.tgt++;
        }
      }

      // Newsletter subscriptions
      if (reg.newsletter) {
        stats.newsletter.subscribed++;
      }
    });

    res.json(stats);

  } catch (error) {
    logUtils.logError(error, { action: 'get_unified_stats' }, req);
    res.status(500).json({
      error: 'Failed to retrieve statistics'
    });
  }
});

module.exports = router;
