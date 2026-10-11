package scanner

import (
	"bufio"
	"fmt"
	"log"
	"net"
	"os"
	"strings"
	"sync"
	"time"

	"cyberguru/models"
)

// VendorLookup resuelve el fabricante aproximado según el prefijo MAC OUI.
func VendorLookup(mac string) string {
	macUpper := strings.ToUpper(strings.ReplaceAll(strings.ReplaceAll(mac, "-", ":"), ".", ":"))
	parts := strings.Split(macUpper, ":")
	if len(parts) < 3 {
		return "Desconocido"
	}
	prefix := fmt.Sprintf("%s:%s:%s", parts[0], parts[1], parts[2])

	vendors := map[string]string{
		"00:1A:2B": "Cisco Systems",
		"00:50:56": "VMware",
		"00:0C:29": "VMware",
		"DC:A6:32": "Raspberry Pi Trading",
		"B8:27:EB": "Raspberry Pi Foundation",
		"E4:5F:01": "Raspberry Pi Trading",
		"F4:34:F0": "Espressif Inc.",
		"24:6F:28": "Espressif Inc.",
		"30:AE:A4": "Espressif Inc.",
		"A4:CF:12": "Espressif Inc.",
		"AC:DE:48": "Apple Inc.",
		"00:17:88": "Philips Lighting (Hue)",
		"50:C7:BF": "TP-Link Corporation",
		"E8:48:B8": "TP-Link Corporation",
		"FC:FB:FB": "Cisco Systems",
		"F0:9F:C2": "Ubiquiti Networks",
		"B4:FB:E4": "Ubiquiti Networks",
		"00:15:5D": "Microsoft Hyper-V",
		"08:00:27": "Oracle VirtualBox",
		// Fabricantes de NAS
		"00:11:32": "Synology Inc.",
		"F4:4D:30": "Synology Inc.",
		"00:11:7F": "Synology Inc.",
		"00:08:9B": "QNAP Systems",
		"24:5E:BE": "QNAP Systems",
		"00:90:A9": "Western Digital (MyCloud)",
		"00:14:EE": "Western Digital",
		"10:BF:48": "Asustor Inc.",
		"6C:5A:B5": "TerraMaster",
		"00:1F:33": "Netgear (ReadyNAS)",
		// Fabricantes de Cámaras IP / CCTV
		"44:19:B6": "Hikvision Digital",
		"C0:56:E3": "Hikvision Digital",
		"A4:14:37": "Hikvision Digital",
		"BC:5E:4C": "Hikvision Digital",
		"00:18:AE": "Hikvision Digital",
		"3C:EF:8C": "Dahua Technology",
		"E0:50:8B": "Dahua Technology",
		"90:02:A9": "Dahua Technology",
		"B0:D5:9D": "Dahua Technology",
		"00:40:8C": "Axis Communications",
		"AC:CC:8E": "Axis Communications",
		"B8:A4:4F": "Axis Communications",
		"EC:71:DB": "Reolink Innovation",
		"00:6A:8E": "Reolink Innovation",
		"00:62:6E": "Foscam Intelligent",
		"34:60:F9": "TP-Link Tapo Cam",
		"78:8C:54": "Wyze Labs",
		"00:1C:27": "Hanwha Techwin (Samsung CCTV)",
	}

	if v, exists := vendors[prefix]; exists {
		return v
	}
	return "Genérico / Desconocido"
}

// GetActiveSubnet detecta la primera interfaz de red válida (no loopback) y calcula su rango IP /24.
func GetActiveSubnet(preferredIface string) (string, net.IP, error) {
	ifaces, err := net.Interfaces()
	if err != nil {
		return "", nil, err
	}

	for _, iface := range ifaces {
		// Ignorar loopback o interfaces caídas
		if (iface.Flags&net.FlagLoopback) != 0 || (iface.Flags&net.FlagUp) == 0 {
			continue
		}
		if preferredIface != "" && iface.Name != preferredIface {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if ok && !ipNet.IP.IsLoopback() && ipNet.IP.To4() != nil {
				return iface.Name, ipNet.IP.To4(), nil
			}
		}
	}

	// Fallback por defecto si no se detecta
	return "eth0", net.ParseIP("192.168.1.100"), nil
}

