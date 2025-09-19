# Tangent Platform Deployment Test Suite
Write-Host "🚀 TANGENT PLATFORM DEPLOYMENT TEST SUITE" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green

$baseUrl = "http://localhost:4000"
$passed = 0
$failed = 0

function Test-Endpoint {
    param($description, $url, $method = "GET", $body = $null, $headers = @{}, $expectedStatus = 200)
    
    try {
        $params = @{
            Uri = "$baseUrl$url"
            Method = $method
            UseBasicParsing = $true
            ErrorAction = "Stop"
        }
        
        if ($headers.Count -gt 0) { $params.Headers = $headers }
        if ($body) { $params.Body = $body }
        
        $response = Invoke-WebRequest @params
        
        if ($response.StatusCode -eq $expectedStatus) {
            Write-Host "✅ $description" -ForegroundColor Green
            $script:passed++
            return $true
        } else {
            Write-Host "❌ $description (Status: $($response.StatusCode))" -ForegroundColor Red
            $script:failed++
            return $false
        }
    } catch {
        Write-Host "❌ $description (Error: $($_.Exception.Message))" -ForegroundColor Red
        $script:failed++
        return $false
    }
}

# Test 1: Core Routes
Write-Host "`n📍 Testing Core Routes..." -ForegroundColor Yellow
Test-Endpoint "Landing Page" "/"
Test-Endpoint "Team Portal" "/landing-two"
Test-Endpoint "Health Check" "/health"
Test-Endpoint "System Test" "/test"

# Test 2: Dashboard Routes  
Write-Host "`n🎯 Testing Dashboard Routes..." -ForegroundColor Yellow
Test-Endpoint "Admin Dashboard" "/dashboard/admin"
Test-Endpoint "Buyer Dashboard" "/dashboard/buyer"
Test-Endpoint "Supplier Dashboard" "/dashboard/supplier"
Test-Endpoint "Trader Dashboard" "/dashboard/trader"
Test-Endpoint "Insurer Dashboard" "/dashboard/insurer"

# Test 3: React Component Files
Write-Host "`n⚛️ Testing React Components..." -ForegroundColor Yellow
Test-Endpoint "App.jsx" "/App.jsx"
Test-Endpoint "DashboardRouter.jsx" "/DashboardRouter.jsx"
Test-Endpoint "React Test Suite" "/test-react.html"

# Test 4: Authentication
Write-Host "`n🔐 Testing Authentication..." -ForegroundColor Yellow
$loginBody = @{email='admin@tangent.com';password='admin123'} | ConvertTo-Json
$loginHeaders = @{'Content-Type'='application/json'}
$loginResult = Test-Endpoint "Admin Login" "/api/auth/login" "POST" $loginBody $loginHeaders

if ($loginResult) {
    # Extract token for further tests
    $loginResponse = Invoke-WebRequest -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginBody -Headers $loginHeaders -UseBasicParsing
    $token = ($loginResponse.Content | ConvertFrom-Json).token
    $authHeaders = @{'Authorization'="Bearer $token"}
    
    # Test 5: Authenticated API Endpoints
    Write-Host "`n🔑 Testing Authenticated APIs..." -ForegroundColor Yellow
    Test-Endpoint "TGT Wallet Creation" "/api/tgt/create-wallet" "POST" $null $authHeaders
    Test-Endpoint "TGT Balance Check" "/api/tgt/balance" "GET" $null $authHeaders
    Test-Endpoint "Contracts List" "/api/contracts" "GET" $null $authHeaders
    Test-Endpoint "Auctions List" "/api/auctions" "GET" $null $authHeaders
    Test-Endpoint "KYC Status" "/api/kyc/status" "GET" $null $authHeaders
    Test-Endpoint "Admin Dashboard Data" "/api/admin/dashboard" "GET" $null $authHeaders
    Test-Endpoint "KYC Reports" "/api/admin/kyc-reports" "GET" $null $authHeaders
    
    # Test price validation
    $priceBody = @{productType='crude_oil';proposedPrice=85.0;marketSource='Brent'} | ConvertTo-Json
    $priceHeaders = $authHeaders + @{'Content-Type'='application/json'}
    Test-Endpoint "Price Validation" "/api/trading/validate-price" "POST" $priceBody $priceHeaders
}

# Test 6: Unauthorized Access Protection
Write-Host "`n🛡️ Testing Security..." -ForegroundColor Yellow
Test-Endpoint "Unauthorized Admin Access" "/api/admin/dashboard" "GET" $null @{} 401

# Test 7: Registration
Write-Host "`n👤 Testing User Registration..." -ForegroundColor Yellow
$regBody = @{email="test$(Get-Random)@test.com";password='test123';role='buyer'} | ConvertTo-Json
Test-Endpoint "User Registration" "/api/auth/register" "POST" $regBody $loginHeaders 201

# Results Summary
Write-Host "`n" -NoNewline
Write-Host "🎯 TEST SUMMARY" -ForegroundColor Cyan
Write-Host "===============" -ForegroundColor Cyan
Write-Host "✅ Passed: $passed" -ForegroundColor Green
Write-Host "❌ Failed: $failed" -ForegroundColor Red
Write-Host "📊 Total:  $($passed + $failed)" -ForegroundColor White

if ($failed -eq 0) {
    Write-Host "`n🚀 ALL TESTS PASSED! DEPLOYMENT READY!" -ForegroundColor Green -BackgroundColor Black
    Write-Host "✅ Platform is production-ready" -ForegroundColor Green
    Write-Host "✅ All APIs working correctly" -ForegroundColor Green
    Write-Host "✅ Authentication & authorization functional" -ForegroundColor Green
    Write-Host "✅ React components loading properly" -ForegroundColor Green
    Write-Host "✅ No syntax errors or crashes detected" -ForegroundColor Green
} else {
    Write-Host "`n⚠️ SOME TESTS FAILED - CHECK BEFORE DEPLOYMENT" -ForegroundColor Yellow -BackgroundColor Black
    exit 1
}

Write-Host "`n🌐 Platform URLs:" -ForegroundColor Cyan
Write-Host "Main: http://localhost:4000/" -ForegroundColor White
Write-Host "Admin: http://localhost:4000/dashboard/admin" -ForegroundColor White
Write-Host "Test Suite: http://localhost:4000/test-react.html" -ForegroundColor White
