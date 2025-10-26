// src/DashboardRouter.jsx
// Browser-compatible React components (no ES6 imports)
const { useState, useEffect } = React;

// Individual Dashboard Components
function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [creditReports, setCreditReports] = useState([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        // Load admin dashboard data
        fetch('/api/admin/dashboard', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        })
        .then(res => res.json())
        .then(data => {
            setStats(data);
            setLoading(false);
        })
        .catch(err => {
            console.error('Failed to load admin data:', err);
            setLoading(false);
        });
        
        // Load credit assessment reports
        fetch('/api/admin/credit-reports', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        })
        .then(res => res.json())
        .then(data => {
            setCreditReports(data.reports || []);
        })
        .catch(err => {
            console.error('Failed to load credit reports:', err);
        });
    }, []);
    
    if (loading) {
        return (
            <div style={{
                padding: '2rem',
                textAlign: 'center',
                fontFamily: 'system-ui, Arial'
            }}>
                <h2>🔄 Loading Admin Dashboard...</h2>
            </div>
        );
    }
    
    return (
        <div style={{
            fontFamily: 'system-ui, Arial',
            background: '#f6f6f6',
            minHeight: '100vh',
            padding: '2rem'
        }}>
            <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                background: '#fff',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '2rem',
                    paddingBottom: '1rem',
                    borderBottom: '2px solid #e5e5e5'
                }}>
                    <h1 style={{ margin: 0, color: '#333' }}>👑 Admin Dashboard</h1>
                    <a href="/" style={{
                        background: '#667eea',
                        color: 'white',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontWeight: '600'
                    }}>← Back to Platform</a>
                </div>
                
                {stats && (
                    <div>
                        {/* Stats Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '1rem',
                            marginBottom: '2rem'
                        }}>
                            <div style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                padding: '1.5rem',
                                borderRadius: '12px',
                                textAlign: 'center'
                            }}>
                                <h3 style={{ margin: '0 0 0.5rem' }}>👥 Total Users</h3>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.stats.totalUsers}</div>
                            </div>
                            
                            <div style={{
                                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                color: 'white',
                                padding: '1.5rem',
                                borderRadius: '12px',
                                textAlign: 'center'
                            }}>
                                <h3 style={{ margin: '0 0 0.5rem' }}>📋 Contracts</h3>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.stats.totalContracts}</div>
                            </div>
                            
                            <div style={{
                                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                                color: 'white',
                                padding: '1.5rem',
                                borderRadius: '12px',
                                textAlign: 'center'
                            }}>
                                <h3 style={{ margin: '0 0 0.5rem' }}>💰 TGT Supply</h3>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.stats.totalTgtCirculation}</div>
                            </div>
                            
                            <div style={{
                                background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                                color: 'white',
                                padding: '1.5rem',
                                borderRadius: '12px',
                                textAlign: 'center'
                            }}>
                                <h3 style={{ margin: '0 0 0.5rem' }}>⚖️ Pending KYC</h3>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.stats.pendingKyc}</div>
                            </div>
                        </div>
                        
                        {/* Quick Actions */}
                        <div style={{
                            background: '#f8f9fa',
                            padding: '1.5rem',
                            borderRadius: '12px',
                            marginBottom: '2rem'
                        }}>
                            <h3 style={{ margin: '0 0 1rem', color: '#333' }}>🔧 Quick Actions</h3>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                                gap: '1rem'
                            }}>
                                <button style={{
                                    background: '#22c55e',
                                    color: 'white',
                                    border: 'none',
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                }} onClick={() => window.open('/api/admin/kyc-reports', '_blank')}>
                                    📊 View KYC Reports
                                </button>
                                
                                <button style={{
                                    background: '#f59e0b',
                                    color: 'white',
                                    border: 'none',
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                }} onClick={() => alert('Fee management coming soon')}>
                                    💳 Manage Fees
                                </button>
                                
                                <button style={{
                                    background: '#8b5cf6',
                                    color: 'white',
                                    border: 'none',
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                }} onClick={() => alert('User management coming soon')}>
                                    👤 Manage Users
                                </button>
                            </div>
                        </div>
                        
                        {/* Recent Activity */}
                        {stats.recentActivity && stats.recentActivity.length > 0 && (
                            <div style={{ marginTop: '2rem' }}>
                                <h3 style={{ color: '#333', marginBottom: '1rem' }}>📈 Recent Activity</h3>
                                <div style={{
                                    background: '#f8f9fa',
                                    borderRadius: '12px',
                                    overflow: 'hidden'
                                }}>
                                    {stats.recentActivity.slice(0, 5).map((activity, index) => (
                                        <div key={index} style={{
                                            padding: '1rem',
                                            borderBottom: index < 4 ? '1px solid #e5e5e5' : 'none',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: '600' }}>{activity.description}</div>
                                                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                                                    {new Date(activity.timestamp).toLocaleString()}
                                                </div>
                                            </div>
                                            <div style={{
                                                background: activity.type === 'contract' ? '#22c55e' : '#3b82f6',
                                                color: 'white',
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                fontSize: '0.8rem',
                                                fontWeight: '600'
                                            }}>
                                                {activity.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {/* Credit Assessment Reports */}
                        <div style={{ marginTop: '2rem' }}>
                            <h3 style={{ color: '#333', marginBottom: '1rem' }}>🔍 Credit Risk Assessments</h3>
                            {creditReports.length === 0 ? (
                                <div style={{
                                    background: '#f8f9fa',
                                    borderRadius: '12px',
                                    padding: '2rem',
                                    textAlign: 'center',
                                    color: '#666'
                                }}>
                                    No credit assessments available yet
                                </div>
                            ) : (
                                <div style={{
                                    background: '#f8f9fa',
                                    borderRadius: '12px',
                                    overflow: 'hidden'
                                }}>
                                    {creditReports.map((report, index) => (
                                        <div key={index} style={{
                                            padding: '1.5rem',
                                            borderBottom: index < creditReports.length - 1 ? '1px solid #e5e5e5' : 'none',
                                            background: 'white'
                                        }}>
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: '1rem'
                                            }}>
                                                <div>
                                                    <h4 style={{ margin: '0 0 0.5rem', color: '#333' }}>
                                                        {report.buyerName || 'Unknown Buyer'}
                                                    </h4>
                                                    <div style={{ fontSize: '0.9rem', color: '#666' }}>
                                                        Contract: {report.contractId}
                                                    </div>
                                                </div>
                                                <div style={{
                                                    background: report.decision === 'APPROVED' ? '#22c55e' : '#ef4444',
                                                    color: 'white',
                                                    padding: '6px 12px',
                                                    borderRadius: '8px',
                                                    fontWeight: '600'
                                                }}>
                                                    {report.decision}
                                                </div>
                                            </div>
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                                gap: '1rem'
                                            }}>
                                                <div>
                                                    <div style={{ color: '#666', fontSize: '0.9rem' }}>Amount</div>
                                                    <div style={{ fontWeight: '600' }}>${report.amount?.toLocaleString() || 'N/A'}</div>
                                                </div>
                                                <div>
                                                    <div style={{ color: '#666', fontSize: '0.9rem' }}>Risk Score</div>
                                                    <div style={{ fontWeight: '600' }}>
                                                        {(report.riskScore * 100).toFixed(2)}%
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ color: '#666', fontSize: '0.9rem' }}>Risk Band</div>
                                                    <div style={{ fontWeight: '600' }}>{report.riskBand || 'N/A'}</div>
                                                </div>
                                                <div>
                                                    <div style={{ color: '#666', fontSize: '0.9rem' }}>Protection Ratio</div>
                                                    <div style={{ fontWeight: '600' }}>
                                                        {report.assessmentDetails?.collateralAnalysis?.effective_protection_ratio 
                                                            ? (report.assessmentDetails.collateralAnalysis.effective_protection_ratio * 100).toFixed(1) + '%'
                                                            : 'N/A'}
                                                    </div>
                                                </div>
                                            </div>
                                            {report.assessmentDetails?.collateralAnalysis && (
                                                <details style={{ marginTop: '1rem' }}>
                                                    <summary style={{ cursor: 'pointer', color: '#667eea', fontWeight: '600' }}>
                                                        View Detailed Analysis
                                                    </summary>
                                                    <div style={{
                                                        marginTop: '1rem',
                                                        padding: '1rem',
                                                        background: '#f8f9fa',
                                                        borderRadius: '8px',
                                                        fontSize: '0.9rem'
                                                    }}>
                                                        <div style={{ marginBottom: '0.5rem' }}>
                                                            <strong>Inventory:</strong> ${report.assessmentDetails.collateralAnalysis.total_protection_value?.toFixed(2)} 
                                                            ({(report.assessmentDetails.collateralAnalysis.effective_protection_ratio * 100).toFixed(1)}% coverage)
                                                        </div>
                                                        <div style={{ marginBottom: '0.5rem' }}>
                                                            <strong>Risk Reduction:</strong> {(report.assessmentDetails.collateralAnalysis.risk_reduction * 100).toFixed(1)}%
                                                        </div>
                                                        <div>
                                                            <strong>LGD Adjustment:</strong> {(report.assessmentDetails.collateralAnalysis.lgd_adjustment * 100).toFixed(1)}%
                                                        </div>
                                                    </div>
                                                </details>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function BuyerDashboard() {
    return (
        <div style={{
            fontFamily: 'system-ui, Arial',
            background: '#f6f6f6',
            minHeight: '100vh',
            padding: '2rem'
        }}>
            <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                background: '#fff',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '2rem',
                    paddingBottom: '1rem',
                    borderBottom: '2px solid #e5e5e5'
                }}>
                    <h1 style={{ margin: 0, color: '#333' }}>🛒 Buyer Portal</h1>
                    <a href="/" style={{
                        background: '#667eea',
                        color: 'white',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontWeight: '600'
                    }}>← Back to Platform</a>
                </div>
                
                {/* Load React BuyerPanel Component */}
                <div id="buyer-panel-mount"></div>
                
                <script type="text/babel">
                    {`
                    // Mount BuyerPanel if available
                    if (window.BuyerPanel) {
                        const buyerRoot = ReactDOM.createRoot(document.getElementById('buyer-panel-mount'));
                        buyerRoot.render(React.createElement(window.BuyerPanel));
                    } else {
                        document.getElementById('buyer-panel-mount').innerHTML = '<p>Loading buyer interface...</p>';
                    }
                    `}
                </script>
            </div>
        </div>
    );
}

function SupplierDashboard() {
    return (
        <div style={{
            fontFamily: 'system-ui, Arial',
            background: '#f6f6f6',
            minHeight: '100vh',
            padding: '2rem'
        }}>
            <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                background: '#fff',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '2rem',
                    paddingBottom: '1rem',
                    borderBottom: '2px solid #e5e5e5'
                }}>
                    <h1 style={{ margin: 0, color: '#333' }}>🏭 Supplier Portal</h1>
                    <a href="/" style={{
                        background: '#667eea',
                        color: 'white',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontWeight: '600'
                    }}>← Back to Platform</a>
                </div>
                
                {/* Your Main React App with Supplier Role */}
                {window.App ? React.createElement(window.App, { initialRole: "Supplier" }) : 
                 React.createElement('div', {}, 'Loading Supplier Dashboard...')}
            </div>
        </div>
    );
}

function TraderDashboard() {
    return (
        <div style={{
            fontFamily: 'system-ui, Arial',
            background: '#f6f6f6',
            minHeight: '100vh',
            padding: '2rem'
        }}>
            <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                background: '#fff',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '2rem',
                    paddingBottom: '1rem',
                    borderBottom: '2px solid #e5e5e5'
                }}>
                    <h1 style={{ margin: 0, color: '#333' }}>📈 Trader Portal</h1>
                    <a href="/" style={{
                        background: '#667eea',
                        color: 'white',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontWeight: '600'
                    }}>← Back to Platform</a>
                </div>
                
                {/* Your Main React App with Trader Role */}
                {window.App ? React.createElement(window.App, { initialRole: "Trader" }) : 
                 React.createElement('div', {}, 'Loading Trader Dashboard...')}
            </div>
        </div>
    );
}

function InsurerDashboard() {
    return (
        <div style={{
            fontFamily: 'system-ui, Arial',
            background: '#f6f6f6',
            minHeight: '100vh',
            padding: '2rem'
        }}>
            <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                background: '#fff',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '2rem',
                    paddingBottom: '1rem',
                    borderBottom: '2px solid #e5e5e5'
                }}>
                    <h1 style={{ margin: 0, color: '#333' }}>🛡️ Insurer Portal</h1>
                    <a href="/" style={{
                        background: '#667eea',
                        color: 'white',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontWeight: '600'
                    }}>← Back to Platform</a>
                </div>
                
                <div style={{
                    background: '#f8f9fa',
                    padding: '2rem',
                    borderRadius: '12px',
                    textAlign: 'center'
                }}>
                    <h2 style={{ color: '#333', marginBottom: '1rem' }}>🔐 Insurance Dashboard</h2>
                    <p style={{ color: '#666', marginBottom: '2rem' }}>
                        Monitor contract risks, create insurance policies, and manage coverage portfolios.
                    </p>
                    
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: '1rem',
                        marginTop: '2rem'
                    }}>
                        <div style={{
                            background: '#e0f2fe',
                            padding: '1.5rem',
                            borderRadius: '8px',
                            border: '1px solid #0ea5e9'
                        }}>
                            <h3 style={{ margin: '0 0 1rem', color: '#0c4a6e' }}>🔍 Active Opportunities</h3>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0ea5e9' }}>12</div>
                            <button style={{
                                background: '#0ea5e9',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                marginTop: '1rem'
                            }} onClick={() => window.open('/api/insurer/opportunities', '_blank')}>
                                View Opportunities
                            </button>
                        </div>
                        
                        <div style={{
                            background: '#ecfdf5',
                            padding: '1.5rem',
                            borderRadius: '8px',
                            border: '1px solid #22c55e'
                        }}>
                            <h3 style={{ margin: '0 0 1rem', color: '#14532d' }}>📋 Active Policies</h3>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22c55e' }}>8</div>
                            <button style={{
                                background: '#22c55e',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                marginTop: '1rem'
                            }} onClick={() => alert('Policy management coming soon')}>
                                Manage Policies
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Main Dashboard Router
function DashboardRouter() {
    const path = window.location.pathname;
    
    if (path === '/dashboard/admin') {
        return React.createElement(AdminDashboard);
    }
    if (path === '/dashboard/buyer') {
        return React.createElement(BuyerDashboard);
    }
    if (path === '/dashboard/supplier') {
        return React.createElement(SupplierDashboard);
    }
    if (path === '/dashboard/trader') {
        return React.createElement(TraderDashboard);
    }
    if (path === '/dashboard/insurer') {
        return React.createElement(InsurerDashboard);
    }
    
    // Default to main app
    return window.App ? React.createElement(window.App) : 
           React.createElement('div', { style: { padding: '2rem', textAlign: 'center' }}, 
               React.createElement('h2', {}, '🔄 Loading Platform...'));
}

// Make DashboardRouter available globally
window.DashboardRouter = DashboardRouter;
