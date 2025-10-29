Write-Host "Starting Tangent Platform with all services..."
Write-Host ""

# Start Insurance Service in a new terminal
Write-Host "Starting Insurance Service (Python FastAPI) on port 8002..."
Start-Process powershell -ArgumentList "-NoExit -Command `"cd insurance-service; python main.py`""

# Give the insurance service a moment to start
Start-Sleep -Seconds 3

# Start Credit Service in a new terminal
Write-Host "Starting Credit Service (Python FastAPI) on port 8001..."
Start-Process powershell -ArgumentList "-NoExit -Command `"cd credit-service; python main.py`""

# Give the credit service a moment to start
Start-Sleep -Seconds 3

# Start Main Node.js Platform
Write-Host "Starting Main Platform (Node.js) on port 4000..."
Write-Host ""
node server-WORKING-FIXED.js

