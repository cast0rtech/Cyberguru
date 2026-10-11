package models

import "time"

// Device representa un equipo identificado en la red física o vía BLE.
type Device struct {
	ID          int64     `json:"id"`
	MAC         string    `json:"mac"`
	IP          string    `json:"ip"`
	Hostname    string    `json:"hostname"`
	Vendor      string    `json:"vendor"`
	DeviceType  string    `json:"device_type"` // "Ethernet", "WiFi", "SNMP", "BLE"
	OSInfo      string    `json:"os_info"`
	FirstSeen   time.Time `json:"first_seen"`
	LastSeen    time.Time `json:"last_seen"`
	Status      string    `json:"status"` // "online", "offline"
	RSSI        int       `json:"rssi"`   // Señal en dBm para BLE / WiFi (ej. -65)
	SNMPEnabled bool      `json:"snmp_enabled"`
}

// Alert representa una anomalía o hallazgo de seguridad detectado.
type Alert struct {
	ID           int64     `json:"id"`
	DeviceID     *int64    `json:"device_id,omitempty"`
	Severity     string    `json:"severity"` // "info", "warning", "danger"
	Title        string    `json:"title"`
	Description  string    `json:"description"`
	Timestamp    time.Time `json:"timestamp"`
	Acknowledged bool      `json:"acknowledged"`
}

// ScanHistory registra el historial de ejecuciones de escaneo.
type ScanHistory struct {
	ID           int64     `json:"id"`
	ScanType     string    `json:"scan_type"` // "arp", "snmp", "ble", "all"
	StartedAt    time.Time `json:"started_at"`
	FinishedAt   time.Time `json:"finished_at"`
	DevicesFound int       `json:"devices_found"`
	Status       string    `json:"status"` // "running", "completed", "failed"
	Details      string    `json:"details"`
}

// Stats contiene las métricas para el dashboard de ciberseguridad.
type Stats struct {
	TotalDevices    int    `json:"total_devices"`
	OnlineDevices   int    `json:"online_devices"`
	SNMPDevices     int    `json:"snmp_devices"`
	BLEDevices      int    `json:"ble_devices"`
	TotalAlerts     int    `json:"total_alerts"`
	PendingAlerts   int    `json:"pending_alerts"`
	CriticalAlerts  int    `json:"critical_alerts"`
	LastScanTime    string `json:"last_scan_time"`
	NetworkInterface string `json:"network_interface"`
}

// ScanRequest es la carga útil para invocar un escaneo manual vía API.
type ScanRequest struct {
	ScanType string `json:"scan_type"` // "arp", "snmp", "ble", "all"
	Subnet   string `json:"subnet"`    // Opcional, ej: "192.168.1.0/24"
}
