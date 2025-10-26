# Real Credit Risk Algorithms

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import joblib
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class CreditRiskEngine:
    """Real credit risk assessment engine with ML algorithms"""
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.models = {
            'logistic': LogisticRegression(random_state=42),
            'random_forest': RandomForestClassifier(n_estimators=100, random_state=42),
            'gradient_boosting': GradientBoostingClassifier(n_estimators=100, random_state=42)
        }
        self.is_trained = False
        
        # Risk factors and weights
        self.country_risk_factors = {
            'USA': 0.05, 'GBR': 0.08, 'DEU': 0.06, 'FRA': 0.07,
            'CAN': 0.06, 'AUS': 0.07, 'JPN': 0.05, 'DEFAULT': 0.15
        }
        
        self.industry_risk_factors = {
            'TECHNOLOGY': 0.08, 'FINANCE': 0.12, 'HEALTHCARE': 0.06,
            'MANUFACTURING': 0.10, 'RETAIL': 0.15, 'ENERGY': 0.18,
            'DEFAULT': 0.12
        }
        
        # Financial health indicators
        self.financial_weights = {
            'current_ratio': 0.20,
            'debt_to_equity': 0.25,
            'interest_coverage': 0.20,
            'revenue_growth': 0.15,
            'profit_margin': 0.20
        }
    
    def calculate_comprehensive_pd(self, entity_data, financial_data=None, behavioral_data=None):
        """Calculate Probability of Default using multiple algorithms"""
        
        try:
            # 1. Build comprehensive feature set
            features = self._build_comprehensive_features(entity_data, financial_data, behavioral_data)
            
            # 2. Calculate base PD using multiple methods
            pd_scores = {}
            
            # Method 1: Traditional Scorecard
            pd_scores['scorecard'] = self._calculate_scorecard_pd(features)
            
            # Method 2: ML Model (if trained)
            if self.is_trained:
                pd_scores['ml_model'] = self._calculate_ml_pd(features)
            
            # Method 3: Expert System Rules
            pd_scores['expert_rules'] = self._calculate_expert_rules_pd(features)
            
            # Method 4: Market-based approach
            pd_scores['market_based'] = self._calculate_market_based_pd(features)
            
            # 3. Ensemble the results
            final_pd = self._ensemble_pd_scores(pd_scores)
            
            # 4. Apply stress testing
            stressed_pd = self._apply_stress_testing(final_pd, features)
            
            # 5. Determine risk band
            risk_band = self._determine_risk_band(stressed_pd)
            
            return {
                'pd': stressed_pd,
                'risk_band': risk_band,
                'method_scores': pd_scores,
                'features_used': features,
                'calculation_timestamp': datetime.now().isoformat(),
                'model_version': 'v2.0_real_algorithms'
            }
            
        except Exception as e:
            logger.error(f"PD calculation failed: {e}")
            return self._fallback_pd_calculation(entity_data)
    
    def _build_comprehensive_features(self, entity_data, financial_data, behavioral_data):
        """Build comprehensive feature set for risk assessment"""
        
        features = {}
        
        # Entity-level features
        features['entity_age_months'] = self._calculate_entity_age(entity_data)
        features['country_risk'] = self.country_risk_factors.get(entity_data.get('country', 'DEFAULT'), 0.15)
        features['industry_risk'] = self.industry_risk_factors.get(entity_data.get('industry', 'DEFAULT'), 0.12)
        
        # Financial features (if available)
        if financial_data:
            features.update(self._extract_financial_features(financial_data))
        else:
            # Use defaults for missing financial data
            features.update({
                'current_ratio': 1.0,
                'debt_to_equity': 0.5,
                'interest_coverage': 2.0,
                'revenue_growth': 0.0,
                'profit_margin': 0.1
            })
        
        # Behavioral features (if available)
        if behavioral_data:
            features.update(self._extract_behavioral_features(behavioral_data))
        else:
            # Use defaults for missing behavioral data
            features.update({
                'payment_history_score': 0.8,
                'dispute_rate': 0.02,
                'credit_utilization': 0.3
            })
        
        # Derived features
        features['overall_financial_health'] = self._calculate_financial_health_score(features)
        features['payment_reliability'] = self._calculate_payment_reliability(features)
        features['business_stability'] = self._calculate_business_stability(features)
        
        return features
    
    def _extract_financial_features(self, financial_data):
        """Extract financial features from data"""
        
        features = {}
        
        # Basic ratios
        revenue = financial_data.get('revenue', 0)
        debt = financial_data.get('debt', 0)
        equity = financial_data.get('equity', revenue * 0.3)  # Estimate if missing
        ebitda = financial_data.get('ebitda', revenue * 0.15)  # Estimate if missing
        interest_expense = financial_data.get('interest_expense', debt * 0.05)  # Estimate
        
        features['current_ratio'] = financial_data.get('current_ratio', 1.0)
        features['debt_to_equity'] = debt / equity if equity > 0 else 0.5
        features['interest_coverage'] = ebitda / interest_expense if interest_expense > 0 else 2.0
        features['revenue_growth'] = financial_data.get('revenue_growth', 0.0)
        features['profit_margin'] = ebitda / revenue if revenue > 0 else 0.1
        
        return features
    
    def _extract_behavioral_features(self, behavioral_data):
        """Extract behavioral features from data"""
        
        features = {}
        
        features['payment_history_score'] = behavioral_data.get('on_time_pct', 0.8)
        features['dispute_rate'] = behavioral_data.get('disputes_pct', 0.02)
        features['credit_utilization'] = behavioral_data.get('credit_utilization', 0.3)
        features['avg_days_past_due'] = behavioral_data.get('avg_days_past_due', 0)
        
        return features
    
    def _calculate_scorecard_pd(self, features):
        """Traditional scorecard approach"""
        
        base_pd = 0.05  # 5% base PD
        
        # Financial health adjustments
        if features['current_ratio'] < 1.0:
            base_pd += 0.03
        if features['debt_to_equity'] > 0.5:
            base_pd += 0.02
        if features['interest_coverage'] < 2.0:
            base_pd += 0.03
        
        # Country and industry adjustments
        base_pd += features['country_risk']
        base_pd += features['industry_risk']
        
        # Payment behavior adjustments
        if features['payment_history_score'] < 0.8:
            base_pd += 0.02
        if features['dispute_rate'] > 0.05:
            base_pd += 0.01
        
        return min(0.5, max(0.001, base_pd))  # Cap between 0.1% and 50%
    
    def _calculate_ml_pd(self, features):
        """ML model approach"""
        
        if not self.is_trained:
            return 0.05  # Default if not trained
        
        try:
            # Convert features to array
            feature_array = np.array(list(features.values())).reshape(1, -1)
            feature_array_scaled = self.scaler.transform(feature_array)
            
            # Use ensemble of models
            predictions = []
            for model_name, model in self.models.items():
                pred = model.predict_proba(feature_array_scaled)[:, 1][0]
                predictions.append(pred)
            
            # Return average prediction
            return np.mean(predictions)
            
        except Exception as e:
            logger.error(f"ML prediction failed: {e}")
            return 0.05
    
    def _calculate_expert_rules_pd(self, features):
        """Expert system rules approach"""
        
        pd = 0.02  # Start with 2%
        
        # Rule 1: Financial health
        if features['overall_financial_health'] < 0.3:
            pd += 0.08
        elif features['overall_financial_health'] < 0.6:
            pd += 0.04
        
        # Rule 2: Payment reliability
        if features['payment_reliability'] < 0.5:
            pd += 0.06
        elif features['payment_reliability'] < 0.8:
            pd += 0.03
        
        # Rule 3: Business stability
        if features['business_stability'] < 0.4:
            pd += 0.05
        
        # Rule 4: Country risk
        if features['country_risk'] > 0.1:
            pd += 0.03
        
        return min(0.4, max(0.001, pd))
    
    def _calculate_market_based_pd(self, features):
        """Market-based approach using external factors"""
        
        # Simulate market conditions
        market_stress = 0.05  # 5% market stress
        sector_performance = 0.02  # 2% sector performance
        
        # Base PD from market conditions
        base_pd = market_stress + sector_performance
        
        # Adjust for entity-specific factors
        if features['country_risk'] > 0.1:
            base_pd += 0.02
        
        if features['industry_risk'] > 0.15:
            base_pd += 0.03
        
        return min(0.3, max(0.001, base_pd))
    
    def _ensemble_pd_scores(self, pd_scores):
        """Combine multiple PD scores using weighted average"""
        
        weights = {
            'scorecard': 0.3,
            'ml_model': 0.4,
            'expert_rules': 0.2,
            'market_based': 0.1
        }
        
        weighted_pd = 0
        total_weight = 0
        
        for method, score in pd_scores.items():
            if score is not None:
                weight = weights.get(method, 0.1)
                weighted_pd += score * weight
                total_weight += weight
        
        return weighted_pd / total_weight if total_weight > 0 else 0.05
    
    def _apply_stress_testing(self, base_pd, features):
        """Apply stress testing scenarios"""
        
        # Stress scenario 1: Economic downturn
        economic_stress = 1.5 if features['country_risk'] > 0.1 else 1.2
        
        # Stress scenario 2: Industry downturn
        industry_stress = 1.3 if features['industry_risk'] > 0.15 else 1.1
        
        # Stress scenario 3: Payment delays
        payment_stress = 1.4 if features['payment_history_score'] < 0.7 else 1.0
        
        # Apply maximum stress
        stress_factor = max(economic_stress, industry_stress, payment_stress)
        
        stressed_pd = base_pd * stress_factor
        
        return min(0.5, max(0.001, stressed_pd))
    
    def _determine_risk_band(self, pd):
        """Determine risk band based on PD"""
        
        if pd < 0.01:
            return 'A+'
        elif pd < 0.02:
            return 'A'
        elif pd < 0.05:
            return 'B'
        elif pd < 0.10:
            return 'C'
        elif pd < 0.20:
            return 'D'
        else:
            return 'E'
    
    def _calculate_financial_health_score(self, features):
        """Calculate overall financial health score"""
        
        score = 0
        
        # Current ratio component
        if features['current_ratio'] >= 2.0:
            score += 0.3
        elif features['current_ratio'] >= 1.5:
            score += 0.2
        elif features['current_ratio'] >= 1.0:
            score += 0.1
        
        # Debt-to-equity component
        if features['debt_to_equity'] <= 0.3:
            score += 0.3
        elif features['debt_to_equity'] <= 0.5:
            score += 0.2
        elif features['debt_to_equity'] <= 0.7:
            score += 0.1
        
        # Interest coverage component
        if features['interest_coverage'] >= 5.0:
            score += 0.4
        elif features['interest_coverage'] >= 3.0:
            score += 0.3
        elif features['interest_coverage'] >= 2.0:
            score += 0.2
        elif features['interest_coverage'] >= 1.0:
            score += 0.1
        
        return min(1.0, score)
    
    def _calculate_payment_reliability(self, features):
        """Calculate payment reliability score"""
        
        score = features['payment_history_score']
        
        # Adjust for disputes
        if features['dispute_rate'] > 0.05:
            score -= 0.2
        elif features['dispute_rate'] > 0.02:
            score -= 0.1
        
        # Adjust for payment delays
        avg_days_past_due = features.get('avg_days_past_due', 0)
        if avg_days_past_due > 30:
            score -= 0.3
        elif avg_days_past_due > 15:
            score -= 0.15
        
        return max(0.0, min(1.0, score))
    
    def _calculate_business_stability(self, features):
        """Calculate business stability score"""
        
        score = 0.5  # Base score
        
        # Entity age component
        if features['entity_age_months'] > 60:  # 5+ years
            score += 0.3
        elif features['entity_age_months'] > 24:  # 2+ years
            score += 0.2
        elif features['entity_age_months'] > 12:  # 1+ year
            score += 0.1
        
        # Revenue growth component
        if features['revenue_growth'] > 0.1:  # 10%+ growth
            score += 0.2
        elif features['revenue_growth'] > 0.05:  # 5%+ growth
            score += 0.1
        elif features['revenue_growth'] < -0.1:  # 10%+ decline
            score -= 0.2
        
        return max(0.0, min(1.0, score))
    
    def _calculate_entity_age(self, entity_data):
        """Calculate entity age in months"""
        
        created_at = entity_data.get('created_at')
        if created_at:
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            age_days = (datetime.now() - created_at).days
            return age_days / 30.44  # Convert to months
        
        return 12  # Default to 1 year if unknown
    
    def _fallback_pd_calculation(self, entity_data):
        """Fallback PD calculation when main method fails"""
        
        country = entity_data.get('country', 'DEFAULT')
        base_pd = self.country_risk_factors.get(country, 0.15)
        
        return {
            'pd': base_pd,
            'risk_band': self._determine_risk_band(base_pd),
            'method_scores': {'fallback': base_pd},
            'features_used': {'country': country},
            'calculation_timestamp': datetime.now().isoformat(),
            'model_version': 'v2.0_fallback'
        }

