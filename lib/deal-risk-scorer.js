// Deal-Specific Risk Scorer
// Adjusts credit score based on deal structure, collateral, and payment terms

class DealRiskScorer {
    constructor() {
        // Collateral protection factors
        this.collateralFactors = {
            deposit: {
                '0': 1.0,      // No deposit = no protection
                '10': 0.85,    // 10% deposit = 15% risk reduction
                '20': 0.70,    // 20% deposit = 30% risk reduction
                '30': 0.55,    // 30% deposit = 45% risk reduction
                '40': 0.40,    // 40% deposit = 60% risk reduction
                '50': 0.25     // 50%+ deposit = 75% risk reduction
            },
            paymentTerms: {
                'cash_on_delivery': 0.90,      // COD = 10% risk reduction
                'payment_against_documents': 0.70,  // PAD = 30% risk reduction
                'document_control_with_auction': 0.50,  // Documents + auction = 50% risk reduction
                'open_account': 1.0,          // Open account = no protection
                'letter_of_credit': 0.60,      // LC = 40% risk reduction
                'bank_guarantee': 0.50         // Bank guarantee = 50% risk reduction
            },
            merchandiseCollateral: {
                'liquid': 0.70,        // Liquid goods (easily sold) = 30% risk reduction
                'tradable': 0.80,      // Tradable goods = 20% risk reduction
                'specialized': 0.95,   // Specialized goods = 5% risk reduction
                'perishable': 0.85,    // Perishable goods = 15% risk reduction
                'none': 1.0            // No merchandise collateral = no protection
            },
            auctionProtection: {
                'yes': 0.60,          // Auction available = 40% risk reduction
                'no': 1.0             // No auction = no protection
            }
        };
    }

    /**
     * Calculate Deal-Specific Risk Score
     * @param {Object} companyCreditScore - Base company credit score (0-100)
     * @param {Object} dealStructure - Deal structure and terms
     * @returns {Object} Deal-specific risk score and recommendations
     */
    calculateDealRiskScore(companyCreditScore, dealStructure) {
        const {
            depositPercentage = 0,
            paymentTerms = 'open_account',
            merchandiseCollateral = 'none',
            auctionAvailable = false,
            tradeValue = 0,
            tenor = 90,
            role = 'buyer'
        } = dealStructure;

        // Start with base company credit score
        let dealScore = companyCreditScore;

        // Calculate risk reduction factors
        const depositFactor = this.getDepositFactor(depositPercentage);
        const paymentFactor = this.collateralFactors.paymentTerms[paymentTerms] || 1.0;
        const merchandiseFactor = this.collateralFactors.merchandiseCollateral[merchandiseCollateral] || 1.0;
        const auctionFactor = this.collateralFactors.auctionProtection[auctionAvailable ? 'yes' : 'no'] || 1.0;

        // Calculate combined collateral protection
        const collateralProtection = depositFactor * paymentFactor * merchandiseFactor * auctionFactor;

        // Apply risk reduction to score
        // Higher company score = less room for improvement
        // Lower company score = more room for improvement with collateral
        const riskReduction = (100 - dealScore) * (1 - collateralProtection);
        dealScore = Math.min(100, dealScore + riskReduction);

        // Adjust for trade-specific factors
        dealScore = this.adjustForTradeFactors(dealScore, { tradeValue, tenor, role });

        // Ensure score is 0-100
        dealScore = Math.max(0, Math.min(100, dealScore));

        // Calculate risk reduction percentage
        const riskReductionPercent = ((dealScore - companyCreditScore) / (100 - companyCreditScore)) * 100;

        // Generate recommendations
        const recommendations = this.generateRecommendations({
            companyCreditScore,
            dealScore,
            depositPercentage,
            paymentTerms,
            merchandiseCollateral,
            auctionAvailable,
            tradeValue,
            tenor,
            riskReductionPercent
        });

        // Determine risk band
        const riskBand = this.determineRiskBand(dealScore);

        return {
            companyCreditScore: Math.round(companyCreditScore),
            dealCreditScore: Math.round(dealScore),
            riskReduction: Math.round(riskReductionPercent),
            riskBand: riskBand,
            collateralProtection: {
                depositFactor: depositFactor,
                paymentFactor: paymentFactor,
                merchandiseFactor: merchandiseFactor,
                auctionFactor: auctionFactor,
                combinedProtection: collateralProtection
            },
            recommendations: recommendations,
            dealStructure: dealStructure,
            scoreImprovement: Math.round(dealScore - companyCreditScore)
        };
    }

    /**
     * Get Deposit Factor based on percentage
     */
    getDepositFactor(depositPercentage) {
        const deposit = Math.round(depositPercentage / 10) * 10; // Round to nearest 10
        return this.collateralFactors.deposit[deposit.toString()] || 
               this.collateralFactors.deposit[deposit >= 50 ? '50' : '0'];
    }

    /**
     * Adjust for trade-specific factors
     */
    adjustForTradeFactors(score, { tradeValue, tenor, role }) {
        // Large trades with good collateral = slight boost
        if (tradeValue > 1000000 && score > 60) {
            score += 2; // Small boost for large secured trades
        }

        // Short tenor with good collateral = slight boost
        if (tenor < 60 && score > 60) {
            score += 1;
        }

        // Supplier role with collateral = slight boost
        if (role === 'supplier' && score > 60) {
            score += 1;
        }

        return Math.min(100, score);
    }

