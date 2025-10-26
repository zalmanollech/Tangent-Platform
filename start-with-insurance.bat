@echo off
echo Starting Insurance Service on port 8002...
start cmd /k "cd /d "%~dp0insurance-service" && python main.py"

echo Starting Credit Service on port 8001...
start cmd /k "cd /d "%~dp0credit-service" && python main.py"

echo Starting Tangent Platform on port 4000...
start cmd /k "cd /d "%~dp0" && npm start"

echo All three services are attempting to start in separate windows.
echo Check their respective windows for logs.

