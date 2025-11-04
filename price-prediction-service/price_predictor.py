# Price Predictor for Agricultural Commodities
# Uses historical data, news analysis, and time series forecasting
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import json

class PricePredictor:
    def __init__(self):
        # Base prices (USD per metric ton) - these would come from live market data
        self.base_prices = {
            "wheat": 245.0,
            "soy": 485.0,
            "corn": 195.0,
            "sugar": 550.0,
            "coffee": 3200.0  # per ton
        }
        
        # Historical price volatility (standard deviation %)
        self.volatility = {
            "wheat": 0.08,
            "soy": 0.10,
            "corn": 0.09,
            "sugar": 0.12,
            "coffee": 0.15
        }
        
        # Seasonal patterns (monthly multipliers)
        self.seasonal_patterns = {
            "wheat": {
                1: 1.02, 2: 1.01, 3: 0.98, 4: 0.97, 5: 0.96, 6: 0.95,
                7: 0.94, 8: 0.96, 9: 0.98, 10: 1.00, 11: 1.01, 12: 1.02
            },
            "soy": {
                1: 1.01, 2: 1.00, 3: 0.99, 4: 0.98, 5: 0.97, 6: 0.96,
                7: 0.97, 8: 0.98, 9: 1.00, 10: 1.02, 11: 1.03, 12: 1.02
            },
            "corn": {
                1: 1.00, 2: 0.99, 3: 0.98, 4: 0.97, 5: 0.96, 6: 0.95,
                7: 0.94, 8: 0.95, 9: 0.97, 10: 0.99, 11: 1.01, 12: 1.02
            },
            "sugar": {
                1: 1.01, 2: 1.00, 3: 0.99, 4: 0.98, 5: 0.97, 6: 0.96,
                7: 0.97, 8: 0.98, 9: 1.00, 10: 1.02, 11: 1.03, 12: 1.02
            },
            "coffee": {
                1: 1.02, 2: 1.01, 3: 1.00, 4: 0.99, 5: 0.98, 6: 0.97,
                7: 0.98, 9: 1.00, 10: 1.01, 11: 1.02, 12: 1.02
            }
        }
        
        # Top producing/exporting countries for each commodity
        self.country_map = {
            "wheat": ["USA", "Russia", "Canada", "Argentina", "Australia", "Brazil"],
            "soy": ["Brazil", "USA", "Argentina", "China", "India"],
            "corn": ["USA", "China", "Brazil", "Argentina", "Ukraine"],
            "sugar": ["Brazil", "India", "Thailand", "China", "USA"],
            "coffee": ["Brazil", "Vietnam", "Colombia", "Indonesia", "Ethiopia"]
        }
    
    def predict_6month(self, commodity: str, start_date: datetime, news_analysis: Dict) -> List[Dict]:
        """
        Predict prices for next 6 months
        Returns: List of monthly forecasts with price, confidence, trend
        """
        base_price = self.base_prices.get(commodity, 200.0)
        volatility = self.volatility.get(commodity, 0.10)
        seasonal = self.seasonal_patterns.get(commodity, {})
        
        # Get news impact
        news_sentiment = news_analysis.get("sentiment", 0.0)
        news_impact = news_analysis.get("impact_score", 0.0)
        
        # Combine news impact with sentiment
        combined_impact = (news_sentiment * 0.3) + (news_impact * 0.7)
        
        forecasts = []
        current_date = start_date
        
        for month_offset in range(1, 7):  # Next 6 months
            forecast_date = current_date + timedelta(days=30 * month_offset)
            month = forecast_date.month
            
            # Get seasonal multiplier
            seasonal_mult = seasonal.get(month, 1.0)
            
            # Calculate trend (slight upward trend over time with noise)
            trend_factor = 1.0 + (month_offset * 0.005)  # Slight upward trend
            
            # Apply news impact (decays over time)
            news_decay = max(0.3, 1.0 - (month_offset * 0.15))  # Impact decreases over time
            news_effect = combined_impact * news_decay
            
            # Calculate price with all factors
            price = base_price * seasonal_mult * trend_factor * (1 + news_effect)
            
            # Add some randomness (volatility)
            price_change = np.random.normal(0, volatility * 0.5)  # Reduced randomness for more stable predictions
            price = price * (1 + price_change)
            
            # Calculate confidence (decreases over time)
            confidence = max(0.5, 0.95 - (month_offset * 0.08))
            
            # Determine trend
            if month_offset == 1:
                trend = "up" if price > base_price else "down"
            else:
                prev_price = forecasts[-1]["price"]
                trend = "up" if price > prev_price else "down"
            
            forecasts.append({
                "month": month_offset,
                "date": forecast_date.strftime("%Y-%m"),
                "price": round(price, 2),
                "confidence": round(confidence, 2),
                "trend": trend,
                "seasonal_factor": round(seasonal_mult, 3),
                "news_impact": round(news_effect, 3)
            })
        
        return forecasts
    
    def get_recommendations(self, forecast: List[Dict], commodity: str, current_date: datetime) -> Dict:
        """
        Analyze forecast and provide buy/sell signals and delivery recommendations
        """
        if not forecast:
            return {
                "signal": "HOLD",
                "signal_strength": 0.5,
                "delivery_periods": [],
                "countries": [],
                "factors": {}
            }
        
        # Calculate price statistics
        prices = [f["price"] for f in forecast]
        avg_price = sum(prices) / len(prices)
        min_price = min(prices)
        max_price = max(prices)
        current_price = self.base_prices.get(commodity, avg_price)
        
        # Find best buying opportunities (lowest prices)
        best_buy_months = []
        for i, f in enumerate(forecast):
            # If price is below average and trending down or stable
            if f["price"] < avg_price * 0.98:  # 2% below average
                best_buy_months.append({
                    "month": f["month"],
                    "price": f["price"],
                    "date": f["date"],
                    "savings": round((avg_price - f["price"]) / avg_price * 100, 2)
                })
        
        # Sort by best savings
        best_buy_months.sort(key=lambda x: x["savings"], reverse=True)
        
        # Determine overall signal
        price_change = (avg_price - current_price) / current_price
        
        if price_change > 0.05:  # Prices expected to rise >5%
            signal = "BUY"
            signal_strength = min(0.95, 0.6 + abs(price_change) * 2)
        elif price_change < -0.05:  # Prices expected to fall >5%
            signal = "SELL"
            signal_strength = min(0.95, 0.6 + abs(price_change) * 2)
        else:
            signal = "HOLD"
            signal_strength = 0.5
        
        # Generate delivery period recommendations (in MONTHS, not quarters)
        delivery_periods = []
        month_names = ["January", "February", "March", "April", "May", "June",
                       "July", "August", "September", "October", "November", "December"]
        
        # Include ALL months with good opportunities (not just top 3)
        for buy_month in best_buy_months:
            month_num = buy_month["month"]
            forecast_date = current_date + timedelta(days=30 * month_num)
            month_name = month_names[forecast_date.month - 1]
            year = forecast_date.year
            
            # Format delivery period as MONTH (e.g., "FOB January 2026")
            delivery_periods.append({
                "period": f"FOB {month_name} {year}",
                "price": buy_month["price"],
                "savings_pct": buy_month["savings"],
                "month": month_num,
                "month_name": month_name,
                "year": year,
                "recommendation": "STRONG BUY" if buy_month["savings"] > 3 else "BUY"
            })
        
        # If no strong buy opportunities, suggest best available month
        if not delivery_periods:
            best_month = min(forecast, key=lambda x: x["price"])
            forecast_date = current_date + timedelta(days=30 * best_month["month"])
            month_name = month_names[forecast_date.month - 1]
            year = forecast_date.year
            
            delivery_periods.append({
                "period": f"On-inside {month_name} {year}",
                "price": best_month["price"],
                "savings_pct": round((avg_price - best_month["price"]) / avg_price * 100, 2),
                "month": best_month["month"],
                "month_name": month_name,
                "year": year,
                "recommendation": "BUY"
            })
        
        # If multiple months, create combined recommendation
        if len(delivery_periods) > 1:
            # Sort by month number
            delivery_periods.sort(key=lambda x: x["month"])
            months_list = [d["month_name"] for d in delivery_periods]
            
            # Create combined period string for multiple months
            if len(months_list) == 2:
                combined_period = f"FOB {months_list[0]} - {months_list[1]} {delivery_periods[0]['year']}"
            else:
                combined_period = f"FOB {months_list[0]} - {months_list[-1]} {delivery_periods[0]['year']}"
            
            # Add combined recommendation
            delivery_periods.insert(0, {
                "period": combined_period,
                "price": min(d["price"] for d in delivery_periods),
                "savings_pct": max(d["savings_pct"] for d in delivery_periods),
                "month": None,
                "month_name": "Multiple",
                "year": delivery_periods[0]["year"],
                "recommendation": "BUY",
                "months_included": len(delivery_periods) - 1
            })
        
        # Get countries
        countries = self.country_map.get(commodity, [])
        
        # Calculate factors
        factors = {
            "price_change_pct": round(price_change * 100, 2),
            "forecast_range": f"${min_price:.2f} - ${max_price:.2f}",
            "avg_price": round(avg_price, 2),
            "current_price": round(current_price, 2),
            "best_buy_price": round(min_price, 2),
            "volatility": round(self.volatility.get(commodity, 0.10) * 100, 2)
        }
        
        return {
            "signal": signal,
            "signal_strength": round(signal_strength, 2),
            "delivery_periods": delivery_periods,
            "countries": countries[:3],  # Top 3 countries
            "factors": factors
        }

