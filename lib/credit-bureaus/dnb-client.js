// Dun & Bradstreet Credit Bureau Integration
// Requires API credentials from D&B

const axios = require('axios');

class DNBClient {
    constructor() {
        this.apiKey = process.env.DNB_API_KEY || null;
        this.apiSecret = process.env.DNB_API_SECRET || null;
        this.baseUrl = process.env.DNB_BASE_URL || 'https://direct.dnb.com';
        this.enabled = !!(this.apiKey && this.apiSecret);
    }

    /**
     * Get Business Credit Score
     * @param {Object} companyData - Company information
     * @returns {Promise<Object>} Credit score and details
     */
    async getBusinessCreditScore(companyData) {
        if (!this.enabled) {
            console.warn('[DNB] API credentials not configured, returning mock data');
            return this.getMockCreditScore(companyData);
        }

        try {
            const response = await axios.post(
                `${this.baseUrl}/V4.0/credit/reports/score`,
                {
                    companyName: companyData.companyName || companyData.name,
                    country: companyData.country,
                    registrationNumber: companyData.registrationNumber,
                    industry: companyData.industry || companyData.sector
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        'X-DNB-API-Secret': this.apiSecret
                    },
                    timeout: 10000
                }
            );

            return {
                score: response.data.creditScore || response.data.score,
                rating: response.data.rating,
                riskLevel: response.data.riskLevel,
                details: response.data,
                source: 'Dun & Bradstreet',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[DNB] Error fetching credit score:', error.message);
            // Fallback to mock data on error
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
                `${this.baseUrl}/V4.0/credit/reports/full`,
                {
                    companyName: companyData.companyName || companyData.name,
                    country: companyData.country,
                    registrationNumber: companyData.registrationNumber
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        'X-DNB-API-Secret': this.apiSecret
                    },
                    timeout: 15000
                }
            );

            return {
                creditScore: response.data.creditScore,
                paymentHistory: response.data.paymentHistory,
                financialStatements: response.data.financialStatements,
                riskFactors: response.data.riskFactors,
                recommendations: response.data.recommendations,
                source: 'Dun & Bradstreet',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[DNB] Error fetching credit report:', error.message);
            return this.getMockReport(companyData);
        }
    }

    /**
     * Get Payment History
     * @param {Object} companyData - Company information
     * @returns {Promise<Object>} Payment history data
     */
    async getPaymentHistory(companyData) {
        if (!this.enabled) {
            return this.getMockPaymentHistory(companyData);
        }

        try {
            const response = await axios.get(
                `${this.baseUrl}/V4.0/payment/history`,
                {
                    params: {
                        companyName: companyData.companyName || companyData.name,
                        country: companyData.country
                    },
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'X-DNB-API-Secret': this.apiSecret
                    },
                    timeout: 10000
                }
            );

            return {
                paymentScore: response.data.paymentScore,
                averageDaysToPay: response.data.averageDaysToPay,
                paymentTrends: response.data.paymentTrends,
                latePayments: response.data.latePayments,
                source: 'Dun & Bradstreet',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[DNB] Error fetching payment history:', error.message);
            return this.getMockPaymentHistory(companyData);
        }
    }

    /**
     * Mock Credit Score (fallback when API not configured)
     */
    getMockCreditScore(companyData) {
        // Generate realistic mock score based on company data
        const baseScore = 65;
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
            details: {
                note: 'Mock D&B data - API credentials required for real data'
            },
            source: 'Dun & Bradstreet (Mock)',
            timestamp: new Date().toISOString()
        };
    }

    getMockReport(companyData) {
        return {
            creditScore: this.getMockCreditScore(companyData).score,
            paymentHistory: {
                averageDaysToPay: 45,
                onTimePayments: 0.85,
                latePayments: 0.15
            },
            financialStatements: null, // Would need real API
            riskFactors: [],
            recommendations: [],
            source: 'Dun & Bradstreet (Mock)',
            timestamp: new Date().toISOString()
        };
    }

    getMockPaymentHistory(companyData) {
        return {
            paymentScore: 75,
            averageDaysToPay: 45,
            paymentTrends: 'STABLE',
            latePayments: 0.15,
            source: 'Dun & Bradstreet (Mock)',
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = DNBClient;







