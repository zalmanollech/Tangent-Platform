# Role Model Plan - TRAIDEFI MERGE-LIFELINE

**Date:** January 2025  
**Status:** STEP R1 - Documentation Only (No Code Changes)  
**Purpose:** Analyze current role model and design contextual role helper API

---

## 1. CURRENT ROLE MODEL (BACKEND)

### 1.1 User Roles

**Storage:**
- User object has a `role` field: `user.role`
- Stored as string: `'buyer'`, `'supplier'`, `'trader'`, `'admin'`, `'insurer'`
- Set during registration: `POST /api/auth/register` accepts `role` parameter (defaults to `'buyer'`)
- Valid roles: `['buyer', 'supplier', 'trader', 'insurer']` (admin is special, not registerable)

**Location in Code:**
- `backend/server-WORKING-FIXED.js` line ~2398: Registration endpoint
- `backend/server-WORKING-FIXED.js` line ~2425: User object creation with `role: normalizedRole`
- JWT token payload includes role: `{ id, email, role }`

**Fixed vs Contextual:**
- **CURRENT:** Role is **FIXED** on the user object
- User is permanently marked as "buyer", "supplier", or "trader"
- This role determines behavior across ALL contracts

**Example User Objects:**
```javascript
{
  id: 'user-123',
  email: 'buyer@test.com',
  role: 'buyer',  // Fixed role
  kycStatus: 'approved',
  // ...
}

{
  id: 'user-456',
  email: 'trader@test.com',
  role: 'trader',  // Fixed role - can act as both buyer and supplier
  // ...
}
```

### 1.2 Contract Parties

**Contract Structure:**
- Contracts store parties via email addresses:
  - `contract.buyerEmail` - Email of the buyer
  - `contract.supplierEmail` - Email of the supplier
- No `contractRole` field on contract (only found in test data, not used in logic)

**Location in Code:**
- `backend/lib/database.js` line ~143-144: Database schema defines `buyer_email`, `supplier_email`
- `backend/server-WORKING-FIXED.js` line ~3082: Contract creation sets `buyerEmail` and `supplierEmail`

**Contract Creation Logic:**
```javascript
// backend/server-WORKING-FIXED.js line ~3061-3075
// Determine buyer and supplier based on user role
let buyerEmail, supplierEmail;
if (userRole === 'buyer') {
    buyerEmail = userEmail;
    supplierEmail = counterparty;
} else if (userRole === 'supplier') {
    supplierEmail = userEmail;
    buyerEmail = counterparty;
} else if (userRole === 'trader') {
    // Trader can be either, default to supplier
    supplierEmail = userEmail;
    buyerEmail = counterparty;
} else {
    return res.status(400).json({ error: 'Invalid role for contract creation' });
}
```

**Key Finding:**
- Contract creation **assumes** user's fixed role determines their position in the contract
- If `user.role === 'buyer'`, user becomes `buyerEmail` in contract
- If `user.role === 'supplier'`, user becomes `supplierEmail` in contract
- Trader defaults to supplier position

### 1.3 Role Usage in Routes

#### Dashboard Routes

**Route:** `/dashboard/authenticated`
- **Location:** `backend/server-WORKING-FIXED.js` line ~5094
- **Behavior:**
  - Displays user's fixed role: `user.role.toUpperCase()` as badge
  - Shows contracts where user is involved (buyer OR supplier)
  - Uses client-side `getUserRole(contract, userEmail)` function to determine role per contract

**Route:** `/dashboard/:role` (e.g., `/dashboard/buyer`, `/dashboard/supplier`)
- **Location:** `backend/server-WORKING-FIXED.js` line ~5946
- **Behavior:**
  - Role-specific dashboard routes
  - Renders different React components based on `:role` parameter
  - Components: `AdminDashboard`, `BuyerDashboard`, `SupplierDashboard`, `TraderDashboard`, `InsurerDashboard`

**Client-Side Role Detection:**
```javascript
// backend/server-WORKING-FIXED.js line ~5565-5569 (in dashboard HTML)
function getUserRole(contract, userEmail) {
    if (contract.buyerEmail === userEmail) return 'buyer';
    if (contract.supplierEmail === userEmail) return 'supplier';
    return 'trader';
}
```

**Note:** This function already exists but is **client-side only** (in HTML/JS). It correctly determines role from contract context, but backend doesn't use it.

#### Contract Routes

