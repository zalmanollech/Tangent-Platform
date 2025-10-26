@echo off 
echo ======================================== 
echo TANGENT PLATFORM BACKUP CREATOR 
echo ======================================== 
echo. 
echo This will create a complete backup of your Tangent Platform 
echo before we make any integration changes. 
echo. 
pause 
 
echo Creating backup directory... 
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%b%%a)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set BACKUP_DIR=tangent_platform_backup_%mydate%_%mytime% 
set BACKUP_DIR=%%BACKUP_DIR: =0%% 
mkdir "%%BACKUP_DIR%%" 
 
echo Copying all files... 
xcopy /E /I /H /Y *.* "%%BACKUP_DIR%%\" 
 
echo. 
echo ======================================== 
echo BACKUP COMPLETE! 
echo ======================================== 
echo. 
echo Your Tangent Platform is backed up to: %%BACKUP_DIR%% 
echo. 
echo If anything goes wrong with the integration, 
echo you can restore by copying files back from this folder. 
echo. 
pause 
