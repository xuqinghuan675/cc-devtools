@echo off
setlocal EnableExtensions
title CC DevTools Bridge
set "CC_DEVTOOLS_PORT=9876"
set "CC_DEVTOOLS_WRITE_ROOT=D:\F12"
set "CC_DEVTOOLS_CMD=D:\Apps\ClaudeCode\cc.bat"
set "CC_DEVTOOLS_LOG=D:\F12\cc-devtools-bridge.log"
cd /d "D:\F12"
echo.
echo   CC DevTools Bridge Server
echo   ws://localhost:9876
echo   Write root: %CC_DEVTOOLS_WRITE_ROOT%
echo   CLI AI: %CC_DEVTOOLS_CMD%
echo   Log file: %CC_DEVTOOLS_LOG%
if defined CC_DEVTOOLS_ENABLE_WRITE (
    echo   File writes: enabled by CC_DEVTOOLS_ENABLE_WRITE=%CC_DEVTOOLS_ENABLE_WRITE%
) else (
    echo   File writes: disabled by default
)
if defined CC_DEVTOOLS_TOKEN (
    echo   WebSocket token: enabled
) else (
    echo   WebSocket token: not configured
)
echo.
echo   Preparing bridge port %CC_DEVTOOLS_PORT%
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /C:":%CC_DEVTOOLS_PORT%" ^| findstr "LISTENING"') do (
    if not "%%P"=="0" (
        echo   Stopping existing process on port %CC_DEVTOOLS_PORT%: %%P
        taskkill /F /PID %%P >nul 2>&1
    )
)
echo.
echo   Keep this window open while using the F12 panel.
echo   If chat fails while connected, run:
echo   %CC_DEVTOOLS_CMD% -p --output-format json "Reply OK"
echo.
rem cc-devtools
python -m cc_devtools.server
set "BRIDGE_EXIT=%ERRORLEVEL%"
echo.
echo   Bridge stopped with exit code %BRIDGE_EXIT%.
echo   The F12 panel can only stay connected while this bridge is running.
echo.
pause
exit /b %BRIDGE_EXIT%