**Route:** `GET /contracts/:contractId` and `GET /trade/:id`
- **Location:** `backend/server-WORKING-FIXED.js` line ~1566, ~1604
- **Authorization Check:**
```javascript
const isAuthorized = userRole === 'admin' || 
                    contract.buyerEmail === userEmail || 
                    contract.supplierEmail === userEmail ||
                    (userRole === 'trader' && (contract.buyerEmail === userEmail || contract.supplierEmail === userEmail));
```
- **Behavior:**
  - Checks if user is buyer OR supplier OR admin OR trader
  - Uses both `user.role` (fixed) AND `contract.buyerEmail/supplierEmail` (contextual)

**Route:** `GET /api/contracts/:contractId`
- **Location:** `backend/server-WORKING-FIXED.js` line ~1644
- **Authorization:** Same pattern as above

**Route:** `GET /api/contracts` (List contracts)
- **Location:** `backend/server-WORKING-FIXED.js` line ~3774
- **Filtering Logic:**
```javascript
const isBuyer = contract.buyerEmail === userEmail;
const isSupplier = contract.supplierEmail === userEmail;
const isTrader = userRole === 'trader' && (contract.buyerEmail === userEmail || contract.supplierEmail === userEmail);
const isAdmin = userRole === 'admin';

if (isBuyer || isSupplier || isTrader || isAdmin) {
    // Include contract in results
}
```
- **Behavior:**
  - Returns contracts where user is buyer OR supplier
  - Special case: If `user.role === 'trader'`, includes contracts where user is buyer OR supplier
  - Admin sees all contracts

#### Contract Action Routes

**Route:** `POST /api/contracts/:contractId/deposit` (Pay Deposit)
- **Location:** `backend/server-WORKING-FIXED.js` line ~3396
- **Authorization:**
```javascript
if (contract.buyerEmail !== userEmail && req.user.role !== 'admin' && req.user.role !== 'trader') {
    return res.status(403).json({ error: 'Only the buyer can pay the deposit' });
}
```
- **Behavior:**
  - Checks `contract.buyerEmail === userEmail` (contextual)
  - Allows admin and trader (fixed role check) as override

**Route:** `POST /api/contracts/:contractId/confirm` (Confirm Contract)
- **Location:** `backend/server-WORKING-FIXED.js` line ~3605
- **Authorization:**
```javascript
if (contract.supplierEmail !== userEmail && req.user.role !== 'admin' && req.user.role !== 'trader') {
    return res.status(403).json({ error: 'Only the supplier can confirm the contract' });
}
```
- **Behavior:**
  - Checks `contract.supplierEmail === userEmail` (contextual)
  - Allows admin and trader (fixed role check) as override

**Route:** `POST /api/contracts/:contractId/release-payment` (Release Payment)
- **Location:** `backend/server-WORKING-FIXED.js` line ~3695
- **Authorization:**
```javascript
if (contract.buyerEmail !== userEmail && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only the buyer can release payment' });
}
```
- **Behavior:**
  - Checks `contract.buyerEmail === userEmail` (contextual)
  - Allows admin (fixed role check) as override
  - **Note:** Trader not explicitly allowed here (inconsistency)

**Route:** `POST /api/contracts/:contractId/documents` (Upload Documents)
- **Location:** `backend/server-WORKING-FIXED.js` line ~2819
- **Authorization:**
```javascript
if (contract.supplierEmail !== userEmail && req.user.role !== 'trader' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only the supplier can upload documents' });
}
```
- **Behavior:**
  - Checks `contract.supplierEmail === userEmail` (contextual)
  - Allows trader and admin (fixed role check) as override

**Route:** `POST /api/contracts/:contractId/cancel` (Cancel Contract)
- **Location:** `backend/server-WORKING-FIXED.js` line ~3654
- **Authorization:**
```javascript
if (contract.buyerEmail !== userEmail && contract.supplierEmail !== userEmail && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized to cancel this contract' });
}
```
- **Behavior:**
  - Checks if user is buyer OR supplier (contextual)
  - Allows admin (fixed role check) as override

### 1.4 Special Logic for "Trader"

**Trader Role:**
- `user.role === 'trader'` is a special fixed role
- Traders can appear as buyer OR supplier in different contracts
- Backend allows traders to:
  - View contracts where they are buyer OR supplier
  - Pay deposits (if they are buyer in that contract)
  - Confirm contracts (if they are supplier in that contract)
  - Upload documents (if they are supplier in that contract)

