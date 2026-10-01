@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "APPDIR=%APPDATA%\MediaFlow RPC"
if not exist "%APPDIR%" mkdir "%APPDIR%" >nul 2>nul
set "LOG=%APPDIR%\launcher.log"

echo [%date% %time%] Starting MediaFlow RPC v12>>"%LOG%"

rem v12 cleanup: terminate ONLY older Java MediaFlowRPC.jar companions.
rem This prevents an old hidden v6 process from owning port 17372.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$procs=Get-CimInstance Win32_Process ^| Where-Object { ($_.Name -ieq 'java.exe' -or $_.Name -ieq 'javaw.exe') -and $_.CommandLine -match 'MediaFlowRPC\.jar' }; foreach($p in $procs){ try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch{} }" >nul 2>nul

timeout /t 1 /nobreak >nul

rem If something else still owns the bridge port, don't create another ghost tray process.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$c=Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 17372 -State Listen -ErrorAction SilentlyContinue; if($c){exit 1}else{exit 0}" >nul 2>nul
if errorlevel 1 (
  echo.
  echo Port 17372 is already in use by another process.
  echo Close the old MediaFlow RPC process in Task Manager once, then run this again.
  echo [%date% %time%] ERROR: port 17372 already occupied>>"%LOG%"
  pause
  exit /b 3
)

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

timeout /t 2 /nobreak >nul

powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=New-Object Net.Sockets.TcpClient; try{$a=$c.BeginConnect('127.0.0.1',17372,$null,$null); if(-not $a.AsyncWaitHandle.WaitOne(1500)){exit 1}; $c.EndConnect($a); exit 0}catch{exit 1}finally{$c.Close()}" >nul 2>nul
if errorlevel 1 (
  echo.
  echo MediaFlow RPC did not start its local bridge on port 17372.
  echo Open this log for the exact reason:
  echo   %APPDIR%\MediaFlowRPC.log
  echo.
  echo You can also run Diagnose-MediaFlow-RPC.bat.
  echo [%date% %time%] ERROR: bridge port 17372 not listening>>"%LOG%"
  pause
  exit /b 2
)

echo [%date% %time%] v12 bridge is listening on 127.0.0.1:17372>>"%LOG%"
exit /b 0
