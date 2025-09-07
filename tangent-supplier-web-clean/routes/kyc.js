const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const { getDatabase } = require('../lib/database');
const { authMiddleware, validationRules, handleValidationErrors, fileUploadSecurity } = require('../lib/security');
const { logUtils } = require('../lib/logger');
const { config } = require('../lib/config');
const websocketService = require('../lib/websocket');
const emailService = require('../lib/email');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.storage.local.uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedName = file.originalname.replace(/[^\w.-]/g, '_');
    cb(null, uniqueSuffix + '-' + sanitizedName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.storage.local.maxFileSize,
    files: 10
  },
  fileFilter: (req, file, cb) => {
    const validation = fileUploadSecurity.validateFile(file, 'documents');
    if (validation.valid) {
      cb(null, true);
    } else {
      cb(new Error(validation.errors.join('; ')), false);
    }
  }
});

// Submit KYC application
router.post('/submit', authMiddleware.requireAuth, upload.array('files', 10), validationRules.kyc, handleValidationErrors, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    const {
      company,
      country,
      regNumber,
      fullName,
      cryptoExperience,
      hasWallet,
      understoodRisks,
      entityType
    } = req.body;

    // Validate entity type if provided
    if (entityType && !['private', 'public'].includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    // Process uploaded files
    const files = req.files ? req.files.map(file => ({
      name: file.originalname,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: new Date().toISOString()
    })) : [];

    // Validate file requirements based on entity type
    if (entityType === 'private' && files.length < 2) {
      return res.status(400).json({ error: 'Private companies must upload at least 2 documents' });
    }
    if (entityType === 'public' && files.length < 1) {
      return res.status(400).json({ error: 'Public companies must upload at least 1 document' });
    }

    // Create KYC submission record
    const kycSubmission = {
      userId,
      submittedAt: new Date().toISOString(),
      status: 'pending',
      entityType: entityType || 'unknown',
      companyData: {
        company: company?.trim(),
        country: country?.trim(),
        regNumber: regNumber?.trim(),
        fullName: fullName?.trim(),
        cryptoData: {
          experience: Array.isArray(cryptoExperience) ? cryptoExperience : [cryptoExperience],
          hasWallet: Boolean(hasWallet),
          understoodRisks: Boolean(understoodRisks)
        }
      },
      files,
      reviewNotes: [],
      riskScore: null,
      complianceChecks: []
    };

    // Save KYC submission
    const submission = db.create('kycSubmissions', kycSubmission);

    // Update user's KYC status
    const user = db.findById('users', userId);
    if (user) {
      const updatedKyc = {
        ...user.kyc,
        status: 'submitted',
        submissionId: submission.id,
        submittedAt: new Date().toISOString(),
        ...kycSubmission.companyData
      };

      db.update('users', userId, { kyc: updatedKyc });
    }

    // Log KYC submission
    logUtils.logBusiness('kyc_submitted', {
      submissionId: submission.id,
      entityType,
      fileCount: files.length,
      company: company?.trim()
    }, userId);

    // Trigger automated compliance checks (simulate for now)
    setTimeout(() => {
      performAutomatedComplianceChecks(submission.id);
    }, 1000);

    res.status(201).json({
      success: true,
      message: 'KYC application submitted successfully',
      submissionId: submission.id,
      status: 'pending'
    });

  } catch (error) {
    logUtils.logError(error, { action: 'kyc_submission' }, req);
    res.status(500).json({ error: 'KYC submission failed' });
  }
});

// Get KYC status
router.get('/status', authMiddleware.requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;

    const user = db.findById('users', userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get latest submission if exists
    const submissions = db.find('kycSubmissions', { userId }).sort((a, b) => 
      new Date(b.submittedAt) - new Date(a.submittedAt)
    );

    const latestSubmission = submissions.length > 0 ? submissions[0] : null;

    res.json({
      success: true,
      kyc: user.kyc,
      latestSubmission: latestSubmission ? {
        id: latestSubmission.id,
        status: latestSubmission.status,
        submittedAt: latestSubmission.submittedAt,
        entityType: latestSubmission.entityType,
        reviewNotes: latestSubmission.reviewNotes || []
      } : null
    });

  } catch (error) {
    logUtils.logError(error, { action: 'get_kyc_status' }, req);
    res.status(500).json({ error: 'Failed to get KYC status' });
  }
});

// Get KYC submission details (user can only see their own)
router.get('/submission/:id', authMiddleware.requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const submissionId = req.params.id;
    const userId = req.user.id;

    const submission = db.findById('kycSubmissions', submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Check ownership
    if (submission.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Remove sensitive data
    const safeSubmission = {
      ...submission,
      files: submission.files.map(f => ({
        name: f.name,
        size: f.size,
        uploadedAt: f.uploadedAt
      }))
    };

    res.json({
      success: true,
      submission: safeSubmission
    });

  } catch (error) {
    logUtils.logError(error, { action: 'get_kyc_submission' }, req);
    res.status(500).json({ error: 'Failed to get submission details' });
  }
});

