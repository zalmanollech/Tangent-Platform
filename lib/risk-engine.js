// Risk Engine Module - STEP 3: Real Risk Calculation
// This module provides risk calculation and storage functionality.
// In STEP 3, risk evaluation computes real risk scores based on contract characteristics.

/**
 * Compute risk metrics for a contract
 * 
 * STEP 3: Real risk calculation implementation
 * 
 * This function analyzes contract fields and computes:
 * - Risk score (1-10, where 1 is lowest risk, 10 is highest)
 * - Risk band (VERY_LOW, LOW, MEDIUM, HIGH, VERY_HIGH)
 * - Maximum financing percentage (0-100)
 * - Required deposit percentage (0-100)
 * 
 * Risk factors considered:
 * - Product type (volatility)
 * - Contract value (size)
 * - Origin/destination countries (if available)
 * - Voyage time (if available)
 * 
 * @param {Object} contract - The contract object to analyze
 * @returns {Object} Risk metrics object with:
 *   - riskScore: number (1-10 scale)
 *   - riskBand: string (VERY_LOW | LOW | MEDIUM | HIGH | VERY_HIGH)
 *   - maxFinancingPercent: number (0-100)
 *   - requiredDepositPercent: number (0-100)
 */
function computeRiskForContract(contract) {
    // Defensive: always return a valid object, never throw
    if (!contract) {
        // Default to MEDIUM risk if contract is missing
        return {
            riskScore: 5,
            riskBand: 'MEDIUM',
            maxFinancingPercent: 70.0,
            requiredDepositPercent: 25.0,
        };
    }
    
    // Start with base MEDIUM risk score
    let score = 5;
    
    // 1) Product-based adjustment
    // Analyze product name to determine volatility risk
    const productName = (contract.product || contract.productDetails || '').toString().toLowerCase();
    
    if (productName) {
        // High volatility products (price swings, supply chain risks)
        const highVolatilityProducts = ['cocoa', 'coffee', 'sugar', 'palm oil', 'rubber'];
        // Low volatility products (stable, established markets)
        const lowVolatilityProducts = ['wheat', 'corn', 'soybeans', 'rice', 'barley'];
        // Very high risk products (specialized, niche, or regulated)
        const veryHighRiskProducts = ['crude oil', 'petroleum', 'natural gas', 'lng', 'wti', 'brent'];
        
        if (veryHighRiskProducts.some(p => productName.includes(p))) {
            score += 2; // Significant risk increase
        } else if (highVolatilityProducts.some(p => productName.includes(p))) {
            score += 1; // Moderate risk increase
        } else if (lowVolatilityProducts.some(p => productName.includes(p))) {
            score -= 1; // Risk reduction
        }
    }
    
    // 2) Contract value-based adjustment
    // Larger contracts carry more exposure risk
    let totalValue = null;
    
    // Try multiple field names for total value
    if (contract.totalValue !== undefined && contract.totalValue !== null) {
        totalValue = Number(contract.totalValue);
    } else {
        // Calculate from quantity and price if available
        const quantity = Number(contract.quantity ?? contract.qty ?? 0);
        const price = Number(contract.pricePerUnit ?? contract.price ?? contract.pricePerUnit ?? 0);
        
        if (!Number.isNaN(quantity) && !Number.isNaN(price) && quantity > 0 && price > 0) {
            totalValue = quantity * price;
        }
    }
    
    if (totalValue !== null && !Number.isNaN(totalValue) && totalValue > 0) {
        // Value thresholds (can be refined or made configurable)
        if (totalValue > 5_000_000) {
            // Very large trade - higher exposure
            score += 2;
        } else if (totalValue > 1_000_000) {
            // Large trade - moderate exposure
            score += 1;
        } else if (totalValue < 200_000) {
            // Small trade - lower exposure risk
            score -= 1;
        }
    }
    
    // 3) Voyage time adjustment (longer voyages = higher risk)
    const voyageTime = Number(contract.voyageTime ?? contract.voyage_time ?? 0);
    if (!Number.isNaN(voyageTime) && voyageTime > 0) {
        if (voyageTime > 90) {
            // Very long voyage - higher risk
            score += 1;
        } else if (voyageTime < 30) {
            // Short voyage - lower risk
            score -= 0.5;
        }
    }
    
    // 4) Country/Route risk (if origin/destination available)
    // Try to extract country codes from origin/destination fields
    const origin = (contract.origin || '').toString().toUpperCase();
    const destination = (contract.destination || '').toString().toUpperCase();
    
    // Higher risk countries (emerging markets, political instability, etc.)
    const higherRiskCountries = ['NG', 'AO', 'CD', 'ZW', 'VE', 'IR', 'KP'];
    // Lower risk countries (developed markets, stable)
    const lowerRiskCountries = ['US', 'CA', 'DE', 'NL', 'GB', 'FR', 'AU', 'NZ', 'JP', 'SG'];
    
    // Try to match country codes in origin/destination
    if (origin) {
        for (const countryCode of higherRiskCountries) {
            if (origin.includes(countryCode) || origin.includes(countryCode.toLowerCase())) {
                score += 0.5;
                break;
            }
        }
        for (const countryCode of lowerRiskCountries) {
            if (origin.includes(countryCode) || origin.includes(countryCode.toLowerCase())) {
                score -= 0.5;
                break;
            }
        }
    }
    
    if (destination) {
        for (const countryCode of higherRiskCountries) {
            if (destination.includes(countryCode) || destination.includes(countryCode.toLowerCase())) {
                score += 0.5;
                break;
            }
        }
        for (const countryCode of lowerRiskCountries) {
            if (destination.includes(countryCode) || destination.includes(countryCode.toLowerCase())) {
                score -= 0.5;
                break;
            }
        }
    }
    
    // 5) Insurance / credit enhancement (if available)
    // Check for any insurance-related flags
    const hasInsurance =
        contract.hasInsurance === true ||
        contract.insuranceRequired === true ||
        contract.insuranceApproved === true ||
        contract.insurance === true ||
        false;
    
    if (hasInsurance) {
        score -= 1; // Reduce risk due to insurance coverage
    }
    
    // 6) Clamp score between 1 and 10, round to integer
    if (Number.isNaN(score)) {
        score = 5; // Fallback to MEDIUM if calculation failed
    }
    score = Math.min(10, Math.max(1, Math.round(score)));
    
    // 7) Map score → riskBand
    let riskBand;
    if (score <= 2) {
        riskBand = 'VERY_LOW';
    } else if (score <= 4) {
        riskBand = 'LOW';
    } else if (score <= 6) {
        riskBand = 'MEDIUM';
    } else if (score <= 8) {
        riskBand = 'HIGH';
    } else {
        riskBand = 'VERY_HIGH';
    }
    
    // 8) Map score → maxFinancingPercent & requiredDepositPercent
    let maxFinancingPercent;
    let requiredDepositPercent;
    
    if (score <= 2) {
        // VERY_LOW risk: high financing, low deposit
        maxFinancingPercent = 90.0;
        requiredDepositPercent = 5.0;
    } else if (score <= 4) {
        // LOW risk: good financing, moderate deposit
        maxFinancingPercent = 80.0;
        requiredDepositPercent = 15.0;
    } else if (score <= 6) {
        // MEDIUM risk: standard financing, standard deposit
        maxFinancingPercent = 70.0;
        requiredDepositPercent = 25.0;
    } else if (score <= 8) {
        // HIGH risk: reduced financing, higher deposit
        maxFinancingPercent = 50.0;
        requiredDepositPercent = 40.0;
    } else {
        // VERY_HIGH risk: minimal financing, high deposit
        maxFinancingPercent = 30.0;
        requiredDepositPercent = 60.0;
    }
    
    return {
        riskScore: score,
        riskBand,
        maxFinancingPercent,
        requiredDepositPercent,
    };
}

