import React, { useState, useEffect } from 'react';

const WalletSetupGuide = ({ onWalletSetupComplete, skipSetup }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [walletType, setWalletType] = useState('metamask');
  const [userProgress, setUserProgress] = useState({
    walletDownloaded: false,
    walletCreated: false,
    backupSaved: false,
    testTransactionDone: false
  });

  const steps = [
    {
      id: 1,
      title: "Choose Your Wallet",
      description: "Select a cryptocurrency wallet that suits your needs"
    },
    {
      id: 2,
      title: "Download & Install",
      description: "Download and install your chosen wallet"
    },
    {
      id: 3,
      title: "Create Your Wallet",
      description: "Set up your new wallet with a secure password"
    },
    {
      id: 4,
      title: "Backup Your Wallet",
      description: "Save your recovery phrase safely"
    },
    {
      id: 5,
      title: "Fund Your Wallet",
      description: "Learn how to add cryptocurrency to your wallet"
    },
    {
      id: 6,
      title: "Practice & Complete",
      description: "Make a test transaction and complete setup"
    }
  ];

  const walletOptions = [
    {
      id: 'metamask',
      name: 'MetaMask',
      description: 'Most popular browser extension wallet',
      pros: ['Easy to use', 'Wide compatibility', 'Built-in browser'],
      cons: ['Browser dependent', 'Hot wallet (less secure for large amounts)'],
      downloadUrl: 'https://metamask.io/',
      difficulty: 'Beginner'
    },
    {
      id: 'trust',
      name: 'Trust Wallet',
      description: 'Mobile-first wallet with built-in DApp browser',
      pros: ['Mobile friendly', 'Multi-chain support', 'Built-in DeFi access'],
      cons: ['Mobile only', 'Requires smartphone'],
      downloadUrl: 'https://trustwallet.com/',
      difficulty: 'Beginner'
    },
    {
      id: 'coinbase',
      name: 'Coinbase Wallet',
      description: 'User-friendly wallet from Coinbase exchange',
      pros: ['Very beginner friendly', 'Great customer support', 'Insurance protection'],
      cons: ['Less decentralized', 'Limited DeFi features'],
      downloadUrl: 'https://wallet.coinbase.com/',
      difficulty: 'Beginner'
    },
    {
      id: 'hardware',
      name: 'Hardware Wallet',
      description: 'Physical device for maximum security',
      pros: ['Highest security', 'Offline storage', 'Supports many coins'],
      cons: ['Costs money', 'More complex setup', 'Physical device required'],
      downloadUrl: 'https://shop.ledger.com/',
      difficulty: 'Intermediate'
    }
  ];

  const fundingMethods = [
    {
      method: 'Buy Directly in Wallet',
      description: 'Purchase crypto directly within your wallet app',
      pros: ['Convenient', 'Integrated experience'],
      cons: ['Higher fees', 'Limited payment methods'],
      steps: [
        'Open your wallet app',
        'Look for "Buy" or "Purchase" button',
        'Select the cryptocurrency (ETH recommended)',
        'Choose payment method (card/bank)',
        'Complete the purchase'
      ]
    },
    {
      method: 'Cryptocurrency Exchange',
      description: 'Buy crypto on an exchange and transfer to your wallet',
      pros: ['Lower fees', 'More options', 'Better rates'],
      cons: ['Extra steps', 'Need to create exchange account'],
      steps: [
        'Create account on reputable exchange (Coinbase, Binance, Kraken)',
        'Complete identity verification',
        'Add payment method',
        'Buy cryptocurrency',
        'Transfer to your wallet address'
      ]
    },
    {
      method: 'Peer-to-Peer (P2P)',
      description: 'Buy directly from other people',
      pros: ['Often better rates', 'More privacy', 'Various payment methods'],
      cons: ['Higher risk', 'More complex', 'Need experience'],
      steps: [
        'Use P2P platforms (LocalBitcoins, Paxful)',
        'Find reputable seller',
        'Agree on terms',
        'Complete payment',
        'Receive crypto in your wallet'
      ]
    }
  ];

  const securityTips = [
    {
      title: "Never Share Your Private Keys",
      description: "Your private keys or seed phrase should never be shared with anyone, including support staff.",
      icon: "🔒"
    },
    {
      title: "Use Strong Passwords",
      description: "Create a unique, strong password for your wallet that you don't use anywhere else.",
      icon: "💪"
    },
    {
      title: "Enable Two-Factor Authentication",
      description: "When available, always enable 2FA for additional security.",
      icon: "🛡️"
    },
    {
      title: "Keep Software Updated",
      description: "Always use the latest version of your wallet software for security patches.",
      icon: "🔄"
    },
    {
      title: "Start Small",
      description: "Begin with small amounts until you're comfortable with the technology.",
      icon: "🐣"
    },
    {
      title: "Backup Everything",
      description: "Store your recovery phrase in multiple secure locations (never digitally).",
      icon: "💾"
    }
  ];

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const markProgress = (key) => {
    setUserProgress(prev => ({
      ...prev,
      [key]: true
    }));
  };

  const handleWalletSetupComplete = () => {
    localStorage.setItem('walletSetupCompleted', 'true');
    localStorage.setItem('preferredWallet', walletType);
    onWalletSetupComplete({
      walletType,
      setupCompleted: true,
      progress: userProgress
    });
  };

  const selectedWallet = walletOptions.find(w => w.id === walletType);

  return (
    <div className="wallet-setup-guide">
      <style jsx>{`
        .wallet-setup-guide {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .header {
          text-align: center;
          margin-bottom: 30px;
        }

        .title {
          font-size: 28px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 10px;
        }

        .subtitle {
          font-size: 16px;
          color: #6b7280;
          margin-bottom: 20px;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          margin-bottom: 30px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #10b981);
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .step-indicator {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
        }

        .step-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          flex: 1;
        }

        .step-number {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          margin-bottom: 8px;
          transition: all 0.3s ease;
        }

        .step-number.active {
          background: #3b82f6;
          color: white;
        }

        .step-number.completed {
          background: #10b981;
          color: white;
        }

        .step-number.inactive {
          background: #e5e7eb;
          color: #9ca3af;
        }

        .step-title {
          font-size: 12px;
          color: #6b7280;
        }

        .step-content {
          background: #f9fafb;
          border-radius: 8px;
          padding: 30px;
          margin-bottom: 30px;
        }

        .step-header {
          margin-bottom: 20px;
        }

        .step-name {
          font-size: 24px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 8px;
        }

        .step-description {
          font-size: 16px;
          color: #6b7280;
        }

        .wallet-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 20px;
        }

        .wallet-option {
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .wallet-option:hover {
          border-color: #3b82f6;
        }

        .wallet-option.selected {
          border-color: #3b82f6;
          background: #eff6ff;
        }

        .wallet-name {
          font-size: 18px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 8px;
        }

        .wallet-description {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 15px;
        }

        .wallet-difficulty {
          display: inline-block;
          padding: 4px 12px;
          background: #f3f4f6;
          color: #374151;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          margin-bottom: 10px;
        }

        .pros-cons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-top: 15px;
        }

        .pros, .cons {
          font-size: 12px;
        }

        .pros h4, .cons h4 {
          margin-bottom: 8px;
          font-weight: 600;
        }

        .pros h4 {
          color: #059669;
        }

        .cons h4 {
          color: #dc2626;
        }

        .pros ul, .cons ul {
          margin: 0;
          padding-left: 15px;
        }

        .pros li {
          color: #065f46;
        }

        .cons li {
          color: #991b1b;
        }

        .download-section {
          background: #ecfdf5;
          border: 1px solid #10b981;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .download-title {
          font-size: 18px;
          font-weight: bold;
          color: #065f46;
          margin-bottom: 10px;
        }

        .download-link {
          display: inline-block;
          background: #10b981;
          color: white;
          padding: 12px 24px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 500;
          margin-top: 10px;
        }

        .download-link:hover {
          background: #059669;
        }

        .funding-methods {
          margin-bottom: 20px;
        }

        .funding-method {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 15px;
        }

        .method-name {
          font-size: 18px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 8px;
        }

        .method-description {
          color: #6b7280;
          margin-bottom: 15px;
        }

        .method-steps {
          background: #f9fafb;
          padding: 15px;
          border-radius: 6px;
          margin-top: 15px;
        }

        .method-steps h4 {
          margin-bottom: 10px;
          color: #374151;
        }

        .method-steps ol {
          margin: 0;
          padding-left: 20px;
        }

        .method-steps li {
          margin-bottom: 5px;
          color: #4b5563;
        }

        .security-tips {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }

        .security-tip {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 15px;
        }

        .tip-header {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }

        .tip-icon {
          font-size: 20px;
          margin-right: 8px;
        }

        .tip-title {
          font-weight: bold;
          color: #92400e;
        }

        .tip-description {
          color: #92400e;
          font-size: 14px;
        }

        .progress-checklist {
          background: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .checklist-title {
          font-size: 18px;
          font-weight: bold;
          color: #0c4a6e;
          margin-bottom: 15px;
        }

        .checklist-item {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
        }

        .checklist-checkbox {
          width: 20px;
          height: 20px;
          margin-right: 10px;
        }

        .checklist-label {
          color: #0c4a6e;
          cursor: pointer;
        }

        .navigation {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 30px;
        }

        .btn {
          padding: 12px 24px;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
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

        .btn-success {
          background: #10b981;
          color: white;
        }

        .btn-success:hover {
          background: #059669;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .skip-option {
          text-align: center;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }

        .skip-link {
          color: #6b7280;
          text-decoration: underline;
          cursor: pointer;
        }

        .skip-link:hover {
          color: #374151;
        }
      `}</style>

      <div className="header">
        <h1 className="title">🚀 Crypto Wallet Setup Guide</h1>
        <p className="subtitle">
          Let's get you set up with your first cryptocurrency wallet! 
          This guide will walk you through everything step by step.
        </p>
        
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="step-indicator">
        {steps.map((step) => (
          <div key={step.id} className="step-item">
            <div className={`step-number ${
              step.id === currentStep ? 'active' : 
              step.id < currentStep ? 'completed' : 'inactive'
            }`}>
              {step.id < currentStep ? '✓' : step.id}
            </div>
            <div className="step-title">{step.title}</div>
          </div>
        ))}
      </div>

      <div className="step-content">
        <div className="step-header">
          <h2 className="step-name">{steps[currentStep - 1].title}</h2>
          <p className="step-description">{steps[currentStep - 1].description}</p>
        </div>

        {/* Step 1: Choose Your Wallet */}
        {currentStep === 1 && (
          <div>
            <div className="wallet-options">
              {walletOptions.map((wallet) => (
                <div
                  key={wallet.id}
                  className={`wallet-option ${walletType === wallet.id ? 'selected' : ''}`}
                  onClick={() => setWalletType(wallet.id)}
                >
                  <div className="wallet-name">{wallet.name}</div>
                  <div className="wallet-difficulty">{wallet.difficulty}</div>
                  <div className="wallet-description">{wallet.description}</div>
                  
                  <div className="pros-cons">
                    <div className="pros">
                      <h4>✅ Pros:</h4>
                      <ul>
                        {wallet.pros.map((pro, index) => (
                          <li key={index}>{pro}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="cons">
                      <h4>❌ Cons:</h4>
                      <ul>
                        {wallet.cons.map((con, index) => (
                          <li key={index}>{con}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Download & Install */}
        {currentStep === 2 && selectedWallet && (
          <div>
            <div className="download-section">
              <div className="download-title">
                📥 Download {selectedWallet.name}
              </div>
              <p>Click the button below to download {selectedWallet.name} from the official website:</p>
              <a 
                href={selectedWallet.downloadUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="download-link"
              >
                Download {selectedWallet.name}
              </a>
              <p style={{ marginTop: '15px', fontSize: '14px', color: '#6b7280' }}>
                ⚠️ Always download wallets from official websites to avoid scams!
              </p>
            </div>

            <div className="progress-checklist">
              <div className="checklist-title">Progress Checklist:</div>
              <div className="checklist-item">
                <input 
                  type="checkbox" 
                  className="checklist-checkbox"
                  checked={userProgress.walletDownloaded}
                  onChange={() => markProgress('walletDownloaded')}
                />
                <label className="checklist-label">
                  I have downloaded and installed {selectedWallet.name}
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Create Your Wallet */}
        {currentStep === 3 && (
          <div>
            <div style={{ background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ color: '#065f46', marginBottom: '15px' }}>🔐 Creating Your Wallet</h3>
              <p style={{ color: '#065f46', marginBottom: '10px' }}>Follow these steps to create your new wallet:</p>
              <ol style={{ color: '#065f46', paddingLeft: '20px' }}>
                <li>Open the {selectedWallet.name} app</li>
                <li>Click "Create a new wallet" or "Get started"</li>
                <li>Create a strong, unique password</li>
                <li>Write down your password in a safe place</li>
                <li>Agree to the terms of service</li>
                <li>Complete the wallet creation process</li>
              </ol>
            </div>

            <div className="security-tips">
              <div className="security-tip">
                <div className="tip-header">
                  <span className="tip-icon">🔒</span>
                  <span className="tip-title">Password Security</span>
                </div>
                <div className="tip-description">
                  Use a unique password that you don't use anywhere else. 
                  Consider using a password manager.
                </div>
              </div>
              <div className="security-tip">
                <div className="tip-header">
                  <span className="tip-icon">📝</span>
                  <span className="tip-title">Write It Down</span>
                </div>
                <div className="tip-description">
                  Write your password on paper and store it safely. 
                  Don't save it digitally.
                </div>
              </div>
            </div>

            <div className="progress-checklist">
              <div className="checklist-title">Progress Checklist:</div>
              <div className="checklist-item">
                <input 
                  type="checkbox" 
                  className="checklist-checkbox"
                  checked={userProgress.walletCreated}
                  onChange={() => markProgress('walletCreated')}
                />
                <label className="checklist-label">
                  I have successfully created my wallet
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Backup Your Wallet */}
        {currentStep === 4 && (
          <div>
            <div style={{ background: '#fef2f2', border: '1px solid #ef4444', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ color: '#dc2626', marginBottom: '15px' }}>🚨 CRITICAL: Backup Your Recovery Phrase</h3>
              <p style={{ color: '#dc2626', marginBottom: '10px' }}>
                Your wallet will show you a 12-24 word recovery phrase. This is EXTREMELY IMPORTANT:
              </p>
              <ul style={{ color: '#dc2626', paddingLeft: '20px' }}>
                <li>Write down ALL words in the EXACT order shown</li>
                <li>Check your writing twice for accuracy</li>
                <li>Store the paper in a safe, secure location</li>
                <li>NEVER share this phrase with anyone</li>
                <li>NEVER take a photo or save it digitally</li>
              </ul>
            </div>

            <div className="security-tips">
              {securityTips.slice(0, 4).map((tip, index) => (
                <div key={index} className="security-tip">
                  <div className="tip-header">
                    <span className="tip-icon">{tip.icon}</span>
                    <span className="tip-title">{tip.title}</span>
                  </div>
                  <div className="tip-description">{tip.description}</div>
                </div>
              ))}
            </div>

            <div className="progress-checklist">
              <div className="checklist-title">Progress Checklist:</div>
              <div className="checklist-item">
                <input 
                  type="checkbox" 
                  className="checklist-checkbox"
                  checked={userProgress.backupSaved}
                  onChange={() => markProgress('backupSaved')}
                />
                <label className="checklist-label">
                  I have safely written down and stored my recovery phrase
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Fund Your Wallet */}
        {currentStep === 5 && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ color: '#1f2937', marginBottom: '15px' }}>💰 How to Add Cryptocurrency to Your Wallet</h3>
              <p style={{ color: '#6b7280', marginBottom: '20px' }}>
                Choose the method that works best for you:
              </p>
            </div>

            <div className="funding-methods">
              {fundingMethods.map((method, index) => (
                <div key={index} className="funding-method">
                  <div className="method-name">{method.method}</div>
                  <div className="method-description">{method.description}</div>
                  
                  <div className="pros-cons">
                    <div className="pros">
                      <h4>✅ Pros:</h4>
                      <ul>
                        {method.pros.map((pro, idx) => (
                          <li key={idx}>{pro}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="cons">
                      <h4>❌ Cons:</h4>
                      <ul>
                        {method.cons.map((con, idx) => (
                          <li key={idx}>{con}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="method-steps">
                    <h4>📋 Steps:</h4>
                    <ol>
                      {method.steps.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: '#f0f9ff', border: '1px solid #0ea5e9', borderRadius: '8px', padding: '20px' }}>
              <h4 style={{ color: '#0c4a6e', marginBottom: '10px' }}>💡 Beginner Tip</h4>
              <p style={{ color: '#0c4a6e', marginBottom: '10px' }}>
                We recommend starting with buying directly in your wallet app for your first purchase. 
                It's the easiest method for beginners!
              </p>
              <p style={{ color: '#0c4a6e' }}>
                <strong>Recommended first purchase:</strong> $10-50 worth of Ethereum (ETH) to practice with.
              </p>
            </div>
          </div>
        )}

        {/* Step 6: Practice & Complete */}
        {currentStep === 6 && (
          <div>
            <div style={{ background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ color: '#065f46', marginBottom: '15px' }}>🎉 Almost Done!</h3>
              <p style={{ color: '#065f46', marginBottom: '15px' }}>
                Before you're ready to use the Tangent platform, let's make sure everything is working:
              </p>
              <ol style={{ color: '#065f46', paddingLeft: '20px' }}>
                <li>Make sure you have some cryptocurrency in your wallet</li>
                <li>Try connecting your wallet to the Tangent platform</li>
                <li>Test viewing your balance and transaction history</li>
                <li>Read our platform guide for trading</li>
              </ol>
            </div>

            <div className="security-tips">
              {securityTips.slice(4).map((tip, index) => (
                <div key={index} className="security-tip">
                  <div className="tip-header">
                    <span className="tip-icon">{tip.icon}</span>
                    <span className="tip-title">{tip.title}</span>
                  </div>
                  <div className="tip-description">{tip.description}</div>
                </div>
              ))}
            </div>

            <div className="progress-checklist">
              <div className="checklist-title">Final Checklist:</div>
              <div className="checklist-item">
                <input 
                  type="checkbox" 
                  className="checklist-checkbox"
                  checked={userProgress.testTransactionDone}
                  onChange={() => markProgress('testTransactionDone')}
                />
                <label className="checklist-label">
                  I have connected my wallet and I'm ready to start trading
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="navigation">
        <button 
          className="btn btn-secondary"
          onClick={prevStep}
          disabled={currentStep === 1}
        >
          ← Previous
        </button>

        <div>
          {currentStep < steps.length ? (
            <button 
              className="btn btn-primary"
              onClick={nextStep}
            >
              Next →
            </button>
          ) : (
            <button 
              className="btn btn-success"
              onClick={handleWalletSetupComplete}
              disabled={!userProgress.testTransactionDone}
            >
              Complete Setup ✅
            </button>
          )}
        </div>
      </div>

      {skipSetup && (
        <div className="skip-option">
          <span 
            className="skip-link"
            onClick={() => skipSetup()}
          >
            Skip wallet setup (I'll do this later)
          </span>
        </div>
      )}
    </div>
  );
};

export default WalletSetupGuide;
