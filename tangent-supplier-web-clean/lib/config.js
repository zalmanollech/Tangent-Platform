try {
  require('dotenv').config();
} catch (e) {
  console.log('dotenv not found, using environment variables directly');
}

// Environment validation
const requiredEnvVars = {
  development: [],
  production: ['JWT_SECRET']
};

const NODE_ENV = process.env.NODE_ENV || 'development';

// Validate required environment variables
const validateEnvironment = () => {
  const required = requiredEnvVars[NODE_ENV] || [];
  const missing = required.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.error(`Missing required environment variables for ${NODE_ENV}:`, missing);
    process.exit(1);
  }
};

// Configuration object
const config = {
  // Environment
  NODE_ENV,
  isDevelopment: NODE_ENV === 'development',
  isProduction: NODE_ENV === 'production',
  isTest: NODE_ENV === 'test',

  // Server configuration
  server: {
    port: parseInt(process.env.PORT) || 4000,
    host: process.env.HOST || (NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'),
    corsOrigins: process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : NODE_ENV === 'production' 
        ? ['https://*.railway.app', 'https://*.up.railway.app'] 
        : ['http://localhost:3000', 'http://localhost:4000']
  },

  // Database configuration
  database: {
    type: process.env.DATABASE_URL ? 'postgres' : (process.env.DB_TYPE || 'json'),
    url: process.env.DATABASE_URL || '',
    path: process.env.DB_PATH || './data.json',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 10,
    ssl: process.env.DATABASE_URL ? true : (process.env.DB_SSL === 'true')
  },

  // Security configuration
  security: {
    jwtSecret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
    jwtExpiry: process.env.JWT_EXPIRY || '24h',
    sessionSecret: process.env.SESSION_SECRET || 'fallback-session-secret',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    adminKey: process.env.ADMIN_KEY || 'demo-admin-key-123'
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },

  // Blockchain configuration
  blockchain: {
    sepoliaRpcUrl: process.env.SEPOLIA_RPC_URL || '',
    mainnetRpcUrl: process.env.MAINNET_RPC_URL || '',
    escrowAddress: process.env.ESCROW_ADDRESS || '',
    tgtAddress: process.env.TGT_ADDRESS || '',
    privateKey: process.env.PRIVATE_KEY || '',
    gasLimit: parseInt(process.env.GAS_LIMIT) || 500000,
    gasPrice: process.env.GAS_PRICE || '20000000000' // 20 gwei
  },

  // External services
  services: {
    // AI/ML Services
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4'
    },
    googleVision: {
      apiKey: process.env.GOOGLE_VISION_API_KEY || '',
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || ''
    },
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      region: process.env.AWS_REGION || 'us-east-1',
      s3Bucket: process.env.AWS_S3_BUCKET || ''
    },

    // Compliance services
    compliance: {
      refinitiv: {
        apiKey: process.env.REFINITIV_API_KEY || '',
        baseUrl: process.env.REFINITIV_BASE_URL || 'https://api.refinitiv.com'
      },
      dowjones: {
        apiKey: process.env.DOWJONES_API_KEY || '',
        baseUrl: process.env.DOWJONES_BASE_URL || 'https://api.dowjones.com'
      },
      complyAdvantage: {
        apiKey: process.env.COMPLYADVANTAGE_API_KEY || '',
        baseUrl: process.env.COMPLYADVANTAGE_BASE_URL || 'https://api.complyadvantage.com'
      }
    },

    // Email service
    email: {
      smtp: {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      },
      from: process.env.FROM_EMAIL || 'noreply@tangentplatform.com'
    },

    // Payment services
    payments: {
      stripe: {
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        secretKey: process.env.STRIPE_SECRET_KEY || '',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || ''
      },
      paypal: {
        clientId: process.env.PAYPAL_CLIENT_ID || '',
        clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
        environment: process.env.PAYPAL_ENVIRONMENT || 'sandbox'
      }
    }
  },

  // File storage
  storage: {
    type: process.env.STORAGE_TYPE || 'local',
    local: {
      uploadPath: process.env.UPLOAD_PATH || './uploads',
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
      allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,jpg,jpeg,png').split(',')
    },
    s3: {
      bucket: process.env.AWS_S3_BUCKET || '',
      region: process.env.AWS_S3_REGION || 'us-east-1',
      publicRead: process.env.S3_PUBLIC_READ === 'true'
    }
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_TO_FILE !== 'false',
    maxFileSize: process.env.LOG_MAX_FILE_SIZE || '10m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
  },

  // Monitoring
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN || '',
    enableMetrics: process.env.ENABLE_METRICS === 'true'
  },

  // Redis configuration (for sessions)
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: parseInt(process.env.REDIS_TTL) || 86400 // 24 hours
  },

  // Platform settings
  platform: {
    name: 'Tangent Platform',
    version: '1.0.0',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@tangentplatform.com',
    features: {
      kycEnabled: process.env.KYC_ENABLED !== 'false',
      blockchainEnabled: Boolean(process.env.SEPOLIA_RPC_URL || process.env.MAINNET_RPC_URL),
      insuranceEnabled: process.env.INSURANCE_ENABLED === 'true',
      auctionsEnabled: process.env.AUCTIONS_ENABLED === 'true',
      complianceEnabled: Boolean(process.env.REFINITIV_API_KEY || process.env.DOWJONES_API_KEY),
      aiDocumentsEnabled: Boolean(process.env.OPENAI_API_KEY || process.env.GOOGLE_VISION_API_KEY)
    }
  },

  // Default settings
  defaults: {
    feePercent: parseFloat(process.env.DEFAULT_FEE_PERCENT) || 0.75,
    insurancePremiumPercent: parseFloat(process.env.DEFAULT_INSURANCE_PREMIUM) || 1.25,
    depositPercentageMin: parseInt(process.env.MIN_DEPOSIT_PERCENT) || 10,
    depositPercentageMax: parseInt(process.env.MAX_DEPOSIT_PERCENT) || 50,
    tradeExpiryDays: parseInt(process.env.DEFAULT_TRADE_EXPIRY_DAYS) || 14,
    paymentGraceDays: parseInt(process.env.PAYMENT_GRACE_DAYS) || 7
  }
};

