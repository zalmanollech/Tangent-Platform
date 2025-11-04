// Experian Business Credit Bureau Integration
// Requires API credentials from Experian

const axios = require('axios');

class ExperianClient {
    constructor() {
        this.apiKey = process.env.EXPERIAN_API_KEY || null;
        this.apiSecret = process.env.EXPERIAN_API_SECRET || null;
        this.baseUrl = process.env.EXPERIAN_BASE_URL || 'https://api.experian.com/businesscredit';
        this.enabled = !!(this.apiKey && this.apiSecret);
    }

    /**
     * Get Business Credit Score
     * @param {Object} companyData - Company information
     * @returns {Promise<Object>} Credit score and details
     */
    async getBusinessCreditScore(companyData) {
        if (!this.enabled) {
            console.warn('[EXPERIAN] API credentials not configured, returning mock data');
            return this.getMockCreditScore(companyData);
        }

        try {
            const response = await axios.post(
                `${this.baseUrl}/v1/credit-score`,
                {
                    businessName: companyData.companyName || companyData.name,
                    country: companyData.country,
                    businessRegistrationNumber: companyData.registrationNumber,
                    industryCode: this.getIndustryCode(companyData.industry || companyData.sector)
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
                industryBenchmark: response.data.industryBenchmark,
                details: response.data,
                source: 'Experian',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[EXPERIAN] Error fetching credit score:', error.message);
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
                `${this.baseUrl}/v1/credit-report`,
                {
                    businessName: companyData.companyName || companyData.name,
                    country: companyData.country,
                    businessRegistrationNumber: companyData.registrationNumber
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
                financialStatements: response.data.financialStatements,
                tradeReferences: response.data.tradeReferences,
                publicRecords: response.data.publicRecords,
                source: 'Experian',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[EXPERIAN] Error fetching credit report:', error.message);
            return this.getMockReport(companyData);
        }
    }

    /**
     * Get Financial Statement Analysis
     * @param {Object} companyData - Company information
     * @returns {Promise<Object>} Financial analysis
     */
    async getFinancialAnalysis(companyData) {
        if (!this.enabled) {
            return this.getMockFinancialAnalysis(companyData);
        }

        try {
            const response = await axios.get(
                `${this.baseUrl}/v1/financial-analysis`,
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
                currentRatio: response.data.currentRatio,
                debtToEquity: response.data.debtToEquity,
                profitMargin: response.data.profitMargin,
                revenueGrowth: response.data.revenueGrowth,
                financialHealth: response.data.financialHealth,
                source: 'Experian',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[EXPERIAN] Error fetching financial analysis:', error.message);
            return this.getMockFinancialAnalysis(companyData);
        }
    }

    /**
     * Map industry to Experian industry code
     */
    getIndustryCode(industry) {
        const industryMap = {
            'AGRICULTURE': '01',
            'MANUFACTURING': '20',
            'TECHNOLOGY': '51',
            'FINANCE': '52',
            'RETAIL': '44',
            'ENERGY': '21',
            'DEFAULT': '99'
        };
        
        const matched = Object.keys(industryMap).find(k => industry.toUpperCase().includes(k));
        return industryMap[matched] || industryMap['DEFAULT'];
    }

    /**
     * Mock Credit Score (fallback when API not configured)
     */
    getMockCreditScore(companyData) {
        const baseScore = 70;
        const country = (companyData.country || 'USA').toUpperCase();
        const countryAdjustment = {
            'USA': 5, 'GBR': 3, 'DEU': 4, 'CAN': 4, 'AUS': 3,
            'CHN': -5, 'IND': -3, 'BRA': -4, 'RUS': -8, 'DEFAULT': -2
        };
        
        const score = baseScore + (countryAdjustment[country] || countryAdjustment['DEFAULT']);
        
        return {
            score: Math.max(0, Math.min(100, score)),
            rating: score >= 80 ? 'A+' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D',
            riskLevel: score >= 80 ? 'LOW' : score >= 65 ? 'MEDIUM' : 'HIGH',
            industryBenchmark: score >= 80 ? 'ABOVE_AVERAGE' : score >= 65 ? 'AVERAGE' : 'BELOW_AVERAGE',
            details: {
                note: 'Mock Experian data - API credentials required for real data'
            },
            source: 'Experian (Mock)',
            timestamp: new Date().toISOString()
        };
    }

    getMockReport(companyData) {
        return {
            creditScore: this.getMockCreditScore(companyData).score,
            creditRating: 'B',
            paymentHistory: {
                onTimePayments: 0.88,
                latePayments: 0.12,
                averageDaysToPay: 42
            },
            financialStatements: null,
            tradeReferences: [],
            publicRecords: [],
            source: 'Experian (Mock)',
            timestamp: new Date().toISOString()
        };
    }

    getMockFinancialAnalysis(companyData) {
        return {
            currentRatio: 1.5,
            debtToEquity: 0.6,
            profitMargin: 0.08,
            revenueGrowth: 0.05,
            financialHealth: 'GOOD',
            source: 'Experian (Mock)',
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = ExperianClient;

