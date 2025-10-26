@echo off
echo Checking if Insurance Service is running...
echo.

REM Check port 8002
netstat -ano | findstr :8002
echo.
echo If port 8002 is NOT listed above, the insurance service is not running.
echo.
echo Please check the Insurance Service window and make sure it's running.
echo.
pause

