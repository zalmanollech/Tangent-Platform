# Tangent Platform v2.0 - Enhanced Secure Trading Platform

A comprehensive commodity trading platform with blockchain integration, enhanced security, and enterprise-grade features.

## 🚀 What's New in v2.0

### ✅ **Security Enhancements**
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Protection against abuse and DDoS attacks
- **Input Validation**: Comprehensive validation for all endpoints
- **Security Headers**: Helmet.js integration for security headers
- **Password Security**: Bcrypt with configurable rounds

### ✅ **Architecture Improvements**
- **Modular Design**: Split monolithic server into organized modules
- **Database Abstraction**: Flexible database layer with migration support
- **Configuration Management**: Environment-based configuration
- **Comprehensive Logging**: Audit trails, security monitoring, performance tracking
- **Error Handling**: Structured error handling with proper HTTP status codes

### ✅ **API Enhancements**
- **RESTful Design**: Properly structured REST endpoints
- **Validation Middleware**: Request validation with detailed error messages
- **Documentation**: Auto-generated API documentation
- **Testing Suite**: Comprehensive test coverage

## 📋 Prerequisites

- Node.js >= 16.0.0
- npm or yarn package manager
- (Optional) PostgreSQL for production database
- (Optional) Redis for session management

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd tangent-supplier-web-clean
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configuration**
   ```bash
   # Copy the example configuration
   cp config.example .env
   
   # Edit .env with your settings
   nano .env
   ```

4. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file based on `config.example`:

```env
# Server Configuration
NODE_ENV=development
PORT=4000
HOST=localhost

# Security Configuration
JWT_SECRET=your-super-secure-jwt-secret-key
ADMIN_KEY=your-admin-api-key
BCRYPT_ROUNDS=12

# Database Configuration
DB_TYPE=json
DB_PATH=./data.json

# Blockchain Configuration
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
ESCROW_ADDRESS=0xYourEscrowContractAddress
TGT_ADDRESS=0xYourTokenContractAddress

# External Services
OPENAI_API_KEY=your-openai-key
GOOGLE_VISION_API_KEY=your-google-vision-key
```

### Database Options

#### JSON File (Development)
```env
DB_TYPE=json
DB_PATH=./data.json
```

#### PostgreSQL (Production)
```env
DB_TYPE=postgres
DATABASE_URL=postgresql://username:password@localhost:5432/tangent_platform
```

## 🔐 Security Features

### Authentication & Authorization
- JWT-based authentication with configurable expiry
- Role-based access control (buyer, supplier, admin)
- Secure password hashing with bcrypt
- Session management with optional Redis backend

### Security Middleware
- **Helmet.js**: Security headers (CSP, HSTS, etc.)
- **Rate Limiting**: Configurable rate limits per endpoint type
- **Input Validation**: Schema-based validation with detailed error messages
- **File Upload Security**: File type and size validation

### Audit & Logging
- **Request Logging**: All API requests with response times
- **Security Logging**: Authentication attempts, security events
- **Audit Trail**: Business operations and data changes
- **Error Tracking**: Comprehensive error logging with context

## 📚 API Documentation

### Base URL
```
http://localhost:4000
```

### Authentication Endpoints
```http
POST /auth/register          # User registration
POST /auth/login             # User login
POST /auth/logout            # User logout
GET  /auth/profile           # Get user profile
PUT  /auth/profile           # Update user profile
POST /auth/change-password   # Change password
POST /auth/verify-token      # Verify JWT token
```

### KYC Endpoints
```http
POST /api/kyc/submit                    # Submit KYC application
GET  /api/kyc/status                    # Get KYC status
GET  /api/kyc/submission/:id            # Get submission details
GET  /api/kyc/admin/submissions         # Admin: List submissions
POST /api/kyc/admin/review/:id          # Admin: Review submission
```

### Trade Endpoints
```http
GET    /api/trades                      # List all trades
GET    /api/trades/my-trades           # Get user's trades
GET    /api/trades/:id                 # Get trade details
POST   /api/trades                     # Create new trade
PATCH  /api/trades/:id/status          # Update trade status
POST   /api/trades/:id/deposit         # Record deposit
POST   /api/trades/:id/confirm         # Confirm trade
GET    /api/trades/analytics/summary   # Trade analytics
```

