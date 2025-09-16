const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const { getDatabase } = require('../lib/database');
const { authMiddleware, validationRules, handleValidationErrors, fileUploadSecurity } = require('../lib/security');
// Simple Intelligence Service (no external dependencies)
const SimpleIntelligenceService = require('../src/services/simpleIntelligenceService');
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

    // Save to database
    const submission = db.create('kycSubmissions', kycSubmission);

    // Log the submission
    logUtils.logBusiness('kyc_submission_created', {
      submissionId: submission.id,
      userId,
      company: company?.trim(),
      country: country?.trim(),
      entityType: entityType || 'unknown',
      filesCount: files.length
    });

    // Start automated compliance checks after a brief delay
    setTimeout(async () => {
      await performAutomatedComplianceChecks(submission.id);
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

    const latestSubmission = submissions[0];

    res.json({
      kyc: user.kyc || { status: 'not_started' },
      latestSubmission: latestSubmission ? {
        id: latestSubmission.id,
        status: latestSubmission.status,
        submittedAt: latestSubmission.submittedAt,
        riskScore: latestSubmission.riskScore,
        reviewNotes: latestSubmission.reviewNotes || []
      } : null,
      submissionCount: submissions.length
    });

  } catch (error) {
    logUtils.logError(error, { action: 'kyc_status_check' }, req);
    res.status(500).json({ error: 'Failed to get KYC status' });
  }
});

// Admin: Get all KYC submissions
router.get('/admin/submissions', authMiddleware.requireAuth, authMiddleware.requireRole('admin'), (req, res) => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;

    let submissions = db.findAll('kycSubmissions');

    // Filter by status if provided
    if (status && status !== 'all') {
      submissions = submissions.filter(sub => sub.status === status);
    }

    // Sort by submission date (newest first)
    submissions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    // Pagination
    const total = submissions.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedSubmissions = submissions.slice(startIndex, endIndex);

    // Add user details to each submission
    const enrichedSubmissions = paginatedSubmissions.map(submission => {
      const user = db.findById('users', submission.userId);
      return {
        ...submission,
        userEmail: user?.email || 'Unknown',
        userName: user?.profile?.name || 'Unknown'
      };
    });

    res.json({
      submissions: enrichedSubmissions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logUtils.logError(error, { action: 'admin_get_kyc_submissions' }, req);
    res.status(500).json({ error: 'Failed to get KYC submissions' });
  }
});

// Admin: Review KYC submission
router.post('/admin/review/:submissionId', authMiddleware.requireAuth, authMiddleware.requireRole('admin'), async (req, res) => {
  try {
    const db = getDatabase();
    const { submissionId } = req.params;
    const { status, notes, riskScore } = req.body;

    const submission = db.findById('kycSubmissions', submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'KYC submission not found' });
    }

    // Update submission
    const updatedData = {
      status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: req.user.id,
      riskScore: riskScore || submission.riskScore,
      reviewNotes: [...(submission.reviewNotes || []), {
        note: notes,
        addedAt: new Date().toISOString(),
        addedBy: req.user.id
      }]
    };

    db.update('kycSubmissions', submissionId, updatedData);

    // Update user KYC status if approved
    if (status === 'approved') {
      const user = db.findById('users', submission.userId);
      if (user) {
        db.update('users', user.id, {
          kyc: {
            ...user.kyc,
            status: 'verified',
            reviewedAt: new Date().toISOString(),
            reviewedBy: req.user.id
          }
        });
      }
    }

    logUtils.logBusiness('kyc_admin_review', {
      submissionId,
      reviewedBy: req.user.id,
      status,
      riskScore: riskScore || submission.riskScore
    });

    res.json({ success: true, message: 'KYC submission reviewed successfully' });

  } catch (error) {
    logUtils.logError(error, { action: 'admin_review_kyc' }, req);
    res.status(500).json({ error: 'Failed to review KYC submission' });
  }
});

