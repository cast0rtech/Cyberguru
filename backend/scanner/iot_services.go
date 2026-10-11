package scanner

import (
	"fmt"
	"log"
	"net"
	"strings"
	"sync"
	"time"

	"cyberguru/models"
)

type IoTServiceResult struct {
	IP         string
	IsCamera   bool
	IsNAS      bool
	Services   []string
	Details    string
	RiskAlerts []models.Alert
}

// checkTCPPort prueba rápidamente si un puerto TCP está abierto
func checkTCPPort(ip string, port int, timeout time.Duration) bool {
	target := fmt.Sprintf("%s:%d", ip, port)
	conn, err := net.DialTimeout("tcp", target, timeout)
	if err == nil {
		_ = conn.Close()
		return true
	}
	return false
}

// AnalyzeDeviceIoT analiza una IP específica buscando servicios característicos de Cámaras IP o NAS
func AnalyzeDeviceIoT(device *models.Device, timeout time.Duration) *IoTServiceResult {
	if device.IP == "" || device.IP == "0.0.0.0" {
		return nil
	}

	result := &IoTServiceResult{
		IP: device.IP,
	}

	var services []string
	vendorLower := strings.ToLower(device.Vendor)
	hostLower := strings.ToLower(device.Hostname)

	// ==========================================
	// 1. Sondeo de Cámaras IP (RTSP, ONVIF, HTTP)
	// ==========================================
	hasRTSP := checkTCPPort(device.IP, 554, timeout)       // RTSP Video Stream
	hasONVIF := checkTCPPort(device.IP, 8000, timeout)     // ONVIF Hikvision/Dahua
	hasAltCam := checkTCPPort(device.IP, 8899, timeout)    // ONVIF alternativo
	hasCamWeb := checkTCPPort(device.IP, 81, timeout)      // Puerto web frecuente en cámaras

	isCamVendor := strings.Contains(vendorLower, "hikvision") ||
		strings.Contains(vendorLower, "dahua") ||
		strings.Contains(vendorLower, "axis") ||
		strings.Contains(vendorLower, "reolink") ||
		strings.Contains(vendorLower, "foscam") ||
		strings.Contains(vendorLower, "tapo") ||
		strings.Contains(vendorLower, "wyze") ||
		strings.Contains(hostLower, "cam") ||
		strings.Contains(hostLower, "cctv")

	if hasRTSP || hasONVIF || hasAltCam || (isCamVendor && (hasCamWeb || checkTCPPort(device.IP, 80, timeout))) {
		result.IsCamera = true
		if hasRTSP {
			services = append(services, "RTSP-Stream (554)")
			result.RiskAlerts = append(result.RiskAlerts, models.Alert{
				DeviceID:     &device.ID,
				Severity:     "warning",
				Title:        fmt.Sprintf("Flujo de Vídeo RTSP Abierto en %s", device.IP),
				Description:  fmt.Sprintf("La cámara IP (%s) tiene el puerto RTSP 554 abierto. Verifica que la transmisión requiera autenticación y contraseña segura.", device.Hostname),
				Timestamp:    time.Now(),
				Acknowledged: false,
			})
		}
		if hasONVIF {
			services = append(services, "ONVIF (8000)")
		}
		if hasAltCam {
			services = append(services, "ONVIF-Alt (8899)")
		}
	}

	// ==========================================
	// 2. Sondeo de Servidores NAS (SMB, NFS, DSM, QTS)
	// ==========================================
	hasSMB := checkTCPPort(device.IP, 445, timeout)        // SMB / CIFS
	hasNFS := checkTCPPort(device.IP, 2049, timeout)       // NFS
	hasSynoHTTP := checkTCPPort(device.IP, 5000, timeout)  // Synology DSM HTTP
	hasSynoHTTPS := checkTCPPort(device.IP, 5001, timeout) // Synology DSM HTTPS
	hasQNAP := checkTCPPort(device.IP, 8080, timeout)      // QNAP QTS Web
	hasAFP := checkTCPPort(device.IP, 548, timeout)        // Apple Filing Protocol

	isNASVendor := strings.Contains(vendorLower, "synology") ||
		strings.Contains(vendorLower, "qnap") ||
		strings.Contains(vendorLower, "asustor") ||
		strings.Contains(vendorLower, "terramaster") ||
		strings.Contains(vendorLower, "western digital") ||
		strings.Contains(hostLower, "nas") ||
		strings.Contains(hostLower, "truenas") ||
		strings.Contains(hostLower, "storage")

	if (hasSMB && (hasNFS || hasSynoHTTP || hasSynoHTTPS || isNASVendor)) ||
		hasSynoHTTP || hasSynoHTTPS || (isNASVendor && hasSMB) {
		result.IsNAS = true
		if hasSMB {
			services = append(services, "SMB/CIFS (445)")
		}
		if hasNFS {
			services = append(services, "NFS (2049)")
		}
		if hasSynoHTTP {
			services = append(services, "Synology-DSM (5000)")
			result.RiskAlerts = append(result.RiskAlerts, models.Alert{
				DeviceID:     &device.ID,
				Severity:     "warning",
				Title:        fmt.Sprintf("Panel NAS en HTTP no cifrado en %s", device.IP),
				Description:  fmt.Sprintf("El almacenamiento NAS (%s) expone el panel de gestión en el puerto HTTP 5000 sin cifrado SSL/TLS. Se recomienda activar HTTPS (puerto 5001).", device.Hostname),
				Timestamp:    time.Now(),
				Acknowledged: false,
			})
		}
		if hasSynoHTTPS {
			services = append(services, "Synology-DSM (5001)")
		}
		if hasQNAP && isNASVendor {
			services = append(services, "QNAP-QTS (8080)")
		}
		if hasAFP {
			services = append(services, "AFP (548)")
		}
	}

	result.Services = services
	if len(services) > 0 {
		result.Details = strings.Join(services, ", ")
	}

	return result
}

// ExecuteIoTScan recorre concurrentemente la lista de dispositivos buscando Cámaras y NAS
func ExecuteIoTScan(devices []models.Device) map[int64]*IoTServiceResult {
	results := make(map[int64]*IoTServiceResult)
	var mu sync.Mutex
	var wg sync.WaitGroup

	sem := make(chan struct{}, 20)
	timeout := 450 * time.Millisecond

	for i := range devices {
		dev := devices[i]
		if dev.IP == "" || dev.IP == "0.0.0.0" {
			continue
		}

		wg.Add(1)
		sem <- struct{}{}

		go func(d models.Device) {
			defer wg.Done()
			defer func() { <-sem }()

			res := AnalyzeDeviceIoT(&d, timeout)
			if res != nil && (res.IsCamera || res.IsNAS || len(res.Services) > 0) {
				mu.Lock()
				results[d.ID] = res
				mu.Unlock()
				log.Printf("[IoT] Dispositivo clasificado en %s: Cam=%v, NAS=%v (%s)", d.IP, res.IsCamera, res.IsNAS, res.Details)
			}
		}(dev)
	}

	wg.Wait()
	return results
}