### System Endpoints
```http
GET /health                  # Health check
GET /api/docs/endpoints     # API documentation
```

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

### Test Structure
```
tests/
├── auth.test.js         # Authentication tests
├── kyc.test.js          # KYC functionality tests
├── trades.test.js       # Trade management tests
├── security.test.js     # Security middleware tests
└── setup.js             # Test setup and teardown
```

## 🏗️ Architecture

### Project Structure
```
tangent-supplier-web-clean/
├── lib/                     # Core libraries
│   ├── config.js           # Configuration management
│   ├── database.js         # Database abstraction
│   ├── logger.js           # Logging utilities
│   └── security.js         # Security middleware
├── routes/                  # API routes
│   ├── auth.js             # Authentication routes
│   ├── kyc.js              # KYC routes
│   └── trades.js           # Trade routes
├── tests/                   # Test suite
├── uploads/                 # File uploads directory
├── logs/                    # Application logs
├── server_new.js           # Main server file (enhanced)
├── server_backup.js        # Original server backup
└── package.json            # Dependencies and scripts
```

### Database Schema
The platform uses a flexible JSON-based schema that can be migrated to PostgreSQL:

```json
{
  "users": [
    {
      "id": "string",
      "email": "string",
      "passHash": "string",
      "role": "buyer|supplier|admin",
      "kyc": { "status": "string", "..." },
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "trades": [...],
  "kycSubmissions": [...],
  "auditLogs": [...]
}
```

## 🔄 Migration from v1.0

### Automatic Migration
The new system automatically migrates existing data:

1. **Backup Creation**: Automatic backup of existing data
2. **Schema Migration**: Updates data structure to new format
3. **Backward Compatibility**: Legacy endpoints still work

### Manual Migration Steps
```bash
# 1. Backup your current data
cp data.json data_backup.json

# 2. Install new dependencies
npm install

# 3. Update configuration
cp config.example .env
# Edit .env with your settings

# 4. Start new server
npm run dev
```

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production
```bash
# Set environment variables
export NODE_ENV=production
export JWT_SECRET=your-production-secret
export DATABASE_URL=your-production-db-url

# Start server
npm start
```

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 4000
CMD ["npm", "start"]
```

## 📊 Monitoring & Logging

### Log Files
```
logs/
├── combined.log        # All application logs
├── error.log          # Error logs only
├── security.log       # Security events
├── audit.log          # Business operations
└── blockchain.log     # Blockchain transactions
```

### Health Monitoring
```http
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "version": "2.0.0",
  "features": {
    "database": "operational",
    "logging": "operational",
    "security": "operational",
    "blockchain": "operational"
  },
  "uptime": 3600
}
```

## 🛡️ Security Considerations

### Production Checklist
- [ ] Set strong JWT_SECRET (minimum 32 characters)
- [ ] Configure proper CORS origins
- [ ] Enable HTTPS in production
- [ ] Set up proper database with encryption
- [ ] Configure rate limiting appropriately
- [ ] Set up monitoring and alerting
- [ ] Regular security updates
- [ ] Backup strategy implementation

### Security Headers
The platform automatically sets security headers:
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy

## 📈 Performance

### Optimizations Implemented
- Request compression with gzip
- Efficient database queries
- Connection pooling (PostgreSQL)
- File upload size limits
- Request rate limiting
- Caching headers for static assets

## 🐛 Troubleshooting

### Common Issues

**1. Authentication Issues**
```bash
# Check JWT secret configuration
echo $JWT_SECRET

# Verify token format
curl -H "x-auth-token: YOUR_TOKEN" http://localhost:4000/auth/verify-token
```

**2. Database Issues**
```bash
# Check database path/connection
ls -la data.json

# Verify database structure
curl http://localhost:4000/health
```

**3. File Upload Issues**
```bash
# Check upload directory permissions
ls -la uploads/

# Verify file size limits in config
```

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make changes and add tests
4. Run tests: `npm test`
5. Submit a pull request

### Code Style
- Use ESLint configuration
- Follow existing patterns
- Add tests for new features
- Update documentation

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For support and questions:
- Email: support@tangentplatform.com
- Documentation: `/api/docs/endpoints`
- Health Check: `/health`

---

**Tangent Platform v2.0** - Built with ❤️ for secure, scalable commodity trading.




