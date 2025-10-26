"""
Insurance Service - FastAPI application
Provides actuarial insurance quotes and recommendations
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import logging

from insurance_actuarial_model import calculate_insurance_quote, InsuranceActuarialModel

app = FastAPI(title="Tangent Insurance Service", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger(__name__)

# Request models
class TradeData(BaseModel):
    trade_id: str
    contract_id: str
    amount: float
    tenor_days: int
    inventory_value: float
    inventory_type: str
    inventory_location: str
    buyer_deposit: float
    is_exchange_traded: bool
    exchange_name: Optional[str] = None
    exchange_grade: Optional[str] = None
    country_risk: float = 0.05

class CreditAssessment(BaseModel):
    pd: float
    risk_band: str
    collateral_analysis: dict
    country_risk: float = 0.05

class InsuranceQuoteRequest(BaseModel):
    trade_data: TradeData
    credit_assessment: CreditAssessment

# API Endpoints
@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "insurance", "version": "1.0.0"}

@app.post("/quote")
def get_insurance_quote(request: InsuranceQuoteRequest):
    """Calculate insurance quote for a trade"""
    try:
        quote = calculate_insurance_quote(
            request.trade_data.dict(),
            request.credit_assessment.dict()
        )
        
        return quote
    except Exception as e:
        logger.error(f"Failed to calculate insurance quote: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/opportunities")
def get_insurance_opportunities(contracts: List[dict]):
    """Get insurance opportunities from multiple contracts"""
    try:
        opportunities = []
        
        for contract in contracts:
            trade_data = {
                'trade_id': contract.get('trade_id'),
                'contract_id': contract.get('contract_id'),
                'amount': contract.get('amount', 0),
                'is_exchange_traded': contract.get('is_exchange_traded', False),
                'country_risk': contract.get('country_risk', 0.05)
            }
            
            credit_assessment = {
                'pd': contract.get('credit_assessment', {}).get('pd', 0.05),
                'risk_band': contract.get('credit_assessment', {}).get('risk_band', 'C'),
                'collateral_analysis': contract.get('credit_assessment', {}).get('collateral_analysis', {})
            }
            
            quote = calculate_insurance_quote(trade_data, credit_assessment)
            
            opportunities.append({
                'contract_id': contract.get('contract_id'),
                'amount': contract.get('amount', 0),
                'underwriting_score': quote['underwriting_score'],
                'recommendation': quote['recommendation']['decision'],
                'premium': quote['premium_breakdown']['total_premium'],
                'premium_rate': quote['premium_breakdown']['premium_rate']
            })
        
        return {'opportunities': opportunities}
    except Exception as e:
        logger.error(f"Failed to get insurance opportunities: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/quote/{contract_id}")
def get_quote_by_contract(contract_id: str):
    """Get insurance quote by contract ID"""
    # This would fetch from database in production
    return {"message": "Quote retrieval not yet implemented"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)