/**
 * Get risk band label for a given risk score
 * 
 * STEP 3: Helper function to map score to risk band
 * 
 * @param {number} riskScore - Risk score (1-10)
 * @returns {string} Risk band label (VERY_LOW | LOW | MEDIUM | HIGH | VERY_HIGH)
 */
function getRiskBand(riskScore) {
    if (typeof riskScore !== 'number' || Number.isNaN(riskScore)) {
        return 'MEDIUM';
    }
    
    if (riskScore <= 2) {
        return 'VERY_LOW';
    } else if (riskScore <= 4) {
        return 'LOW';
    } else if (riskScore <= 6) {
        return 'MEDIUM';
    } else if (riskScore <= 8) {
        return 'HIGH';
    } else {
        return 'VERY_HIGH';
    }
}

/**
 * Calculate maximum financing percentage based on risk
 * 
 * STEP 3: Helper function to map score to financing percentage
 * 
 * @param {number} riskScore - Risk score (1-10)
 * @returns {number} Maximum financing percentage (0-100)
 */
function calculateMaxFinancingPercent(riskScore) {
    if (typeof riskScore !== 'number' || Number.isNaN(riskScore)) {
        return 70.0; // Default MEDIUM
    }
    
    if (riskScore <= 2) {
        return 90.0;
    } else if (riskScore <= 4) {
        return 80.0;
    } else if (riskScore <= 6) {
        return 70.0;
    } else if (riskScore <= 8) {
        return 50.0;
    } else {
        return 30.0;
    }
}

