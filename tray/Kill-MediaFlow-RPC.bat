@echo off
setlocal EnableExtensions
echo Closing MediaFlow RPC processes...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$k=0; Get-CimInstance Win32_Process ^| Where-Object { (($_.Name -ieq 'java.exe' -or $_.Name -ieq 'javaw.exe') -and $_.CommandLine -match 'MediaFlowRPC\.jar') -or ($_.Name -ieq 'MediaFlow RPC.exe') } ^| ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop; $k++ } catch{} }; Write-Host ('Closed ' + $k + ' MediaFlow RPC process(es).')"
timeout /t 1 /nobreak >nul
exit /b 0
