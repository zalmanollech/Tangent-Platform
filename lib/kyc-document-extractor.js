// KYC Document Extraction Module
// Extracts company information from KYC documents to auto-populate credit report forms
// Uses the same PDF parsing capability as contract extraction

const fs = require('fs').promises;
const path = require('path');

// Lazy-load pdf-parse (same approach as contract-extractor)
let pdf = null;
function getPdfParser() {
    if (pdf === null) {
        try {
            pdf = require('pdf-parse');
        } catch (error) {
            console.warn('pdf-parse not available for KYC extraction:', error.message);
            pdf = false; // Mark as unavailable
        }
    }
    if (pdf === false) {
        throw new Error('PDF parsing is not available in this environment');
    }
    return pdf;
}

// Patterns for extracting company information from KYC documents
const COMPANY_EXTRACTION_PATTERNS = {
    // Company name patterns
    companyName: [
        /(?:company\s*name|business\s*name|entity\s*name|registered\s*name)[\s:]*([^\n]{1,100})/i,
        /(?:name\s*of\s*company|legal\s*name)[\s:]*([^\n]{1,100})/i,
        /(?:corporation\s*name|incorporated\s*as)[\s:]*([^\n]{1,100})/i
    ],
    
    // Registration number patterns
    registrationNumber: [
        /(?:registration\s*number|reg\s*no|company\s*number|registration\s*no|reg\s*number)[\s:]*([A-Z0-9\-]{3,30})/i,
        /(?:tax\s*id|tax\s*identification|tax\s*number|EIN|VAT|GST)[\s:]*([A-Z0-9\-]{3,30})/i,
        /(?:corporate\s*id|entity\s*id|business\s*id)[\s:]*([A-Z0-9\-]{3,30})/i,
        /(?:certificate\s*number|cert\s*no)[\s:]*([A-Z0-9\-]{3,30})/i
    ],
    
    // Address patterns
    address: [
        /(?:registered\s*address|business\s*address|principal\s*address|company\s*address)[\s:]*([^\n]{10,200})/i,
        /(?:address\s*of\s*incorporation|incorporation\s*address)[\s:]*([^\n]{10,200})/i,
        /(?:principal\s*office|registered\s*office)[\s:]*([^\n]{10,200})/i
    ],
    
    // Country patterns
    country: [
        /(?:country\s*of\s*incorporation|place\s*of\s*incorporation|incorporation\s*country|jurisdiction)[\s:]*([A-Z\s]{2,50})/i,
        /(?:registered\s*in|incorporated\s*in|country\s*of\s*registration)[\s:]*([A-Z\s]{2,50})/i,
        /(?:country|jurisdiction)[\s:]*([A-Z\s]{2,50})/i
    ],
    
    // Date of incorporation
    incorporationDate: [
        /(?:date\s*of\s*incorporation|incorporation\s*date|date\s*of\s*registration|registration\s*date)[\s:]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i
    ]
};

/**
 * Extract company information from KYC documents
 * @param {Array} documentPaths - Array of file paths to KYC documents
 * @returns {Promise<Object>} Extracted company information
 */
async function extractCompanyInfoFromKYC(documentPaths) {
    const extracted = {
        companyName: null,
        registrationNumber: null,
        address: null,
        country: null,
        incorporationDate: null,
        confidence: {
            companyName: 0,
            registrationNumber: 0,
            address: 0,
            country: 0,
            overall: 0
        },
        sources: {
            companyName: [],
            registrationNumber: [],
            address: [],
            country: []
        },
        extractedAt: new Date().toISOString()
    };
    
    // Extract text from all documents
    const allTexts = [];
    for (const docPath of documentPaths) {
        try {
            const text = await extractTextFromDocument(docPath);
            if (text) {
                allTexts.push({ path: docPath, text: text });
            }
        } catch (error) {
            console.warn(`Failed to extract text from ${docPath}:`, error.message);
        }
    }
    
    // Combine all text
    const combinedText = allTexts.map(d => d.text).join('\n\n');
    
    // Extract company name
    extracted.companyName = extractCompanyName(combinedText);
    extracted.confidence.companyName = extracted.companyName ? 0.8 : 0;
    extracted.sources.companyName = allTexts.filter(d => d.text.includes(extracted.companyName || '')).map(d => path.basename(d.path));
    
    // Extract registration number
    extracted.registrationNumber = extractRegistrationNumber(combinedText);
    extracted.confidence.registrationNumber = extracted.registrationNumber ? 0.85 : 0;
    extracted.sources.registrationNumber = allTexts.filter(d => d.text.includes(extracted.registrationNumber || '')).map(d => path.basename(d.path));
    
    // Extract address
    extracted.address = extractAddress(combinedText);
    extracted.confidence.address = extracted.address ? 0.75 : 0;
    extracted.sources.address = allTexts.filter(d => d.text.includes(extracted.address || '')).map(d => path.basename(d.path));
    
    // Extract country
    extracted.country = extractCountry(combinedText);
    extracted.confidence.country = extracted.country ? 0.8 : 0;
    extracted.sources.country = allTexts.filter(d => d.text.includes(extracted.country || '')).map(d => path.basename(d.path));
    
    // Extract incorporation date
    extracted.incorporationDate = extractIncorporationDate(combinedText);
    
    // Calculate overall confidence
    const confidenceScores = Object.values(extracted.confidence).filter(c => c > 0);
    extracted.confidence.overall = confidenceScores.length > 0 
        ? confidenceScores.reduce((sum, c) => sum + c, 0) / confidenceScores.length 
        : 0;
    
    return extracted;
}

