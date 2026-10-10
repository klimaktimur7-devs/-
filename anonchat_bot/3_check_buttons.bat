@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .venv\Scripts\activate.bat (
  echo Сначала запусти 1_setup.bat
  pause
  exit /b 1
)
call .venv\Scripts\activate.bat
echo Пробный запуск: дойдёт до списка спонсоров и покажет кнопки, ничего не нажимая.
set NAME=
set /p NAME=Имя аккаунта (Enter = первый из папки sessions): 
if "%NAME%"=="" (
  for %%F in (sessions\*.session) do (
    set NAME=%%~nF
    goto :run
  )
  echo В папке sessions нет аккаунтов. Запусти 2_add_account.bat
  pause
  exit /b 1
)
:run
python main.py --dry-run --session %NAME%
pause
