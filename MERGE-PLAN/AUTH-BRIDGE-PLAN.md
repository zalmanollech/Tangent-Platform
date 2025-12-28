# Authentication Bridge Plan - TRAIDEFI MERGE-LIFELINE

**Date:** January 2025  
**Status:** STEP F3 - Documentation Only (No Code Changes)  
**Purpose:** Map current auth systems and propose bridge design

---

## 1. CURRENT TRAIDEFI AUTH (BACKEND)

### 1.1 Login Endpoint

**Route:** `POST /api/auth/login`

**Request Payload:**
```json
{
  "email": "user@example.com",
  "password": "userpassword",
  "twoFactorToken": "123456"  // Optional, required if 2FA enabled
}
```

**Response (Success):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-id-123",
    "email": "user@example.com",
    "role": "buyer",
    "kycStatus": "approved",
    "twoFactorEnabled": false,
    // ... other user fields (password excluded)
  }
}
```

**Response (2FA Required):**
```json
{
  "requires2FA": true,
  "twoFactorMethod": "email"  // or "totp"
}
```

**Response (Error):**
```json
{
  "error": "Invalid credentials"
}
```

### 1.2 Authentication Method

**Token Type:** JWT (JSON Web Token)

**Token Storage:**
- **Frontend:** Stored in `localStorage.setItem("token", token)`
- **Backend:** No server-side session storage (stateless JWT)

**Token Expiry:** 7 days (configured in JWT sign options)

**Token Secret:** `process.env.JWT_SECRET || 'tangent-secret-key'`

**Token Payload:**
```javascript
{
  id: user.id,
  email: user.email,
  role: user.role
}
```

### 1.3 Token Verification (authenticateToken Middleware)

**Location:** `backend/server-WORKING-FIXED.js` (line ~1362)

**Token Extraction Order:**
1. **Authorization Header:** `Authorization: Bearer <token>`
2. **Query Parameter:** `?token=<token>`
3. **Cookie:** `req.cookies.token` (if cookies implemented)

**Verification Process:**
```javascript
jwt.verify(token, JWT_SECRET, (err, user) => {
  if (err) {
    // Return 401/403 or redirect to /landing-two
  }
  req.user = user;  // Attach decoded user to request
  next();
});
```

**User Object on Request:**
After successful verification, `req.user` contains:
- `id` - User ID
- `email` - User email
- `role` - User role (buyer, supplier, trader, admin, insurer)
- `sessionId` - Optional session ID (if session tracking enabled)

### 1.4 Protected Routes

**Middleware:** `authenticateToken` applied to:
- All `/api/*` routes (except public endpoints)
- `/dashboard/*` routes
- `/contracts/:contractId` routes
- `/trade/:id` routes
- `/kyc` route
- All admin routes (`/admin/*`)

**Role-Based Access:** `requireRole(['admin'])` middleware for admin-only routes

**Public Routes (No Auth Required):**
- `/`, `/landing-two`, `/landing`
- `/signin`, `/signup`, `/auth`
- `/health`, `/terms`, `/privacy`
- Static assets (`/static/*`, `/uploads/*`)

### 1.5 Two-Factor Authentication (2FA)

**Status:** Supported but optional

**Methods:**
- **TOTP:** Time-based one-time password (Google Authenticator, Authy, etc.)
- **Email:** Email-based code (via `/api/auth/2fa/send-login-code`)

**Flow:**
1. User submits email + password
2. If 2FA enabled, backend returns `{ requires2FA: true, twoFactorMethod: "email" }`
3. Frontend shows 2FA input field
4. User submits `twoFactorToken` in second request
5. Backend verifies token and returns JWT

**2FA Endpoints:**
- `POST /api/auth/2fa/send-login-code` - Send email code
- `POST /api/auth/2fa/enable` - Enable 2FA (requires auth)
- `POST /api/auth/2fa/verify` - Verify 2FA setup

### 1.6 Registration Endpoint

**Route:** `POST /api/auth/register`

**Request Payload:**
```json
{
  "email": "newuser@example.com",
  "password": "securepassword",
  "role": "buyer"  // buyer, supplier, trader, insurer
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

### 1.7 Logout

**Current Implementation:** No explicit logout endpoint

**Frontend Behavior:**
- Removes token from `localStorage`
- Redirects to `/landing-two`

**Backend Behavior:**
- JWT tokens are stateless (no server-side invalidation)
- Token remains valid until expiry (7 days) unless frontend removes it

---

## 2. LOVABLE AUTH (FRONTEND)

### 2.1 Auth Provider

**Location:** `traidefi-trade-hub/src/contexts/AuthContext.tsx`

**Technology:** Supabase Auth (`@supabase/supabase-js`)

**Key Functions:**
- `signIn(email, password)` - Calls `supabase.auth.signInWithPassword()`
- `signUp(email, password, metadata)` - Calls `supabase.auth.signUp()`
- `signOut()` - Calls `supabase.auth.signOut()`
- `enterDemoMode(role)` - Bypasses auth, creates fake profile
- `exitDemoMode()` - Exits demo mode

### 2.2 Storage

**Supabase Session:**
- Stored by Supabase client library (likely in localStorage or sessionStorage)
- Contains Supabase user object and access token

**Profile Data:**
- Fetched from Supabase `profiles` table
- Stored in React context state
- Includes: `id`, `email`, `first_name`, `last_name`, `role`, `organization_id`, `organization`

### 2.3 Authentication State

**Context State:**
```typescript
{
  user: User | null,           // Supabase User object
  session: Session | null,      // Supabase Session object
  profile: Profile | null,      // Profile from profiles table
  loading: boolean,             // Auth state loading
  isDemo: boolean               // Demo mode flag
}
```

**Auth State Listener:**
- `supabase.auth.onAuthStateChange()` - Listens for auth state changes
- Automatically updates `user` and `session` when Supabase auth changes

### 2.4 Route Protection

**Component:** `ProtectedRoute` (`traidefi-trade-hub/src/components/ProtectedRoute.tsx`)

**Protection Logic:**
```typescript
if (!user && !isDemo) {
  return <Navigate to="/auth" replace />;
}

if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
  return <Navigate to="/" replace />;
}
```

**Behavior:**
- Allows access if `user` exists (Supabase authenticated) OR `isDemo` is true
- Redirects to `/auth` if not authenticated and not in demo mode
- Role-based access control via `allowedRoles` prop

### 2.5 Demo Mode

**Purpose:** Allow users to explore platform without real authentication

**Implementation:**
- `enterDemoMode(role)` creates a fake profile object
- Sets `isDemo = true`
- `ProtectedRoute` allows access when `isDemo === true`
- No backend API calls made in demo mode

**Demo Profile Structure:**
```typescript
{
  id: 'demo-user-id',
  email: 'demo@traidefi.com',
  first_name: 'Demo',
  last_name: 'User',
  role: 'BUYER' | 'SUPPLIER',
  organization_id: '00000000-0000-0000-0000-000000000001',
  organization: { ... }
}
```

### 2.6 Current Backend Integration

**Status:** ❌ **NO BACKEND INTEGRATION**

**Current Behavior:**
- LOVABLE frontend uses **only Supabase** for authentication
- No calls to TRAIDEFI backend `/api/auth/login` endpoint
- No JWT token from backend stored or used
- All auth is handled by Supabase client library

**Supabase Configuration:**
- Supabase client initialized in `traidefi-trade-hub/src/integrations/supabase/client.ts`
- Uses Supabase project URL and anon key
- Assumes Supabase handles user management, password hashing, etc.

---

## 3. PROPOSED AUTH BRIDGE DESIGN

### 3.1 High-Level Strategy

**Goal:** LOVABLE frontend uses TRAIDEFI backend authentication while maintaining LOVABLE UX

**Approach:** Replace Supabase auth calls with TRAIDEFI backend API calls, but keep LOVABLE's UI/UX flow

### 3.2 Login Flow

**Step 1: User Submits Credentials**
- LOVABLE `Auth.tsx` form submits email + password
- Instead of `supabase.auth.signInWithPassword()`, call `POST /api/auth/login`

**Step 2: Handle 2FA (if required)**
- If backend returns `{ requires2FA: true }`, show 2FA input field
- User enters 2FA code
- Submit second request with `twoFactorToken`

**Step 3: Store Token**
- Backend returns `{ success: true, token: "...", user: {...} }`
- Store JWT token in `localStorage.setItem("token", token)`
- Store user object in `localStorage.setItem("user", JSON.stringify(user))`
- Update AuthContext state to reflect authenticated user

**Step 4: Redirect**
- Navigate to `/` (dashboard) or intended destination

### 3.3 Token Management

**Storage:**
- **Primary:** `localStorage.getItem("token")` - JWT token from backend
- **Secondary:** `localStorage.getItem("user")` - User object from backend

**Token Usage:**
- Include in all API requests: `Authorization: Bearer <token>`
- Backend `authenticateToken` middleware will verify token
- Token valid for 7 days (backend configured)

**Token Refresh:**
- **Current:** No refresh mechanism (token expires after 7 days)
- **Future Consideration:** Implement refresh token endpoint if needed

### 3.4 AuthContext Modifications

**Current State:**
```typescript
{
  user: User | null,        // Supabase User
  session: Session | null,  // Supabase Session
  profile: Profile | null,  // Supabase Profile
  loading: boolean,
  isDemo: boolean
}
```

**Proposed State:**
```typescript
{
  user: BackendUser | null,  // Backend user object
  token: string | null,      // JWT token
  profile: Profile | null,   // Backend user (or mapped to Profile shape)
  loading: boolean,
  isDemo: boolean
}
```

**Key Changes:**
- Remove Supabase `User` and `Session` types
- Add `token` to state
- Map backend `user` object to match LOVABLE's `Profile` shape
- Keep `isDemo` for demo mode support

### 3.5 ProtectedRoute Modifications

**Current Logic:**
```typescript
if (!user && !isDemo) {
  return <Navigate to="/auth" />;
}
```

**Proposed Logic:**
```typescript
if (!token && !isDemo) {
  return <Navigate to="/auth" />;
}
```

**Additional Check:**
- Optionally verify token with backend: `GET /api/auth/verify` or `GET /api/auth/me`
- This ensures token is still valid (not expired, not revoked)

### 3.6 API Request Interceptor

**Requirement:** All API calls must include JWT token

**Implementation Options:**

**Option A: Axios Interceptor**
```typescript
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

**Option B: Fetch Wrapper**
```typescript
async function apiFetch(url, options = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  return fetch(url, { ...options, headers });
}
```

**Option C: Custom Hook**
```typescript
function useApi() {
  const { token } = useAuth();
  
  const apiCall = async (url, options = {}) => {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };
    return fetch(url, { ...options, headers });
  };
  
  return { apiCall };
}
```

### 3.7 Registration Flow

**Current:** `supabase.auth.signUp()`

**Proposed:** `POST /api/auth/register`

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "securepassword",
  "role": "buyer"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

**Note:** Backend registration may differ from Supabase (e.g., no email verification flow, different metadata structure)

### 3.8 Logout Flow

**Current:** `supabase.auth.signOut()`

**Proposed:**
```typescript
const signOut = async () => {
  if (isDemo) {
    exitDemoMode();
    return;
  }
  
  // Remove token and user from localStorage
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  
  // Clear auth state
  setUser(null);
  setToken(null);
  setProfile(null);
  
  // Redirect to auth page
  navigate("/auth");
};
```

**Backend:** No logout endpoint needed (stateless JWT)

### 3.9 Demo Mode Handling

**Current:** Demo mode bypasses all auth, creates fake profile

**Proposed Options:**

**Option A: Keep Demo Mode As-Is**
- Demo mode remains frontend-only
- No backend calls in demo mode
- Demo users cannot perform real actions (create contracts, etc.)

**Option B: Backend Demo Endpoint**
- Create `POST /api/auth/demo-login` endpoint
- Returns a special demo JWT token
- Backend recognizes demo tokens and allows limited actions
- More realistic but requires backend changes

**Recommendation:** **Option A** for initial bridge (simpler, no backend changes)

### 3.10 2FA Integration

**Current LOVABLE:** No 2FA support

**Proposed:**
1. After initial login, check if `requires2FA: true` in response
2. Show 2FA input field in `Auth.tsx`
3. If `twoFactorMethod === "email"`, call `POST /api/auth/2fa/send-login-code`
4. User enters code, resubmits with `twoFactorToken`
5. Backend verifies and returns JWT

**UI Changes:**
- Add 2FA input field to `Auth.tsx` (similar to current backend `/signin` page)
- Show/hide based on `requires2FA` response

### 3.11 User Profile Mapping

**Challenge:** Backend user object may differ from LOVABLE Profile shape

**Backend User Object:**
```typescript
{
  id: string,
  email: string,
  role: string,  // "buyer", "supplier", "trader", "admin", "insurer"
  kycStatus: string,
  twoFactorEnabled: boolean,
  // ... other fields
}
```

**LOVABLE Profile Shape:**
```typescript
{
  id: string,
  email: string,
  first_name: string,
  last_name: string,
  role: UserRole,  // "BUYER", "SUPPLIER", etc. (uppercase)
  organization_id: string,
  organization: { ... }
}
```

**Mapping Strategy:**
```typescript
function mapBackendUserToProfile(backendUser: BackendUser): Profile {
  return {
    id: backendUser.id,
    email: backendUser.email,
    first_name: backendUser.firstName || backendUser.name?.split(' ')[0] || '',
    last_name: backendUser.lastName || backendUser.name?.split(' ')[1] || '',
    role: backendUser.role.toUpperCase() as UserRole,
    organization_id: backendUser.organizationId || null,
    organization: backendUser.organization || null,
    // Map other fields as needed
  };
}
```

**Alternative:** Modify backend to return profile in LOVABLE-compatible format (requires backend changes)

---

## 4. IMPLEMENTATION PLAN

### 4.1 Phase 1: Basic Login Bridge

**Changes Required:**

1. **Modify `AuthContext.tsx`:**
   - Replace `supabase.auth.signInWithPassword()` with `fetch('/api/auth/login')`
   - Store JWT token in `localStorage`
   - Update state management to use backend user object

2. **Modify `Auth.tsx`:**
   - Keep existing UI/UX
   - Update form submission to call backend endpoint
   - Add 2FA input field (hidden by default, shown when `requires2FA: true`)

3. **Add API Interceptor:**
   - Create fetch wrapper or axios interceptor
   - Automatically add `Authorization: Bearer <token>` header

4. **Update `ProtectedRoute`:**
   - Check for `token` instead of Supabase `user`
   - Optionally verify token with backend

### 4.2 Phase 2: Registration Bridge

**Changes Required:**

1. **Modify `AuthContext.signUp()`:**
   - Replace `supabase.auth.signUp()` with `POST /api/auth/register`
   - Handle backend response format

2. **Update Registration Form:**
   - Map LOVABLE form fields to backend expected format
   - Handle backend-specific requirements (e.g., role selection)

### 4.3 Phase 3: Profile & User Data

**Changes Required:**

1. **User Profile Fetching:**
   - Replace Supabase profile queries with backend API calls
   - Map backend user object to LOVABLE Profile shape

2. **Settings Page:**
   - Update to use backend user endpoints
   - Handle backend-specific user fields

### 4.4 Phase 4: Demo Mode (Optional)

**Decision Point:** Keep demo mode frontend-only or add backend support

**If Frontend-Only:**
- No changes needed
- Demo mode continues to work as-is

**If Backend Support:**
- Create `POST /api/auth/demo-login` endpoint
- Return demo JWT token
- Backend recognizes demo tokens and allows limited actions

---

## 5. NON-GOALS / CONSTRAINTS

### 5.1 What We Will NOT Change

1. **Backend Password Hashing:**
   - Backend uses `bcrypt` for password hashing
   - We will NOT change this

2. **Backend User Schema:**
   - Backend user object structure remains unchanged
   - We will NOT modify database schema for auth

3. **Backend JWT Implementation:**
   - Backend JWT secret, expiry, and payload structure remain unchanged
   - We will NOT switch to different token format

4. **Backend Security:**
   - All backend security measures (2FA, role checks, etc.) remain intact
   - We will NOT bypass or weaken backend security

5. **Supabase Removal:**
   - Supabase may still be used for other features (if any)
   - We will NOT remove Supabase entirely (only auth-related usage)

### 5.2 What We Will NOT Do

1. **Switch Backend to Supabase:**
   - Backend will NOT use Supabase for authentication
   - Backend remains independent authentication system

2. **Bypass Backend Auth:**
   - LOVABLE frontend will NOT bypass backend authentication
   - All API calls must include valid JWT token

3. **Change Backend API Contracts:**
   - Backend API endpoints and response formats remain unchanged
   - Frontend will adapt to backend, not vice versa

4. **Remove Demo Mode:**
   - Demo mode will remain available (frontend-only or with backend support)
   - We will NOT remove this feature

---

## 6. KEY DECISIONS SUMMARY

### 6.1 Token Strategy

**Decision:** Use JWT token from backend, stored in `localStorage`

**Rationale:**
- Backend already uses JWT
- Stateless authentication (no server-side session storage)
- Simple to implement
- Token valid for 7 days

**Alternative Considered:** HttpOnly cookies
- **Rejected:** Requires backend changes to set cookies
- Current backend returns token in JSON response

### 6.2 API Request Authentication

**Decision:** Include `Authorization: Bearer <token>` header in all API requests

**Rationale:**
- Backend `authenticateToken` middleware already supports this
- Standard JWT authentication pattern
- Works with fetch, axios, or any HTTP client

### 6.3 Demo Mode

**Decision:** Keep demo mode frontend-only (no backend changes)

**Rationale:**
- Simpler implementation
- No backend changes required
- Demo users can explore UI without real backend access
- Can add backend support later if needed

### 6.4 2FA Support

**Decision:** Implement 2FA support in LOVABLE frontend

**Rationale:**
- Backend already supports 2FA
- Important security feature
- UI changes are minimal (add input field)

### 6.5 Profile Mapping

**Decision:** Map backend user object to LOVABLE Profile shape in frontend

**Rationale:**
- No backend changes required
- Frontend can adapt to backend structure
- Keeps backend independent

---

## 7. RISKS & MITIGATION

### 7.1 Token Expiry

**Risk:** Token expires after 7 days, user must re-login

**Mitigation:**
- Show clear message when token expires
- Redirect to `/auth` with "Session expired" message
- Consider implementing refresh token mechanism in future

### 7.2 Profile Shape Mismatch

**Risk:** Backend user object doesn't match LOVABLE Profile expectations

**Mitigation:**
- Create mapping function to transform backend user to Profile shape
- Handle missing fields gracefully (use defaults)
- Test with real backend user objects

### 7.3 2FA Complexity

**Risk:** 2FA flow may be confusing for users

**Mitigation:**
- Clear UI instructions
- Show 2FA input only when needed
- Support both email and TOTP methods

### 7.4 Demo Mode Limitations

**Risk:** Demo mode doesn't reflect real backend behavior

**Mitigation:**
- Document demo mode limitations
- Consider backend demo endpoint in future
- Show clear indicators when in demo mode

---

## 8. TESTING CHECKLIST

### 8.1 Login Flow
- [ ] User can login with email + password
- [ ] JWT token is stored in localStorage
- [ ] User object is stored in localStorage
- [ ] AuthContext state updates correctly
- [ ] Redirect to dashboard after login

### 8.2 2FA Flow
- [ ] 2FA input appears when `requires2FA: true`
- [ ] Email code can be requested
- [ ] User can submit 2FA code
- [ ] Login completes after 2FA verification

### 8.3 Protected Routes
- [ ] ProtectedRoute redirects to `/auth` when not authenticated
- [ ] ProtectedRoute allows access with valid token
- [ ] Role-based access control works

### 8.4 API Requests
- [ ] All API requests include `Authorization: Bearer <token>` header
- [ ] Backend accepts and verifies token
- [ ] API requests fail with 401 when token is invalid/expired

### 8.5 Logout
- [ ] Logout removes token from localStorage
- [ ] AuthContext state is cleared
- [ ] User is redirected to `/auth`

### 8.6 Demo Mode
- [ ] Demo mode works without backend
- [ ] Demo users can navigate protected routes
- [ ] Demo mode can be exited

---

## 9. NEXT STEPS

After reviewing this plan:

1. **Confirm Bridge Strategy:**
   - Review token storage approach (localStorage vs cookies)
   - Confirm demo mode approach (frontend-only vs backend)
   - Confirm profile mapping strategy

2. **Prioritize Implementation:**
   - Start with Phase 1 (Basic Login Bridge)
   - Then Phase 2 (Registration)
   - Then Phase 3 (Profile & User Data)

3. **Create Implementation Tasks:**
   - Break down into small, testable steps
   - Ensure each step can be tested independently
   - Maintain backward compatibility where possible

4. **Begin Implementation:**
   - Start with AuthContext modifications
   - Test login flow thoroughly
   - Gradually migrate other auth-related features

---

**End of AUTH-BRIDGE-PLAN.md**











