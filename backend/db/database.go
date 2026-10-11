package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"cyberguru/models"

	_ "modernc.org/sqlite"
)

type Database struct {
	db *sql.DB
	mu sync.RWMutex
}

func InitDB(dbPath string) (*Database, error) {
	// Asegurar existencia del directorio
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("error al crear directorio para la base de datos: %w", err)
	}

	conn, err := sql.Open("sqlite", dbPath+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
	if err != nil {
		return nil, fmt.Errorf("error al conectar con SQLite: %w", err)
	}

	d := &Database{db: conn}
	if err := d.migrate(); err != nil {
		return nil, fmt.Errorf("error en la migración de tablas: %w", err)
	}

	// Cargar datos demostrativos iniciales si la base de datos está vacía
	_ = d.seedInitialData()

	return d, nil
}

func (d *Database) Close() error {
	return d.db.Close()
}

func (d *Database) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS devices (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		mac TEXT UNIQUE,
		ip TEXT,
		hostname TEXT,
		vendor TEXT,
		device_type TEXT,
		os_info TEXT,
		first_seen DATETIME,
		last_seen DATETIME,
		status TEXT,
		rssi INTEGER DEFAULT 0,
		snmp_enabled BOOLEAN DEFAULT 0
	);

	CREATE INDEX IF NOT EXISTS idx_devices_ip ON devices(ip);
	CREATE INDEX IF NOT EXISTS idx_devices_mac ON devices(mac);

	CREATE TABLE IF NOT EXISTS alerts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		device_id INTEGER,
		severity TEXT,
		title TEXT,
		description TEXT,
		timestamp DATETIME,
		acknowledged BOOLEAN DEFAULT 0,
		FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);

	CREATE TABLE IF NOT EXISTS scan_history (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		scan_type TEXT,
		started_at DATETIME,
		finished_at DATETIME,
		devices_found INTEGER,
		status TEXT,
		details TEXT
	);
	`

	_, err := d.db.Exec(schema)
	return err
}

func (d *Database) seedInitialData() error {
	var count int
	if err := d.db.QueryRow("SELECT COUNT(*) FROM devices").Scan(&count); err != nil || count > 0 {
		return nil
	}

	now := time.Now()
	initialDevices := []models.Device{
		{
			MAC:         "00:1A:2B:3C:4D:5E",
			IP:          "192.168.1.1",
			Hostname:    "gateway-router.local",
			Vendor:      "Cisco Systems",
			DeviceType:  "SNMP",
			OSInfo:      "Cisco IOS 15.2(4)M",
			FirstSeen:   now.Add(-24 * time.Hour),
			LastSeen:    now,
			Status:      "online",
			SNMPEnabled: true,
		},
		{
			MAC:         "DC:A6:32:11:88:99",
			IP:          "192.168.1.105",
			Hostname:    "security-cam-front",
			Vendor:      "Raspberry Pi Foundation",
			DeviceType:  "Ethernet",
			OSInfo:      "Linux 6.1.0-rpi",
			FirstSeen:   now.Add(-12 * time.Hour),
			LastSeen:    now,
			Status:      "online",
			SNMPEnabled: false,
		},
		{
			MAC:         "F4:34:F0:77:A1:B2",
			IP:          "192.168.1.189",
			Hostname:    "iot-air-sensor",
			Vendor:      "Espressif Systems",
			DeviceType:  "WiFi",
			OSInfo:      "ESP32 FreeRTOS",
			FirstSeen:   now.Add(-6 * time.Hour),
			LastSeen:    now,
			Status:      "online",
			SNMPEnabled: false,
		},
		{
			MAC:         "AC:DE:48:FF:99:00",
			IP:          "0.0.0.0",
			Hostname:    "Unknown-BLE-Beacon",
			Vendor:      "Apple Inc. (iBeacon)",
			DeviceType:  "BLE",
			OSInfo:      "BLE v5.0 Proximity",
			FirstSeen:   now.Add(-30 * time.Minute),
			LastSeen:    now,
			Status:      "online",
			RSSI:        -62,
			SNMPEnabled: false,
		},
	}

	for _, dev := range initialDevices {
		_, _ = d.UpsertDevice(&dev)
	}

	initialAlerts := []models.Alert{
		{
			Severity:     "warning",
			Title:        "Puerto SNMP público detectado",
			Description:  "El dispositivo gateway-router.local (192.168.1.1) responde a consultas SNMP con la comunidad 'public'. Se recomienda cambiar o deshabilitar v1/v2c.",
			Timestamp:    now.Add(-2 * time.Hour),
			Acknowledged: false,
		},
		{
			Severity:     "info",
			Title:        "Nuevo dispositivo detectado en LAN",
			Description:  "Se detectó un dispositivo Espressif (MAC F4:34:F0:77:A1:B2) con IP 192.168.1.189 mediante barrido ARP.",
			Timestamp:    now.Add(-4 * time.Hour),
			Acknowledged: true,
		},
	}

	for _, alert := range initialAlerts {
		_ = d.CreateAlert(&alert)
	}

	return nil
}

// UpsertDevice actualiza o inserta un dispositivo. Retorna isNew = true si no existía previamente.
func (d *Database) UpsertDevice(dev *models.Device) (bool, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	var existingID int64
	var firstSeen time.Time
	err := d.db.QueryRow("SELECT id, first_seen FROM devices WHERE mac = ?", dev.MAC).Scan(&existingID, &firstSeen)

	now := time.Now()
	if err == sql.ErrNoRows {
		// Nuevo dispositivo
		dev.FirstSeen = now
		dev.LastSeen = now
		if dev.Status == "" {
			dev.Status = "online"
		}

		res, err := d.db.Exec(`
			INSERT INTO devices (mac, ip, hostname, vendor, device_type, os_info, first_seen, last_seen, status, rssi, snmp_enabled)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, dev.MAC, dev.IP, dev.Hostname, dev.Vendor, dev.DeviceType, dev.OSInfo, dev.FirstSeen, dev.LastSeen, dev.Status, dev.RSSI, dev.SNMPEnabled)
		if err != nil {
			return false, err
		}

		id, _ := res.LastInsertId()
		dev.ID = id
		return true, nil
	} else if err != nil {
		return false, err
	}

	// Dispositivo existente: actualizar últimos datos conocidos
	dev.ID = existingID
	dev.LastSeen = now

	// Preservar datos si no vienen informados en la actualización
	_, err = d.db.Exec(`
		UPDATE devices SET
			ip = CASE WHEN ? != '' THEN ? ELSE ip END,
			hostname = CASE WHEN ? != '' THEN ? ELSE hostname END,
			vendor = CASE WHEN ? != '' THEN ? ELSE vendor END,
			device_type = CASE WHEN ? != '' THEN ? ELSE device_type END,
			os_info = CASE WHEN ? != '' THEN ? ELSE os_info END,
			last_seen = ?,
			status = 'online',
			rssi = CASE WHEN ? != 0 THEN ? ELSE rssi END,
			snmp_enabled = CASE WHEN ? THEN 1 ELSE snmp_enabled END
		WHERE id = ?
	`, dev.IP, dev.IP, dev.Hostname, dev.Hostname, dev.Vendor, dev.Vendor, dev.DeviceType, dev.DeviceType, dev.OSInfo, dev.OSInfo, now, dev.RSSI, dev.RSSI, dev.SNMPEnabled, existingID)

	return false, err
}

