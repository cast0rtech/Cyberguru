package db

import (
	"database/sql"
	"fmt"
	"log"
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

	// Limpiar datos simulados/falsos de versiones previas para garantizar inventario 100% real
	_ = d.PurgeMockDevices()

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
		services TEXT DEFAULT '',
		first_seen DATETIME,
		last_seen DATETIME,
		status TEXT,
		rssi INTEGER DEFAULT 0,
		snmp_enabled BOOLEAN DEFAULT 0,
		verified BOOLEAN DEFAULT 1,
		verification_method TEXT DEFAULT '',
		response_time_ms INTEGER DEFAULT 0,
		is_gateway BOOLEAN DEFAULT 0,
		last_verified_at DATETIME,
		checks_passed INTEGER DEFAULT 1,
		checks_failed INTEGER DEFAULT 0,
		coordinates TEXT DEFAULT ''
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
		verified_found INTEGER DEFAULT 0,
		status TEXT,
		details TEXT
	);

	CREATE TABLE IF NOT EXISTS device_events (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		device_id INTEGER,
		mac TEXT,
		ip TEXT,
		event_type TEXT,
		latency_ms INTEGER DEFAULT 0,
		details TEXT,
		timestamp DATETIME,
		FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_device_events_timestamp ON device_events(timestamp);

	CREATE TABLE IF NOT EXISTS network_stats_history (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		timestamp DATETIME,
		total_devices INTEGER DEFAULT 0,
		online_devices INTEGER DEFAULT 0,
		verified_devices INTEGER DEFAULT 0,
		avg_latency_ms REAL DEFAULT 0,
		gateways_count INTEGER DEFAULT 0,
		snmp_count INTEGER DEFAULT 0,
		iot_count INTEGER DEFAULT 0
	);

	CREATE INDEX IF NOT EXISTS idx_stats_history_time ON network_stats_history(timestamp);
	`

	if _, err := d.db.Exec(schema); err != nil {
		return err
	}

	// Migraciones retrocompatibles de columnas adicionales
	columnsToAdd := []string{
		"ALTER TABLE devices ADD COLUMN services TEXT DEFAULT ''",
		"ALTER TABLE devices ADD COLUMN verified BOOLEAN DEFAULT 1",
		"ALTER TABLE devices ADD COLUMN verification_method TEXT DEFAULT ''",
		"ALTER TABLE devices ADD COLUMN response_time_ms INTEGER DEFAULT 0",
		"ALTER TABLE devices ADD COLUMN is_gateway BOOLEAN DEFAULT 0",
		"ALTER TABLE devices ADD COLUMN last_verified_at DATETIME",
		"ALTER TABLE devices ADD COLUMN checks_passed INTEGER DEFAULT 1",
		"ALTER TABLE devices ADD COLUMN checks_failed INTEGER DEFAULT 0",
		"ALTER TABLE devices ADD COLUMN coordinates TEXT DEFAULT ''",
		"ALTER TABLE scan_history ADD COLUMN verified_found INTEGER DEFAULT 0",
	}

	for _, stmt := range columnsToAdd {
		_, _ = d.db.Exec(stmt)
	}

	return nil
}

// PurgeMockDevices purga dispositivos de prueba o ficticios para garantizar que solo existan equipos reales comprobados.
func (d *Database) PurgeMockDevices() error {
	d.mu.Lock()
	defer d.mu.Unlock()

	mockMACs := []string{
		"00:1A:2B:3C:4D:5E", // Gateway Cisco simulado
		"44:19:B6:88:77:66", // Cámara Hikvision simulada
		"00:11:32:88:99:AA", // Synology simulado
		"DC:A6:32:11:88:99", // RPi simulado
		"F4:34:F0:77:A1:B2", // ESP32 simulado
		"AC:DE:48:FF:99:00", // AirTag simulado
		"E0:D5:5E:22:33:44", // Fallback nulo
		"FC:58:FA:A1:B2:C3", // AirTag beacon
		"D4:F5:47:88:99:AA", // Tile Tracker
		"88:C9:E8:44:55:66", // SmartTag
		"60:A4:23:77:88:99", // Flipper Zero
	}

	for _, mac := range mockMACs {
		var devID int64
		err := d.db.QueryRow("SELECT id FROM devices WHERE mac = ?", mac).Scan(&devID)
		if err == nil && devID > 0 {
			_, _ = d.db.Exec("DELETE FROM alerts WHERE device_id = ?", devID)
			_, _ = d.db.Exec("DELETE FROM device_events WHERE device_id = ?", devID)
			_, _ = d.db.Exec("DELETE FROM devices WHERE id = ?", devID)
			log.Printf("[DB] Purga de dispositivo simulado histórico: %s (ID %d)", mac, devID)
		}
	}

	// Purgar también cualquier alerta huérfana de prueba
	_, _ = d.db.Exec("DELETE FROM alerts WHERE title LIKE '%RTSP Abierto en 192.168.1.120%' OR title LIKE '%Panel NAS en HTTP%' OR title LIKE '%SNMP público detectado%'")

	// Purgar registros huérfanos o no verificados antiguos que quedaron offline
	_, _ = d.db.Exec("DELETE FROM devices WHERE (verification_method = '' OR verification_method IS NULL) AND status = 'offline'")

	return nil
}

// MarkUnresponsiveOffline marca como offline los dispositivos que no respondieron en el último escaneo
func (d *Database) MarkUnresponsiveOffline(cutoff time.Time) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	_, err := d.db.Exec("UPDATE devices SET status = 'offline', response_time_ms = 0 WHERE last_seen < ? AND status = 'online'", cutoff)
	return err
}

// UpsertDevice actualiza o inserta un dispositivo real comprobado.
func (d *Database) UpsertDevice(dev *models.Device) (bool, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	var existingID int64
	var firstSeen time.Time
	var prevLatency int
	var prevStatus string

	err := d.db.QueryRow("SELECT id, first_seen, response_time_ms, status FROM devices WHERE mac = ?", dev.MAC).
		Scan(&existingID, &firstSeen, &prevLatency, &prevStatus)

	now := time.Now()
	if dev.LastVerifiedAt.IsZero() {
		dev.LastVerifiedAt = now
	}

	if err == sql.ErrNoRows {
		dev.FirstSeen = now
		dev.LastSeen = now
		if dev.Status == "" {
			dev.Status = "online"
		}
		if dev.ChecksPassed <= 0 {
			dev.ChecksPassed = 1
		}

		res, err := d.db.Exec(`
			INSERT INTO devices (
				mac, ip, hostname, vendor, device_type, os_info, services,
				first_seen, last_seen, status, rssi, snmp_enabled,
				verified, verification_method, response_time_ms, is_gateway,
				last_verified_at, checks_passed, checks_failed, coordinates
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, dev.MAC, dev.IP, dev.Hostname, dev.Vendor, dev.DeviceType, dev.OSInfo, dev.Services,
			dev.FirstSeen, dev.LastSeen, dev.Status, dev.RSSI, dev.SNMPEnabled,
			dev.Verified, dev.VerificationMethod, dev.ResponseTimeMs, dev.IsGateway,
			dev.LastVerifiedAt, dev.ChecksPassed, dev.ChecksFailed, dev.Coordinates)
		if err != nil {
			return false, err
		}

		id, _ := res.LastInsertId()
		dev.ID = id

		// Registrar evento inicial de descubrimiento y comprobación
		_, _ = d.db.Exec(`
			INSERT INTO device_events (device_id, mac, ip, event_type, latency_ms, details, timestamp)
			VALUES (?, ?, ?, 'VERIFIED_ONLINE', ?, ?, ?)
		`, id, dev.MAC, dev.IP, dev.ResponseTimeMs, fmt.Sprintf("Equipo comprobado via %s", dev.VerificationMethod), now)

		return true, nil
	} else if err != nil {
		return false, err
	}

	dev.ID = existingID
	dev.LastSeen = now

	_, err = d.db.Exec(`
		UPDATE devices SET
			ip = CASE WHEN ? != '' THEN ? ELSE ip END,
			hostname = CASE WHEN ? != '' THEN ? ELSE hostname END,
			vendor = CASE WHEN ? != '' THEN ? ELSE vendor END,
			device_type = CASE WHEN ? != '' THEN ? ELSE device_type END,
			os_info = CASE WHEN ? != '' THEN ? ELSE os_info END,
			services = CASE WHEN ? != '' THEN ? ELSE services END,
			last_seen = ?,
			status = 'online',
			rssi = CASE WHEN ? != 0 THEN ? ELSE rssi END,
			snmp_enabled = CASE WHEN ? THEN 1 ELSE snmp_enabled END,
			verified = CASE WHEN ? THEN 1 ELSE verified END,
			verification_method = CASE WHEN ? != '' THEN ? ELSE verification_method END,
			response_time_ms = CASE WHEN ? > 0 THEN ? ELSE response_time_ms END,
			is_gateway = CASE WHEN ? THEN 1 ELSE is_gateway END,
			last_verified_at = ?,
			checks_passed = checks_passed + 1,
			coordinates = CASE WHEN ? != '' THEN ? ELSE coordinates END
		WHERE id = ?
	`, dev.IP, dev.IP, dev.Hostname, dev.Hostname, dev.Vendor, dev.Vendor,
		dev.DeviceType, dev.DeviceType, dev.OSInfo, dev.OSInfo, dev.Services, dev.Services,
		now, dev.RSSI, dev.RSSI, dev.SNMPEnabled,
		dev.Verified, dev.VerificationMethod, dev.VerificationMethod,
		dev.ResponseTimeMs, dev.ResponseTimeMs, dev.IsGateway,
		now, dev.Coordinates, existingID)

	// Registrar evento si hubo cambio significativo o actualización de comprobación
	if dev.ResponseTimeMs > 0 && dev.ResponseTimeMs != prevLatency {
		_, _ = d.db.Exec(`
			INSERT INTO device_events (device_id, mac, ip, event_type, latency_ms, details, timestamp)
			VALUES (?, ?, ?, 'LATENCY_UPDATE', ?, ?, ?)
		`, existingID, dev.MAC, dev.IP, dev.ResponseTimeMs, fmt.Sprintf("Latencia comprobada: %dms", dev.ResponseTimeMs), now)
	}

	return false, err
}

