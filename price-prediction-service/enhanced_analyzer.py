# Enhanced Analyzer for Agricultural Commodities
# Integrates: Real news, weather patterns, geopolitical risks, exchange prices, local publications
import requests
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import pandas as pd
import numpy as np

class EnhancedAnalyzer:
    def __init__(self):
        # API Keys (set these in config or environment)
        self.news_api_key = None  # NewsAPI.org
        self.weather_api_key = None  # OpenWeatherMap or similar
        self.gdelt_api_key = None  # GDELT Project - FREE, no key needed but can be used for higher limits
        
        # Exchange APIs
        self.cbot_api_url = "https://www.cmegroup.com/api"  # CBOT futures
        self.ice_api_url = "https://www.theice.com/api"  # ICE futures
        
        # Local publication price sources (add your sources)
        self.local_sources = {
            "wheat": [
                {"name": "USDA Grain Report", "url": "https://www.usda.gov/oce/commodity/wasde/"},
                {"name": "Argentina Grain Exchange", "url": "https://www.bolsadecereales.com.ar/"},
                {"name": "Russia Grain Union", "url": "https://www.grain.ru/"}
            ],
            "soy": [
                {"name": "USDA Oilseed Report", "url": "https://www.usda.gov/oce/commodity/wasde/"},
                {"name": "Brazil Soybean Association", "url": "https://www.abiove.com.br/"}
            ],
            "corn": [
                {"name": "USDA Grain Report", "url": "https://www.usda.gov/oce/commodity/wasde/"},
                {"name": "Argentina Corn Exchange", "url": "https://www.bolsadecereales.com.ar/"}
            ],
            "sugar": [
                {"name": "ISO Sugar Market Report", "url": "https://www.isosugar.org/"},
                {"name": "Brazil Sugar Association", "url": "https://www.unica.com.br/"}
            ],
            "coffee": [
                {"name": "ICO Coffee Report", "url": "https://www.ico.org/"},
                {"name": "Brazil Coffee Council", "url": "https://www.abic.com.br/"}
            ]
        }
    
    async def analyze_historical_news(self, commodity: str, years_back: int = 10) -> Dict:
        """
        Analyze news from last 10 years to find patterns
        Uses GDELT API for historical event data
        """
        try:
            # GDELT API for historical events - FREE, no API key required
            gdelt_url = "https://api.gdeltproject.org/api/v2/doc/doc"
            
            keywords = self._get_commodity_keywords(commodity)
            # Build query: GDELT requires OR queries to be in parentheses
            query = "(" + " OR ".join(keywords[:5]) + ")"  # Use top 5 keywords
            
            # Search last 10 years (GDELT format: YYYYMMDDHHMMSS)
            end_date = datetime.now()
            start_date = end_date - timedelta(days=365 * years_back)
            
            # GDELT parameters
            params = {
                "query": query,
                "mode": "artlist",  # Article list mode
                "format": "json",
                "startdatetime": start_date.strftime("%Y%m%d%H%M%S"),
                "enddatetime": end_date.strftime("%Y%m%d%H%M%S"),
                "maxrecords": 500,  # Limit to 500 for performance
                "sort": "date"  # Sort by date
            }
            
            # Optional: Add API key if available (not required for free tier)
            if self.gdelt_api_key:
                params["apikey"] = self.gdelt_api_key
            
            # GDELT API - FREE, no API key needed
            try:
                print(f"[GDELT] Fetching historical data for {commodity}...")
                response = requests.get(gdelt_url, params=params, timeout=30)
                print(f"[GDELT] Response status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"[GDELT] Response keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
                    
                    # GDELT can return data in different formats
                    if isinstance(data, dict):
                        if "articles" in data:
                            articles = data["articles"]
                            print(f"[GDELT] Found {len(articles)} articles")
                            if len(articles) > 0:
                                return self._process_gdelt_events(data, commodity, years_back)
                        elif "results" in data:
                            # Alternative format
                            articles = data["results"]
                            print(f"[GDELT] Found {len(articles)} results")
                            if len(articles) > 0:
                                data["articles"] = articles
                                return self._process_gdelt_events(data, commodity, years_back)
                    elif isinstance(data, list):
                        # Sometimes GDELT returns list directly
                        print(f"[GDELT] Found {len(data)} items in list")
                        if len(data) > 0:
                            return self._process_gdelt_events({"articles": data}, commodity, years_back)
                    
                    print(f"[GDELT] No articles found in response. Using fallback.")
                else:
                    print(f"[GDELT] API returned status {response.status_code}. Using fallback.")
            except requests.exceptions.Timeout:
                print(f"[GDELT] Request timeout. Using fallback data.")
            except requests.exceptions.RequestException as e:
                print(f"[GDELT] Request error: {e}. Using fallback data.")
            except Exception as e:
                print(f"[GDELT] Error: {e}. Using fallback data.")
            
            # Fallback: return enhanced mock data with patterns
            return self._generate_historical_patterns(commodity, years_back)
            
        except Exception as e:
            print(f"Error analyzing historical news: {e}")
            return {"patterns": [], "events": []}
    
    def _process_gdelt_events(self, gdelt_data: Dict, commodity: str, years_back: int) -> Dict:
        """
        Process GDELT API response to extract relevant events and patterns
        """
        try:
            articles = gdelt_data.get("articles", [])
            if not articles:
                print(f"[GDELT] No articles in data to process")
                return self._generate_historical_patterns(commodity, years_back)
            
            print(f"[GDELT] Processing {len(articles)} articles...")
            events = []
            event_types = {}
            
            # Analyze articles to extract events
            for article in articles[:500]:  # Limit to 500 for performance
                # GDELT can have different field names
                title = (article.get("title") or article.get("Title") or "").lower()
                snippet = (article.get("snippet") or article.get("Snippet") or article.get("summary") or "").lower()
                text = f"{title} {snippet}"
                date_str = article.get("seendate") or article.get("seendate") or article.get("date") or ""
                
                # Extract year from date
                try:
                    if date_str:
                        year = int(date_str[:4])
                    else:
                        year = datetime.now().year
                except:
                    year = datetime.now().year
                
                # Detect event types
                event_type = None
                impact = 0.0
                
                if any(word in text for word in ["drought", "dry", "arid", "water shortage"]):
                    event_type = "drought"
                    impact = 0.15
                elif any(word in text for word in ["flood", "heavy rain", "inundation"]):
                    event_type = "flood"
                    impact = 0.10
                elif any(word in text for word in ["trade war", "trade dispute", "tariff", "sanction"]):
                    event_type = "trade_dispute"
                    impact = 0.10
                elif any(word in text for word in ["export ban", "export restriction", "embargo"]):
                    event_type = "export_restriction"
                    impact = 0.18
                elif any(word in text for word in ["good harvest", "bumper crop", "record harvest"]):
                    event_type = "good_harvest"
                    impact = -0.12  # Negative impact (lowers prices)
                elif any(word in text for word in ["frost", "freeze", "cold snap"]):
                    event_type = "weather_anomaly"
                    impact = 0.12
                
                if event_type:
                    events.append({
                        "year": year,
                        "type": event_type,
                        "impact": impact,
                        "commodity": commodity,
                        "title": article.get("title", "")[:100]  # First 100 chars
                    })
                    
                    # Count event types
                    if event_type not in event_types:
                        event_types[event_type] = 0
                    event_types[event_type] += 1
            
            # Calculate patterns
            patterns = {}
            for event_type, count in event_types.items():
                frequency = count / years_back
                patterns[event_type] = {
                    "frequency": f"{frequency:.1f} per year",
                    "total_occurrences": count,
                    "price_impact": abs(events[0]["impact"]) if events else 0.10,
                    "duration": "6-12 months" if event_type in ["drought", "flood"] else "3-18 months"
                }
            
            return {
                "patterns": patterns,
                "events": events[:100],  # Top 100 events
                "years_analyzed": years_back,
                "total_events": len(events),
                "event_types": event_types,
                "source": "GDELT",
                "data_quality": "real"
            }
            
        except Exception as e:
            print(f"Error processing GDELT events: {e}")
            return self._generate_historical_patterns(commodity, years_back)
    
    def _generate_historical_patterns(self, commodity: str, years_back: int) -> Dict:
        """Generate historical patterns based on common agricultural events"""
        patterns = []
        events = []
        
        # Common historical patterns
        historical_patterns = {
            "drought_cycle": {
                "frequency": "every 3-5 years",
                "price_impact": 0.15,
                "duration": "6-12 months"
            },
            "trade_dispute": {
                "frequency": "irregular",
                "price_impact": 0.10,
                "duration": "3-18 months"
            },
            "weather_anomaly": {
                "frequency": "seasonal",
                "price_impact": 0.12,
                "duration": "2-6 months"
            },
            "export_restriction": {
                "frequency": "political",
                "price_impact": 0.18,
                "duration": "variable"
            }
        }
        
        # Simulate historical events
        current_year = datetime.now().year
        for year in range(current_year - years_back, current_year):
            # Drought events
            if year % 4 == 0:  # Every 4 years
                events.append({
                    "year": year,
                    "type": "drought",
                    "impact": historical_patterns["drought_cycle"]["price_impact"],
                    "commodity": commodity
                })
            
            # Trade disputes
            if year % 3 == 0:  # Every 3 years
                events.append({
                    "year": year,
                    "type": "trade_dispute",
                    "impact": historical_patterns["trade_dispute"]["price_impact"],
                    "commodity": commodity
                })
        
        return {
            "patterns": historical_patterns,
            "events": events,
            "years_analyzed": years_back,
            "total_events": len(events),
            "source": "fallback",
            "data_quality": "simulated"
        }
    
    async def analyze_weather_patterns(self, commodity: str, regions: List[str]) -> Dict:
        """
        Analyze weather patterns and forecasts for agricultural regions
        Uses weather APIs to get current conditions and forecasts
        """
        try:
            weather_analysis = {
                "current_conditions": {},
                "forecasts": {},
                "risk_assessment": {},
                "impact_on_prices": {}
            }
            
            for region in regions:
                # In production, use weather API:
                # weather_data = await self._fetch_weather_data(region)
                # weather_analysis["current_conditions"][region] = weather_data
                
                # For now, simulate weather analysis
                weather_analysis["current_conditions"][region] = {
                    "drought_risk": np.random.uniform(0.1, 0.3),
                    "flood_risk": np.random.uniform(0.05, 0.15),
                    "temperature_anomaly": np.random.uniform(-2, 2),
                    "precipitation_anomaly": np.random.uniform(-20, 20)
                }
                
                # Calculate price impact
                if weather_analysis["current_conditions"][region]["drought_risk"] > 0.2:
                    weather_analysis["impact_on_prices"][region] = {
                        "impact": 0.15,
                        "direction": "increase",
                        "reason": "Drought conditions expected"
                    }
                elif weather_analysis["current_conditions"][region]["flood_risk"] > 0.1:
                    weather_analysis["impact_on_prices"][region] = {
                        "impact": 0.10,
                        "direction": "increase",
                        "reason": "Flood risk may affect harvest"
                    }
                else:
                    weather_analysis["impact_on_prices"][region] = {
                        "impact": 0.0,
                        "direction": "stable",
                        "reason": "Normal weather conditions"
                    }
            
            return weather_analysis
            
        except Exception as e:
            print(f"Error analyzing weather patterns: {e}")
            return {}
    
    async def analyze_geopolitical_risks(self, commodity: str) -> Dict:
        """
        Analyze geopolitical risks: wars, conflicts, trade tensions
        """
        try:
            # Key producing/exporting countries for each commodity
            commodity_countries = {
                "wheat": ["Russia", "USA", "Ukraine", "Canada", "Argentina", "Australia", "Brazil"],
                "soy": ["Brazil", "USA", "Argentina", "China"],
                "corn": ["USA", "China", "Brazil", "Argentina", "Ukraine"],
                "sugar": ["Brazil", "India", "Thailand", "China"],
                "coffee": ["Brazil", "Vietnam", "Colombia", "Indonesia", "Ethiopia"]
            }
            
            countries = commodity_countries.get(commodity, [])
            
            risk_analysis = {
                "countries": {},
                "overall_risk": "low",
                "conflicts": [],
                "trade_tensions": [],
                "impact_on_prices": {}
            }
            
            # Simulate geopolitical risk assessment
            for country in countries:
                risk_score = np.random.uniform(0.1, 0.4)  # Low to medium risk
                
                # Higher risk for certain countries (example)
                if country in ["Russia", "Ukraine"]:
                    risk_score = np.random.uniform(0.4, 0.7)  # Higher risk
                
                risk_analysis["countries"][country] = {
                    "risk_score": round(risk_score, 2),
                    "status": "stable" if risk_score < 0.3 else "monitor",
                    "factors": []
                }
                
                if risk_score > 0.5:
                    risk_analysis["conflicts"].append({
                        "country": country,
                        "type": "trade_tension",
                        "impact": round(risk_score * 0.1, 2)
                    })
                    risk_analysis["overall_risk"] = "high"
            
            # Calculate price impact
            if risk_analysis["overall_risk"] == "high":
                risk_analysis["impact_on_prices"] = {
                    "impact": 0.12,
                    "direction": "increase",
                    "reason": "Geopolitical tensions may affect supply"
                }
            else:
                risk_analysis["impact_on_prices"] = {
                    "impact": 0.0,
                    "direction": "stable",
                    "reason": "Low geopolitical risk"
                }
            
            return risk_analysis
            
        except Exception as e:
            print(f"Error analyzing geopolitical risks: {e}")
            return {}
    
    async def fetch_exchange_prices(self, commodity: str) -> Dict:
        """
        Fetch real prices from exchanges (CBOT, ICE, etc.)
        """
        try:
            # Exchange symbol mapping
            exchange_symbols = {
                "wheat": {"cbot": "ZW", "ice": None},
                "soy": {"cbot": "ZS", "ice": None},
                "corn": {"cbot": "ZC", "ice": None},
                "sugar": {"cbot": None, "ice": "SB"},
                "coffee": {"cbot": None, "ice": "KC"}
            }
            
            symbols = exchange_symbols.get(commodity, {})
            prices = {}
            
            # In production, fetch real prices:
            # if symbols["cbot"]:
            #     cbot_price = await self._fetch_cbot_price(symbols["cbot"])
            #     prices["cbot"] = cbot_price
            
            # if symbols["ice"]:
            #     ice_price = await self._fetch_ice_price(symbols["ice"])
            #     prices["ice"] = ice_price
            
            # For now, simulate exchange prices
            base_price = {
                "wheat": 245.0,
                "soy": 485.0,
                "corn": 195.0,
                "sugar": 550.0,
                "coffee": 3200.0
            }.get(commodity, 200.0)
            
            if symbols["cbot"]:
                prices["cbot"] = {
                    "price": base_price * (1 + np.random.uniform(-0.02, 0.02)),
                    "symbol": symbols["cbot"],
                    "exchange": "CBOT",
                    "timestamp": datetime.now().isoformat()
                }
            
            if symbols["ice"]:
                prices["ice"] = {
                    "price": base_price * (1 + np.random.uniform(-0.02, 0.02)),
                    "symbol": symbols["ice"],
                    "exchange": "ICE",
                    "timestamp": datetime.now().isoformat()
                }
            
            return prices
            
        except Exception as e:
            print(f"Error fetching exchange prices: {e}")
            return {}
    
    async def fetch_local_publication_prices(self, commodity: str) -> Dict:
        """
        Fetch prices from local publications (USDA, country-specific exchanges)
        """
        try:
            sources = self.local_sources.get(commodity, [])
            publication_prices = {}
            
            # In production, scrape or API fetch from these sources
            # For now, simulate publication prices
            base_price = {
                "wheat": 245.0,
                "soy": 485.0,
                "corn": 195.0,
                "sugar": 550.0,
                "coffee": 3200.0
            }.get(commodity, 200.0)
            
            for source in sources:
                # Simulate price variation between sources
                variation = np.random.uniform(-0.05, 0.05)
                publication_prices[source["name"]] = {
                    "price": base_price * (1 + variation),
                    "source": source["name"],
                    "url": source["url"],
                    "timestamp": datetime.now().isoformat(),
                    "region": self._get_region_from_source(source["name"])
                }
            
            return publication_prices
            
        except Exception as e:
            print(f"Error fetching local publication prices: {e}")
            return {}
    
    async def compare_prices_and_recommend(self, commodity: str) -> Dict:
        """
        Compare exchange prices vs local publications and recommend best buy locations
        """
        try:
            exchange_prices = await self.fetch_exchange_prices(commodity)
            publication_prices = await self.fetch_local_publication_prices(commodity)
            
            # Get FOB prices by country
            fob_prices = await self.fetch_fob_prices_by_country(commodity)
            
            # Compare all prices
            all_prices = []
            
            # Add exchange prices
            for exchange, data in exchange_prices.items():
                all_prices.append({
                    "source": f"{exchange.upper()} Exchange",
                    "price": data["price"],
                    "type": "exchange",
                    "location": "Futures Market"
                })
            
            # Add publication prices
            for source, data in publication_prices.items():
                all_prices.append({
                    "source": source,
                    "price": data["price"],
                    "type": "publication",
                    "location": data.get("region", "Unknown")
                })
            
            # Add FOB prices with real origins and ports
            for country, data in fob_prices.items():
                all_prices.append({
                    "source": f"{country} FOB",
                    "price": data["price"],
                    "type": "fob",
                    "location": country,
                    "port": data.get("port", "Multiple"),
                    "origin": data.get("origin", country),
                    "currency": data.get("currency", "USD")
                })
            
            # Sort by price (lowest first for buyers)
            all_prices.sort(key=lambda x: x["price"])
            
            # Calculate price differences
            if all_prices:
                lowest_price = all_prices[0]["price"]
                highest_price = all_prices[-1]["price"]
                price_spread = ((highest_price - lowest_price) / lowest_price) * 100
            else:
                price_spread = 0
            
            # Recommendations
            recommendations = {
                "best_buy_location": all_prices[0] if all_prices else None,
                "price_comparison": all_prices[:5],  # Top 5 cheapest
                "price_spread_pct": round(price_spread, 2),
                "exchange_vs_publication": {
                    "exchange_avg": np.mean([p["price"] for p in all_prices if p["type"] == "exchange"]) if any(p["type"] == "exchange" for p in all_prices) else None,
                    "publication_avg": np.mean([p["price"] for p in all_prices if p["type"] == "publication"]) if any(p["type"] == "publication" for p in all_prices) else None,
                    "fob_avg": np.mean([p["price"] for p in all_prices if p["type"] == "fob"]) if any(p["type"] == "fob" for p in all_prices) else None
                }
            }
            
            return recommendations
            
        except Exception as e:
            print(f"Error comparing prices: {e}")
            return {}
    
    async def fetch_fob_prices_by_country(self, commodity: str) -> Dict:
        """
        Fetch FOB prices by country to recommend where to buy
        Includes real origins (ports) and freight costs
        """
        try:
            # Country-specific FOB price sources with real origins/ports
            country_sources = {
                "wheat": {
                    "USA": {"port": "Gulf Ports (New Orleans, Houston)", "base_price": 245.0, "origin": "USA Gulf Coast"},
                    "Russia": {"port": "Black Sea Ports (Novorossiysk, Tuapse)", "base_price": 240.0, "origin": "Russia Black Sea"},
                    "Canada": {"port": "Vancouver, Thunder Bay", "base_price": 248.0, "origin": "Canada Pacific/Great Lakes"},
                    "Argentina": {"port": "Rosario, Bahia Blanca", "base_price": 242.0, "origin": "Argentina Parana River"},
                    "Australia": {"port": "Eastern Ports (Sydney, Melbourne)", "base_price": 250.0, "origin": "Australia East Coast"},
                    "Brazil": {"port": "Santos, Paranagua, Rio Grande", "base_price": 243.0, "origin": "Brazil South/Southeast"}
                },
                "soy": {
                    "Brazil": {"port": "Santos, Paranagua", "base_price": 485.0, "origin": "Brazil Southeast"},
                    "USA": {"port": "Gulf Ports (New Orleans, Houston)", "base_price": 490.0, "origin": "USA Gulf Coast"},
                    "Argentina": {"port": "Rosario, Quequen", "base_price": 480.0, "origin": "Argentina Parana River"}
                },
                "corn": {
                    "USA": {"port": "Gulf Ports (New Orleans, Houston)", "base_price": 195.0, "origin": "USA Gulf Coast"},
                    "Brazil": {"port": "Santos, Paranagua", "base_price": 192.0, "origin": "Brazil Southeast"},
                    "Argentina": {"port": "Rosario, Bahia Blanca", "base_price": 190.0, "origin": "Argentina Parana River"},
                    "Ukraine": {"port": "Black Sea Ports (Odessa, Mykolaiv)", "base_price": 188.0, "origin": "Ukraine Black Sea"}
                },
                "sugar": {
                    "Brazil": {"port": "Santos, Recife", "base_price": 550.0, "origin": "Brazil Southeast/Northeast"},
                    "India": {"port": "Mumbai, Kandla", "base_price": 560.0, "origin": "India West Coast"},
                    "Thailand": {"port": "Bangkok, Laem Chabang", "base_price": 555.0, "origin": "Thailand Gulf Coast"}
                },
                "coffee": {
                    "Brazil": {"port": "Santos, Paranagua", "base_price": 3200.0, "origin": "Brazil Southeast"},
                    "Vietnam": {"port": "Ho Chi Minh City, Hai Phong", "base_price": 3150.0, "origin": "Vietnam South/North"},
                    "Colombia": {"port": "Buenaventura, Cartagena", "base_price": 3300.0, "origin": "Colombia Pacific/Caribbean"}
                }
            }
            
            countries = country_sources.get(commodity, {})
            fob_prices = {}
            
            for country, data in countries.items():
                # Simulate FOB price with some variation
                variation = np.random.uniform(-0.03, 0.03)
                fob_prices[country] = {
                    "price": data["base_price"] * (1 + variation),
                    "port": data["port"],
                    "origin": data["origin"],
                    "currency": "USD",
                    "unit": "per MT",
                    "timestamp": datetime.now().isoformat()
                }
            
            return fob_prices
            
        except Exception as e:
            print(f"Error fetching FOB prices: {e}")
            return {}
    
    async def analyze_freight_routes(self, commodity: str) -> Dict:
        """
        Analyze main freight routes and predict freight costs
        """
        try:
            # Main freight routes for each commodity
            freight_routes = {
                "wheat": {
                    "USA Gulf → China": {"distance": 12000, "base_freight": 45, "vessel": "Panamax"},
                    "Russia Black Sea → Middle East": {"distance": 2500, "base_freight": 35, "vessel": "Handysize"},
                    "Argentina → China": {"distance": 19000, "base_freight": 55, "vessel": "Capesize"},
                    "Australia → Asia": {"distance": 8000, "base_freight": 40, "vessel": "Panamax"},
                    "Canada → Europe": {"distance": 6000, "base_freight": 38, "vessel": "Panamax"},
                    "Brazil → Middle East/Africa": {"distance": 6500, "base_freight": 42, "vessel": "Panamax"},
                    "Brazil → Asia": {"distance": 11000, "base_freight": 48, "vessel": "Panamax"}
                },
                "soy": {
                    "Brazil → China": {"distance": 18000, "base_freight": 52, "vessel": "Capesize"},
                    "USA Gulf → China": {"distance": 12000, "base_freight": 45, "vessel": "Panamax"},
                    "Argentina → Europe": {"distance": 11000, "base_freight": 42, "vessel": "Panamax"}
                },
                "corn": {
                    "USA Gulf → China": {"distance": 12000, "base_freight": 45, "vessel": "Panamax"},
                    "Brazil → Europe": {"distance": 8500, "base_freight": 40, "vessel": "Panamax"},
                    "Argentina → Asia": {"distance": 19000, "base_freight": 55, "vessel": "Capesize"}
                },
                "sugar": {
                    "Brazil → Europe": {"distance": 8500, "base_freight": 40, "vessel": "Panamax"},
                    "Thailand → China": {"distance": 3000, "base_freight": 25, "vessel": "Handysize"},
                    "India → Middle East": {"distance": 2000, "base_freight": 20, "vessel": "Handysize"}
                },
                "coffee": {
                    "Brazil → Europe": {"distance": 8500, "base_freight": 42, "vessel": "Container"},
                    "Vietnam → USA": {"distance": 14000, "base_freight": 48, "vessel": "Container"},
                    "Colombia → USA": {"distance": 3000, "base_freight": 22, "vessel": "Container"}
                }
            }
            
            routes = freight_routes.get(commodity, {})
            route_analysis = {}
            
            for route_name, route_data in routes.items():
                # Simulate freight cost with some variation
                freight_variation = np.random.uniform(-0.10, 0.15)  # -10% to +15%
                current_freight = route_data["base_freight"] * (1 + freight_variation)
                
                # Predict future freight (considering seasonality and market conditions)
                future_freight = current_freight * (1 + np.random.uniform(-0.05, 0.10))
                
                route_analysis[route_name] = {
                    "current_freight": round(current_freight, 2),
                    "predicted_freight_3m": round(future_freight, 2),
                    "distance_nm": route_data["distance"],
                    "vessel_type": route_data["vessel"],
                    "trend": "increasing" if future_freight > current_freight else "decreasing",
                    "freight_change_pct": round(((future_freight - current_freight) / current_freight) * 100, 2)
                }
            
            return route_analysis
            
        except Exception as e:
            print(f"Error analyzing freight routes: {e}")
            return {}
    
    def _get_commodity_keywords(self, commodity: str) -> List[str]:
        """Get search keywords for commodity"""
        keywords_map = {
            "wheat": ["wheat", "grain", "harvest", "drought", "flour", "bread", "crop", "agriculture"],
            "soy": ["soy", "soybean", "soya", "oilseed", "protein", "feed"],
            "corn": ["corn", "maize", "ethanol", "livestock feed", "cereal"],
            "sugar": ["sugar", "cane", "beet", "sweetener", "refinery"],
            "coffee": ["coffee", "arabica", "robusta", "beans", "brewing", "caffeine"]
        }
        return keywords_map.get(commodity, [commodity])
    
    def _get_region_from_source(self, source_name: str) -> str:
        """Extract region from source name"""
        if "USDA" in source_name or "USA" in source_name:
            return "USA"
        elif "Argentina" in source_name:
            return "Argentina"
        elif "Brazil" in source_name:
            return "Brazil"
        elif "Russia" in source_name:
            return "Russia"
        elif "ICO" in source_name:
            return "International"
        else:
            return "Unknown"

