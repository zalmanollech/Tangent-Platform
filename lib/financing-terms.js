// Financing Terms Resolver
// Central helper to determine deposit and financing percentages for contracts
// Supports both legacy (fixed) and risk-based (dynamic) terms via feature flag

/**
 * Get effective financing terms for a contract
 * 
 * This function returns deposit and financing percentages based on:
 * - Feature flag USE_RISK_ENGINE_FOR_FINANCING (if false, uses legacy)
 * - Risk engine values (if flag is true and risk fields are available)
 * - Legacy defaults (fallback)
 * 
 * @param {Object} contract - The contract object
 * @param {boolean} useRiskEngine - Feature flag (default: false)
 * @returns {Object} Financing terms object with:
 *   - depositPercent: number (0-100)
 *   - maxFinancingPercent: number (0-100)
 *   - source: string ('legacy' | 'risk' | 'legacy-fallback')
 */
function getEffectiveFinancingTerms(contract, useRiskEngine = false) {
    // Legacy defaults (current production behavior)
    // These match the existing logic: 30% deposit, 70% max financing
    const legacyDepositPercent = 30.0;
    const legacyMaxFinancingPercent = 70.0;
    
    // If flag is OFF → always return legacy values
    if (!useRiskEngine) {
        return {
            depositPercent: legacyDepositPercent,
            maxFinancingPercent: legacyMaxFinancingPercent,
            source: 'legacy',
        };
    }
    
    // Flag is ON (for future use) → try to use risk-based values
    const riskDeposit = contract.requiredDepositPercent;
    const riskMaxFinancing = contract.maxFinancingPercent;
    
    if (
        typeof riskDeposit === 'number' &&
        !Number.isNaN(riskDeposit) &&
        riskDeposit >= 0 &&
        riskDeposit <= 100 &&
        typeof riskMaxFinancing === 'number' &&
        !Number.isNaN(riskMaxFinancing) &&
        riskMaxFinancing >= 0 &&
        riskMaxFinancing <= 100
    ) {
        return {
            depositPercent: riskDeposit,
            maxFinancingPercent: riskMaxFinancing,
            source: 'risk',
        };
    }
    
    // Fallback to legacy if risk fields are missing or invalid
    return {
        depositPercent: legacyDepositPercent,
        maxFinancingPercent: legacyMaxFinancingPercent,
        source: 'legacy-fallback',
    };
}

/**
 * Get legacy financing terms (fixed values, independent of feature flag)
 * 
 * Returns the standard legacy financing terms used in production:
 * - 30% deposit
 * - 70% max financing
 * 
 * @returns {Object} Legacy financing terms object with:
 *   - depositPercent: number (30.0)
 *   - maxFinancingPercent: number (70.0)
 *   - source: string ('legacy')
 */
function getLegacyFinancingTerms() {
    // Legacy defaults (current production behavior)
    // These match the existing logic: 30% deposit, 70% max financing
    const legacyDepositPercent = 30.0;
    const legacyMaxFinancingPercent = 70.0;
    
    return {
        depositPercent: legacyDepositPercent,
        maxFinancingPercent: legacyMaxFinancingPercent,
        source: 'legacy',
    };
}

/**
 * Get risk-based financing terms from contract (independent of feature flag)
 * 
 * Extracts risk-based financing terms from contract's stored risk fields.
 * Returns null values if risk fields are missing or invalid.
 * 
 * @param {Object} contract - The contract object with risk fields
 * @returns {Object} Risk-based financing terms object with:
 *   - depositPercent: number | null
 *   - maxFinancingPercent: number | null
 *   - source: string ('risk' | 'risk-missing')
 */
function getRiskBasedFinancingTermsFromContract(contract) {
    if (!contract) {
        return {
            depositPercent: null,
            maxFinancingPercent: null,
            source: 'risk-missing',
        };
    }
    
    const riskDeposit = typeof contract.requiredDepositPercent === 'number' &&
        !Number.isNaN(contract.requiredDepositPercent) &&
        contract.requiredDepositPercent >= 0 &&
        contract.requiredDepositPercent <= 100
        ? contract.requiredDepositPercent
        : null;
    
    const riskMaxFinancing = typeof contract.maxFinancingPercent === 'number' &&
        !Number.isNaN(contract.maxFinancingPercent) &&
        contract.maxFinancingPercent >= 0 &&
        contract.maxFinancingPercent <= 100
        ? contract.maxFinancingPercent
        : null;
    
    if (riskDeposit === null || riskMaxFinancing === null) {
        return {
            depositPercent: null,
            maxFinancingPercent: null,
            source: 'risk-missing',
        };
    }
    
    return {
        depositPercent: riskDeposit,
        maxFinancingPercent: riskMaxFinancing,
        source: 'risk',
    };
}

module.exports = {
    getEffectiveFinancingTerms,
    getLegacyFinancingTerms,
    getRiskBasedFinancingTermsFromContract,
};