func (d *Database) GetDevices(deviceType, status string) ([]models.Device, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	query := `
		SELECT id, mac, ip, hostname, vendor, device_type, os_info, services,
		       first_seen, last_seen, status, rssi, snmp_enabled,
		       verified, verification_method, response_time_ms, is_gateway,
		       last_verified_at, checks_passed, checks_failed, COALESCE(coordinates, '')
		FROM devices WHERE 1=1
	`
	var args []interface{}

	if deviceType != "" {
		query += " AND device_type = ?"
		args = append(args, deviceType)
	}
	if status != "" {
		query += " AND status = ?"
		args = append(args, status)
	}

	query += " ORDER BY (status = 'online') DESC, is_gateway DESC, last_seen DESC"

	rows, err := d.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var devices []models.Device
	for rows.Next() {
		var dev models.Device
		var fs, ls, lva sql.NullString
		if err := rows.Scan(
			&dev.ID, &dev.MAC, &dev.IP, &dev.Hostname, &dev.Vendor,
			&dev.DeviceType, &dev.OSInfo, &dev.Services, &fs, &ls, &dev.Status,
			&dev.RSSI, &dev.SNMPEnabled,
			&dev.Verified, &dev.VerificationMethod, &dev.ResponseTimeMs, &dev.IsGateway,
			&lva, &dev.ChecksPassed, &dev.ChecksFailed, &dev.Coordinates,
		); err != nil {
			return nil, err
		}

		if fs.Valid {
			dev.FirstSeen, _ = time.Parse(time.RFC3339, fs.String)
		}
		if ls.Valid {
			dev.LastSeen, _ = time.Parse(time.RFC3339, ls.String)
		}
		if lva.Valid {
			dev.LastVerifiedAt, _ = time.Parse(time.RFC3339, lva.String)
		}

		devices = append(devices, dev)
	}

	return devices, nil
}

