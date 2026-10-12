package config

import (
	"os"
	"path/filepath"
	"strconv"
)

type Config struct {
	Port                string
	DBPath              string
	FrontendDir         string
	ScanInterface       string
	ScanIntervalMinutes int
	EnableSimulatedBLE  bool
}

func Load() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		// En modo portable, intentar guardar la base de datos junto al ejecutable
		exePath, err := os.Executable()
		var baseDir string
		if err == nil {
			baseDir = filepath.Dir(exePath)
		} else {
			baseDir = "."
		}

		portableDataDir := filepath.Join(baseDir, "data")
		testFile := filepath.Join(portableDataDir, ".perm_test")
		writable := false

		if err := os.MkdirAll(portableDataDir, 0755); err == nil {
			if f, err := os.Create(testFile); err == nil {
				_ = f.Close()
				_ = os.Remove(testFile)
				writable = true
				dbPath = filepath.Join(portableDataDir, "cyberguru.db")
			}
		}

		// Si no tiene permisos de escritura en la carpeta del ejecutable (ej. instalado en Program Files),
		// guardar en %APPDATA%\Cyberguru\data\
		if !writable {
			if appData := os.Getenv("APPDATA"); appData != "" {
				userDir := filepath.Join(appData, "Cyberguru", "data")
				_ = os.MkdirAll(userDir, 0755)
				dbPath = filepath.Join(userDir, "cyberguru.db")
			} else {
				dbPath = "./data/cyberguru.db"
			}
		}
	}

	frontendDir := os.Getenv("FRONTEND_DIR")
	if frontendDir == "" {
		// Busca en las ubicaciones típicas
		if _, err := os.Stat("/app/frontend/dist"); err == nil {
			frontendDir = "/app/frontend/dist"
		} else if _, err := os.Stat("./frontend/dist"); err == nil {
			frontendDir = "./frontend/dist"
		} else {
			frontendDir = "../frontend/dist"
		}
	}

	scanInterface := os.Getenv("SCAN_INTERFACE")

	scanInterval := 5
	if val := os.Getenv("SCAN_INTERVAL_MIN"); val != "" {
		if parsed, err := strconv.Atoi(val); err == nil && parsed > 0 {
			scanInterval = parsed
		}
	}

	enableSimulatedBLE := false
	if val := os.Getenv("SIMULATE_BLE_IF_ABSENT"); val == "true" || val == "1" {
		enableSimulatedBLE = true
	}

	return &Config{
		Port:                port,
		DBPath:              dbPath,
		FrontendDir:         frontendDir,
		ScanInterface:       scanInterface,
		ScanIntervalMinutes: scanInterval,
		EnableSimulatedBLE:  enableSimulatedBLE,
	}
}
