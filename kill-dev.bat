@echo off
echo Killing dev server on port 3000...

set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Found PID: %%a - terminating...
    taskkill /PID %%a /F >nul 2>&1
    if errorlevel 1 (
        echo Failed to kill PID %%a.
    ) else (
        echo Done. Dev server stopped.
    )
    set FOUND=1
)

if "%FOUND%"=="0" echo Port 3000 is not in use.

echo.
echo Killing all remaining node.exe processes...
taskkill /IM node.exe /F >nul 2>&1
if errorlevel 1 (
    echo No node.exe processes found.
) else (
    echo All node.exe processes terminated.
)

echo.
pause