**Trader Contract Creation:**
- When trader creates contract, defaults to supplier position
- Trader can create contracts where they are buyer (via dual contract creation endpoint)

**Dual Contract Creation:**
- `POST /api/contracts/create-dual` (line ~3163)
- Allows creating contracts where trader is both buyer and supplier in related contracts

### 1.5 Admin Role

**Admin Role:**
- `user.role === 'admin'` is a special fixed role
- Admins can:
  - Access all contracts (bypass authorization checks)
  - Access admin-only routes (`/admin/*`)
  - Override all role-based restrictions
- Admin role is NOT registerable (must be set manually)

**Admin Routes:**
- Protected by `requireRole(['admin'])` middleware
- Examples: `/admin/users`, `/admin/active-trades`, `/admin/kyc-reports`, etc.

---

## 2. PROBLEMS VS BLUEPRINT

### 2.1 Fixed Role Assumption

**Problem:**
- User registration requires selecting a role: `'buyer'`, `'supplier'`, `'trader'`, or `'insurer'`
- This role is stored permanently on the user object
- Contract creation logic assumes this fixed role determines user's position

**Blueprint Violation:**
- Blueprint says: "Buyer / Supplier / Trader is determined **per contract**, based on who is delivering and who is receiving"
- Current: Role is fixed at registration time
- Should be: Role inferred from contract direction only

**Example Mismatch:**
```javascript
// Current behavior:
// User registers as "buyer"
user.role = 'buyer';

// User creates contract with counterparty
// System assumes: user is buyer, counterparty is supplier
buyerEmail = userEmail;  // Because user.role === 'buyer'
supplierEmail = counterparty;

// Problem: What if user wants to be supplier in this contract?
// They can't - their fixed role prevents it
```

### 2.2 Contract Creation Direction

**Problem:**
- Contract creation endpoint (`POST /api/contracts`) determines buyer/supplier based on `user.role`
- If `user.role === 'buyer'`, user becomes buyer
- If `user.role === 'supplier'`, user becomes supplier
- Trader defaults to supplier

**Blueprint Violation:**
- Blueprint says: "UI must NOT ask 'are you buyer/supplier/trader?'"
- Current: Registration asks for role, which determines contract direction
- Should be: Contract creation should allow user to specify direction (or infer from context)

### 2.3 Inconsistent Authorization Checks

**Problem:**
- Some routes check `contract.buyerEmail === userEmail` (contextual) ✅
- Some routes also check `req.user.role === 'trader'` (fixed) ⚠️
- Some routes allow admin override (fixed) ✅
- Inconsistency: Trader allowed in some places, not others

**Examples:**
- Deposit payment: Allows trader ✅
- Confirm contract: Allows trader ✅
- Release payment: Does NOT allow trader ❌ (inconsistency)
- Upload documents: Allows trader ✅

### 2.4 Dashboard Role Display

**Problem:**
- Dashboard shows user's fixed role as badge: `user.role.toUpperCase()`
- But contract list shows contextual role per contract: `getUserRole(contract, userEmail)`
- Confusion: Fixed role badge vs contextual role in table

**Example:**
```
Dashboard Header: "BUYER" (from user.role)
Contract Table:
  - Contract 1: My Role = "Buyer" (from contract.buyerEmail)
  - Contract 2: My Role = "Supplier" (from contract.supplierEmail)
```

### 2.5 Trader Special Case

**Problem:**
- Trader is a "meta-role" that means "can be both buyer and supplier"
- But it's still stored as a fixed role on user
- Trader logic is scattered throughout codebase

**Blueprint Alignment:**
- Trader concept aligns with blueprint (user can be buyer in one contract, supplier in another)
- But implementation uses fixed role instead of pure contextual determination

---

## 3. PROPOSED CONTEXTUAL ROLE HELPER API

### 3.1 Core Helper Function

**Function Signature:**
```javascript
/**
 * Determine the role of a user for a specific contract
 * @param {Object} user - User object (must have email property)
 * @param {Object} contract - Contract object (must have buyerEmail and supplierEmail)
 * @returns {'BUYER' | 'SUPPLIER' | 'OTHER' | null}
 */
function getUserRoleForContract(user, contract) {
    // Implementation
}
```

**Rules:**

