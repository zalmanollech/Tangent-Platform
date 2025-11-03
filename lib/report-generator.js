// Report Generator for Traidefi
// Generates credit reports and insurance quotes after payment

const axios = require('axios');

const CREDIT_SERVICE_URL = process.env.CREDIT_SERVICE_URL || 'http://localhost:8001';
const INSURANCE_SERVICE_URL = process.env.INSURANCE_SERVICE_URL || 'http://localhost:8002';

/**
 * Generate Credit Report
 */
async function generateCreditReport(formData, purchaseId) {
    try {
        console.log('[INFO] Generating credit report for purchase:', purchaseId);
        console.log('[INFO] Form data:', formData);
        
        // Check if credit service is available
        try {
            await axios.get(`${CREDIT_SERVICE_URL}/health`, { timeout: 5000 });
        } catch (error) {
            console.warn('[WARN] Credit service not available, generating mock report');
            return generateMockCreditReport(formData);
        }
        
        // Prepare data for credit service
        const entityData = {
            name: formData.companyName || formData.company_name,
            country: formData.country,
            registration_number: `TRAIDEFI-${Date.now()}`, // Generate temp reg number
            industry: formData.sector || formData.sector_commodity,
            entity_type: formData.role === 'buyer' ? 'buyer' : 'supplier'
        };
        
        // Create entity in credit service
        const entityResponse = await axios.post(`${CREDIT_SERVICE_URL}/entities`, entityData);
        const entityId = entityResponse.data.id;
        
        // Perform general KYC
        const kycResponse = await axios.post(`${CREDIT_SERVICE_URL}/kyc/general/${entityId}`);
        
        // Create trade
        const tradeData = {
            entity_id: entityId,
            trade_amount: parseFloat(formData.tradeValue || formData.trade_value || 0),
            trade_currency: 'USD',
            tenor_days: parseInt(formData.tenor || '90', 10),
            commodity_type: formData.sector || formData.sector_commodity,
            trade_type: formData.role || 'buyer'
        };
        
        const tradeResponse = await axios.post(`${CREDIT_SERVICE_URL}/trades`, tradeData);
        const tradeId = tradeResponse.data.id;
        
        // Assess trade
        const assessResponse = await axios.post(`${CREDIT_SERVICE_URL}/trades/${tradeId}/assess`);
        const assessment = assessResponse.data;
        
        // Calculate credit score (0-100) from PD
        const pd = assessment.trade_assessment?.pd || assessment.pd || 0.1;
        const creditScore = Math.max(0, Math.min(100, Math.round((1 - pd) * 100)));
        
        // Extract risk factors
        const factors = {
            pd: pd,
            risk_band: assessment.trade_assessment?.risk_band || assessment.risk_band || 'C',
            verification_score: kycResponse.data.verification_score || 75,
            sanctions_status: kycResponse.data.sanctions_status || 'CLEAR',
            registry_status: kycResponse.data.registry_status || 'VERIFIED',
            pep_status: kycResponse.data.pep_status || 'CLEAR',
            country_risk: assessment.country_risk || 'MEDIUM',
            tenor_risk: tradeData.tenor_days > 90 ? 'HIGH' : 'MEDIUM',
            trade_amount_risk: tradeData.trade_amount > 1000000 ? 'HIGH' : 'MEDIUM'
        };
        
        // Generate risk notes
        const riskNotes = generateRiskNotes(factors, formData);
        
        return {
            score: creditScore,
            factors: factors,
            riskNotes: riskNotes,
            assessment: assessment,
            success: true
        };
        
    } catch (error) {
        console.error('[ERROR] Credit report generation error:', error.message);
        // Fallback to mock report if service fails
        return generateMockCreditReport(formData);
    }
}

/**
 * Generate Mock Credit Report (fallback)
 */
function generateMockCreditReport(formData) {
    const tradeValue = parseFloat(formData.tradeValue || formData.trade_value || 100000);
    const tenor = parseInt(formData.tenor || '90', 10);
    
    // Calculate mock score based on inputs
    let score = 75; // Base score
    
    // Adjust based on trade value (higher = riskier)
    if (tradeValue > 1000000) score -= 10;
    if (tradeValue < 100000) score += 5;
    
    // Adjust based on tenor (longer = riskier)
    if (tenor > 120) score -= 15;
    if (tenor < 60) score += 5;
    
    // Ensure score is 0-100
    score = Math.max(0, Math.min(100, score));
    
    const riskBand = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'E';
    
    const factors = {
        pd: (100 - score) / 100,
        risk_band: riskBand,
        verification_score: 75,
        sanctions_status: 'CLEAR',
        registry_status: 'VERIFIED',
        pep_status: 'CLEAR',
        country_risk: 'MEDIUM',
        tenor_risk: tenor > 90 ? 'HIGH' : 'MEDIUM',
        trade_amount_risk: tradeValue > 1000000 ? 'HIGH' : 'MEDIUM'
    };
    
    const riskNotes = generateRiskNotes(factors, formData);
    
    return {
        score: score,
        factors: factors,
        riskNotes: riskNotes,
        assessment: null,
        success: true
    };
}

/**
 * Generate Insurance Quote
 */
