/**
 * Simplified KYC Intelligence Service
 * Uses built-in Node.js capabilities and hardcoded intelligence data
 * No external dependencies required - fully self-contained
 */

class SimpleIntelligenceService {
  constructor() {
    this.sanctionsKeywords = [
      'taliban', 'al-qaeda', 'isis', 'hezbollah', 'iran', 'north korea',
      'sanctions', 'terrorist', 'blocked', 'frozen', 'prohibited',
      'embargo', 'restricted', 'designated', 'blacklist'
    ];
    
    this.riskCountries = [
      'afghanistan', 'iran', 'north korea', 'syria', 'cuba', 'sudan',
      'somalia', 'libya', 'yemen', 'venezuela', 'myanmar', 'belarus'
    ];
    
    this.highRiskSectors = [
      'arms', 'weapons', 'military', 'defense', 'nuclear', 'chemical',
      'gambling', 'casino', 'cryptocurrency', 'bitcoin', 'mining',
      'tobacco', 'adult', 'precious metals', 'diamonds'
    ];
    
    this.suspiciousPatterns = [
      'shell company', 'nominee', 'bearer shares', 'offshore',
      'panama', 'cayman', 'bermuda', 'delaware', 'seychelles',
      'bvi', 'virgin islands', 'malta', 'cyprus', 'dubai'
    ];
  }

  /**
   * Main intelligence screening function
   */
  async performComprehensiveScreening(kycData) {
    const startTime = Date.now();
    
    try {
      const results = {
        timestamp: new Date().toISOString(),
        processingTime: 0,
        overallRiskScore: 0,
        riskLevel: 'LOW',
        autoApproved: true,
        flags: [],
        sources: [],
        screeningResults: {
          sanctions: await this.sanctionsScreening(kycData),
          company: await this.companyVerification(kycData),
          ownership: await this.ownershipAnalysis(kycData),
          geographic: await this.geographicRiskAssessment(kycData),
          sector: await this.sectorRiskAnalysis(kycData),
          document: await this.documentAnalysis(kycData)
        }
      };

      // Calculate overall risk score
      results.overallRiskScore = this.calculateOverallRisk(results.screeningResults);
      results.riskLevel = this.determineRiskLevel(results.overallRiskScore);
      results.autoApproved = results.overallRiskScore < 70;
      
      results.processingTime = Date.now() - startTime;
      
      return results;
      
    } catch (error) {
      console.error('Intelligence screening error:', error);
      return this.getFallbackResults(error);
    }
  }

  /**
   * Sanctions screening using keyword matching
   */
  async sanctionsScreening(kycData) {
    const companyName = (kycData.companyName || '').toLowerCase();
    const description = (kycData.businessDescription || '').toLowerCase();
    const country = (kycData.country || '').toLowerCase();
    
    const searchText = `${companyName} ${description} ${country}`;
    const foundKeywords = [];
    
    this.sanctionsKeywords.forEach(keyword => {
      if (searchText.includes(keyword)) {
        foundKeywords.push(keyword);
      }
    });
    
    const riskScore = foundKeywords.length > 0 ? 90 : 0;
    
    return {
      source: 'Internal Sanctions Database',
      riskScore,
      status: riskScore > 0 ? 'HIGH_RISK' : 'CLEAR',
      matches: foundKeywords,
      details: foundKeywords.length > 0 
        ? `Potential sanctions match: ${foundKeywords.join(', ')}`
        : 'No sanctions indicators found'
    };
  }

