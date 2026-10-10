@echo off
chcp 65001 >nul
cd /d "%~dp0"
call _install.bat
if errorlevel 1 goto :end

dir /b sessions\*.session >nul 2>nul
if errorlevel 1 (
  echo.
  echo Аккаунтов пока нет — добавим первый.
  call add_account.bat nopause
  dir /b sessions\*.session >nul 2>nul
  if errorlevel 1 goto :end
)

echo.
echo Запускаю...
.venv\Scripts\python.exe main.py
echo.
echo Лог и отчёт лежат в папке logs
:end
pause
