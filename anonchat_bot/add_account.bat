@echo off
chcp 65001 >nul
cd /d "%~dp0"
call _install.bat
if errorlevel 1 goto :end
set "NAME="
set /p NAME=Имя аккаунта латиницей (например acc1): 
if "%NAME%"=="" (
  echo Имя не введено.
  goto :end
)
.venv\Scripts\python.exe login.py %NAME%
:end
if not "%~1"=="nopause" pause
