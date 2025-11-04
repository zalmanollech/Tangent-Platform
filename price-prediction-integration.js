/**
 * TANGENT Price Prediction Integration Layer
 * 
 * This module provides seamless integration between Tangent Platform
 * and the Agricultural Commodity Price Prediction Service.
 */

const axios = require('axios');

// Configuration
const PRICE_PREDICTION_SERVICE_CONFIG = {
    baseURL: process.env.PRICE_PREDICTION_SERVICE_URL || 'http://localhost:8003',
    timeout: 60000, // 60 seconds (ML predictions can take time)
    retryAttempts: 2,
    retryDelay: 2000, // 2 seconds
};

/**
 * Check if price prediction service is healthy
 */
async function checkPricePredictionServiceHealth() {
    try {
        const response = await axios.get(
            `${PRICE_PREDICTION_SERVICE_CONFIG.baseURL}/health`,
            { timeout: 5000 }
        );
        return response.data;
    } catch (error) {
        console.warn('[WARN] Price prediction service health check failed:', error.message);
        return { status: 'unhealthy', error: error.message };
    }
}

/**
 * Get price forecast for a commodity
 * @param {string} commodity - Commodity name (wheat, soy, corn, sugar, coffee)
 * @param {string} date - Optional date (ISO format), defaults to today
 * @returns {Promise<Object>} Forecast data with predictions, signals, and recommendations
 */
async function getPriceForecast(commodity, date = null) {
    try {
        const payload = {
            commodity: commodity,
            date: date || new Date().toISOString()
        };
        
        const response = await axios.post(
            `${PRICE_PREDICTION_SERVICE_CONFIG.baseURL}/api/forecast`,
            payload,
            { timeout: PRICE_PREDICTION_SERVICE_CONFIG.timeout }
        );
        
        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        console.error('[ERROR] Price forecast request failed:', error.message);
        
        // Return mock data if service is unavailable
        if (error.code === 'ECONNREFUSED' || error.response?.status >= 500) {
            console.warn('[WARN] Price prediction service unavailable, returning mock data');
            return {
                success: false,
                data: generateMockForecast(commodity),
                error: 'Service unavailable, using mock data'
            };
        }
        
        throw error;
    }
}

/**
 * Get batch forecasts for multiple commodities
 * @param {Array<string>} commodities - Array of commodity names
 * @returns {Promise<Object>} Forecasts for all commodities
 */
async function getBatchForecasts(commodities) {
    try {
        const response = await axios.post(
            `${PRICE_PREDICTION_SERVICE_CONFIG.baseURL}/api/forecast/batch`,
            commodities,
            { timeout: PRICE_PREDICTION_SERVICE_CONFIG.timeout * commodities.length }
        );
        
        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        console.error('[ERROR] Batch forecast request failed:', error.message);
        throw error;
    }
}

/**
 * Generate mock forecast data when service is unavailable
 * @param {string} commodity - Commodity name
 * @returns {Object} Mock forecast data
 */
function generateMockForecast(commodity) {
    const basePrices = {
        wheat: 245.0,
        soy: 485.0,
        corn: 195.0,
        sugar: 550.0,
        coffee: 3200.0
    };
    
    const basePrice = basePrices[commodity] || 200.0;
    const forecasts = [];
    const today = new Date();
    
    for (let i = 1; i <= 6; i++) {
        const futureDate = new Date(today);
        futureDate.setMonth(today.getMonth() + i);
        
        // Simple mock: slight variation around base price
        const variation = (Math.random() - 0.5) * 0.1; // ±5%
        const price = basePrice * (1 + variation);
        
        forecasts.push({
            month: i,
            date: futureDate.toISOString().substring(0, 7),
            price: Math.round(price * 100) / 100,
            confidence: Math.max(0.5, 0.95 - (i * 0.08)),
            trend: variation > 0 ? 'up' : 'down'
        });
    }
    
    // Determine signal based on average price
    const avgPrice = forecasts.reduce((sum, f) => sum + f.price, 0) / forecasts.length;
    const signal = avgPrice > basePrice ? 'BUY' : (avgPrice < basePrice * 0.95 ? 'SELL' : 'HOLD');
    
    // Find best buying month
    const bestBuy = forecasts.reduce((best, f) => f.price < best.price ? f : best);
    const quarter = Math.floor((today.getMonth() + bestBuy.month - 1) / 3) + 1;
    const year = new Date(today.getFullYear(), today.getMonth() + bestBuy.month, 1).getFullYear();
    
    return {
        commodity: commodity,
        date: today.toISOString(),
        forecast: forecasts,
        signal: signal,
        signal_strength: 0.65,
        recommended_delivery: [{
            period: `FOB Q${quarter}-${year}`,
            price: bestBuy.price,
            savings_pct: ((basePrice - bestBuy.price) / basePrice * 100).toFixed(2),
            month: bestBuy.month,
            recommendation: 'BUY'
        }],
        countries: ['USA', 'Brazil', 'Argentina'],
        factors: {
            price_change_pct: ((avgPrice - basePrice) / basePrice * 100).toFixed(2),
            forecast_range: `$${Math.min(...forecasts.map(f => f.price)).toFixed(2)} - $${Math.max(...forecasts.map(f => f.price)).toFixed(2)}`,
            avg_price: avgPrice.toFixed(2),
            current_price: basePrice.toFixed(2),
            best_buy_price: bestBuy.price.toFixed(2),
            volatility: '8.0'
        },
        news_insights: ['Mock data - service unavailable']
    };
}

module.exports = {
    checkPricePredictionServiceHealth,
    getPriceForecast,
    getBatchForecasts
};


