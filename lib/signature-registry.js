// Signature Registry System
// Tracks who signed which documents and when

const crypto = require('crypto');

class SignatureRegistry {
    constructor() {
        this.signatures = new Map(); // signatureId -> signature record
        this.documentSignatures = new Map(); // documentId -> array of signatureIds
    }

    /**
     * Register a document signature
     * @param {Object} signatureData - Signature information
     * @param {Object} options - Options including autoApprove
     * @returns {Object} Signature record with ID
     */
    registerSignature(signatureData, options = {}) {
        const {
            documentId,
            signerEmail,
            signerName,
            signerRole,
            signatureMethod, // 'digital', 'qr_code', 'blockchain', 'manual'
            signatureHash, // SHA-256 hash of signature
            metadata = {}
        } = signatureData;

        if (!documentId || !signerEmail) {
            throw new Error('Document ID and signer email are required');
        }

        const signatureId = `sig-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
        
        // Generate signature hash if not provided
        const finalHash = signatureHash || this.generateSignatureHash(signatureData);
        
        // Check if signature matches existing verified signature (auto-approval)
        let autoApproved = false;
        if (options.autoApprove !== false) {
            autoApproved = this.checkSignatureMatch(documentId, signerEmail, finalHash);
        }
        
        const signature = {
            id: signatureId,
            documentId,
            signerEmail,
            signerName: signerName || signerEmail,
            signerRole: signerRole || 'user',
            signatureMethod,
            signatureHash: finalHash,
            signedAt: new Date().toISOString(),
            verified: autoApproved,
            verifiedAt: autoApproved ? new Date().toISOString() : null,
            verifiedBy: autoApproved ? 'system' : null,
            autoApproved: autoApproved,
            metadata: {
                ipAddress: metadata.ipAddress,
                userAgent: metadata.userAgent,
                contractId: metadata.contractId,
                ...metadata
            },
            blockchainTxHash: metadata.blockchainTxHash || null,
            qrCodeData: metadata.qrCodeData || null
        };

        this.signatures.set(signatureId, signature);

        // Track signatures per document
        if (!this.documentSignatures.has(documentId)) {
            this.documentSignatures.set(documentId, []);
        }
        this.documentSignatures.get(documentId).push(signatureId);

        if (autoApproved) {
            console.log(`[SIGNATURE] Auto-approved signature ${signatureId} for document ${documentId} (matches verified signature)`);
        }

        return signature;
    }

    /**
     * Check if signature matches an existing verified signature (for auto-approval)
     * @param {string} documentId - Document ID
     * @param {string} signerEmail - Signer email
     * @param {string} signatureHash - Signature hash
     * @returns {boolean} True if matches verified signature
     */
    checkSignatureMatch(documentId, signerEmail, signatureHash) {
        const existingSignatures = this.getDocumentSignatures(documentId);
        
        // Check if there's a verified signature from the same signer with matching hash
        const matchingSignature = existingSignatures.find(sig => 
            sig.signerEmail === signerEmail &&
            sig.signatureHash === signatureHash &&
            sig.verified === true
        );
        
        if (matchingSignature) {
            return true;
        }
        
        // Check if signer has verified signatures on other documents (trusted signer)
        const signerSignatures = this.getSignaturesBySigner(signerEmail);
        const verifiedCount = signerSignatures.filter(sig => sig.verified).length;
        
        // Auto-approve if signer has 3+ verified signatures (trusted signer)
        if (verifiedCount >= 3) {
            return true;
        }
        
        return false;
    }

    /**
     * Verify a signature
     * @param {string} signatureId - Signature ID to verify
     * @param {string} verifiedBy - Email of person verifying
     * @returns {Object} Updated signature record
     */
    verifySignature(signatureId, verifiedBy) {
        const signature = this.signatures.get(signatureId);
        if (!signature) {
            throw new Error('Signature not found');
        }

        signature.verified = true;
        signature.verifiedAt = new Date().toISOString();
        signature.verifiedBy = verifiedBy;

        this.signatures.set(signatureId, signature);
        return signature;
    }

    /**
     * Get all signatures for a document
     * @param {string} documentId - Document ID
     * @returns {Array} Array of signature records
     */
    getDocumentSignatures(documentId) {
        const signatureIds = this.documentSignatures.get(documentId) || [];
        return signatureIds.map(id => this.signatures.get(id)).filter(Boolean);
    }

    /**
     * Get signature by ID
     * @param {string} signatureId - Signature ID
     * @returns {Object} Signature record
     */
    getSignature(signatureId) {
        return this.signatures.get(signatureId);
    }

    /**
     * Get all signatures by signer
     * @param {string} signerEmail - Signer email
     * @returns {Array} Array of signature records
     */
    getSignaturesBySigner(signerEmail) {
        return Array.from(this.signatures.values())
            .filter(sig => sig.signerEmail === signerEmail);
    }

    /**
     * Check if document is signed by required parties
     * @param {string} documentId - Document ID
     * @param {Array} requiredSigners - Array of required signer emails
     * @returns {Object} Verification result
     */
    checkRequiredSignatures(documentId, requiredSigners) {
        const signatures = this.getDocumentSignatures(documentId);
        const signedBy = signatures.map(sig => sig.signerEmail);
        
        const missing = requiredSigners.filter(email => !signedBy.includes(email));
        const present = requiredSigners.filter(email => signedBy.includes(email));

        return {
            documentId,
            allSigned: missing.length === 0,
            requiredSigners,
            signedBy,
            present,
            missing,
            signatureCount: signatures.length,
            verifiedCount: signatures.filter(sig => sig.verified).length
        };
    }

    /**
     * Generate signature hash
     * @param {Object} signatureData - Signature data
     * @returns {string} SHA-256 hash
     */
    generateSignatureHash(signatureData) {
        const data = JSON.stringify({
            documentId: signatureData.documentId,
            signerEmail: signatureData.signerEmail,
            signedAt: new Date().toISOString(),
            signatureMethod: signatureData.signatureMethod
        });
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    /**
     * Get signature statistics
     * @returns {Object} Statistics
     */
    getStatistics() {
        const allSignatures = Array.from(this.signatures.values());
        return {
            total: allSignatures.length,
            verified: allSignatures.filter(sig => sig.verified).length,
            unverified: allSignatures.filter(sig => !sig.verified).length,
            byMethod: {
                digital: allSignatures.filter(sig => sig.signatureMethod === 'digital').length,
                qr_code: allSignatures.filter(sig => sig.signatureMethod === 'qr_code').length,
                blockchain: allSignatures.filter(sig => sig.signatureMethod === 'blockchain').length,
                manual: allSignatures.filter(sig => sig.signatureMethod === 'manual').length
            },
            documentsWithSignatures: this.documentSignatures.size
        };
    }
}

// Export singleton instance
module.exports = new SignatureRegistry();

