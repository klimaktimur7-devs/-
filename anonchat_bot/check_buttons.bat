@echo off
chcp 65001 >nul
cd /d "%~dp0"
call _install.bat
if errorlevel 1 goto :end
echo Пробный запуск: покажет спонсоров и кнопки, ничего не нажимая.
set "NAME="
set /p NAME=Имя аккаунта (Enter = первый из папки sessions): 
if "%NAME%"=="" for %%F in (sessions\*.session) do if not defined NAME set "NAME=%%~nF"
if "%NAME%"=="" (
  echo В папке sessions нет аккаунтов. Запусти add_account.bat
  goto :end
)
.venv\Scripts\python.exe main.py --dry-run --session %NAME%
:end
pause
