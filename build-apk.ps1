# ==============================================================================
# Cyberguru - Script de Compilación de APK para Android (Windows PowerShell)
# Autor: cast0rtech
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   CYBERGURU — Generador de APK para Android" -ForegroundColor Cyan
Write-Host "   Autor: cast0rtech" -ForegroundColor DarkCyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Configurar variables de entorno del SDK
if (-not $env:ANDROID_HOME) {
    if (Test-Path "$env:LOCALAPPDATA\Android\Sdk") {
        $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
        Write-Host "[✓] Android SDK detectado en: $env:ANDROID_HOME" -ForegroundColor Green
    } else {
        Write-Host "[!] ADVERTENCIA: Variable ANDROID_HOME no definida. Gradle intentará usar la ruta por defecto." -ForegroundColor Yellow
    }
}

# 2. Compilar assets del Frontend (React + Vite)
Write-Host "[1/3] Compilando frontend React y sincronizando con Capacitor..." -ForegroundColor Yellow
Set-Location frontend
npm run build
npx cap sync android
Set-Location ..

# 3. Compilar APK con Gradle
Write-Host "[2/3] Compilando binario APK con Gradle wrapper..." -ForegroundColor Yellow
Set-Location frontend\android
.\gradlew.bat assembleDebug
$gradleStatus = $LASTEXITCODE
Set-Location ..\..

if ($gradleStatus -ne 0) {
    Write-Host "[X] Error durante la compilación de Gradle." -ForegroundColor Red
    exit 1
}

# 4. Copiar APK a la raíz del proyecto
$apkSource = "frontend\android\app\build\outputs\apk\debug\app-debug.apk"
$apkDest = "Cyberguru.apk"

if (Test-Path $apkSource) {
    Copy-Item $apkSource -Destination $apkDest -Force
    $fileInfo = Get-Item $apkDest
    $sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
    Write-Host "[3/3] ¡APK compilada con éxito!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Ubicación del instalador: $apkDest ($sizeMB MB)" -ForegroundColor Cyan
    Write-Host "Para instalar en tu dispositivo conectado por USB:" -ForegroundColor Yellow
    Write-Host "  adb install -r $apkDest" -ForegroundColor White
} else {
    Write-Host "[!] No se encontró el archivo generado en $apkSource" -ForegroundColor Red
}
