@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

:: ПРМ Мессенджер — Установка (Windows)
:: Запуск: двойной клик по setup.bat

title ПРМ Мессенджер — Установка

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║     ПРМ — Корпоративный мессенджер       ║
echo  ║         Установка приложения              ║
echo  ╚══════════════════════════════════════════╝
echo.

set "APP_DIR=%~dp0"
set "APP_DIR=%APP_DIR:~0,-1%"

:: ─── Check Node.js ─────────────────────────────────────────────

echo [Проверка] Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo  Node.js не найден!
    echo.
    echo  Установите Node.js 18+ с сайта: https://nodejs.org/
    echo  Скачайте LTS версию, установите, затем запустите setup.bat снова.
    echo.
    echo  Или установите через winget:
    echo    winget install OpenJS.NodeJS.LTS
    echo.
    pause
    exit /b 1
)

for /f "tokens=1" %%v in ('node -v') do set NODE_VER=%%v
echo  ✓ Node.js найден: %NODE_VER%

:: ─── Install dependencies ──────────────────────────────────────

echo.
echo [1/4] Установка зависимостей сервера...
cd /d "%APP_DIR%"
call npm install --production=false >nul 2>&1
if errorlevel 1 (
    echo  ! Ошибка установки зависимостей сервера
    call npm install
)
echo  ✓ Зависимости сервера установлены

echo [2/4] Установка зависимостей клиента...
cd /d "%APP_DIR%\client"
call npm install >nul 2>&1
if errorlevel 1 (
    echo  ! Ошибка установки зависимостей клиента
    call npm install
)
echo  ✓ Зависимости клиента установлены

:: ─── Build frontend ────────────────────────────────────────────

echo.
echo [3/4] Сборка фронтенда...
cd /d "%APP_DIR%\client"
call npx vite build >nul 2>&1
if errorlevel 1 (
    echo  ! Ошибка сборки, повторяю с выводом...
    call npx vite build
)
echo  ✓ Фронтенд собран

:: ─── Create directories ────────────────────────────────────────

if not exist "%APP_DIR%\server\data" mkdir "%APP_DIR%\server\data"
if not exist "%APP_DIR%\server\uploads" mkdir "%APP_DIR%\server\uploads"

:: ─── Create shortcuts ──────────────────────────────────────────

echo.
echo [4/4] Создание ярлыков...

:: Create a VBS script to make proper shortcuts
set "VBS_TEMP=%TEMP%\create_shortcut.vbs"
(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo.
echo ' Desktop shortcut
echo Set desktopLink = WshShell.CreateShortcut(WshShell.SpecialFolders("Desktop"^) ^& "\ПРМ Мессенджер.lnk"^)
echo desktopLink.TargetPath = "node"
echo desktopLink.Arguments = "start.js"
echo desktopLink.WorkingDirectory = "%APP_DIR%"
echo desktopLink.Description = "Корпоративный мессенджер — Аэропорт Пулково"
echo If CreateObject("Scripting.FileSystemObject"^).FileExists("%APP_DIR%\logo.png"^) Then
echo   desktopLink.IconLocation = "%APP_DIR%\logo.png"
echo End If
echo desktopLink.Save
echo.
echo ' Start Menu shortcut
echo Set startDir = WshShell.SpecialFolders("StartMenu"^) ^& "\Programs"
echo Set startLink = WshShell.CreateShortcut(startDir ^& "\ПРМ Мессенджер.lnk"^)
echo startLink.TargetPath = "node"
echo startLink.Arguments = "start.js"
echo startLink.WorkingDirectory = "%APP_DIR%"
echo startLink.Description = "Корпоративный мессенджер — Аэропорт Пулково"
echo If CreateObject("Scripting.FileSystemObject"^).FileExists("%APP_DIR%\logo.png"^) Then
echo   startLink.IconLocation = "%APP_DIR%\logo.png"
echo End If
echo startLink.Save
) > "%VBS_TEMP%"

cscript //nologo "%VBS_TEMP%" 2>nul
del "%VBS_TEMP%" 2>nul

echo  ✓ Ярлык создан на рабочем столе
echo  ✓ Приложение добавлено в меню Пуск

:: ─── Create launcher bat ───────────────────────────────────────

(
echo @echo off
echo cd /d "%APP_DIR%"
echo start "" /min node start.js
) > "%APP_DIR%\ПРМ Мессенджер.bat"

:: ─── Done ──────────────────────────────────────────────────────

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║        Установка завершена!               ║
echo  ╚══════════════════════════════════════════╝
echo.
echo  Способы запуска:
echo    1. Ярлык на рабочем столе "ПРМ Мессенджер"
echo    2. Меню Пуск → ПРМ Мессенджер
echo    3. Команда: node start.js         (десктоп)
echo    4. Команда: node start.js --web   (браузер)
echo.
echo  Демо-вход: admin / admin123
echo.

set /p LAUNCH="Запустить приложение сейчас? [Y/n] "
if /i "%LAUNCH%"=="" set LAUNCH=Y
if /i "%LAUNCH%"=="Y" (
    echo.
    echo  Запуск ПРМ Мессенджер...
    cd /d "%APP_DIR%"
    node start.js
)
if /i "%LAUNCH%"=="Д" (
    echo.
    echo  Запуск ПРМ Мессенджер...
    cd /d "%APP_DIR%"
    node start.js
)

pause
