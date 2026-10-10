@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .venv\Scripts\activate.bat (
  echo Сначала запусти 1_setup.bat
  pause
  exit /b 1
)
call .venv\Scripts\activate.bat
python main.py
echo.
echo Лог и отчёт лежат в папке logs
pause
