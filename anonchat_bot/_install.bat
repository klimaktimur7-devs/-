@echo off
rem Ставит Python (если нет), окружение и библиотеки. Вызывается из других .bat.
chcp 65001 >nul
cd /d "%~dp0"

if exist .venv\Scripts\python.exe goto :deps

set "PY="
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul && set "PY=python"
if not defined PY if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if defined PY goto :venv

echo Python не найден — скачиваю и ставлю (пару минут)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; Invoke-WebRequest 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe' -OutFile ($env:TEMP + '\python-setup.exe')"
if not exist "%TEMP%\python-setup.exe" (
  echo Не получилось скачать Python. Проверь интернет или поставь вручную с python.org
  exit /b 1
)
"%TEMP%\python-setup.exe" /quiet InstallAllUsers=0 PrependPath=1 Include_launcher=0 Include_test=0
set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not exist "%PY%" (
  echo Python не установился. Поставь вручную с python.org, галочка "Add Python to PATH".
  exit /b 1
)

:venv
echo Создаю окружение...
"%PY%" -m venv .venv
if errorlevel 1 (
  echo Не получилось создать окружение.
  exit /b 1
)

:deps
echo Проверяю библиотеки...
.venv\Scripts\python.exe -m pip install -q --disable-pip-version-check -r requirements.txt
if errorlevel 1 (
  echo Ошибка установки библиотек. Проверь интернет.
  exit /b 1
)
if not exist sessions mkdir sessions
if not exist .env copy .env.example .env >nul

findstr /b /c:"API_ID=123456" .env >nul
if not errorlevel 1 (
  echo.
  echo Сейчас откроется файл .env.
  echo Впиши API_ID и API_HASH с https://my.telegram.org — API development tools,
  echo сохрани Ctrl+S и закрой Блокнот.
  notepad .env
)
findstr /b /c:"API_ID=123456" .env >nul
if not errorlevel 1 (
  echo API_ID всё ещё не заполнен. Заполни .env и запусти снова.
  exit /b 1
)
exit /b 0
