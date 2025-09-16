const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Web3Storage, File } = require('web3.storage');

// Document Management Service
class DocumentService {
  constructor() {
    this.documentTypes = {
      0: { name: 'eBL (Electronic Bill of Lading)', required: true, category: 'shipping' },
      1: { name: 'Commercial Invoice', required: true, category: 'financial' },
      2: { name: 'Packing List', required: true, category: 'shipping' },
      3: { name: 'Certificate of Origin', required: false, category: 'legal' },
      4: { name: 'Insurance Certificate', required: false, category: 'insurance' },
      5: { name: 'Quality Certificate', required: false, category: 'quality' },
      6: { name: 'Weight Certificate', required: false, category: 'shipping' },
      7: { name: 'Inspection Report', required: false, category: 'quality' }
    };

    this.documentStatuses = {
      'uploaded': 'Uploaded',
      'verified': 'Verified',
      'rejected': 'Rejected',
      'pending_review': 'Pending Review',
      'archived': 'Archived'
    };

    this.supportedFormats = {
      'pdf': { mime: 'application/pdf', maxSize: 10 * 1024 * 1024 }, // 10MB
      'jpg': { mime: 'image/jpeg', maxSize: 5 * 1024 * 1024 }, // 5MB
      'jpeg': { mime: 'image/jpeg', maxSize: 5 * 1024 * 1024 }, // 5MB
      'png': { mime: 'image/png', maxSize: 5 * 1024 * 1024 }, // 5MB
      'doc': { mime: 'application/msword', maxSize: 10 * 1024 * 1024 }, // 10MB
      'docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', maxSize: 10 * 1024 * 1024 } // 10MB
    };

