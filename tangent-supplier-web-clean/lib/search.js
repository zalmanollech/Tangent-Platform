const { config } = require('./config');
const logger = require('./logger');

class SearchService {
  constructor() {
    this.searchableFields = {
      trades: [
        'commodity',
        'description',
        'supplier',
        'buyer',
        'status',
        'incoterms',
        'creator_role'
      ],
      users: [
        'email',
        'full_name',
        'company',
        'country',
        'role'
      ],
      kyc_submissions: [
        'entity_type',
        'status'
      ]
    };

    this.filterableFields = {
      trades: {
        commodity: 'string',
        status: 'enum',
        insurance_applied: 'boolean',
        quantity: 'number',
        unit_price: 'number',
        total_value: 'number',
        deposit_pct: 'number',
        created_at: 'date',
        deadline: 'date'
      },
      users: {
        role: 'enum',
        is_active: 'boolean',
        email_verified: 'boolean',
        registration_date: 'date',
        last_login_at: 'date'
      },
      kyc_submissions: {
        status: 'enum',
        risk_score: 'number',
        created_at: 'date',
        reviewed_at: 'date'
      }
    };

    this.sortableFields = {
      trades: [
        'created_at',
        'total_value',
        'quantity',
        'unit_price',
        'deadline',
        'commodity'
      ],
      users: [
        'registration_date',
        'last_login_at',
        'email',
        'full_name'
      ],
      kyc_submissions: [
        'created_at',
        'reviewed_at',
        'risk_score'
      ]
    };
  }

