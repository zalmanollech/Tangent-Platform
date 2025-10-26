@echo off 
echo ======================================== 
echo RESTORE TANGENT PLATFORM TO ORIGINAL 
echo ======================================== 
echo This will restore your Tangent Platform to exactly 
echo how it was before any integration changes. 
echo. 
echo WARNING: This will overwrite all current files! 
echo. 
pause 
 
echo Looking for backup directories... 
for /d %%%%i in (tangent_platform_backup_*) do ( 
    echo Found backup: %%%%i 
    set BACKUP_DIR=%%%%i 
) 
 
if not defined BACKUP_DIR ( 
    echo ERROR: No backup directory found! 
    echo Please run create_tangent_backup.bat first. 
    pause 
    exit /b 1 
) 
 
echo. 
echo Restoring from: %%BACKUP_DIR: =0% % 
echo. 
 
echo Stopping any running servers... 
taskkill /f /im node.exe 2>nul 
 
echo Copying files back... 
xcopy /E /I /H /Y "%%BACKUP_DIR: =0% %\*.*" . 
 
echo Cleaning up integration files... 
if exist "credit_integration" rmdir /s /q "credit_integration" 
if exist "integration_test.py" del "integration_test.py" 
if exist "integration_log.json" del "integration_log.json" 
 
echo. 
echo ======================================== 
echo RESTORE COMPLETE! 
echo ======================================== 
echo. 
echo Your Tangent Platform is now back to the original state. 
echo You can start it with: npm start 
echo. 
