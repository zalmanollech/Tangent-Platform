// PDF Contract Extraction Module
// Extracts contract terms from PDF files and converts to smart contract format

const fs = require('fs').promises;

// Lazy-load pdf-parse to avoid startup crashes
let pdf = null;
function getPdfParser() {
    if (pdf === null) {
        try {
            pdf = require('pdf-parse');
        } catch (error) {
            console.warn('pdf-parse not available:', error.message);
            pdf = false; // Mark as unavailable
        }
    }
    if (pdf === false) {
        throw new Error('PDF parsing is not available in this environment');
    }
    return pdf;
}

// Patterns for extracting contract information
const EXTRACTION_PATTERNS = {
    // Email extraction
    email: /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
    
    // Product/Commodity extraction
    product: /(?:product|commodity|item|goods|material)[\s:]*([^\n]{1,100})/i,
    
    // Quantity extraction
    quantity: /(?:quantity|qty|amount|volume)[\s:]*([0-9,]+\.?[0-9]*)\s*([a-zA-Z]{0,10})/i,
    
    // Price extraction
    price: /(?:price|cost|rate|per\s*(?:unit|mt|ton|kg))[\s:]*\$?([0-9,]+\.?[0-9]*)/i,
    totalPrice: /(?:total|contract\s*value|total\s*amount)[\s:]*\$?([0-9,]+\.?[0-9]*)/i,
    
    // Date extraction
    deliveryDate: /(?:delivery\s*date|shipment\s*date|expected\s*delivery|delivery\s*by)[\s:]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i,
    contractDate: /(?:contract\s*date|date\s*of\s*contract|execution\s*date)[\s:]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i,
    
    // Payment terms
    paymentTerms: /(?:payment\s*terms|payment\s*conditions|terms\s*of\s*payment)[\s:]*([^\n]{1,200})/i,
    
    // Origin/Destination
    origin: /(?:origin|from|shipping\s*from|origin\s*port)[\s:]*([^\n]{1,100})/i,
    destination: /(?:destination|to|shipping\s*to|destination\s*port)[\s:]*([^\n]{1,100})/i,
    
    // Parties
    buyer: /(?:buyer|purchaser|buyer\s*name|purchaser\s*name)[\s:]*([^\n]{1,100})/i,
    supplier: /(?:supplier|seller|vendor|supplier\s*name|seller\s*name)[\s:]*([^\n]{1,100})/i,
    
    // Specifications
    specifications: /(?:specifications|terms\s*and\s*conditions|special\s*terms|conditions)[\s:]*([^\n]{1,500})/i
};

/**
 * Extract contract data from PDF file
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<Object>} Extracted contract data
 */
async function extractContractFromPDF(filePath) {
    try {
        // Get PDF parser (lazy-loaded)
        const pdfParser = getPdfParser();
        
        // Read PDF file
        const dataBuffer = await fs.readFile(filePath);
        const pdfData = await pdfParser(dataBuffer);
        const text = pdfData.text;
        
        // Extract contract information
        const extracted = {
            // Basic info
            productDetails: extractField(text, EXTRACTION_PATTERNS.product),
            quantity: extractQuantity(text),
            unit: extractUnit(text),
            pricePerUnit: extractPrice(text),
            totalValue: extractTotalValue(text),
            
            // Dates
            deliveryDate: extractDate(text, EXTRACTION_PATTERNS.deliveryDate),
            contractDate: extractDate(text, EXTRACTION_PATTERNS.contractDate),
            
            // Parties
            buyerEmail: extractEmail(text),
            supplierEmail: extractEmail(text, 1), // Second email
            buyerName: extractField(text, EXTRACTION_PATTERNS.buyer),
            supplierName: extractField(text, EXTRACTION_PATTERNS.supplier),
            
            // Location
            origin: extractField(text, EXTRACTION_PATTERNS.origin),
            destination: extractField(text, EXTRACTION_PATTERNS.destination),
            
            // Terms
            paymentTerms: extractField(text, EXTRACTION_PATTERNS.paymentTerms),
            specifications: extractField(text, EXTRACTION_PATTERNS.specifications),
            
            // Confidence scores
            confidence: {
                productDetails: calculateConfidence(text, 'product'),
                quantity: calculateConfidence(text, 'quantity'),
                price: calculateConfidence(text, 'price'),
                dates: calculateConfidence(text, 'date'),
                parties: calculateConfidence(text, 'email')
            },
            
            // Raw text for reference
            rawText: text.substring(0, 1000), // First 1000 chars
            
            // Extraction metadata
            extractedAt: new Date().toISOString(),
            pages: pdfData.numpages
        };
        
        return extracted;
        
    } catch (error) {
        console.error('PDF extraction error:', error);
        throw new Error(`Failed to extract contract from PDF: ${error.message}`);
    }
}

/**
 * Extract a field using pattern matching
 */
function extractField(text, pattern) {
    const match = text.match(pattern);
    if (match && match[1]) {
        return match[1].trim().replace(/[^\w\s@.,$-]/g, '');
    }
    return null;
}

