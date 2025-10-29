"""
Insurance Actuarial Model for Trade Finance Insurance

This module implements actuarial calculations for insurance underwriting,
premium pricing, and risk assessment for trade finance transactions.
"""

import math
from typing import Dict, Any, Optional

class InsuranceActuarialModel:
    """
    Actuarial model for calculating insurance premiums, underwriting scores,
    and recommendations for trade finance insurance.
    """
    
    def __init__(self):
        # Base premium rates (as percentage of trade amount)
        self.BASE_PREMIUM_RATES = {
            'A+': 0.005,  # 0.5% for highest quality
            'A': 0.007,   # 0.7%
            'B': 0.010,   # 1.0%
            'C': 0.015,   # 1.5%
            'D': 0.025,   # 2.5%
            'E': 0.040    # 4.0% for highest risk
        }
        
        # Risk multipliers
        self.RISK_MULTIPLIERS = {
            'low': 1.0,
            'medium': 1.2,
            'high': 1.5,
            'very_high': 2.0
        }
        
        # Collateral protection thresholds
        self.COLLATERAL_PROTECTION_THRESHOLD = 0.70  # 70% coverage is considered good
        self.MAX_COLLATERAL_DISCOUNT = 0.25  # Maximum 25% discount
        
        # Underwriting score thresholds
        self.SCORE_THRESHOLDS = {
            'recommend': 60,
            'review': 40,
            'decline': 20
        }
    
    def calculate_underwriting_score(
        self,
        pd: float,
        collateral_analysis: Dict[str, Any],
        trade_amount: float,
        tenor_days: int,
        inventory_value: float,
        buyer_deposit: float,
        country_risk: float = 0.05
    ) -> float:
        """
        Calculate underwriting score (0-100) for insurance decision
        
        Higher score = lower risk = better insurance candidate
        """
        score = 100.0  # Start with perfect score
        
        # PD adjustment (probability of default)
        # Higher PD = lower score
        pd_penalty = min(pd * 200, 50)  # Max 50 point penalty
        score -= pd_penalty
        
        # Collateral protection ratio
        effective_protection = collateral_analysis.get('effective_protection_ratio', 0)
        if effective_protection < 0.50:
            score -= 25  # Insufficient collateral
        elif effective_protection < 0.70:
            score -= 10  # Marginal collateral
        else:
            score += 5   # Good collateral protection
        
        # Deposit ratio (buyer commitment)
        deposit_ratio = buyer_deposit / trade_amount if trade_amount > 0 else 0
        if deposit_ratio >= 0.30:
            score += 10  # Good buyer commitment
        elif deposit_ratio >= 0.20:
            score += 5   # Acceptable commitment
        else:
            score -= 10  # Low buyer commitment
        
        # Tenor adjustment (longer tenor = higher risk)
        if tenor_days > 90:
            score -= 15
        elif tenor_days > 60:
            score -= 8
        elif tenor_days > 30:
            score -= 3
        
        # Country risk adjustment
        if country_risk > 0.10:
            score -= 15
        elif country_risk > 0.05:
            score -= 8
        
        # Trade amount (very large trades need extra scrutiny)
        if trade_amount > 10_000_000:
            score -= 5
        
        # Ensure score is within bounds
        return max(0, min(100, score))
    
    def calculate_premium(
        self,
        trade_amount: float,
        pd: float,
        risk_band: str,
        collateral_analysis: Dict[str, Any],
        tenor_days: int,
        inventory_value: float,
        buyer_deposit: float,
        country_risk: float = 0.05
    ) -> Dict[str, Any]:
        """
        Calculate insurance premium breakdown
        
        Returns detailed premium components
        """
        # Base premium based on risk band
        base_rate = self.BASE_PREMIUM_RATES.get(risk_band.upper(), self.BASE_PREMIUM_RATES['C'])
        base_premium = trade_amount * base_rate
        
        # PD loading (additional premium for default risk)
        pd_multiplier = 1.0 + (pd * 2)  # Scale PD to multiplier
        pd_loading = base_premium * (pd_multiplier - 1.0)
        
        # Collateral discount
        effective_protection = collateral_analysis.get('effective_protection_ratio', 0)
        if effective_protection >= self.COLLATERAL_PROTECTION_THRESHOLD:
            # Apply discount based on protection level
            protection_excess = effective_protection - self.COLLATERAL_PROTECTION_THRESHOLD
            discount_rate = min(protection_excess * 0.5, self.MAX_COLLATERAL_DISCOUNT)
            collateral_discount = -base_premium * discount_rate
        else:
            collateral_discount = 0
        
        # Risk multiplier based on overall risk assessment
        if pd > 0.15 or risk_band in ['D', 'E']:
            risk_multiplier = self.RISK_MULTIPLIERS['very_high']
        elif pd > 0.10 or risk_band == 'C':
            risk_multiplier = self.RISK_MULTIPLIERS['high']
        elif pd > 0.05 or risk_band == 'B':
            risk_multiplier = self.RISK_MULTIPLIERS['medium']
        else:
            risk_multiplier = self.RISK_MULTIPLIERS['low']
        
        adjusted_premium = (base_premium + pd_loading + collateral_discount) * risk_multiplier
        
        # Administrative costs (2% of premium)
        admin_cost = adjusted_premium * 0.02
        
        # Catastrophic loading (5% of premium for extreme events)
        catastrophic_loading = adjusted_premium * 0.05
        
        # Total premium
        total_premium = adjusted_premium + admin_cost + catastrophic_loading
        
        # Premium rate (as percentage)
        premium_rate = total_premium / trade_amount if trade_amount > 0 else 0
        
        return {
            'base_premium': round(base_premium, 2),
            'pd_loading': round(pd_loading, 2),
            'collateral_discount': round(collateral_discount, 2),
            'risk_multiplier': risk_multiplier,
            'adjusted_premium': round(adjusted_premium, 2),
            'admin_cost': round(admin_cost, 2),
            'catastrophic_loading': round(catastrophic_loading, 2),
            'total_premium': round(total_premium, 2),
            'premium_rate': round(premium_rate, 4)
        }
    
    def get_recommendation(
        self,
        underwriting_score: float,
        pd: float,
        risk_band: str
    ) -> Dict[str, Any]:
        """
        Get insurance recommendation based on underwriting score and risk assessment
        """
        if underwriting_score >= self.SCORE_THRESHOLDS['recommend']:
            decision = 'RECOMMEND'
            confidence = 'HIGH'
            recommendations = [
                'Strong underwriting score',
                'Acceptable risk profile',
                'Approved for insurance coverage'
            ]
        elif underwriting_score >= self.SCORE_THRESHOLDS['review']:
            decision = 'REVIEW'
            confidence = 'MEDIUM'
            recommendations = [
                'Moderate risk assessment',
                'Requires senior underwriter review',
                'Additional documentation may be required'
            ]
        else:
            decision = 'DECLINE'
            confidence = 'HIGH'
            recommendations = [
                f'High risk assessment (PD: {pd*100:.1f}%)',
                f'Risk band {risk_band} indicates elevated default probability',
                'Insufficient collateral coverage'
            ]
        
        # Add specific recommendations based on risk factors
        if pd > 0.15:
            recommendations.append('Probability of default exceeds acceptable threshold')
        if risk_band in ['D', 'E']:
            recommendations.append('Risk band indicates significant credit concerns')
        
        return {
            'decision': decision,
            'confidence': confidence,
            'recommendations': recommendations
        }
    
    def calculate_actuarial_metrics(
        self,
        premium: float,
        trade_amount: float,
        pd: float,
        tenor_days: int
    ) -> Dict[str, Any]:
        """
        Calculate actuarial metrics for insurance pricing validation
        """
        # Expected loss
        expected_loss = trade_amount * pd
        
        # Loss ratio (expected loss / premium)
        loss_ratio = expected_loss / premium if premium > 0 else float('inf')
        
        # Profit margin (premium - expected loss) / premium
        profit_margin = (premium - expected_loss) / premium if premium > 0 else 0
        
        # Coverage ratio (premium covers expected loss)
        coverage_ratio = premium / expected_loss if expected_loss > 0 else 0
        
        # Risk-adjusted return
        risk_adjusted_return = (premium - expected_loss) / trade_amount if trade_amount > 0 else 0
        
        return {
            'expected_loss': round(expected_loss, 2),
            'loss_ratio': round(loss_ratio, 4),
            'profit_margin': round(profit_margin, 4),
            'coverage_ratio': round(coverage_ratio, 4),
            'risk_adjusted_return': round(risk_adjusted_return, 4),
            'tenor_days': tenor_days,
            'pd': pd
        }

