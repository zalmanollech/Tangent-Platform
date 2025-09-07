import React, { useState, useEffect } from 'react';

const EnhancedDocumentManager = ({ tradeId, userRole, onDocumentUpdate }) => {
  const [documents, setDocuments] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    type: 0,
    description: '',
    tags: '',
    confidential: false
  });

  // Load documents and types
  useEffect(() => {
    loadDocuments();
    loadDocumentTypes();
  }, [tradeId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const endpoint = tradeId 
        ? `/api/documents/trade/${tradeId}`
        : '/api/documents/list';
      
      const response = await fetch(endpoint);
      const data = await response.json();
      
      if (data.ok) {
        setDocuments(data.documents || []);
        setStatistics(data.statistics || data.completeness);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDocumentTypes = async () => {
    try {
      const response = await fetch('/api/documents/types');
      const data = await response.json();
      
      if (data.ok) {
        setDocumentTypes(data.types || []);
      }
    } catch (error) {
      console.error('Failed to load document types:', error);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', uploadForm.type);
      formData.append('description', uploadForm.description);
      formData.append('tags', uploadForm.tags);
      formData.append('confidential', uploadForm.confidential);
      if (tradeId) formData.append('tradeId', tradeId);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (data.ok) {
        setDocuments(prev => [...prev, data.document]);
        setShowUploadForm(false);
        setUploadForm({ type: 0, description: '', tags: '', confidential: false });
        if (onDocumentUpdate) onDocumentUpdate();
        alert('Document uploaded successfully!');
      } else {
        alert(`Upload failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const updateDocumentStatus = async (documentId, status, notes = '') => {
    try {
      const response = await fetch(`/api/documents/${documentId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          updatedBy: userRole,
          notes
        })
      });

      const data = await response.json();
      
      if (data.ok) {
        setDocuments(prev => prev.map(doc => 
          doc.id === documentId ? data.document : doc
        ));
        if (onDocumentUpdate) onDocumentUpdate();
        alert('Document status updated successfully!');
      } else {
        alert(`Status update failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Status update error:', error);
      alert('Status update failed. Please try again.');
    }
  };

  const verifyDocumentIntegrity = async (documentId) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/verify`, {
        method: 'POST'
      });

      const data = await response.json();
      
      if (data.ok) {
        const message = data.verification.valid 
          ? 'Document integrity verified ✓'
          : `Document integrity check failed: ${data.verification.error}`;
        alert(message);
      } else {
        alert(`Verification failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Verification error:', error);
      alert('Verification failed. Please try again.');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'uploaded': '#3b82f6',
      'verified': '#10b981',
      'rejected': '#ef4444',
      'pending_review': '#f59e0b',
      'archived': '#6b7280'
    };
    return colors[status] || '#6b7280';
  };

  const getRiskColor = (riskLevel) => {
    const colors = {
      'low': '#10b981',
      'medium': '#f59e0b',
      'high': '#ef4444'
    };
    return colors[riskLevel] || '#6b7280';
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchQuery || 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.typeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = !selectedType || doc.type === parseInt(selectedType);
    
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="document-manager">
        <div className="loading">Loading documents...</div>
      </div>
    );
  }

  return (
    <div className="document-manager">
      <style jsx>{`
        .document-manager {
          max-width: 1200px;
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

        .controls {
          display: flex;
          gap: 15px;
          align-items: center;
        }

        .search-box {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          width: 200px;
        }

        .filter-select {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          background: white;
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
          padding: 15px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          text-align: center;
        }

        .stat-number {
          font-size: 24px;
          font-weight: bold;
          color: #1f2937;
        }

        .stat-label {
          font-size: 14px;
          color: #6b7280;
          margin-top: 5px;
        }

        .upload-form {
          background: white;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
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

        .form-textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          resize: vertical;
          min-height: 80px;
        }

        .form-checkbox {
          margin-right: 8px;
        }

        .documents-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        .document-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 15px;
          transition: all 0.2s;
        }

        .document-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .doc-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }

        .doc-name {
          font-weight: 600;
          color: #1f2937;
          font-size: 14px;
          line-height: 1.4;
        }

        .doc-status {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          color: white;
        }

        .doc-type {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 8px;
        }

        .doc-meta {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 10px;
        }

        .doc-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn-sm {
          padding: 4px 8px;
          font-size: 12px;
        }

        .btn-success {
          background: #10b981;
          color: white;
        }

        .btn-warning {
          background: #f59e0b;
          color: white;
        }

        .btn-danger {
          background: #ef4444;
          color: white;
        }

        .btn-info {
          background: #06b6d4;
          color: white;
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

        .completeness-bar {
          background: #f3f4f6;
          border-radius: 4px;
          height: 8px;
          margin: 10px 0;
          overflow: hidden;
        }

        .completeness-fill {
          background: #10b981;
          height: 100%;
          transition: width 0.3s;
        }
      `}</style>

      <div className="header">
        <h2 className="title">
          {tradeId ? 'Trade Documents' : 'Document Management'}
        </h2>
        <div className="controls">
          <input
            type="text"
            placeholder="Search documents..."
            className="search-box"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="filter-select"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="">All Types</option>
            {documentTypes.map(type => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={() => setShowUploadForm(!showUploadForm)}
          >
            {showUploadForm ? 'Cancel' : 'Upload Document'}
          </button>
        </div>
      </div>

      {statistics && (
        <div className="statistics">
          <div className="stat-card">
            <div className="stat-number">{statistics.total || documents.length}</div>
            <div className="stat-label">Total Documents</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{statistics.verifiedCount || 0}</div>
            <div className="stat-label">Verified</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{statistics.pendingCount || 0}</div>
            <div className="stat-label">Pending Review</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">
              {statistics.totalSize ? (statistics.totalSize / 1024 / 1024).toFixed(1) + ' MB' : '0 MB'}
            </div>
            <div className="stat-label">Total Size</div>
          </div>
        </div>
      )}

      {showUploadForm && (
        <div className="upload-form">
          <h3>Upload New Document</h3>
          <div className="form-group">
            <label className="form-label">Document Type</label>
            <select
              className="form-input"
              value={uploadForm.type}
              onChange={(e) => setUploadForm(prev => ({ ...prev, type: parseInt(e.target.value) }))}
            >
              {documentTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.name} {type.required ? '(Required)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              value={uploadForm.description}
              onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description of the document"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Tags (comma-separated)</label>
            <input
              type="text"
              className="form-input"
              value={uploadForm.tags}
              onChange={(e) => setUploadForm(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="e.g., urgent, confidential, final"
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                className="form-checkbox"
                checked={uploadForm.confidential}
                onChange={(e) => setUploadForm(prev => ({ ...prev, confidential: e.target.checked }))}
              />
              Confidential Document
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">Select File</label>
            <input
              type="file"
              className="form-input"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </div>
          {uploading && <div>Uploading...</div>}
        </div>
      )}

      {filteredDocuments.length === 0 ? (
        <div className="empty-state">
          <p>No documents found</p>
          {!showUploadForm && (
            <button
              className="btn btn-primary"
              onClick={() => setShowUploadForm(true)}
            >
              Upload First Document
            </button>
          )}
        </div>
      ) : (
        <div className="documents-grid">
          {filteredDocuments.map(doc => (
            <div key={doc.id} className="document-card">
              <div className="doc-header">
                <div className="doc-name">{doc.name}</div>
                <div
                  className="doc-status"
                  style={{ backgroundColor: getStatusColor(doc.status) }}
                >
                  {doc.status}
                </div>
              </div>
              <div className="doc-type">{doc.typeName}</div>
              <div className="doc-meta">
                Size: {(doc.size / 1024).toFixed(1)} KB<br />
                Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}<br />
                {doc.description && `Description: ${doc.description}`}
              </div>
              <div className="doc-actions">
                <button
                  className="btn btn-sm btn-info"
                  onClick={() => verifyDocumentIntegrity(doc.id)}
                >
                  Verify
                </button>
                {userRole === 'admin' && (
                  <>
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => updateDocumentStatus(doc.id, 'verified')}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => updateDocumentStatus(doc.id, 'rejected')}
                    >
                      Reject
                    </button>
                  </>
                )}
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => updateDocumentStatus(doc.id, 'archived')}
                >
                  Archive
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EnhancedDocumentManager;
