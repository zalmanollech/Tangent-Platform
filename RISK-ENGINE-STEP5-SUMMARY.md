# Risk Engine - STEP 5 Implementation Summary

## Overview
This document summarizes the implementation of an admin-only read-only endpoint to preview risk and financing terms for contracts. This endpoint allows admins to inspect and compare legacy vs risk-based financing terms without modifying any state.

## Changes Made

### 1. Extended Financing Terms Helper

#### File: `backend/lib/financing-terms.js`

**Added two new helper functions:**

1. **`getLegacyFinancingTerms()`**
   - Returns legacy financing terms (30% deposit, 70% financing)
   - Independent of feature flag
   - Always returns the same values
   - Returns: `{ depositPercent: 30.0, maxFinancingPercent: 70.0, source: 'legacy' }`

2. **`getRiskBasedFinancingTermsFromContract(contract)`**
   - Extracts risk-based financing terms from contract's stored risk fields
   - Independent of feature flag
   - Returns null values if risk fields are missing or invalid
   - Returns: `{ depositPercent: number | null, maxFinancingPercent: number | null, source: 'risk' | 'risk-missing' }`

**Key Features:**
- Both functions are pure (no side effects)
- Both functions ignore the feature flag
- Risk-based function validates risk field values (0-100 range)
- Gracefully handles missing or invalid risk fields

### 2. Admin Risk Preview Endpoint

#### File: `backend/server-WORKING-FIXED.js`

**Added new endpoint:**
- **Route:** `GET /api/admin/contracts/:contractId/risk-preview`
- **Authentication:** Requires admin role (`requireRole(['admin'])`)
- **Method:** Read-only (no state changes, no risk recalculation)

**Endpoint Behavior:**
- Loads contract from database (in-memory or PostgreSQL)
- Returns contract summary (core fields only, no sensitive data)
- Returns stored risk fields
- Returns legacy financing terms (always 30% deposit, 70% financing)
- Returns risk-based financing terms (from stored risk fields, if available)

**Response Structure:**
```json
{
  "contract": {
    "id": "contract-...",
    "status": "...",
    "product": "...",
    "quantity": ...,
    "unit": "...",
    "pricePerUnit": ...,
    "totalValue": ...,
    "currency": "...",
    "buyerEmail": "...",
    "supplierEmail": "...",
    "depositPercent": ...,
    "depositAmount": ...,
    "voyageTime": ...,
    "createdAt": "...",
    "depositPaid": ...,
    "buyerDepositPaid": ...,
    "documentsUploaded": ...
  },
  "risk": {
    "riskScore": ...,
    "riskBand": "...",
    "maxFinancingPercent": ...,
    "requiredDepositPercent": ...
  },
  "legacyFinancingTerms": {
    "depositPercent": 30.0,
    "maxFinancingPercent": 70.0,
    "source": "legacy"
  },
  "riskBasedFinancingTerms": {
    "depositPercent": ...,
    "maxFinancingPercent": ...,
    "source": "risk" | "risk-missing"
  }
}
```

## Integration Points

### Where New Functions Are Used

1. **Admin Risk Preview Endpoint** (`GET /api/admin/contracts/:contractId/risk-preview`)
   - Uses `getLegacyFinancingTerms()` to get legacy terms
   - Uses `getRiskBasedFinancingTermsFromContract()` to get risk-based terms
   - Compares both sets of terms side-by-side

### Authentication

- Uses existing `requireRole(['admin'])` middleware
- Follows same pattern as other admin endpoints
- Requires valid JWT token with admin role

## Verification Checklist

✅ **Financing Terms Helpers**
- `getLegacyFinancingTerms()` implemented and exported
- `getRiskBasedFinancingTermsFromContract()` implemented and exported
- Both functions are pure (no side effects)
- Both functions ignore feature flag

✅ **Admin Endpoint**
- Route `/api/admin/contracts/:contractId/risk-preview` exists
- Endpoint enforces admin-only access
- Endpoint is read-only (no DB changes, no risk recalculation)
- Returns all required fields (contract, risk, legacy terms, risk-based terms)

✅ **Backward Compatibility**
- No changes to existing behavior
- Feature flag still defaults to OFF
- All existing flows work unchanged

✅ **Error Handling**
- Returns 404 if contract not found
- Returns 403 if user is not admin
- Returns 500 with error message on server errors
- Logs errors to console

## Testing Instructions

### 1. Start the Server
```bash
cd backend
node server-WORKING-FIXED.js
```

### 2. Get Admin Token
Login as an admin user and get the JWT token.