// Simplified automated compliance checks using intelligent screening
async function performAutomatedComplianceChecks(submissionId) {
  try {
    const db = getDatabase();
    const submission = db.findById('kycSubmissions', submissionId);
    if (!submission) {
      console.error('KYC submission not found:', submissionId);
      return;
    }

    console.log(`🔍 Starting INTELLIGENCE SCREENING for submission ${submissionId} - ${submission.companyData.company}`);
    
    // Initialize simplified intelligence service
    const intelligenceService = new SimpleIntelligenceService();
    
    // Prepare KYC data for intelligence screening
    const kycData = {
      companyName: submission.companyData.company,
      country: submission.companyData.country,
      registrationNumber: submission.companyData.regNumber,
      businessType: submission.companyData.businessType || 'unknown',
      businessDescription: submission.companyData.businessDescription || '',
      address: submission.companyData.address || '',
      directors: submission.companyData.directors || [],
      shareholders: submission.companyData.shareholders || [],
      documents: submission.files || []
    };
    
    // Perform simplified intelligence screening
    const screeningResults = await intelligenceService.performComprehensiveScreening(kycData);
    
    // Generate detailed report
    const detailedReport = intelligenceService.generateDetailedReport(screeningResults);
    
    // Convert to compliance checks format
    const complianceChecks = [
      {
        type: 'sanctions_screening',
        status: screeningResults.screeningResults.sanctions.status.toLowerCase(),
        confidence: 0.95,
        provider: 'SIMPLIFIED_INTELLIGENCE_SYSTEM',
        checkedAt: new Date().toISOString(),
        details: screeningResults.screeningResults.sanctions.details,
        sources: ['Internal Sanctions Database']
      },
      {
        type: 'company_verification',
        status: screeningResults.screeningResults.company.status.toLowerCase(),
        confidence: 0.90,
        provider: 'COMPANY_ANALYSIS',
        checkedAt: new Date().toISOString(),
        details: screeningResults.screeningResults.company.details,
        sources: ['Company Registry Analysis']
      },
      {
        type: 'beneficial_ownership',
        status: screeningResults.screeningResults.ownership.status.toLowerCase(),
        confidence: 0.85,
        provider: 'OWNERSHIP_SCREENING',
        checkedAt: new Date().toISOString(),
        details: screeningResults.screeningResults.ownership.details,
        sources: ['Beneficial Ownership Screening']
      },
      {
        type: 'country_risk',
        status: screeningResults.screeningResults.geographic.status.toLowerCase(),
        confidence: 0.95,
        provider: 'GEOGRAPHIC_RISK_ASSESSMENT',
        checkedAt: new Date().toISOString(),
        details: screeningResults.screeningResults.geographic.details,
        sources: ['Geographic Risk Database']
      },
      {
        type: 'sector_risk',
        status: screeningResults.screeningResults.sector.status.toLowerCase(),
        confidence: 0.80,
        provider: 'SECTOR_ANALYSIS',
        checkedAt: new Date().toISOString(),
        details: screeningResults.screeningResults.sector.details,
        sources: ['Sector Risk Analysis']
      },
      {
        type: 'document_verification',
        status: screeningResults.screeningResults.document.status.toLowerCase(),
        confidence: 0.90,
        provider: 'DOCUMENT_ANALYSIS',
        checkedAt: new Date().toISOString(),
        details: screeningResults.screeningResults.document.details,
        sources: ['Document Verification']
      }
    ];

    // Determine status and auto-approval
    const riskScore = screeningResults.overallRiskScore;
    let status = 'pending';
    let autoApproved = screeningResults.autoApproved;

    if (riskScore >= 70) {
      status = 'flagged';
      autoApproved = false;
    } else if (riskScore < 30 && autoApproved) {
      status = 'approved';
    }

    // Update submission with screening results
    const updatedData = {
      complianceChecks,
      riskScore,
      overallRiskScore: riskScore,
      screeningResults: {
        summary: {
          totalFindings: screeningResults.flags.length,
          sourcesChecked: screeningResults.sources.length,
          screeningDate: screeningResults.timestamp,
          processingTime: screeningResults.processingTime
        },
        detailedReport,
        riskLevel: screeningResults.riskLevel,
        flags: screeningResults.flags,
        sources: screeningResults.sources
      },
      automatedChecksCompletedAt: new Date().toISOString(),
      status,
      autoApproved
    };

    if (autoApproved) {
      updatedData.reviewedAt = new Date().toISOString();
      updatedData.reviewedBy = 'AUTOMATED_SYSTEM';
    }

    db.update('kycSubmissions', submissionId, updatedData);

    // Update user status if auto-approved
    if (autoApproved) {
      const user = db.findById('users', submission.userId);
      if (user) {
        db.update('users', user.id, {
          kyc: {
            ...user.kyc,
            status: 'verified',
            reviewedAt: new Date().toISOString(),
            verificationMethod: 'automated_screening'
          }
        });
      }

      logUtils.logBusiness('kyc_auto_approved', {
        submissionId,
        riskScore,
        userId: submission.userId,
        company: submission.companyData.company
      });
    }

    // Send notifications for high-risk submissions
    if (riskScore >= 70) {
      websocketService.broadcast('admin', {
        type: 'kyc_high_risk_alert',
        submissionId,
        company: submission.companyData.company,
        riskScore,
        flags: screeningResults.flags,
        priority: 'urgent'
      });

      // Send email alert for high-risk findings
      try {
        await emailService.sendEmail({
          to: 'compliance@tangent-protocol.com',
          subject: `🚨 HIGH RISK: KYC Submission - ${submission.companyData.company}`,
          html: `
            <div style="color: #dc2626; border: 2px solid #dc2626; padding: 20px; border-radius: 8px;">
              <h2>🚨 HIGH RISK KYC SUBMISSION</h2>
              <p><strong>Company:</strong> ${submission.companyData.company}</p>
              <p><strong>Country:</strong> ${submission.companyData.country}</p>
              <p><strong>Risk Score:</strong> ${riskScore}/100 (${screeningResults.riskLevel})</p>
              <p><strong>Risk Flags:</strong> ${screeningResults.flags.length}</p>
              <hr>
              <h3>Risk Indicators:</h3>
              <ul>
                ${screeningResults.flags.map(flag => `<li>${flag}</li>`).join('')}
              </ul>
              <p><strong>Submission ID:</strong> ${submissionId}</p>
              <p><a href="${process.env.DOMAIN || 'https://tangent-protocol.com'}/admin">Review in Admin Panel →</a></p>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Failed to send risk alert email:', emailError);
      }
    }

    logUtils.logBusiness('intelligence_screening_completed', {
      submissionId,
      company: submission.companyData.company,
      riskScore,
      riskLevel: screeningResults.riskLevel,
      flagsCount: screeningResults.flags.length,
      sourcesCount: screeningResults.sources.length,
      processingTime: screeningResults.processingTime,
      autoApproved,
      status
    });

    console.log(`✅ Intelligence screening completed for ${submission.companyData.company}`);
    console.log(`   Risk Score: ${riskScore}/100 (${screeningResults.riskLevel})`);
    console.log(`   Risk Flags: ${screeningResults.flags.length}`);
    console.log(`   Sources: ${screeningResults.sources.length}`);
    console.log(`   Processing Time: ${screeningResults.processingTime}ms`);
    console.log(`   Status: ${status}${autoApproved ? ' (Auto-Approved)' : ''}`);

  } catch (error) {
    console.error('Intelligence screening error:', error);
    logUtils.logError(error, { 
      action: 'intelligence_screening', 
      submissionId,
      error: error.message
    });
    
    // Update submission with error status
    try {
      const db = getDatabase();
      db.update('kycSubmissions', submissionId, {
        status: 'screening_error',
        screeningError: error.message,
        lastUpdated: new Date().toISOString(),
        complianceChecks: [{
          type: 'system_error',
          status: 'error',
          confidence: 0.0,
          provider: 'INTELLIGENCE_SYSTEM',
          checkedAt: new Date().toISOString(),
          details: error.message
        }]
      });
    } catch (dbError) {
      console.error('Failed to update submission with error status:', dbError);
    }
  }
}

module.exports = router;