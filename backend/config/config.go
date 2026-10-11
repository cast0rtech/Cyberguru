package config

import (
	"os"
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
		dbPath = "./data/cyberguru.db"
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

	enableSimulatedBLE := true
	if val := os.Getenv("SIMULATE_BLE_IF_ABSENT"); val == "false" || val == "0" {
		enableSimulatedBLE = false
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
