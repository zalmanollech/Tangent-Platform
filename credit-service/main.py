# Enhanced Credit Risk Platform with Two-Stage KYC
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import json
from datetime import datetime

# Import our enhanced database components
from enhanced_database import get_db, init_database, Entity as EntityModel, Trade as TradeModel, KYCStatus, TradeKYCStatus
from schemas import EntityCreate, Entity, TradeCreate, Trade
from two_stage_kyc_service import TwoStageKYCService

app = FastAPI(title="Credit Risk Platform with Two-Stage KYC", version="4.0.0")

# Add CORS middleware - allow Tangent Platform to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:4000", "http://127.0.0.1:4000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_database()
    print("🚀 Credit Risk Platform started with Two-Stage KYC!")

@app.get("/")
def root():
    return {
        "message": "Credit Risk Platform API v4.0", 
        "status": "running", 
        "kyc_system": "two_stage",
        "stages": {
            "stage_1": "General KYC (Entity Verification)",
            "stage_2": "Trade-Specific KYC (Risk Assessment)"
        }
    }

@app.get("/health")
def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat(), "database": "connected"}

@app.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    """Get database statistics"""
    service = TwoStageKYCService(db)
    return service.get_stats()

@app.post("/entities", response_model=Entity)
def create_entity(entity_data: EntityCreate, db: Session = Depends(get_db)):
    """Create a new entity (starts Stage 1 KYC)"""
    try:
        service = TwoStageKYCService(db)
        entity = service.create_entity(entity_data)
        return entity
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating entity: {str(e)}")

