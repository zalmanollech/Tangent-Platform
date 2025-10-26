# Testing Insurance Feature

## Quick Start Commands

### Step 1: Start All Services
```bash
cd "C:\Users\ollec\OneDrive\שולחן העבודה\Tangent-Platform"
.\start-with-insurance.bat
```

Wait for all 3 windows to show:
- ✅ Insurance Service running on http://localhost:8002
- ✅ Credit Service running on http://localhost:8001
- ✅ Tangent Platform running on http://localhost:4000

---

## Step 2: Test Insurance API

### Test 1: Health Check

Open browser to: **http://localhost:8002/health**

Expected response:
```json
{
  "status": "healthy",
  "service": "insurance",
  "version": "1.0.0"
}
```

---

### Test 2: Get Insurance Quote

Open browser console (F12) and paste:

```javascript
// Test insurance quote for a high-risk trade
fetch('http://localhost:4000/api/insurance/quote', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
    },
    body: JSON.stringify({
        tradeData: {
            trade_id: 'test_trade_1',
            contract_id: 'contract_123',
            amount: 530000,
            tenor_days: 30,
            inventory_value: 424000,
            inventory_type: 'commodity',
            inventory_location: 'warehouse',
            buyer_deposit: 53000,
            is_exchange_traded: false,
            country_risk: 0.05
        },
        creditAssessment: {
            pd: 0.214,
            risk_band: 'E',
            collateral_analysis: {
                effective_protection_ratio: 0.635,
                risk_reduction: 0.508,
                lgd_adjustment: 0.221
            }
        }
    })
})
.then(res => res.json())
.then(data => {
    console.log('📊 Insurance Quote Result:', data);
    console.log('💰 Premium:', data.premium_breakdown.total_premium);
    console.log('📈 Recommendation:', data.recommendation.decision);
    console.log('🎯 Underwriting Score:', data.underwriting_score);
});
```

Expected Output:
```json
{
  "timestamp": "2025-01-15T...",
  "trade_id": "test_trade_1",
  "amount": 530000,
  "underwriting_score": 35.5,
  "premium_breakdown": {
    "total_premium": 95072.50,
    "premium_rate": 0.1794
  },
  "recommendation": {
    "decision": "DECLINE",
    "confidence": "N/A"
  }
}
```

---

### Test 3: Low-Risk Trade (Should Recommend)

```javascript
fetch('http://localhost:4000/api/insurance/quote', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
    },
    body: JSON.stringify({
        tradeData: {
            trade_id: 'test_low_risk',
            contract_id: 'contract_low',
            amount: 100000,
            tenor_days: 30,
            inventory_value: 90000,
            inventory_type: 'commodity',
            inventory_location: 'warehouse',
            buyer_deposit: 15000,
            is_exchange_traded: true,
            country_risk: 0.03
        },
        creditAssessment: {
            pd: 0.025,
            risk_band: 'B',
            collateral_analysis: {
                effective_protection_ratio: 0.85,
                risk_reduction: 0.68,
                lgd_adjustment: 0.144
            }
        }
    })
})
.then(res => res.json())
.then(data => {
    console.log('✅ Low-Risk Insurance Quote:', data);
    console.log('💵 Premium:', data.premium_breakdown.total_premium);
    console.log('👍 Recommendation:', data.recommendation.decision);
});
```

This should show:
- **Recommendation**: RECOMMEND
- **Confidence**: HIGH or MEDIUM
- **Lower Premium**: ~$500-$1,200 (0.5%-1.2%)
- **Underwriting Score**: 70-85

---

### Test 4: Get Insurance Opportunities (Admin Only)

```javascript
// First, make sure you're logged in as admin
fetch('http://localhost:4000/api/admin/insurance-opportunities', {
    headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token')
    }
})
.then(res => res.json())
.then(data => {
    console.log('🔍 Insurance Opportunities:', data);
    console.log('📊 Number of Opportunities:', data.opportunities?.length || 0);
});
```

---

### Test 5: Insurance Service Status

```javascript
fetch('http://localhost:4000/api/admin/insurance-status', {
    headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token')
    }
})
.then(res => res.json())
.then(data => console.log('🩺 Insurance Service Status:', data));
```

---

## What to Verify

### ✅ Insurance Service (Port 8002)
- Health endpoint responds
- No errors in console

### ✅ Credit Service (Port 8001)
- Health endpoint responds
- Still works for credit assessments

### ✅ Main Platform (Port 4000)
- Insurance integration loaded
- API endpoints respond
- No crashes

### ✅ Insurance Quote Quality
For high-risk trade:
- Premium ~$72,000 - $95,000 (13-18%)
- Recommendation: DECLINE
- Underwriting score: 30-40
- Actuarial metrics show expected loss

For low-risk trade:
- Premium ~$500 - $1,200 (0.5-1.2%)
- Recommendation: RECOMMEND
- Underwriting score: 70-85
- Better profit margins

---

## Troubleshooting

### Issue: "Insurance service not available"
**Solution**: Check insurance service window is running on port 8002

### Issue: "Failed to get insurance quote"
**Solution**: 
1. Check insurance service is running
2. Check server console for errors
3. Verify token is valid

### Issue: Premium seems too high
**Expected**: High-risk trades have high premiums (10-20%)
- Risk Band E = 100% PD loading
- High PD = Higher premium
- This is correct actuarial pricing

---

## Test Results Template

Copy this and fill in your test results:

```
✅ Insurance Service Health: [PASS/FAIL]
✅ High-Risk Trade Quote: [PASS/FAIL]
   - Premium: $____________
   - Recommendation: __________
   - Underwriting Score: _______

✅ Low-Risk Trade Quote: [PASS/FAIL]
   - Premium: $____________
   - Recommendation: __________
   - Underwriting Score: _______

✅ Insurance Opportunities Endpoint: [PASS/FAIL]
✅ No Crashes: [PASS/FAIL]
```

---

**Ready to test!** Run the commands above and let me know the results.

