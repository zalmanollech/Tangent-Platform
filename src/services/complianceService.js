const axios = require('axios');
const crypto = require('crypto');

// Enhanced Compliance Service
class ComplianceService {
  constructor() {
    this.providers = {
      // Refinitiv World-Check (formerly Thomson Reuters)
      refinitiv: {
        name: 'Refinitiv World-Check',
        baseUrl: process.env.REFINITIV_BASE_URL || 'https://api.refinitiv.com',
        apiKey: process.env.REFINITIV_API_KEY,
        enabled: !!process.env.REFINITIV_API_KEY
      },
      
      // Dow Jones Risk & Compliance
      dowjones: {
        name: 'Dow Jones Risk & Compliance',
        baseUrl: process.env.DOWJONES_BASE_URL || 'https://api.dowjones.com',
        apiKey: process.env.DOWJONES_API_KEY,
        enabled: !!process.env.DOWJONES_API_KEY
      },
      
      // LexisNexis Risk Solutions
      lexisnexis: {
        name: 'LexisNexis Risk Solutions',
        baseUrl: process.env.LEXISNEXIS_BASE_URL || 'https://api.lexisnexis.com',
        apiKey: process.env.LEXISNEXIS_API_KEY,
        enabled: !!process.env.LEXISNEXIS_API_KEY
      },
      
      // ComplyAdvantage
      complyadvantage: {
        name: 'ComplyAdvantage',
        baseUrl: process.env.COMPLYADVANTAGE_BASE_URL || 'https://api.complyadvantage.com',
        apiKey: process.env.COMPLYADVANTAGE_API_KEY,
        enabled: !!process.env.COMPLYADVANTAGE_API_KEY
      },
      
      // Jumio (for identity verification)
      jumio: {
        name: 'Jumio',
        baseUrl: process.env.JUMIO_BASE_URL || 'https://netverify.com/api/v4',
        apiKey: process.env.JUMIO_API_KEY,
        secret: process.env.JUMIO_SECRET,
        enabled: !!process.env.JUMIO_API_KEY
      }
    };

    this.sanctionsLists = {
      'OFAC': 'Office of Foreign Assets Control (US)',
      'EU_SANCTIONS': 'European Union Sanctions',
      'UN_SANCTIONS': 'United Nations Sanctions',
      'UK_SANCTIONS': 'United Kingdom Sanctions',
      'CANADA_SANCTIONS': 'Canada Sanctions',
      'AUSTRALIA_SANCTIONS': 'Australia Sanctions',
      'SWISS_SANCTIONS': 'Switzerland Sanctions'
    };

    this.riskLevels = {
      'LOW': { score: 0, color: '#10b981', description: 'Low risk' },
      'MEDIUM': { score: 1, color: '#f59e0b', description: 'Medium risk' },
      'HIGH': { score: 2, color: '#ef4444', description: 'High risk' },
      'CRITICAL': { score: 3, color: '#dc2626', description: 'Critical risk' }
    };

    this.initializeProviders();
  }

  // Initialize compliance providers
  initializeProviders() {
    const enabledProviders = Object.entries(this.providers)
      .filter(([key, provider]) => provider.enabled)
      .map(([key, provider]) => provider.name);

    if (enabledProviders.length > 0) {
      console.log(`✅ Compliance providers initialized: ${enabledProviders.join(', ')}`);
    } else {
      console.log('⚠️ No compliance providers configured - using mock data');
    }
  }

