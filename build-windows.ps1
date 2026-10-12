# ==============================================================================
# Cyberguru - Script de Compilación Portable e Instalador de Windows
# Autor: cast0rtech
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   CYBERGURU - Generador de Version Portable e Instalador" -ForegroundColor Cyan
Write-Host "   Autor: cast0rtech" -ForegroundColor DarkCyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

Stop-Process -Name Cyberguru -Force -ErrorAction SilentlyContinue

# Auto-detectar Go
if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    if (Test-Path "$PSScriptRoot\.tools\go\bin\go.exe") {
        $env:GOROOT = "$PSScriptRoot\.tools\go"
        $env:PATH = "$PSScriptRoot\.tools\go\bin;" + $env:PATH
        Write-Host "(+) Go portable detectado en: .tools\go\bin" -ForegroundColor Green
    } elseif (Test-Path "C:\Program Files\Go\bin\go.exe") {
        $env:PATH = "C:\Program Files\Go\bin;" + $env:PATH
        Write-Host "(+) Go detectado en: C:\Program Files\Go\bin" -ForegroundColor Green
    } elseif (Test-Path "C:\Go\bin\go.exe") {
        $env:PATH = "C:\Go\bin;" + $env:PATH
        Write-Host "(+) Go detectado en: C:\Go\bin" -ForegroundColor Green
    } else {
        Write-Host "(-) Go no encontrado. Descarga Go o ejecutalo con .tools\go" -ForegroundColor Red
        exit 1
    }
}

# 1. Compilar Frontend
Write-Host "[1/5] Compilando frontend React + Vite..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\frontend"
if (-not (Test-Path "node_modules")) {
    npm install
}
npm run build
Set-Location $PSScriptRoot

# 2. Copiar distribución frontend a backend para embeberlo
Write-Host "[2/5] Embebiendo recursos frontend en el backend..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "backend\api\dist" | Out-Null
Copy-Item -Recurse -Force "frontend\dist\*" "backend\api\dist\"

# 3. Compilar Cyberguru.exe (Binario único independiente)
Write-Host "[3/5] Compilando Cyberguru.exe (Binario portable unico)..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "bin" | Out-Null
Set-Location "$PSScriptRoot\backend"
go build -ldflags="-s -w" -o "..\bin\Cyberguru.exe" .
Set-Location $PSScriptRoot

# 4. Compilar Cyberguru-Setup.exe (Instalador universal de Windows)
Write-Host "[4/5] Compilando instalador universal Cyberguru-Setup.exe..." -ForegroundColor Yellow
Copy-Item "bin\Cyberguru.exe" "installer\Cyberguru.exe" -Force
if (Test-Path "app_icon.ico") {
    Copy-Item "app_icon.ico" "installer\app_icon.ico" -Force
    Copy-Item "app_icon.ico" "dist-windows\Cyberguru-Portable\app_icon.ico" -Force -ErrorAction SilentlyContinue
}
Set-Location "$PSScriptRoot\installer"
go build -ldflags="-s -w" -o "..\bin\Cyberguru-Setup.exe" .
Set-Location $PSScriptRoot

# 5. Generar carpeta de distribución y archivo ZIP
Write-Host "[5/5] Creando paquete de distribucion portable y ZIP..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "dist-windows\Cyberguru-Portable\data" | Out-Null
Copy-Item "bin\Cyberguru.exe" "dist-windows\Cyberguru-Portable\Cyberguru.exe" -Force
Copy-Item "bin\Cyberguru-Setup.exe" "dist-windows\Cyberguru-Setup.exe" -Force
if (Test-Path "app_icon.ico") {
    Copy-Item "app_icon.ico" "dist-windows\Cyberguru-Portable\app_icon.ico" -Force
}

if (Test-Path "dist-windows\Cyberguru-v1.0.0-Windows-Portable.zip") {
    Remove-Item "dist-windows\Cyberguru-v1.0.0-Windows-Portable.zip" -Force
}
Get-ChildItem -Path "dist-windows\Cyberguru-Portable" -Exclude "data" | Compress-Archive -DestinationPath "dist-windows\Cyberguru-v1.0.0-Windows-Portable.zip" -Force

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   COMPILACION PORTABLE EXITOSA!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Artefactos generados en: .\dist-windows\" -ForegroundColor Cyan
Write-Host "  1. dist-windows\Cyberguru-Setup.exe                  (Instalador 1-clic)" -ForegroundColor White
Write-Host "  2. dist-windows\Cyberguru-Portable\                  (Carpeta lista para USB/PC)" -ForegroundColor White
Write-Host "  3. dist-windows\Cyberguru-v1.0.0-Windows-Portable.zip (Archivo ZIP para distribuir)" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green
