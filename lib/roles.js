// backend/lib/roles.js

function normaliseEmail(value) {
  return (value || '').trim().toLowerCase();
}

/**
 * getUserRoleForContract(userEmail, contract, database)
 * Returns: { contractRole: 'BUYER' | 'SUPPLIER' | 'TRADER' | 'VIEWER', globalRole: 'BUYER' | 'SUPPLIER' | 'TRADER' | 'VIEWER' }
 * 
 * @param {string|Object} userEmail - User email string or user object with email property
 * @param {Object} contract - Contract object with buyerEmail and supplierEmail
 * @param {Object} database - Database object with contracts Map (optional, for globalRole computation)
 * @returns {Object} Role information with contractRole and globalRole
 */
async function getUserRoleForContract(userEmail, contract, database = null) {
  // Handle both string email and user object
  const email = typeof userEmail === 'string' ? userEmail : (userEmail?.email || userEmail?.userEmail);
  
  if (!email || !contract) {
    return { contractRole: 'VIEWER', globalRole: 'VIEWER' };
  }

  const user = normaliseEmail(email);
  const buyer = normaliseEmail(contract.buyerEmail || '');
  const supplier = normaliseEmail(contract.supplierEmail || '');

  // Role for THIS contract
  let contractRole = 'VIEWER';
  if (user === buyer && user === supplier) {
    contractRole = 'TRADER'; // edge case: same email both sides
  } else if (user === buyer) {
    contractRole = 'BUYER';
  } else if (user === supplier) {
    contractRole = 'SUPPLIER';
  }

  // Global role: if user has contracts on both sides in system, treat as TRADER
  let globalRole = contractRole;

  if ((contractRole === 'BUYER' || contractRole === 'SUPPLIER') && database && database.contracts) {
    // Check if user has contracts in the opposite role
    let hasOppositeRole = false;
    
    for (const [contractId, c] of database.contracts.entries()) {
      // Skip current contract
      if (c.id === contract.id || contractId === contract.id) {
        continue;
      }
      
      const cBuyer = normaliseEmail(c.buyerEmail || '');
      const cSupplier = normaliseEmail(c.supplierEmail || '');
      
      // If user is buyer in current contract, check if they're supplier in any other contract
      if (contractRole === 'BUYER' && user === cSupplier && user !== cBuyer) {
        hasOppositeRole = true;
        break;
      }
      
      // If user is supplier in current contract, check if they're buyer in any other contract
      if (contractRole === 'SUPPLIER' && user === cBuyer && user !== cSupplier) {
        hasOppositeRole = true;
        break;
      }
    }

    if (hasOppositeRole) {
      globalRole = 'TRADER';
    }
  }

  return {
    contractRole, // BUYER / SUPPLIER / TRADER / VIEWER (for this contract)
    globalRole,   // TRADER if user has contracts on both sides somewhere
  };
}

function isAdmin(user) {
  // Keep both patterns for backward-compatibility
  return !!user && (user.role === 'admin' || user.isAdmin === true);
}

/**
 * Legacy synchronous version (for backward compatibility)
 * Returns: 'BUYER' | 'SUPPLIER' | 'OTHER' | null
 */
function getUserRoleForContractSync(user, contract) {
  if (!user || !contract) return null;

  const userEmail = normaliseEmail(user.email || user.userEmail);
  const buyerEmail = normaliseEmail(contract.buyerEmail);
  const supplierEmail = normaliseEmail(contract.supplierEmail);

  if (!userEmail) return null;

  if (userEmail === buyerEmail) return 'BUYER';
  if (userEmail === supplierEmail) return 'SUPPLIER';
  return 'OTHER';
}

/**
 * isUserAuthorizedForContract(user, contract, allowedRoles)
 * For now we will only USE this later; STEP R2 can define it
 * without wiring it into all routes.
 */
function isUserAuthorizedForContract(user, contract, allowedRoles = []) {
  if (isAdmin(user)) return true;

  const role = getUserRoleForContract(user, contract);
  if (!role) return false;
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    // If no explicit roles passed, default to "any contextual role"
    return role === 'BUYER' || role === 'SUPPLIER' || role === 'OTHER';
  }
  return allowedRoles.includes(role);
}

/**
 * determineContractParties(userEmail, counterpartyEmail, direction)
 * direction: 'BUY'  -> user is buyer
 *            'SELL' -> user is supplier
 */
function determineContractParties(userEmail, counterpartyEmail, direction) {
  const me = normaliseEmail(userEmail);
  const other = normaliseEmail(counterpartyEmail);

  if (!me || !other) {
    throw new Error('determineContractParties: both emails are required');
  }

  if (direction === 'BUY') {
    return {
      buyerEmail: me,
      supplierEmail: other,
    };
  }

  if (direction === 'SELL') {
    return {
      buyerEmail: other,
      supplierEmail: me,
    };
  }

  throw new Error(
    `determineContractParties: unknown direction "${direction}", expected "BUY" or "SELL"`
  );
}

/**
 * filterContractsByUserRole(contracts, user, roles)
 * Helper for dashboards, not wired in STEP R2 yet.
 */
function filterContractsByUserRole(contracts, user, roles = ['BUYER', 'SUPPLIER']) {
  if (!Array.isArray(contracts)) return [];
  return contracts.filter((c) => roles.includes(getUserRoleForContract(user, c)));
}

module.exports = {
  getUserRoleForContract, // Async version with globalRole
  getUserRoleForContractSync, // Sync version (backward compatibility)
  isUserAuthorizedForContract,
  determineContractParties,
  filterContractsByUserRole,
  isAdmin,
};