    /**
     * Generate Recommendations based on deal structure
     */
    generateRecommendations({
        companyCreditScore,
        dealScore,
        depositPercentage,
        paymentTerms,
        merchandiseCollateral,
        auctionAvailable,
        tradeValue,
        tenor,
        riskReductionPercent
    }) {
        const recommendations = [];

        // Deal-specific recommendations
        if (dealScore > companyCreditScore + 10) {
            recommendations.push({
                type: 'positive',
                priority: 'HIGH',
                message: `Deal structure significantly reduces risk (${riskReductionPercent.toFixed(1)}% risk reduction). Collateral protection makes this deal acceptable despite lower company credit score.`,
                details: 'The combination of deposit, payment terms, and collateral protection minimizes the credit risk for this specific transaction.'
            });
        }

        // Deposit recommendations
        if (depositPercentage >= 30) {
            recommendations.push({
                type: 'positive',
                priority: 'MEDIUM',
                message: `${depositPercentage}% deposit provides strong collateral protection.`,
                details: 'The substantial deposit reduces exposure and provides immediate cash flow protection.'
            });
        } else if (depositPercentage < 30 && companyCreditScore < 70) {
            recommendations.push({
                type: 'suggestion',
                priority: 'MEDIUM',
                message: `Consider increasing deposit to 30%+ to improve deal risk score (currently ${depositPercentage}%).`,
                details: 'A higher deposit would provide better collateral protection and reduce overall risk.'
            });
        }

        // Payment terms recommendations
        if (paymentTerms === 'payment_against_documents' && auctionAvailable) {
            recommendations.push({
                type: 'positive',
                priority: 'HIGH',
                message: 'Payment against documents with auction protection provides excellent risk mitigation.',
                details: 'Documents can be sold at auction if payment is not received, providing strong collateral protection.'
            });
        } else if (paymentTerms === 'open_account' && companyCreditScore < 70) {
            recommendations.push({
                type: 'warning',
                priority: 'HIGH',
                message: 'Open account payment terms increase risk. Consider payment against documents or letter of credit.',
                details: 'Payment against documents would provide better protection and improve deal risk score.'
            });
        }

        // Merchandise collateral recommendations
        if (merchandiseCollateral === 'liquid' || merchandiseCollateral === 'tradable') {
            recommendations.push({
                type: 'positive',
                priority: 'MEDIUM',
                message: 'Liquid/tradable merchandise provides good collateral protection.',
                details: 'Easily sellable merchandise can be liquidated quickly if needed, reducing risk.'
            });
        }

        // Auction recommendations
        if (auctionAvailable) {
            recommendations.push({
                type: 'positive',
                priority: 'HIGH',
                message: 'Auction protection available provides strong risk mitigation.',
                details: 'Ability to sell documents/goods at auction provides excellent collateral protection.'
            });
        } else if (companyCreditScore < 70) {
            recommendations.push({
                type: 'suggestion',
                priority: 'MEDIUM',
                message: 'Consider adding auction protection to improve deal risk score.',
                details: 'Auction protection would allow documents/goods to be sold if payment is not received, reducing risk.'
            });
        }

        // Deal-specific risk assessment
        if (dealScore >= 80) {
            recommendations.push({
                type: 'positive',
                priority: 'HIGH',
                message: 'Deal risk score is EXCELLENT. Transaction is highly recommended.',
                details: 'The combination of company credit score and deal structure creates a very low-risk transaction.'
            });
        } else if (dealScore >= 70) {
            recommendations.push({
                type: 'positive',
                priority: 'MEDIUM',
                message: 'Deal risk score is GOOD. Transaction is recommended with standard terms.',
                details: 'The deal structure provides acceptable risk mitigation.'
            });
        } else if (dealScore >= 60) {
            recommendations.push({
                type: 'caution',
                priority: 'MEDIUM',
                message: 'Deal risk score is FAIR. Transaction may proceed with enhanced monitoring.',
                details: 'Consider additional safeguards or monitoring for this transaction.'
            });
        } else {
            recommendations.push({
                type: 'warning',
                priority: 'HIGH',
                message: 'Deal risk score is LOW. Transaction requires enhanced protection or reconsideration.',
                details: 'Consider increasing deposit, improving payment terms, or adding additional collateral protection.'
            });
        }

        return recommendations;
    }

    /**
     * Determine Risk Band based on score
     */
    determineRiskBand(score) {
        if (score >= 80) return 'A';
        if (score >= 70) return 'B';
        if (score >= 60) return 'C';
        if (score >= 50) return 'D';
        return 'E';
    }

    /**
     * Calculate Collateral Protection Score
     * Returns a 0-100 score representing how well the deal is protected
     */
    calculateCollateralProtectionScore(dealStructure) {
        const {
            depositPercentage = 0,
            paymentTerms = 'open_account',
            merchandiseCollateral = 'none',
            auctionAvailable = false
        } = dealStructure;

        const depositFactor = this.getDepositFactor(depositPercentage);
        const paymentFactor = this.collateralFactors.paymentTerms[paymentTerms] || 1.0;
        const merchandiseFactor = this.collateralFactors.merchandiseCollateral[merchandiseCollateral] || 1.0;
        const auctionFactor = this.collateralFactors.auctionProtection[auctionAvailable ? 'yes' : 'no'] || 1.0;

        // Calculate protection score (inverse of risk)
        const protectionScore = (1 - ((depositFactor * paymentFactor * merchandiseFactor * auctionFactor) / 4)) * 100;

        return Math.round(protectionScore);
    }
}

module.exports = DealRiskScorer;