func (d *Database) GetDeviceByID(id int64) (*models.Device, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	var dev models.Device
	var fs, ls, lva sql.NullString
	err := d.db.QueryRow(`
		SELECT id, mac, ip, hostname, vendor, device_type, os_info, services,
		       first_seen, last_seen, status, rssi, snmp_enabled,
		       verified, verification_method, response_time_ms, is_gateway,
		       last_verified_at, checks_passed, checks_failed, COALESCE(coordinates, '')
		FROM devices WHERE id = ?
	`, id).Scan(
		&dev.ID, &dev.MAC, &dev.IP, &dev.Hostname, &dev.Vendor,
		&dev.DeviceType, &dev.OSInfo, &dev.Services, &fs, &ls, &dev.Status,
		&dev.RSSI, &dev.SNMPEnabled,
		&dev.Verified, &dev.VerificationMethod, &dev.ResponseTimeMs, &dev.IsGateway,
		&lva, &dev.ChecksPassed, &dev.ChecksFailed, &dev.Coordinates,
	)
	if err != nil {
		return nil, err
	}

	if fs.Valid {
		dev.FirstSeen, _ = time.Parse(time.RFC3339, fs.String)
	}
	if ls.Valid {
		dev.LastSeen, _ = time.Parse(time.RFC3339, ls.String)
	}
	if lva.Valid {
		dev.LastVerifiedAt, _ = time.Parse(time.RFC3339, lva.String)
	}

	return &dev, nil
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
		INSERT INTO scan_history (scan_type, started_at, finished_at, devices_found, verified_found, status, details)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, s.ScanType, s.StartedAt, s.FinishedAt, s.DevicesFound, s.VerifiedFound, s.Status, s.Details)
	if err != nil {
		return err
	}
	id, _ := res.LastInsertId()
	s.ID = id
	return nil
}