1. **If user.email === contract.buyerEmail:**
   - Return `'BUYER'`
   - User is the buyer in this contract

2. **If user.email === contract.supplierEmail:**
   - Return `'SUPPLIER'`
   - User is the supplier in this contract

3. **If user.email matches neither:**
   - Return `'OTHER'`
   - User is not a party to this contract (unless admin override)

4. **Admin Override:**
   - If `user.role === 'admin'`, function can return `'ADMIN'` or allow access regardless
   - Admin role remains fixed (not contextual)

5. **Null/Invalid Cases:**
   - If contract is missing `buyerEmail` or `supplierEmail`, return `null`
   - If user is missing `email`, return `null`

**Implementation:**
```javascript
// backend/lib/roles.js (to be created in STEP R2)
function getUserRoleForContract(user, contract) {
    if (!user || !user.email) {
        return null;
    }
    
    if (!contract || !contract.buyerEmail || !contract.supplierEmail) {
        return null;
    }
    
    const userEmail = user.email.toLowerCase().trim();
    const buyerEmail = (contract.buyerEmail || '').toLowerCase().trim();
    const supplierEmail = (contract.supplierEmail || '').toLowerCase().trim();
    
    if (userEmail === buyerEmail) {
        return 'BUYER';
    }
    
    if (userEmail === supplierEmail) {
        return 'SUPPLIER';
    }
    
    // User is not a party to this contract
    return 'OTHER';
}
```

### 3.2 Authorization Helper

**Function Signature:**
```javascript
/**
 * Check if user is authorized to access a contract
 * @param {Object} user - User object
 * @param {Object} contract - Contract object
 * @param {string[]} allowedRoles - Array of allowed roles: ['BUYER', 'SUPPLIER', 'ADMIN']
 * @returns {boolean}
 */
function isUserAuthorizedForContract(user, contract, allowedRoles = ['BUYER', 'SUPPLIER']) {
    // Implementation
}
```

**Rules:**
- Admin is always authorized (if `'ADMIN'` in allowedRoles or user.role === 'admin')
- User's contextual role must be in allowedRoles
- Returns `true` if authorized, `false` otherwise

**Implementation:**
```javascript
function isUserAuthorizedForContract(user, contract, allowedRoles = ['BUYER', 'SUPPLIER']) {
    if (!user || !contract) {
        return false;
    }
    
    // Admin override
    if (user.role === 'admin' && (allowedRoles.includes('ADMIN') || allowedRoles.length === 0)) {
        return true;
    }
    
    // Get contextual role
    const contextualRole = getUserRoleForContract(user, contract);
    
    if (!contextualRole || contextualRole === 'OTHER') {
        return false;
    }
    
    // Check if contextual role is allowed
    return allowedRoles.includes(contextualRole);
}
```

### 3.3 Contract Creation Helper

**Function Signature:**
```javascript
/**
 * Determine buyer and supplier emails for contract creation
 * @param {string} userEmail - Email of user creating contract
 * @param {string} counterpartyEmail - Email of counterparty
 * @param {string} userDirection - 'buyer' | 'supplier' (user's position in contract)
 * @returns {{ buyerEmail: string, supplierEmail: string }}
 */
function determineContractParties(userEmail, counterpartyEmail, userDirection) {
    // Implementation
}
```

**Rules:**
- If `userDirection === 'buyer'`: userEmail → buyerEmail, counterpartyEmail → supplierEmail
- If `userDirection === 'supplier'`: userEmail → supplierEmail, counterpartyEmail → buyerEmail
- No longer depends on `user.role` (fixed role)

**Implementation:**
```javascript
function determineContractParties(userEmail, counterpartyEmail, userDirection) {
    if (userDirection === 'buyer') {
        return {
            buyerEmail: userEmail,
            supplierEmail: counterpartyEmail
        };
    } else if (userDirection === 'supplier') {
        return {
            buyerEmail: counterpartyEmail,
            supplierEmail: userEmail
        };
    } else {
        throw new Error('Invalid userDirection. Must be "buyer" or "supplier"');
    }
}
```

### 3.4 Dashboard Contract Filtering

**Function Signature:**
```javascript
/**
 * Filter contracts where user has a specific role
 * @param {Object[]} contracts - Array of contract objects
 * @param {Object} user - User object
 * @param {string[]} roles - Roles to filter by: ['BUYER', 'SUPPLIER'] or null for all
 * @returns {Object[]} Filtered contracts with role annotation
 */
function filterContractsByUserRole(contracts, user, roles = null) {
    // Implementation
}
```

