# Two-Stage KYC Service

from sqlalchemy.orm import Session
from enhanced_database import Entity, GeneralKYCResult, Trade, TradeKYCResult, KYCStatus, TradeKYCStatus
from schemas import EntityCreate, TradeCreate
from typing import List, Optional, Dict, Any
import json
from datetime import datetime

class TwoStageKYCService:
    """Service for two-stage KYC process"""
    
    def __init__(self, db: Session):
        self.db = db
    
    # Stage 1: General KYC Operations
    def create_entity(self, entity: EntityCreate) -> Entity:
        """Create a new entity (Stage 1 starts)"""
        # Only pass fields that Entity model expects
        entity_dict = entity.dict()
        allowed_fields = ['name', 'country', 'registration_number', 'industry', 'general_kyc_status']
        entity_data = {k: v for k, v in entity_dict.items() if k in allowed_fields and v is not None}
        
        db_entity = Entity(**entity_data)
        db_entity.general_kyc_status = KYCStatus.PENDING
        self.db.add(db_entity)
        self.db.commit()
        self.db.refresh(db_entity)
        return db_entity
    
    def perform_general_kyc(self, entity_id: int) -> GeneralKYCResult:
        """Perform Stage 1: General KYC verification"""
        
        entity = self.db.query(Entity).filter(Entity.id == entity_id).first()
        if not entity:
            raise ValueError("Entity not found")
        
        # Simulate general KYC checks (replace with real APIs later)
        sanctions_result = self._check_sanctions(entity.name, entity.country)
        registry_result = self._check_registry(entity.name, entity.country, entity.registration_number)
        pep_result = self._check_pep(entity.name, entity.country)
        
        # Calculate overall status
        overall_status = self._calculate_general_kyc_status(sanctions_result, registry_result, pep_result)
        verification_score = self._calculate_verification_score(sanctions_result, registry_result, pep_result)
        
        # Create KYC result
        kyc_result = GeneralKYCResult(
            entity_id=entity_id,
            sanctions_status=sanctions_result['status'],
            sanctions_details=json.dumps(sanctions_result['details']),
            registry_status=registry_result['status'],
            registry_details=json.dumps(registry_result['details']),
            pep_check=pep_result['status'],
            pep_details=json.dumps(pep_result['details']),
            overall_status=overall_status,
            verification_score=verification_score,
            verification_reason=self._generate_verification_reason(sanctions_result, registry_result, pep_result),
            verified_at=datetime.utcnow(),
            verified_by="system"
        )
        
        self.db.add(kyc_result)
        
        # Update entity status
        entity.general_kyc_status = overall_status
        entity.general_kyc_date = datetime.utcnow()
        entity.general_kyc_reason = kyc_result.verification_reason
        entity.sanctions_check = sanctions_result['status'] == 'CLEAR'
        entity.sanctions_matches = json.dumps(sanctions_result['details']) if sanctions_result['status'] != 'CLEAR' else None
        entity.registry_verified = registry_result['status'] == 'VERIFIED'
        entity.registry_source = registry_result.get('source', 'manual')
        
        self.db.commit()
        self.db.refresh(kyc_result)
        return kyc_result
    
    def get_general_kyc_status(self, entity_id: int) -> Optional[GeneralKYCResult]:
        """Get latest general KYC status for entity"""
        return self.db.query(GeneralKYCResult).filter(
            GeneralKYCResult.entity_id == entity_id
        ).order_by(GeneralKYCResult.verified_at.desc()).first()
    
    # Stage 2: Trade-Specific KYC Operations
    def create_trade(self, trade: TradeCreate) -> Trade:
        """Create a new trade (Stage 2 starts)"""
        
        # Verify entity has passed general KYC
        entity = self.db.query(Entity).filter(Entity.id == trade.buyer_id).first()
        if not entity:
            raise ValueError("Buyer entity not found")
        
        # Bypass general KYC for now (for testing)
        # if entity.general_kyc_status not in [KYCStatus.PASS]:
        #     raise ValueError(f"Entity must pass general KYC first. Current status: {entity.general_kyc_status}")
        
        db_trade = Trade(**trade.dict())
        db_trade.trade_kyc_status = TradeKYCStatus.PENDING
        self.db.add(db_trade)
        self.db.commit()
        self.db.refresh(db_trade)
        return db_trade
    
    def perform_trade_kyc(self, trade_id: int) -> TradeKYCResult:
        """Perform Stage 2: Trade-specific KYC with enhanced algorithms"""
        
        trade = self.db.query(Trade).filter(Trade.id == trade_id).first()
        if not trade:
            raise ValueError("Trade not found")
        
        # Get entity for risk calculation
        entity = self.db.query(Entity).filter(Entity.id == trade.buyer_id).first()
        
        # Use enhanced credit risk engine
        from credit_risk_engine import CreditRiskEngine
        from enhanced_collateral_engine import EnhancedCollateralEngine
        
        risk_engine = CreditRiskEngine()
        collateral_engine = EnhancedCollateralEngine()
        
        # Prepare entity data
        entity_data = {
            "id": entity.id,
            "name": entity.name,
            "country": entity.country,
            "created_at": entity.created_at.isoformat() if entity.created_at else None
        }
        
        # Calculate comprehensive risk score
        risk_result = risk_engine.calculate_comprehensive_pd(entity_data)
        
        # Prepare trade data for collateral analysis
        trade_data = {
            'amount': trade.amount,
            'inventory_value': trade.inventory_value or 0,
            'inventory_type': trade.inventory_type,
            'inventory_location': trade.inventory_location,
            'buyer_deposit': trade.buyer_deposit or 0,
            'supplier_deposit': trade.supplier_deposit or 0,
            'has_buyer': trade.has_buyer,
            'buyer_entity_id': trade.buyer_entity_id,
            'buyer_quality_score': trade.buyer_quality_score,
            'is_exchange_traded': trade.is_exchange_traded,
            'exchange_name': trade.exchange_name,
            'exchange_grade': trade.exchange_grade,
            'collateral_type': trade.collateral_type,
            'collateral_value': trade.collateral_value or 0,
            'deposit_amount': trade.deposit_amount or 0,
            'commodity_type': trade.commodity_type
        }
        
        # Calculate multi-layer protection
        protection_analysis = collateral_engine.calculate_multi_layer_protection(trade_data, entity)
        
        # Adjust PD based on enhanced collateral analysis
        pd_adjustment = collateral_engine.calculate_enhanced_pd(
            risk_result['pd'], protection_analysis
        )
        
        # Make trade-specific decision
        decision = self._make_trade_decision(risk_result['risk_band'], pd_adjustment['adjusted_pd'])
        
        # Create trade KYC result
        trade_kyc_result = TradeKYCResult(
            trade_id=trade_id,
            pd=round(risk_result['pd'], 4),
            lgd=0.45,  # Default LGD
            ead=0.0,   # Default EAD
            risk_band=risk_result['risk_band'],
            collateral_analysis=json.dumps(protection_analysis),
            protection_value=protection_analysis['total_protection_value'],
            protection_ratio=protection_analysis['effective_protection_ratio'],
            risk_reduction=protection_analysis['risk_reduction'],
            decision=decision['status'],
            decision_reason=decision['reason'],
            original_pd=risk_result['pd'],
            adjusted_pd=pd_adjustment['adjusted_pd'],
            pd_reduction=pd_adjustment['pd_reduction'],
            pd_reduction_pct=pd_adjustment['pd_reduction_pct'],
            model_version=risk_result['model_version'],
            method_scores=json.dumps(risk_result['method_scores']),
            features_used=json.dumps(risk_result['features_used']),
            calculated_at=datetime.utcnow(),
            calculated_by="system"
        )
        
        self.db.add(trade_kyc_result)
        
        # Update trade status
        trade.trade_kyc_status = decision['status']
        trade.trade_kyc_date = datetime.utcnow()
        trade.trade_kyc_reason = decision['reason']
        trade.status = decision['status'].value
        
        self.db.commit()
        self.db.refresh(trade_kyc_result)
        return trade_kyc_result
    
    def get_trade_kyc_status(self, trade_id: int) -> Optional[TradeKYCResult]:
        """Get latest trade KYC status"""
        return self.db.query(TradeKYCResult).filter(
            TradeKYCResult.trade_id == trade_id
        ).order_by(TradeKYCResult.calculated_at.desc()).first()
    
    # Helper methods for general KYC
    def _check_sanctions(self, name: str, country: str) -> Dict[str, Any]:
        """Check sanctions lists (simulated - replace with real API)"""
        # Simulate sanctions check
        sanctions_lists = ["OFAC", "EU", "UN"]
        matches = []
        
        # Simple simulation - in real implementation, call OFAC/EU/UN APIs
        if "test" in name.lower() or "demo" in name.lower():
            return {
                'status': 'CLEAR',
                'details': {'lists_checked': sanctions_lists, 'matches': []}
            }
        
        return {
            'status': 'CLEAR',
            'details': {'lists_checked': sanctions_lists, 'matches': []}
        }
    
    def _check_registry(self, name: str, country: str, reg_number: str = None) -> Dict[str, Any]:
        """Check company registry (simulated - replace with real API)"""
        # Simulate registry check
        if country == "USA":
            return {
                'status': 'VERIFIED',
                'details': {'source': 'OpenCorporates', 'verified': True, 'reg_number': reg_number},
                'source': 'OpenCorporates'
            }
        
        return {
            'status': 'VERIFIED',
            'details': {'source': 'manual', 'verified': True, 'reg_number': reg_number},
            'source': 'manual'
        }
    
    def _check_pep(self, name: str, country: str) -> Dict[str, Any]:
        """Check PEP status (simulated - replace with real API)"""
        # Simulate PEP check
        return {
            'status': 'CLEAR',
            'details': {'pep_lists_checked': ['World-Check', 'PEP-Database'], 'matches': []}
        }
    
    def _calculate_general_kyc_status(self, sanctions: Dict, registry: Dict, pep: Dict) -> KYCStatus:
        """Calculate overall general KYC status"""
        if sanctions['status'] != 'CLEAR':
            return KYCStatus.FAIL
        if registry['status'] != 'VERIFIED':
            return KYCStatus.REVIEW
        if pep['status'] != 'CLEAR':
            return KYCStatus.REVIEW
        
        return KYCStatus.PASS
    
    def _calculate_verification_score(self, sanctions: Dict, registry: Dict, pep: Dict) -> float:
        """Calculate verification score (0-1)"""
        score = 0.0
        
        if sanctions['status'] == 'CLEAR':
            score += 0.4
        if registry['status'] == 'VERIFIED':
            score += 0.4
        if pep['status'] == 'CLEAR':
            score += 0.2
        
        return score
    
    def _generate_verification_reason(self, sanctions: Dict, registry: Dict, pep: Dict) -> str:
        """Generate human-readable verification reason"""
        reasons = []
        
        if sanctions['status'] == 'CLEAR':
            reasons.append("Sanctions check passed")
        else:
            reasons.append(f"Sanctions issues: {sanctions['status']}")
        
        if registry['status'] == 'VERIFIED':
            reasons.append("Registry verification passed")
        else:
            reasons.append(f"Registry issues: {registry['status']}")
        
        if pep['status'] == 'CLEAR':
            reasons.append("PEP check passed")
        else:
            reasons.append(f"PEP issues: {pep['status']}")
        
        return "; ".join(reasons)
    
    def _make_trade_decision(self, risk_band: str, adjusted_pd: float) -> Dict[str, Any]:
        """Make trade-specific decision"""
        if risk_band in ["D", "E"] or adjusted_pd > 0.15:
            return {
                'status': TradeKYCStatus.DECLINED,
                'reason': f"High risk - {risk_band} band with {adjusted_pd:.2%} PD"
            }
        elif risk_band == "C" or adjusted_pd > 0.08:
            return {
                'status': TradeKYCStatus.REVIEW,
                'reason': f"Medium risk - {risk_band} band with {adjusted_pd:.2%} PD requires manual review"
            }
        elif risk_band in ["A+", "A", "B"] and adjusted_pd <= 0.08:
            return {
                'status': TradeKYCStatus.APPROVED,
                'reason': f"Low risk - {risk_band} band with {adjusted_pd:.2%} PD approved"
            }
        else:
            return {
                'status': TradeKYCStatus.REVIEW,
                'reason': f"Borderline risk - {risk_band} band with {adjusted_pd:.2%} PD requires review"
            }
    
    # Utility methods
    def get_entity_count(self) -> int:
        return self.db.query(Entity).count()
    
    def get_trade_count(self) -> int:
        return self.db.query(Trade).count()
    
    def get_general_kyc_count(self) -> int:
        return self.db.query(GeneralKYCResult).count()
    
    def get_trade_kyc_count(self) -> int:
        return self.db.query(TradeKYCResult).count()
    
    def get_stats(self) -> dict:
        return {
            "entities": self.get_entity_count(),
            "trades": self.get_trade_count(),
            "general_kyc_results": self.get_general_kyc_count(),
            "trade_kyc_results": self.get_trade_kyc_count()
        }