func (d *Database) RecordStatsSnapshot() error {
	stats, err := d.GetStats()
	if err != nil {
		return err
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	_, err = d.db.Exec(`
		INSERT INTO network_stats_history (
			timestamp, total_devices, online_devices, verified_devices,
			avg_latency_ms, gateways_count, snmp_count, iot_count
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, time.Now(), stats.TotalDevices, stats.OnlineDevices, stats.VerifiedDevices,
		stats.AvgLatencyMs, stats.ByType["Gateway/Router"], stats.SNMPDevices,
		stats.CameraDevices+stats.NASDevices)

	return err
}

func (d *Database) GetStatsHistory(limit int) ([]models.NetworkStatsSnapshot, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	if limit <= 0 {
		limit = 20
	}

	rows, err := d.db.Query(`
		SELECT id, timestamp, total_devices, online_devices, verified_devices,
		       avg_latency_ms, gateways_count, snmp_count, iot_count
		FROM network_stats_history
		ORDER BY timestamp DESC LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []models.NetworkStatsSnapshot
	for rows.Next() {
		var s models.NetworkStatsSnapshot
		var ts string
		if err := rows.Scan(
			&s.ID, &ts, &s.TotalDevices, &s.OnlineDevices, &s.VerifiedDevices,
			&s.AvgLatencyMs, &s.GatewaysCount, &s.SNMPCount, &s.IoTCount,
		); err != nil {
			return nil, err
		}
		s.Timestamp, _ = time.Parse(time.RFC3339, ts)
		history = append(history, s)
	}

	return history, nil
}

func (d *Database) GetDeviceEvents(deviceID int64, limit int) ([]models.DeviceEvent, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	if limit <= 0 {
		limit = 30
	}

	query := "SELECT id, device_id, mac, ip, event_type, latency_ms, details, timestamp FROM device_events"
	var args []interface{}
	if deviceID > 0 {
		query += " WHERE device_id = ?"
		args = append(args, deviceID)
	}
	query += " ORDER BY timestamp DESC LIMIT ?"
	args = append(args, limit)

	rows, err := d.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []models.DeviceEvent
	for rows.Next() {
		var e models.DeviceEvent
		var ts string
		if err := rows.Scan(&e.ID, &e.DeviceID, &e.MAC, &e.IP, &e.EventType, &e.LatencyMs, &e.Details, &ts); err != nil {
			return nil, err
		}
		e.Timestamp, _ = time.Parse(time.RFC3339, ts)
		events = append(events, e)
	}

	return events, nil
}

func (d *Database) GetStats() (*models.Stats, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	stats := &models.Stats{
		ByType:              make(map[string]int),
		ByVendor:            make(map[string]int),
		LatencyDistribution: make(map[string]int),
	}

	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices").Scan(&stats.TotalDevices)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices WHERE status = 'online'").Scan(&stats.OnlineDevices)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices WHERE verified = 1").Scan(&stats.VerifiedDevices)

	if stats.TotalDevices > 0 {
		stats.VerificationRatePct = float64(stats.VerifiedDevices) / float64(stats.TotalDevices) * 100.0
	} else {
		stats.VerificationRatePct = 100.0
	}

	// Latencias
	_ = d.db.QueryRow("SELECT COALESCE(AVG(response_time_ms), 0) FROM devices WHERE response_time_ms > 0 AND status = 'online'").
		Scan(&stats.AvgLatencyMs)
	_ = d.db.QueryRow("SELECT COALESCE(MIN(response_time_ms), 0) FROM devices WHERE response_time_ms > 0 AND status = 'online'").
		Scan(&stats.MinLatencyMs)
	_ = d.db.QueryRow("SELECT COALESCE(MAX(response_time_ms), 0) FROM devices WHERE response_time_ms > 0 AND status = 'online'").
		Scan(&stats.MaxLatencyMs)

	// Gateway
	var gwIP sql.NullString
	var gwLat sql.NullInt64
	_ = d.db.QueryRow("SELECT ip, response_time_ms FROM devices WHERE is_gateway = 1 LIMIT 1").Scan(&gwIP, &gwLat)
	if gwIP.Valid {
		stats.GatewayIP = gwIP.String
	}
	if gwLat.Valid {
		stats.GatewayLatencyMs = int(gwLat.Int64)
	}

	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices WHERE snmp_enabled = 1").Scan(&stats.SNMPDevices)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices WHERE device_type = 'BLE'").Scan(&stats.BLEDevices)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices WHERE device_type = 'Camera'").Scan(&stats.CameraDevices)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices WHERE device_type = 'NAS'").Scan(&stats.NASDevices)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices WHERE device_type = 'Zigbee'").Scan(&stats.ZigbeeDevices)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices WHERE device_type = 'Z-Wave'").Scan(&stats.ZWaveDevices)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices WHERE device_type = 'Thread'").Scan(&stats.ThreadDevices)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices WHERE device_type = 'UWB'").Scan(&stats.UWBDevices)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices WHERE device_type = 'NFC'").Scan(&stats.NFCDevices)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices WHERE device_type = 'GPS'").Scan(&stats.GPSDevices)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices WHERE device_type = 'LPWAN'").Scan(&stats.LPWANDevices)

	_ = d.db.QueryRow("SELECT COUNT(*) FROM alerts").Scan(&stats.TotalAlerts)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM alerts WHERE acknowledged = 0").Scan(&stats.PendingAlerts)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM alerts WHERE severity = 'danger' AND acknowledged = 0").Scan(&stats.CriticalAlerts)

	var lastFinished sql.NullString
	_ = d.db.QueryRow("SELECT finished_at FROM scan_history ORDER BY finished_at DESC LIMIT 1").Scan(&lastFinished)
	if lastFinished.Valid {
		stats.LastScanTime = lastFinished.String
	}

	// Distribución por tipos
	typeRows, err := d.db.Query("SELECT device_type, COUNT(*) FROM devices GROUP BY device_type")
	if err == nil {
		defer typeRows.Close()
		for typeRows.Next() {
			var dt string
			var count int
			if err := typeRows.Scan(&dt, &count); err == nil && dt != "" {
				stats.ByType[dt] = count
			}
		}
	}

	// Distribución por principales fabricantes
	vendorRows, err := d.db.Query("SELECT vendor, COUNT(*) FROM devices GROUP BY vendor ORDER BY COUNT(*) DESC LIMIT 8")
	if err == nil {
		defer vendorRows.Close()
		for vendorRows.Next() {
			var v string
			var count int
			if err := vendorRows.Scan(&v, &count); err == nil && v != "" {
				stats.ByVendor[v] = count
			}
		}
	}

	// Distribución de latencias
	var fast, optimal, slow int
	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices WHERE response_time_ms > 0 AND response_time_ms <= 20").Scan(&fast)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices WHERE response_time_ms > 20 AND response_time_ms <= 100").Scan(&optimal)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM devices WHERE response_time_ms > 100").Scan(&slow)

	stats.LatencyDistribution["fast_under_20ms"] = fast
	stats.LatencyDistribution["optimal_20_100ms"] = optimal
	stats.LatencyDistribution["slow_over_100ms"] = slow

	return stats, nil
}