**Returns:**
- Array of contracts with added `userRole` property
- Each contract includes: `{ ...contract, userRole: 'BUYER' | 'SUPPLIER' | 'OTHER' }`

---

## 4. DASHBOARD IMPLICATIONS

### 4.1 Unified Dashboard

**Current:** `/dashboard/authenticated` shows all contracts where user is involved

**Proposed:** Unified dashboard at `/` will:
- Show contracts where user is buyer (role=BUYER)
- Show contracts where user is supplier (role=SUPPLIER)
- Optionally group or label them:
  ```
  ## Contracts Where I'm the Buyer
  [Contract list...]
  
  ## Contracts Where I'm the Supplier
  [Contract list...]
  ```

**Implementation:**
- Use `getUserRoleForContract()` for each contract
- Group contracts by contextual role
- Display appropriate actions based on contextual role

### 4.2 Role-Specific Routes

**Current:** `/dashboard/buyer`, `/dashboard/supplier`, `/dashboard/trader`

**Proposed:** These routes become thin filters:
- `/dashboard/buyer` → Shows only contracts where `getUserRoleForContract(user, contract) === 'BUYER'`
- `/dashboard/supplier` → Shows only contracts where `getUserRoleForContract(user, contract) === 'SUPPLIER'`
- `/dashboard/trader` → Shows contracts where user is buyer OR supplier (both roles)

**Note:** Trader dashboard is not a fixed role, but a view that shows contracts in both directions.

### 4.3 Role Badge Display

**Current:** Dashboard shows fixed `user.role.toUpperCase()` badge

**Proposed:** 
- Remove fixed role badge from header
- Show contextual role per contract in table
- Optionally show summary: "You are buyer in 5 contracts, supplier in 3 contracts"

---

## 5. CONTRACT CREATION IMPLICATIONS

### 5.1 Current Flow

**Current:**
1. User registers with role: `'buyer'`, `'supplier'`, or `'trader'`
2. User creates contract with counterparty
3. System determines buyer/supplier based on `user.role`

### 5.2 Proposed Flow

**Proposed:**
1. User registers (no role selection, or role is just metadata)
2. User creates contract with counterparty
3. User specifies their position: "I am the buyer" or "I am the supplier"
4. System uses `determineContractParties()` to set `buyerEmail` and `supplierEmail`

**Alternative (Infer from Context):**
- If user initiates purchase → user is buyer
- If user receives purchase request → user is supplier
- UI flow determines direction, not fixed role

---

## 6. MIGRATION STRATEGY

### 6.1 Phase 1: Create Helper (STEP R2)

- Create `backend/lib/roles.js` with helper functions
- Implement `getUserRoleForContract()`, `isUserAuthorizedForContract()`, etc.
- **No changes to existing routes yet**

### 6.2 Phase 2: Replace Authorization Checks

- Replace ad-hoc authorization checks with `isUserAuthorizedForContract()`
- Start with contract detail routes (`GET /contracts/:contractId`)
- Test thoroughly

### 6.3 Phase 3: Update Contract Creation

- Modify `POST /api/contracts` to accept `userDirection` parameter
- Use `determineContractParties()` instead of `user.role` logic
- Keep backward compatibility (if no `userDirection`, infer from `user.role`)

### 6.4 Phase 4: Update Dashboard

- Use `getUserRoleForContract()` in contract list
- Group contracts by contextual role
- Remove fixed role badge

### 6.5 Phase 5: Remove Fixed Role Dependencies

- Remove role selection from registration (or make it optional metadata)
- Remove all `user.role` checks except for admin
- Keep `user.role` field for backward compatibility but don't use it for business logic

---

## 7. NON-GOALS FOR NOW

### 7.1 Database Schema Changes

- We will NOT change the database schema in this step
- `user.role` field remains in database (for backward compatibility)
- `contract.buyerEmail` and `contract.supplierEmail` remain unchanged

### 7.2 Legacy Route Removal

- We will NOT delete legacy routes (`/dashboard/buyer`, `/dashboard/supplier`) yet
- These routes will be refactored to use contextual role helpers
- Can be removed later if unified dashboard replaces them

### 7.3 Admin Role Changes

