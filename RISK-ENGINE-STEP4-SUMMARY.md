# Risk Engine - STEP 4 Implementation Summary

## Overview
This document summarizes the implementation of a central financing terms resolver with feature flag support. The system now has a unified way to determine deposit and financing percentages, with the ability to switch between legacy (fixed) and risk-based (dynamic) terms via a feature flag.

## Changes Made

### 1. Feature Flag

#### File: `backend/server-WORKING-FIXED.js`
- **Added feature flag** `USE_RISK_ENGINE_FOR_FINANCING`:
  - Environment variable: `USE_RISK_ENGINE_FOR_FINANCING`
  - Default: `false` (legacy behavior)
  - When `true`: uses risk-based `maxFinancingPercent` and `requiredDepositPercent`
  - **IMPORTANT**: Flag is NOT set to `true` anywhere in code - default behavior remains unchanged

### 2. Financing Terms Helper Module

#### File: `backend/lib/financing-terms.js` (NEW)
- **Created central helper** `getEffectiveFinancingTerms(contract, useRiskEngine)`:
  - Returns deposit and financing percentages based on feature flag
  - Legacy defaults: 30% deposit, 70% max financing (matches current production)
  - When flag is OFF: always returns legacy values
  - When flag is ON: uses risk-based values if available, falls back to legacy if missing/invalid
  - Returns object with:
    - `depositPercent`: number (0-100)
    - `maxFinancingPercent`: number (0-100)
    - `source`: string ('legacy' | 'risk' | 'legacy-fallback')

### 3. Centralized Deposit/Financing Logic

#### File: `backend/server-WORKING-FIXED.js`

**Contract Creation** (`POST /api/contracts`):
- Refactored to use `getEffectiveFinancingTerms()` before setting deposit fields
- Uses effective deposit percent from financing terms (or request body if provided)
- Logs financing terms source in development/debug mode

**Dual Contract Creation** (`POST /api/contracts/create-dual`):
- Refactored to use `getEffectiveFinancingTerms()` before setting deposit fields
- Same pattern as regular contract creation

**Deposit Payment** (`POST /api/contracts/:contractId/deposit`):
- Refactored to use `getEffectiveFinancingTerms()` for deposit amount calculation
- Uses effective deposit percent from financing terms
- Logs financing terms source in development/debug mode

**Release Payment** (`POST /api/contracts/:contractId/release-payment`):
- Refactored to use `getEffectiveFinancingTerms()` for remaining amount calculation
- Uses effective deposit percent to calculate remaining amount

### 4. Debug Logging

**Added lightweight logging** (only in development/debug mode):
```javascript
[FINANCING TERMS] Using legacy terms for contract contract-1234567890-abc123 deposit % = 30 max financing % = 70
```

Logs show:
- Source of financing terms ('legacy', 'risk', or 'legacy-fallback')
- Contract ID
- Effective deposit percent
- Effective max financing percent

## Integration Points

### Where `getEffectiveFinancingTerms()` is Used

1. **Contract Creation** (line ~2994)
   - Called before setting `depositPercent` and `depositAmount`
   - Uses effective deposit percent from financing terms

2. **Dual Contract Creation** (line ~3219)
   - Called before setting `depositPercent` and `depositAmount`
   - Same pattern as regular contract creation

3. **Deposit Payment** (line ~3324)
   - Called to get effective deposit percent for deposit amount calculation
   - Ensures consistency with contract creation

4. **Release Payment** (line ~3608)
   - Called to get effective deposit percent for remaining amount calculation
   - Ensures remaining amount is calculated correctly

## Behavior with Flag OFF (Default)

- All contracts use **30% deposit, 70% max financing** (legacy behavior)
- Logs show `source: 'legacy'` for all contracts
- No behavior changes from previous version
- Risk fields are still calculated and stored, but not used for financing terms

## Behavior with Flag ON (Future Use)

- Contracts with valid risk fields use risk-based percentages
- Logs show `source: 'risk'` for contracts with risk fields
- Logs show `source: 'legacy-fallback'` for contracts without risk fields
- Enables gradual rollout of risk-based financing

## Verification Checklist

✅ **Feature Flag**
- `USE_RISK_ENGINE_FOR_FINANCING` exists, default `false`
- Flag is NOT set to `true` anywhere in code
- Default behavior matches legacy (30% deposit, 70% financing)

