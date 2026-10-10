@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python не найден. Установи его с https://www.python.org/downloads/
  echo и при установке поставь галочку "Add Python to PATH".
  pause
  exit /b 1
)
if not exist .venv\Scripts\activate.bat (
  echo Создаю окружение...
  python -m venv .venv
)
call .venv\Scripts\activate.bat
echo Ставлю библиотеки...
python -m pip install -q --upgrade pip
pip install -q -r requirements.txt
if errorlevel 1 (
  echo Ошибка установки библиотек.
  pause
  exit /b 1
)
if not exist .env copy .env.example .env >nul
if not exist sessions mkdir sessions
echo.
echo Готово. Сейчас откроется файл .env:
echo впиши API_ID и API_HASH (с https://my.telegram.org), сохрани и закрой.
notepad .env
pause
