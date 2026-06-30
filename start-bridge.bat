@echo off
setlocal EnableExtensions EnableDelayedExpansion

title CC DevTools Bridge

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

if not defined CC_DEVTOOLS_PORT set "CC_DEVTOOLS_PORT=9876"
if not defined CC_DEVTOOLS_WRITE_ROOT set "CC_DEVTOOLS_WRITE_ROOT=%ROOT%"
if not defined CC_DEVTOOLS_LOG set "CC_DEVTOOLS_LOG=%ROOT%\cc-devtools-bridge.log"

echo.
echo   ==========================================
echo     CC DevTools Bridge
echo   ==========================================
echo   ws://localhost:%CC_DEVTOOLS_PORT%
echo   Write root: %CC_DEVTOOLS_WRITE_ROOT%
echo   Log file: %CC_DEVTOOLS_LOG%
echo.

echo   [1/4] Detect Python
set "PYTHON=python"
where python >nul 2>&1
if errorlevel 1 (
    where py >nul 2>&1
    if errorlevel 1 (
        echo   [ERR] Python 3.9+ was not found.
        echo   Install Python from https://www.python.org/downloads/
        echo.
        pause
        exit /b 1
    )
    set "PYTHON=py -3"
)
for /f "tokens=*" %%v in ('%PYTHON% --version 2^>^&1') do echo   Python: %%v
echo.

echo   [2/4] Ensure cc-devtools is installed
%PYTHON% -c "import cc_devtools.server" >nul 2>&1
if errorlevel 1 (
    echo   Installing editable package from:
    echo   %ROOT%
    call %PYTHON% -m pip install -e "%ROOT%"
    if errorlevel 1 (
        echo.
        echo   [ERR] Python package install failed.
        echo.
        pause
        exit /b 1
    )
)
echo   Python bridge OK
echo.

echo   [3/4] Detect CLI AI command
if not defined CC_DEVTOOLS_CMD (
    for /f "delims=" %%C in ('where cc 2^>nul') do if not defined CC_DEVTOOLS_CMD set "CC_DEVTOOLS_CMD=%%C"
    if not defined CC_DEVTOOLS_CMD (
        for /f "delims=" %%C in ('where claude 2^>nul') do if not defined CC_DEVTOOLS_CMD set "CC_DEVTOOLS_CMD=%%C"
    )
)

if not defined CC_DEVTOOLS_CMD (
    echo   [ERR] Claude Code CLI was not found.
    echo   Install Claude Code and make sure cc or claude works in a terminal.
    echo.
    pause
    exit /b 1
)
echo   CLI AI: %CC_DEVTOOLS_CMD%
call %CC_DEVTOOLS_CMD% --version
echo.

echo   [4/4] Start bridge
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /C:":%CC_DEVTOOLS_PORT%" ^| findstr "LISTENING"') do (
    if not "%%P"=="0" (
        echo   Stopping existing process on port %CC_DEVTOOLS_PORT%: %%P
        taskkill /F /PID %%P >nul 2>&1
    )
)

cd /d "%ROOT%"
echo.
echo   Keep this window open while using the F12 panel.
echo   If chat fails while the panel is connected, run this in a terminal:
echo   %CC_DEVTOOLS_CMD% -p --permission-mode bypassPermissions --output-format json "Reply OK"
echo.

%PYTHON% -m cc_devtools.server
set "BRIDGE_EXIT=!ERRORLEVEL!"

echo.
echo   Bridge stopped with exit code !BRIDGE_EXIT!.
echo   The F12 panel can only stay connected while this bridge is running.
echo.
pause
exit /b !BRIDGE_EXIT!
