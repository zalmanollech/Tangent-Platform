@echo off
echo Starting Tangent Platform with all services...
echo.

:: Start Insurance Service in a new window
echo Starting Insurance Service (Python FastAPI) on port 8002...
start cmd /k "cd insurance-service && python main.py"

:: Give the insurance service a moment to start
timeout /t 3 /nobreak

:: Start Credit Service in a new window
echo Starting Credit Service (Python FastAPI) on port 8001...
start cmd /k "cd credit-service && python main.py"

:: Give the credit service a moment to start
timeout /t 3 /nobreak

:: Start Main Node.js Platform
echo Starting Main Platform (Node.js) on port 4000...
echo.
node server-WORKING-FIXED.js