  // Perform comprehensive compliance check
  async performComplianceCheck(entityData) {
    try {
      const results = {
        entityId: this.generateEntityId(),
        timestamp: new Date().toISOString(),
        entity: entityData,
        checks: {},
        overallRisk: 'LOW',
        riskScore: 0,
        recommendations: [],
        complianceStatus: 'PASS'
      };

      // Run all compliance checks in parallel
      const checkPromises = [
        this.performSanctionsScreening(entityData),
        this.performPEPCheck(entityData),
        this.performAdverseMediaCheck(entityData),
        this.performIdentityVerification(entityData),
        this.performGeographicRiskAssessment(entityData)
      ];

      const checkResults = await Promise.allSettled(checkPromises);

      // Process results
      checkResults.forEach((result, index) => {
        const checkTypes = ['sanctions', 'pep', 'adverseMedia', 'identity', 'geographic'];
        const checkType = checkTypes[index];
        
        if (result.status === 'fulfilled') {
          results.checks[checkType] = result.value;
        } else {
          results.checks[checkType] = {
            status: 'ERROR',
            error: result.reason.message,
            riskLevel: 'HIGH'
          };
        }
      });

      // Calculate overall risk
      results.overallRisk = this.calculateOverallRisk(results.checks);
      results.riskScore = this.calculateRiskScore(results.checks);
      results.complianceStatus = this.determineComplianceStatus(results);
      results.recommendations = this.generateRecommendations(results);

      return {
        success: true,
        results: results
      };

    } catch (error) {
      console.error('Compliance check error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Perform sanctions screening
  async performSanctionsScreening(entityData) {
    try {
      const results = {
        checkType: 'sanctions',
        timestamp: new Date().toISOString(),
        matches: [],
        riskLevel: 'LOW',
        details: {}
      };

      // Try real providers first
      if (this.providers.refinitiv.enabled) {
        results.details.refinitiv = await this.checkRefinitivSanctions(entityData);
      }
      
      if (this.providers.dowjones.enabled) {
        results.details.dowjones = await this.checkDowJonesSanctions(entityData);
      }
      
      if (this.providers.complyadvantage.enabled) {
        results.details.complyadvantage = await this.checkComplyAdvantageSanctions(entityData);
      }

      // If no real providers, use mock data
      if (!this.hasRealProviders()) {
        results.details.mock = await this.mockSanctionsCheck(entityData);
      }

      // Process results
      results.matches = this.processSanctionsMatches(results.details);
      results.riskLevel = this.assessSanctionsRisk(results.matches);

      return results;

    } catch (error) {
      console.error('Sanctions screening error:', error);
      return {
        checkType: 'sanctions',
        status: 'ERROR',
        error: error.message,
        riskLevel: 'HIGH'
      };
    }
  }

  // Perform PEP (Politically Exposed Person) check
  async performPEPCheck(entityData) {
    try {
      const results = {
        checkType: 'pep',
        timestamp: new Date().toISOString(),
        isPEP: false,
        pepDetails: null,
        riskLevel: 'LOW',
        details: {}
      };

      // Try real providers
      if (this.providers.refinitiv.enabled) {
        results.details.refinitiv = await this.checkRefinitivPEP(entityData);
      }
      
      if (this.providers.lexisnexis.enabled) {
        results.details.lexisnexis = await this.checkLexisNexisPEP(entityData);
      }

      // Mock data if no real providers
      if (!this.hasRealProviders()) {
        results.details.mock = await this.mockPEPCheck(entityData);
      }

      // Process results
      results.isPEP = this.determinePEPStatus(results.details);
      results.pepDetails = this.extractPEPDetails(results.details);
      results.riskLevel = this.assessPEPRisk(results.isPEP, results.pepDetails);

      return results;

    } catch (error) {
      console.error('PEP check error:', error);
      return {
        checkType: 'pep',
        status: 'ERROR',
        error: error.message,
        riskLevel: 'HIGH'
      };
    }
  }

  // Perform adverse media check
  async performAdverseMediaCheck(entityData) {
    try {
      const results = {
        checkType: 'adverseMedia',
        timestamp: new Date().toISOString(),
        articles: [],
        riskLevel: 'LOW',
        details: {}
      };

      // Try real providers
      if (this.providers.dowjones.enabled) {
        results.details.dowjones = await this.checkDowJonesAdverseMedia(entityData);
      }
      
      if (this.providers.lexisnexis.enabled) {
        results.details.lexisnexis = await this.checkLexisNexisAdverseMedia(entityData);
      }

      // Mock data if no real providers
      if (!this.hasRealProviders()) {
        results.details.mock = await this.mockAdverseMediaCheck(entityData);
      }

      // Process results
      results.articles = this.extractAdverseMediaArticles(results.details);
      results.riskLevel = this.assessAdverseMediaRisk(results.articles);

      return results;

    } catch (error) {
      console.error('Adverse media check error:', error);
      return {
        checkType: 'adverseMedia',
        status: 'ERROR',
        error: error.message,
        riskLevel: 'HIGH'
      };
    }
  }

  // Perform identity verification
  async performIdentityVerification(entityData) {
    try {
      const results = {
        checkType: 'identity',
        timestamp: new Date().toISOString(),
        verified: false,
        confidence: 0,
        riskLevel: 'HIGH',
        details: {}
      };

      // Try real providers
      if (this.providers.jumio.enabled) {
        results.details.jumio = await this.checkJumioIdentity(entityData);
      }

      // Mock data if no real providers
      if (!this.hasRealProviders()) {
        results.details.mock = await this.mockIdentityVerification(entityData);
      }

      // Process results
      results.verified = this.determineIdentityVerification(results.details);
      results.confidence = this.calculateIdentityConfidence(results.details);
      results.riskLevel = this.assessIdentityRisk(results.verified, results.confidence);

      return results;

    } catch (error) {
      console.error('Identity verification error:', error);
      return {
        checkType: 'identity',
        status: 'ERROR',
        error: error.message,
        riskLevel: 'HIGH'
      };
    }
  }

  // Perform geographic risk assessment
  async performGeographicRiskAssessment(entityData) {
    try {
      const results = {
        checkType: 'geographic',
        timestamp: new Date().toISOString(),
        riskLevel: 'LOW',
        riskFactors: [],
        details: {}
      };

      // Analyze geographic risk factors
      results.riskFactors = this.analyzeGeographicRisk(entityData);
      results.riskLevel = this.assessGeographicRiskLevel(results.riskFactors);

      return results;

    } catch (error) {
      console.error('Geographic risk assessment error:', error);
      return {
        checkType: 'geographic',
        status: 'ERROR',
        error: error.message,
        riskLevel: 'HIGH'
      };
    }
  }

  // Real provider implementations (mock for now)
  async checkRefinitivSanctions(entityData) {
    // Mock implementation - replace with real API calls
    return {
      provider: 'Refinitiv',
      status: 'SUCCESS',
      matches: [],
      timestamp: new Date().toISOString()
    };
  }

  async checkDowJonesSanctions(entityData) {
    // Mock implementation - replace with real API calls
    return {
      provider: 'Dow Jones',
      status: 'SUCCESS',
      matches: [],
      timestamp: new Date().toISOString()
    };
  }

  async checkComplyAdvantageSanctions(entityData) {
    // Mock implementation - replace with real API calls
    return {
      provider: 'ComplyAdvantage',
      status: 'SUCCESS',
      matches: [],
      timestamp: new Date().toISOString()
    };
  }

  async checkRefinitivPEP(entityData) {
    // Mock implementation - replace with real API calls
    return {
      provider: 'Refinitiv',
      status: 'SUCCESS',
      isPEP: false,
      timestamp: new Date().toISOString()
    };
  }

  async checkLexisNexisPEP(entityData) {
    // Mock implementation - replace with real API calls
    return {
      provider: 'LexisNexis',
      status: 'SUCCESS',
      isPEP: false,
      timestamp: new Date().toISOString()
    };
  }

  async checkDowJonesAdverseMedia(entityData) {
    // Mock implementation - replace with real API calls
    return {
      provider: 'Dow Jones',
      status: 'SUCCESS',
      articles: [],
      timestamp: new Date().toISOString()
    };
  }

  async checkLexisNexisAdverseMedia(entityData) {
    // Mock implementation - replace with real API calls
    return {
      provider: 'LexisNexis',
      status: 'SUCCESS',
      articles: [],
      timestamp: new Date().toISOString()
    };
  }

  async checkJumioIdentity(entityData) {
    // Mock implementation - replace with real API calls
    return {
      provider: 'Jumio',
      status: 'SUCCESS',
      verified: true,
      confidence: 0.95,
      timestamp: new Date().toISOString()
    };
  }

  // Mock implementations for testing
  async mockSanctionsCheck(entityData) {
    // Simulate random sanctions matches for testing
    const mockMatches = [];
    const random = Math.random();
    
    if (random < 0.05) { // 5% chance of match
      mockMatches.push({
        list: 'OFAC',
        name: entityData.name,
        matchScore: 0.85,
        reason: 'Name similarity to sanctioned entity',
        riskLevel: 'HIGH'
      });
    }

    return {
      provider: 'Mock',
      status: 'SUCCESS',
      matches: mockMatches,
      timestamp: new Date().toISOString()
    };
  }

  async mockPEPCheck(entityData) {
    // Simulate random PEP status for testing
    const isPEP = Math.random() < 0.02; // 2% chance of being PEP
    
    return {
      provider: 'Mock',
      status: 'SUCCESS',
      isPEP: isPEP,
      pepDetails: isPEP ? {
        position: 'Government Official',
        country: 'United States',
        riskLevel: 'MEDIUM'
      } : null,
      timestamp: new Date().toISOString()
    };
  }

  async mockAdverseMediaCheck(entityData) {
    // Simulate random adverse media for testing
    const articles = [];
    const random = Math.random();
    
    if (random < 0.03) { // 3% chance of adverse media
      articles.push({
        title: 'Company under investigation',
        source: 'Financial Times',
        date: new Date().toISOString(),
        riskLevel: 'MEDIUM'
      });
    }

    return {
      provider: 'Mock',
      status: 'SUCCESS',
      articles: articles,
      timestamp: new Date().toISOString()
    };
  }

  async mockIdentityVerification(entityData) {
    // Simulate identity verification for testing
    const verified = Math.random() > 0.1; // 90% verification rate
    
    return {
      provider: 'Mock',
      status: 'SUCCESS',
      verified: verified,
      confidence: verified ? 0.85 + Math.random() * 0.15 : 0.3 + Math.random() * 0.4,
      timestamp: new Date().toISOString()
    };
  }

  // Helper methods
  hasRealProviders() {
    return Object.values(this.providers).some(provider => provider.enabled);
  }

  processSanctionsMatches(details) {
    const matches = [];
    Object.values(details).forEach(detail => {
      if (detail.matches) {
        matches.push(...detail.matches);
      }
    });
    return matches;
  }

  assessSanctionsRisk(matches) {
    if (matches.length === 0) return 'LOW';
    if (matches.some(match => match.riskLevel === 'CRITICAL')) return 'CRITICAL';
    if (matches.some(match => match.riskLevel === 'HIGH')) return 'HIGH';
    if (matches.some(match => match.riskLevel === 'MEDIUM')) return 'MEDIUM';
    return 'LOW';
  }

  determinePEPStatus(details) {
    return Object.values(details).some(detail => detail.isPEP === true);
  }

  extractPEPDetails(details) {
    const pepDetails = Object.values(details).find(detail => detail.pepDetails);
    return pepDetails ? pepDetails.pepDetails : null;
  }

  assessPEPRisk(isPEP, pepDetails) {
    if (!isPEP) return 'LOW';
    if (pepDetails && pepDetails.riskLevel === 'HIGH') return 'HIGH';
    return 'MEDIUM';
  }

  extractAdverseMediaArticles(details) {
    const articles = [];
    Object.values(details).forEach(detail => {
      if (detail.articles) {
        articles.push(...detail.articles);
      }
    });
    return articles;
  }

  assessAdverseMediaRisk(articles) {
    if (articles.length === 0) return 'LOW';
    if (articles.some(article => article.riskLevel === 'HIGH')) return 'HIGH';
    if (articles.some(article => article.riskLevel === 'MEDIUM')) return 'MEDIUM';
    return 'LOW';
  }

  determineIdentityVerification(details) {
    return Object.values(details).some(detail => detail.verified === true);
  }

  calculateIdentityConfidence(details) {
    const confidences = Object.values(details)
      .map(detail => detail.confidence)
      .filter(conf => conf !== undefined);
    
    return confidences.length > 0 ? Math.max(...confidences) : 0;
  }

  assessIdentityRisk(verified, confidence) {
    if (!verified) return 'HIGH';
    if (confidence < 0.7) return 'HIGH';
    if (confidence < 0.9) return 'MEDIUM';
    return 'LOW';
  }

  analyzeGeographicRisk(entityData) {
    const riskFactors = [];
    
    // High-risk countries
    const highRiskCountries = ['AF', 'IR', 'KP', 'SY', 'YE'];
    if (entityData.country && highRiskCountries.includes(entityData.country)) {
      riskFactors.push({
        factor: 'High-risk jurisdiction',
        risk: 'HIGH',
        description: 'Entity located in high-risk country'
      });
    }

    // Sanctioned countries
    const sanctionedCountries = ['CU', 'IR', 'KP', 'SY', 'VE'];
    if (entityData.country && sanctionedCountries.includes(entityData.country)) {
      riskFactors.push({
        factor: 'Sanctioned jurisdiction',
        risk: 'CRITICAL',
        description: 'Entity located in sanctioned country'
      });
    }

    return riskFactors;
  }

  assessGeographicRiskLevel(riskFactors) {
    if (riskFactors.some(factor => factor.risk === 'CRITICAL')) return 'CRITICAL';
    if (riskFactors.some(factor => factor.risk === 'HIGH')) return 'HIGH';
    if (riskFactors.some(factor => factor.risk === 'MEDIUM')) return 'MEDIUM';
    return 'LOW';
  }

  calculateOverallRisk(checks) {
    const riskScores = Object.values(checks).map(check => {
      if (check.riskLevel) {
        return this.riskLevels[check.riskLevel]?.score || 0;
      }
      return 0;
    });

    const maxRisk = Math.max(...riskScores);
    return Object.keys(this.riskLevels).find(key => 
      this.riskLevels[key].score === maxRisk
    ) || 'LOW';
  }

  calculateRiskScore(checks) {
    const riskScores = Object.values(checks).map(check => {
      if (check.riskLevel) {
        return this.riskLevels[check.riskLevel]?.score || 0;
      }
      return 0;
    });

    return riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length;
  }

  determineComplianceStatus(results) {
    if (results.overallRisk === 'CRITICAL') return 'FAIL';
    if (results.overallRisk === 'HIGH') return 'REVIEW';
    return 'PASS';
  }

  generateRecommendations(results) {
    const recommendations = [];

    if (results.checks.sanctions?.matches?.length > 0) {
      recommendations.push({
        type: 'SANCTIONS',
        priority: 'HIGH',
        action: 'Manual review required - sanctions matches found',
        details: results.checks.sanctions.matches
      });
    }

    if (results.checks.pep?.isPEP) {
      recommendations.push({
        type: 'PEP',
        priority: 'MEDIUM',
        action: 'Enhanced due diligence required - PEP identified',
        details: results.checks.pep.pepDetails
      });
    }

    if (results.checks.identity?.verified === false) {
      recommendations.push({
        type: 'IDENTITY',
        priority: 'HIGH',
        action: 'Identity verification failed - additional documentation required',
        details: { confidence: results.checks.identity.confidence }
      });
    }

    if (results.checks.geographic?.riskLevel === 'HIGH' || results.checks.geographic?.riskLevel === 'CRITICAL') {
      recommendations.push({
        type: 'GEOGRAPHIC',
        priority: 'MEDIUM',
        action: 'Geographic risk assessment - enhanced monitoring required',
        details: results.checks.geographic.riskFactors
      });
    }

    return recommendations;
  }

  generateEntityId() {
    return `COMP-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`.toUpperCase();
  }

  // Get compliance statistics
  getComplianceStatistics(checks) {
    const stats = {
      total: checks.length,
      passed: 0,
      failed: 0,
      review: 0,
      byRiskLevel: {},
      byCheckType: {}
    };

    checks.forEach(check => {
      if (check.complianceStatus === 'PASS') stats.passed++;
      else if (check.complianceStatus === 'FAIL') stats.failed++;
      else if (check.complianceStatus === 'REVIEW') stats.review++;

      // Count by risk level
      const riskLevel = check.overallRisk || 'UNKNOWN';
      stats.byRiskLevel[riskLevel] = (stats.byRiskLevel[riskLevel] || 0) + 1;

      // Count by check type
      Object.keys(check.checks || {}).forEach(checkType => {
        stats.byCheckType[checkType] = (stats.byCheckType[checkType] || 0) + 1;
      });
    });

    return stats;
  }

  // Get provider status
  getProviderStatus() {
    return Object.entries(this.providers).map(([key, provider]) => ({
      key,
      name: provider.name,
      enabled: provider.enabled,
      configured: !!provider.apiKey
    }));
  }
}

module.exports = new ComplianceService();
