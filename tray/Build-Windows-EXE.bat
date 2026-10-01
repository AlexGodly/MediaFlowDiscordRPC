@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title MediaFlow RPC - Windows EXE Builder

echo ============================================================
echo          MediaFlow RPC - Windows EXE Builder
echo ============================================================
echo.

set "JAVAC="
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\javac.exe" set "JAVAC=%JAVA_HOME%\bin\javac.exe"
if not defined JAVAC for /f "delims=" %%J in ('where javac.exe 2^>nul') do if not defined JAVAC set "JAVAC=%%J"

if not defined JAVAC (
  echo ERROR: A full JDK 17 or newer was not found.
  pause
  exit /b 1
)

for %%I in ("%JAVAC%") do set "JDK_BIN=%%~dpI"
for %%I in ("%JDK_BIN%..") do set "JDK_HOME=%%~fI"

if not exist "%JDK_HOME%\bin\jpackage.exe" (
  echo ERROR: jpackage.exe was not found in:
  echo   %JDK_HOME%
  echo Install/use a full JDK 17+ and try again.
  pause
  exit /b 1
)

if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
mkdir build\classes
mkdir build\input

echo [1/4] Compiling tray companion...
"%JDK_HOME%\bin\javac.exe" -encoding UTF-8 --release 17 -d build\classes src\MediaFlowRpcTray.java
if errorlevel 1 goto :fail
copy /y mediaflow.png build\classes\mediaflow.png >nul

echo [2/4] Creating JAR...
"%JDK_HOME%\bin\jar.exe" --create --file build\input\MediaFlowRPC.jar --main-class MediaFlowRpcTray -C build\classes .
if errorlevel 1 goto :fail

echo [3/4] Creating portable Windows EXE app image...
"%JDK_HOME%\bin\jpackage.exe" ^
  --type app-image ^
  --name "MediaFlow RPC" ^
  --input build\input ^
  --main-jar MediaFlowRPC.jar ^
  --main-class MediaFlowRpcTray ^
  --icon mediaflow.ico ^
  --dest dist ^
  --vendor "Alex Godly" ^
  --app-version 1.8.0
if errorlevel 1 goto :fail

echo [4/4] Creating portable ZIP...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path 'dist\MediaFlow RPC' -DestinationPath 'dist\MediaFlow_RPC_Portable.zip' -CompressionLevel Optimal -Force"
if errorlevel 1 goto :fail

echo.
echo BUILD COMPLETE
echo EXE: %CD%\dist\MediaFlow RPC\MediaFlow RPC.exe
echo ZIP: %CD%\dist\MediaFlow_RPC_Portable.zip
echo.
pause
exit /b 0

:fail
echo.
echo BUILD FAILED.
pause
exit /b 1
