@echo off
setlocal EnableExtensions EnableDelayedExpansion

title CC DevTools Setup

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "PORT=9876"
set "EXT_DIR=%ROOT%\extension"
set "START_SCRIPT=%ROOT%\start-bridge.bat"
if defined CC_DEVTOOLS_WRITE_ROOT (
    set "WRITE_ROOT=%CC_DEVTOOLS_WRITE_ROOT%"
) else (
    set "WRITE_ROOT=%ROOT%"
)
if defined CC_DEVTOOLS_LOG (
    set "LOG_PATH=%CC_DEVTOOLS_LOG%"
) else (
    set "LOG_PATH=%ROOT%\cc-devtools-bridge.log"
)

echo.
echo   ==========================================
echo     cc-devtools one-click Windows setup
echo   ==========================================
echo.
echo   Step 1: this script installs and starts the bridge.
echo   Step 2: Chrome will open. Load the extension folder.
echo.

echo   [1/5] Detect Python
set "PYTHON=python"
where python >nul 2>&1
if errorlevel 1 (
    where py >nul 2>&1
    if errorlevel 1 (
        echo   [ERR] Python 3.9+ was not found.
        echo   Install Python from https://www.python.org/downloads/
        echo   Re-run this install.bat after Python is available in PATH.
        echo.
        pause
        exit /b 1
    )
    set "PYTHON=py -3"
)
for /f "tokens=*" %%v in ('%PYTHON% --version 2^>^&1') do echo   Python: %%v
echo.

echo   [2/5] Install cc-devtools Python bridge
echo   Running: python -m pip install -e "%ROOT%"
call %PYTHON% -m pip install -e "%ROOT%"
if errorlevel 1 (
    echo.
    echo   [ERR] Python package install failed.
    echo   Check the error above, then re-run install.bat.
    echo.
    pause
    exit /b 1
)
echo   Python bridge OK
echo.

echo   [3/5] Detect CLI AI command
if defined CC_DEVTOOLS_CMD (
    set "AI_CMD=%CC_DEVTOOLS_CMD%"
) else (
    for /f "delims=" %%C in ('where cc 2^>nul') do if not defined AI_CMD set "AI_CMD=%%C"
    if not defined AI_CMD (
        for /f "delims=" %%C in ('where claude 2^>nul') do if not defined AI_CMD set "AI_CMD=%%C"
    )
)

if not defined AI_CMD (
    echo   [ERR] Claude Code CLI was not found.
    echo   Install Claude Code and make sure either cc or claude works in a terminal.
    echo   If you use a custom command, set CC_DEVTOOLS_CMD before running this script.
    echo.
    pause
    exit /b 1
)
echo   CLI AI: %AI_CMD%
call %AI_CMD% --version
echo.

echo   [4/5] Prepare bridge port localhost:%PORT%
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /C:":%PORT%" ^| findstr "LISTENING"') do (
    if not "%%P"=="0" (
        echo   Stopping existing process on port %PORT%: %%P
        taskkill /F /PID %%P >nul 2>&1
    )
)
echo   Port %PORT% ready
echo.

echo   [5/5] Create and start start-bridge.bat
(
echo @echo off
echo setlocal EnableExtensions
echo title CC DevTools Bridge
echo set "CC_DEVTOOLS_PORT=%PORT%"
echo set "CC_DEVTOOLS_WRITE_ROOT=%WRITE_ROOT%"
echo set "CC_DEVTOOLS_CMD=%AI_CMD%"
echo set "CC_DEVTOOLS_LOG=%LOG_PATH%"
echo cd /d "%ROOT%"
echo echo.
echo echo   CC DevTools Bridge Server
echo echo   ws://localhost:%PORT%
echo echo   Write root: %%CC_DEVTOOLS_WRITE_ROOT%%
echo echo   CLI AI: %%CC_DEVTOOLS_CMD%%
echo echo   Log file: %%CC_DEVTOOLS_LOG%%
echo if defined CC_DEVTOOLS_ENABLE_WRITE ^(
echo     echo   File writes: enabled by CC_DEVTOOLS_ENABLE_WRITE=%%CC_DEVTOOLS_ENABLE_WRITE%%
echo ^) else ^(
echo     echo   File writes: disabled by default
echo ^)
echo if defined CC_DEVTOOLS_TOKEN ^(
echo     echo   WebSocket token: enabled
echo ^) else ^(
echo     echo   WebSocket token: not configured
echo ^)
echo echo.
echo echo   Keep this window open while using the F12 panel.
echo echo   If chat fails while connected, run:
echo echo   %%CC_DEVTOOLS_CMD%% -p --output-format json "Reply OK"
echo echo.
echo echo   Preparing bridge port %%CC_DEVTOOLS_PORT%%
echo for /f "tokens=5" %%%%P in ^('netstat -ano ^^^| findstr /C:":%%CC_DEVTOOLS_PORT%%" ^^^| findstr "LISTENING"'^) do ^(
echo     if not "%%%%P"=="0" ^(
echo         echo   Stopping existing process on port %%CC_DEVTOOLS_PORT%%: %%%%P
echo         taskkill /F /PID %%%%P ^>nul 2^>^&1
echo     ^)
echo ^)
echo echo.
echo rem cc-devtools
echo %PYTHON% -m cc_devtools.server
echo set "BRIDGE_EXIT=%%ERRORLEVEL%%"
echo echo.
echo echo   Bridge stopped with exit code %%BRIDGE_EXIT%%.
echo echo   The F12 panel can only stay connected while this bridge is running.
echo echo.
echo pause
echo exit /b %%BRIDGE_EXIT%%
) > "%START_SCRIPT%"

start "CC DevTools Bridge" "%START_SCRIPT%"

echo.
echo   Opening Chrome extension setup...
start "" "chrome://extensions"
explorer "%EXT_DIR%"

echo.
echo   ==========================================
echo     Install complete
echo   ==========================================
echo.
echo   Chrome step:
echo     1. Enable Developer mode
echo     2. Click Load unpacked
echo     3. Select this folder:
echo        %EXT_DIR%
echo     4. Open any web page, press F12, choose Claude Code
echo.
echo   After this, double-click start-bridge.bat only if you restart Windows
echo   or close the bridge window.
echo   Local file actions are limited to:
echo     %WRITE_ROOT%
echo   File writes are disabled unless CC_DEVTOOLS_ENABLE_WRITE=1 is set.
echo   Bridge log:
echo     %LOG_PATH%
echo.
pause