func (d *Database) GetDevices(deviceType, status string) ([]models.Device, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	query := "SELECT id, mac, ip, hostname, vendor, device_type, os_info, first_seen, last_seen, status, rssi, snmp_enabled FROM devices WHERE 1=1"
	var args []interface{}

	if deviceType != "" {
		query += " AND device_type = ?"
		args = append(args, deviceType)
	}
	if status != "" {
		query += " AND status = ?"
		args = append(args, status)
	}

	query += " ORDER BY last_seen DESC"

	rows, err := d.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var devices []models.Device
	for rows.Next() {
		var dev models.Device
		var fs, ls string
		if err := rows.Scan(
			&dev.ID, &dev.MAC, &dev.IP, &dev.Hostname, &dev.Vendor,
			&dev.DeviceType, &dev.OSInfo, &fs, &ls, &dev.Status,
			&dev.RSSI, &dev.SNMPEnabled,
		); err != nil {
			return nil, err
		}
		dev.FirstSeen, _ = time.Parse(time.RFC3339, fs)
		dev.LastSeen, _ = time.Parse(time.RFC3339, ls)
		devices = append(devices, dev)
	}

	return devices, nil
}

func (d *Database) CreateAlert(alert *models.Alert) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	if alert.Timestamp.IsZero() {
		alert.Timestamp = time.Now()
	}

	res, err := d.db.Exec(`
		INSERT INTO alerts (device_id, severity, title, description, timestamp, acknowledged)
		VALUES (?, ?, ?, ?, ?, ?)
	`, alert.DeviceID, alert.Severity, alert.Title, alert.Description, alert.Timestamp, alert.Acknowledged)
	if err != nil {
		return err
	}

	id, _ := res.LastInsertId()
	alert.ID = id
	return nil
}

