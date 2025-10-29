# Insurance Actuarial Service
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
import sys
import os

# Add the current directory to path to import insurance_actuarial_model
sys.path.append(os.path.dirname(__file__))

from insurance_actuarial_model import InsuranceActuarialModel

app = FastAPI(title="Insurance Actuarial Service", version="1.0.0")

# Add CORS middleware - allow Tangent Platform to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:4000", "http://127.0.0.1:4000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize actuarial model
actuarial_model = InsuranceActuarialModel()

@app.get("/")
def root():
    return {
        "message": "Insurance Actuarial Service API v1.0",
        "status": "running",
        "port": 8002
    }

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "insurance",
        "model": "actuarial_v1.0"
    }

class TradeData(BaseModel):
    trade_id: Optional[str] = None
    contract_id: Optional[str] = None
    amount: float
    tenor_days: int
    inventory_value: float
    inventory_type: str
    inventory_location: str
    buyer_deposit: float
    is_exchange_traded: bool = False
    exchange_name: Optional[str] = None
    exchange_grade: Optional[str] = None
    country_risk: float = 0.05

class CreditAssessment(BaseModel):
    pd: float  # Probability of Default
    risk_band: str  # A+, A, B, C, D, E
    collateral_analysis: Optional[Dict[str, Any]] = None

class QuoteRequest(BaseModel):
    trade_data: TradeData
    credit_assessment: CreditAssessment

@app.post("/quote")
def generate_quote(request: QuoteRequest):
    """
    Generate insurance quote using actuarial model
    """
    try:
        trade_data = request.trade_data
        credit_assessment = request.credit_assessment
        
        # Calculate underwriting score
        underwriting_score = actuarial_model.calculate_underwriting_score(
            pd=credit_assessment.pd,
            collateral_analysis=credit_assessment.collateral_analysis or {},
            trade_amount=trade_data.amount,
            tenor_days=trade_data.tenor_days,
            inventory_value=trade_data.inventory_value,
            buyer_deposit=trade_data.buyer_deposit,
            country_risk=trade_data.country_risk
        )
        
        # Calculate premium
        premium_breakdown = actuarial_model.calculate_premium(
            trade_amount=trade_data.amount,
            pd=credit_assessment.pd,
            risk_band=credit_assessment.risk_band,
            collateral_analysis=credit_assessment.collateral_analysis or {},
            tenor_days=trade_data.tenor_days,
            inventory_value=trade_data.inventory_value,
            buyer_deposit=trade_data.buyer_deposit,
            country_risk=trade_data.country_risk
        )
        
        # Get recommendation
        recommendation = actuarial_model.get_recommendation(
            underwriting_score=underwriting_score,
            pd=credit_assessment.pd,
            risk_band=credit_assessment.risk_band
        )
        
        # Calculate actuarial metrics
        actuarial_metrics = actuarial_model.calculate_actuarial_metrics(
            premium=premium_breakdown['total_premium'],
            trade_amount=trade_data.amount,
            pd=credit_assessment.pd,
            tenor_days=trade_data.tenor_days
        )
        
        return {
            "timestamp": datetime.now().isoformat(),
            "trade_id": trade_data.trade_id or trade_data.contract_id,
            "contract_id": trade_data.contract_id,
            "amount": trade_data.amount,
            "underwriting_score": underwriting_score,
            "premium_breakdown": premium_breakdown,
            "recommendation": recommendation,
            "actuarial_metrics": actuarial_metrics,
            "insurance_eligible": recommendation["decision"] != "DECLINE",
            "success": True
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate quote: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    import sys
    # Set UTF-8 encoding for Windows compatibility
    if sys.platform == 'win32':
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    print("Starting Insurance Actuarial Service on port 8002...")
    uvicorn.run(app, host="0.0.0.0", port=8002)