// Configuration validation
const validateConfig = () => {
  const errors = [];

  // Validate server port
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push('Invalid server port');
  }

  // Validate JWT secret in production (but allow Railway deployment)
  if (config.isProduction && config.security.jwtSecret === 'fallback-secret-change-in-production' && !process.env.RAILWAY_ENVIRONMENT) {
    errors.push('JWT_SECRET must be set in production');
  }

  // Validate bcrypt rounds
  if (config.security.bcryptRounds < 10 || config.security.bcryptRounds > 15) {
    errors.push('BCRYPT_ROUNDS should be between 10 and 15');
  }

  // Validate blockchain addresses if provided
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (config.blockchain.escrowAddress && !ethAddressRegex.test(config.blockchain.escrowAddress)) {
    errors.push('Invalid ESCROW_ADDRESS format');
  }
  if (config.blockchain.tgtAddress && !ethAddressRegex.test(config.blockchain.tgtAddress)) {
    errors.push('Invalid TGT_ADDRESS format');
  }

  // Validate email configuration if enabled
  if (config.services.email.smtp.host && !config.services.email.smtp.user) {
    errors.push('SMTP_USER required when SMTP_HOST is set');
  }

  if (errors.length > 0) {
    console.error('Configuration validation errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    
    if (config.isProduction) {
      process.exit(1);
    } else {
      console.warn('Continuing with invalid configuration (development mode)');
    }
  }
};

// Helper functions
const configUtils = {
  // Check if a feature is enabled
  isFeatureEnabled: (feature) => {
    return config.platform.features[feature] === true;
  },

  // Get service configuration
  getServiceConfig: (service) => {
    return config.services[service] || {};
  },

  // Check if in production
  isProduction: () => config.isProduction,

  // Check if in development
  isDevelopment: () => config.isDevelopment,

  // Get database configuration
  getDatabaseConfig: () => config.database,

  // Get blockchain configuration
  getBlockchainConfig: () => config.blockchain,

  // Get complete configuration (for debugging)
  getFullConfig: () => {
    // Return config but hide sensitive values in production
    if (config.isProduction) {
      const safeConfig = JSON.parse(JSON.stringify(config));
      safeConfig.security.jwtSecret = '[HIDDEN]';
      safeConfig.security.sessionSecret = '[HIDDEN]';
      safeConfig.blockchain.privateKey = '[HIDDEN]';
      safeConfig.services.email.smtp.pass = '[HIDDEN]';
      
      Object.keys(safeConfig.services).forEach(service => {
        if (safeConfig.services[service].apiKey) {
          safeConfig.services[service].apiKey = '[HIDDEN]';
        }
      });
      
      return safeConfig;
    }
    return config;
  }
};

// Initialize configuration
validateEnvironment();
validateConfig();

module.exports = {
  config,
  configUtils
};
