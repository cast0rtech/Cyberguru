package models

import "time"

// Device representa un equipo identificado en la red física o vía BLE.
type Device struct {
	ID                 int64     `json:"id"`
	MAC                string    `json:"mac"`
	IP                 string    `json:"ip"`
	Hostname           string    `json:"hostname"`
	Vendor             string    `json:"vendor"`
	DeviceType         string    `json:"device_type"` // "Gateway/Router", "Workstation/PC", "Ethernet", "WiFi", "SNMP", "BLE", "Camera", "NAS", "Zigbee", "Z-Wave", "Thread", "UWB", "NFC", "GPS", "LPWAN"
	OSInfo             string    `json:"os_info"`
	Services           string    `json:"services"` // Puertos y protocolos detectados (ej: "DNS (53), HTTP (80)")
	FirstSeen          time.Time `json:"first_seen"`
	LastSeen           time.Time `json:"last_seen"`
	Status             string    `json:"status"` // "online", "offline"
	RSSI               int       `json:"rssi"`   // Señal en dBm para BLE / WiFi / Zigbee / LoRa (ej. -65)
	SNMPEnabled        bool      `json:"snmp_enabled"`
	Verified           bool      `json:"verified"`            // true solo si pasó la comprobación activa real
	VerificationMethod string    `json:"verification_method"` // Método de comprobación (ej. "ICMP Ping (6ms)", "TCP Puerto 53")
	ResponseTimeMs     int       `json:"response_time_ms"`    // Latencia real en ms
	IsGateway          bool      `json:"is_gateway"`          // Indicador si es la puerta de enlace / router
	LastVerifiedAt     time.Time `json:"last_verified_at"`
	ChecksPassed       int       `json:"checks_passed"`
	ChecksFailed       int       `json:"checks_failed"`
	Coordinates        string    `json:"coordinates,omitempty"` // Coordenadas GPS/GNSS (Lat, Lon)
}

// DeviceEvent registra un hito o cambio de estado de un dispositivo en el tiempo.
type DeviceEvent struct {
	ID        int64     `json:"id"`
	DeviceID  int64     `json:"device_id"`
	MAC       string    `json:"mac"`
	IP        string    `json:"ip"`
	EventType string    `json:"event_type"` // "VERIFIED_ONLINE", "OFFLINE", "DISCOVERED", "LATENCY_UPDATE"
	LatencyMs int       `json:"latency_ms"`
	Details   string    `json:"details"`
	Timestamp time.Time `json:"timestamp"`
}

// NetworkStatsSnapshot guarda una instantánea histórica de métricas de red.
type NetworkStatsSnapshot struct {
	ID              int64     `json:"id"`
	Timestamp       time.Time `json:"timestamp"`
	TotalDevices    int       `json:"total_devices"`
	OnlineDevices   int       `json:"online_devices"`
	VerifiedDevices int       `json:"verified_devices"`
	AvgLatencyMs    float64   `json:"avg_latency_ms"`
	GatewaysCount   int       `json:"gateways_count"`
	SNMPCount       int       `json:"snmp_count"`
	IoTCount        int       `json:"iot_count"`
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
	ID            int64     `json:"id"`
	ScanType      string    `json:"scan_type"` // "arp", "snmp", "ble", "iot", "all"
	StartedAt     time.Time `json:"started_at"`
	FinishedAt    time.Time `json:"finished_at"`
	DevicesFound  int       `json:"devices_found"`
	VerifiedFound int       `json:"verified_found"`
	Status        string    `json:"status"` // "running", "completed", "failed"
	Details       string    `json:"details"`
}

// Stats contiene las métricas para el dashboard de ciberseguridad y estadísticas.
type Stats struct {
	TotalDevices         int            `json:"total_devices"`
	OnlineDevices        int            `json:"online_devices"`
	VerifiedDevices      int            `json:"verified_devices"`
	VerificationRatePct  float64        `json:"verification_rate_pct"`
	AvgLatencyMs         float64        `json:"avg_latency_ms"`
	MinLatencyMs         int            `json:"min_latency_ms"`
	MaxLatencyMs         int            `json:"max_latency_ms"`
	GatewayIP            string         `json:"gateway_ip"`
	GatewayLatencyMs     int            `json:"gateway_latency_ms"`
	SNMPDevices          int            `json:"snmp_devices"`
	BLEDevices           int            `json:"ble_devices"`
	CameraDevices        int            `json:"camera_devices"`
	NASDevices           int            `json:"nas_devices"`
	ZigbeeDevices        int            `json:"zigbee_devices"`
	ZWaveDevices         int            `json:"zwave_devices"`
	ThreadDevices        int            `json:"thread_devices"`
	UWBDevices           int            `json:"uwb_devices"`
	NFCDevices           int            `json:"nfc_devices"`
	GPSDevices           int            `json:"gps_devices"`
	LPWANDevices         int            `json:"lpwan_devices"`
	TotalAlerts          int            `json:"total_alerts"`
	PendingAlerts        int            `json:"pending_alerts"`
	CriticalAlerts       int            `json:"critical_alerts"`
	LastScanTime         string         `json:"last_scan_time"`
	NetworkInterface     string         `json:"network_interface"`
	ByType               map[string]int `json:"by_type"`
	ByVendor             map[string]int `json:"by_vendor"`
	LatencyDistribution  map[string]int `json:"latency_distribution"`
}

// ScanRequest es la carga útil para invocar un escaneo manual vía API.
type ScanRequest struct {
	ScanType string `json:"scan_type"` // "arp", "snmp", "ble", "iot", "wireless", "zigbee", "zwave", "thread", "uwb", "nfc", "gps", "lpwan", "all"
	Subnet   string `json:"subnet"`    // Opcional, ej: "192.168.1.0/24"
}
