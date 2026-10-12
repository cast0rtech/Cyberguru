package scanner

import (
	"bufio"
	"fmt"
	"log"
	"net"
	"os"
	"os/exec"
	"regexp"
	"runtime"
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
		// Routers & Networking
		"00:1A:2B": "Cisco Systems",
		"FC:FB:FB": "Cisco Systems",
		"00:00:0C": "Cisco Systems",
		"F0:9F:C2": "Ubiquiti Networks",
		"B4:FB:E4": "Ubiquiti Networks",
		"24:A4:3C": "Ubiquiti Networks",
		"50:C7:BF": "TP-Link Corporation",
		"E8:48:B8": "TP-Link Corporation",
		"60:32:B1": "TP-Link Corporation",
		"34:60:F9": "TP-Link Corporation",
		"C0:25:E9": "TP-Link Corporation",
		"AC:84:C6": "TP-Link Corporation",
		"00:18:0A": "Cisco Meraki",
		"E0:55:3D": "Cisco Meraki",
		"C8:D7:19": "Cisco Meraki",
		"00:26:86": "Netgear Inc.",
		"08:02:8E": "Netgear Inc.",
		"20:E5:2A": "Netgear Inc.",
		"00:1F:33": "Netgear Inc.",
		"C8:0E:14": "AVM GmbH (FRITZ!Box)",
		"38:10:D5": "AVM GmbH (FRITZ!Box)",
		"7C:FF:4D": "Sagemcom Broadband",
		"E4:5D:51": "Sagemcom Broadband",
		"34:8A:AE": "Sagemcom Broadband",
		"DC:02:8E": "Technicolor / Thomson",
		"D4:6E:5C": "Technicolor",
		"20:10:7A": "Huawei Technologies",
		"48:46:FB": "Huawei Technologies",
		"00:1E:10": "Huawei Technologies",
		"CC:81:DA": "ZTE Corporation",
		"70:9F:26": "ZTE Corporation",
		"00:0E:6B": "American Megatrends",

		// Computadoras & Chips
		"00:50:56": "VMware Virtual NIC",
		"00:0C:29": "VMware Virtual NIC",
		"00:05:69": "VMware Inc.",
		"00:15:5D": "Microsoft Hyper-V",
		"08:00:27": "Oracle VirtualBox",
		"B4:2E:99": "Intel Corporate",
		"68:05:CA": "Intel Corporate",
		"00:1B:21": "Intel Corporate",
		"A4:4C:C8": "Intel Corporate",
		"34:13:E8": "Intel Corporate",
		"00:E0:4C": "Realtek Semiconductor",
		"54:04:A6": "Realtek Semiconductor",
		"00:1A:4D": "Realtek Semiconductor",
		"48:21:0B": "Dell Inc.",
		"18:66:DA": "Dell Inc.",
		"00:14:22": "Dell Inc.",
		"3C:D9:2B": "HP Inc.",
		"9C:8E:99": "HP Inc.",
		"70:5A:0F": "HP Inc.",
		"00:21:5A": "HP Inc.",
		"80:CE:62": "Lenovo Group",
		"00:26:18": "ASUSTeK Computer",
		"AC:16:2D": "Micro-Star (MSI)",
		"D8:5E:D3": "Gigabyte Technology",

		// Móviles & Consumer
		"AC:DE:48": "Apple Inc.",
		"F0:18:98": "Apple Inc.",
		"A4:83:E7": "Apple Inc.",
		"3C:06:30": "Apple Inc.",
		"60:F8:1D": "Apple Inc.",
		"AC:BC:32": "Apple Inc.",
		"BC:D1:D3": "Apple Inc.",
		"28:6A:BA": "Apple Inc.",
		"E8:80:2E": "Apple Inc.",
		"DC:A9:04": "Apple Inc.",
		"50:BC:96": "Samsung Electronics",
		"00:16:32": "Samsung Electronics",
		"34:C3:AC": "Samsung Electronics",
		"64:1C:AE": "Samsung Electronics",
		"78:40:E4": "Xiaomi Communications",
		"64:CC:2E": "Xiaomi Communications",
		"34:CE:00": "Xiaomi Communications",
		"28:6D:97": "Google Inc. (Pixel/Nest)",
		"54:60:09": "Google Inc.",
		"F0:72:EA": "Amazon Technologies (Echo)",
		"40:B4:CD": "Amazon Technologies",

		// IoT, Cámaras & NAS
		"DC:A6:32": "Raspberry Pi Trading",
		"B8:27:EB": "Raspberry Pi Foundation",
		"E4:5F:01": "Raspberry Pi Trading",
		"28:CD:C1": "Raspberry Pi Trading",
		"F4:34:F0": "Espressif Systems (ESP32/8266)",
		"24:6F:28": "Espressif Systems",
		"30:AE:A4": "Espressif Systems",
		"A4:CF:12": "Espressif Systems",
		"00:17:88": "Philips Lighting (Hue)",
		"00:11:32": "Synology Inc.",
		"F4:4D:30": "Synology Inc.",
		"00:11:7F": "Synology Inc.",
		"00:08:9B": "QNAP Systems",
		"24:5E:BE": "QNAP Systems",
		"00:90:A9": "Western Digital (MyCloud)",
		"00:14:EE": "Western Digital",
		"10:BF:48": "Asustor Inc.",
		"6C:5A:B5": "TerraMaster",
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
		"EC:71:DB": "Reolink Innovation",
		"00:6A:8E": "Reolink Innovation",
		"00:62:6E": "Foscam Intelligent",
		"78:8C:54": "Wyze Labs",
		"00:1C:27": "Hanwha Techwin (Samsung CCTV)",
	}

	if v, exists := vendors[prefix]; exists {
		return v
	}
	return "Dispositivo de Red LAN"
}