  // Advanced search with filters, sorting, and pagination
  async search(database, table, searchParams) {
    try {
      const {
        query = '',
        filters = {},
        sort = { field: 'created_at', order: 'desc' },
        page = 1,
        limit = 20,
        fields = null
      } = searchParams;

      // Validate table
      if (!this.searchableFields[table]) {
        throw new Error(`Table '${table}' is not searchable`);
      }

      // Get all records from table
      let results;
      if (database.getDatabaseType && database.getDatabaseType() === 'postgresql') {
        results = await this.searchPostgreSQL(database, table, searchParams);
      } else {
        results = await this.searchJSON(database, table, searchParams);
      }

      // Calculate pagination info
      const total = results.totalCount || results.data.length;
      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      return {
        data: results.data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev
        },
        search: {
          query,
          filters,
          sort
        }
      };

    } catch (error) {
      logger.error('Search failed', { table, error: error.message });
      throw error;
    }
  }

  // PostgreSQL search implementation
  async searchPostgreSQL(database, table, searchParams) {
    const {
      query = '',
      filters = {},
      sort = { field: 'created_at', order: 'desc' },
      page = 1,
      limit = 20,
      fields = null
    } = searchParams;

    const client = await database.database.pool.connect();
    
    try {
      let sqlQuery = `SELECT ${fields ? fields.join(', ') : '*'} FROM ${table}`;
      const queryParams = [];
      const whereConditions = [];

      // Add text search
      if (query) {
        const searchFields = this.searchableFields[table];
        const searchConditions = searchFields.map((field, index) => {
          queryParams.push(`%${query}%`);
          return `${field}::text ILIKE $${queryParams.length}`;
        });
        whereConditions.push(`(${searchConditions.join(' OR ')})`);
      }

      // Add filters
      Object.entries(filters).forEach(([field, value]) => {
        if (this.filterableFields[table][field] && value !== undefined && value !== '') {
          const fieldType = this.filterableFields[table][field];
          
          switch (fieldType) {
            case 'string':
              queryParams.push(`%${value}%`);
              whereConditions.push(`${field}::text ILIKE $${queryParams.length}`);
              break;
            
            case 'enum':
            case 'boolean':
              queryParams.push(value);
              whereConditions.push(`${field} = $${queryParams.length}`);
              break;
            
            case 'number':
              if (typeof value === 'object') {
                if (value.min !== undefined) {
                  queryParams.push(value.min);
                  whereConditions.push(`${field} >= $${queryParams.length}`);
                }
                if (value.max !== undefined) {
                  queryParams.push(value.max);
                  whereConditions.push(`${field} <= $${queryParams.length}`);
                }
              } else {
                queryParams.push(value);
                whereConditions.push(`${field} = $${queryParams.length}`);
              }
              break;
            
            case 'date':
              if (typeof value === 'object') {
                if (value.from) {
                  queryParams.push(value.from);
                  whereConditions.push(`${field} >= $${queryParams.length}`);
                }
                if (value.to) {
                  queryParams.push(value.to);
                  whereConditions.push(`${field} <= $${queryParams.length}`);
                }
              } else {
                queryParams.push(value);
                whereConditions.push(`DATE(${field}) = DATE($${queryParams.length})`);
              }
              break;
          }
        }
      });

      // Add WHERE clause
      if (whereConditions.length > 0) {
        sqlQuery += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      // Add sorting
      if (sort.field && this.sortableFields[table].includes(sort.field)) {
        const order = sort.order === 'asc' ? 'ASC' : 'DESC';
        sqlQuery += ` ORDER BY ${sort.field} ${order}`;
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM (${sqlQuery}) as count_query`;
      const countResult = await client.query(countQuery, queryParams);
      const totalCount = parseInt(countResult.rows[0].total);

      // Add pagination
      const offset = (page - 1) * limit;
      queryParams.push(limit, offset);
      sqlQuery += ` LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;

      // Execute search query
      const result = await client.query(sqlQuery, queryParams);

      return {
        data: result.rows,
        totalCount
      };

    } finally {
      client.release();
    }
  }

  // JSON database search implementation
  async searchJSON(database, table, searchParams) {
    const {
      query = '',
      filters = {},
      sort = { field: 'created_at', order: 'desc' },
      page = 1,
      limit = 20,
      fields = null
    } = searchParams;

    // Get all records
    let records = database.getTable(table) || [];

    // Apply text search
    if (query) {
      const searchFields = this.searchableFields[table];
      records = records.filter(record => {
        return searchFields.some(field => {
          const fieldValue = this.getNestedValue(record, field);
          return fieldValue && 
                 fieldValue.toString().toLowerCase().includes(query.toLowerCase());
        });
      });
    }

    // Apply filters
    Object.entries(filters).forEach(([field, value]) => {
      if (this.filterableFields[table][field] && value !== undefined && value !== '') {
        const fieldType = this.filterableFields[table][field];
        
        records = records.filter(record => {
          const fieldValue = this.getNestedValue(record, field);
          
          switch (fieldType) {
            case 'string':
              return fieldValue && 
                     fieldValue.toString().toLowerCase().includes(value.toLowerCase());
            
            case 'enum':
            case 'boolean':
              return fieldValue === value;
            
            case 'number':
              if (typeof value === 'object') {
                const numValue = parseFloat(fieldValue);
                return (!value.min || numValue >= value.min) &&
                       (!value.max || numValue <= value.max);
              } else {
                return parseFloat(fieldValue) === parseFloat(value);
              }
            
            case 'date':
              const recordDate = new Date(fieldValue);
              if (typeof value === 'object') {
                const fromDate = value.from ? new Date(value.from) : null;
                const toDate = value.to ? new Date(value.to) : null;
                return (!fromDate || recordDate >= fromDate) &&
                       (!toDate || recordDate <= toDate);
              } else {
                const searchDate = new Date(value);
                return recordDate.toDateString() === searchDate.toDateString();
              }
            
            default:
              return true;
          }
        });
      }
    });

    // Apply sorting
    if (sort.field && this.sortableFields[table].includes(sort.field)) {
      records.sort((a, b) => {
        const aValue = this.getNestedValue(a, sort.field);
        const bValue = this.getNestedValue(b, sort.field);
        
        let comparison = 0;
        
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;
        
        return sort.order === 'asc' ? comparison : -comparison;
      });
    }

    // Apply pagination
    const total = records.length;
    const offset = (page - 1) * limit;
    const paginatedRecords = records.slice(offset, offset + limit);

    // Apply field selection
    let finalRecords = paginatedRecords;
    if (fields && Array.isArray(fields)) {
      finalRecords = paginatedRecords.map(record => {
        const selected = {};
        fields.forEach(field => {
          selected[field] = this.getNestedValue(record, field);
        });
        return selected;
      });
    }

    return {
      data: finalRecords,
      totalCount: total
    };
  }

  // Autocomplete suggestions
  async getAutocompleteSuggestions(database, table, field, query, limit = 10) {
    try {
      if (!this.searchableFields[table] || !this.searchableFields[table].includes(field)) {
        throw new Error(`Field '${field}' is not searchable in table '${table}'`);
      }

      let suggestions;
      
      if (database.getDatabaseType && database.getDatabaseType() === 'postgresql') {
        suggestions = await this.getAutocompletePostgreSQL(database, table, field, query, limit);
      } else {
        suggestions = await this.getAutocompleteJSON(database, table, field, query, limit);
      }

      return suggestions;

    } catch (error) {
      logger.error('Autocomplete failed', { table, field, error: error.message });
      throw error;
    }
  }

  async getAutocompletePostgreSQL(database, table, field, query, limit) {
    const client = await database.database.pool.connect();
    
    try {
      const sqlQuery = `
        SELECT DISTINCT ${field} as suggestion, COUNT(*) as frequency
        FROM ${table}
        WHERE ${field}::text ILIKE $1
        GROUP BY ${field}
        ORDER BY frequency DESC, ${field} ASC
        LIMIT $2
      `;
      
      const result = await client.query(sqlQuery, [`%${query}%`, limit]);
      
      return result.rows.map(row => ({
        value: row.suggestion,
        frequency: parseInt(row.frequency)
      }));

    } finally {
      client.release();
    }
  }

  async getAutocompleteJSON(database, table, field, query, limit) {
    const records = database.getTable(table) || [];
    const suggestions = {};

    // Count occurrences of each unique value
    records.forEach(record => {
      const value = this.getNestedValue(record, field);
      if (value && value.toString().toLowerCase().includes(query.toLowerCase())) {
        const key = value.toString();
        suggestions[key] = (suggestions[key] || 0) + 1;
      }
    });

    // Convert to array and sort by frequency
    return Object.entries(suggestions)
      .map(([value, frequency]) => ({ value, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  // Faceted search (aggregations)
  async getFacets(database, table, searchParams = {}) {
    try {
      let facets;
      
      if (database.getDatabaseType && database.getDatabaseType() === 'postgresql') {
        facets = await this.getFacetsPostgreSQL(database, table, searchParams);
      } else {
        facets = await this.getFacetsJSON(database, table, searchParams);
      }

      return facets;

    } catch (error) {
      logger.error('Facets calculation failed', { table, error: error.message });
      throw error;
    }
  }

  async getFacetsPostgreSQL(database, table, searchParams) {
    const client = await database.database.pool.connect();
    const facets = {};
    
    try {
      // Get facets for enum fields
      const enumFields = Object.entries(this.filterableFields[table])
        .filter(([field, type]) => type === 'enum')
        .map(([field]) => field);

      for (const field of enumFields) {
        const query = `
          SELECT ${field} as value, COUNT(*) as count
          FROM ${table}
          WHERE ${field} IS NOT NULL
          GROUP BY ${field}
          ORDER BY count DESC
        `;
        
        const result = await client.query(query);
        facets[field] = result.rows.map(row => ({
          value: row.value,
          count: parseInt(row.count)
        }));
      }

      // Get numeric range facets
      const numericFields = Object.entries(this.filterableFields[table])
        .filter(([field, type]) => type === 'number')
        .map(([field]) => field);

      for (const field of numericFields) {
        const query = `
          SELECT 
            MIN(${field}) as min_value,
            MAX(${field}) as max_value,
            AVG(${field}) as avg_value
          FROM ${table}
          WHERE ${field} IS NOT NULL
        `;
        
        const result = await client.query(query);
        if (result.rows[0]) {
          facets[field] = {
            min: parseFloat(result.rows[0].min_value) || 0,
            max: parseFloat(result.rows[0].max_value) || 0,
            avg: parseFloat(result.rows[0].avg_value) || 0
          };
        }
      }

    } finally {
      client.release();
    }

    return facets;
  }

  async getFacetsJSON(database, table, searchParams) {
    const records = database.getTable(table) || [];
    const facets = {};

    // Get facets for enum fields
    const enumFields = Object.entries(this.filterableFields[table])
      .filter(([field, type]) => type === 'enum')
      .map(([field]) => field);

    enumFields.forEach(field => {
      const counts = {};
      records.forEach(record => {
        const value = this.getNestedValue(record, field);
        if (value) {
          counts[value] = (counts[value] || 0) + 1;
        }
      });

      facets[field] = Object.entries(counts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
    });

    // Get numeric range facets
    const numericFields = Object.entries(this.filterableFields[table])
      .filter(([field, type]) => type === 'number')
      .map(([field]) => field);

    numericFields.forEach(field => {
      const values = records
        .map(record => parseFloat(this.getNestedValue(record, field)))
        .filter(value => !isNaN(value));

      if (values.length > 0) {
        facets[field] = {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((sum, val) => sum + val, 0) / values.length
        };
      }
    });

    return facets;
  }

  // Utility method to get nested object values
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  // Build search query from URL parameters
  parseSearchParams(queryParams) {
    const searchParams = {
      query: queryParams.q || '',
      filters: {},
      sort: {
        field: queryParams.sort_field || 'created_at',
        order: queryParams.sort_order || 'desc'
      },
      page: parseInt(queryParams.page) || 1,
      limit: parseInt(queryParams.limit) || 20,
      fields: queryParams.fields ? queryParams.fields.split(',') : null
    };

    // Parse filters
    Object.entries(queryParams).forEach(([key, value]) => {
      if (key.startsWith('filter_')) {
        const filterField = key.replace('filter_', '');
        
        // Handle range filters (e.g., filter_price_min, filter_price_max)
        if (filterField.endsWith('_min') || filterField.endsWith('_max')) {
          const baseField = filterField.replace(/_min|_max$/, '');
          const rangeType = filterField.endsWith('_min') ? 'min' : 'max';
          
          if (!searchParams.filters[baseField]) {
            searchParams.filters[baseField] = {};
          }
          searchParams.filters[baseField][rangeType] = value;
        } else {
          searchParams.filters[filterField] = value;
        }
      }
    });

    return searchParams;
  }

  // Generate search URL
  buildSearchURL(baseURL, searchParams) {
    const params = new URLSearchParams();
    
    if (searchParams.query) {
      params.append('q', searchParams.query);
    }
    
    Object.entries(searchParams.filters).forEach(([field, value]) => {
      if (typeof value === 'object') {
        Object.entries(value).forEach(([subKey, subValue]) => {
          if (subValue !== undefined && subValue !== '') {
            params.append(`filter_${field}_${subKey}`, subValue);
          }
        });
      } else if (value !== undefined && value !== '') {
        params.append(`filter_${field}`, value);
      }
    });
    
    if (searchParams.sort.field !== 'created_at') {
      params.append('sort_field', searchParams.sort.field);
    }
    
    if (searchParams.sort.order !== 'desc') {
      params.append('sort_order', searchParams.sort.order);
    }
    
    if (searchParams.page > 1) {
      params.append('page', searchParams.page);
    }
    
    if (searchParams.limit !== 20) {
      params.append('limit', searchParams.limit);
    }
    
    return `${baseURL}?${params.toString()}`;
  }

  // Get search statistics
  async getSearchStats(database, table) {
    try {
      let stats;
      
      if (database.getDatabaseType && database.getDatabaseType() === 'postgresql') {
        stats = await this.getSearchStatsPostgreSQL(database, table);
      } else {
        stats = await this.getSearchStatsJSON(database, table);
      }

      return stats;

    } catch (error) {
      logger.error('Search stats failed', { table, error: error.message });
      throw error;
    }
  }

  async getSearchStatsPostgreSQL(database, table) {
    const client = await database.database.pool.connect();
    
    try {
      const query = `
        SELECT 
          COUNT(*) as total_records,
          COUNT(DISTINCT ${this.searchableFields[table][0]}) as unique_values
        FROM ${table}
      `;
      
      const result = await client.query(query);
      
      return {
        totalRecords: parseInt(result.rows[0].total_records),
        uniqueValues: parseInt(result.rows[0].unique_values),
        searchableFields: this.searchableFields[table],
        filterableFields: Object.keys(this.filterableFields[table]),
        sortableFields: this.sortableFields[table]
      };

    } finally {
      client.release();
    }
  }

  async getSearchStatsJSON(database, table) {
    const records = database.getTable(table) || [];
    const uniqueValues = new Set();
    
    records.forEach(record => {
      const value = this.getNestedValue(record, this.searchableFields[table][0]);
      if (value) uniqueValues.add(value);
    });

    return {
      totalRecords: records.length,
      uniqueValues: uniqueValues.size,
      searchableFields: this.searchableFields[table],
      filterableFields: Object.keys(this.filterableFields[table]),
      sortableFields: this.sortableFields[table]
    };
  }
}

// Export singleton instance
module.exports = new SearchService();




