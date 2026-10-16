package scanner

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"cyberguru/config"
	"cyberguru/db"
	"cyberguru/models"
)

type Engine struct {
	database *db.Database
	cfg      *config.Config
	mu       sync.Mutex
	scanning bool
}

func NewEngine(database *db.Database, cfg *config.Config) *Engine {
	return &Engine{
		database: database,
		cfg:      cfg,
	}
}

func (e *Engine) IsScanning() bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.scanning
}

func (e *Engine) RunScan(scanType string) (*models.ScanHistory, error) {
	e.mu.Lock()
	if e.scanning {
		e.mu.Unlock()
		return nil, fmt.Errorf("ya existe un escaneo en curso")
	}
	e.scanning = true
	e.mu.Unlock()

	defer func() {
		e.mu.Lock()
		e.scanning = false
		e.mu.Unlock()
	}()

	history := &models.ScanHistory{
		ScanType:  scanType,
		StartedAt: time.Now(),
		Status:    "running",
	}

	log.Printf("[Scanner] Iniciando ciclo de escaneo de tipo: %s", scanType)
	var totalFound int
	var detailsLog []string

	// 1. Escaneo ARP (Descubrimiento en capa 2/3)
	if scanType == "arp" || scanType == "all" {
		arpDevices, err := ExecuteARPScan(e.cfg.ScanInterface)
		if err != nil {
			detailsLog = append(detailsLog, fmt.Sprintf("Error ARP: %v", err))
		} else {
			for _, dev := range arpDevices {
				isNew, err := e.database.UpsertDevice(&dev)
				if err != nil {
					log.Printf("[Scanner] Error guardando dispositivo %s: %v", dev.MAC, err)
					continue
				}
				totalFound++

				// Si el dispositivo no existía previamente, levantar alerta de ciberseguridad
				if isNew {
					alert := models.Alert{
						DeviceID:     &dev.ID,
						Severity:     "info",
						Title:        "Nuevo dispositivo en la red",
						Description:  fmt.Sprintf("Se detectó una nueva dirección MAC %s con IP %s (%s). Fabricante estimado: %s.", dev.MAC, dev.IP, dev.Hostname, dev.Vendor),
						Timestamp:    time.Now(),
						Acknowledged: false,
					}
					_ = e.database.CreateAlert(&alert)
				}
			}
			detailsLog = append(detailsLog, fmt.Sprintf("ARP: %d dispositivos descubiertos", len(arpDevices)))
		}
	}

	// 2. Escaneo SNMP (Sondeo UDP 161 en equipos descubiertos)
	if scanType == "snmp" || scanType == "all" {
		currentDevices, err := e.database.GetDevices("", "online")
		if err == nil && len(currentDevices) > 0 {
			var ips []string
			for _, d := range currentDevices {
				if d.IP != "" && d.IP != "0.0.0.0" {
					ips = append(ips, d.IP)
				}
			}

			snmpResults := ExecuteSNMPScan(ips)
			var snmpCount int
			for _, d := range currentDevices {
				if res, ok := snmpResults[d.IP]; ok && res.Responsive {
					snmpCount++
					d.SNMPEnabled = true
					d.DeviceType = "SNMP"
					if res.SysDescr != "" {
						d.OSInfo = res.SysDescr
					}

					_, _ = e.database.UpsertDevice(&d)

					// Generar alerta de seguridad por SNMP v2c expuesto
					alert := CheckSNMPAlerts(res, &d)
					if alert != nil {
						_ = e.database.CreateAlert(alert)
					}
				}
			}
			detailsLog = append(detailsLog, fmt.Sprintf("SNMP: %d equipos respondieron en puerto 161", snmpCount))
		}
	}

	// 3. Escaneo BLE (Bluetooth Low Energy)
	if scanType == "ble" || scanType == "all" {
		bleDevices, bleAlerts := ExecuteBLEScan(e.cfg.EnableSimulatedBLE)
		for _, dev := range bleDevices {
			_, _ = e.database.UpsertDevice(&dev)
			totalFound++
		}
		for _, a := range bleAlerts {
			_ = e.database.CreateAlert(&a)
		}
		detailsLog = append(detailsLog, fmt.Sprintf("BLE: %d balizas detectadas", len(bleDevices)))
	}

	// 4. Escaneo y Clasificación de Cámaras IP y Almacenamiento NAS (RTSP, ONVIF, SMB, DSM)
	if scanType == "iot" || scanType == "all" || scanType == "cams_nas" {
		allOnline, err := e.database.GetDevices("", "online")
		if err == nil && len(allOnline) > 0 {
			iotResults := ExecuteIoTScan(allOnline)
			var camCount, nasCount int
			for _, d := range allOnline {
				if res, ok := iotResults[d.ID]; ok {
					if res.IsCamera {
						d.DeviceType = "Camera"
						camCount++
					} else if res.IsNAS {
						d.DeviceType = "NAS"
						nasCount++
					}
					if res.Details != "" {
						d.Services = res.Details
					}
					_, _ = e.database.UpsertDevice(&d)

					for _, riskAlert := range res.RiskAlerts {
						_ = e.database.CreateAlert(&riskAlert)
					}
				}
			}
			detailsLog = append(detailsLog, fmt.Sprintf("IoT: %d cámaras y %d servidores NAS clasificados", camCount, nasCount))
		}
	}

	// 5. Escaneo de Sensores & Protocolos Inalámbricos Especializados (Zigbee, Z-Wave, Thread, UWB, NFC, GPS, LPWAN)
	if scanType == "wireless" || scanType == "all" || scanType == "zigbee" || scanType == "zwave" || scanType == "thread" || scanType == "uwb" || scanType == "nfc" || scanType == "gps" || scanType == "lpwan" {
		allOnline, _ := e.database.GetDevices("", "online")
		wirelessDevices, wirelessAlerts := ExecuteWirelessScan(allOnline, scanType)
		for _, dev := range wirelessDevices {
			_, _ = e.database.UpsertDevice(&dev)
			totalFound++
		}
		for _, a := range wirelessAlerts {
			_ = e.database.CreateAlert(&a)
		}
		detailsLog = append(detailsLog, fmt.Sprintf("Sensores & Wireless: %d nodos especializados descubiertos", len(wirelessDevices)))
	}

	history.FinishedAt = time.Now()
	history.DevicesFound = totalFound
	history.VerifiedFound = totalFound
	history.Status = "completed"
	history.Details = fmt.Sprintf("Resumen: %v", detailsLog)

	if scanType == "arp" || scanType == "all" {
		_ = e.database.MarkUnresponsiveOffline(history.StartedAt)
	}

	_ = e.database.RecordScan(history)
	_ = e.database.RecordStatsSnapshot()
	log.Printf("[Scanner] Escaneo finalizado con éxito. Total reales comprobados: %d", totalFound)

	return history, nil
}

// StartPeriodicScanning inicia un bucle en segundo plano que ejecuta escaneos periódicos.
func (e *Engine) StartPeriodicScanning(ctx context.Context) {
	interval := time.Duration(e.cfg.ScanIntervalMinutes) * time.Minute
	if interval < 1*time.Minute {
		interval = 5 * time.Minute
	}

	ticker := time.NewTicker(interval)
	go func() {
		log.Printf("[Scanner] Programador automático iniciado cada %v", interval)
		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				return
			case <-ticker.C:
				log.Println("[Scanner] Ejecutando escaneo periódico programado...")
				_, _ = e.RunScan("all")
			}
		}
	}()
}
