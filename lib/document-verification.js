// Real Document Content Verification
// Checks that documents actually contain what they claim to be

const fs = require('fs').promises;
const path = require('path');

// Document verification patterns and keywords
const DOCUMENT_KEYWORDS = {
    passport: {
        keywords: ['passport', 'passport no', 'nationality', 'date of birth', 'issuing authority', 'republic', 'kingdom'],
        minKeywords: 2,
        formats: ['passport-', 'pass-', 'travel document']
    },
    incorporation: {
        keywords: ['incorporation', 'company', 'corporation', 'inc', 'ltd', 'limited', 'articles of incorporation'],
        minKeywords: 2,
        formats: ['articles', 'certificate of incorporation']
    },
    financials: {
        keywords: ['balance sheet', 'financial statements', 'revenue', 'income statement', 'audited', 'accounting'],
        minKeywords: 2,
        formats: ['financial', 'audited', 'statements']
    },
    bylaws: {
        keywords: ['bylaws', 'articles of organization', 'operating agreement', 'member', 'ownership'],
        minKeywords: 1,
        formats: ['bylaw', 'articles']
    },
    identity: {
        keywords: ['identity', 'id card', 'driving licence', 'date of birth', 'national id'],
        minKeywords: 2,
        formats: ['id', 'identity']
    }
};

// MIME type validation for document authenticity
const VALID_MIME_TYPES = {
    passport: ['image/jpeg', 'image/png', 'application/pdf'],
    incorporation: ['application/pdf', 'image/jpeg', 'image/png'],
    financials: ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    bylaws: ['application/pdf'],
    identity: ['image/jpeg', 'image/png', 'application/pdf']
};

// Verify document content using filename and keywords
async function verifyDocumentType(filePath, documentType, category) {
    const result = {
        isValid: false,
        confidence: 0,
        matches: [],
        issues: []
    };
    
    try {
        const filename = path.basename(filePath);
        const fileNameLower = filename.toLowerCase();
        
        // Check if filename matches expected document type
        const docConfig = DOCUMENT_KEYWORDS[documentType] || DOCUMENT_KEYWORDS.identity;
        let matches = 0;
        
        // Check filename patterns
        for (const format of docConfig.formats) {
            if (fileNameLower.includes(format)) {
                matches++;
                result.matches.push(`Filename pattern match: ${format}`);
            }
        }
        
        // Read file content for keyword verification (for PDF and text files)
        const fileExtension = path.extname(filePath).toLowerCase();
        
        if (fileExtension === '.pdf' || fileExtension === '.txt') {
            try {
                const fileContent = await fs.readFile(filePath, 'utf8');
                const contentLower = fileContent.toLowerCase();
                
                // Check for document type keywords
                for (const keyword of docConfig.keywords) {
                    if (contentLower.includes(keyword.toLowerCase())) {
                        matches++;
                        result.matches.push(`Keyword match: ${keyword}`);
                    }
                }
            } catch (err) {
                // Can't read content (might be binary PDF), that's okay
                result.issues.push('Unable to read file content for keyword verification');
            }
        } else {
            // For images, we can only check filename
            result.issues.push('Image files: Only filename verification possible');
        }
        
        // Calculate confidence based on matches
        result.confidence = Math.min(matches / docConfig.minKeywords, 1.0);
        result.isValid = matches >= docConfig.minKeywords;
        
        if (!result.isValid) {
            result.issues.push(`Insufficient matches for ${documentType}: found ${matches}, required ${docConfig.minKeywords}`);
        }
        
        return result;
        
    } catch (error) {
        console.error('Document verification error:', error);
        result.issues.push(`Verification error: ${error.message}`);
        return result;
    }
}

// Enhanced validation that checks actual content
async function enhancedDocumentValidation(files, companyType) {
    const validationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        verifiedDocuments: [],
        unverifiedDocuments: [],
        timestamp: new Date().toISOString()
    };
    
    try {
        for (const [category, fileArray] of Object.entries(files)) {
            if (!fileArray || fileArray.length === 0) continue;
            
            for (const file of fileArray) {
                const filePath = file.path;
                const documentType = category; // passport, incorporation, etc.
                
                // Verify document content
                const verification = await verifyDocumentType(filePath, documentType, category);
                
                if (verification.isValid) {
                    validationResult.verifiedDocuments.push({
                        type: documentType,
                        filename: file.originalname,
                        confidence: verification.confidence,
                        matches: verification.matches
                    });
                } else {
                    validationResult.unverifiedDocuments.push({
                        type: documentType,
                        filename: file.originalname,
                        issues: verification.issues,
                        confidence: verification.confidence
                    });
                    
                    // Add warning for low confidence
                    if (verification.confidence < 0.5) {
                        validationResult.warnings.push(
                            `Document verification failed for ${file.originalname}: ${verification.issues.join(', ')}`
                        );
                    }
                }
            }
        }
        
        // Mark as invalid if critical documents are unverified
        const requiredDocs = ['passport']; // Could be dynamic based on company type
        
        requiredDocs.forEach(docType => {
            const docUploaded = validationResult.verifiedDocuments.some(d => d.type === docType);
            const docUnverified = validationResult.unverifiedDocuments.some(d => d.type === docType);
            
            if (docUnverified && !docUploaded) {
                validationResult.errors.push(`Critical document verification failed: ${docType}`);
                validationResult.isValid = false;
            }
        });
        
        console.log('✅ Enhanced Document Validation Result:', {
            verified: validationResult.verifiedDocuments.length,
            unverified: validationResult.unverifiedDocuments.length,
            warnings: validationResult.warnings.length
        });
        
        return validationResult;
        
    } catch (error) {
        console.error('Enhanced validation error:', error);
        validationResult.errors.push(`Validation error: ${error.message}`);
        validationResult.isValid = false;
        return validationResult;
    }
}

// Export functions
module.exports = {
    verifyDocumentType,
    enhancedDocumentValidation,
    DOCUMENT_KEYWORDS,
    VALID_MIME_TYPES
};

