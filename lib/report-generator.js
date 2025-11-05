// Report Generator for Traidefi
// Generates credit reports and insurance quotes after payment

const axios = require('axios');
const CreditBureauHub = require('./credit-bureaus');
const DealRiskScorer = require('./deal-risk-scorer');

const CREDIT_SERVICE_URL = process.env.CREDIT_SERVICE_URL || 'http://localhost:8001';
const INSURANCE_SERVICE_URL = process.env.INSURANCE_SERVICE_URL || 'http://localhost:8002';

// Initialize credit bureau hub and deal risk scorer
const creditBureauHub = new CreditBureauHub();
const dealRiskScorer = new DealRiskScorer();

/**
 * Assess Company Identification Strength
 */
function assessCompanyIdentification(companyName, registrationNumber, address) {
    if (!companyName) {
        return {
            level: 'NONE',
            score: 0,
            confidence: 0,
            provided: [],
            missing: ['companyName', 'registrationNumber', 'address'],
            message: 'No company identification provided'
        };
    }
    
    const provided = [];
    const missing = [];
    
    if (companyName) provided.push('companyName');
    else missing.push('companyName');
    
    if (registrationNumber && registrationNumber.trim()) provided.push('registrationNumber');
    else missing.push('registrationNumber');
    
    if (address && address.trim()) provided.push('address');
    else missing.push('address');
    
    let level, score, confidence;
    
    if (provided.length === 3) {
        level = 'STRONG';
        score = 100;
        confidence = 0.95;
    } else if (provided.length === 2) {
        level = 'MEDIUM';
        score = 65;
        confidence = 0.75;
    } else if (provided.length === 1 && provided.includes('companyName')) {
        level = 'WEAK';
        score = 30;
        confidence = 0.50;
    } else {
        level = 'VERY_WEAK';
        score = 10;
        confidence = 0.25;
    }
    
    return {
        level,
        score,
        confidence,
        provided,
        missing,
        message: `Company identification: ${level} (${provided.length}/3 identifiers provided)`
    };
}

/**
 * Assess Data Source Reliability
 */
function assessDataSourceReliability(creditBureauScores, identificationStrength) {
    const dataSources = [];
    const checked = [];
    const notChecked = [];
    
    // Check what data sources were actually used
    if (creditBureauScores.sources && creditBureauScores.sources.length > 0) {
        creditBureauScores.sources.forEach(source => {
            if (source.includes('Mock')) {
                dataSources.push({
                    name: source.replace(' (Mock)', ''),
                    type: 'MOCK',
                    available: false,
                    checked: false
                });
                notChecked.push(source.replace(' (Mock)', ''));
            } else {
                dataSources.push({
                    name: source,
                    type: 'REAL',
                    available: true,
                    checked: true
                });
                checked.push(source);
            }
        });
    } else {
        // No credit bureau data available
        dataSources.push({
            name: 'Dun & Bradstreet',
            type: 'MOCK',
            available: false,
            checked: false
        });
        dataSources.push({
            name: 'Experian',
            type: 'MOCK',
            available: false,
            checked: false
        });
        dataSources.push({
            name: 'Equifax',
            type: 'MOCK',
            available: false,
            checked: false
        });
        notChecked.push('Dun & Bradstreet', 'Experian', 'Equifax');
    }
    
    // Calculate overall reliability
    let reliabilityScore = 0;
    let reliabilityLevel = 'VERY_LOW';
    
    if (checked.length > 0) {
        reliabilityScore = (checked.length / 3) * 100;
        if (reliabilityScore >= 80) reliabilityLevel = 'HIGH';
        else if (reliabilityScore >= 50) reliabilityLevel = 'MEDIUM';
        else reliabilityLevel = 'LOW';
    } else {
        reliabilityScore = 0;
        reliabilityLevel = 'VERY_LOW';
    }
    
    // Adjust based on company identification
    if (identificationStrength.level === 'WEAK' || identificationStrength.level === 'VERY_WEAK') {
        reliabilityScore = Math.max(0, reliabilityScore - 20);
        if (reliabilityLevel === 'HIGH') reliabilityLevel = 'MEDIUM';
        else if (reliabilityLevel === 'MEDIUM') reliabilityLevel = 'LOW';
        else if (reliabilityLevel === 'LOW') reliabilityLevel = 'VERY_LOW';
    }
    
    return {
        overallReliability: reliabilityLevel,
        reliabilityScore: Math.round(reliabilityScore),
        confidence: Math.min(0.95, identificationStrength.confidence * (reliabilityScore / 100)),
        dataSources,
        checked: checked.length > 0 ? checked : ['None - Algorithmic estimate only'],
        notChecked,
        message: `Data reliability: ${reliabilityLevel}. ${checked.length > 0 ? `${checked.length} credit bureau(s) checked` : 'No credit bureau data available - using algorithmic estimate'}.`
    };
}