### 3. Test Risk Preview Endpoint
```bash
# Replace CONTRACT_ID with an actual contract ID
# Replace YOUR_ADMIN_TOKEN with actual admin JWT token
curl -X GET http://localhost:4000/api/admin/contracts/CONTRACT_ID/risk-preview \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 4. Verify Response Structure
Response should include:
- `contract`: Contract summary with core fields
- `risk`: Stored risk fields (may be null if not calculated yet)
- `legacyFinancingTerms`: Always shows 30% deposit, 70% financing
- `riskBasedFinancingTerms`: Shows risk-based terms if available, or null if missing

### 5. Test Non-Admin Access (Should Fail)
```bash
# Use a non-admin token
curl -X GET http://localhost:4000/api/admin/contracts/CONTRACT_ID/risk-preview \
  -H "Authorization: Bearer NON_ADMIN_TOKEN"
# Should return 403 Forbidden
```

### 6. Test Invalid Contract (Should Fail)
```bash
curl -X GET http://localhost:4000/api/admin/contracts/invalid-contract-id/risk-preview \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
# Should return 404 Not Found
```

## Example JSON Response

### Contract with Risk Fields Calculated
```json
{
  "contract": {
    "id": "contract-1234567890-abc123",
    "contract_id": "contract-1234567890-abc123",
    "status": "AWAITING_DOCUMENTS",
    "product": "Wheat",
    "quantity": 5000,
    "unit": "tons",
    "pricePerUnit": 525.5,
    "totalValue": 2627500,
    "currency": "USD",
    "buyerEmail": "buyer@test.com",
    "supplierEmail": "supplier@test.com",
    "depositPercent": 30,
    "depositAmount": 788250,
    "voyageTime": 30,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "depositPaid": true,
    "buyerDepositPaid": true,
    "documentsUploaded": false
  },
  "risk": {
    "riskScore": 4,
    "riskBand": "LOW",
    "maxFinancingPercent": 80.0,
    "requiredDepositPercent": 15.0
  },
  "legacyFinancingTerms": {
    "depositPercent": 30.0,
    "maxFinancingPercent": 70.0,
    "source": "legacy"
  },
  "riskBasedFinancingTerms": {
    "depositPercent": 15.0,
    "maxFinancingPercent": 80.0,
    "source": "risk"
  }
}
```

### Contract without Risk Fields (Not Yet Calculated)
```json
{
  "contract": {
    "id": "contract-9876543210-xyz789",
    "contract_id": "contract-9876543210-xyz789",
    "status": "pending_supplier_confirmation",
    "product": "Coffee",
    "quantity": 1000,
    "unit": "tons",
    "pricePerUnit": 165.5,
    "totalValue": 165500,
    "currency": "USD",
    "buyerEmail": "buyer@test.com",
    "supplierEmail": "supplier@test.com",
    "depositPercent": 30,
    "depositAmount": 49650,
    "voyageTime": 45,
    "createdAt": "2025-01-15T11:00:00.000Z",
    "depositPaid": false,
    "buyerDepositPaid": false,
    "documentsUploaded": false
  },
  "risk": {
    "riskScore": null,
    "riskBand": null,
    "maxFinancingPercent": null,
    "requiredDepositPercent": null
  },
  "legacyFinancingTerms": {
    "depositPercent": 30.0,
    "maxFinancingPercent": 70.0,
    "source": "legacy"
  },
  "riskBasedFinancingTerms": {
    "depositPercent": null,
    "maxFinancingPercent": null,
    "source": "risk-missing"
  }
}
```

## Files Changed

1. **backend/lib/financing-terms.js**
   - Added `getLegacyFinancingTerms()` function
   - Added `getRiskBasedFinancingTermsFromContract(contract)` function
   - Exported both new functions

2. **backend/server-WORKING-FIXED.js**
   - Imported new helper functions
   - Added `GET /api/admin/contracts/:contractId/risk-preview` endpoint
   - Endpoint uses existing `requireRole(['admin'])` middleware

## Next Steps

With STEP 5 complete, we now have:
- ✅ Backend risk & financing fully wired
- ✅ Admin preview for validation

**Next decisions:**
1. **Backend path:** Decide when/how to turn the feature flag ON (sandbox, test contracts, admin-only, etc.)
2. **Frontend path (Lovable):** Start aligning pages/routing and expose risk/financing values in Admin dashboard

## Notes

- Endpoint is read-only - no state changes
- Endpoint does NOT recalculate risk - uses stored values
- Endpoint compares legacy vs risk-based terms side-by-side
- Endpoint is admin-only for security
- All existing behavior remains unchanged
- Feature flag still defaults to OFF











