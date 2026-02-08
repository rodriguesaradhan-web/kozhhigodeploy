@echo off
echo Installing Backend Dependencies...
cd backend
call npm install
if %errorlevel% neq 0 exit /b %errorlevel%

echo Installing Frontend Dependencies...
cd ..\frontend
call npm install
call npm install react-router-dom axios
if %errorlevel% neq 0 exit /b %errorlevel%

echo Setup Complete! You can now run the servers.
pause
