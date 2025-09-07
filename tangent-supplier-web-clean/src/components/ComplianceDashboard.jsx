import React, { useState, useEffect } from 'react';

const ComplianceDashboard = ({ userRole, onComplianceUpdate }) => {
  const [complianceChecks, setComplianceChecks] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNewCheckForm, setShowNewCheckForm] = useState(false);
  const [newCheckForm, setNewCheckForm] = useState({
    name: '',
    type: 'individual',
    country: '',
    industry: '',
    description: ''
  });

  // Load compliance data
  useEffect(() => {
    loadComplianceData();
  }, []);

  const loadComplianceData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/compliance/checks');
      const data = await response.json();
      
      if (data.ok) {
        setComplianceChecks(data.checks || []);
        setStatistics(data.statistics || null);
      }
    } catch (error) {
      console.error('Failed to load compliance data:', error);
      setError('Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  };

  const performComplianceCheck = async (entityData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/compliance/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entityData)
      });

      const data = await response.json();
      
      if (data.ok) {
        setComplianceChecks(prev => [data.results, ...prev]);
        if (onComplianceUpdate) onComplianceUpdate(data.results);
        alert('Compliance check completed successfully!');
        setShowNewCheckForm(false);
        setNewCheckForm({ name: '', type: 'individual', country: '', industry: '', description: '' });
      } else {
        setError(data.error || 'Compliance check failed');
      }
    } catch (error) {
      console.error('Compliance check error:', error);
      setError('Compliance check failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewCheckSubmit = async (e) => {
    e.preventDefault();
    await performComplianceCheck(newCheckForm);
  };

  const getRiskColor = (riskLevel) => {
    const colors = {
      'LOW': '#10b981',
      'MEDIUM': '#f59e0b',
      'HIGH': '#ef4444',
      'CRITICAL': '#dc2626'
    };
    return colors[riskLevel] || '#6b7280';
  };

  const getStatusColor = (status) => {
    const colors = {
      'PASS': '#10b981',
      'REVIEW': '#f59e0b',
      'FAIL': '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  const getCheckTypeIcon = (checkType) => {
    const icons = {
      'sanctions': '🚫',
      'pep': '👤',
      'adverseMedia': '📰',
      'identity': '🆔',
      'geographic': '🌍'
    };
    return icons[checkType] || '❓';
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getRiskDescription = (riskLevel) => {
    const descriptions = {
      'LOW': 'Low risk - standard monitoring',
      'MEDIUM': 'Medium risk - enhanced monitoring',
      'HIGH': 'High risk - manual review required',
      'CRITICAL': 'Critical risk - immediate action required'
    };
    return descriptions[riskLevel] || 'Unknown risk level';
  };

  return (
    <div className="compliance-dashboard">
      <style jsx>{`
        .compliance-dashboard {
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

        .new-check-form {
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
          min-height: 80px;
        }

        .checks-list {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }

        .check-item {
          border-bottom: 1px solid #e5e7eb;
          padding: 20px;
        }

        .check-item:last-child {
          border-bottom: none;
        }

        .check-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 15px;
        }

        .check-title {
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
        }

        .check-status {
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

        .risk-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          color: white;
        }

        .check-details {
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

        .check-results {
          margin-top: 15px;
        }

        .check-type {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }

        .check-type-icon {
          font-size: 16px;
        }

        .check-type-name {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        .check-type-risk {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
          color: white;
        }

        .recommendations {
          margin-top: 15px;
          padding: 15px;
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 6px;
        }

        .recommendations-title {
          font-size: 14px;
          font-weight: 600;
          color: #92400e;
          margin-bottom: 10px;
        }

        .recommendation-item {
          font-size: 13px;
          color: #92400e;
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
        <h2 className="title">Compliance Dashboard</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowNewCheckForm(!showNewCheckForm)}
        >
          {showNewCheckForm ? 'Cancel' : 'New Compliance Check'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading && (
        <div className="loading">
          Processing compliance check...
        </div>
      )}

      {statistics && (
        <div className="statistics">
          <div className="stat-card">
            <div className="stat-number">{statistics.total}</div>
            <div className="stat-label">Total Checks</div>
          </div>
          <div className="stat-card">
            <div className="stat-number" style={{ color: '#10b981' }}>{statistics.passed}</div>
            <div className="stat-label">Passed</div>
          </div>
          <div className="stat-card">
            <div className="stat-number" style={{ color: '#f59e0b' }}>{statistics.review}</div>
            <div className="stat-label">Review Required</div>
          </div>
          <div className="stat-card">
            <div className="stat-number" style={{ color: '#ef4444' }}>{statistics.failed}</div>
            <div className="stat-label">Failed</div>
          </div>
        </div>
      )}

      {showNewCheckForm && (
        <div className="new-check-form">
          <h3>New Compliance Check</h3>
          <form onSubmit={handleNewCheckSubmit}>
            <div className="form-group">
              <label className="form-label">Entity Name</label>
              <input
                type="text"
                className="form-input"
                value={newCheckForm.name}
                onChange={(e) => setNewCheckForm(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Entity Type</label>
              <select
                className="form-select"
                value={newCheckForm.type}
                onChange={(e) => setNewCheckForm(prev => ({ ...prev, type: e.target.value }))}
              >
                <option value="individual">Individual</option>
                <option value="company">Company</option>
                <option value="organization">Organization</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input
                type="text"
                className="form-input"
                value={newCheckForm.country}
                onChange={(e) => setNewCheckForm(prev => ({ ...prev, country: e.target.value }))}
                placeholder="e.g., US, GB, DE"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Industry</label>
              <input
                type="text"
                className="form-input"
                value={newCheckForm.industry}
                onChange={(e) => setNewCheckForm(prev => ({ ...prev, industry: e.target.value }))}
                placeholder="e.g., Banking, Trading, Manufacturing"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                value={newCheckForm.description}
                onChange={(e) => setNewCheckForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Additional information about the entity"
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-primary">
                Run Compliance Check
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowNewCheckForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="checks-list">
        <h3 style={{ padding: '20px', margin: 0, borderBottom: '1px solid #e5e7eb' }}>
          Recent Compliance Checks
        </h3>
        
        {complianceChecks.length === 0 ? (
          <div className="empty-state">
            <p>No compliance checks yet</p>
            {!showNewCheckForm && (
              <button
                className="btn btn-primary"
                onClick={() => setShowNewCheckForm(true)}
              >
                Run First Check
              </button>
            )}
          </div>
        ) : (
          complianceChecks.map(check => (
            <div key={check.entityId} className="check-item">
              <div className="check-header">
                <div className="check-title">{check.entity.name}</div>
                <div className="check-status">
                  <div
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(check.complianceStatus) }}
                  >
                    {check.complianceStatus}
                  </div>
                  <div
                    className="risk-badge"
                    style={{ backgroundColor: getRiskColor(check.overallRisk) }}
                  >
                    {check.overallRisk} RISK
                  </div>
                </div>
              </div>

              <div className="check-details">
                <div className="detail-item">
                  <div className="detail-label">Entity Type</div>
                  <div className="detail-value">{check.entity.type}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Country</div>
                  <div className="detail-value">{check.entity.country || 'N/A'}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Industry</div>
                  <div className="detail-value">{check.entity.industry || 'N/A'}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Checked</div>
                  <div className="detail-value">{formatTimestamp(check.timestamp)}</div>
                </div>
              </div>

              <div className="check-results">
                {Object.entries(check.checks).map(([checkType, result]) => (
                  <div key={checkType} className="check-type">
                    <span className="check-type-icon">{getCheckTypeIcon(checkType)}</span>
                    <span className="check-type-name">
                      {checkType.charAt(0).toUpperCase() + checkType.slice(1)}
                    </span>
                    <div
                      className="check-type-risk"
                      style={{ backgroundColor: getRiskColor(result.riskLevel) }}
                    >
                      {result.riskLevel}
                    </div>
                  </div>
                ))}
              </div>

              {check.recommendations && check.recommendations.length > 0 && (
                <div className="recommendations">
                  <div className="recommendations-title">Recommendations</div>
                  {check.recommendations.map((rec, index) => (
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

export default ComplianceDashboard;
