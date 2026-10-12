# ==============================================================================
# Cyberguru - Script de Instalación y Ejecución Local en Windows
# Autor: cast0rtech
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   CYBERGURU - Instalador y Lanzador para Windows" -ForegroundColor Cyan
Write-Host "   Autor: cast0rtech | Version: 1.0.0" -ForegroundColor DarkCyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot

# Auto-detectar ruta de Go
if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    if (Test-Path "$PSScriptRoot\.tools\go\bin\go.exe") {
        $env:GOROOT = "$PSScriptRoot\.tools\go"
        $env:PATH = "$PSScriptRoot\.tools\go\bin;" + $env:PATH
        Write-Host "(+) Go detectado en: .tools\go\bin" -ForegroundColor Green
    } elseif (Test-Path "C:\Program Files\Go\bin\go.exe") {
        $env:PATH = "C:\Program Files\Go\bin;" + $env:PATH
        Write-Host "(+) Go detectado en: C:\Program Files\Go\bin" -ForegroundColor Green
    } elseif (Test-Path "C:\Go\bin\go.exe") {
        $env:PATH = "C:\Go\bin;" + $env:PATH
        Write-Host "(+) Go detectado en: C:\Go\bin" -ForegroundColor Green
    }
}

# Comprobar si el usuario solicitó explícitamente Docker
$wantDocker = ($args -contains "--docker")

if ($wantDocker) {
    Write-Host "[*] Comprobando disponibilidad del servicio Docker..." -ForegroundColor Yellow
    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue

    if (-not $dockerCmd) {
        Write-Host "[!] El comando docker no se encuentra instalado en este equipo." -ForegroundColor Red
        Write-Host "[*] Alternando al modo nativo/portable de Windows..." -ForegroundColor Cyan
        $wantDocker = $false
    } else {
        # Verificar si el demonio de Docker Desktop está respondiendo realmente
        $daemonRunning = $false
        try {
            $null = & docker info --format '{{.ServerVersion}}' 2>&1
            if ($LASTEXITCODE -eq 0) {
                $daemonRunning = $true
            }
        } catch {
            $daemonRunning = $false
        }

        if (-not $daemonRunning) {
            Write-Host "[!] Docker Desktop esta instalado, pero el demonio no esta en ejecucion." -ForegroundColor Red
            Write-Host "    (Error tipico: failed to connect to docker API at //./pipe/dockerDesktopLinuxEngine)" -ForegroundColor DarkGray
            
            # Intentar iniciar Docker Desktop si existe el ejecutable
            $ddPaths = @(
                "C:\Program Files\Docker\Docker\Docker Desktop.exe",
                "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"
            )
            $ddFound = $ddPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

            if ($ddFound) {
                Write-Host "[*] Iniciando Docker Desktop en segundo plano..." -ForegroundColor Yellow
                Start-Process $ddFound
                Write-Host "[*] Esperando 10 segundos a que inicialice el demonio de Docker..." -ForegroundColor Yellow
                Start-Sleep -Seconds 10
                
                try {
                    $null = & docker info --format '{{.ServerVersion}}' 2>&1
                    if ($LASTEXITCODE -eq 0) { $daemonRunning = $true }
                } catch {}
            }

            if (-not $daemonRunning) {
                Write-Host "[!] No se pudo comunicar con el demonio de Docker en este momento." -ForegroundColor Yellow
                Write-Host "[*] Alternando automaticamente a la ejecucion nativa de Windows (sin necesidad de Docker)..." -ForegroundColor Green
                $wantDocker = $false
            }
        }
    }
}

# Ejecución vía Docker si el demonio está activo y fue solicitado
if ($wantDocker) {
    Write-Host "[1/2] Iniciando contenedor con Docker Compose..." -ForegroundColor Yellow
    docker compose up --build -d
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[2/2] ¡Cyberguru iniciado correctamente con Docker!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Accede al Dashboard en: http://localhost:8080" -ForegroundColor Cyan
        Start-Process "http://localhost:8080"
        exit 0
    } else {
        Write-Host "[!] Error iniciando contenedor con Docker. Alternando a ejecucion nativa..." -ForegroundColor Yellow
    }
}

# ==============================================================================
# MODO NATIVO / PORTABLE DE WINDOWS (Zero Docker Dependencies)
# ==============================================================================
Write-Host ""
Write-Host "[*] Modo Nativo de Windows (Sin Docker):" -ForegroundColor Cyan

# 1. Comprobar si ya existe el binario precompilado
$exePath = "$PSScriptRoot\bin\Cyberguru.exe"
if (-not (Test-Path $exePath)) {
    $exePath = "$PSScriptRoot\dist-windows\Cyberguru-Portable\Cyberguru.exe"
}

if (-not (Test-Path $exePath) -or ($args -contains "--build")) {
    Write-Host "[1/3] Compilando suite nativa y frontend React..." -ForegroundColor Yellow
    & "$PSScriptRoot\build-windows.ps1"
    $exePath = "$PSScriptRoot\bin\Cyberguru.exe"
}

if (-not (Test-Path $exePath)) {
    Write-Host "[X] No se pudo encontrar ni compilar el ejecutable Cyberguru.exe." -ForegroundColor Red
    exit 1
}

# Si se pasa --install, ejecutar el instalador de sistema
if ($args -contains "--install" -and (Test-Path "$PSScriptRoot\dist-windows\Cyberguru-Setup.exe")) {
    Write-Host "[+] Ejecutando instalador oficial de Windows..." -ForegroundColor Green
    Start-Process "$PSScriptRoot\dist-windows\Cyberguru-Setup.exe"
    exit 0
}

Write-Host "[+] Iniciando Cyberguru en http://localhost:8080..." -ForegroundColor Green
Write-Host "    Para detener la aplicacion presiona Ctrl+C" -ForegroundColor DarkGray
Write-Host ""

Start-Process $exePath
exit 0
