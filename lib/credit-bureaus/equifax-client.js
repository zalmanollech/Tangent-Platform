// Equifax Business Credit Bureau Integration
// Requires API credentials from Equifax

const axios = require('axios');

class EquifaxClient {
    constructor() {
        this.apiKey = process.env.EQUIFAX_API_KEY || null;
        this.apiSecret = process.env.EQUIFAX_API_SECRET || null;
        this.baseUrl = process.env.EQUIFAX_BASE_URL || 'https://api.equifax.com/business/v1';
        this.enabled = !!(this.apiKey && this.apiSecret);
    }

    /**
     * Get Business Credit Score
     * @param {Object} companyData - Company information
     * @returns {Promise<Object>} Credit score and details
     */
    async getBusinessCreditScore(companyData) {
        if (!this.enabled) {
            console.warn('[EQUIFAX] API credentials not configured, returning mock data');
            return this.getMockCreditScore(companyData);
        }

        try {
            const response = await axios.post(
                `${this.baseUrl}/credit-score`,
                {
                    businessName: companyData.companyName || companyData.name,
                    country: companyData.country,
                    registrationNumber: companyData.registrationNumber,
                    industry: companyData.industry || companyData.sector
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        'X-API-Secret': this.apiSecret
                    },
                    timeout: 10000
                }
            );

            return {
                score: response.data.creditScore || response.data.score,
                rating: response.data.creditRating,
                riskLevel: response.data.riskLevel,
                bankruptcyRisk: response.data.bankruptcyRisk,
                details: response.data,
                source: 'Equifax',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[EQUIFAX] Error fetching credit score:', error.message);
            return this.getMockCreditScore(companyData);
        }
    }

    /**
     * Get Business Credit Report
     * @param {Object} companyData - Company information
     * @returns {Promise<Object>} Full credit report
     */
    async getBusinessCreditReport(companyData) {
        if (!this.enabled) {
            return this.getMockReport(companyData);
        }

        try {
            const response = await axios.post(
                `${this.baseUrl}/credit-report`,
                {
                    businessName: companyData.companyName || companyData.name,
                    country: companyData.country,
                    registrationNumber: companyData.registrationNumber
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        'X-API-Secret': this.apiSecret
                    },
                    timeout: 15000
                }
            );

            return {
                creditScore: response.data.creditScore,
                creditRating: response.data.creditRating,
                paymentHistory: response.data.paymentHistory,
                bankruptcyHistory: response.data.bankruptcyHistory,
                liens: response.data.liens,
                judgments: response.data.judgments,
                source: 'Equifax',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[EQUIFAX] Error fetching credit report:', error.message);
            return this.getMockReport(companyData);
        }
    }

    /**
     * Check Bankruptcy History
     * @param {Object} companyData - Company information
     * @returns {Promise<Object>} Bankruptcy records
     */
    async checkBankruptcyHistory(companyData) {
        if (!this.enabled) {
            return this.getMockBankruptcyHistory(companyData);
        }

        try {
            const response = await axios.get(
                `${this.baseUrl}/bankruptcy-check`,
                {
                    params: {
                        businessName: companyData.companyName || companyData.name,
                        country: companyData.country
                    },
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'X-API-Secret': this.apiSecret
                    },
                    timeout: 10000
                }
            );

            return {
                hasBankruptcy: response.data.hasBankruptcy,
                bankruptcyRecords: response.data.bankruptcyRecords,
                riskLevel: response.data.riskLevel,
                source: 'Equifax',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[EQUIFAX] Error checking bankruptcy history:', error.message);
            return this.getMockBankruptcyHistory(companyData);
        }
    }

    /**
     * Mock Credit Score (fallback when API not configured)
     */
    getMockCreditScore(companyData) {
        const baseScore = 68;
        const country = (companyData.country || 'USA').toUpperCase();
        const countryAdjustment = {
            'USA': 5, 'GBR': 3, 'DEU': 4, 'CAN': 4, 'AUS': 3,
            'CHN': -5, 'IND': -3, 'BRA': -4, 'RUS': -8, 'DEFAULT': -2
        };
        
        const score = baseScore + (countryAdjustment[country] || countryAdjustment['DEFAULT']);
        
        return {
            score: Math.max(0, Math.min(100, score)),
            rating: score >= 80 ? 'EXCELLENT' : score >= 65 ? 'GOOD' : score >= 50 ? 'FAIR' : 'POOR',
            riskLevel: score >= 80 ? 'LOW' : score >= 65 ? 'MEDIUM' : 'HIGH',
            bankruptcyRisk: score >= 80 ? 'LOW' : score >= 65 ? 'MEDIUM' : 'HIGH',
            details: {
                note: 'Mock Equifax data - API credentials required for real data'
            },
            source: 'Equifax (Mock)',
            timestamp: new Date().toISOString()
        };
    }

    getMockReport(companyData) {
        return {
            creditScore: this.getMockCreditScore(companyData).score,
            creditRating: 'GOOD',
            paymentHistory: {
                onTimePayments: 0.90,
                latePayments: 0.10,
                averageDaysToPay: 40
            },
            bankruptcyHistory: {
                hasBankruptcy: false,
                records: []
            },
            liens: [],
            judgments: [],
            source: 'Equifax (Mock)',
            timestamp: new Date().toISOString()
        };
    }

    getMockBankruptcyHistory(companyData) {
        return {
            hasBankruptcy: false,
            bankruptcyRecords: [],
            riskLevel: 'LOW',
            source: 'Equifax (Mock)',
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = EquifaxClient;







