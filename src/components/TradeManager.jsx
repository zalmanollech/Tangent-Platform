// src/components/TradeManager.jsx
// Browser-compatible React component
const { useState, useEffect } = React;

function TradeManager({ userRole }) {
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newContract, setNewContract] = useState({
        supplierEmail: '',
        productDetails: '',
        quantity: '',
        pricePerUnit: '',
        deliveryDate: ''
    });

    useEffect(() => {
        loadContracts();
    }, []);

    const loadContracts = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.log('No auth token found');
                setLoading(false);
                return;
            }

            const response = await fetch('/api/contracts', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                setContracts(data.contracts || []);
            }
        } catch (error) {
            console.error('Failed to load contracts:', error);
        } finally {
            setLoading(false);
        }
    };

    const createContract = async () => {
        if (!newContract.supplierEmail || !newContract.productDetails) {
            alert('Please fill in required fields');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/contracts/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...newContract,
                    totalValue: parseFloat(newContract.quantity) * parseFloat(newContract.pricePerUnit)
                })
            });

            if (response.ok) {
                setNewContract({
                    supplierEmail: '',
                    productDetails: '',
                    quantity: '',
                    pricePerUnit: '',
                    deliveryDate: ''
                });
                loadContracts();
                alert('Contract created successfully!');
            } else {
                const error = await response.json();
                alert(`Failed to create contract: ${error.error}`);
            }
        } catch (error) {
            console.error('Contract creation failed:', error);
            alert('Failed to create contract');
        } finally {
            setLoading(false);
        }
    };

    return React.createElement('div', {
        style: {
            background: 'white',
            border: '1px solid #e5e5e5',
            borderRadius: '16px',
            padding: '2rem',
            margin: '1rem 0'
        }
    }, [
        React.createElement('h2', {
            key: 'title',
            style: { margin: '0 0 1.5rem', color: '#333' }
        }, `📈 ${userRole} Trade Manager`),

        // Create new contract (for buyers)
        userRole === 'Buyer' && React.createElement('div', {
            key: 'create-contract',
            style: {
                background: '#f8f9fa',
                padding: '1.5rem',
                borderRadius: '12px',
                marginBottom: '2rem'
            }
        }, [
            React.createElement('h3', {
                key: 'create-title',
                style: { margin: '0 0 1rem', color: '#333' }
            }, '➕ Create New Contract'),
            
            React.createElement('div', {
                key: 'form',
                style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1rem'
                }
            }, [
                React.createElement('input', {
                    key: 'supplier-email',
                    type: 'email',
                    placeholder: 'Supplier Email',
                    value: newContract.supplierEmail,
                    onChange: (e) => setNewContract({...newContract, supplierEmail: e.target.value}),
                    style: {
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '1rem'
                    }
                }),
                React.createElement('input', {
                    key: 'product',
                    type: 'text',
                    placeholder: 'Product Details',
                    value: newContract.productDetails,
                    onChange: (e) => setNewContract({...newContract, productDetails: e.target.value}),
                    style: {
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '1rem'
                    }
                }),
                React.createElement('input', {
                    key: 'quantity',
                    type: 'number',
                    placeholder: 'Quantity',
                    value: newContract.quantity,
                    onChange: (e) => setNewContract({...newContract, quantity: e.target.value}),
                    style: {
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '1rem'
                    }
                }),
                React.createElement('input', {
                    key: 'price',
                    type: 'number',
                    step: '0.01',
                    placeholder: 'Price per Unit',
                    value: newContract.pricePerUnit,
                    onChange: (e) => setNewContract({...newContract, pricePerUnit: e.target.value}),
                    style: {
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '1rem'
                    }
                }),
                React.createElement('input', {
                    key: 'delivery-date',
                    type: 'date',
                    value: newContract.deliveryDate,
                    onChange: (e) => setNewContract({...newContract, deliveryDate: e.target.value}),
                    style: {
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '1rem'
                    }
                })
            ]),
            
            React.createElement('button', {
                key: 'create-btn',
                onClick: createContract,
                disabled: loading,
                style: {
                    background: loading ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer'
                }
            }, loading ? '⏳ Creating...' : '✅ Create Contract')
        ]),

        // Contracts list
        React.createElement('div', {
            key: 'contracts-section'
        }, [
            React.createElement('h3', {
                key: 'contracts-title',
                style: { margin: '0 0 1rem', color: '#333' }
            }, '📋 Your Contracts'),
            
            loading && React.createElement('div', {
                key: 'loading',
                style: { textAlign: 'center', padding: '2rem', color: '#666' }
            }, '🔄 Loading contracts...'),
            
            !loading && contracts.length === 0 && React.createElement('div', {
                key: 'no-contracts',
                style: {
                    textAlign: 'center',
                    padding: '2rem',
                    color: '#666',
                    background: '#f8f9fa',
                    borderRadius: '8px'
                }
            }, '📝 No contracts found. Create your first contract above!'),
            
            !loading && contracts.length > 0 && React.createElement('div', {
                key: 'contracts-grid',
                style: {
                    display: 'grid',
                    gap: '1rem'
                }
            }, contracts.map(contract => 
                React.createElement('div', {
                    key: contract.id,
                    style: {
                        background: '#f0f9ff',
                        border: '1px solid #bae6fd',
                        borderRadius: '8px',
                        padding: '1rem'
                    }
                }, [
                    React.createElement('div', {
                        key: 'header',
                        style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.5rem'
                        }
                    }, [
                        React.createElement('strong', {
                            key: 'product',
                            style: { color: '#0c4a6e' }
                        }, contract.productDetails),
                        React.createElement('span', {
                            key: 'status',
                            style: {
                                background: contract.status === 'completed' ? '#22c55e' : '#f59e0b',
                                color: 'white',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.8rem'
                            }
                        }, contract.status)
                    ]),
                    React.createElement('div', {
                        key: 'details',
                        style: { color: '#075985', fontSize: '0.9rem' }
                    }, [
                        React.createElement('div', { key: 'value' }, `💰 Value: $${contract.totalValue}`),
                        React.createElement('div', { key: 'role' }, `👤 Role: ${contract.userRole}`),
                        React.createElement('div', { key: 'created' }, `📅 Created: ${new Date(contract.createdAt).toLocaleDateString()}`)
                    ])
                ])
            ))
        ])
    ]);
}

// Make TradeManager available globally
window.TradeManager = TradeManager;