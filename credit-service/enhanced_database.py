# Enhanced Database Schema for Two-Stage KYC

from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum
import os

# Database URL - using SQLite for simplicity
DATABASE_URL = "sqlite:///./credit_risk.db"

# Create engine
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Create session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Enums for KYC status
class KYCStatus(str, enum.Enum):
    PENDING = "PENDING"
    PASS = "PASS"
    REVIEW = "REVIEW"
    FAIL = "FAIL"
    EXPIRED = "EXPIRED"

class TradeKYCStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REVIEW = "REVIEW"
    DECLINED = "DECLINED"

class Entity(Base):
    """Entity model for companies/organizations with two-stage KYC"""
    __tablename__ = "entities"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    country = Column(String(3), nullable=False)
    registration_number = Column(String(100), nullable=True)
    industry = Column(String(100), nullable=True)
    
    # Stage 1: General KYC
    general_kyc_status = Column(Enum(KYCStatus), default=KYCStatus.PENDING)
    general_kyc_date = Column(DateTime, nullable=True)
    general_kyc_reason = Column(Text, nullable=True)
    sanctions_check = Column(Boolean, default=False)
    sanctions_matches = Column(Text, nullable=True)  # JSON string
    registry_verified = Column(Boolean, default=False)
    registry_source = Column(String(100), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    trades_as_buyer = relationship("Trade", foreign_keys="Trade.buyer_id", back_populates="buyer")
    trades_as_supplier = relationship("Trade", foreign_keys="Trade.supplier_id", back_populates="supplier")
    risk_results = relationship("RiskResult", back_populates="entity")
    general_kyc_results = relationship("GeneralKYCResult", back_populates="entity")

class GeneralKYCResult(Base):
    """General KYC verification results"""
    __tablename__ = "general_kyc_results"
    
    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)
    
    # Verification results
    sanctions_status = Column(String(20), nullable=False)  # CLEAR, MATCH, ERROR
    sanctions_details = Column(Text, nullable=True)  # JSON string
    registry_status = Column(String(20), nullable=False)  # VERIFIED, NOT_FOUND, ERROR
    registry_details = Column(Text, nullable=True)  # JSON string
    pep_check = Column(String(20), nullable=True)  # CLEAR, MATCH, ERROR
    pep_details = Column(Text, nullable=True)  # JSON string
    
    # Overall result
    overall_status = Column(Enum(KYCStatus), nullable=False)
    verification_score = Column(Float, nullable=True)  # 0-1 score
    verification_reason = Column(Text, nullable=False)
    
    verified_at = Column(DateTime, default=datetime.utcnow)
    verified_by = Column(String(100), nullable=True)  # System or user
    
    # Relationships
    entity = relationship("Entity", back_populates="general_kyc_results")

