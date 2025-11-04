# News Analyzer for Agricultural Commodities
# Analyzes news articles and publications for price impact signals
import requests
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import re

class NewsAnalyzer:
    def __init__(self):
        # News API configuration (using free tier - you can add API keys later)
        self.news_api_key = None  # Add your NewsAPI key here if available
        self.news_api_url = "https://newsapi.org/v2/everything"
        
        # Agricultural news keywords for each commodity
        self.commodity_keywords = {
            "wheat": ["wheat", "grain", "harvest", "drought", "flour", "bread", "crop", "agriculture"],
            "soy": ["soy", "soybean", "soya", "oilseed", "protein", "feed"],
            "corn": ["corn", "maize", "ethanol", "livestock feed", "cereal"],
            "sugar": ["sugar", "cane", "beet", "sweetener", "refinery"],
            "coffee": ["coffee", "arabica", "robusta", "beans", "brewing", "caffeine"]
        }
        
        # Historical event patterns (simulated - in production, this would be from a database)
        self.event_impacts = {
            "drought": {"wheat": -0.15, "soy": -0.12, "corn": -0.18, "sugar": -0.10, "coffee": -0.20},
            "flood": {"wheat": -0.10, "soy": -0.08, "corn": -0.12, "sugar": -0.15, "coffee": -0.18},
            "trade_war": {"wheat": -0.08, "soy": -0.15, "corn": -0.05, "sugar": -0.06, "coffee": -0.04},
            "good_harvest": {"wheat": 0.12, "soy": 0.10, "corn": 0.15, "sugar": 0.08, "coffee": 0.10},
            "currency_weakness": {"wheat": 0.05, "soy": 0.05, "corn": 0.05, "sugar": 0.05, "coffee": 0.05},
            "export_ban": {"wheat": 0.10, "soy": 0.12, "corn": 0.08, "sugar": 0.10, "coffee": 0.08}
        }
    
    async def fetch_news(self, commodity: str, days_back: int = 30) -> List[Dict]:
        """
        Fetch recent news articles about the commodity
        In production, this would use NewsAPI, GDELT, or other news sources
        """
        try:
            keywords = self.commodity_keywords.get(commodity, [commodity])
            query = " OR ".join(keywords[:3])  # Use top 3 keywords
            
            # Simulated news data (in production, replace with actual API calls)
            # For now, return mock data based on current conditions
            mock_news = self._generate_mock_news(commodity, days_back)
            
            # If API key is available, fetch real news
            if self.news_api_key:
                try:
                    params = {
                        "q": query,
                        "from": (datetime.now() - timedelta(days=days_back)).isoformat(),
                        "sortBy": "relevancy",
                        "language": "en",
                        "apiKey": self.news_api_key
                    }
                    response = requests.get(self.news_api_url, params=params, timeout=10)
                    if response.status_code == 200:
                        data = response.json()
                        return data.get("articles", [])[:20]  # Top 20 articles
                except Exception as e:
                    print(f"Warning: Could not fetch real news: {e}")
            
            return mock_news
            
        except Exception as e:
            print(f"Error fetching news: {e}")
            return []
    
    def _generate_mock_news(self, commodity: str, days_back: int) -> List[Dict]:
        """Generate realistic mock news based on commodity type"""
        base_date = datetime.now()
        news_items = []
        
        # Generate 5-10 news items with varying sentiment
        sentiments = ["positive", "negative", "neutral"]
        topics = ["harvest", "weather", "trade", "supply", "demand"]
        
        for i in range(8):
            days_ago = (i * 2) % days_back
            date = base_date - timedelta(days=days_ago)
            sentiment = sentiments[i % len(sentiments)]
            topic = topics[i % len(topics)]
            
            news_items.append({
                "title": f"{commodity.capitalize()} {topic} update: {sentiment} outlook",
                "description": f"Recent developments in {commodity} {topic} suggest {sentiment} market conditions",
                "publishedAt": date.isoformat(),
                "url": f"https://example.com/news/{commodity}-{i}",
                "sentiment": sentiment,
                "topic": topic
            })
        
        return news_items
    
    async def analyze_commodity_news(self, commodity: str) -> Dict:
        """
        Analyze news articles and extract price impact signals
        Returns: sentiment score, event types, impact predictions
        """
        news_articles = await self.fetch_news(commodity)
        
        if not news_articles:
            return {
                "sentiment": 0.0,
                "events": [],
                "impact_score": 0.0,
                "insights": ["No recent news available"]
            }
        
        # Analyze sentiment
        sentiment_scores = []
        events_detected = []
        insights = []
        
        for article in news_articles:
            title = article.get("title", "").lower()
            description = article.get("description", "").lower()
            text = f"{title} {description}"
            
            # Detect events
            event_impact = self._detect_events(text, commodity)
            if event_impact:
                events_detected.append(event_impact)
            
            # Calculate sentiment
            sentiment = self._calculate_sentiment(text)
            sentiment_scores.append(sentiment)
            
            # Extract insights
            if "drought" in text or "dry" in text:
                insights.append(f"⚠️ Drought conditions detected - potential supply constraints")
            elif "flood" in text or "rain" in text:
                insights.append(f"🌧️ Weather events detected - may impact {commodity} production")
            elif "export" in text or "trade" in text:
                insights.append(f"📦 Trade policy changes detected - may affect {commodity} prices")
        
        # Calculate overall sentiment (weighted average)
        avg_sentiment = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0.0
        
        # Calculate impact score based on events
        impact_score = 0.0
        for event in events_detected:
            impact_score += event.get("impact", 0.0)
        
        # Normalize impact score
        impact_score = max(-1.0, min(1.0, impact_score))
        
        return {
            "sentiment": round(avg_sentiment, 3),
            "events": events_detected,
            "impact_score": round(impact_score, 3),
            "insights": insights[:5],  # Top 5 insights
            "articles_analyzed": len(news_articles)
        }
    
    def _detect_events(self, text: str, commodity: str) -> Optional[Dict]:
        """Detect specific events in news text"""
        text_lower = text.lower()
        
        # Check for various event types
        if "drought" in text_lower or "dry" in text_lower:
            impact = self.event_impacts.get("drought", {}).get(commodity, -0.10)
            return {"type": "drought", "impact": impact, "severity": "high"}
        
        elif "flood" in text_lower or "heavy rain" in text_lower:
            impact = self.event_impacts.get("flood", {}).get(commodity, -0.10)
            return {"type": "flood", "impact": impact, "severity": "high"}
        
        elif "trade war" in text_lower or "tariff" in text_lower:
            impact = self.event_impacts.get("trade_war", {}).get(commodity, -0.05)
            return {"type": "trade_war", "impact": impact, "severity": "medium"}
        
        elif "good harvest" in text_lower or "bumper crop" in text_lower:
            impact = self.event_impacts.get("good_harvest", {}).get(commodity, 0.10)
            return {"type": "good_harvest", "impact": impact, "severity": "medium"}
        
        elif "export ban" in text_lower or "export restriction" in text_lower:
            impact = self.event_impacts.get("export_ban", {}).get(commodity, 0.10)
            return {"type": "export_ban", "impact": impact, "severity": "high"}
        
        return None
    
    def _calculate_sentiment(self, text: str) -> float:
        """
        Simple sentiment analysis
        Returns: -1.0 (very negative) to 1.0 (very positive)
        """
        text_lower = text.lower()
        
        # Positive indicators
        positive_words = ["increase", "rise", "growth", "surge", "boom", "strong", "high", "good", "gain"]
        negative_words = ["decrease", "fall", "drop", "decline", "crash", "weak", "low", "bad", "loss"]
        
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        # Calculate sentiment score
        if positive_count + negative_count == 0:
            return 0.0
        
        sentiment = (positive_count - negative_count) / (positive_count + negative_count + 1)
        return sentiment


