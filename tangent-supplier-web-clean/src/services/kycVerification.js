const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// KYC Verification Service
class KYCVerificationService {
  constructor() {
    this.requiredDocuments = {
      'certificate-of-incorporation': {
        name: 'Certificate of Incorporation',
        required: true,
        fileTypes: ['pdf', 'jpg', 'jpeg', 'png'],
        maxSize: 10 * 1024 * 1024, // 10MB
        keywords: ['incorporation', 'certificate', 'company', 'registration']
      },
      'business-license': {
        name: 'Business License',
        required: true,
        fileTypes: ['pdf', 'jpg', 'jpeg', 'png'],
        maxSize: 10 * 1024 * 1024,
        keywords: ['license', 'business', 'permit', 'authorization']
      },
      'tax-registration': {
        name: 'Tax Registration',
        required: true,
        fileTypes: ['pdf', 'jpg', 'jpeg', 'png'],
        maxSize: 10 * 1024 * 1024,
        keywords: ['tax', 'registration', 'identification', 'number']
      },
      'bank-statement': {
        name: 'Bank Statement',
        required: true,
        fileTypes: ['pdf', 'jpg', 'jpeg', 'png'],
        maxSize: 10 * 1024 * 1024,
        keywords: ['bank', 'statement', 'account', 'financial']
      },
      'financial-statements': {
        name: 'Financial Statements',
        required: false,
        fileTypes: ['pdf', 'xlsx', 'xls'],
        maxSize: 20 * 1024 * 1024,
        keywords: ['financial', 'statement', 'balance', 'sheet', 'income']
      },
      'identity-verification': {
        name: 'Identity Verification',
        required: true,
        fileTypes: ['pdf', 'jpg', 'jpeg', 'png'],
        maxSize: 5 * 1024 * 1024,
        keywords: ['passport', 'id', 'identity', 'driver', 'license']
      }
    };

    this.sanctionsLists = {
      'un': 'United Nations Sanctions',
      'eu': 'European Union Sanctions',
      'us': 'US OFAC Sanctions',
      'uk': 'UK HM Treasury Sanctions'
    };
  }

  // Analyze uploaded documents
  async analyzeDocuments(files, companyData) {
    const analysis = {
      status: 'pending',
      documents: {},
      riskScore: 0,
      issues: [],
      recommendations: [],
      timestamp: new Date().toISOString()
    };

    try {
      // Validate file types and sizes
      const validation = this.validateFiles(files);
      if (!validation.valid) {
        analysis.status = 'failed';
        analysis.issues = validation.errors;
        return analysis;
      }

      // Analyze each document
      for (const file of files) {
        const docAnalysis = await this.analyzeDocument(file, companyData);
        analysis.documents[file.originalname] = docAnalysis;
      }

      // Check document completeness
      const completeness = this.checkDocumentCompleteness(analysis.documents);
      analysis.issues = analysis.issues.concat(completeness.missing);

      // Perform sanctions screening
      const sanctionsCheck = await this.performSanctionsScreening(companyData);
      analysis.sanctionsCheck = sanctionsCheck;

      // Calculate risk score
      analysis.riskScore = this.calculateRiskScore(analysis.documents, sanctionsCheck, completeness);

      // Determine final status
      analysis.status = this.determineStatus(analysis);

      // Generate recommendations
      analysis.recommendations = this.generateRecommendations(analysis);

      return analysis;

    } catch (error) {
      console.error('KYC Analysis Error:', error);
      analysis.status = 'error';
      analysis.issues.push('Analysis failed: ' + error.message);
      return analysis;
    }
  }

