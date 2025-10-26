# Pydantic Schemas for API

from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

# Entity schemas
class EntityBase(BaseModel):
    name: str
    country: str
    registration_number: Optional[str] = None
    industry: Optional[str] = None
    general_kyc_status: str = "PENDING"

class EntityCreate(EntityBase):
    entity_type: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None

class Entity(EntityBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Trade schemas
class TradeBase(BaseModel):
    buyer_id: int
    supplier_id: Optional[int] = None
    amount: float
    tenor_days: int
    
    # Multi-layer collateral
    inventory_value: Optional[float] = None
    inventory_type: Optional[str] = None
    inventory_location: Optional[str] = None
    buyer_deposit: Optional[float] = None
    supplier_deposit: Optional[float] = None
    has_buyer: Optional[bool] = None
    buyer_entity_id: Optional[int] = None
    buyer_quality_score: Optional[float] = None
    is_exchange_traded: Optional[bool] = None
    exchange_name: Optional[str] = None
    exchange_grade: Optional[str] = None
    
    # Legacy fields
    collateral_type: Optional[str] = None
    collateral_value: Optional[float] = None
    deposit_amount: Optional[float] = None
    commodity_type: Optional[str] = None

class TradeCreate(TradeBase):
    pass

class Trade(TradeBase):
    id: int
    status: str = "PENDING"
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Risk result schemas
class RiskResultBase(BaseModel):
    entity_id: int
    pd: float
    lgd: float
    ead: float
    risk_band: str
    model_version: str
    method_scores: Optional[Dict[str, Any]] = None
    features_used: Optional[Dict[str, Any]] = None

class RiskResultCreate(RiskResultBase):
    pass

class RiskResult(RiskResultBase):
    id: int
    calculated_at: datetime
    
    class Config:
        from_attributes = True

# Decision schemas
class DecisionBase(BaseModel):
    trade_id: int
    decision: str
    reason: str
    original_pd: float
    adjusted_pd: float
    pd_reduction: float
    pd_reduction_pct: float
    collateral_analysis: Optional[Dict[str, Any]] = None
    model_version: str

class DecisionCreate(DecisionBase):
    pass

class Decision(DecisionBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# API response schemas
class TradeDecisionResponse(BaseModel):
    trade_id: int
    decision: str
    reason: str
    original_pd: float
    adjusted_pd: float
    pd_reduction: float
    pd_reduction_pct: float
    pd_band: str
    amount: float
    enhanced_collateral_analysis: Optional[Dict[str, Any]] = None
    model_version: str
    method_scores: Optional[Dict[str, Any]] = None

