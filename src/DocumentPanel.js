// src/DocumentPanel.js
// Browser-compatible React component
const { useState } = React;

function DocumentPanel() {
    const [documents, setDocuments] = useState([]);
    const [uploading, setUploading] = useState(false);

    const handleFileUpload = async (event) => {
        const files = Array.from(event.target.files);
        setUploading(true);

        try {
            // Simulate file upload
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const newDocs = files.map(file => ({
                id: Date.now() + Math.random(),
                name: file.name,
                size: file.size,
                uploadedAt: new Date().toISOString(),
                status: 'uploaded'
            }));
            
            setDocuments(prev => [...prev, ...newDocs]);
        } catch (error) {
            console.error('Upload failed:', error);
        } finally {
            setUploading(false);
        }
    };

    return React.createElement('div', {
        style: {
            background: '#fff',
            border: '1px solid #e5e5e5',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '1rem'
        }
    }, [
        React.createElement('h3', { 
            key: 'title',
            style: { margin: '0 0 1rem', color: '#333' }
        }, '📄 Document Management'),
        
        React.createElement('div', {
            key: 'upload',
            style: {
                border: '2px dashed #ddd',
                borderRadius: '8px',
                padding: '2rem',
                textAlign: 'center',
                marginBottom: '1rem'
            }
        }, [
            React.createElement('input', {
                key: 'file-input',
                type: 'file',
                multiple: true,
                onChange: handleFileUpload,
                disabled: uploading,
                style: { marginBottom: '1rem' }
            }),
            React.createElement('p', {
                key: 'upload-text',
                style: { color: '#666', margin: 0 }
            }, uploading ? '⏳ Uploading...' : 'Select files to upload')
        ]),
        
        documents.length > 0 && React.createElement('div', {
            key: 'document-list'
        }, [
            React.createElement('h4', {
                key: 'list-title',
                style: { color: '#333' }
            }, 'Uploaded Documents'),
            ...documents.map(doc => 
                React.createElement('div', {
                    key: doc.id,
                    style: {
                        background: '#f8f9fa',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        marginBottom: '0.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }
                }, [
                    React.createElement('span', {
                        key: 'name',
                        style: { fontWeight: '500' }
                    }, doc.name),
                    React.createElement('span', {
                        key: 'status',
                        style: {
                            background: '#22c55e',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.8rem'
                        }
                    }, '✅ Uploaded')
                ])
            )
        ])
    ]);
}

// Make DocumentPanel available globally
window.DocumentPanel = DocumentPanel;
