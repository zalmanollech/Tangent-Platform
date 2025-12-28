# Risk Engine - STEP 3 Implementation Summary

## Overview
This document summarizes the implementation of real risk calculation logic in STEP 3. The risk engine now computes actual risk scores, bands, and financing/deposit percentages based on contract characteristics.

## Changes Made

### 1. Risk Calculation Implementation

#### File: `backend/lib/risk-engine.js`

**Replaced `computeRiskForContract()` placeholder with real implementation:**

The function now:
- Starts with base risk score of 5 (MEDIUM)
- Adjusts score based on multiple factors:
  1. **Product Type** - Volatility assessment
     - Very high risk: Crude oil, petroleum, natural gas (+2)
     - High volatility: Cocoa, coffee, sugar (+1)
     - Low volatility: Wheat, corn, soybeans (-1)
  
  2. **Contract Value** - Size-based exposure
     - Very large (>$5M): +2
     - Large (>$1M): +1
     - Small (<$200K): -1
  
  3. **Voyage Time** - Duration risk
     - Very long (>90 days): +1
     - Short (<30 days): -0.5
  
  4. **Country/Route Risk** - Geographic risk
     - Higher risk countries: +0.5 per occurrence
     - Lower risk countries: -0.5 per occurrence
  
  5. **Insurance** - Risk mitigation (if available)
     - Has insurance: -1

- Clamps score between 1-10
- Maps score to risk band:
  - 1-2: VERY_LOW
  - 3-4: LOW
  - 5-6: MEDIUM
  - 7-8: HIGH
  - 9-10: VERY_HIGH

- Maps score to financing/deposit percentages:
  - VERY_LOW (1-2): 90% financing, 5% deposit
  - LOW (3-4): 80% financing, 15% deposit
  - MEDIUM (5-6): 70% financing, 25% deposit
  - HIGH (7-8): 50% financing, 40% deposit
  - VERY_HIGH (9-10): 30% financing, 60% deposit

**Key Features:**
- Defensive coding: Never throws, always returns valid object
- Gracefully handles missing fields (skips rules if data unavailable)
- Falls back to MEDIUM risk (score 5) if calculation fails

### 2. Helper Functions Updated

**Updated helper functions to work with real scores:**
- `getRiskBand(riskScore)` - Maps score to band
- `calculateMaxFinancingPercent(riskScore)` - Maps score to financing %
- `calculateRequiredDepositPercent(riskScore)` - Maps score to deposit %

### 3. Debug Logging

**Added lightweight debug logging in `evaluateAndStoreRiskForContract()`:**
```javascript
console.log('[RISK ENGINE] Computed risk for contract', contractId, {
    riskScore: risk.riskScore,
    riskBand: risk.riskBand,
    maxFinancingPercent: risk.maxFinancingPercent,
    requiredDepositPercent: risk.requiredDepositPercent
});
```

## Risk Calculation Examples

### Example 1: Low Risk Contract
**Contract:**
- Product: "Wheat"
- Total Value: $150,000
- Origin: "Kansas, USA"
- Destination: "Hamburg, Germany"
- Voyage Time: 25 days

**Calculation:**
- Base: 5
- Product (Wheat, low volatility): -1 → 4
- Value (small): -1 → 3
- Origin (USA, lower risk): -0.5 → 2.5
- Destination (Germany, lower risk): -0.5 → 2
- Voyage (short): -0.5 → 1.5
- **Final Score: 2** (rounded from 1.5)

**Result:**
```json
{
  "riskScore": 2,
  "riskBand": "VERY_LOW",
  "maxFinancingPercent": 90.0,
  "requiredDepositPercent": 5.0
}
```

### Example 2: Medium Risk Contract
**Contract:**
- Product: "Coffee"
- Total Value: $500,000
- Origin: "Santos, Brazil"
- Voyage Time: 45 days

**Calculation:**
- Base: 5
- Product (Coffee, high volatility): +1 → 6
- Value (medium): no change → 6
- **Final Score: 6**

**Result:**
```json
{
  "riskScore": 6,
  "riskBand": "MEDIUM",
  "maxFinancingPercent": 70.0,
  "requiredDepositPercent": 25.0
}
```