  /**
   * Company verification and registration analysis
   */
  async companyVerification(kycData) {
    const companyName = kycData.companyName || '';
    const registrationNumber = kycData.registrationNumber || '';
    const country = (kycData.country || '').toLowerCase();
    
    let riskScore = 0;
    const flags = [];
    
    // Check company name patterns
    if (companyName.toLowerCase().includes('llc') || 
        companyName.toLowerCase().includes('ltd') ||
        companyName.toLowerCase().includes('inc')) {
      // Standard corporate structure - good
    } else {
      flags.push('Unusual company structure');
      riskScore += 20;
    }
    
    // Check registration number format
    if (!registrationNumber || registrationNumber.length < 5) {
      flags.push('Missing or invalid registration number');
      riskScore += 30;
    }
    
    // Geographic risk
    if (this.riskCountries.includes(country)) {
      flags.push(`High-risk jurisdiction: ${country}`);
      riskScore += 40;
    }
    
    return {
      source: 'Company Registry Analysis',
      riskScore,
      status: riskScore > 50 ? 'HIGH_RISK' : riskScore > 25 ? 'MEDIUM_RISK' : 'LOW_RISK',
      flags,
      details: flags.length > 0 ? flags.join('; ') : 'Standard company profile'
    };
  }

  /**
   * Beneficial ownership and control analysis
   */
  async ownershipAnalysis(kycData) {
    const directors = kycData.directors || [];
    const shareholders = kycData.shareholders || [];
    const country = (kycData.country || '').toLowerCase();
    
    let riskScore = 0;
    const flags = [];
    
    // Check for complex ownership structures
    if (directors.length === 0) {
      flags.push('No directors listed');
      riskScore += 25;
    }
    
    if (shareholders.length === 0) {
      flags.push('No shareholders disclosed');
      riskScore += 25;
    }
    
    // Check for offshore indicators
    const ownershipText = `${JSON.stringify(directors)} ${JSON.stringify(shareholders)}`.toLowerCase();
    this.suspiciousPatterns.forEach(pattern => {
      if (ownershipText.includes(pattern)) {
        flags.push(`Offshore indicator: ${pattern}`);
        riskScore += 15;
      }
    });
    
    return {
      source: 'Beneficial Ownership Screening',
      riskScore,
      status: riskScore > 40 ? 'HIGH_RISK' : riskScore > 20 ? 'MEDIUM_RISK' : 'LOW_RISK',
      flags,
      details: flags.length > 0 ? flags.join('; ') : 'Standard ownership structure'
    };
  }

  /**
   * Geographic risk assessment
   */
  async geographicRiskAssessment(kycData) {
    const country = (kycData.country || '').toLowerCase();
    const address = (kycData.address || '').toLowerCase();
    
    let riskScore = 0;
    const flags = [];
    
    if (this.riskCountries.includes(country)) {
      flags.push(`High-risk jurisdiction: ${country}`);
      riskScore = 85;
    } else if (['russia', 'china', 'pakistan', 'turkey'].includes(country)) {
      flags.push(`Medium-risk jurisdiction: ${country}`);
      riskScore = 45;
    } else {
      riskScore = 10; // Base geographic risk
    }
    
    return {
      source: 'Geographic Risk Database',
      riskScore,
      status: riskScore > 60 ? 'HIGH_RISK' : riskScore > 30 ? 'MEDIUM_RISK' : 'LOW_RISK',
      flags,
      country: country,
      details: flags.length > 0 ? flags.join('; ') : `Standard risk for ${country}`
    };
  }

  /**
   * Industry sector risk analysis
   */
  async sectorRiskAnalysis(kycData) {
    const businessType = (kycData.businessType || '').toLowerCase();
    const description = (kycData.businessDescription || '').toLowerCase();
    
    const sectorText = `${businessType} ${description}`;
    let riskScore = 0;
    const flags = [];
    
    this.highRiskSectors.forEach(sector => {
      if (sectorText.includes(sector)) {
        flags.push(`High-risk sector: ${sector}`);
        riskScore += 30;
      }
    });
    
    // Financial services get medium risk
    if (sectorText.includes('financial') || sectorText.includes('bank') || 
        sectorText.includes('exchange') || sectorText.includes('trading')) {
      flags.push('Regulated financial sector');
      riskScore += 20;
    }
    
    return {
      source: 'Sector Risk Analysis',
      riskScore: Math.min(riskScore, 90), // Cap at 90
      status: riskScore > 60 ? 'HIGH_RISK' : riskScore > 30 ? 'MEDIUM_RISK' : 'LOW_RISK',
      flags,
      details: flags.length > 0 ? flags.join('; ') : 'Standard business sector'
    };
  }