/**
 * Extract text from document (PDF or text file)
 */
async function extractTextFromDocument(filePath) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        
        if (ext === '.pdf') {
            // Use PDF parser
            const pdfParser = getPdfParser();
            const dataBuffer = await fs.readFile(filePath);
            const pdfData = await pdfParser(dataBuffer);
            return pdfData.text;
        } else if (ext === '.txt' || ext === '.doc' || ext === '.docx') {
            // Read text file (basic - for .txt only)
            if (ext === '.txt') {
                return await fs.readFile(filePath, 'utf8');
            }
            // For .doc/.docx, would need additional library
            return null;
        } else {
            // For images, would need OCR (not implemented here)
            return null;
        }
    } catch (error) {
        console.warn(`Error extracting text from ${filePath}:`, error.message);
        return null;
    }
}

/**
 * Extract company name from text
 */
function extractCompanyName(text) {
    for (const pattern of COMPANY_EXTRACTION_PATTERNS.companyName) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const name = match[1].trim();
            // Clean up the name
            return name.replace(/[^\w\s@.,\-&]/g, '').trim();
        }
    }
    return null;
}

/**
 * Extract registration number from text
 */
function extractRegistrationNumber(text) {
    for (const pattern of COMPANY_EXTRACTION_PATTERNS.registrationNumber) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const regNum = match[1].trim().toUpperCase();
            // Clean up - keep only alphanumeric and hyphens
            return regNum.replace(/[^A-Z0-9\-]/g, '').trim();
        }
    }
    return null;
}

/**
 * Extract address from text
 */
function extractAddress(text) {
    for (const pattern of COMPANY_EXTRACTION_PATTERNS.address) {
        const match = text.match(pattern);
        if (match && match[1]) {
            let address = match[1].trim();
            // Clean up - remove excessive whitespace
            address = address.replace(/\s+/g, ' ').trim();
            // Limit to reasonable length
            if (address.length > 200) {
                address = address.substring(0, 200);
            }
            return address;
        }
    }
    return null;
}

/**
 * Extract country from text
 */
function extractCountry(text) {
    for (const pattern of COMPANY_EXTRACTION_PATTERNS.country) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const country = match[1].trim().toUpperCase();
            // Common country names/codes
            const countryMap = {
                'UNITED STATES': 'USA',
                'USA': 'USA',
                'US': 'USA',
                'UNITED KINGDOM': 'GBR',
                'UK': 'GBR',
                'GREAT BRITAIN': 'GBR',
                'GERMANY': 'DEU',
                'FRANCE': 'FRA',
                'CANADA': 'CAN',
                'AUSTRALIA': 'AUS',
                'JAPAN': 'JPN',
                'CHINA': 'CHN',
                'INDIA': 'IND',
                'BRAZIL': 'BRA',
                'RUSSIA': 'RUS',
                'TURKEY': 'TUR',
                'MEXICO': 'MEX'
            };
            
            // Check if it's a known country
            for (const [key, value] of Object.entries(countryMap)) {
                if (country.includes(key)) {
                    return value;
                }
            }
            
            // Return first 3 letters if it looks like a country code
            if (country.length === 2 || country.length === 3) {
                return country.substring(0, 3);
            }
            
            // Return first word if it's a country name
            const words = country.split(' ');
            return words[0].substring(0, 3).toUpperCase();
        }
    }
    return null;
}

/**
 * Extract incorporation date from text
 */
function extractIncorporationDate(text) {
    for (const pattern of COMPANY_EXTRACTION_PATTERNS.incorporationDate) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const dateStr = match[1];
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
    }
    return null;
}

/**
 * Format extracted data for credit report form
 */
function formatForCreditReportForm(extracted) {
    return {
        companyName: extracted.companyName,
        registrationNumber: extracted.registrationNumber,
        country: extracted.country,
        address: extracted.address,
        confidence: extracted.confidence.overall,
        extractedData: extracted
    };
}

module.exports = {
    extractCompanyInfoFromKYC,
    formatForCreditReportForm,
    extractTextFromDocument
};