  // Validate uploaded files
  validateFiles(files) {
    const errors = [];
    
    if (!files || files.length === 0) {
      errors.push('No files uploaded');
      return { valid: false, errors };
    }

    for (const file of files) {
      // Check file size
      if (file.size > 20 * 1024 * 1024) { // 20MB max
        errors.push(`File ${file.originalname} is too large (max 20MB)`);
      }

      // Check file type
      const extension = path.extname(file.originalname).toLowerCase().slice(1);
      const allowedTypes = ['pdf', 'jpg', 'jpeg', 'png', 'xlsx', 'xls'];
      if (!allowedTypes.includes(extension)) {
        errors.push(`File ${file.originalname} has unsupported format`);
      }

      // Check for suspicious file names
      if (this.isSuspiciousFileName(file.originalname)) {
        errors.push(`File ${file.originalname} has suspicious name`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // Analyze individual document
  async analyzeDocument(file, companyData) {
    const analysis = {
      fileName: file.originalname,
      fileSize: file.size,
      fileType: path.extname(file.originalname).toLowerCase(),
      status: 'pending',
      confidence: 0,
      extractedData: {},
      issues: [],
      timestamp: new Date().toISOString()
    };

    try {
      // Basic file analysis
      analysis.fileHash = this.calculateFileHash(file.path);
      
      // Check for document type based on filename and content
      const docType = this.identifyDocumentType(file.originalname, file.path);
      analysis.documentType = docType;

      // Extract text (simplified - in production would use OCR)
      const extractedText = await this.extractTextFromDocument(file.path);
      analysis.extractedData.text = extractedText;

      // Validate document content
      const validation = this.validateDocumentContent(docType, extractedText, companyData);
      analysis.confidence = validation.confidence;
      analysis.issues = validation.issues;

      // Check for document authenticity indicators
      const authenticity = this.checkDocumentAuthenticity(file, extractedText);
      analysis.authenticityScore = authenticity.score;
      analysis.issues = analysis.issues.concat(authenticity.issues);

      analysis.status = analysis.issues.length === 0 ? 'verified' : 'flagged';

    } catch (error) {
      analysis.status = 'error';
      analysis.issues.push('Document analysis failed: ' + error.message);
    }

    return analysis;
  }

  // Identify document type based on filename and content
  identifyDocumentType(fileName, filePath) {
    const fileNameLower = fileName.toLowerCase();
    
    for (const [type, config] of Object.entries(this.requiredDocuments)) {
      for (const keyword of config.keywords) {
        if (fileNameLower.includes(keyword)) {
          return type;
        }
      }
    }

    // Default classification based on file extension
    const extension = path.extname(fileName).toLowerCase();
    if (extension === '.pdf') return 'certificate-of-incorporation';
    if (['.jpg', '.jpeg', '.png'].includes(extension)) return 'identity-verification';
    
    return 'unknown';
  }

  // Extract text from document (simplified version)
  async extractTextFromDocument(filePath) {
    // In production, this would use OCR services like:
    // - AWS Textract
    // - Google Document AI
    // - Azure Form Recognizer
    // - Tesseract.js
    
    // For now, return a mock extraction
    return `Mock extracted text from ${path.basename(filePath)}`;
  }

  // Validate document content
  validateDocumentContent(docType, extractedText, companyData) {
    const issues = [];
    let confidence = 0;

    if (!extractedText || extractedText.length < 10) {
      issues.push('Document appears to be empty or corrupted');
      return { confidence: 0, issues };
    }

    // Check for company name consistency
    if (companyData.company) {
      const companyNameLower = companyData.company.toLowerCase();
      const textLower = extractedText.toLowerCase();
      
      if (textLower.includes(companyNameLower)) {
        confidence += 30;
      } else {
        issues.push('Company name not found in document');
      }
    }

    // Check for required fields based on document type
    const config = this.requiredDocuments[docType];
    if (config) {
      for (const keyword of config.keywords) {
        if (extractedText.toLowerCase().includes(keyword)) {
          confidence += 10;
        }
      }
    }

    // Check for suspicious patterns
    if (this.containsSuspiciousPatterns(extractedText)) {
      issues.push('Document contains suspicious patterns');
      confidence -= 20;
    }

    return { confidence: Math.max(0, Math.min(100, confidence)), issues };
  }

  // Check document authenticity
  checkDocumentAuthenticity(file, extractedText) {
    const issues = [];
    let score = 50; // Base score

    // Check file metadata
    if (file.size < 1000) { // Less than 1KB
      issues.push('File size suspiciously small');
      score -= 20;
    }

    // Check for common fraud indicators
    const fraudIndicators = [
      'sample',
      'test',
      'draft',
      'copy',
      'scan',
      'screenshot'
    ];

    const fileNameLower = file.originalname.toLowerCase();
    for (const indicator of fraudIndicators) {
      if (fileNameLower.includes(indicator)) {
        issues.push('Document appears to be a sample or test document');
        score -= 30;
        break;
      }
    }

    // Check for watermark or security features
    if (extractedText.includes('COPY') || extractedText.includes('SAMPLE')) {
      issues.push('Document appears to be a copy or sample');
      score -= 25;
    }

    return { score: Math.max(0, score), issues };
  }

  // Check document completeness
  checkDocumentCompleteness(documents) {
    const missing = [];
    const found = new Set();

    // Identify which document types we have
    for (const [fileName, analysis] of Object.entries(documents)) {
      if (analysis.documentType && analysis.documentType !== 'unknown') {
        found.add(analysis.documentType);
      }
    }

    // Check for missing required documents
    for (const [type, config] of Object.entries(this.requiredDocuments)) {
      if (config.required && !found.has(type)) {
        missing.push(`Missing required document: ${config.name}`);
      }
    }

    return { missing, found: Array.from(found) };
  }

  // Perform sanctions screening
  async performSanctionsScreening(companyData) {
    const screening = {
      status: 'pending',
      results: {},
      riskLevel: 'low',
      timestamp: new Date().toISOString()
    };

    try {
      // In production, this would integrate with:
      // - Refinitiv World-Check
      // - Dow Jones Risk & Compliance
      // - LexisNexis Risk Solutions
      // - ComplyAdvantage API

      // Mock sanctions screening
      const companyName = companyData.company?.toLowerCase() || '';
      const country = companyData.country?.toLowerCase() || '';

      // Check against mock sanctions lists
      const sanctionsHits = this.checkMockSanctionsList(companyName, country);
      
      screening.results = sanctionsHits;
      screening.riskLevel = sanctionsHits.length > 0 ? 'high' : 'low';
      screening.status = 'completed';

    } catch (error) {
      screening.status = 'error';
      screening.results = { error: error.message };
    }

    return screening;
  }

  // Mock sanctions list check
  checkMockSanctionsList(companyName, country) {
    const mockSanctionsList = [
      { name: 'test sanctions company', country: 'test', list: 'un' },
      { name: 'suspicious corp', country: 'test', list: 'us' },
      { name: 'fraudulent ltd', country: 'test', list: 'eu' }
    ];

    const hits = [];
    
    for (const entry of mockSanctionsList) {
      if (companyName.includes(entry.name) || 
          (entry.country === country && country === 'test')) {
        hits.push({
          name: entry.name,
          country: entry.country,
          list: entry.list,
          listName: this.sanctionsLists[entry.list],
          matchType: 'exact'
        });
      }
    }

    return hits;
  }

  // Calculate overall risk score
  calculateRiskScore(documents, sanctionsCheck, completeness) {
    let score = 0;

    // Document quality score (0-40 points)
    const docCount = Object.keys(documents).length;
    const requiredCount = Object.values(this.requiredDocuments).filter(d => d.required).length;
    score += Math.min(40, (docCount / requiredCount) * 40);

    // Document confidence score (0-30 points)
    const avgConfidence = Object.values(documents).reduce((sum, doc) => sum + (doc.confidence || 0), 0) / docCount;
    score += (avgConfidence / 100) * 30;

    // Sanctions check (0-30 points)
    if (sanctionsCheck.riskLevel === 'low') {
      score += 30;
    } else if (sanctionsCheck.riskLevel === 'medium') {
      score += 15;
    }

    // Completeness penalty
    score -= completeness.missing.length * 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // Determine final KYC status
  determineStatus(analysis) {
    if (analysis.riskScore >= 80 && analysis.sanctionsCheck.riskLevel === 'low') {
      return 'approved';
    } else if (analysis.riskScore >= 60 && analysis.sanctionsCheck.riskLevel === 'low') {
      return 'pending_review';
    } else if (analysis.sanctionsCheck.riskLevel === 'high') {
      return 'rejected';
    } else {
      return 'requires_documents';
    }
  }

  // Generate recommendations
  generateRecommendations(analysis) {
    const recommendations = [];

    if (analysis.status === 'requires_documents') {
      recommendations.push('Please provide all required documents');
    }

    if (analysis.riskScore < 60) {
      recommendations.push('Consider providing additional supporting documents');
    }

    if (analysis.sanctionsCheck.riskLevel === 'high') {
      recommendations.push('Sanctions screening requires manual review');
    }

    if (analysis.issues.length > 0) {
      recommendations.push('Address the identified issues before resubmission');
    }

    return recommendations;
  }

  // Utility methods
  calculateFileHash(filePath) {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
      return null;
    }
  }

  isSuspiciousFileName(fileName) {
    const suspiciousPatterns = [
      /\.exe$/i,
      /\.bat$/i,
      /\.cmd$/i,
      /\.scr$/i,
      /\.vbs$/i,
      /\.js$/i,
      /\.php$/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(fileName));
  }

  containsSuspiciousPatterns(text) {
    const suspiciousPatterns = [
      /password/i,
      /secret/i,
      /confidential/i,
      /internal/i,
      /draft/i,
      /test/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(text));
  }
}

module.exports = new KYCVerificationService();
