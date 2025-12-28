# Risk Engine - STEP 2 Implementation Summary

## Overview
This document summarizes the non-breaking changes made in STEP 2 to wire the risk engine into the contract lifecycle. Risk evaluation is now called automatically when contracts are created or activated, but still returns null values (no logic applied yet).

## Changes Made

### 1. Database Helper Functions

#### File: `backend/lib/database.js`
- **Added `contracts.getById(contractId, inMemoryContracts)`** function:
  - Retrieves contract from in-memory store (primary) or PostgreSQL (fallback)
  - Handles both storage mechanisms seamlessly
  - Returns contract object in consistent format

- **Added `contracts.updateRiskFields(contractId, riskFields, inMemoryContracts)`** function:
  - Updates only the 4 risk-related fields in both in-memory and PostgreSQL
  - Safely handles null values
  - Does not modify any other contract fields
  - Idempotent and safe

### 2. Risk Engine Module Extension

#### File: `backend/lib/risk-engine.js`
- **Added `evaluateAndStoreRiskForContract(contractId, inMemoryContracts)`** function:
  - Async function that loads contract, computes risk, and stores results
  - Uses existing `computeRiskForContract()` which still returns null values
  - Updates only risk fields in database (in-memory and PostgreSQL)
  - Returns risk metrics object
  - Handles errors gracefully

- **Updated module exports** to include the new function

### 3. Contract Lifecycle Integration

#### File: `backend/server-WORKING-FIXED.js`

**Contract Creation Hook** (Line ~3017):
- Added risk evaluation call after contract is created and saved
- Located in `POST /api/contracts` endpoint
- Non-blocking: uses `.then().catch()` pattern
- Errors are logged but do not break contract creation flow
- Logs success/failure to console for debugging

**Contract Activation Hook** (Line ~3374):
- Added risk evaluation call when deposit is paid (contract activated)
- Located in `POST /api/contracts/:contractId/deposit` endpoint
- Triggered when contract status changes to `'AWAITING_DOCUMENTS'`
- Non-blocking: uses `.then().catch()` pattern
- Errors are logged but do not break deposit payment flow
- Logs success/failure to console for debugging

## Integration Points

### Where Risk Evaluation is Called

1. **Contract Creation** (`POST /api/contracts`)
   - After: `database.contracts.set(contractId, contract)`
   - Before: Credit assessment and response
   - Timing: Immediately after contract is persisted

2. **Contract Activation** (`POST /api/contracts/:contractId/deposit`)
   - After: Contract status updated to `'AWAITING_DOCUMENTS'`
   - After: `database.contracts.set(contractId, contract)` and `saveDatabase()`
   - Before: Transaction record creation and response
   - Timing: When deposit is paid and contract becomes active

### Error Handling

- All risk evaluation calls are wrapped in try-catch blocks
- Failures are logged to console but do not throw errors
- Contract creation/activation always succeeds even if risk evaluation fails
- Non-blocking pattern ensures user experience is not affected

## Verification Checklist

✅ **Database Helpers**
- `contracts.getById()` retrieves contracts from in-memory or PostgreSQL
- `contracts.updateRiskFields()` updates only risk fields
- Both functions handle null values safely

✅ **Risk Engine Module**
- `evaluateAndStoreRiskForContract()` function exists and is exported
- Function loads contract, computes risk (nulls), and stores results
- Error handling is in place

✅ **Contract Lifecycle Integration**
- Risk evaluation called on contract creation
- Risk evaluation called on contract activation (deposit paid)
- Both calls are non-blocking and error-safe
- Console logging confirms function calls

✅ **API Behavior**
- Contract creation endpoint works unchanged
- Deposit payment endpoint works unchanged
- API responses include risk fields (as null)
- No business logic depends on risk fields yet

✅ **Backward Compatibility**
- All existing code continues to work unchanged
- No calculations for deposits, financing, or payments have been modified
- Server should start and run exactly as before

## Testing Instructions

### 1. Start the Server
```bash
cd backend
node server-WORKING-FIXED.js
```

### 2. Verify Server Starts
- Check console for successful startup
- No errors related to risk engine or database helpers

### 3. Test Contract Creation
```bash
# Create a contract (replace with actual token)
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

# Check console logs for:
# [RISK ENGINE] Risk evaluation completed for contract contract-...
```

### 4. Test Contract Activation (Deposit Payment)
```bash
# Pay deposit (replace with actual contract ID and token)
curl -X POST http://localhost:4000/api/contracts/CONTRACT_ID/deposit \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check console logs for:
# [RISK ENGINE] Risk evaluation completed for activated contract contract-...
```

### 5. Verify Risk Fields in Database
```javascript
// In-memory (check via API)
GET /api/contracts/CONTRACT_ID
// Response should include:
// {
//   "riskScore": null,
//   "riskBand": null,
//   "maxFinancingPercent": null,
//   "requiredDepositPercent": null,
//   ...
// }
```

### 6. Verify Console Logs
- Contract creation should log: `[RISK ENGINE] Risk evaluation completed for contract ...`
- Deposit payment should log: `[RISK ENGINE] Risk evaluation completed for activated contract ...`
- Errors (if any) should log: `[RISK ENGINE] Risk evaluation failed for contract ...`

## Files Changed

1. **backend/lib/database.js** - Added `contracts.getById()` and `contracts.updateRiskFields()` functions
2. **backend/lib/risk-engine.js** - Added `evaluateAndStoreRiskForContract()` function
3. **backend/server-WORKING-FIXED.js** - Added risk evaluation hooks in:
   - Contract creation endpoint (`POST /api/contracts`)
   - Contract activation endpoint (`POST /api/contracts/:contractId/deposit`)

## Next Steps (STEP 3 - Not Implemented)

In STEP 3, we will:
- Implement actual risk calculation logic in `computeRiskForContract()`
- Use risk scores to determine financing and deposit percentages
- Apply risk-based business rules (if needed)
- Add risk score display in UI (if needed)

## Notes

- Risk evaluation is called but still returns null values (as expected in STEP 2)
- All risk evaluation calls are non-blocking and error-safe
- Contract creation and activation always succeed even if risk evaluation fails
- Console logs help verify that risk evaluation is being called
- Database helpers support both in-memory and PostgreSQL storage
- No business logic has been changed - all existing flows work exactly as before

## Console Log Examples

**Successful Risk Evaluation:**
```
[RISK ENGINE] Risk evaluation completed for contract contract-1234567890-abc123 {
  riskScore: null,
  riskBand: null
}
```

**Failed Risk Evaluation (non-blocking):**
```
[RISK ENGINE] Risk evaluation failed for contract contract-1234567890-abc123: Contract not found for risk evaluation
```

**Unexpected Error (non-blocking):**
```
[RISK ENGINE] Unexpected error calling evaluateAndStoreRiskForContract: Cannot read property 'getById' of undefined
```











