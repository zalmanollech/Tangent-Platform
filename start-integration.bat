@echo off
echo ========================================
echo TANGENT-BRIDGE-v4 INTEGRATION STARTUP
echo ========================================
echo.
echo This script will start both services for integration testing:
echo   - Credit Risk Service (Port 8000)
echo   - Tangent Platform (Port 4000)
echo.
echo Make sure you have:
echo   1. Python installed and in PATH
echo   2. Node.js installed and in PATH
echo   3. Both projects in the correct directories
echo.
pause

echo.
echo Starting Credit Risk Service...
echo ================================
cd /d "C:\Users\ollec\OneDrive\שולחן העבודה\Credit"
start "Credit Service" cmd /k "python main.py"
echo Credit service starting on port 8000...

echo.
echo Waiting 5 seconds for credit service to start...
timeout /t 5 /nobreak > nul

echo.
echo Starting Tangent Platform...
echo =============================
cd /d "C:\Users\ollec\OneDrive\שולחן העבודה\Tangent-Platform"
start "Tangent Platform" cmd /k "npm start"
echo Tangent Platform starting on port 4000...

echo.
echo ========================================
echo SERVICES STARTING...
echo ========================================
echo.
echo Credit Service: http://localhost:8000
echo Tangent Platform: http://localhost:4000
echo.
echo Both services are starting in separate windows.
echo Wait for them to fully load before running tests.
echo.
echo To test the integration, run:
echo   node test-complete-integration.js
echo.
pause


