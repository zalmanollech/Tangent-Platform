const express = require('express');
const router = express.Router();
const { getDatabase } = require('../lib/database-enhanced');
const { authMiddleware } = require('../lib/security');
const { logUtils } = require('../lib/logger');
const searchService = require('../lib/search');

// Search trades
router.get('/trades', authMiddleware.requireAuth, async (req, res) => {
  try {
    const db = await getDatabase();
    const searchParams = searchService.parseSearchParams(req.query);
    
    // Add user-specific filters if not admin
    if (req.user.role !== 'admin') {
      // Users can only search trades they're involved in or public trades
      searchParams.filters.user_involved = req.user.id;
    }
    
    const results = await searchService.search(db, 'trades', searchParams);
    
    // Log search activity
    logUtils.logBusiness('trade_search', {
      query: searchParams.query,
      filters: Object.keys(searchParams.filters),
      resultsCount: results.data.length
    }, req.user.id);
    
    res.json({
      success: true,
      ...results
    });

  } catch (error) {
    logUtils.logError(error, { action: 'search_trades' }, req);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Search users (admin only)
router.get('/users', authMiddleware.requireAdmin, async (req, res) => {
  try {
    const db = await getDatabase();
    const searchParams = searchService.parseSearchParams(req.query);
    
    const results = await searchService.search(db, 'users', searchParams);
    
    // Remove sensitive data from results
    results.data = results.data.map(user => {
      const { pass_hash, passHash, verification_token, reset_token, ...safeUser } = user;
      return safeUser;
    });
    
    logUtils.logBusiness('user_search', {
      query: searchParams.query,
      filters: Object.keys(searchParams.filters),
      resultsCount: results.data.length
    }, req.user.id);
    
    res.json({
      success: true,
      ...results
    });

  } catch (error) {
    logUtils.logError(error, { action: 'search_users' }, req);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Search KYC submissions (admin only)
router.get('/kyc', authMiddleware.requireAdmin, async (req, res) => {
  try {
    const db = await getDatabase();
    const searchParams = searchService.parseSearchParams(req.query);
    
    const results = await searchService.search(db, 'kyc_submissions', searchParams);
    
    logUtils.logBusiness('kyc_search', {
      query: searchParams.query,
      filters: Object.keys(searchParams.filters),
      resultsCount: results.data.length
    }, req.user.id);
    
    res.json({
      success: true,
      ...results
    });

  } catch (error) {
    logUtils.logError(error, { action: 'search_kyc' }, req);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get autocomplete suggestions
router.get('/autocomplete/:table/:field', authMiddleware.requireAuth, async (req, res) => {
  try {
    const { table, field } = req.params;
    const { q: query, limit = 10 } = req.query;
    
    // Security check - users can only autocomplete certain tables
    const allowedTables = {
      'buyer': ['trades'],
      'supplier': ['trades'], 
      'admin': ['trades', 'users', 'kyc_submissions']
    };
    
    if (!allowedTables[req.user.role] || !allowedTables[req.user.role].includes(table)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!query || query.length < 2) {
      return res.json({ success: true, suggestions: [] });
    }
    
    const db = await getDatabase();
    const suggestions = await searchService.getAutocompleteSuggestions(
      db, 
      table, 
      field, 
      query, 
      parseInt(limit)
    );
    
    res.json({
      success: true,
      suggestions,
      field,
      query
    });

  } catch (error) {
    logUtils.logError(error, { 
      action: 'autocomplete', 
      table: req.params.table, 
      field: req.params.field 
    }, req);
    res.status(500).json({ error: 'Autocomplete failed' });
  }
});

// Get search facets (aggregations)
router.get('/facets/:table', authMiddleware.requireAuth, async (req, res) => {
  try {
    const { table } = req.params;
    
    // Security check
    const allowedTables = {
      'buyer': ['trades'],
      'supplier': ['trades'], 
      'admin': ['trades', 'users', 'kyc_submissions']
    };
    
    if (!allowedTables[req.user.role] || !allowedTables[req.user.role].includes(table)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const db = await getDatabase();
    const searchParams = searchService.parseSearchParams(req.query);
    const facets = await searchService.getFacets(db, table, searchParams);
    
    res.json({
      success: true,
      facets,
      table
    });

  } catch (error) {
    logUtils.logError(error, { action: 'get_facets', table: req.params.table }, req);
    res.status(500).json({ error: 'Failed to get facets' });
  }
});

// Get search statistics
router.get('/stats/:table', authMiddleware.requireAuth, async (req, res) => {
  try {
    const { table } = req.params;
    
    // Security check
    const allowedTables = {
      'buyer': ['trades'],
      'supplier': ['trades'], 
      'admin': ['trades', 'users', 'kyc_submissions']
    };
    
    if (!allowedTables[req.user.role] || !allowedTables[req.user.role].includes(table)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const db = await getDatabase();
    const stats = await searchService.getSearchStats(db, table);
    
    res.json({
      success: true,
      stats,
      table
    });

  } catch (error) {
    logUtils.logError(error, { action: 'get_search_stats', table: req.params.table }, req);
    res.status(500).json({ error: 'Failed to get search statistics' });
  }
});

// Advanced trade search with custom filters
router.post('/trades/advanced', authMiddleware.requireAuth, async (req, res) => {
  try {
    const {
      textQuery = '',
      commodities = [],
      statuses = [],
      priceRange = {},
      quantityRange = {},
      dateRange = {},
      hasInsurance = null,
      countries = [],
      incoterms = [],
      sort = { field: 'created_at', order: 'desc' },
      page = 1,
      limit = 20
    } = req.body;
    
    // Build search parameters
    const searchParams = {
      query: textQuery,
      filters: {},
      sort,
      page,
      limit
    };
    
    // Add commodity filter
    if (commodities.length > 0) {
      searchParams.filters.commodity = commodities;
    }
    
    // Add status filter
    if (statuses.length > 0) {
      searchParams.filters.status = statuses;
    }
    
    // Add price range filter
    if (priceRange.min !== undefined || priceRange.max !== undefined) {
      searchParams.filters.unit_price = priceRange;
    }
    
    // Add quantity range filter
    if (quantityRange.min !== undefined || quantityRange.max !== undefined) {
      searchParams.filters.quantity = quantityRange;
    }
    
    // Add date range filter
    if (dateRange.from || dateRange.to) {
      searchParams.filters.created_at = dateRange;
    }
    
    // Add insurance filter
    if (hasInsurance !== null) {
      searchParams.filters.insurance_applied = hasInsurance;
    }
    
    // Add incoterms filter
    if (incoterms.length > 0) {
      searchParams.filters.incoterms = incoterms;
    }
    
    // Add user-specific filters if not admin
    if (req.user.role !== 'admin') {
      searchParams.filters.user_involved = req.user.id;
    }
    
    const db = await getDatabase();
    const results = await searchService.search(db, 'trades', searchParams);
    
    // Enhance results with additional data
    results.data = await Promise.all(results.data.map(async trade => {
      // Add creator information if available
      if (trade.creator_id) {
        try {
          const creator = await db.findById('users', trade.creator_id);
          if (creator) {
            trade.creator = {
              id: creator.id,
              email: creator.email,
              fullName: creator.full_name || creator.fullName,
              company: creator.company
            };
          }
        } catch (error) {
          // Ignore creator lookup errors
        }
      }
      
      return trade;
    }));
    
    logUtils.logBusiness('advanced_trade_search', {
      textQuery,
      filterCount: Object.keys(searchParams.filters).length,
      resultsCount: results.data.length
    }, req.user.id);
    
    res.json({
      success: true,
      ...results,
      searchCriteria: {
        textQuery,
        commodities,
        statuses,
        priceRange,
        quantityRange,
        dateRange,
        hasInsurance,
        countries,
        incoterms
      }
    });

  } catch (error) {
    logUtils.logError(error, { action: 'advanced_trade_search' }, req);
    res.status(500).json({ error: 'Advanced search failed' });
  }
});

// Export saved searches (future feature)
router.get('/saved', authMiddleware.requireAuth, async (req, res) => {
  try {
    // This would typically fetch saved searches from database
    // For now, return empty array
    
    res.json({
      success: true,
      savedSearches: []
    });

  } catch (error) {
    logUtils.logError(error, { action: 'get_saved_searches' }, req);
    res.status(500).json({ error: 'Failed to get saved searches' });
  }
});

// Save search (future feature)
router.post('/saved', authMiddleware.requireAuth, async (req, res) => {
  try {
    const { name, searchParams, table } = req.body;
    
    if (!name || !searchParams || !table) {
      return res.status(400).json({ error: 'Name, search parameters, and table are required' });
    }
    
    // This would typically save to database
    // For now, just return success
    
    logUtils.logBusiness('search_saved', {
      name,
      table,
      userId: req.user.id
    }, req.user.id);
    
    res.json({
      success: true,
      message: 'Search saved successfully',
      savedSearch: {
        id: Date.now().toString(),
        name,
        searchParams,
        table,
        userId: req.user.id,
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logUtils.logError(error, { action: 'save_search' }, req);
    res.status(500).json({ error: 'Failed to save search' });
  }
});

// Get search suggestions based on user history
router.get('/suggestions', authMiddleware.requireAuth, async (req, res) => {
  try {
    // This would typically analyze user's search history
    // For now, return common suggestions
    
    const suggestions = {
      commodities: ['Sugar', 'Rice', 'Wheat', 'Corn', 'Coffee', 'Cocoa'],
      statuses: ['created', 'active', 'completed', 'cancelled'],
      incoterms: ['FOB', 'CIF', 'EXW', 'DDP', 'FCA'],
      countries: ['USA', 'Brazil', 'India', 'China', 'Germany', 'United Kingdom'],
      priceRanges: [
        { min: 0, max: 100, label: 'Under $100' },
        { min: 100, max: 500, label: '$100 - $500' },
        { min: 500, max: 1000, label: '$500 - $1,000' },
        { min: 1000, max: 5000, label: '$1,000 - $5,000' },
        { min: 5000, max: null, label: 'Over $5,000' }
      ]
    };
    
    res.json({
      success: true,
      suggestions
    });

  } catch (error) {
    logUtils.logError(error, { action: 'get_search_suggestions' }, req);
    res.status(500).json({ error: 'Failed to get search suggestions' });
  }
});

module.exports = router;


