# ==============================================================================
# Cyberguru - Script de Instalación y Ejecución Local en Windows
# Autor: cast0rtech
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   CYBERGURU — Instalador y Lanzador Local" -ForegroundColor Cyan
Write-Host "   Autor: cast0rtech" -ForegroundColor DarkCyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# Auto-detectar ruta de Go si se acaba de instalar y aún no está en PATH
if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    if (Test-Path "C:\Program Files\Go\bin\go.exe") {
        $env:PATH = "C:\Program Files\Go\bin;" + $env:PATH
        Write-Host "[✓] Go detectado en: C:\Program Files\Go\bin" -ForegroundColor Green
    } elseif (Test-Path "C:\Go\bin\go.exe") {
        $env:PATH = "C:\Go\bin;" + $env:PATH
        Write-Host "[✓] Go detectado en: C:\Go\bin" -ForegroundColor Green
    }
}

$useDocker = $false
$hasDocker = Get-Command docker -ErrorAction SilentlyContinue
$hasGo = Get-Command go -ErrorAction SilentlyContinue

if ($args -contains "--docker" -or (-not $hasGo -and $hasDocker)) {
    $useDocker = $true
}

if ($useDocker) {
    Write-Host "[1/2] Iniciando contenedor con Docker Compose..." -ForegroundColor Yellow
    docker compose up --build -d
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[2/2] ¡Cyberguru iniciado correctamente con Docker!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Accede al Dashboard en: http://localhost:8080" -ForegroundColor Cyan
        Start-Process "http://localhost:8080"
        exit 0
    } else {
        Write-Host "[!] Error iniciando contenedor con Docker. Verifica que Docker Desktop esté en ejecución." -ForegroundColor Red
        if ($hasGo) {
            Write-Host "[*] Alternando automáticamente al modo nativo con Go..." -ForegroundColor Yellow
        } else {
            exit 1
        }
    }
}

# Modo nativo
Write-Host "[1/3] Compilando frontend (React + Vite)..." -ForegroundColor Yellow
Set-Location frontend
npm install
npm run build
Set-Location ..

Write-Host "[2/3] Compilando el backend en Go..." -ForegroundColor Yellow
if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    Write-Host "[X] Go no se encuentra en el PATH. Reinicia tu terminal o instala Go: https://go.dev/dl/" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path "bin" | Out-Null
Set-Location backend
go mod tidy
go build -ldflags="-s -w" -o ..\bin\cyberguru.exe .
Set-Location ..

Write-Host "[3/3] ¡Compilación finalizada con éxito!" -ForegroundColor Green
Write-Host "Iniciando Cyberguru en http://localhost:8080..." -ForegroundColor Cyan

$env:PORT = "8080"
$env:DB_PATH = "./backend/data/cyberguru.db"
$env:FRONTEND_DIR = "./frontend/dist"

Start-Process "http://localhost:8080"
.\bin\cyberguru.exe
