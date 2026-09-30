@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "APPDIR=%APPDATA%\MediaFlow RPC"
if not exist "%APPDIR%" mkdir "%APPDIR%" >nul 2>nul
set "LOG=%APPDIR%\launcher.log"

echo [%date% %time%] Starting MediaFlow RPC>>"%LOG%"

set "JAVAW="
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\javaw.exe" set "JAVAW=%JAVA_HOME%\bin\javaw.exe"
if not defined JAVAW (
  for /f "delims=" %%J in ('where javaw.exe 2^>nul') do if not defined JAVAW set "JAVAW=%%J"
)

if not defined JAVAW (
  echo Java 17 or newer was not found.
  echo Install a JDK/JRE, then run this file again.
  echo [%date% %time%] ERROR: javaw.exe not found>>"%LOG%"
  pause
  exit /b 1
)

echo [%date% %time%] Using: %JAVAW%>>"%LOG%"
start "MediaFlow RPC" "%JAVAW%" -jar "%~dp0MediaFlowRPC.jar"

rem Give the tray process a moment to bind its local bridge.
timeout /t 2 /nobreak >nul

powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=New-Object Net.Sockets.TcpClient; try{$a=$c.BeginConnect('127.0.0.1',17372,$null,$null); if(-not $a.AsyncWaitHandle.WaitOne(1500)){exit 1}; $c.EndConnect($a); exit 0}catch{exit 1}finally{$c.Close()}" >nul 2>nul
if errorlevel 1 (
  echo.
  echo MediaFlow RPC did not start its local bridge on port 17372.
  echo.
  echo Open this log for the exact reason:
  echo   %APPDIR%\MediaFlowRPC.log
  echo.
  echo You can also run Diagnose-MediaFlow-RPC.bat.
  echo [%date% %time%] ERROR: bridge port 17372 not listening>>"%LOG%"
  pause
  exit /b 2
)

echo [%date% %time%] Bridge is listening on 127.0.0.1:17372>>"%LOG%"
exit /b 0