### Example 3: High Risk Contract
**Contract:**
- Product: "Crude Oil (WTI)"
- Total Value: $7,500,000
- Origin: "Houston, TX"
- Destination: "Rotterdam, Netherlands"
- Voyage Time: 120 days

**Calculation:**
- Base: 5
- Product (Crude Oil, very high risk): +2 → 7
- Value (very large): +2 → 9
- Voyage (very long): +1 → 10
- **Final Score: 10** (clamped)

**Result:**
```json
{
  "riskScore": 10,
  "riskBand": "VERY_HIGH",
  "maxFinancingPercent": 30.0,
  "requiredDepositPercent": 60.0
}
```

## Verification Checklist

✅ **Risk Calculation**
- `computeRiskForContract()` returns valid risk object (no nulls)
- Score is clamped between 1-10
- Risk band maps correctly to score ranges
- Financing and deposit percentages map correctly

✅ **Integration**
- Risk evaluation called on contract creation
- Risk evaluation called on contract activation
- Values stored in database (in-memory and PostgreSQL)
- Debug logging shows computed values

✅ **API Behavior**
- `GET /api/contracts` returns contracts with risk fields
- `GET /api/contracts/:id` returns contract with risk fields
- Risk fields show non-null values for new contracts
- Existing contracts may still have nulls (created before STEP 3)

✅ **Backward Compatibility**
- No deposit/financing/payment logic changed
- All existing flows work unchanged
- Server starts without errors
- No uncaught exceptions from risk engine

## Testing Instructions

### 1. Start the Server
```bash
cd backend
node server-WORKING-FIXED.js
```

### 2. Create Test Contracts

**Low Risk Contract:**
```bash
curl -X POST http://localhost:4000/api/contracts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product": "Wheat",
    "quantity": 500,
    "unit": "tons",
    "price": 300,
    "counterparty": "supplier@test.com",
    "voyageTime": 25
  }'
```

**High Risk Contract:**
```bash
curl -X POST http://localhost:4000/api/contracts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product": "Crude Oil (WTI)",
    "quantity": 10000,
    "unit": "barrels",
    "price": 750,
    "counterparty": "supplier@test.com",
    "voyageTime": 120
  }'
```

### 3. Check Console Logs
You should see:
```
[RISK ENGINE] Computed risk for contract contract-1234567890-abc123 {
  riskScore: 2,
  riskBand: 'VERY_LOW',
  maxFinancingPercent: 90,
  requiredDepositPercent: 5
}
```

### 4. Verify API Response
```bash
GET /api/contracts/CONTRACT_ID
```

Response should include:
```json
{
  "id": "contract-1234567890-abc123",
  "product": "Wheat",
  "riskScore": 2,
  "riskBand": "VERY_LOW",
  "maxFinancingPercent": 90.0,
  "requiredDepositPercent": 5.0,
  ...
}
```

## Files Changed

1. **backend/lib/risk-engine.js**
   - Replaced `computeRiskForContract()` with real implementation
   - Updated helper functions (`getRiskBand`, `calculateMaxFinancingPercent`, `calculateRequiredDepositPercent`)
   - Added debug logging to `evaluateAndStoreRiskForContract()`
   - Updated module header comments

## Next Steps (STEP 4 - Not Implemented)

In STEP 4, we may:
- Apply risk-based financing and deposit rules to actual business logic
- Add risk score display in UI
- Refine risk calculation rules based on real-world data
- Add more risk factors (credit history, document completeness, etc.)

## Notes

- Risk calculation is conservative and defensive
- Missing fields are handled gracefully (rules skipped if data unavailable)
- All risk values are computed and stored automatically
- No business logic has been changed - deposits/financing still work as before
- Risk fields are visible in API responses but not yet used in calculations

## Risk Score Mapping Reference

| Score | Band | Max Financing | Required Deposit |
|-------|------|--------------|------------------|
| 1-2   | VERY_LOW | 90% | 5% |
| 3-4   | LOW | 80% | 15% |
| 5-6   | MEDIUM | 70% | 25% |
| 7-8   | HIGH | 50% | 40% |
| 9-10  | VERY_HIGH | 30% | 60% |