// HostInterfaceInfo almacena las interfaces de red locales reales del host.
type HostInterfaceInfo struct {
	Name string
	IP   net.IP
	MAC  string
	Mask net.IPMask
}

// GetHostInterfaces obtiene todas las interfaces de red IPv4 activas reales de la máquina.
func GetHostInterfaces() []HostInterfaceInfo {
	var list []HostInterfaceInfo
	ifaces, err := net.Interfaces()
	if err != nil {
		return list
	}

	for _, iface := range ifaces {
		if (iface.Flags&net.FlagLoopback) != 0 || (iface.Flags&net.FlagUp) == 0 {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		macStr := strings.ToUpper(iface.HardwareAddr.String())

		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if ok && !ipNet.IP.IsLoopback() && ipNet.IP.To4() != nil {
				ip4 := ipNet.IP.To4()
				// Ignorar APIPA (169.254.x.x)
				if ip4[0] == 169 && ip4[1] == 254 {
					continue
				}

				list = append(list, HostInterfaceInfo{
					Name: iface.Name,
					IP:   ip4,
					MAC:  macStr,
					Mask: ipNet.Mask,
				})
			}
		}
	}

	return list
}

// TriggerNetworkDiscovery envía paquetes de sondeo rápido a las IPs del segmento para forzar ARP.
func TriggerNetworkDiscovery(baseIP net.IP) {
	ipBytes := baseIP.To4()
	if ipBytes == nil {
		return
	}

	var wg sync.WaitGroup
	sem := make(chan struct{}, 60)

	for i := 1; i <= 254; i++ {
		targetIP := fmt.Sprintf("%d.%d.%d.%d", ipBytes[0], ipBytes[1], ipBytes[2], i)
		wg.Add(1)
		sem <- struct{}{}

		go func(ip string) {
			defer wg.Done()
			defer func() { <-sem }()

			// Sondeo ligero UDP para forzar resolución ARP en la pila de red del SO
			conn, err := net.DialTimeout("udp", ip+":33434", 120*time.Millisecond)
			if err == nil {
				_, _ = conn.Write([]byte{0x00})
				_ = conn.Close()
			}
		}(targetIP)
	}

	wg.Wait()
	time.Sleep(250 * time.Millisecond)
}

// CandidateDevice representa un dispositivo potencial descubierto antes de la comprobación estricta.
type CandidateDevice struct {
	IP        string
	MAC       string
	IsGateway bool
}