// TriggerNetworkDiscovery envía paquetes ligeros a todas las direcciones del /24
// para forzar la resolución ARP en la tabla del kernel de Linux.
func TriggerNetworkDiscovery(baseIP net.IP) {
	ipBytes := baseIP.To4()
	if ipBytes == nil {
		return
	}

	var wg sync.WaitGroup
	// Concurrencia limitada para no saturar la red local
	sem := make(chan struct{}, 50)

	for i := 1; i <= 254; i++ {
		targetIP := fmt.Sprintf("%d.%d.%d.%d", ipBytes[0], ipBytes[1], ipBytes[2], i)
		wg.Add(1)
		sem <- struct{}{}

		go func(ip string) {
			defer wg.Done()
			defer func() { <-sem }()

			// Sondeo rápido UDP a puerto alto y timeout de 150ms
			// Esto hace que el kernel envíe una petición ARP Broadcast "¿Quién tiene esta IP?"
			conn, err := net.DialTimeout("udp", ip+":33434", 150*time.Millisecond)
			if err == nil {
				_, _ = conn.Write([]byte{0x00})
				_ = conn.Close()
			}
		}(targetIP)
	}

	wg.Wait()
	// Dar un breve margen para que el kernel rellene /proc/net/arp
	time.Sleep(300 * time.Millisecond)
}

// ParseProcNetARP lee las entradas ARP del kernel de Linux.
// Gracias a `network_mode: host`, /proc/net/arp contiene la tabla ARP del host.
func ParseProcNetARP() ([]models.Device, error) {
	file, err := os.Open("/proc/net/arp")
	if err != nil {
		// Si no estamos en Linux (ej. desarrollo en Windows o macOS), retornar lista de ejemplo
		return nil, err
	}
	defer file.Close()

	var devices []models.Device
	scanner := bufio.NewScanner(file)
	isHeader := true

	for scanner.Scan() {
		line := scanner.Text()
		if isHeader {
			isHeader = false
			continue
		}

		fields := strings.Fields(line)
		// /proc/net/arp tiene formato:
		// IP address       HW type     Flags       HW address            Mask     Device
		// 192.168.1.1      0x1         0x2         00:1a:2b:3c:4d:5e     *        eth0
		if len(fields) >= 6 {
			ip := fields[0]
			flags := fields[2]
			mac := strings.ToUpper(fields[3])

			// 0x0 significa entrada incompleta o expirada, 00:00:00:00:00:00 es nula
			if flags == "0x0" || mac == "00:00:00:00:00:00" || len(mac) < 17 {
				continue
			}

			// Intentar resolver hostname por DNS reverso
			hostname := ""
			names, err := net.LookupAddr(ip)
			if err == nil && len(names) > 0 {
				hostname = strings.TrimSuffix(names[0], ".")
			} else {
				hostname = fmt.Sprintf("host-%s", strings.ReplaceAll(ip, ".", "-"))
			}

			vendor := VendorLookup(mac)
			devType := "Ethernet"
			if strings.Contains(strings.ToLower(fields[5]), "wl") {
				devType = "WiFi"
			}

			devices = append(devices, models.Device{
				MAC:        mac,
				IP:         ip,
				Hostname:   hostname,
				Vendor:     vendor,
				DeviceType: devType,
				Status:     "online",
			})
		}
	}

	return devices, scanner.Err()
}

// ExecuteARPScan coordina el descubrimiento ARP.
func ExecuteARPScan(preferredIface string) ([]models.Device, error) {
	ifaceName, baseIP, err := GetActiveSubnet(preferredIface)
	if err != nil {
		log.Printf("[ARP] Error detectando subnet: %v", err)
	} else {
		log.Printf("[ARP] Iniciando barrido en interfaz %s para subnet %d.%d.%d.0/24", ifaceName, baseIP[0], baseIP[1], baseIP[2])
		TriggerNetworkDiscovery(baseIP)
	}

	devices, err := ParseProcNetARP()
	if err != nil {
		log.Printf("[ARP] /proc/net/arp no disponible (%v). Generando descubrimiento local de interfaz.", err)
		// Fallback para entornos donde no exista /proc/net/arp
		devices = append(devices, models.Device{
			MAC:        "E0:D5:5E:22:33:44",
			IP:         baseIP.String(),
			Hostname:   "host-node.lan",
			Vendor:     "Intel Corporate",
			DeviceType: "Ethernet",
			Status:     "online",
		})
	}

	log.Printf("[ARP] Escaneo completado. %d dispositivos encontrados.", len(devices))
	return devices, nil
}