/**
 * Extract quantity and unit
 */
function extractQuantity(text) {
    const match = text.match(EXTRACTION_PATTERNS.quantity);
    if (match && match[1]) {
        const qty = parseFloat(match[1].replace(/,/g, ''));
        const unit = match[2] ? match[2].trim() : 'MT';
        return { quantity: qty, unit: unit };
    }
    
    // Try alternative patterns
    const altMatch = text.match(/([0-9,]+\.?[0-9]*)\s*(?:MT|tons?|kg|pounds?|units?)/i);
    if (altMatch) {
        return {
            quantity: parseFloat(altMatch[1].replace(/,/g, '')),
            unit: altMatch[2] || 'MT'
        };
    }
    
    return { quantity: null, unit: 'MT' };
}

/**
 * Extract unit separately if needed
 */
function extractUnit(text) {
    const match = text.match(/(?:quantity|qty|amount|volume)[\s:]*[0-9,]+\.?[0-9]*\s*([a-zA-Z]{2,10})/i);
    if (match && match[1]) {
        return match[1].trim();
    }
    return 'MT'; // Default
}

/**
 * Extract price per unit
 */
function extractPrice(text) {
    const match = text.match(EXTRACTION_PATTERNS.price);
    if (match && match[1]) {
        return parseFloat(match[1].replace(/,/g, '').replace('$', ''));
    }
    return null;
}

/**
 * Extract total contract value
 */
function extractTotalValue(text) {
    const match = text.match(EXTRACTION_PATTERNS.totalPrice);
    if (match && match[1]) {
        return parseFloat(match[1].replace(/,/g, '').replace('$', ''));
    }
    
    // Calculate from quantity and price if available
    const qtyData = extractQuantity(text);
    const price = extractPrice(text);
    if (qtyData.quantity && price) {
        return qtyData.quantity * price;
    }
    
    return null;
}

/**
 * Extract date from text
 */
function extractDate(text, pattern) {
    const match = text.match(pattern);
    if (match && match[1]) {
        const dateStr = match[1];
        // Try to parse and format as YYYY-MM-DD
        try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        } catch (e) {
            // Fallback to original string
        }
        return dateStr;
    }
    return null;
}

/**
 * Extract email addresses
 */
function extractEmail(text, index = 0) {
    const matches = text.match(EXTRACTION_PATTERNS.email);
    if (matches && matches[index]) {
        return matches[index].trim();
    }
    return null;
}

/**
 * Calculate confidence score for extraction
 */
function calculateConfidence(text, type) {
    let score = 0;
    
    switch (type) {
        case 'product':
            if (text.match(/(?:product|commodity|item)/i)) score += 0.3;
            if (text.match(/(?:wheat|corn|soy|rice|cotton|sugar|coffee|cocoa|oil|gas|gold|silver|copper)/i)) score += 0.4;
            if (text.match(/[0-9]+\s*(?:MT|tons?|kg)/i)) score += 0.3;
            break;
        case 'quantity':
            if (text.match(/[0-9,]+\.?[0-9]*\s*(?:MT|tons?|kg|units?)/i)) score += 0.5;
            if (text.match(/(?:quantity|qty|amount)/i)) score += 0.5;
            break;
        case 'price':
            if (text.match(/\$[0-9,]+\.?[0-9]*/i)) score += 0.5;
            if (text.match(/(?:price|cost|rate)/i)) score += 0.5;
            break;
        case 'date':
            if (text.match(/[0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4}/)) score += 0.5;
            if (text.match(/(?:date|delivery|shipment)/i)) score += 0.5;
            break;
        case 'email':
            if (text.match(EXTRACTION_PATTERNS.email)) score += 1.0;
            break;
    }
    
    return Math.min(score, 1.0);
}

/**
 * Format extracted data for contract creation
 */
function formatForContractCreation(extracted, userRole, userEmail) {
    const formatted = {
        productDetails: extracted.productDetails || 'Unknown Product',
        quantity: extracted.quantity?.quantity || 0,
        unit: extracted.quantity?.unit || 'MT',
        pricePerUnit: extracted.pricePerUnit || 0,
        totalValue: extracted.totalValue || extracted.quantity?.quantity * extracted.pricePerUnit || 0,
        deliveryDate: extracted.deliveryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
        paymentTerms: extracted.paymentTerms || '30% Deposit + 70% on Documents',
        origin: extracted.origin || '',
        destination: extracted.destination || '',
        specifications: extracted.specifications || '',
        contractRole: userRole,
        // Try to determine counterparty
        counterpartyEmail: userRole === 'buyer' ? extracted.supplierEmail : extracted.buyerEmail,
        supplierEmail: userRole === 'supplier' ? userEmail : extracted.supplierEmail,
        buyerEmail: userRole === 'buyer' ? userEmail : extracted.buyerEmail
    };
    
    return formatted;
}

module.exports = {
    extractContractFromPDF,
    formatForContractCreation,
    calculateConfidence
};

