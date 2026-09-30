@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if defined JAVA_HOME if exist "%JAVA_HOME%\bin\javaw.exe" (
  start "" "%JAVA_HOME%\bin\javaw.exe" -jar "%~dp0MediaFlowRPC.jar"
  exit /b 0
)

where javaw.exe >nul 2>nul
if not errorlevel 1 (
  start "" javaw.exe -jar "%~dp0MediaFlowRPC.jar"
  exit /b 0
)

echo Java 17 or newer was not found.
echo Install a JDK/JRE, then run this file again.
pause