// ParseWindowsNeighbors consulta Get-NetNeighbor y arp -a en Windows para obtener vecinos reales.
func ParseWindowsNeighbors(gateways map[string]bool) []CandidateDevice {
	var candidates []CandidateDevice
	seenIPs := make(map[string]bool)

	// 1. Intentar PowerShell Get-NetNeighbor para obtener estados precisos
	psCmd := exec.Command("powershell", "-NoProfile", "-Command",
		"Get-NetNeighbor -AddressFamily IPv4 | Where-Object { $_.State -ne 'Unreachable' } | Select-Object IPAddress, LinkLayerAddress | ConvertTo-Csv -NoTypeInformation")
	out, err := psCmd.Output()
	if err == nil {
		scanner := bufio.NewScanner(strings.NewReader(string(out)))
		isHeader := true
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if isHeader {
				isHeader = false
				continue
			}
			parts := strings.Split(line, ",")
			if len(parts) >= 2 {
				ip := strings.Trim(parts[0], `" `)
				mac := strings.ToUpper(strings.ReplaceAll(strings.Trim(parts[1], `" `), "-", ":"))
				if isValidNetworkDevice(ip, mac) && !seenIPs[ip] {
					seenIPs[ip] = true
					candidates = append(candidates, CandidateDevice{
						IP:        ip,
						MAC:       mac,
						IsGateway: gateways[ip],
					})
				}
			}
		}
	}

	// 2. Fallback / Complemento con 'arp -a' nativo de Windows
	cmd := exec.Command("arp", "-a")
	arpOut, err := cmd.Output()
	if err == nil {
		ipRegex := regexp.MustCompile(`\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b`)
		macRegex := regexp.MustCompile(`([0-9a-fA-F]{2}[-:]){5}[0-9a-fA-F]{2}`)

		for _, line := range strings.Split(string(arpOut), "\n") {
			ip := ipRegex.FindString(line)
			macMatch := macRegex.FindString(line)
			if ip == "" || macMatch == "" {
				continue
			}
			mac := strings.ToUpper(strings.ReplaceAll(macMatch, "-", ":"))
			if isValidNetworkDevice(ip, mac) && !seenIPs[ip] {
				seenIPs[ip] = true
				candidates = append(candidates, CandidateDevice{
					IP:        ip,
					MAC:       mac,
					IsGateway: gateways[ip],
				})
			}
		}
	}

	return candidates
}

// ParseProcNetARP lee las entradas ARP del kernel de Linux.
func ParseProcNetARP(gateways map[string]bool) ([]CandidateDevice, error) {
	file, err := os.Open("/proc/net/arp")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var candidates []CandidateDevice
	scanner := bufio.NewScanner(file)
	isHeader := true

	for scanner.Scan() {
		line := scanner.Text()
		if isHeader {
			isHeader = false
			continue
		}

		fields := strings.Fields(line)
		if len(fields) >= 6 {
			ip := fields[0]
			flags := fields[2]
			mac := strings.ToUpper(fields[3])

			if flags == "0x0" || !isValidNetworkDevice(ip, mac) {
				continue
			}

			candidates = append(candidates, CandidateDevice{
				IP:        ip,
				MAC:       mac,
				IsGateway: gateways[ip],
			})
		}
	}

	return candidates, scanner.Err()
}

// isValidNetworkDevice comprueba que una IP y MAC correspondan a un dispositivo real de red (no broadcast/multicast).
func isValidNetworkDevice(ip, mac string) bool {
	if ip == "" || mac == "" {
		return false
	}
	if strings.HasSuffix(ip, ".255") || strings.HasSuffix(ip, ".0") || ip == "255.255.255.255" || ip == "127.0.0.1" {
		return false
	}
	// Ignorar rangos multicast y APIPA
	if strings.HasPrefix(ip, "224.") || strings.HasPrefix(ip, "239.") || strings.HasPrefix(ip, "169.254.") {
		return false
	}
	// Ignorar MAC broadcast y multicast
	if mac == "FF:FF:FF:FF:FF:FF" || strings.HasPrefix(mac, "01:00:5E") || mac == "00:00:00:00:00:00" || len(mac) < 17 {
		return false
	}
	return true
}