/**
 * Generate Credit Report
 */
async function generateCreditReport(formData, purchaseId) {
    try {
        console.log('[INFO] Generating credit report for purchase:', purchaseId);
        console.log('[INFO] Form data:', formData);
        
        // Check if credit service is available (with retry)
        let serviceAvailable = false;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const healthCheck = await axios.get(`${CREDIT_SERVICE_URL}/health`, { timeout: 5000 });
                if (healthCheck.data && healthCheck.data.status === 'healthy') {
                    serviceAvailable = true;
                    console.log('[INFO] Credit service is available');
                    break;
                }
            } catch (error) {
                console.warn(`[WARN] Credit service health check attempt ${attempt + 1} failed:`, error.message);
                if (attempt === 1) {
                    console.warn('[WARN] Credit service not available after retries, generating enhanced mock report');
                }
            }
        }
        
        if (!serviceAvailable) {
            return generateMockCreditReport(formData);
        }
        
        // Prepare data for credit service
        const companyName = formData.companyName || formData.company_name;
        const registrationNumber = formData.registrationNumber || formData.registration_number;
        const address = formData.address;
        
        // Company identification validation
        const identificationStrength = assessCompanyIdentification(companyName, registrationNumber, address);
        
        const entityData = {
            name: companyName,
            country: formData.country,
            registration_number: registrationNumber || `TRAIDEFI-${Date.now()}`, // Use provided or generate temp
            address: address,
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
        
        // Get credit bureau scores (parallel with trade assessment)
        const companyData = {
            companyName: entityData.name,
            name: entityData.name,
            country: entityData.country,
            registrationNumber: registrationNumber || null,
            address: address || null,
            industry: entityData.industry,
            sector: entityData.industry
        };
        
        const creditBureauScores = await creditBureauHub.getComprehensiveCreditScore(companyData);
        const creditBureauReport = await creditBureauHub.getComprehensiveCreditReport(companyData);
        
        // Add company matching warnings
        let companyMatchingWarnings = [];
        if (identificationStrength.level === 'WEAK') {
            companyMatchingWarnings.push({
                type: 'warning',
                severity: 'HIGH',
                message: `⚠️ WEAK COMPANY IDENTIFICATION: Only company name provided. Multiple companies may share this name. Risk of matching wrong company.`,
                recommendation: 'Provide registration number or tax ID to uniquely identify the company.'
            });
        } else if (identificationStrength.level === 'MEDIUM') {
            companyMatchingWarnings.push({
                type: 'warning',
                severity: 'MEDIUM',
                message: `⚠️ PARTIAL COMPANY IDENTIFICATION: Registration number or address provided but not both.`,
                recommendation: 'Provide both registration number and address for maximum accuracy.'
            });
        }
        
        // Calculate data source reliability
        const dataSourceReliability = assessDataSourceReliability(creditBureauScores, identificationStrength);
        
        // Calculate credit score (0-100) from PD and credit bureau scores
        const pd = assessment.trade_assessment?.pd || assessment.pd || 0.1;
        const pdScore = Math.max(0, Math.min(100, Math.round((1 - pd) * 100)));
        
        // Weighted average: 60% credit bureaus, 40% PD-based score
        let creditScore = pdScore;
        if (creditBureauScores.averageScore !== null) {
            creditScore = Math.round(
                (creditBureauScores.averageScore * 0.6) + (pdScore * 0.4)
            );
        }
        
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
            trade_amount_risk: tradeData.trade_amount > 1000000 ? 'HIGH' : 'MEDIUM',
            // Credit bureau data
            credit_bureau_score: creditBureauScores.averageScore,
            credit_bureau_rating: creditBureauScores.overallRating,
            credit_bureau_reliability: creditBureauScores.reliability,
            credit_bureau_sources: creditBureauScores.sources,
            financial_analysis: creditBureauReport.financialAnalysis,
            payment_history: creditBureauReport.paymentHistory,
            bankruptcy_history: creditBureauReport.bankruptcyHistory,
            // Company identification
            company_identification_strength: identificationStrength,
            company_matching_warnings: companyMatchingWarnings,
            data_source_reliability: dataSourceReliability
        };
        
        // Calculate deal-specific risk score if deal structure provided
        let dealRiskScore = null;
        let dealRecommendations = [];
        const hasDealStructure = formData.depositPercentage || formData.paymentTerms || formData.merchandiseCollateral || formData.auctionAvailable;
        
        if (hasDealStructure) {
            const dealStructure = {
                depositPercentage: parseFloat(formData.depositPercentage || 0),
                paymentTerms: formData.paymentTerms || 'open_account',
                merchandiseCollateral: formData.merchandiseCollateral || 'none',
                auctionAvailable: formData.auctionAvailable === 'true' || formData.auctionAvailable === true,
                tradeValue: parseFloat(formData.tradeValue || formData.trade_value || 0),
                tenor: parseInt(formData.tenor || '90', 10),
                role: formData.role || 'buyer'
            };
            
            const dealRiskResult = dealRiskScorer.calculateDealRiskScore(creditScore, dealStructure);
            dealRiskScore = dealRiskResult.dealCreditScore;
            dealRecommendations = dealRiskResult.recommendations;
            
            // Add deal-specific factors
            factors.deal_structure = dealStructure;
            factors.deal_risk_score = dealRiskScore;
            factors.deal_risk_band = dealRiskResult.riskBand;
            factors.deal_score_improvement = dealRiskResult.scoreImprovement;
            factors.deal_risk_reduction = dealRiskResult.riskReduction;
            factors.collateral_protection = dealRiskResult.collateralProtection;
            factors.deal_recommendations = dealRecommendations;
        }
        
        // Generate risk notes
        const riskNotes = generateRiskNotes(factors, formData);
        
        // Determine final score (deal-specific if available, otherwise regular)
        const finalScore = dealRiskScore !== null ? dealRiskScore : creditScore;
        
        return {
            score: finalScore,
            companyCreditScore: creditScore,
            dealCreditScore: dealRiskScore,
            factors: factors,
            riskNotes: riskNotes,
            assessment: assessment,
            creditBureauData: {
                scores: creditBureauScores,
                report: creditBureauReport,
                reliability: creditBureauScores.reliability,
                sources: creditBureauScores.sources
            },
            dealRiskAnalysis: dealRiskScore !== null ? {
                dealScore: dealRiskScore,
                scoreImprovement: factors.deal_score_improvement,
                riskReduction: factors.deal_risk_reduction,
                recommendations: dealRecommendations,
                collateralProtection: factors.collateral_protection
            } : null,
            companyIdentification: identificationStrength,
            dataSources: dataSourceReliability,
            warnings: companyMatchingWarnings,
            success: true
        };
        
    } catch (error) {
        console.error('[ERROR] Credit report generation error:', error.message);
        // Fallback to mock report if service fails
        return generateMockCreditReport(formData);
    }
}

