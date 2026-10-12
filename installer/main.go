package main

import (
	_ "embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

//go:embed Cyberguru.exe
var binaryData []byte

//go:embed app_icon.ico
var iconData []byte

func main() {
	banner := `
 ==============================================================
   CYBERGURU — Instalador para Windows (x64)
   Suite de Ciberseguridad, Redes & Sensores BLE
   Autor: cast0rtech | Versión: 1.0.0
 ==============================================================
`
	fmt.Print(banner)

	isSilent := hasFlag("/S", "-s", "--silent")
	installDir := getInstallDir()

	fmt.Printf("\n[1/5] Directorio de instalación: %s\n", installDir)
	if err := os.MkdirAll(installDir, 0755); err != nil {
		fmt.Printf("[X] Error creando carpeta de destino: %v\n", err)
		pauseExit(1, isSilent)
	}

	targetExe := filepath.Join(installDir, "Cyberguru.exe")
	fmt.Printf("[2/5] Extrayendo binario principal (%d MB)...\n", len(binaryData)/(1024*1024))
	if err := os.WriteFile(targetExe, binaryData, 0755); err != nil {
		fmt.Printf("[X] Error escribiendo Cyberguru.exe: %v\n", err)
		pauseExit(1, isSilent)
	}

	targetIcon := filepath.Join(installDir, "app_icon.ico")
	if len(iconData) > 0 {
		_ = os.WriteFile(targetIcon, iconData, 0644)
	}

	// Crear desinstalador script
	uninstallerBat := filepath.Join(installDir, "uninstall.bat")
	uninstallContent := fmt.Sprintf(`@echo off
title Desinstalador Cyberguru
echo Desinstalando Cyberguru...
taskkill /f /im Cyberguru.exe >nul 2>&1
timeout /t 1 >nul
del /q "%s\Cyberguru.exe" >nul 2>&1
del /q "%s\app_icon.ico" >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Cyberguru" /f >nul 2>&1
powershell -NoProfile -Command "Remove-Item -Path '$([Environment]::GetFolderPath('Desktop'))\Cyberguru.lnk' -Force -ErrorAction SilentlyContinue; Remove-Item -Path '$([Environment]::GetFolderPath('StartMenu'))\Programs\Cyberguru' -Recurse -Force -ErrorAction SilentlyContinue"
echo Cyberguru ha sido desinstalado correctamente.
pause
`, installDir, installDir)
	_ = os.WriteFile(uninstallerBat, []byte(uninstallContent), 0755)

	fmt.Println("[3/5] Creando accesos directos en el Escritorio y Menú Inicio...")
	createShortcuts(targetExe, installDir, targetIcon)

	fmt.Println("[4/5] Registrando en Programas y Características de Windows...")
	registerInWindows(installDir, uninstallerBat, targetIcon)

	fmt.Println("[5/5] ¡Instalación completada exitosamente!")
	fmt.Println("\n==============================================================")
	fmt.Println("   Cyberguru está listo para usarse.")
	fmt.Println("   Acceso directo creado en tu Escritorio.")
	fmt.Println("   Dashboard Web: http://localhost:8080")
	fmt.Println("==============================================================\n")

	if !hasFlag("--no-launch") {
		fmt.Println("[*] Iniciando Cyberguru...")
		cmd := exec.Command(targetExe)
		_ = cmd.Start()
		time.Sleep(1 * time.Second)
	}

	if !isSilent {
		fmt.Println("Pulsa INTRO para cerrar esta ventana...")
		var dummy string
		_, _ = fmt.Scanln(&dummy)
	}
}

func getInstallDir() string {
	if hasFlag("--all-users") {
		progFiles := os.Getenv("ProgramFiles")
		if progFiles == "" {
			progFiles = "C:\\Program Files"
		}
		return filepath.Join(progFiles, "Cyberguru")
	}

	localApp := os.Getenv("LOCALAPPDATA")
	if localApp == "" {
		home, _ := os.UserHomeDir()
		localApp = filepath.Join(home, "AppData", "Local")
	}
	return filepath.Join(localApp, "Programs", "Cyberguru")
}

func createShortcuts(targetExe, workingDir, iconPath string) {
	psScript := fmt.Sprintf(`
$ws = New-Object -ComObject WScript.Shell

# Acceso directo en Escritorio
$desktopPath = [Environment]::GetFolderPath('Desktop')
$deskLink = $ws.CreateShortcut((Join-Path $desktopPath 'Cyberguru.lnk'))
$deskLink.TargetPath = '%s'
$deskLink.WorkingDirectory = '%s'
if (Test-Path '%s') { $deskLink.IconLocation = '%s' }
$deskLink.Description = 'Cyberguru - Cybersecurity & Sensor Suite'
$deskLink.Save()

# Acceso directo en Menu Inicio
$startPath = [Environment]::GetFolderPath('StartMenu')
$programsPath = Join-Path $startPath 'Programs\Cyberguru'
if (!(Test-Path $programsPath)) { New-Item -ItemType Directory -Path $programsPath -Force | Out-Null }
$startLink = $ws.CreateShortcut((Join-Path $programsPath 'Cyberguru.lnk'))
$startLink.TargetPath = '%s'
$startLink.WorkingDirectory = '%s'
if (Test-Path '%s') { $startLink.IconLocation = '%s' }
$startLink.Description = 'Cyberguru - Cybersecurity & Sensor Suite'
$startLink.Save()
`, targetExe, workingDir, iconPath, iconPath, targetExe, workingDir, iconPath, iconPath)

	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", psScript)
	_ = cmd.Run()
}

func registerInWindows(installDir, uninstallerBat, iconPath string) {
	regScript := fmt.Sprintf(`
$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Cyberguru'
New-Item -Path $key -Force | Out-Null
Set-ItemProperty -Path $key -Name 'DisplayName' -Value 'Cyberguru Cybersecurity Suite'
Set-ItemProperty -Path $key -Name 'DisplayVersion' -Value '1.0.0'
Set-ItemProperty -Path $key -Name 'Publisher' -Value 'cast0rtech'
Set-ItemProperty -Path $key -Name 'InstallLocation' -Value '%s'
Set-ItemProperty -Path $key -Name 'UninstallString' -Value '%s'
Set-ItemProperty -Path $key -Name 'DisplayIcon' -Value '%s'
`, installDir, uninstallerBat, iconPath)

	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", regScript)
	_ = cmd.Run()
}

func hasFlag(flags ...string) bool {
	for _, arg := range os.Args[1:] {
		for _, f := range flags {
			if strings.EqualFold(arg, f) {
				return true
			}
		}
	}
	return false
}

func pauseExit(code int, silent bool) {
	if !silent {
		fmt.Println("\nPresiona INTRO para salir...")
		var dummy string
		_, _ = fmt.Scanln(&dummy)
	}
	os.Exit(code)
}