/**
 * Calculate required deposit percentage based on risk
 * 
 * STEP 3: Helper function to map score to deposit percentage
 * 
 * @param {number} riskScore - Risk score (1-10)
 * @returns {number} Required deposit percentage (0-100)
 */
function calculateRequiredDepositPercent(riskScore) {
    if (typeof riskScore !== 'number' || Number.isNaN(riskScore)) {
        return 25.0; // Default MEDIUM
    }
    
    if (riskScore <= 2) {
        return 5.0;
    } else if (riskScore <= 4) {
        return 15.0;
    } else if (riskScore <= 6) {
        return 25.0;
    } else if (riskScore <= 8) {
        return 40.0;
    } else {
        return 60.0;
    }
}

/**
 * Evaluate and store risk metrics for a contract
 * 
 * STEP 3: This function computes real risk scores and stores them in the database.
 * 
 * @param {string} contractId - The contract ID to evaluate
 * @param {Map} inMemoryContracts - In-memory contracts Map (from server database.contracts)
 * @returns {Promise<Object>} Risk metrics object
 */
async function evaluateAndStoreRiskForContract(contractId, inMemoryContracts = null) {
    const db = require('./database');
    
    // Load the contract from the database (in-memory or PostgreSQL)
    const contract = await db.contracts.getById(contractId, inMemoryContracts);
    
    if (!contract) {
        throw new Error(`Contract not found for risk evaluation: ${contractId}`);
    }
    
    // Compute risk using the real risk engine (STEP 3)
    const risk = computeRiskForContract(contract);
    
    // risk should be an object with:
    // { riskScore, riskBand, maxFinancingPercent, requiredDepositPercent }
    
    // Update only the 4 risk-related fields in the contract record
    // Reuse existing DB update mechanisms, do NOT change any other fields
    await db.contracts.updateRiskFields(contractId, {
        riskScore: risk.riskScore ?? null,
        riskBand: risk.riskBand ?? null,
        maxFinancingPercent: risk.maxFinancingPercent ?? null,
        requiredDepositPercent: risk.requiredDepositPercent ?? null,
    }, inMemoryContracts);
    
    // STEP 3: Debug logging (lightweight, no full contract details)
    console.log('[RISK ENGINE] Computed risk for contract', contractId, {
        riskScore: risk.riskScore,
        riskBand: risk.riskBand,
        maxFinancingPercent: risk.maxFinancingPercent,
        requiredDepositPercent: risk.requiredDepositPercent
    });
    
    return risk;
}

module.exports = {
    computeRiskForContract,
    getRiskBand,
    calculateMaxFinancingPercent,
    calculateRequiredDepositPercent,
    evaluateAndStoreRiskForContract,
};

