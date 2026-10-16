package scanner

import (
	"context"
	"fmt"
	"net"
	"os/exec"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

// VerificationResult contiene el resultado de la comprobación activa de un dispositivo.
type VerificationResult struct {
	Responsive   bool
	LatencyMs    int
	Method       string
	Services     []string
	Hostname     string
	IsGateway    bool
	ChecksPassed int
	ChecksFailed int
}

var pingTimeRegex = regexp.MustCompile(`(?:Zeit|time|tiempo)[=<]([\d]+)\s*ms`)

// PingHost ejecuta un ping ICMP nativo con timeout estricto para comprobar que el host es real.
func PingHost(ip string, timeoutMs int) (bool, int) {
	if timeoutMs <= 0 {
		timeoutMs = 600
	}

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("ping", "-n", "1", "-w", strconv.Itoa(timeoutMs), ip)
	} else {
		timeoutSec := strconv.Itoa((timeoutMs + 999) / 1000)
		cmd = exec.Command("ping", "-c", "1", "-W", timeoutSec, ip)
	}

	start := time.Now()
	out, err := cmd.Output()
	elapsed := time.Since(start)

	if err == nil {
		outStr := string(out)
		matches := pingTimeRegex.FindStringSubmatch(outStr)
		if len(matches) > 1 {
			if ms, err := strconv.Atoi(matches[1]); err == nil {
				return true, ms
			}
		}
		latency := int(elapsed.Milliseconds())
		if latency < 1 {
			latency = 1
		}
		return true, latency
	}

	return false, 0
}

// ProbeTCPPorts sondea puertos comunes en paralelo para detectar servicios activos y confirmar vida del host.
func ProbeTCPPorts(ip string, timeout time.Duration) ([]string, int, bool) {
	ports := []struct {
		port int
		name string
	}{
		{53, "DNS (53)"},
		{80, "HTTP (80)"},
		{443, "HTTPS (443)"},
		{445, "SMB (445)"},
		{135, "RPC (135)"},
		{22, "SSH (22)"},
		{8080, "HTTP-Alt (8080)"},
		{554, "RTSP (554)"},
		{5000, "Web-GUI (5000)"},
		{3389, "RDP (3389)"},
		{1883, "MQTT (1883)"},
	}

	type portRes struct {
		name    string
		latency int
		success bool
	}

	resChan := make(chan portRes, len(ports))
	var wg sync.WaitGroup

	for _, p := range ports {
		wg.Add(1)
		go func(portNum int, portName string) {
			defer wg.Done()
			addr := net.JoinHostPort(ip, fmt.Sprintf("%d", portNum))
			t0 := time.Now()
			conn, err := net.DialTimeout("tcp", addr, timeout)
			lat := int(time.Since(t0).Milliseconds())
			if lat < 1 {
				lat = 1
			}

			if err == nil {
				_ = conn.Close()
				resChan <- portRes{name: portName, latency: lat, success: true}
				return
			}

			// Si el error es "connection refused" / RST, significa que el host ESTÁ VIVO en esa IP
			errStr := strings.ToLower(err.Error())
			if strings.Contains(errStr, "refused") || strings.Contains(errStr, "rechazada") || strings.Contains(errStr, "reset") {
				resChan <- portRes{name: "", latency: lat, success: true}
				return
			}

			resChan <- portRes{name: "", latency: 0, success: false}
		}(p.port, p.name)
	}

	wg.Wait()
	close(resChan)

	var activeServices []string
	bestLatency := 9999
	anyAlive := false

	for res := range resChan {
		if res.success {
			anyAlive = true
			if res.latency > 0 && res.latency < bestLatency {
				bestLatency = res.latency
			}
			if res.name != "" {
				activeServices = append(activeServices, res.name)
			}
		}
	}

	if bestLatency == 9999 {
		bestLatency = 0
	}

	return activeServices, bestLatency, anyAlive
}

// GetDefaultGateways detecta las puertas de enlace configuradas en el sistema.
func GetDefaultGateways() map[string]bool {
	gateways := make(map[string]bool)

	if runtime.GOOS == "windows" {
		cmd := exec.Command("powershell", "-NoProfile", "-Command", "Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Select-Object -ExpandProperty NextHop")
		out, err := cmd.Output()
		if err == nil {
			lines := strings.Split(string(out), "\n")
			for _, line := range lines {
				ip := strings.TrimSpace(line)
				if ip != "" && ip != "0.0.0.0" {
					gateways[ip] = true
				}
			}
		}
	} else {
		cmd := exec.Command("ip", "route", "show", "default")
		out, err := cmd.Output()
		if err == nil {
			fields := strings.Fields(string(out))
			for i, f := range fields {
				if f == "via" && i+1 < len(fields) {
					gateways[fields[i+1]] = true
				}
			}
		}
	}

	return gateways
}

// VerifyDevice ejecuta la comprobación completa antes de permitir registrar un dispositivo en el inventario.
func VerifyDevice(ip string, mac string, isKnownGateway bool) VerificationResult {
	res := VerificationResult{
		Responsive: false,
		IsGateway:  isKnownGateway,
	}

	if ip == "" || ip == "0.0.0.0" || ip == "127.0.0.1" || strings.HasPrefix(ip, "169.254.") {
		res.ChecksFailed = 1
		return res
	}

	// 1. Comprobación Ping ICMP
	pingOk, pingLatency := PingHost(ip, 700)
	if pingOk {
		res.Responsive = true
		res.LatencyMs = pingLatency
		res.Method = fmt.Sprintf("ICMP Ping (%dms)", pingLatency)
		res.ChecksPassed++
	}

	// 2. Comprobación de Sockets TCP y detección de servicios
	services, tcpLatency, tcpAlive := ProbeTCPPorts(ip, 350*time.Millisecond)
	if tcpAlive {
		res.Responsive = true
		if res.LatencyMs == 0 || (tcpLatency > 0 && tcpLatency < res.LatencyMs) {
			res.LatencyMs = tcpLatency
		}
		if res.Method == "" {
			res.Method = fmt.Sprintf("TCP Probe (%dms)", tcpLatency)
		}
		res.Services = services
		res.ChecksPassed++
	}

	// Si no responde ni a ICMP ni a TCP, pero es el Default Gateway confirmado del SO, tiene comprobación por enrutamiento L3
	if !res.Responsive && isKnownGateway {
		res.Responsive = true
		res.LatencyMs = 5
		res.Method = "Gateway de Red del Sistema"
		res.ChecksPassed++
	}

	if !res.Responsive {
		res.ChecksFailed++
		return res
	}

	// 3. Resolución inversa de nombre DNS (Hostname real)
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	var r net.Resolver
	names, err := r.LookupAddr(ctx, ip)
	if err == nil && len(names) > 0 {
		res.Hostname = strings.TrimSuffix(names[0], ".")
	}

	return res
}