✅ **Financing Terms Helper**
- `getEffectiveFinancingTerms()` function exists
- Returns legacy values when flag is OFF
- Returns risk-based values when flag is ON (if available)
- Falls back to legacy if risk fields are missing/invalid

✅ **Centralized Logic**
- Contract creation uses `getEffectiveFinancingTerms()`
- Dual contract creation uses `getEffectiveFinancingTerms()`
- Deposit payment uses `getEffectiveFinancingTerms()`
- Release payment uses `getEffectiveFinancingTerms()`

✅ **Backward Compatibility**
- With flag OFF, behavior matches previous version exactly
- All existing flows work unchanged
- No breaking changes

✅ **Logging**
- Debug logs show financing terms source
- Logs only appear in development/debug mode
- Logs are lightweight (no full contract details)

## Testing Instructions

### 1. Start the Server (Flag OFF - Default)
```bash
cd backend
node server-WORKING-FIXED.js
```

### 2. Create a Contract
```bash
curl -X POST http://localhost:4000/api/contracts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product": "Wheat",
    "quantity": 1000,
    "unit": "tons",
    "price": 500,
    "counterparty": "supplier@test.com"
  }'
```

### 3. Check Console Logs (Development Mode)
You should see:
```
[FINANCING TERMS] Using legacy terms for contract contract-1234567890-abc123 deposit % = 30 max financing % = 70
```

### 4. Verify Contract Response
```bash
GET /api/contracts/CONTRACT_ID
```

Response should show:
```json
{
  "id": "contract-1234567890-abc123",
  "depositPercent": 30,
  "depositAmount": 150000,
  "riskScore": 4,
  "riskBand": "LOW",
  "maxFinancingPercent": 80.0,
  "requiredDepositPercent": 15.0,
  ...
}
```

Note: Even though risk fields show `maxFinancingPercent: 80.0` and `requiredDepositPercent: 15.0`, the contract still uses `depositPercent: 30` because the flag is OFF.

### 5. Test with Flag ON (Local Only)
```bash
USE_RISK_ENGINE_FOR_FINANCING=true node server-WORKING-FIXED.js
```

Create a new contract and check logs:
```
[FINANCING TERMS] Using risk terms for contract contract-1234567890-abc123 deposit % = 15 max financing % = 80
```

**IMPORTANT**: After testing, set flag back to OFF for normal operation.

## Files Changed

1. **backend/server-WORKING-FIXED.js**
   - Added feature flag `USE_RISK_ENGINE_FOR_FINANCING`
   - Imported `getEffectiveFinancingTerms` helper
   - Refactored contract creation to use financing terms helper
   - Refactored dual contract creation to use financing terms helper
   - Refactored deposit payment to use financing terms helper
   - Refactored release payment to use financing terms helper
   - Added debug logging

2. **backend/lib/financing-terms.js** (NEW)
   - Created central financing terms resolver
   - Implements feature flag logic
   - Returns legacy or risk-based terms based on flag

## Example Log Output

### With Flag OFF (Default)
```
[FINANCING TERMS] Using legacy terms for contract contract-1234567890-abc123 deposit % = 30 max financing % = 70
[RISK ENGINE] Computed risk for contract contract-1234567890-abc123 {
  riskScore: 4,
  riskBand: 'LOW',
  maxFinancingPercent: 80,
  requiredDepositPercent: 15
}
```

### With Flag ON (Future Use)
```
[FINANCING TERMS] Using risk terms for contract contract-1234567890-abc123 deposit % = 15 max financing % = 80
[RISK ENGINE] Computed risk for contract contract-1234567890-abc123 {
  riskScore: 4,
  riskBand: 'LOW',
  maxFinancingPercent: 80,
  requiredDepositPercent: 15
}
```

## Next Steps (STEP 5 - Not Implemented)

In STEP 5, we will:
- Decide how to safely enable the feature flag (test environment, admin-only, simulation mode, etc.)
- Monitor risk-based financing in a controlled environment
- Gradually roll out to production
- Add UI indicators for risk-based terms (if needed)

## Notes

- Feature flag is OFF by default - no behavior changes
- All financing logic is now centralized through `getEffectiveFinancingTerms()`
- Risk fields are still calculated and stored, ready for when flag is enabled
- Debug logging helps verify which source is being used
- System is ready for gradual rollout of risk-based financing











