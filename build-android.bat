@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (py -3 scripts\build_android.py %*) else (python scripts\build_android.py %*)
pause
