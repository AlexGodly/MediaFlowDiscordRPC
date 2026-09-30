@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================================
echo             MediaFlow RPC Diagnostics
echo ============================================================
echo.
echo [1] Java
echo ------------------------------------------------------------
where java.exe 2>nul
java -version 2>&1
echo.

echo [2] MediaFlow RPC files
echo ------------------------------------------------------------
if exist "%~dp0MediaFlowRPC.jar" (echo JAR: OK) else (echo JAR: MISSING)
if exist "%~dp0mediaflow.png" (echo Tray image: OK) else (echo Tray image: MISSING)
echo.

echo [3] Local bridge port 17372
echo ------------------------------------------------------------
netstat -ano | findstr ":17372"
if errorlevel 1 echo Nothing is listening on port 17372.
echo.

echo [4] Health check
echo ------------------------------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -Command "try {(Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:17372/health).Content} catch {Write-Host ('FAILED: ' + $_.Exception.Message)}"
echo.

echo [5] Live RPC status
echo ------------------------------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -Command "try {(Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:17372/status).Content} catch {Write-Host ('FAILED: ' + $_.Exception.Message)}"
echo.

echo [6] Running Java processes
echo ------------------------------------------------------------
tasklist | findstr /I "java.exe javaw.exe"
if errorlevel 1 echo No Java/javaw process found.
echo.

echo [7] Saved Discord Application ID
echo ------------------------------------------------------------
if exist "%APPDATA%\MediaFlow RPC\config.properties" (
  type "%APPDATA%\MediaFlow RPC\config.properties" | findstr /I "discordClientId"
) else (
  echo No config file yet.
)
echo.

echo [8] MediaFlow RPC log
echo ------------------------------------------------------------
if exist "%APPDATA%\MediaFlow RPC\MediaFlowRPC.log" (
  powershell -NoProfile -Command "Get-Content -Path $env:APPDATA+'\MediaFlow RPC\MediaFlowRPC.log' -Tail 40"
) else (
  echo No MediaFlowRPC.log exists yet.
)
echo.
echo ============================================================
echo Copy this window if you need to send the diagnostics back.
echo ============================================================
pause