  /**
   * Document analysis
   */
  async documentAnalysis(kycData) {
    const documents = kycData.documents || [];
    let riskScore = 0;
    const flags = [];
    
    if (documents.length === 0) {
      flags.push('No documents provided');
      riskScore = 60;
    } else if (documents.length < 3) {
      flags.push('Limited documentation');
      riskScore = 30;
    } else {
      riskScore = 5; // Good documentation
    }
    
    return {
      source: 'Document Verification',
      riskScore,
      status: riskScore > 40 ? 'HIGH_RISK' : riskScore > 20 ? 'MEDIUM_RISK' : 'LOW_RISK',
      flags,
      documentCount: documents.length,
      details: flags.length > 0 ? flags.join('; ') : `${documents.length} documents provided`
    };
  }

  /**
   * Calculate overall risk score
   */
  calculateOverallRisk(screeningResults) {
    const weights = {
      sanctions: 0.4,    // 40% weight - most important
      company: 0.15,     // 15% weight
      ownership: 0.15,   // 15% weight
      geographic: 0.15,  // 15% weight
      sector: 0.1,       // 10% weight
      document: 0.05     // 5% weight
    };
    
    let weightedScore = 0;
    
    Object.keys(weights).forEach(key => {
      if (screeningResults[key]) {
        weightedScore += screeningResults[key].riskScore * weights[key];
      }
    });
    
    return Math.round(weightedScore);
  }

  /**
   * Determine risk level from score
   */
  determineRiskLevel(score) {
    if (score >= 70) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Fallback results in case of error
   */
  getFallbackResults(error) {
    return {
      timestamp: new Date().toISOString(),
      processingTime: 0,
      overallRiskScore: 50, // Medium risk when uncertain
      riskLevel: 'MEDIUM',
      autoApproved: false,
      flags: ['Screening error - manual review required'],
      sources: ['Error Fallback'],
      error: error.message,
      screeningResults: {
        sanctions: { source: 'Error', riskScore: 50, status: 'ERROR', details: 'Screening failed' }
      }
    };
  }

  /**
   * Generate detailed report
   */
  generateDetailedReport(screeningResults) {
    const report = {
      executiveSummary: this.generateExecutiveSummary(screeningResults),
      riskAssessment: this.generateRiskAssessment(screeningResults),
      recommendations: this.generateRecommendations(screeningResults),
      sources: this.generateSourcesList()
    };
    
    return report;
  }

  generateExecutiveSummary(results) {
    const { overallRiskScore, riskLevel, autoApproved } = results;
    
    let summary = `Risk Score: ${overallRiskScore}/100 (${riskLevel} RISK)\n`;
    summary += `Recommendation: ${autoApproved ? 'AUTO-APPROVE' : 'MANUAL REVIEW REQUIRED'}\n\n`;
    
    if (results.flags && results.flags.length > 0) {
      summary += `Key Concerns:\n${results.flags.map(flag => `• ${flag}`).join('\n')}`;
    }
    
    return summary;
  }

  generateRiskAssessment(results) {
    const { screeningResults } = results;
    let assessment = '';
    
    Object.keys(screeningResults).forEach(key => {
      const result = screeningResults[key];
      assessment += `${key.toUpperCase()}: ${result.status} (Score: ${result.riskScore})\n`;
      assessment += `  ${result.details}\n\n`;
    });
    
    return assessment;
  }

  generateRecommendations(results) {
    const { overallRiskScore, riskLevel, autoApproved } = results;
    
    if (autoApproved) {
      return 'Recommend approval with standard monitoring.';
    } else if (riskLevel === 'HIGH') {
      return 'Recommend rejection or enhanced due diligence with senior management approval.';
    } else {
      return 'Recommend manual review and additional documentation before approval.';
    }
  }

  generateSourcesList() {
    return [
      'Internal Sanctions Database',
      'Company Registry Analysis', 
      'Beneficial Ownership Screening',
      'Geographic Risk Database',
      'Sector Risk Analysis',
      'Document Verification'
    ];
  }
}

module.exports = SimpleIntelligenceService;
