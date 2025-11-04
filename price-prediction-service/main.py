# Agricultural Commodity Price Prediction Service
# Analyzes news data and predicts prices for next 6 months
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import json

try:
    from price_predictor import PricePredictor
    from news_analyzer import NewsAnalyzer
    from enhanced_analyzer import EnhancedAnalyzer
except ImportError as e:
    print(f"Warning: Could not import modules: {e}")
    PricePredictor = None
    NewsAnalyzer = None
    EnhancedAnalyzer = None

app = FastAPI(title="Agricultural Commodity Price Prediction Service", version="1.0.0")

# Add CORS middleware - allow Tangent Platform to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:4000", "http://127.0.0.1:4000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
if PricePredictor and NewsAnalyzer:
    price_predictor = PricePredictor()
    news_analyzer = NewsAnalyzer()
    enhanced_analyzer = EnhancedAnalyzer() if EnhancedAnalyzer else None
else:
    price_predictor = None
    news_analyzer = None
    enhanced_analyzer = None

@app.get("/")
def root():
    return {
        "message": "Agricultural Commodity Price Prediction API v1.0",
        "status": "running",
        "commodities": ["wheat", "soy", "corn", "sugar", "coffee"]
    }

@app.get("/health")
def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

class ForecastRequest(BaseModel):
    commodity: str  # wheat, soy, corn, sugar, coffee
    date: Optional[str] = None  # Optional specific date, defaults to today

@app.post("/api/forecast")
async def get_forecast(request: ForecastRequest):
    """
    Get 6-month price forecast for a commodity
    Returns: price predictions, buy/sell signals, recommended delivery periods
    """
    try:
        commodity = request.commodity.lower()
        target_date = datetime.now()
        if request.date:
            target_date = datetime.fromisoformat(request.date)
        
        # Validate commodity
        valid_commodities = ["wheat", "soy", "corn", "sugar", "coffee"]
        if commodity not in valid_commodities:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid commodity. Must be one of: {', '.join(valid_commodities)}"
            )
        
        # Enhanced analysis pipeline
        analysis_results = {}
        
        # 1. News analysis (real-time)
        if not news_analyzer:
            raise HTTPException(status_code=500, detail="News analyzer not initialized")
        news_analysis = await news_analyzer.analyze_commodity_news(commodity)
        analysis_results["news"] = news_analysis
        
        # 2. Enhanced analysis (if available)
        if enhanced_analyzer:
            # Historical news patterns (10 years)
            historical_analysis = await enhanced_analyzer.analyze_historical_news(commodity, years_back=10)
            analysis_results["historical"] = historical_analysis
            
            # Weather patterns
            commodity_regions = {
                "wheat": ["USA", "Russia", "Canada", "Argentina", "Australia", "Brazil"],
                "soy": ["Brazil", "USA", "Argentina"],
                "corn": ["USA", "China", "Brazil", "Argentina"],
                "sugar": ["Brazil", "India", "Thailand"],
                "coffee": ["Brazil", "Vietnam", "Colombia", "Indonesia", "Ethiopia"]
            }
            weather_analysis = await enhanced_analyzer.analyze_weather_patterns(
                commodity, 
                commodity_regions.get(commodity, [])
            )
            analysis_results["weather"] = weather_analysis
            
            # Geopolitical risks
            geopolitical_analysis = await enhanced_analyzer.analyze_geopolitical_risks(commodity)
            analysis_results["geopolitical"] = geopolitical_analysis
            
            # Price comparison (exchanges vs publications vs FOB)
            price_comparison = await enhanced_analyzer.compare_prices_and_recommend(commodity)
            analysis_results["price_comparison"] = price_comparison
            
            # Freight route analysis
            freight_routes = await enhanced_analyzer.analyze_freight_routes(commodity)
            analysis_results["freight_routes"] = freight_routes
        
        # Generate price forecast (enhanced with all analysis)
        if not price_predictor:
            raise HTTPException(status_code=500, detail="Price predictor not initialized")
        
        # Combine all analysis for forecasting
        enhanced_news_analysis = news_analysis.copy()
        if enhanced_analyzer:
            # Add weather impact
            if "weather" in analysis_results:
                weather_impact = analysis_results["weather"].get("impact_on_prices", {})
                if weather_impact:
                    enhanced_news_analysis["weather_impact"] = weather_impact
            
            # Add geopolitical impact
            if "geopolitical" in analysis_results:
                geo_impact = analysis_results["geopolitical"].get("impact_on_prices", {})
                if geo_impact:
                    enhanced_news_analysis["geopolitical_impact"] = geo_impact
        
        forecast = price_predictor.predict_6month(commodity, target_date, enhanced_news_analysis)
        
        # Determine buy/sell signal and delivery recommendations
        recommendations = price_predictor.get_recommendations(forecast, commodity, target_date)
        
        # Add enhanced buy location recommendations
        if enhanced_analyzer and "price_comparison" in analysis_results:
            recommendations["buy_locations"] = analysis_results["price_comparison"].get("price_comparison", [])
            recommendations["best_buy_location"] = analysis_results["price_comparison"].get("best_buy_location", {})
        
        response = {
            "success": True,
            "commodity": commodity,
            "date": target_date.isoformat(),
            "forecast": forecast,
            "signal": recommendations["signal"],
            "signal_strength": recommendations["signal_strength"],
            "recommended_delivery": recommendations["delivery_periods"],
            "countries": recommendations["countries"],
            "factors": recommendations["factors"],
            "news_insights": news_analysis.get("insights", [])
        }
        
        # Add enhanced analysis results
        if enhanced_analyzer:
            response["enhanced_analysis"] = {
                "historical_patterns": analysis_results.get("historical", {}),
                "weather_conditions": analysis_results.get("weather", {}),
                "geopolitical_risks": analysis_results.get("geopolitical", {}),
                "price_comparison": analysis_results.get("price_comparison", {}),
                "freight_routes": analysis_results.get("freight_routes", {})
            }
            
            # Add buy location recommendations
            if "buy_locations" in recommendations:
                response["buy_locations"] = recommendations["buy_locations"]
                response["best_buy_location"] = recommendations["best_buy_location"]
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating forecast: {str(e)}")

@app.post("/api/forecast/batch")
async def get_batch_forecast(commodities: List[str]):
    """
    Get forecasts for multiple commodities at once
    """
    try:
        results = {}
        for commodity in commodities:
            try:
                request = ForecastRequest(commodity=commodity)
                forecast_data = await get_forecast(request)
                results[commodity] = forecast_data
            except Exception as e:
                results[commodity] = {"error": str(e)}
        
        return {"success": True, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in batch forecast: {str(e)}")

@app.on_event("startup")
async def startup_event():
    print("🚀 Agricultural Commodity Price Prediction Service started!")
    print("📊 Ready to analyze news and predict prices for: wheat, soy, corn, sugar, coffee")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)