    // Initialize Web3.Storage (if configured)
    this.web3Storage = null;
    this.initializeWeb3Storage();
  }

  // Initialize Web3.Storage
  initializeWeb3Storage() {
    try {
      const token = process.env.WEB3_STORAGE_TOKEN;
      if (token) {
        this.web3Storage = new Web3Storage({ token });
        console.log('✅ Web3.Storage initialized');
      } else {
        console.log('⚠️ Web3.Storage not configured - set WEB3_STORAGE_TOKEN environment variable');
      }
    } catch (error) {
      console.error('❌ Web3.Storage initialization failed:', error.message);
    }
  }

  // Upload document to Web3.Storage
  async uploadToWeb3Storage(filePath, fileName) {
    if (!this.web3Storage) {
      throw new Error('Web3.Storage not configured');
    }

    try {
      const file = new File([fs.readFileSync(filePath)], fileName);
      const cid = await this.web3Storage.put([file]);
      return `https://${cid}.ipfs.w3s.link/${fileName}`;
    } catch (error) {
      console.error('Web3.Storage upload error:', error);
      throw new Error(`Failed to upload to Web3.Storage: ${error.message}`);
    }
  }

  // Calculate file hash
  calculateFileHash(filePath) {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
      console.error('Hash calculation error:', error);
      throw new Error(`Failed to calculate file hash: ${error.message}`);
    }
  }

  // Validate document file
  validateDocumentFile(file) {
    const errors = [];
    const warnings = [];

    // Check file size
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      errors.push(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed size (10MB)`);
    }

    // Check file extension
    const extension = path.extname(file.originalname).toLowerCase().substring(1);
    if (!this.supportedFormats[extension]) {
      errors.push(`Unsupported file format: ${extension}. Supported formats: ${Object.keys(this.supportedFormats).join(', ')}`);
    }

    // Check MIME type
    if (this.supportedFormats[extension] && file.mimetype !== this.supportedFormats[extension].mime) {
      warnings.push(`MIME type mismatch: expected ${this.supportedFormats[extension].mime}, got ${file.mimetype}`);
    }

    // Check for suspicious file names
    const suspiciousPatterns = [/\.exe$/i, /\.bat$/i, /\.cmd$/i, /\.scr$/i, /\.pif$/i];
    if (suspiciousPatterns.some(pattern => pattern.test(file.originalname))) {
      errors.push('Suspicious file type detected');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Create document record
  createDocumentRecord(documentData) {
    const document = {
      id: this.generateDocumentId(),
      type: documentData.type,
      typeName: this.documentTypes[documentData.type]?.name || 'Unknown',
      category: this.documentTypes[documentData.type]?.category || 'general',
      name: documentData.name,
      originalName: documentData.originalName,
      size: documentData.size,
      mimeType: documentData.mimeType,
      hash: documentData.hash,
      uri: documentData.uri,
      localPath: documentData.localPath,
      status: 'uploaded',
      uploadedBy: documentData.uploadedBy,
      uploadedAt: new Date().toISOString(),
      verified: false,
      verificationHash: null,
      verificationNotes: null,
      verifiedBy: null,
      verifiedAt: null,
      metadata: {
        tradeId: documentData.tradeId || null,
        description: documentData.description || '',
        tags: documentData.tags || [],
        confidential: documentData.confidential || false,
        retentionPeriod: documentData.retentionPeriod || 365 // days
      },
      access: {
        public: false,
        authorizedUsers: documentData.authorizedUsers || [],
        permissions: documentData.permissions || ['read']
      }
    };

    return document;
  }

  // Process uploaded document
  async processDocument(file, documentData) {
    try {
      // Validate file
      const validation = this.validateDocumentFile(file);
      if (!validation.valid) {
        throw new Error(`Document validation failed: ${validation.errors.join(', ')}`);
      }

      // Calculate hash
      const hash = this.calculateFileHash(file.path);

      // Upload to Web3.Storage if available
      let uri = null;
      if (this.web3Storage) {
        try {
          uri = await this.uploadToWeb3Storage(file.path, file.originalname);
        } catch (error) {
          console.warn('Web3.Storage upload failed, using local path:', error.message);
        }
      }

      // Create document record
      const document = this.createDocumentRecord({
        ...documentData,
        name: file.originalname,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        hash: hash,
        uri: uri,
        localPath: file.path
      });

      return {
        document,
        validation,
        success: true
      };

    } catch (error) {
      console.error('Document processing error:', error);
      return {
        document: null,
        validation: { valid: false, errors: [error.message], warnings: [] },
        success: false,
        error: error.message
      };
    }
  }

  // Verify document integrity
  verifyDocumentIntegrity(document) {
    try {
      if (!document.localPath || !fs.existsSync(document.localPath)) {
        return {
          valid: false,
          error: 'Document file not found'
        };
      }

      const currentHash = this.calculateFileHash(document.localPath);
      const isValid = currentHash === document.hash;

      return {
        valid: isValid,
        currentHash,
        storedHash: document.hash,
        error: isValid ? null : 'Document hash mismatch - file may have been tampered with'
      };
    } catch (error) {
      return {
        valid: false,
        error: `Verification failed: ${error.message}`
      };
    }
  }

  // Update document status
  updateDocumentStatus(document, newStatus, updatedBy, notes = null) {
    const oldStatus = document.status;
    document.status = newStatus;
    document.updatedAt = new Date().toISOString();

    if (newStatus === 'verified') {
      document.verified = true;
      document.verifiedBy = updatedBy;
      document.verifiedAt = new Date().toISOString();
      document.verificationHash = this.calculateFileHash(document.localPath);
    }

    if (notes) {
      document.verificationNotes = notes;
    }

    // Add to audit trail
    if (!document.auditTrail) {
      document.auditTrail = [];
    }

    document.auditTrail.push({
      action: 'status_change',
      oldStatus,
      newStatus,
      updatedBy,
      timestamp: new Date().toISOString(),
      notes
    });

    return document;
  }

  // Get document statistics
  getDocumentStatistics(documents) {
    const stats = {
      total: documents.length,
      byType: {},
      byStatus: {},
      byCategory: {},
      totalSize: 0,
      verifiedCount: 0,
      pendingCount: 0,
      rejectedCount: 0
    };

    documents.forEach(doc => {
      // Count by type
      const typeName = doc.typeName || 'Unknown';
      stats.byType[typeName] = (stats.byType[typeName] || 0) + 1;

      // Count by status
      stats.byStatus[doc.status] = (stats.byStatus[doc.status] || 0) + 1;

      // Count by category
      const category = doc.category || 'general';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

      // Sum total size
      stats.totalSize += doc.size || 0;

      // Count verified/pending/rejected
      if (doc.verified) stats.verifiedCount++;
      if (doc.status === 'pending_review') stats.pendingCount++;
      if (doc.status === 'rejected') stats.rejectedCount++;
    });

    return stats;
  }

  // Search documents
  searchDocuments(documents, query) {
    const searchTerm = query.toLowerCase();
    
    return documents.filter(doc => {
      return (
        doc.name.toLowerCase().includes(searchTerm) ||
        doc.typeName.toLowerCase().includes(searchTerm) ||
        doc.category.toLowerCase().includes(searchTerm) ||
        (doc.metadata.description && doc.metadata.description.toLowerCase().includes(searchTerm)) ||
        (doc.metadata.tags && doc.metadata.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
      );
    });
  }

  // Get documents by trade
  getDocumentsByTrade(documents, tradeId) {
    return documents.filter(doc => doc.metadata.tradeId === tradeId);
  }

  // Archive document
  archiveDocument(document, archivedBy, reason = null) {
    document.status = 'archived';
    document.archivedBy = archivedBy;
    document.archivedAt = new Date().toISOString();
    document.archiveReason = reason;

    if (!document.auditTrail) {
      document.auditTrail = [];
    }

    document.auditTrail.push({
      action: 'archived',
      archivedBy,
      timestamp: new Date().toISOString(),
      reason
    });

    return document;
  }

  // Generate document ID
  generateDocumentId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `DOC-${timestamp}-${random}`.toUpperCase();
  }

  // Get document type info
  getDocumentTypeInfo(type) {
    return this.documentTypes[type] || null;
  }

  // Get all document types
  getAllDocumentTypes() {
    return Object.entries(this.documentTypes).map(([id, info]) => ({
      id: parseInt(id),
      name: info.name,
      required: info.required,
      category: info.category
    }));
  }

  // Check if document type is required
  isDocumentTypeRequired(type) {
    return this.documentTypes[type]?.required || false;
  }

  // Get required documents for trade
  getRequiredDocumentsForTrade(tradeData) {
    const required = [];
    
    Object.entries(this.documentTypes).forEach(([id, info]) => {
      if (info.required) {
        required.push({
          id: parseInt(id),
          name: info.name,
          category: info.category,
          required: true
        });
      }
    });

    return required;
  }

  // Validate document completeness for trade
  validateTradeDocumentCompleteness(trade, documents) {
    const tradeDocuments = this.getDocumentsByTrade(documents, trade.id);
    const required = this.getRequiredDocumentsForTrade(trade);
    const missing = [];
    const present = [];

    required.forEach(req => {
      const found = tradeDocuments.find(doc => doc.type === req.id);
      if (found) {
        present.push(found);
      } else {
        missing.push(req);
      }
    });

    return {
      complete: missing.length === 0,
      required: required.length,
      present: present.length,
      missing: missing.length,
      missingDocuments: missing,
      presentDocuments: present
    };
  }
}

module.exports = new DocumentService();