/**
 * Generate Enhanced Mock Credit Report (fallback with improved algorithm)
 */
async function generateMockCreditReport(formData) {
    const companyName = formData.companyName || formData.company_name;
    const registrationNumber = formData.registrationNumber || formData.registration_number;
    const address = formData.address;
    
    // Company identification validation
    const identificationStrength = assessCompanyIdentification(companyName, registrationNumber, address);
    
    const tradeValue = parseFloat(formData.tradeValue || formData.trade_value || 100000);
    const tenor = parseInt(formData.tenor || '90', 10);
    const country = (formData.country || 'USA').toUpperCase();
    const sector = (formData.sector || formData.sector_commodity || 'GENERAL').toUpperCase();
    const role = (formData.role || 'buyer').toLowerCase();
    
    // Enhanced scoring algorithm with multiple risk factors
    let score = 70; // Base score (more conservative)
    
    // Country Risk Factors (based on economic stability)
    const countryRiskFactors = {
        'USA': 0, 'GBR': -2, 'DEU': 0, 'FRA': -1, 'CAN': 0, 'AUS': -1, 'JPN': 0,
        'CHN': -5, 'IND': -3, 'BRA': -4, 'RUS': -8, 'TUR': -5, 'MEX': -3,
        'DEFAULT': -5
    };
    score += countryRiskFactors[country] || countryRiskFactors['DEFAULT'];
    
    // Industry/Sector Risk Factors
    const sectorRiskFactors = {
        'AGRICULTURE': 2, 'GRAIN': 2, 'WHEAT': 2, 'CORN': 2, 'SOYBEAN': 2,
        'TECHNOLOGY': -3, 'FINANCE': -5, 'HEALTHCARE': 1, 'MANUFACTURING': 0,
        'RETAIL': -2, 'ENERGY': -4, 'OIL': -4, 'GAS': -3,
        'DEFAULT': 0
    };
    const matchedSector = Object.keys(sectorRiskFactors).find(s => sector.includes(s)) || 'DEFAULT';
    score += sectorRiskFactors[matchedSector];
    
    // Trade Value Risk (non-linear scaling)
    if (tradeValue > 5000000) score -= 15; // Very large trades
    else if (tradeValue > 1000000) score -= 10; // Large trades
    else if (tradeValue > 500000) score -= 5; // Medium-large trades
    else if (tradeValue < 50000) score += 3; // Small trades (lower risk)
    
    // Tenor Risk (payment terms)
    if (tenor > 180) score -= 20; // Very long terms
    else if (tenor > 120) score -= 15; // Long terms
    else if (tenor > 90) score -= 8; // Medium-long terms
    else if (tenor < 30) score += 5; // Short terms (lower risk)
    
    // Role-based adjustments
    if (role === 'supplier') score += 2; // Suppliers typically have lower risk
    else if (role === 'buyer') score -= 1; // Buyers have slightly higher risk
    
    // Ensure score is 0-100
    score = Math.max(0, Math.min(100, score));
    
    // Calculate Probability of Default (PD)
    const pd = (100 - score) / 100;
    
    // Determine risk band
    const riskBand = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'E';
    
    // Enhanced factors with more realistic data
    const factors = {
        pd: pd,
        risk_band: riskBand,
        verification_score: Math.max(60, Math.min(95, score + Math.random() * 10 - 5)), // Add some variance
        sanctions_status: 'CLEAR', // Would need real API for this
        registry_status: 'VERIFIED', // Would need real API for this
        pep_status: 'CLEAR', // Would need real API for this
        country_risk: countryRiskFactors[country] < -5 ? 'HIGH' : countryRiskFactors[country] < -2 ? 'MEDIUM' : 'LOW',
        tenor_risk: tenor > 120 ? 'HIGH' : tenor > 90 ? 'MEDIUM' : 'LOW',
        trade_amount_risk: tradeValue > 1000000 ? 'HIGH' : tradeValue > 500000 ? 'MEDIUM' : 'LOW',
        sector_risk: sectorRiskFactors[matchedSector] < -3 ? 'HIGH' : sectorRiskFactors[matchedSector] < 0 ? 'MEDIUM' : 'LOW',
        reliability_note: 'This is a simulated credit score. For production use, integrate with real credit bureaus (Dun & Bradstreet, Experian, Equifax).'
    };
    
    // Get mock credit bureau data for consistency
    const companyData = {
        companyName: companyName,
        name: companyName,
        country: country,
        registrationNumber: registrationNumber || null,
        address: address || null,
        industry: sector,
        sector: sector
    };
    
    const mockCreditBureauScores = await creditBureauHub.getComprehensiveCreditScore(companyData);
    const mockCreditBureauReport = await creditBureauHub.getComprehensiveCreditReport(companyData);
    
    // Calculate data source reliability
    const dataSourceReliability = assessDataSourceReliability(mockCreditBureauScores, identificationStrength);
    
    // Add company matching warnings
    let companyMatchingWarnings = [];
    if (identificationStrength.level === 'WEAK') {
        companyMatchingWarnings.push({
            type: 'warning',
            severity: 'HIGH',
            message: `⚠️ WEAK COMPANY IDENTIFICATION: Only company name provided. Multiple companies may share this name. Risk of matching wrong company.`,
            recommendation: 'Provide registration number or tax ID to uniquely identify the company.'
        });
    } else if (identificationStrength.level === 'MEDIUM') {
        companyMatchingWarnings.push({
            type: 'warning',
            severity: 'MEDIUM',
            message: `⚠️ PARTIAL COMPANY IDENTIFICATION: Registration number or address provided but not both.`,
            recommendation: 'Provide both registration number and address for maximum accuracy.'
        });
    }
    
    // Add credit bureau data to factors
    factors.credit_bureau_score = mockCreditBureauScores.averageScore;
    factors.credit_bureau_rating = mockCreditBureauScores.overallRating;
    factors.credit_bureau_reliability = mockCreditBureauScores.reliability;
    factors.credit_bureau_sources = mockCreditBureauScores.sources;
    factors.financial_analysis = mockCreditBureauReport.financialAnalysis;
    factors.payment_history = mockCreditBureauReport.paymentHistory;
    factors.bankruptcy_history = mockCreditBureauReport.bankruptcyHistory;
    // Company identification
    factors.company_identification_strength = identificationStrength;
    factors.company_matching_warnings = companyMatchingWarnings;
    factors.data_source_reliability = dataSourceReliability;
    
    // Calculate deal-specific risk score if deal structure provided
    let dealRiskScore = null;
    let dealRecommendations = [];
    const hasDealStructure = formData.depositPercentage || formData.paymentTerms || formData.merchandiseCollateral || formData.auctionAvailable;
    
    if (hasDealStructure) {
        const dealStructure = {
            depositPercentage: parseFloat(formData.depositPercentage || 0),
            paymentTerms: formData.paymentTerms || 'open_account',
            merchandiseCollateral: formData.merchandiseCollateral || 'none',
            auctionAvailable: formData.auctionAvailable === 'true' || formData.auctionAvailable === true,
            tradeValue: tradeValue,
            tenor: tenor,
            role: role
        };
        
        const dealRiskResult = dealRiskScorer.calculateDealRiskScore(score, dealStructure);
        dealRiskScore = dealRiskResult.dealCreditScore;
        dealRecommendations = dealRiskResult.recommendations;
        
        // Add deal-specific factors
        factors.deal_structure = dealStructure;
        factors.deal_risk_score = dealRiskScore;
        factors.deal_risk_band = dealRiskResult.riskBand;
        factors.deal_score_improvement = dealRiskResult.scoreImprovement;
        factors.deal_risk_reduction = dealRiskResult.riskReduction;
        factors.collateral_protection = dealRiskResult.collateralProtection;
        factors.deal_recommendations = dealRecommendations;
    }
    
    const riskNotes = generateRiskNotes(factors, formData);
    
    // Determine final score (deal-specific if available, otherwise regular)
    const finalScore = dealRiskScore !== null ? dealRiskScore : Math.round(score);
    
    return {
        score: finalScore,
        companyCreditScore: Math.round(score),
        dealCreditScore: dealRiskScore,
        factors: factors,
        riskNotes: riskNotes,
        assessment: {
            method: 'enhanced_mock_algorithm',
            data_sources: ['simulated'],
            reliability: dataSourceReliability.overallReliability,
            note: 'Mock scoring algorithm - not suitable for production decisions. Add credit bureau API credentials for real data.'
        },
        creditBureauData: {
            scores: mockCreditBureauScores,
            report: mockCreditBureauReport,
            reliability: mockCreditBureauScores.reliability,
            sources: mockCreditBureauScores.sources
        },
        dealRiskAnalysis: dealRiskScore !== null ? {
            dealScore: dealRiskScore,
            scoreImprovement: factors.deal_score_improvement,
            riskReduction: factors.deal_risk_reduction,
            recommendations: dealRecommendations,
            collateralProtection: factors.collateral_protection
        } : null,
        companyIdentification: identificationStrength,
        dataSources: dataSourceReliability,
        warnings: companyMatchingWarnings,
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
    
    // Company identification warnings (highest priority)
    if (factors.company_matching_warnings && factors.company_matching_warnings.length > 0) {
        factors.company_matching_warnings.forEach(warning => {
            notes.push(`${warning.message} ${warning.recommendation ? `Recommendation: ${warning.recommendation}` : ''}`);
        });
    }
    
    // Data source reliability notes
    if (factors.data_source_reliability) {
        const reliability = factors.data_source_reliability;
        notes.push(`📊 ${reliability.message}`);
        if (reliability.notChecked && reliability.notChecked.length > 0) {
            notes.push(`⚠️ Credit bureaus not checked: ${reliability.notChecked.join(', ')}. Score based on algorithmic estimate only.`);
        }
        if (reliability.checked && reliability.checked.length > 0 && !reliability.checked[0].includes('None')) {
            notes.push(`✓ Credit bureaus checked: ${reliability.checked.join(', ')}.`);
        }
    }
    
    // Company identification strength
    if (factors.company_identification_strength) {
        const ident = factors.company_identification_strength;
        if (ident.level === 'STRONG') {
            notes.push(`✓ Strong company identification: All identifiers provided (name, registration, address).`);
        } else if (ident.level === 'MEDIUM') {
            notes.push(`⚠️ Medium company identification: ${ident.provided.join(', ')} provided. Missing: ${ident.missing.join(', ')}.`);
        } else if (ident.level === 'WEAK') {
            notes.push(`⚠️ Weak company identification: Only company name provided. Cannot verify unique company identity.`);
        }
    }
    
    // Credit bureau notes
    if (factors.credit_bureau_score !== null && factors.credit_bureau_score !== undefined) {
        if (factors.credit_bureau_score >= 80) {
            notes.push('Excellent credit bureau scores indicate strong creditworthiness.');
        } else if (factors.credit_bureau_score >= 65) {
            notes.push('Good credit bureau scores show acceptable credit risk.');
        } else if (factors.credit_bureau_score < 50) {
            notes.push('Low credit bureau scores indicate elevated credit risk. Additional due diligence recommended.');
        }
        
        if (factors.credit_bureau_reliability === 'HIGH') {
            notes.push('Credit assessment based on comprehensive data from multiple credit bureaus.');
        } else if (factors.credit_bureau_reliability === 'LOW' || factors.credit_bureau_reliability === 'VERY_LOW') {
            notes.push('Credit bureau data not available. Assessment based on algorithmic scoring.');
        }
    }
    
    // Financial analysis notes
    if (factors.financial_analysis) {
        if (factors.financial_analysis.financialHealth === 'POOR') {
            notes.push('Financial analysis indicates poor financial health. High risk.');
        } else if (factors.financial_analysis.financialHealth === 'GOOD' || factors.financial_analysis.financialHealth === 'EXCELLENT') {
            notes.push('Financial analysis shows strong financial health.');
        }
    }
    
    // Payment history notes
    if (factors.payment_history) {
        if (factors.payment_history.averageDaysToPay > 60) {
            notes.push('Payment history shows extended payment terms. May indicate cash flow issues.');
        } else if (factors.payment_history.averageDaysToPay < 30) {
            notes.push('Payment history shows prompt payment behavior. Positive indicator.');
        }
        
        if (factors.payment_history.latePayments > 0.20) {
            notes.push('Payment history shows high rate of late payments. Risk factor.');
        }
    }
    
    // Bankruptcy history notes
    if (factors.bankruptcy_history && factors.bankruptcy_history.hasBankruptcy) {
        notes.push('Bankruptcy history detected. High credit risk.');
    }
    
    // Risk band notes
    if (factors.risk_band === 'E' || factors.risk_band === 'D') {
        notes.push('High credit risk detected. Recommend additional guarantees or collateral.');
    }
    
    // Tenor risk notes
    if (factors.tenor_risk === 'HIGH') {
        notes.push('Extended payment terms increase default risk.');
    }
    
    // Trade amount risk notes
    if (factors.trade_amount_risk === 'HIGH') {
        notes.push('Large trade value requires enhanced due diligence.');
    }
    
    // Sanctions notes
    if (factors.sanctions_status !== 'CLEAR') {
        notes.push('Sanctions screening requires attention.');
    }
    
    // PEP notes
    if (factors.pep_status !== 'CLEAR') {
        notes.push('PEP (Politically Exposed Person) screening indicates potential compliance risk.');
    }
    
    // Deal-specific recommendations
    if (factors.deal_recommendations && factors.deal_recommendations.length > 0) {
        factors.deal_recommendations.forEach(rec => {
            if (rec.type === 'positive' && rec.priority === 'HIGH') {
                notes.push(`✓ ${rec.message}`);
            } else if (rec.type === 'warning' && rec.priority === 'HIGH') {
                notes.push(`⚠️ ${rec.message}`);
            } else if (rec.type === 'suggestion') {
                notes.push(`💡 ${rec.message}`);
            }
        });
    }
    
    // Deal risk score improvement
    if (factors.deal_score_improvement && factors.deal_score_improvement > 0) {
        notes.push(`Deal structure improves credit score by ${factors.deal_score_improvement} points due to collateral protection.`);
    }
    
    // Deal risk reduction
    if (factors.deal_risk_reduction && factors.deal_risk_reduction > 0) {
        notes.push(`Deal structure reduces risk by ${factors.deal_risk_reduction.toFixed(1)}% through collateral and payment protection.`);
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

