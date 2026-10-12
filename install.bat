@echo off
chcp 65001 >nul
title Cyberguru Launcher
cd /d "%~dp0"

cls
echo ==============================================================
echo    CYBERGURU — Iniciando Launcher
echo ==============================================================
echo.

if exist "%~dp0dist-windows\Cyberguru-Portable\Cyberguru.exe" (
    echo Iniciando Cyberguru Portable...
    start "" cmd /c "timeout /t 2 /nobreak >nul & start \"\" http://localhost:8080"
    "%~dp0dist-windows\Cyberguru-Portable\Cyberguru.exe"
    pause
    exit /b 0
)

if exist "%~dp0bin\Cyberguru.exe" (
    echo Iniciando Cyberguru Binario...
    start "" cmd /c "timeout /t 2 /nobreak >nul & start \"\" http://localhost:8080"
    "%~dp0bin\Cyberguru.exe"
    pause
    exit /b 0
)

echo Compilando paquetes de Cyberguru primero...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-windows.ps1"
if exist "%~dp0dist-windows\Cyberguru-Portable\Cyberguru.exe" (
    start "" cmd /c "timeout /t 2 /nobreak >nul & start \"\" http://localhost:8080"
    "%~dp0dist-windows\Cyberguru-Portable\Cyberguru.exe"
    pause
)
