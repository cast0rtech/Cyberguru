# ==============================================================================
# Cyberguru - Script de Compilacion de APK para Android (Windows PowerShell)
# Autor: cast0rtech
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   CYBERGURU - Generador de APK para Android" -ForegroundColor Cyan
Write-Host "   Autor: cast0rtech" -ForegroundColor DarkCyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Configurar variables de entorno del SDK
if (-not $env:ANDROID_HOME) {
    if (Test-Path "C:\Android\Sdk") {
        $env:ANDROID_HOME = "C:\Android\Sdk"
        Write-Host "[+] Android SDK detectado en: $env:ANDROID_HOME" -ForegroundColor Green
    } elseif (Test-Path "$env:LOCALAPPDATA\Android\Sdk") {
        $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
        Write-Host "[+] Android SDK detectado en: $env:ANDROID_HOME" -ForegroundColor Green
    } else {
        Write-Host "[!] ADVERTENCIA: Variable ANDROID_HOME no definida. Gradle intentara usar la ruta por defecto." -ForegroundColor Yellow
    }
}

# 2. Compilar assets del Frontend (React + Vite)
Write-Host "[1/3] Compilando frontend React y sincronizando con Capacitor..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\frontend"
npm run build
npx cap sync android
Set-Location "$PSScriptRoot"

# 3. Compilar APK y AAB con Gradle
Write-Host "[2/3] Compilando binarios APK y AAB con Gradle wrapper..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\frontend\android"
.\gradlew.bat assembleDebug bundleDebug
$gradleStatus = $LASTEXITCODE
Set-Location "$PSScriptRoot"

if ($gradleStatus -ne 0) {
    Write-Host "[X] Error durante la compilacion de Gradle." -ForegroundColor Red
    exit 1
}

# 4. Copiar APK y AAB a la raiz del proyecto
$apkSource = "$PSScriptRoot\frontend\android\app\build\outputs\apk\debug\app-debug.apk"
$apkDest = "$PSScriptRoot\Cyberguru.apk"

$aabSource = "$PSScriptRoot\frontend\android\app\build\outputs\bundle\debug\app-debug.aab"
$aabDest = "$PSScriptRoot\Cyberguru.aab"

if (Test-Path $apkSource) {
    Copy-Item $apkSource -Destination $apkDest -Force
    $fileInfo = Get-Item $apkDest
    $sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
    Write-Host "[3/3] APK compilada con exito!" -ForegroundColor Green
    Write-Host "Ubicacion del APK: $apkDest ($sizeMB MB)" -ForegroundColor Cyan
} else {
    Write-Host "[!] No se encontro el archivo generado en $apkSource" -ForegroundColor Red
}

if (Test-Path $aabSource) {
    Copy-Item $aabSource -Destination $aabDest -Force
    $fileInfoAab = Get-Item $aabDest
    $sizeMBaab = [math]::Round($fileInfoAab.Length / 1MB, 2)
    Write-Host "Ubicacion del AAB: $aabDest ($sizeMBaab MB)" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Para instalar APK en tu dispositivo conectado por USB:" -ForegroundColor Yellow
Write-Host "  adb install -r $apkDest" -ForegroundColor White