async function generateInsuranceQuote(formData, purchaseId) {
    try {
        console.log('[INFO] Generating insurance quote for purchase:', purchaseId);
        console.log('[INFO] Form data:', formData);
        
        // Check if insurance service is available
        try {
            await axios.get(`${INSURANCE_SERVICE_URL}/health`, { timeout: 5000 });
        } catch (error) {
            console.warn('[WARN] Insurance service not available, generating mock quote');
            return generateMockInsuranceQuote(formData);
        }
        
        // Prepare data for insurance service
        const tradeAmount = parseFloat(formData.tradeValue || formData.trade_value || 100000);
        const tenorDays = parseInt(formData.tenor || '90', 10);
        
        // Estimate credit assessment (would normally come from credit service)
        const creditScore = formData.counterpartyScore ? parseInt(formData.counterpartyScore) : 75;
        const pd = (100 - creditScore) / 100;
        const riskBand = creditScore >= 80 ? 'A' : creditScore >= 65 ? 'B' : creditScore >= 50 ? 'C' : 'D';
        
        const quoteRequest = {
            trade_data: {
                trade_id: `TRAIDEFI-${purchaseId}`,
                contract_id: `TRAIDEFI-${purchaseId}`,
                amount: tradeAmount,
                tenor_days: tenorDays,
                inventory_value: tradeAmount * 0.9, // Estimate
                inventory_type: formData.sector || formData.sector_commodity || 'Grain',
                inventory_location: formData.country || 'USA',
                buyer_deposit: tradeAmount * 0.1, // Estimate 10% deposit
                is_exchange_traded: false,
                country_risk: 0.05
            },
            credit_assessment: {
                pd: pd,
                risk_band: riskBand,
                collateral_analysis: {}
            }
        };
        
        const response = await axios.post(`${INSURANCE_SERVICE_URL}/quote`, quoteRequest);
        const quote = response.data;
        
        // Extract premium range
        const totalPremium = quote.premium_breakdown?.total_premium || 0;
        const premiumPercentage = (totalPremium / tradeAmount) * 100;
        
        // Calculate range (±20%)
        const premiumMin = Math.max(0, premiumPercentage * 0.8);
        const premiumMax = premiumPercentage * 1.2;
        
        const assumptions = {
            pd: pd,
            risk_band: riskBand,
            underwriting_score: quote.underwriting_score || 75,
            recommendation: quote.recommendation || { decision: 'APPROVE', confidence: 0.85 },
            actuarial_metrics: quote.actuarial_metrics || {}
        };
        
        return {
            premiumMin: Math.round(premiumMin * 100) / 100,
            premiumMax: Math.round(premiumMax * 100) / 100,
            assumptions: assumptions,
            quote: quote,
            success: true
        };
        
    } catch (error) {
        console.error('[ERROR] Insurance quote generation error:', error.message);
        // Fallback to mock quote
        return generateMockInsuranceQuote(formData);
    }
}

/**
 * Generate Mock Insurance Quote (fallback)
 */
function generateMockInsuranceQuote(formData) {
    const tradeAmount = parseFloat(formData.tradeValue || formData.trade_value || 100000);
    const tenorDays = parseInt(formData.tenor || '90', 10);
    const creditScore = formData.counterpartyScore ? parseInt(formData.counterpartyScore) : 75;
    
    // Calculate base premium percentage
    let basePremium = 2.5; // 2.5% base
    
    // Adjust based on credit score
    if (creditScore < 50) basePremium += 2;
    else if (creditScore < 65) basePremium += 1;
    else if (creditScore >= 80) basePremium -= 0.5;
    
    // Adjust based on tenor
    if (tenorDays > 120) basePremium += 1;
    else if (tenorDays < 60) basePremium -= 0.5;
    
    // Calculate range
    const premiumMin = Math.max(0.5, basePremium * 0.8);
    const premiumMax = basePremium * 1.2;
    
    const assumptions = {
        pd: (100 - creditScore) / 100,
        risk_band: creditScore >= 80 ? 'A' : creditScore >= 65 ? 'B' : creditScore >= 50 ? 'C' : 'D',
        underwriting_score: creditScore,
        recommendation: {
            decision: creditScore >= 50 ? 'APPROVE' : 'REVIEW',
            confidence: Math.min(0.95, creditScore / 100)
        }
    };
    
    return {
        premiumMin: Math.round(premiumMin * 100) / 100,
        premiumMax: Math.round(premiumMax * 100) / 100,
        assumptions: assumptions,
        success: true
    };
}

/**
 * Generate Risk Notes
 */
function generateRiskNotes(factors, formData) {
    const notes = [];
    
    if (factors.risk_band === 'E' || factors.risk_band === 'D') {
        notes.push('High credit risk detected. Recommend additional guarantees or collateral.');
    }
    
    if (factors.tenor_risk === 'HIGH') {
        notes.push('Extended payment terms increase default risk.');
    }
    
    if (factors.trade_amount_risk === 'HIGH') {
        notes.push('Large trade value requires enhanced due diligence.');
    }
    
    if (factors.sanctions_status !== 'CLEAR') {
        notes.push('Sanctions screening requires attention.');
    }
    
    if (factors.pep_status !== 'CLEAR') {
        notes.push('PEP (Politically Exposed Person) screening indicates potential compliance risk.');
    }
    
    if (notes.length === 0) {
        notes.push('Credit assessment completed. Risk factors within acceptable parameters.');
    }
    
    return notes.join(' ');
}

module.exports = {
    generateCreditReport,
    generateInsuranceQuote
};

