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

// SNMPResult almacena la información recuperada de un dispositivo mediante SNMP.
type SNMPResult struct {
	IP          string
	SysDescr    string
	SysName     string
	Responsive  bool
	Community   string
}

// buildSNMPv2cGetRequest crea un paquete ASN.1 BER SNMP v2c GetRequest
// consultando sysDescr (1.3.6.1.2.1.1.1.0).
func buildSNMPv2cGetRequest(community string) []byte {
	// Paquete precalculado para sysDescr con comunidad parametrizable
	commBytes := []byte(community)
	commLen := byte(len(commBytes))

	// PDU Variable Binding para OID 1.3.6.1.2.1.1.1.0 (iso.org.dod.internet.mgmt.mib-2.system.sysDescr.0)
	varBind := []byte{
		0x30, 0x0f, // VarBind sequence
		0x06, 0x08, // OID tag + len
		0x2b, 0x06, 0x01, 0x02, 0x01, 0x01, 0x01, 0x00, // 1.3.6.1.2.1.1.1.0
		0x05, 0x00, // Null value tag
	}

	varBindList := append([]byte{0x30, byte(len(varBind))}, varBind...)

	// GetRequest-PDU (tag 0xa0)
	pduHeader := []byte{
		0x02, 0x04, 0x12, 0x34, 0x56, 0x78, // Request-ID
		0x02, 0x01, 0x00,                   // Error-status: 0
		0x02, 0x01, 0x00,                   // Error-index: 0
	}
	pduBody := append(pduHeader, varBindList...)
	pdu := append([]byte{0xa0, byte(len(pduBody))}, pduBody...)

	// SNMP Message Header
	// Version: v2c (1)
	version := []byte{0x02, 0x01, 0x01}
	comm := append([]byte{0x04, commLen}, commBytes...)

	msgBody := append(version, comm...)
	msgBody = append(msgBody, pdu...)

	message := append([]byte{0x30, byte(len(msgBody))}, msgBody...)
	return message
}

// extractPrintableStrings extrae cadenas de texto legibles de una respuesta ASN.1
func extractPrintableStrings(payload []byte) string {
	var words []string
	var current strings.Builder

	for _, b := range payload {
		if (b >= 32 && b <= 126) || b == '\n' || b == '\r' || b == '\t' {
			current.WriteByte(b)
		} else {
			if current.Len() > 3 {
				words = append(words, strings.TrimSpace(current.String()))
			}
			current.Reset()
		}
	}
	if current.Len() > 3 {
		words = append(words, strings.TrimSpace(current.String()))
	}

	// Filtra palabras reservadas del protocolo
	var filtered []string
	for _, w := range words {
		if w != "public" && !strings.Contains(w, "\x00") && len(w) > 4 {
			filtered = append(filtered, w)
		}
	}

	if len(filtered) > 0 {
		return strings.Join(filtered, " ")
	}
	return "Dispositivo SNMP Activo"
}

// ProbeSNMP realiza una consulta SNMP v2c a una IP específica en el puerto 161.
func ProbeSNMP(ip string, community string, timeout time.Duration) (*SNMPResult, error) {
	target := fmt.Sprintf("%s:161", ip)
	conn, err := net.DialTimeout("udp", target, timeout)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	_ = conn.SetDeadline(time.Now().Add(timeout))

	req := buildSNMPv2cGetRequest(community)
	if _, err := conn.Write(req); err != nil {
		return nil, err
	}

	buf := make([]byte, 2048)
	n, err := conn.Read(buf)
	if err != nil {
		return nil, err // Timeout o no responde
	}

	descr := extractPrintableStrings(buf[:n])

	return &SNMPResult{
		IP:         ip,
		SysDescr:   descr,
		Responsive: true,
		Community:  community,
	}, nil
}

// ExecuteSNMPScan ejecuta sondeos SNMP concurrentes sobre la lista de IPs descubiertas.
func ExecuteSNMPScan(targetIPs []string) map[string]*SNMPResult {
	results := make(map[string]*SNMPResult)
	var mu sync.Mutex
	var wg sync.WaitGroup

	sem := make(chan struct{}, 25)
	timeout := 800 * time.Millisecond

	for _, ip := range targetIPs {
		if ip == "" || ip == "0.0.0.0" {
			continue
		}

		wg.Add(1)
		sem <- struct{}{}

		go func(targetIP string) {
			defer wg.Done()
			defer func() { <-sem }()

			res, err := ProbeSNMP(targetIP, "public", timeout)
			if err == nil && res != nil && res.Responsive {
				mu.Lock()
				results[targetIP] = res
				mu.Unlock()
				log.Printf("[SNMP] Dispositivo con SNMP activo detectado en %s: %s", targetIP, res.SysDescr)
			}
		}(ip)
	}

	wg.Wait()
	return results
}

// CheckSNMPAlerts genera alertas para dispositivos que tienen SNMP abierto con comunidad por defecto.
func CheckSNMPAlerts(res *SNMPResult, device *models.Device) *models.Alert {
	if res == nil || !res.Responsive {
		return nil
	}

	return &models.Alert{
		DeviceID:     &device.ID,
		Severity:     "warning",
		Title:        fmt.Sprintf("SNMP Inseguro en %s", device.IP),
		Description:  fmt.Sprintf("El dispositivo %s (%s) tiene habilitado SNMP v2c con la comunidad pública ('public'). SysDescr: %s", device.IP, device.Hostname, res.SysDescr),
		Timestamp:    time.Now(),
		Acknowledged: false,
	}
}
