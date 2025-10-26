"""
Actuarial Insurance Model
Calculates insurance premiums, underwriting scores, and insurance recommendations
"""

import numpy as np
from datetime import datetime
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class InsuranceActuarialModel:
    """Actuarial model for trade insurance premium calculation"""
    
    def __init__(self):
        # Base premium rates by underwriting score
        self.base_premium_rates = {
            'excellent': (0.005, 0.012),  # 0.5% - 1.2%
            'good': (0.012, 0.025),      # 1.2% - 2.5%
            'fair': (0.025, 0.050),      # 2.5% - 5.0%
            'poor': (0.050, 0.100),      # 5.0% - 10.0%
            'decline': (0.100, 0.200)    # 10.0% - 20.0%
        }
        
        # PD loadings by risk band
        self.pd_loadings = {
            'A+': 0.00,   # 0% loading
            'A': 0.00,    # 0% loading
            'B': 0.15,    # 15% loading
            'C': 0.30,    # 30% loading
            'D': 0.50,    # 50% loading
            'E': 1.00     # 100% loading
        }
        
        # Collateral discount rates
        self.collateral_discounts = {
            'high': 0.25,      # >80% coverage
            'medium': 0.15,    # 60-80% coverage
            'low': 0.08,       # 40-60% coverage
            'minimal': 0.00    # <40% coverage
        }
        
        # Risk multipliers
        self.risk_multipliers = {
            'exchange_traded': 0.8,
            'otc_strong_collateral': 1.0,
            'otc_weak_collateral': 1.3,
            'high_risk_country': 1.5
        }
        
        # Weights for underwriting score calculation
        self.underwriting_weights = {
            'credit_risk': 0.40,
            'collateral_quality': 0.30,
            'trade_characteristics': 0.20,
            'entity_quality': 0.10
        }
        
        # Admin cost percentage
        self.admin_cost_rate = 0.02  # 2%
        
        # Catastrophic loading
        self.catastrophic_loading = 0.05  # 5%
    
    def calculate_underwriting_score(self, risk_band: str, pd: float, 
                                     protection_ratio: float, is_exchange_traded: bool,
                                     country_risk: float = 0.05) -> Dict[str, Any]:
        """Calculate underwriting score (0-100)"""
        
        # 1. Credit Risk Score (0-40 points)
        risk_band_scores = {
            'A+': 40, 'A': 35, 'B': 25, 'C': 15, 'D': 8, 'E': 2
        }
        credit_score = risk_band_scores.get(risk_band, 0)
        
        # PD-based adjustment (within risk band)
        if pd < 0.02:
            credit_score += 2
        elif pd > 0.15:
            credit_score -= 3
        
        credit_score = max(0, min(40, credit_score))
        
        # 2. Collateral Quality Score (0-30 points)
        if protection_ratio >= 0.80:
            collateral_score = 30
        elif protection_ratio >= 0.60:
            collateral_score = 25
        elif protection_ratio >= 0.40:
            collateral_score = 15
        elif protection_ratio >= 0.20:
            collateral_score = 8
        else:
            collateral_score = 2
        
        # 3. Trade Characteristics Score (0-20 points)
        trade_score = 20
        
        # Exchange trading bonus
        if is_exchange_traded:
            trade_score += 5
        
        # Country risk penalty
        if country_risk > 0.10:
            trade_score -= 8
        elif country_risk > 0.07:
            trade_score -= 4
        
        trade_score = max(0, min(25, trade_score))
        
        # 4. Entity Quality Score (0-10 points)
        entity_score = 10
        if country_risk > 0.12:
            entity_score -= 5
        
        entity_score = max(0, min(10, entity_score))
        
        # Calculate weighted total
        total_score = (
            credit_score * self.underwriting_weights['credit_risk'] +
            collateral_score * self.underwriting_weights['collateral_quality'] +
            trade_score * self.underwriting_weights['trade_characteristics'] +
            entity_score * self.underwriting_weights['entity_quality']
        )
        
        # Scale to 0-100
        underwriting_score = total_score * 100 / (
            self.underwriting_weights['credit_risk'] +
            self.underwriting_weights['collateral_quality'] +
            self.underwriting_weights['trade_characteristics'] +
            self.underwriting_weights['entity_quality']
        )
        
        return {
            'total_score': round(underwriting_score, 2),
            'breakdown': {
                'credit_risk': credit_score,
                'collateral_quality': collateral_score,
                'trade_characteristics': trade_score,
                'entity_quality': entity_score
            }
        }
    
    def get_premium_category(self, underwriting_score: float) -> str:
        """Determine premium category based on underwriting score"""
        if underwriting_score >= 80:
            return 'excellent'
        elif underwriting_score >= 60:
            return 'good'
        elif underwriting_score >= 40:
            return 'fair'
        elif underwriting_score >= 20:
            return 'poor'
        else:
            return 'decline'
    
    def calculate_premium(self, amount: float, pd: float, risk_band: str,
                          protection_ratio: float, is_exchange_traded: bool,
                          country_risk: float = 0.05, underwriting_score: float = None) -> Dict[str, Any]:
        """Calculate insurance premium"""
        
        # Get underwriting score if not provided
        if underwriting_score is None:
            score_data = self.calculate_underwriting_score(
                risk_band, pd, protection_ratio, is_exchange_traded, country_risk
            )
            underwriting_score = score_data['total_score']
        
        # Get premium category
        category = self.get_premium_category(underwriting_score)
        
        # Base premium calculation
        rate_min, rate_max = self.base_premium_rates[category]
        base_rate = (rate_min + rate_max) / 2  # Average rate
        
        # Apply linear scaling within category
        score_range = {'excellent': (80, 100), 'good': (60, 80), 'fair': (40, 60), 
                       'poor': (20, 40), 'decline': (0, 20)}
        if category in score_range:
            range_min, range_max = score_range[category]
            if range_max > range_min:
                position = (underwriting_score - range_min) / (range_max - range_min)
                base_rate = rate_min + (rate_max - rate_min) * position
            else:
                base_rate = rate_min
        
        # Apply adjustments
        base_premium = amount * base_rate
        
        # PD Loading
        pd_loading_factor = self.pd_loadings.get(risk_band, 1.0)
        pd_loading = base_premium * pd_loading_factor
        
        # Collateral Discount
        if protection_ratio >= 0.80:
            collateral_discount_rate = self.collateral_discounts['high']
        elif protection_ratio >= 0.60:
            collateral_discount_rate = self.collateral_discounts['medium']
        elif protection_ratio >= 0.40:
            collateral_discount_rate = self.collateral_discounts['low']
        else:
            collateral_discount_rate = self.collateral_discounts['minimal']
        
        # Risk Multiplier
        if is_exchange_traded:
            risk_multiplier = self.risk_multipliers['exchange_traded']
        elif protection_ratio >= 0.60:
            risk_multiplier = self.risk_multipliers['otc_strong_collateral']
        elif country_risk > 0.12:
            risk_multiplier = self.risk_multipliers['high_risk_country']
        else:
            risk_multiplier = self.risk_multipliers['otc_weak_collateral']
        
        # Calculate adjustments
        collateral_discount = -(base_premium + pd_loading) * collateral_discount_rate
        adjusted_premium = (base_premium + pd_loading + collateral_discount) * risk_multiplier
        
        # Admin cost
        admin_cost = adjusted_premium * self.admin_cost_rate
        
        # Catastrophic loading
        catastrophic_loading = adjusted_premium * self.catastrophic_loading
        
        # Total premium
        total_premium = adjusted_premium + admin_cost + catastrophic_loading
        premium_rate = total_premium / amount if amount > 0 else 0
        
        return {
            'underwriting_score': round(underwriting_score, 2),
            'premium_category': category,
            'premium_breakdown': {
                'base_premium': round(base_premium, 2),
                'pd_loading': round(pd_loading, 2),
                'collateral_discount': round(collateral_discount, 2),
                'risk_multiplier': risk_multiplier,
                'adjusted_premium': round(adjusted_premium, 2),
                'admin_cost': round(admin_cost, 2),
                'catastrophic_loading': round(catastrophic_loading, 2),
                'total_premium': round(total_premium, 2),
                'premium_rate': round(premium_rate, 4)
            },
            'risk_factors': {
                'pd': pd,
                'risk_band': risk_band,
                'protection_ratio': protection_ratio,
                'is_exchange_traded': is_exchange_traded,
                'country_risk': country_risk
            }
        }
    
    def calculate_actuarial_metrics(self, amount: float, pd: float, lgd: float,
                                    total_premium: float) -> Dict[str, Any]:
        """Calculate actuarial metrics"""
        
        # Expected Loss
        expected_loss = amount * pd * lgd
        
        # Loss Ratio (Expected Loss / Premium)
        loss_ratio = expected_loss / total_premium if total_premium > 0 else 0
        
        # Profit Margin
        profit_margin = 1 - loss_ratio
        
        # Coverage Ratio
        coverage_ratio = total_premium / expected_loss if expected_loss > 0 else 0
        
        return {
            'expected_loss': round(expected_loss, 2),
            'loss_ratio': round(loss_ratio, 4),
            'profit_margin': round(profit_margin, 4),
            'coverage_ratio': round(coverage_ratio, 2)
        }
    
    def generate_insurance_recommendation(self, underwriting_score: float, pd: float,
                                          protection_ratio: float) -> Dict[str, Any]:
        """Generate insurance recommendation"""
        
        # Decision logic
        if underwriting_score >= 40 and pd < 0.15 and protection_ratio >= 0.4:
            decision = "RECOMMEND"
            
            # Confidence level
            if underwriting_score > 70 and pd < 0.08 and protection_ratio > 0.60:
                confidence = "HIGH"
            elif underwriting_score > 50 and pd < 0.15 and protection_ratio > 0.40:
                confidence = "MEDIUM"
            else:
                confidence = "LOW"
        elif underwriting_score >= 20 and pd < 0.25:
            decision = "REVIEW_REQUIRED"
            confidence = "LOW"
        else:
            decision = "DECLINE"
            confidence = "N/A"
        
        # Generate recommendations
        recommendations = []
        
        if pd > 0.15:
            recommendations.append(f"High risk assessment (PD: {pd:.1%})")
        
        if protection_ratio < 0.60:
            recommendations.append(f"Collateral coverage at {protection_ratio:.1%} is below optimal threshold")
        
        if pd > 0.15:
            recommendations.append(f"Probability of default at {pd:.1%} exceeds comfortable range")
        
        if underwriting_score < 50:
            recommendations.append("Underwriting score indicates significant risks")
        
        if not recommendations:
            recommendations.append("Risk profile within acceptable parameters")
        
        return {
            'decision': decision,
            'confidence': confidence,
            'recommendations': recommendations,
            'underwriting_score': round(underwriting_score, 2)
        }