- Admin role remains fixed (not contextual)
- Admin checks remain: `user.role === 'admin'`
- Admin can access all contracts regardless of buyerEmail/supplierEmail

### 7.4 Registration Flow Changes

- We will NOT change registration endpoint in this step
- Role selection can remain for now (will be removed in Phase 5)
- New users can still register with a role (it becomes metadata only)

---

## 8. KEY DECISIONS SUMMARY

### 8.1 Helper Function Signature

**Decision:** `getUserRoleForContract(user, contract) -> 'BUYER' | 'SUPPLIER' | 'OTHER' | null`

**Rationale:**
- Simple, pure function
- Takes user and contract, returns role
- No side effects
- Easy to test

### 8.2 Return Values

**Decision:** Uppercase strings: `'BUYER'`, `'SUPPLIER'`, `'OTHER'`

**Rationale:**
- Consistent with enum-like values
- Easy to compare: `role === 'BUYER'`
- Matches LOVABLE frontend expectations (UserRole type)

### 8.3 Admin Handling

**Decision:** Admin remains fixed role, not contextual

**Rationale:**
- Admin is a system role, not a contract role
- Admin should have access to all contracts
- Keep admin checks separate from contextual role logic

### 8.4 Trader Concept

**Decision:** Trader is not a contextual role, but a user who can be buyer OR supplier

**Rationale:**
- Trader dashboard shows contracts in both directions
- No special "trader" contextual role
- Trader is just a user who happens to be buyer in some contracts and supplier in others

---

## 9. EXAMPLES

### 9.1 Example 1: User as Buyer

```javascript
const user = { email: 'alice@example.com', role: 'buyer' };
const contract = {
    buyerEmail: 'alice@example.com',
    supplierEmail: 'bob@example.com',
    // ...
};

const role = getUserRoleForContract(user, contract);
// Returns: 'BUYER'
```

### 9.2 Example 2: User as Supplier

```javascript
const user = { email: 'bob@example.com', role: 'supplier' };
const contract = {
    buyerEmail: 'alice@example.com',
    supplierEmail: 'bob@example.com',
    // ...
};

const role = getUserRoleForContract(user, contract);
// Returns: 'SUPPLIER'
```

### 9.3 Example 3: Trader User (Buyer in Contract A, Supplier in Contract B)

```javascript
const user = { email: 'trader@example.com', role: 'trader' };

const contractA = {
    buyerEmail: 'trader@example.com',
    supplierEmail: 'supplier@example.com',
    // ...
};

const contractB = {
    buyerEmail: 'buyer@example.com',
    supplierEmail: 'trader@example.com',
    // ...
};

getUserRoleForContract(user, contractA);
// Returns: 'BUYER'

getUserRoleForContract(user, contractB);
// Returns: 'SUPPLIER'
```

### 9.4 Example 4: User Not a Party

```javascript
const user = { email: 'charlie@example.com', role: 'buyer' };
const contract = {
    buyerEmail: 'alice@example.com',
    supplierEmail: 'bob@example.com',
    // ...
};

const role = getUserRoleForContract(user, contract);
// Returns: 'OTHER'
```

### 9.5 Example 5: Authorization Check

```javascript
const user = { email: 'alice@example.com', role: 'buyer' };
const contract = {
    buyerEmail: 'alice@example.com',
    supplierEmail: 'bob@example.com',
    // ...
};

// Check if user can pay deposit (only buyer can)
isUserAuthorizedForContract(user, contract, ['BUYER']);
// Returns: true

// Check if user can confirm contract (only supplier can)
isUserAuthorizedForContract(user, contract, ['SUPPLIER']);
// Returns: false
```

---

## 10. NEXT STEPS

After reviewing this plan:

1. **Confirm Helper API:**
   - Review function signatures
   - Confirm return value format ('BUYER' vs 'buyer')
   - Confirm admin handling approach

2. **Prioritize Implementation:**
   - Start with STEP R2: Create `lib/roles.js` with helper functions
   - Then replace authorization checks one route at a time
   - Test each change thoroughly

3. **Create Implementation Tasks:**
   - Break down into small, testable steps
   - Ensure backward compatibility
   - Maintain existing functionality while migrating

4. **Begin Implementation:**
   - Create `backend/lib/roles.js`
   - Implement helper functions
   - Add unit tests if test framework exists
   - Start using in one safe route (e.g., contract detail view)

---

**End of ROLE-MODEL-PLAN.md**