# Stage 1: General KYC Endpoints
@app.post("/kyc/general/{entity_id}")
def perform_general_kyc(entity_id: int, db: Session = Depends(get_db)):
    """Perform Stage 1: General KYC verification"""
    try:
        service = TwoStageKYCService(db)
        kyc_result = service.perform_general_kyc(entity_id)
        return {
            "entity_id": entity_id,
            "status": kyc_result.overall_status.value,
            "verification_score": kyc_result.verification_score,
            "reason": kyc_result.verification_reason,
            "sanctions_status": kyc_result.sanctions_status,
            "registry_status": kyc_result.registry_status,
            "pep_status": kyc_result.pep_check,
            "verified_at": kyc_result.verified_at.isoformat(),
            "details": {
                "sanctions": json.loads(kyc_result.sanctions_details) if kyc_result.sanctions_details else None,
                "registry": json.loads(kyc_result.registry_details) if kyc_result.registry_details else None,
                "pep": json.loads(kyc_result.pep_details) if kyc_result.pep_details else None
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error performing general KYC: {str(e)}")

@app.get("/kyc/general/{entity_id}")
def get_general_kyc_status(entity_id: int, db: Session = Depends(get_db)):
    """Get general KYC status for entity"""
    try:
        service = TwoStageKYCService(db)
        kyc_result = service.get_general_kyc_status(entity_id)
        if not kyc_result:
            raise HTTPException(status_code=404, detail="General KYC not performed yet")
        
        return {
            "entity_id": entity_id,
            "status": kyc_result.overall_status.value,
            "verification_score": kyc_result.verification_score,
            "reason": kyc_result.verification_reason,
            "sanctions_status": kyc_result.sanctions_status,
            "registry_status": kyc_result.registry_status,
            "pep_status": kyc_result.pep_check,
            "verified_at": kyc_result.verified_at.isoformat(),
            "details": {
                "sanctions": json.loads(kyc_result.sanctions_details) if kyc_result.sanctions_details else None,
                "registry": json.loads(kyc_result.registry_details) if kyc_result.registry_details else None,
                "pep": json.loads(kyc_result.pep_details) if kyc_result.pep_details else None
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting general KYC status: {str(e)}")

@app.post("/trades", response_model=Trade)
def create_trade(trade_data: TradeCreate, db: Session = Depends(get_db)):
    """Create a new trade (starts Stage 2 KYC)"""
    
    try:
        service = TwoStageKYCService(db)
        trade = service.create_trade(trade_data)
        return trade
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating trade: {str(e)}")

# Stage 2: Trade-Specific KYC Endpoints
@app.post("/kyc/trade/{trade_id}")
def perform_trade_kyc(trade_id: int, db: Session = Depends(get_db)):
    """Perform Stage 2: Trade-specific KYC with enhanced algorithms"""
    try:
        service = TwoStageKYCService(db)
        kyc_result = service.perform_trade_kyc(trade_id)
        return {
            "trade_id": trade_id,
            "decision": kyc_result.decision.value,
            "reason": kyc_result.decision_reason,
            "original_pd": kyc_result.original_pd,
            "adjusted_pd": kyc_result.adjusted_pd,
            "pd_reduction": kyc_result.pd_reduction,
            "pd_reduction_pct": kyc_result.pd_reduction_pct,
            "risk_band": kyc_result.risk_band,
            "protection_value": kyc_result.protection_value,
            "protection_ratio": kyc_result.protection_ratio,
            "risk_reduction": kyc_result.risk_reduction,
            "model_version": kyc_result.model_version,
            "method_scores": json.loads(kyc_result.method_scores) if kyc_result.method_scores else {},
            "collateral_analysis": json.loads(kyc_result.collateral_analysis) if kyc_result.collateral_analysis else {},
            "calculated_at": kyc_result.calculated_at.isoformat()
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error performing trade KYC: {str(e)}")

@app.get("/kyc/trade/{trade_id}")
def get_trade_kyc_status(trade_id: int, db: Session = Depends(get_db)):
    """Get trade KYC status"""
    try:
        service = TwoStageKYCService(db)
        kyc_result = service.get_trade_kyc_status(trade_id)
        if not kyc_result:
            raise HTTPException(status_code=404, detail="Trade KYC not performed yet")
        
        return {
            "trade_id": trade_id,
            "decision": kyc_result.decision.value,
            "reason": kyc_result.decision_reason,
            "original_pd": kyc_result.original_pd,
            "adjusted_pd": kyc_result.adjusted_pd,
            "pd_reduction": kyc_result.pd_reduction,
            "pd_reduction_pct": kyc_result.pd_reduction_pct,
            "risk_band": kyc_result.risk_band,
            "protection_value": kyc_result.protection_value,
            "protection_ratio": kyc_result.protection_ratio,
            "risk_reduction": kyc_result.risk_reduction,
            "model_version": kyc_result.model_version,
            "method_scores": json.loads(kyc_result.method_scores) if kyc_result.method_scores else {},
            "collateral_analysis": json.loads(kyc_result.collateral_analysis) if kyc_result.collateral_analysis else {},
            "calculated_at": kyc_result.calculated_at.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting trade KYC status: {str(e)}")

# Legacy endpoints for backward compatibility
@app.post("/decision/{trade_id}")
def make_decision(trade_id: int, db: Session = Depends(get_db)):
    """Legacy endpoint - now redirects to trade KYC"""
    return perform_trade_kyc(trade_id, db)

@app.post("/risk/score/{entity_id}")
def calculate_risk(entity_id: int, db: Session = Depends(get_db)):
    """Legacy endpoint - now part of trade KYC process"""
    raise HTTPException(
        status_code=400, 
        detail="Risk calculation is now part of trade-specific KYC. Use /kyc/trade/{trade_id} instead."
    )

# Data retrieval endpoints
@app.get("/entities", response_model=List[Entity])
def list_entities(db: Session = Depends(get_db)):
    """Get all entities"""
    try:
        entities = db.query(EntityModel).all()
        return entities
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing entities: {str(e)}")

@app.get("/trades", response_model=List[Trade])
def list_trades(db: Session = Depends(get_db)):
    """Get all trades"""
    try:
        return db.query(TradeModel).all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing trades: {str(e)}")

@app.get("/entities/{entity_id}", response_model=Entity)
def get_entity(entity_id: int, db: Session = Depends(get_db)):
    """Get entity by ID"""
    try:
        entity = db.query(EntityModel).filter(EntityModel.id == entity_id).first()
        if not entity:
            raise HTTPException(status_code=404, detail="Entity not found")
        return entity
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting entity: {str(e)}")

@app.get("/trades/{trade_id}", response_model=Trade)
def get_trade(trade_id: int, db: Session = Depends(get_db)):
    """Get trade by ID"""
    try:
        trade = db.query(TradeModel).filter(TradeModel.id == trade_id).first()
        if not trade:
            raise HTTPException(status_code=404, detail="Trade not found")
        return trade
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting trade: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