def calculate_insurance_quote(trade_data: Dict[str, Any], 
                             credit_assessment: Dict[str, Any]) -> Dict[str, Any]:
    """Main function to calculate insurance quote"""
    
    model = InsuranceActuarialModel()
    
    # Extract data
    amount = trade_data.get('amount', 0)
    pd = credit_assessment.get('pd', 0.05)
    risk_band = credit_assessment.get('risk_band', 'C')
    protection_ratio = credit_assessment.get('collateral_analysis', {}).get('effective_protection_ratio', 0)
    is_exchange_traded = trade_data.get('is_exchange_traded', False)
    country_risk = trade_data.get('country_risk', 0.05)
    
    # Calculate underwriting score
    score_data = model.calculate_underwriting_score(
        risk_band, pd, protection_ratio, is_exchange_traded, country_risk
    )
    
    # Calculate premium
    premium_data = model.calculate_premium(
        amount, pd, risk_band, protection_ratio, is_exchange_traded, country_risk
    )
    
    # Calculate actuarial metrics
    lgd = credit_assessment.get('collateral_analysis', {}).get('lgd_adjustment', 0.45)
    total_premium = premium_data['premium_breakdown']['total_premium']
    
    actuarial_metrics = model.calculate_actuarial_metrics(amount, pd, lgd, total_premium)
    
    # Generate recommendation
    recommendation = model.generate_insurance_recommendation(
        score_data['total_score'], pd, protection_ratio
    )
    
    # Combine results
    quote = {
        'timestamp': datetime.now().isoformat(),
        'trade_id': trade_data.get('trade_id'),
        'contract_id': trade_data.get('contract_id'),
        'amount': amount,
        'underwriting_score': score_data['total_score'],
        'underwriting_breakdown': score_data['breakdown'],
        'premium_category': premium_data['premium_category'],
        'premium_breakdown': premium_data['premium_breakdown'],
        'risk_factors': premium_data['risk_factors'],
        'actuarial_metrics': actuarial_metrics,
        'recommendation': recommendation,
        'insurance_eligible': recommendation['decision'] != 'DECLINE'
    }
    
    return quote