func (d *Database) GetAlerts(onlyPending bool) ([]models.Alert, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	query := "SELECT id, device_id, severity, title, description, timestamp, acknowledged FROM alerts"
	if onlyPending {
		query += " WHERE acknowledged = 0"
	}
	query += " ORDER BY timestamp DESC LIMIT 50"

	rows, err := d.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var alerts []models.Alert
	for rows.Next() {
		var a models.Alert
		var ts string
		if err := rows.Scan(&a.ID, &a.DeviceID, &a.Severity, &a.Title, &a.Description, &ts, &a.Acknowledged); err != nil {
			return nil, err
		}
		a.Timestamp, _ = time.Parse(time.RFC3339, ts)
		alerts = append(alerts, a)
	}

	return alerts, nil
}

func (d *Database) AcknowledgeAlert(id int64) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	_, err := d.db.Exec("UPDATE alerts SET acknowledged = 1 WHERE id = ?", id)
	return err
}

func (d *Database) RecordScan(s *models.ScanHistory) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	res, err := d.db.Exec(`
		INSERT INTO scan_history (scan_type, started_at, finished_at, devices_found, status, details)
		VALUES (?, ?, ?, ?, ?, ?)
	`, s.ScanType, s.StartedAt, s.FinishedAt, s.DevicesFound, s.Status, s.Details)
	if err != nil {
		return err
	}
	id, _ := res.LastInsertId()
	s.ID = id
	return nil
}

func (d *Database) GetStats() (*models.Stats, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	stats := &models.Stats{}

	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices").Scan(&stats.TotalDevices)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices WHERE status = 'online'").Scan(&stats.OnlineDevices)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices WHERE snmp_enabled = 1").Scan(&stats.SNMPDevices)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices WHERE device_type = 'BLE'").Scan(&stats.BLEDevices)

	_ = d.db.QueryRow("SELECT COUNT(*) FROM alerts").Scan(&stats.TotalAlerts)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM alerts WHERE acknowledged = 0").Scan(&stats.PendingAlerts)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM alerts WHERE severity = 'danger' AND acknowledged = 0").Scan(&stats.CriticalAlerts)

	var lastFinished string
	_ = d.db.QueryRow("SELECT finished_at FROM scan_history ORDER BY finished_at DESC LIMIT 1").Scan(&lastFinished)
	stats.LastScanTime = lastFinished

	return stats, nil
}
