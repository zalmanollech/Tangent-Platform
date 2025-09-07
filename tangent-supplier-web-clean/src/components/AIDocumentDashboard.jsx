import React, { useState, useEffect } from 'react';

const AIDocumentDashboard = ({ userRole, onDocumentVerificationUpdate }) => {
  const [verifications, setVerifications] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNewVerificationForm, setShowNewVerificationForm] = useState(false);
  const [newVerificationForm, setNewVerificationForm] = useState({
    documentType: 'auto',
    verificationLevel: 'STANDARD',
    documentData: '',
    description: ''
  });

  // Load verification data
  useEffect(() => {
    loadVerificationData();
  }, []);

  const loadVerificationData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ai-document/verifications');
      const data = await response.json();
      
      if (data.ok) {
        setVerifications(data.verifications || []);
        setStatistics(data.statistics || null);
      }
    } catch (error) {
      console.error('Failed to load verification data:', error);
      setError('Failed to load verification data');
    } finally {
      setLoading(false);
    }
  };

  const performDocumentVerification = async (verificationData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/ai-document/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verificationData)
      });

      const data = await response.json();
      
      if (data.ok) {
        setVerifications(prev => [data.results, ...prev]);
        if (onDocumentVerificationUpdate) onDocumentVerificationUpdate(data.results);
        alert('Document verification completed successfully!');
        setShowNewVerificationForm(false);
        setNewVerificationForm({ 
          documentType: 'auto', 
          verificationLevel: 'STANDARD', 
          documentData: '', 
          description: '' 
        });
      } else {
        setError(data.error || 'Document verification failed');
      }
    } catch (error) {
      console.error('Document verification error:', error);
      setError('Document verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewVerificationSubmit = async (e) => {
    e.preventDefault();
    await performDocumentVerification(newVerificationForm);
  };

  const getStatusColor = (status) => {
    const colors = {
      'VERIFIED': '#10b981',
      'REVIEW_REQUIRED': '#f59e0b',
      'FAILED': '#ef4444',
      'FRAUDULENT': '#dc2626',
      'PROCESSING': '#6b7280'
    };
    return colors[status] || '#6b7280';
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return '#10b981';
    if (confidence >= 0.6) return '#f59e0b';
    return '#ef4444';
  };

  const getDocumentTypeIcon = (documentType) => {
    const icons = {
      'passport': '📘',
      'drivers_license': '🚗',
      'national_id': '🆔',
      'utility_bill': '⚡',
      'bank_statement': '🏦',
      'invoice': '🧾',
      'contract': '📄',
      'certificate': '🏆',
      'auto': '🤖'
    };
    return icons[documentType] || '📄';
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatConfidence = (confidence) => {
    return `${Math.round(confidence * 100)}%`;
  };

  const formatProcessingTime = (time) => {
    return `${time}ms`;
  };

  return (
    <div className="ai-document-dashboard">
      <style jsx>{`
        .ai-document-dashboard {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid #e5e7eb;
        }

        .title {
          font-size: 24px;
          font-weight: bold;
          color: #1f2937;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover {
          background: #2563eb;
        }

        .btn-secondary {
          background: #6b7280;
          color: white;
        }

        .btn-secondary:hover {
          background: #4b5563;
        }

        .statistics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }

        .stat-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          text-align: center;
        }

        .stat-number {
          font-size: 28px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 5px;
        }

        .stat-label {
          font-size: 14px;
          color: #6b7280;
        }

        .new-verification-form {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-label {
          display: block;
          font-weight: 500;
          margin-bottom: 5px;
          color: #374151;
        }

        .form-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
        }

        .form-select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          background: white;
        }

        .form-textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          resize: vertical;
          min-height: 120px;
        }

        .verifications-list {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }

        .verification-item {
          border-bottom: 1px solid #e5e7eb;
          padding: 20px;
        }

        .verification-item:last-child {
          border-bottom: none;
        }

        .verification-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 15px;
        }

        .verification-title {
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
        }

        .verification-status {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          color: white;
        }

        .confidence-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          color: white;
        }

        .verification-details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 15px;
        }

        .detail-item {
          background: #f9fafb;
          padding: 12px;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }

        .detail-label {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 4px;
        }

        .detail-value {
          font-size: 14px;
          font-weight: 500;
          color: #1f2937;
        }

        .extracted-data {
          margin-top: 15px;
          padding: 15px;
          background: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 6px;
        }

        .extracted-data-title {
          font-size: 14px;
          font-weight: 600;
          color: #0c4a6e;
          margin-bottom: 10px;
        }

        .field-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }

        .field-name {
          font-size: 13px;
          color: #0c4a6e;
          font-weight: 500;
        }

        .field-value {
          font-size: 13px;
          color: #0c4a6e;
        }

        .validation-results {
          margin-top: 15px;
          padding: 15px;
          background: #f0fdf4;
          border: 1px solid #22c55e;
          border-radius: 6px;
        }

        .validation-title {
          font-size: 14px;
          font-weight: 600;
          color: #14532d;
          margin-bottom: 10px;
        }

        .validation-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }

        .validation-name {
          font-size: 13px;
          color: #14532d;
          font-weight: 500;
        }

        .validation-status {
          font-size: 13px;
          color: #14532d;
        }

        .security-analysis {
          margin-top: 15px;
          padding: 15px;
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 6px;
        }

        .security-title {
          font-size: 14px;
          font-weight: 600;
          color: #92400e;
          margin-bottom: 10px;
        }

        .security-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }

        .security-name {
          font-size: 13px;
          color: #92400e;
          font-weight: 500;
        }

        .security-status {
          font-size: 13px;
          color: #92400e;
        }

        .fraud-detection {
          margin-top: 15px;
          padding: 15px;
          background: #fef2f2;
          border: 1px solid #ef4444;
          border-radius: 6px;
        }

        .fraud-title {
          font-size: 14px;
          font-weight: 600;
          color: #dc2626;
          margin-bottom: 10px;
        }

        .fraud-item {
          font-size: 13px;
          color: #dc2626;
          margin-bottom: 5px;
        }

        .recommendations {
          margin-top: 15px;
          padding: 15px;
          background: #f3f4f6;
          border: 1px solid #9ca3af;
          border-radius: 6px;
        }

        .recommendations-title {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 10px;
        }

        .recommendation-item {
          font-size: 13px;
          color: #374151;
          margin-bottom: 5px;
        }

        .error-message {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 20px;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }
      `}</style>

      <div className="header">
        <h2 className="title">AI Document Verification</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowNewVerificationForm(!showNewVerificationForm)}
        >
          {showNewVerificationForm ? 'Cancel' : 'New Document Verification'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading && (
        <div className="loading">
          Processing document verification...
        </div>
      )}

      {statistics && (
        <div className="statistics">
          <div className="stat-card">
            <div className="stat-number">{statistics.total}</div>
            <div className="stat-label">Total Verifications</div>
          </div>
          <div className="stat-card">
            <div className="stat-number" style={{ color: '#10b981' }}>{statistics.verified}</div>
            <div className="stat-label">Verified</div>
          </div>
          <div className="stat-card">
            <div className="stat-number" style={{ color: '#f59e0b' }}>{statistics.reviewRequired}</div>
            <div className="stat-label">Review Required</div>
          </div>
          <div className="stat-card">
            <div className="stat-number" style={{ color: '#ef4444' }}>{statistics.failed}</div>
            <div className="stat-label">Failed</div>
          </div>
        </div>
      )}

      {showNewVerificationForm && (
        <div className="new-verification-form">
          <h3>New Document Verification</h3>
          <form onSubmit={handleNewVerificationSubmit}>
            <div className="form-group">
              <label className="form-label">Document Type</label>
              <select
                className="form-select"
                value={newVerificationForm.documentType}
                onChange={(e) => setNewVerificationForm(prev => ({ ...prev, documentType: e.target.value }))}
              >
                <option value="auto">Auto-detect</option>
                <option value="passport">Passport</option>
                <option value="drivers_license">Driver's License</option>
                <option value="national_id">National ID</option>
                <option value="utility_bill">Utility Bill</option>
                <option value="bank_statement">Bank Statement</option>
                <option value="invoice">Invoice</option>
                <option value="contract">Contract</option>
                <option value="certificate">Certificate</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Verification Level</label>
              <select
                className="form-select"
                value={newVerificationForm.verificationLevel}
                onChange={(e) => setNewVerificationForm(prev => ({ ...prev, verificationLevel: e.target.value }))}
              >
                <option value="BASIC">Basic</option>
                <option value="STANDARD">Standard</option>
                <option value="ADVANCED">Advanced</option>
                <option value="PREMIUM">Premium</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Document Data (Base64 or Text)</label>
              <textarea
                className="form-textarea"
                value={newVerificationForm.documentData}
                onChange={(e) => setNewVerificationForm(prev => ({ ...prev, documentData: e.target.value }))}
                placeholder="Paste document data here (Base64 encoded image or text content)"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input
                type="text"
                className="form-input"
                value={newVerificationForm.description}
                onChange={(e) => setNewVerificationForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description of the document"
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-primary">
                Verify Document
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowNewVerificationForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="verifications-list">
        <h3 style={{ padding: '20px', margin: 0, borderBottom: '1px solid #e5e7eb' }}>
          Recent Document Verifications
        </h3>
        
        {verifications.length === 0 ? (
          <div className="empty-state">
            <p>No document verifications yet</p>
            {!showNewVerificationForm && (
              <button
                className="btn btn-primary"
                onClick={() => setShowNewVerificationForm(true)}
              >
                Verify First Document
              </button>
            )}
          </div>
        ) : (
          verifications.map(verification => (
            <div key={verification.documentId} className="verification-item">
              <div className="verification-header">
                <div className="verification-title">
                  {getDocumentTypeIcon(verification.documentType)} {verification.documentType.toUpperCase()}
                </div>
                <div className="verification-status">
                  <div
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(verification.status) }}
                  >
                    {verification.status}
                  </div>
                  <div
                    className="confidence-badge"
                    style={{ backgroundColor: getConfidenceColor(verification.confidence) }}
                  >
                    {formatConfidence(verification.confidence)}
                  </div>
                </div>
              </div>

              <div className="verification-details">
                <div className="detail-item">
                  <div className="detail-label">Document Type</div>
                  <div className="detail-value">{verification.documentType}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Verification Level</div>
                  <div className="detail-value">{verification.verificationLevel}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Processing Time</div>
                  <div className="detail-value">{formatProcessingTime(verification.processingTime)}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Verified</div>
                  <div className="detail-value">{formatTimestamp(verification.timestamp)}</div>
                </div>
              </div>

              {verification.extractedData && verification.extractedData.fields && (
                <div className="extracted-data">
                  <div className="extracted-data-title">Extracted Data</div>
                  {Object.entries(verification.extractedData.fields).map(([key, value]) => (
                    <div key={key} className="field-item">
                      <span className="field-name">{key.replace(/_/g, ' ').toUpperCase()}</span>
                      <span className="field-value">{value}</span>
                    </div>
                  ))}
                </div>
              )}

              {verification.validationResults && (
                <div className="validation-results">
                  <div className="validation-title">Validation Results</div>
                  <div className="validation-item">
                    <span className="validation-name">Format Valid</span>
                    <span className="validation-status">{verification.validationResults.formatValid ? '✓' : '✗'}</span>
                  </div>
                  <div className="validation-item">
                    <span className="validation-name">Fields Complete</span>
                    <span className="validation-status">{verification.validationResults.fieldsComplete ? '✓' : '✗'}</span>
                  </div>
                  <div className="validation-item">
                    <span className="validation-name">Data Consistent</span>
                    <span className="validation-status">{verification.validationResults.dataConsistent ? '✓' : '✗'}</span>
                  </div>
                  <div className="validation-item">
                    <span className="validation-name">Security Features</span>
                    <span className="validation-status">{verification.validationResults.securityFeatures ? '✓' : '✗'}</span>
                  </div>
                  <div className="validation-item">
                    <span className="validation-name">Overall Score</span>
                    <span className="validation-status">{verification.validationResults.overallScore}%</span>
                  </div>
                </div>
              )}

              {verification.securityAnalysis && (
                <div className="security-analysis">
                  <div className="security-title">Security Analysis</div>
                  <div className="security-item">
                    <span className="security-name">Watermark</span>
                    <span className="security-status">{verification.securityAnalysis.hasWatermark ? '✓' : '✗'}</span>
                  </div>
                  <div className="security-item">
                    <span className="security-name">Hologram</span>
                    <span className="security-status">{verification.securityAnalysis.hasHologram ? '✓' : '✗'}</span>
                  </div>
                  <div className="security-item">
                    <span className="security-name">Microprint</span>
                    <span className="security-status">{verification.securityAnalysis.hasMicroprint ? '✓' : '✗'}</span>
                  </div>
                  <div className="security-item">
                    <span className="security-name">UV Features</span>
                    <span className="security-status">{verification.securityAnalysis.hasUVFeatures ? '✓' : '✗'}</span>
                  </div>
                  <div className="security-item">
                    <span className="security-name">Security Thread</span>
                    <span className="security-status">{verification.securityAnalysis.hasSecurityThread ? '✓' : '✗'}</span>
                  </div>
                  <div className="security-item">
                    <span className="security-name">Security Score</span>
                    <span className="security-status">{verification.securityAnalysis.securityScore}%</span>
                  </div>
                </div>
              )}

              {verification.fraudDetection && verification.fraudDetection.isFraudulent && (
                <div className="fraud-detection">
                  <div className="fraud-title">⚠️ Fraud Detection Alert</div>
                  <div className="fraud-item">Fraud Score: {Math.round(verification.fraudDetection.fraudScore * 100)}%</div>
                  <div className="fraud-item">Confidence: {Math.round(verification.fraudDetection.confidence * 100)}%</div>
                  {verification.fraudDetection.riskFactors.map((factor, index) => (
                    <div key={index} className="fraud-item">• {factor}</div>
                  ))}
                  {verification.fraudDetection.anomalies.map((anomaly, index) => (
                    <div key={index} className="fraud-item">• {anomaly}</div>
                  ))}
                </div>
              )}

              {verification.recommendations && verification.recommendations.length > 0 && (
                <div className="recommendations">
                  <div className="recommendations-title">Recommendations</div>
                  {verification.recommendations.map((rec, index) => (
                    <div key={index} className="recommendation-item">
                      • {rec.action}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AIDocumentDashboard;
