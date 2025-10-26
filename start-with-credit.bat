@echo off
echo ============================================
echo Starting Tangent Platform with Credit Service
echo ============================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python to run the credit service
    pause
    exit /b 1
)

REM Start credit service in background
echo Starting Credit Service on port 8001...
start "Credit Service" cmd /k "cd credit-service && python main.py"

REM Wait a bit for credit service to start
timeout /t 3 /nobreak >nul

REM Start Tangent Platform
echo Starting Tangent Platform on port 4000...
echo.
npm start