// ExecuteARPScan coordina el descubrimiento y la comprobación activa estricta antes de alistar los dispositivos.
func ExecuteARPScan(preferredIface string) ([]models.Device, error) {
	hostIfaces := GetHostInterfaces()
	gateways := GetDefaultGateways()

	// Barrido de descubrimiento en cada interfaz local activa
	for _, iface := range hostIfaces {
		log.Printf("[ARP] Barrido de descubrimiento en interfaz %s (%s)", iface.Name, iface.IP.String())
		TriggerNetworkDiscovery(iface.IP)
	}

	var candidates []CandidateDevice
	if runtime.GOOS == "windows" {
		candidates = ParseWindowsNeighbors(gateways)
	} else {
		var err error
		candidates, err = ParseProcNetARP(gateways)
		if err != nil {
			log.Printf("[ARP] /proc/net/arp error: %v", err)
		}
	}

	// Asegurarse de que el Default Gateway esté en los candidatos para ser verificado
	seenCandidates := make(map[string]bool)
	for _, c := range candidates {
		seenCandidates[c.IP] = true
	}
	for gwIP := range gateways {
		if !seenCandidates[gwIP] && isValidNetworkDevice(gwIP, "00:00:00:00:00:01") {
			candidates = append(candidates, CandidateDevice{
				IP:        gwIP,
				MAC:       "",
				IsGateway: true,
			})
			seenCandidates[gwIP] = true
		}
	}

	log.Printf("[Scanner] Candidatos detectados en red: %d. Iniciando comprobación activa antes de alistar...", len(candidates))

	var verifiedDevices []models.Device
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, 20) // Verificación concurrente eficiente

	for _, cand := range candidates {
		wg.Add(1)
		sem <- struct{}{}

		go func(c CandidateDevice) {
			defer wg.Done()
			defer func() { <-sem }()

			// COMPROBACIÓN ANTES DE ALISTAR
			vRes := VerifyDevice(c.IP, c.MAC, c.IsGateway)

			// Solo alistar si el dispositivo responde y es REAL
			if !vRes.Responsive {
				log.Printf("[Scanner] Descartando dispositivo no verificado (sin respuesta): IP=%s MAC=%s", c.IP, c.MAC)
				return
			}

			now := time.Now()
			vendor := "Dispositivo de Red LAN"
			if c.MAC != "" {
				vendor = VendorLookup(c.MAC)
			} else {
				vendor = "Router / Gateway Local"
			}

			hostname := vRes.Hostname
			if hostname == "" {
				if c.IsGateway {
					hostname = fmt.Sprintf("gateway-%s", strings.ReplaceAll(c.IP, ".", "-"))
				} else {
					hostname = fmt.Sprintf("host-%s", strings.ReplaceAll(c.IP, ".", "-"))
				}
			}

			devType := "Ethernet"
			if c.IsGateway {
				devType = "Gateway/Router"
			} else if strings.Contains(strings.ToLower(vendor), "apple") || strings.Contains(strings.ToLower(vendor), "samsung") || strings.Contains(strings.ToLower(vendor), "xiaomi") {
				devType = "Mobile"
			} else if strings.Contains(strings.ToLower(vendor), "intel") || strings.Contains(strings.ToLower(vendor), "realtek") || strings.Contains(strings.ToLower(vendor), "microsoft") || strings.Contains(strings.ToLower(vendor), "dell") || strings.Contains(strings.ToLower(vendor), "hp") {
				devType = "Workstation/PC"
			}

			macFinal := c.MAC
			if macFinal == "" {
				macFinal = fmt.Sprintf("GW:%s", strings.ReplaceAll(c.IP, ".", ":"))
			}

			servicesStr := ""
			if len(vRes.Services) > 0 {
				servicesStr = strings.Join(vRes.Services, ", ")
			}

			dev := models.Device{
				MAC:                macFinal,
				IP:                 c.IP,
				Hostname:           hostname,
				Vendor:             vendor,
				DeviceType:         devType,
				Services:           servicesStr,
				FirstSeen:          now,
				LastSeen:           now,
				Status:             "online",
				Verified:           true,
				VerificationMethod: vRes.Method,
				ResponseTimeMs:     vRes.LatencyMs,
				IsGateway:          c.IsGateway,
				LastVerifiedAt:     now,
				ChecksPassed:       vRes.ChecksPassed,
				ChecksFailed:       0,
			}

			mu.Lock()
			verifiedDevices = append(verifiedDevices, dev)
			mu.Unlock()

			log.Printf("[Scanner] (✔ COMPROBADO) IP=%s (%s) Hostname=%s Latencia=%dms Metodo=%s",
				c.IP, vendor, hostname, vRes.LatencyMs, vRes.Method)
		}(cand)
	}

	wg.Wait()

	// Incluir la propia máquina host si no está ya en la lista
	hostHostName, _ := os.Hostname()
	for _, hIface := range hostIfaces {
		alreadyPresent := false
		for _, d := range verifiedDevices {
			if d.IP == hIface.IP.String() {
				alreadyPresent = true
				break
			}
		}

		if !alreadyPresent && hIface.MAC != "" {
			now := time.Now()
			verifiedDevices = append(verifiedDevices, models.Device{
				MAC:                hIface.MAC,
				IP:                 hIface.IP.String(),
				Hostname:           hostHostName,
				Vendor:             VendorLookup(hIface.MAC),
				DeviceType:         "Workstation/PC",
				Services:           "Agente Cyberguru (8080)",
				FirstSeen:          now,
				LastSeen:           now,
				Status:             "online",
				Verified:           true,
				VerificationMethod: "Interfaz Local del Sistema",
				ResponseTimeMs:     0,
				IsGateway:          false,
				LastVerifiedAt:     now,
				ChecksPassed:       1,
				ChecksFailed:       0,
			})
			log.Printf("[Scanner] (✔ COMPROBADO) Host Local añadido: IP=%s MAC=%s Hostname=%s", hIface.IP.String(), hIface.MAC, hostHostName)
		}
	}

	log.Printf("[ARP] Escaneo finalizado. %d dispositivos REALES y COMPROBADOS alistados.", len(verifiedDevices))
	return verifiedDevices, nil
}