// Admin: List all KYC submissions
router.get('/admin/submissions', authMiddleware.requireAdmin, (req, res) => {
  try {
    const db = getDatabase();
    const { status, page = 1, limit = 20 } = req.query;

    let submissions = db.find('kycSubmissions');

    // Filter by status if provided
    if (status && ['pending', 'approved', 'rejected', 'under_review'].includes(status)) {
      submissions = submissions.filter(s => s.status === status);
    }

    // Sort by submission date (newest first)
    submissions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedSubmissions = submissions.slice(startIndex, endIndex);

    // Add user information
    const enrichedSubmissions = paginatedSubmissions.map(submission => {
      const user = db.findById('users', submission.userId);
      return {
        ...submission,
        user: user ? {
          id: user.id,
          email: user.email,
          role: user.role
        } : null
      };
    });

    res.json({
      success: true,
      submissions: enrichedSubmissions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: submissions.length,
        totalPages: Math.ceil(submissions.length / parseInt(limit))
      }
    });

  } catch (error) {
    logUtils.logError(error, { action: 'admin_list_kyc' }, req);
    res.status(500).json({ error: 'Failed to list KYC submissions' });
  }
});

// Admin: Review KYC submission
router.post('/admin/review/:id', authMiddleware.requireAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const submissionId = req.params.id;
    const { status, notes, riskScore } = req.body;

    // Validate status
    if (!['approved', 'rejected', 'under_review'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Validate risk score
    if (riskScore !== undefined && (riskScore < 0 || riskScore > 100)) {
      return res.status(400).json({ error: 'Risk score must be between 0 and 100' });
    }

    const submission = db.findById('kycSubmissions', submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Update submission
    const updates = {
      status,
      riskScore: riskScore || submission.riskScore,
      reviewedAt: new Date().toISOString(),
      reviewedBy: req.user.id
    };

    if (notes) {
      updates.reviewNotes = [...(submission.reviewNotes || []), {
        note: notes,
        addedBy: req.user.id,
        addedAt: new Date().toISOString()
      }];
    }

    const updatedSubmission = db.update('kycSubmissions', submissionId, updates);

    // Update user's KYC status
    const user = db.findById('users', submission.userId);
    if (user) {
      const kycStatus = status === 'approved' ? 'verified' : status;
      db.update('users', user.id, {
        kyc: {
          ...user.kyc,
          status: kycStatus,
          reviewedAt: new Date().toISOString()
        }
      });
    }

    // Log review action
    logUtils.logBusiness('kyc_reviewed', {
      submissionId,
      status,
      riskScore,
      reviewedUserId: submission.userId
    }, req.user.id);

    // Send real-time notification to user
    if (user) {
      websocketService.notifyKYCUpdate(user.id, status, notes);
      
      // Send email notification
      try {
        await emailService.sendKYCStatusEmail(user.email, user.fullName || user.email.split('@')[0], status, notes);
      } catch (emailError) {
        logUtils.logError(emailError, { action: 'send_kyc_email', userId: user.id }, req);
      }
    }

    res.json({
      success: true,
      message: 'KYC submission reviewed successfully',
      submission: updatedSubmission
    });

  } catch (error) {
    logUtils.logError(error, { action: 'admin_review_kyc' }, req);
    res.status(500).json({ error: 'Failed to review KYC submission' });
  }
});

// Automated compliance checks (simulated)
async function performAutomatedComplianceChecks(submissionId) {
  try {
    const db = getDatabase();
    const submission = db.findById('kycSubmissions', submissionId);
    if (!submission) return;

    // Simulate compliance checks
    const complianceChecks = [
      {
        type: 'sanctions_screening',
        status: 'clear',
        confidence: 0.95,
        provider: 'DEMO_COMPLIANCE_ENGINE',
        checkedAt: new Date().toISOString()
      },
      {
        type: 'pep_screening',
        status: 'clear',
        confidence: 0.92,
        provider: 'DEMO_COMPLIANCE_ENGINE',
        checkedAt: new Date().toISOString()
      }
    ];

    // Calculate risk score based on checks
    const riskScore = Math.random() * 30; // 0-30 for demo (low risk)

    // Update submission with compliance results
    db.update('kycSubmissions', submissionId, {
      complianceChecks,
      riskScore,
      automatedChecksCompletedAt: new Date().toISOString()
    });

    // Auto-approve low-risk submissions
    if (riskScore < 20) {
      db.update('kycSubmissions', submissionId, {
        status: 'approved',
        autoApproved: true,
        reviewedAt: new Date().toISOString()
      });

      // Update user status
      const user = db.findById('users', submission.userId);
      if (user) {
        db.update('users', user.id, {
          kyc: {
            ...user.kyc,
            status: 'verified',
            reviewedAt: new Date().toISOString()
          }
        });
      }

      logUtils.logBusiness('kyc_auto_approved', {
        submissionId,
        riskScore,
        userId: submission.userId
      });
    }

  } catch (error) {
    console.error('Automated compliance check error:', error);
    logUtils.logError(error, { action: 'automated_compliance_check', submissionId });
  }
}

module.exports = router;
