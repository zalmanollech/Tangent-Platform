// PDF Generator for Traidefi
// Generates branded PDF reports for credit reports and insurance quotes

const fs = require('fs');
const path = require('path');

// For now, we'll create a simple text-based PDF using a lightweight approach
// In production, you might want to use pdfkit, puppeteer, or a service like Puppeteer/Playwright

/**
 * Generate Credit Report PDF
 */
async function generateCreditReportPDF(report, inputData, factors) {
    try {
        console.log('[INFO] Generating PDF for credit report:', report.id);
        
        // Create a simple HTML-based PDF content
        // In production, you'd use a proper PDF library like pdfkit or puppeteer
        const pdfContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Credit Report #${report.id}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            color: #000;
            background: #fff;
        }
        .header {
            border-bottom: 3px solid #000;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        h1 {
            font-size: 2rem;
            margin: 0;
            color: #000;
        }
        .score-display {
            text-align: center;
            margin: 30px 0;
        }
        .score-circle {
            display: inline-block;
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: ${getScoreColor(report.score)};
            color: #000;
            line-height: 120px;
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 10px;
        }
        .section {
            margin: 30px 0;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
        }
        .section-title {
            font-size: 1.2rem;
            font-weight: 600;
            margin-bottom: 15px;
            color: #000;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 15px;
        }
        .info-item {
            padding: 10px;
            background: #f5f5f5;
            border-radius: 4px;
        }
        .info-label {
            font-size: 0.85rem;
            color: #666;
            margin-bottom: 5px;
        }
        .info-value {
            font-size: 1rem;
            font-weight: 600;
            color: #000;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Traidefi Credit Report</h1>
        <p>Report #${report.id} • Generated on ${new Date(report.created_at).toLocaleString()}</p>
    </div>
    
    <div class="score-display">
        <div class="score-circle">${report.score}</div>
        <div style="font-size: 1.2rem; font-weight: 600; margin-top: 10px;">
            ${report.dealCreditScore ? 'Deal Risk Score' : 'Credit Score'}
        </div>
        ${report.companyCreditScore && report.dealCreditScore ? `
        <div style="color: #666; margin-top: 5px; font-size: 0.9rem;">
            Company Score: ${report.companyCreditScore} → Deal Score: ${report.dealCreditScore}
            <span style="color: #10b981; margin-left: 10px;">+${report.dealCreditScore - report.companyCreditScore} points</span>
        </div>
        ` : ''}
        <div style="color: #666; margin-top: 5px;">Risk Band: ${factors?.deal_risk_band || factors?.risk_band || 'C'}</div>
    </div>
    
    <div class="section">
        <div class="section-title">Input Data</div>
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Company Name</div>
                <div class="info-value">${inputData.companyName || inputData.company_name || 'N/A'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Country</div>
                <div class="info-value">${inputData.country || 'N/A'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Sector/Commodity</div>
                <div class="info-value">${inputData.sector || inputData.sector_commodity || 'N/A'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Trade Value</div>
                <div class="info-value">$${inputData.tradeValue || inputData.trade_value || 'N/A'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Tenor</div>
                <div class="info-value">${inputData.tenor || 'N/A'} days</div>
            </div>
            <div class="info-item">
                <div class="info-label">Role</div>
                <div class="info-value">${(inputData.role || 'N/A').toUpperCase()}</div>
            </div>
            ${inputData.depositPercentage ? `
            <div class="info-item">
                <div class="info-label">Deposit Percentage</div>
                <div class="info-value">${inputData.depositPercentage}%</div>
            </div>
            ` : ''}
            ${inputData.paymentTerms ? `
            <div class="info-item">
                <div class="info-label">Payment Terms</div>
                <div class="info-value">${inputData.paymentTerms.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
            </div>
            ` : ''}
            ${inputData.merchandiseCollateral ? `
            <div class="info-item">
                <div class="info-label">Merchandise Collateral</div>
                <div class="info-value">${inputData.merchandiseCollateral.charAt(0).toUpperCase() + inputData.merchandiseCollateral.slice(1)}</div>
            </div>
            ` : ''}
            ${inputData.auctionAvailable ? `
            <div class="info-item">
                <div class="info-label">Auction Protection</div>
                <div class="info-value">Yes</div>
            </div>
            ` : ''}
        </div>
    </div>
    
    ${report.dealRiskAnalysis ? `
    <div class="section" style="background: #f0f9ff; border-left: 4px solid #06b6d4;">
        <div class="section-title">📋 Deal-Specific Risk Analysis</div>
        <div style="padding: 20px; background: white; border-radius: 8px; margin-top: 15px;">
            <div style="margin-bottom: 15px;">
                <strong>Company Credit Score:</strong> ${report.companyCreditScore}
                <br><strong>Deal Risk Score:</strong> <span style="color: #10b981; font-size: 1.2rem; font-weight: 600;">${report.dealRiskAnalysis.dealScore}</span>
                <br><strong>Score Improvement:</strong> <span style="color: #10b981;">+${report.dealRiskAnalysis.scoreImprovement} points</span>
                <br><strong>Risk Reduction:</strong> <span style="color: #10b981;">${report.dealRiskAnalysis.riskReduction.toFixed(1)}%</span>
            </div>
            ${report.dealRiskAnalysis.recommendations && report.dealRiskAnalysis.recommendations.length > 0 ? `
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
                <strong style="color: #06b6d4;">Recommendations:</strong>
                <ul style="margin-top: 10px; padding-left: 20px;">
                    ${report.dealRiskAnalysis.recommendations.map(rec => `
                    <li style="margin-bottom: 8px; color: ${rec.type === 'positive' ? '#10b981' : rec.type === 'warning' ? '#ef4444' : '#f59e0b'};">
                        ${rec.priority === 'HIGH' ? '🔴' : '🟡'} ${rec.message}
                    </li>
                    `).join('')}
                </ul>
            </div>
            ` : ''}
        </div>
    </div>
    ` : ''}
    
    <div class="section">
        <div class="section-title">Risk Factors</div>
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Probability of Default (PD)</div>
                <div class="info-value">${((factors?.pd || 0) * 100).toFixed(2)}%</div>
            </div>
            <div class="info-item">
                <div class="info-label">Verification Score</div>
                <div class="info-value">${factors?.verification_score || 'N/A'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Sanctions Status</div>
                <div class="info-value">${factors?.sanctions_status || 'N/A'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Registry Status</div>
                <div class="info-value">${factors?.registry_status || 'N/A'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">PEP Status</div>
                <div class="info-value">${factors?.pep_status || 'N/A'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Country Risk</div>
                <div class="info-value">${factors?.country_risk || 'N/A'}</div>
            </div>
        </div>
    </div>
    
    ${report.risk_notes ? `
    <div class="section">
        <div class="section-title">Risk Notes</div>
        <p style="line-height: 1.6;">${report.risk_notes}</p>
    </div>
    ` : ''}
    
    <div class="footer">
        <p>Generated by Traidefi Platform</p>
        <p>For more information, visit traidefi.ai</p>
    </div>
</body>
</html>
        `;
        
        // For now, return the HTML content
        // In production, convert this to PDF using pdfkit, puppeteer, or a service
        return {
            content: pdfContent,
            filename: `credit-report-${report.id}.html`,
            type: 'html' // For now, we'll store as HTML. In production, convert to PDF
        };
        
    } catch (error) {
        console.error('[ERROR] PDF generation error:', error);
        throw error;
    }
}

/**
 * Generate Insurance Quote PDF
 */
async function generateInsuranceQuotePDF(quote, inputData, assumptions) {
    try {
        console.log('[INFO] Generating PDF for insurance quote:', quote.id);
        
        const pdfContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Insurance Quote #${quote.id}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            color: #000;
            background: #fff;
        }
        .header {
            border-bottom: 3px solid #000;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        h1 {
            font-size: 2rem;
            margin: 0;
            color: #000;
        }
        .premium-display {
            text-align: center;
            margin: 30px 0;
        }
        .premium-range {
            font-size: 3rem;
            font-weight: 700;
            color: #10b981;
            margin: 20px 0;
        }
        .section {
            margin: 30px 0;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
        }
        .section-title {
            font-size: 1.2rem;
            font-weight: 600;
            margin-bottom: 15px;
            color: #000;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 15px;
        }
        .info-item {
            padding: 10px;
            background: #f5f5f5;
            border-radius: 4px;
        }
        .info-label {
            font-size: 0.85rem;
            color: #666;
            margin-bottom: 5px;
        }
        .info-value {
            font-size: 1rem;
            font-weight: 600;
            color: #000;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Traidefi Insurance Quote</h1>
        <p>Quote #${quote.id} • Generated on ${new Date(quote.created_at).toLocaleString()}</p>
    </div>
    
    <div class="premium-display">
        <h2 style="font-size: 1.5rem; margin-bottom: 10px;">Premium Range</h2>
        <div class="premium-range">${quote.premium_min}% - ${quote.premium_max}%</div>
        <p style="color: #666;">Of trade value</p>
    </div>
    
    <div class="section">
        <div class="section-title">Input Data</div>
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Trade Value</div>
                <div class="info-value">$${inputData.tradeValue || inputData.trade_value || 'N/A'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Tenor</div>
                <div class="info-value">${inputData.tenor || 'N/A'} days</div>
            </div>
            <div class="info-item">
                <div class="info-label">Sector/Commodity</div>
                <div class="info-value">${inputData.sector || inputData.sector_commodity || 'N/A'}</div>
            </div>
            ${inputData.counterpartyScore ? `
            <div class="info-item">
                <div class="info-label">Counterparty Credit Score</div>
                <div class="info-value">${inputData.counterpartyScore}</div>
            </div>
            ` : ''}
        </div>
    </div>
    
    ${assumptions ? `
    <div class="section">
        <div class="section-title">Actuarial Assumptions</div>
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Probability of Default (PD)</div>
                <div class="info-value">${((assumptions.pd || 0) * 100).toFixed(2)}%</div>
            </div>
            <div class="info-item">
                <div class="info-label">Risk Band</div>
                <div class="info-value">${assumptions.risk_band || 'N/A'}</div>
            </div>
            ${assumptions.underwriting_score ? `
            <div class="info-item">
                <div class="info-label">Underwriting Score</div>
                <div class="info-value">${assumptions.underwriting_score}</div>
            </div>
            ` : ''}
            ${assumptions.recommendation ? `
            <div class="info-item">
                <div class="info-label">Recommendation</div>
                <div class="info-value">${assumptions.recommendation.decision || 'N/A'}</div>
            </div>
            ` : ''}
        </div>
    </div>
    ` : ''}
    
    <div class="footer">
        <p>Generated by Traidefi Platform</p>
        <p>For more information, visit traidefi.ai</p>
    </div>
</body>
</html>
        `;
        
        return {
            content: pdfContent,
            filename: `insurance-quote-${quote.id}.html`,
            type: 'html' // For now, we'll store as HTML. In production, convert to PDF
        };
        
    } catch (error) {
        console.error('[ERROR] PDF generation error:', error);
        throw error;
    }
}

/**
 * Get color for credit score
 */
function getScoreColor(score) {
    if (score >= 80) return '#10b981';
    if (score >= 65) return '#3b82f6';
    if (score >= 50) return '#eab308';
    if (score >= 35) return '#f97316';
    return '#ef4444';
}

module.exports = {
    generateCreditReportPDF,
    generateInsuranceQuotePDF
};

