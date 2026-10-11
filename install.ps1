# ==============================================================================
# Cyberguru - Script de Instalación y Ejecución Local en Windows
# Autor: cast0rtech
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   CYBERGURU — Instalador y Lanzador Local" -ForegroundColor Cyan
Write-Host "   Autor: cast0rtech" -ForegroundColor DarkCyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$useDocker = $false

# Comprobar si Docker está disponible
$hasDocker = Get-Command docker -ErrorAction SilentlyContinue

if ($args -contains "--docker" -or -not (Get-Command go -ErrorAction SilentlyContinue)) {
    if ($hasDocker) {
        $useDocker = $true
    }
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
        exit 1
    }
}

# Modo nativo
Write-Host "[1/3] Compilando frontend (React + Vite)..." -ForegroundColor Yellow
Set-Location frontend
npm install
npm run build
Set-Location ..

Write-Host "[2/3] Verificando Go y backend..." -ForegroundColor Yellow
if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Go no está instalado en el sistema para compilación nativa." -ForegroundColor Yellow
    Write-Host "Por favor inicia Docker Desktop y ejecuta: .\install.ps1 --docker" -ForegroundColor Cyan
    exit 1
}

New-Item -ItemType Directory -Force -Path "bin" | Out-Null
Set-Location backend
go build -ldflags="-s -w" -o ..\bin\cyberguru.exe .
Set-Location ..

Write-Host "[3/3] ¡Compilación finalizada con éxito!" -ForegroundColor Green
Write-Host "Iniciando Cyberguru en http://localhost:8080..." -ForegroundColor Cyan

$env:PORT = "8080"
$env:DB_PATH = "./backend/data/cyberguru.db"
$env:FRONTEND_DIR = "./frontend/dist"

Start-Process "http://localhost:8080"
.\bin\cyberguru.exe
