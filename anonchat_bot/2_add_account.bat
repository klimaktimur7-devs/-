@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .venv\Scripts\activate.bat (
  echo Сначала запусти 1_setup.bat
  pause
  exit /b 1
)
call .venv\Scripts\activate.bat
set /p NAME=Имя аккаунта латиницей (например acc1): 
if "%NAME%"=="" (
  echo Имя не введено.
  pause
  exit /b 1
)
python login.py %NAME%
pause
