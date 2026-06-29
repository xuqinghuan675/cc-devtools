@echo off
setlocal EnableDelayedExpansion

title CC DevTools Install

echo.
echo   ======================================
echo     Claude Code DevTools Extension
echo   ======================================
echo.

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo   Node: %%v

REM Check CC
where cc >nul 2>&1
if %errorlevel% neq 0 (
    echo   [WARN] cc command not found in PATH
)

echo.

REM --- Install bridge to LOCAL disk (bypass OneDrive file-lock) ---
set BRIDGE_DIR=%LOCALAPPDATA%\cc-devtools-bridge
echo   [1/3] Install Bridge Server
echo   Target: %BRIDGE_DIR%
echo.

if not exist "%BRIDGE_DIR%" mkdir "%BRIDGE_DIR%"

copy /y "%~dp0bridge\server.js" "%BRIDGE_DIR%\" >nul
copy /y "%~dp0bridge\package.json" "%BRIDGE_DIR%\" >nul

cd /d "%BRIDGE_DIR%"
echo   Running npm install...
call npm install --loglevel=error

if %errorlevel% neq 0 (
    echo   npm failed, trying offline method...
    cd /d "%TEMP%"
    if exist cc-dt rmdir /s /q cc-dt
    mkdir cc-dt
    cd cc-dt
    call npm pack ws --loglevel=error
    if exist ws-*.tgz (
        for %%f in (ws-*.tgz) do (
            if not exist "%BRIDGE_DIR%\node_modules\ws" mkdir "%BRIDGE_DIR%\node_modules\ws"
            tar xzf %%f --strip-components=1 -C "%BRIDGE_DIR%\node_modules\ws"
        )
    )
    cd /d "%BRIDGE_DIR%"
    rmdir /s /q "%TEMP%\cc-dt" 2>nul
)

node -e "require('./node_modules/ws')" >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERR] ws module install failed
    echo   Try moving project to D:\ and re-run
    pause
    exit /b 1
)
echo   Bridge Server OK
echo.

REM --- Generate icons ---
echo   [2/3] Generate icons...
cd /d "%~dp0bridge"
node generate-icons.js
if %errorlevel% neq 0 (
    echo   [WARN] Icon generation failed
)
echo.

REM --- Create start script ---
echo   [3/3] Create start-bridge.bat...
cd /d "%~dp0"
(
echo @echo off
echo title CC DevTools Bridge
echo cd /d "%BRIDGE_DIR%"
echo echo.
echo echo   CC DevTools Bridge Server
echo echo   ws://localhost:9876
echo echo.
echo node server.js
echo echo.
echo pause
) > start-bridge.bat
echo   Done

echo.
echo   ======================================
echo     Install Complete
echo   ======================================
echo.
echo   Steps:
echo     1. Double-click start-bridge.bat
echo     2. Chrome: chrome://extensions
echo     3. Enable "Developer mode"
echo     4. "Load unpacked" -^> select:
echo        %~dp0extension
echo     5. F12 on any page -^> "Claude Code" tab
echo.
pause
