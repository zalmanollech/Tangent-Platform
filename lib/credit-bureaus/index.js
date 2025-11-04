// Credit Bureau Integration Hub
// Aggregates data from multiple credit bureaus

const DNBClient = require('./dnb-client');
const ExperianClient = require('./experian-client');
const EquifaxClient = require('./equifax-client');

class CreditBureauHub {
    constructor() {
        this.dnb = new DNBClient();
        this.experian = new ExperianClient();
        this.equifax = new EquifaxClient();
    }

    /**
     * Get Comprehensive Credit Score from All Bureaus
     * @param {Object} companyData - Company information
     * @returns {Promise<Object>} Aggregated credit scores
     */
    async getComprehensiveCreditScore(companyData) {
        console.log('[CREDIT_BUREAU_HUB] Fetching credit scores from all bureaus...');
        
        const results = await Promise.allSettled([
            this.dnb.getBusinessCreditScore(companyData),
            this.experian.getBusinessCreditScore(companyData),
            this.equifax.getBusinessCreditScore(companyData)
        ]);

        const scores = {
            dnb: results[0].status === 'fulfilled' ? results[0].value : null,
            experian: results[1].status === 'fulfilled' ? results[1].value : null,
            equifax: results[2].status === 'fulfilled' ? results[2].value : null
        };

        // Calculate weighted average score
        const validScores = Object.values(scores).filter(s => s && s.score !== undefined);
        const averageScore = validScores.length > 0
            ? validScores.reduce((sum, s) => sum + s.score, 0) / validScores.length
            : null;

        // Determine overall rating
        let overallRating = 'UNKNOWN';
        if (averageScore !== null) {
            if (averageScore >= 80) overallRating = 'EXCELLENT';
            else if (averageScore >= 65) overallRating = 'GOOD';
            else if (averageScore >= 50) overallRating = 'FAIR';
            else overallRating = 'POOR';
        }

        return {
            averageScore: averageScore ? Math.round(averageScore) : null,
            overallRating: overallRating,
            scores: scores,
            sources: {
                dnb: scores.dnb ? scores.dnb.source : 'Not available',
                experian: scores.experian ? scores.experian.source : 'Not available',
                equifax: scores.equifax ? scores.equifax.source : 'Not available'
            },
            reliability: this.calculateReliability(scores),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get Comprehensive Credit Report from All Bureaus
     * @param {Object} companyData - Company information
     * @returns {Promise<Object>} Aggregated credit reports
     */
    async getComprehensiveCreditReport(companyData) {
        console.log('[CREDIT_BUREAU_HUB] Fetching credit reports from all bureaus...');
        
        const results = await Promise.allSettled([
            this.dnb.getBusinessCreditReport(companyData),
            this.experian.getBusinessCreditReport(companyData),
            this.equifax.getBusinessCreditReport(companyData),
            this.experian.getFinancialAnalysis(companyData),
            this.equifax.checkBankruptcyHistory(companyData),
            this.dnb.getPaymentHistory(companyData)
        ]);

        return {
            dnbReport: results[0].status === 'fulfilled' ? results[0].value : null,
            experianReport: results[1].status === 'fulfilled' ? results[1].value : null,
            equifaxReport: results[2].status === 'fulfilled' ? results[2].value : null,
            financialAnalysis: results[3].status === 'fulfilled' ? results[3].value : null,
            bankruptcyHistory: results[4].status === 'fulfilled' ? results[4].value : null,
            paymentHistory: results[5].status === 'fulfilled' ? results[5].value : null,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Calculate Reliability Score
     * Based on number of available data sources
     */
    calculateReliability(scores) {
        const availableSources = Object.values(scores).filter(s => s && s.score !== undefined).length;
        
        if (availableSources === 3) return 'HIGH'; // All 3 bureaus available
        if (availableSources === 2) return 'MEDIUM'; // 2 bureaus available
        if (availableSources === 1) return 'LOW'; // 1 bureau available
        return 'VERY_LOW'; // No bureaus available
    }

    /**
     * Check which bureaus are configured
     */
    getConfiguredBureaus() {
        return {
            dnb: this.dnb.enabled,
            experian: this.experian.enabled,
            equifax: this.equifax.enabled
        };
    }
}

module.exports = CreditBureauHub;


