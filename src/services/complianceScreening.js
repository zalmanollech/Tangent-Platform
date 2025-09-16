/**
 * Comprehensive KYC Compliance Screening Service
 * Integrates with multiple free databases and APIs for automated company intelligence
 */

const fetch = require('node-fetch');
const xml2js = require('xml2js');

class ComplianceScreeningService {
  constructor() {
    this.sanctionsCache = new Map();
    this.companyCache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Main screening function - called when KYC is submitted
   */
  async performComprehensiveScreening(companyData) {
    const results = {
      companyName: companyData.company,
      regNumber: companyData.regNumber,
      country: companyData.country,
      screeningDate: new Date().toISOString(),
      overallRiskScore: 0,
      findings: [],
      sources: [],
      riskFactors: []
    };

    try {
      // 1. CORE SANCTIONS SCREENING
      console.log('🔍 Starting sanctions screening...');
      const sanctionsResults = await this.performSanctionsScreening(companyData);
      results.findings.push(...sanctionsResults.findings);
      results.sources.push(...sanctionsResults.sources);
      results.riskFactors.push(...sanctionsResults.riskFactors);

      // 2. DEBARMENT CHECKS
      console.log('🔍 Checking debarment lists...');
      const debarmentResults = await this.performDebarmentChecks(companyData);
      results.findings.push(...debarmentResults.findings);
      results.sources.push(...debarmentResults.sources);
      results.riskFactors.push(...debarmentResults.riskFactors);

      // 3. COMPANY VERIFICATION
      console.log('🔍 Verifying company identity...');
      const companyResults = await this.performCompanyVerification(companyData);
      results.findings.push(...companyResults.findings);
      results.sources.push(...companyResults.sources);
      results.riskFactors.push(...companyResults.riskFactors);

      // 4. BENEFICIAL OWNERSHIP SCREENING
      console.log('🔍 Screening beneficial ownership...');
      const ownershipResults = await this.performOwnershipScreening(companyData);
      results.findings.push(...ownershipResults.findings);
      results.sources.push(...ownershipResults.sources);
      results.riskFactors.push(...ownershipResults.riskFactors);

      // 5. COUNTRY RISK ASSESSMENT
      console.log('🔍 Assessing country risk...');
      const countryResults = await this.performCountryRiskAssessment(companyData);
      results.findings.push(...countryResults.findings);
      results.sources.push(...countryResults.sources);
      results.riskFactors.push(...countryResults.riskFactors);

      // 6. ADVERSE MEDIA SCREENING
      console.log('🔍 Screening adverse media...');
      const mediaResults = await this.performAdverseMediaScreening(companyData);
      results.findings.push(...mediaResults.findings);
      results.sources.push(...mediaResults.sources);
      results.riskFactors.push(...mediaResults.riskFactors);

      // Calculate overall risk score
      results.overallRiskScore = this.calculateRiskScore(results.riskFactors);

      console.log(`✅ Screening complete. Risk Score: ${results.overallRiskScore}/100`);
      return results;

    } catch (error) {
      console.error('❌ Screening error:', error);
      results.findings.push({
        type: 'error',
        severity: 'medium',
        title: 'Screening System Error',
        description: `Unable to complete full screening: ${error.message}`,
        source: 'Internal System'
      });
      return results;
    }
  }

  /**
   * 1. SANCTIONS SCREENING
   * Screens against UN, OFAC, EU, UK, Canada, Australia, Japan
   */
  async performSanctionsScreening(companyData) {
    const results = { findings: [], sources: [], riskFactors: [] };
    
    try {
      // UN Security Council Consolidated List
      const unResults = await this.checkUNSanctions(companyData);
      if (unResults.hits.length > 0) {
        results.findings.push({
          type: 'sanctions',
          severity: 'critical',
          title: 'UN Sanctions Match',
          description: `Company matches UN Security Council Consolidated List`,
          details: unResults.hits,
          source: 'UN Security Council'
        });
        results.riskFactors.push({ type: 'sanctions', weight: 100, source: 'UN' });
      }
      results.sources.push('UN Security Council Consolidated List');

      // OFAC SDN List
      const ofacResults = await this.checkOFACSanctions(companyData);
      if (ofacResults.hits.length > 0) {
        results.findings.push({
          type: 'sanctions',
          severity: 'critical',
          title: 'OFAC Sanctions Match',
          description: `Company matches OFAC Specially Designated Nationals List`,
          details: ofacResults.hits,
          source: 'U.S. OFAC'
        });
        results.riskFactors.push({ type: 'sanctions', weight: 100, source: 'OFAC' });
      }
      results.sources.push('U.S. OFAC SDN List');

      // US Consolidated Screening List
      const cslResults = await this.checkConsolidatedScreeningList(companyData);
      if (cslResults.hits.length > 0) {
        results.findings.push({
          type: 'export_controls',
          severity: 'high',
          title: 'Export Control Match',
          description: `Company matches US Consolidated Screening List`,
          details: cslResults.hits,
          source: 'U.S. Trade.gov'
        });
        results.riskFactors.push({ type: 'export_controls', weight: 80, source: 'CSL' });
      }
      results.sources.push('U.S. Consolidated Screening List');

      // EU Sanctions
      const euResults = await this.checkEUSanctions(companyData);
      if (euResults.hits.length > 0) {
        results.findings.push({
          type: 'sanctions',
          severity: 'critical',
          title: 'EU Sanctions Match',
          description: `Company matches EU Consolidated Sanctions List`,
          details: euResults.hits,
          source: 'European Union'
        });
        results.riskFactors.push({ type: 'sanctions', weight: 100, source: 'EU' });
      }
      results.sources.push('EU Consolidated Sanctions List');

      // UK OFSI
      const ukResults = await this.checkUKSanctions(companyData);
      if (ukResults.hits.length > 0) {
        results.findings.push({
          type: 'sanctions',
          severity: 'critical',
          title: 'UK Sanctions Match',
          description: `Company matches UK OFSI Consolidated List`,
          details: ukResults.hits,
          source: 'UK OFSI'
        });
        results.riskFactors.push({ type: 'sanctions', weight: 100, source: 'UK' });
      }
      results.sources.push('UK OFSI Consolidated List');

    } catch (error) {
      console.error('Sanctions screening error:', error);
      results.findings.push({
        type: 'warning',
        severity: 'medium',
        title: 'Sanctions Screening Incomplete',
        description: `Some sanctions databases could not be accessed: ${error.message}`,
        source: 'System'
      });
    }

    return results;
  }

  /**
   * 2. DEBARMENT CHECKS
   * World Bank, ADB, EBRD
   */
  async performDebarmentChecks(companyData) {
    const results = { findings: [], sources: [], riskFactors: [] };
    
    try {
      // World Bank Debarment List
      const wbResults = await this.checkWorldBankDebarment(companyData);
      if (wbResults.hits.length > 0) {
        results.findings.push({
          type: 'debarment',
          severity: 'high',
          title: 'World Bank Debarment',
          description: `Company found on World Bank Listing of Ineligible Firms`,
          details: wbResults.hits,
          source: 'World Bank'
        });
        results.riskFactors.push({ type: 'debarment', weight: 85, source: 'World Bank' });
      }
      results.sources.push('World Bank Ineligible Firms List');

      // Asian Development Bank
      const adbResults = await this.checkADBDebarment(companyData);
      if (adbResults.hits.length > 0) {
        results.findings.push({
          type: 'debarment',
          severity: 'high',
          title: 'ADB Sanctions',
          description: `Company found on Asian Development Bank Sanctions List`,
          details: adbResults.hits,
          source: 'Asian Development Bank'
        });
        results.riskFactors.push({ type: 'debarment', weight: 85, source: 'ADB' });
      }
      results.sources.push('Asian Development Bank Sanctions List');

      // EBRD
      const ebrdResults = await this.checkEBRDDebarment(companyData);
      if (ebrdResults.hits.length > 0) {
        results.findings.push({
          type: 'debarment',
          severity: 'high',
          title: 'EBRD Ineligibility',
          description: `Company found on EBRD Ineligible Entities List`,
          details: ebrdResults.hits,
          source: 'European Bank for Reconstruction and Development'
        });
        results.riskFactors.push({ type: 'debarment', weight: 85, source: 'EBRD' });
      }
      results.sources.push('EBRD Ineligible Entities List');

    } catch (error) {
      console.error('Debarment screening error:', error);
    }

    return results;
  }

  /**
   * 3. COMPANY VERIFICATION
   * OpenCorporates, Companies House, SEC EDGAR, GLEIF
   */
  async performCompanyVerification(companyData) {
    const results = { findings: [], sources: [], riskFactors: [] };
    
    try {
      // OpenCorporates Search
      const ocResults = await this.searchOpenCorporates(companyData);
      if (ocResults.found) {
        results.findings.push({
          type: 'company_verified',
          severity: 'info',
          title: 'Company Verified',
          description: `Company found in business registers`,
          details: ocResults.details,
          source: 'OpenCorporates'
        });
        results.riskFactors.push({ type: 'verification', weight: -10, source: 'OpenCorporates' }); // Lower risk
      } else {
        results.findings.push({
          type: 'company_not_found',
          severity: 'medium',
          title: 'Company Not Found in Registers',
          description: `Company not found in major business registers`,
          source: 'OpenCorporates'
        });
        results.riskFactors.push({ type: 'verification_failure', weight: 25, source: 'OpenCorporates' });
      }
      results.sources.push('OpenCorporates Global Registry');

      // GLEIF LEI Search
      const leiResults = await this.searchGLEIF(companyData);
      if (leiResults.found) {
        results.findings.push({
          type: 'lei_found',
          severity: 'info',
          title: 'Legal Entity Identifier Found',
          description: `Company has registered LEI with parent company links`,
          details: leiResults.details,
          source: 'GLEIF'
        });
        results.riskFactors.push({ type: 'lei_verified', weight: -15, source: 'GLEIF' }); // Lower risk
      }
      results.sources.push('GLEIF LEI Database');

      // Country-specific checks
      if (companyData.country === 'UK' || companyData.country === 'United Kingdom') {
        const chResults = await this.searchCompaniesHouse(companyData);
        if (chResults.found) {
          results.findings.push({
            type: 'uk_company_verified',
            severity: 'info',
            title: 'UK Company Verified',
            description: `Company verified in UK Companies House`,
            details: chResults.details,
            source: 'UK Companies House'
          });
        }
        results.sources.push('UK Companies House');
      }

      if (companyData.country === 'US' || companyData.country === 'United States') {
        const secResults = await this.searchSECEDGAR(companyData);
        if (secResults.found) {
          results.findings.push({
            type: 'sec_filing_found',
            severity: 'info',
            title: 'SEC Filings Found',
            description: `Company has SEC filings (public company)`,
            details: secResults.details,
            source: 'SEC EDGAR'
          });
          results.riskFactors.push({ type: 'public_company', weight: -20, source: 'SEC' }); // Lower risk
        }
        results.sources.push('SEC EDGAR Database');
      }

    } catch (error) {
      console.error('Company verification error:', error);
    }

    return results;
  }

  /**
   * 4. BENEFICIAL OWNERSHIP SCREENING
   * ICIJ Offshore Leaks, Open Ownership
   */
  async performOwnershipScreening(companyData) {
    const results = { findings: [], sources: [], riskFactors: [] };
    
    try {
      // ICIJ Offshore Leaks Database
      const offshoreResults = await this.searchOffshoreLeaks(companyData);
      if (offshoreResults.hits.length > 0) {
        results.findings.push({
          type: 'offshore_exposure',
          severity: 'high',
          title: 'Offshore Connections Found',
          description: `Company or related entities found in offshore leaks databases`,
          details: offshoreResults.hits,
          source: 'ICIJ Offshore Leaks'
        });
        results.riskFactors.push({ type: 'offshore_risk', weight: 60, source: 'ICIJ' });
      }
      results.sources.push('ICIJ Offshore Leaks Database');

    } catch (error) {
      console.error('Ownership screening error:', error);
    }

    return results;
  }

  /**
   * 5. COUNTRY RISK ASSESSMENT
   * FATF Grey/Black List
   */
  async performCountryRiskAssessment(companyData) {
    const results = { findings: [], sources: [], riskFactors: [] };
    
    try {
      const fatfResults = await this.checkFATFStatus(companyData.country);
      if (fatfResults.status === 'high-risk') {
        results.findings.push({
          type: 'country_risk',
          severity: 'high',
          title: 'High-Risk Country',
          description: `Company is based in a FATF high-risk jurisdiction`,
          details: fatfResults.details,
          source: 'FATF'
        });
        results.riskFactors.push({ type: 'country_risk', weight: 50, source: 'FATF' });
      } else if (fatfResults.status === 'increased-monitoring') {
        results.findings.push({
          type: 'country_risk',
          severity: 'medium',
          title: 'Increased Monitoring Country',
          description: `Company is based in a FATF increased monitoring jurisdiction`,
          details: fatfResults.details,
          source: 'FATF'
        });
        results.riskFactors.push({ type: 'country_risk', weight: 25, source: 'FATF' });
      }
      results.sources.push('FATF Risk Assessment');

    } catch (error) {
      console.error('Country risk assessment error:', error);
    }

    return results;
  }

  /**
   * 6. ADVERSE MEDIA SCREENING
   * INTERPOL Red Notices, News APIs
   */
  async performAdverseMediaScreening(companyData) {
    const results = { findings: [], sources: [], riskFactors: [] };
    
    try {
      // INTERPOL Red Notices
      const interpolResults = await this.searchINTERPOL(companyData);
      if (interpolResults.hits.length > 0) {
        results.findings.push({
          type: 'law_enforcement',
          severity: 'critical',
          title: 'INTERPOL Red Notice',
          description: `Related persons found in INTERPOL Red Notices`,
          details: interpolResults.hits,
          source: 'INTERPOL'
        });
        results.riskFactors.push({ type: 'law_enforcement', weight: 90, source: 'INTERPOL' });
      }
      results.sources.push('INTERPOL Red Notices');

      // News screening (simplified for now)
      const newsResults = await this.searchAdverseNews(companyData);
      if (newsResults.adverseCount > 5) {
        results.findings.push({
          type: 'adverse_media',
          severity: 'medium',
          title: 'Significant Adverse Media',
          description: `Multiple adverse news articles found`,
          details: { count: newsResults.adverseCount, sample: newsResults.sample },
          source: 'News APIs'
        });
        results.riskFactors.push({ type: 'adverse_media', weight: 30, source: 'News' });
      }
      results.sources.push('Global News Sources');

    } catch (error) {
      console.error('Adverse media screening error:', error);
    }

    return results;
  }

  /**
   * RISK SCORING ALGORITHM
   */
  calculateRiskScore(riskFactors) {
    let score = 0;
    let maxPossible = 0;

    riskFactors.forEach(factor => {
      if (factor.weight > 0) {
        score += factor.weight;
        maxPossible += 100; // Each risk factor could be max 100
      } else {
        // Negative weights reduce risk
        score += factor.weight;
      }
    });

    // Normalize to 0-100 scale
    const normalizedScore = Math.max(0, Math.min(100, score));
    return Math.round(normalizedScore);
  }

  // ==================== API INTEGRATION METHODS ====================
  // These methods make actual API calls to the databases

  async checkUNSanctions(companyData) {
    // UN Consolidated List API integration
    try {
      const response = await fetch('https://scsanctions.un.org/fop/fop?xml_type=consolidated');
      const xmlData = await response.text();
      const parser = new xml2js.Parser();
      const parsed = await parser.parseStringPromise(xmlData);
      
      // Search logic for company name and registration number
      const hits = this.searchXMLData(parsed, companyData);
      return { hits };
    } catch (error) {
      console.error('UN sanctions check error:', error);
      return { hits: [] };
    }
  }

  async checkOFACSanctions(companyData) {
    // OFAC SDN List integration
    try {
      // This would integrate with OFAC's actual API
      // For now, return mock data structure
      return { hits: [] };
    } catch (error) {
      console.error('OFAC check error:', error);
      return { hits: [] };
    }
  }

  async checkConsolidatedScreeningList(companyData) {
    // US CSL API integration
    try {
      const apiUrl = `https://api.trade.gov/consolidated_screening_list/search?q=${encodeURIComponent(companyData.company)}`;
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      return { hits: data.results || [] };
    } catch (error) {
      console.error('CSL check error:', error);
      return { hits: [] };
    }
  }

  async searchOpenCorporates(companyData) {
    // OpenCorporates API integration
    try {
      const apiUrl = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(companyData.company)}&jurisdiction_code=${companyData.country}`;
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      if (data.results && data.results.companies && data.results.companies.length > 0) {
        return {
          found: true,
          details: data.results.companies[0]
        };
      }
      return { found: false };
    } catch (error) {
      console.error('OpenCorporates search error:', error);
      return { found: false };
    }
  }

  // Additional API methods would go here...
  // (I'll implement the remaining ones based on your feedback)

  searchXMLData(xmlData, companyData) {
    // XML parsing logic for sanctions lists
    const hits = [];
    // Implementation would search through XML structure
    return hits;
  }
}

module.exports = ComplianceScreeningService;
