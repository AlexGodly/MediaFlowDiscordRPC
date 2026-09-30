@echo off
set "LOG=%APPDATA%\MediaFlow RPC\MediaFlowRPC.log"
if not exist "%LOG%" (
  echo No log exists yet. Run MediaFlow RPC first.
  pause
  exit /b 1
)
start "" notepad.exe "%LOG%"