class Trade(Base):
    """Trade model with two-stage KYC integration"""
    __tablename__ = "trades"
    
    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, ForeignKey("entities.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("entities.id"), nullable=True)
    amount = Column(Float, nullable=False)
    tenor_days = Column(Integer, nullable=False)
    
    # Stage 2: Trade-specific KYC
    trade_kyc_status = Column(Enum(TradeKYCStatus), default=TradeKYCStatus.PENDING)
    trade_kyc_date = Column(DateTime, nullable=True)
    trade_kyc_reason = Column(Text, nullable=True)
    
    # Multi-layer collateral system
    inventory_value = Column(Float, nullable=True)
    inventory_type = Column(String(50), nullable=True)
    inventory_location = Column(String(50), nullable=True)
    buyer_deposit = Column(Float, nullable=True)
    supplier_deposit = Column(Float, nullable=True)
    has_buyer = Column(Boolean, nullable=True)
    buyer_entity_id = Column(Integer, ForeignKey("entities.id"), nullable=True)
    buyer_quality_score = Column(Float, nullable=True)
    is_exchange_traded = Column(Boolean, nullable=True)
    exchange_name = Column(String(50), nullable=True)
    exchange_grade = Column(String(5), nullable=True)
    
    # Legacy fields
    collateral_type = Column(String(50), nullable=True)
    collateral_value = Column(Float, nullable=True)
    deposit_amount = Column(Float, nullable=True)
    commodity_type = Column(String(50), nullable=True)
    
    status = Column(String(20), default="PENDING")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    buyer = relationship("Entity", foreign_keys=[buyer_id], back_populates="trades_as_buyer")
    supplier = relationship("Entity", foreign_keys=[supplier_id], back_populates="trades_as_supplier")
    buyer_entity = relationship("Entity", foreign_keys=[buyer_entity_id])
    trade_kyc_results = relationship("TradeKYCResult", back_populates="trade")

class TradeKYCResult(Base):
    """Trade-specific KYC results with enhanced algorithms"""
    __tablename__ = "trade_kyc_results"
    
    id = Column(Integer, primary_key=True, index=True)
    trade_id = Column(Integer, ForeignKey("trades.id"), nullable=False)
    
    # Risk assessment results
    pd = Column(Float, nullable=False)
    lgd = Column(Float, nullable=False)
    ead = Column(Float, nullable=False)
    risk_band = Column(String(5), nullable=False)
    
    # Collateral analysis
    collateral_analysis = Column(Text, nullable=True)  # JSON string
    protection_value = Column(Float, nullable=True)
    protection_ratio = Column(Float, nullable=True)
    risk_reduction = Column(Float, nullable=True)
    
    # Decision details
    decision = Column(Enum(TradeKYCStatus), nullable=False)
    decision_reason = Column(Text, nullable=False)
    original_pd = Column(Float, nullable=False)
    adjusted_pd = Column(Float, nullable=False)
    pd_reduction = Column(Float, nullable=False)
    pd_reduction_pct = Column(Float, nullable=False)
    
    # Model information
    model_version = Column(String(50), nullable=False)
    method_scores = Column(Text, nullable=True)  # JSON string
    features_used = Column(Text, nullable=True)  # JSON string
    
    calculated_at = Column(DateTime, default=datetime.utcnow)
    calculated_by = Column(String(100), nullable=True)  # System or user
    
    # Relationships
    trade = relationship("Trade", back_populates="trade_kyc_results")

class RiskResult(Base):
    """Risk calculation results (legacy - now integrated into TradeKYCResult)"""
    __tablename__ = "risk_results"
    
    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)
    pd = Column(Float, nullable=False)
    lgd = Column(Float, nullable=False)
    ead = Column(Float, nullable=False)
    risk_band = Column(String(5), nullable=False)
    model_version = Column(String(50), nullable=False)
    method_scores = Column(Text, nullable=True)
    features_used = Column(Text, nullable=True)
    calculated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    entity = relationship("Entity", back_populates="risk_results")

class Decision(Base):
    """Decision records for audit trail (legacy - now integrated into TradeKYCResult)"""
    __tablename__ = "decisions"
    
    id = Column(Integer, primary_key=True, index=True)
    trade_id = Column(Integer, ForeignKey("trades.id"), nullable=False)
    decision = Column(String(20), nullable=False)
    reason = Column(Text, nullable=False)
    original_pd = Column(Float, nullable=False)
    adjusted_pd = Column(Float, nullable=False)
    pd_reduction = Column(Float, nullable=False)
    pd_reduction_pct = Column(Float, nullable=False)
    collateral_analysis = Column(Text, nullable=True)
    model_version = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    trade = relationship("Trade")

# Database dependency
def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create all tables
def create_tables():
    """Create all database tables"""
    Base.metadata.create_all(bind=engine)

# Initialize database
def init_database():
    """Initialize the database with tables"""
    create_tables()
    print("✅ Enhanced Database initialized with Two-Stage KYC!")
    print(f"📁 Database file: {os.path.abspath('credit_risk.db')}")

if __name__ == "__main__":
    init_database()

