# Simple Deployment Test
Write-Host "🚀 TANGENT PLATFORM DEPLOYMENT TEST" -ForegroundColor Green

$baseUrl = "http://localhost:4000"
$passed = 0
$total = 0

function Test-URL {
    param($name, $url)
    $script:total++
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl$url" -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ $name" -ForegroundColor Green
            $script:passed++
        } else {
            Write-Host "❌ $name (Status: $($response.StatusCode))" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ $name (Error)" -ForegroundColor Red
    }
}

# Test core routes
Write-Host "`n📍 Testing Routes..."
Test-URL "Landing Page" "/"
Test-URL "Health Check" "/health"
Test-URL "System Test" "/test"

# Test dashboards
Write-Host "`n🎯 Testing Dashboards..."
Test-URL "Admin Dashboard" "/dashboard/admin"
Test-URL "Buyer Dashboard" "/dashboard/buyer"
Test-URL "Supplier Dashboard" "/dashboard/supplier"
Test-URL "Trader Dashboard" "/dashboard/trader"
Test-URL "Insurer Dashboard" "/dashboard/insurer"

# Test React files
Write-Host "`n⚛️ Testing React Files..."
Test-URL "App.jsx" "/App.jsx"
Test-URL "DashboardRouter.jsx" "/DashboardRouter.jsx"
Test-URL "React Test Suite" "/test-react.html"

# Test APIs
Write-Host "`n🔌 Testing APIs..."
$script:total++
try {
    $headers = @{'Content-Type'='application/json'}
    $body = @{email='admin@tangent.com';password='admin123'} | ConvertTo-Json
    $response = Invoke-WebRequest -Uri "$baseUrl/api/auth/login" -Method POST -Body $body -Headers $headers -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Admin Login API" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "❌ Admin Login API" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Admin Login API (Error)" -ForegroundColor Red
}

# Summary
Write-Host "`n📊 RESULTS:" -ForegroundColor Cyan
Write-Host "Passed: $passed/$total" -ForegroundColor White

if ($passed -eq $total) {
    Write-Host "`n🎉 ALL TESTS PASSED!" -ForegroundColor Green -BackgroundColor Black
    Write-Host "✅ Platform is ready for browser testing" -ForegroundColor Green
} else {
    Write-Host "`n⚠️ Some tests failed" -ForegroundColor Yellow
}

Write-Host "`n🌐 Test in browser:" -ForegroundColor Cyan
Write-Host "http://localhost:4000/" -ForegroundColor White
Write-Host "http://localhost:4000/test-react.html" -ForegroundColor White
