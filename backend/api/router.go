package api

import (
	"encoding/json"
	"io"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"cyberguru/config"
	"cyberguru/db"
	"cyberguru/models"
	"cyberguru/scanner"
)

type Server struct {
	database   *db.Database
	scanner    *scanner.Engine
	cfg        *config.Config
	mux        *http.ServeMux
	started    time.Time
	embeddedFS fs.FS
}

func NewServer(database *db.Database, engine *scanner.Engine, cfg *config.Config) *Server {
	s := &Server{
		database:   database,
		scanner:    engine,
		cfg:        cfg,
		mux:        http.NewServeMux(),
		started:    time.Now(),
		embeddedFS: getStaticFS(),
	}

	s.registerRoutes()
	return s
}

func (s *Server) registerRoutes() {
	// API Endpoints
	s.mux.HandleFunc("/api/health", s.handleHealth)
	s.mux.HandleFunc("/api/stats", s.handleStats)
	s.mux.HandleFunc("/api/stats/history", s.handleStatsHistory)
	s.mux.HandleFunc("/api/devices", s.handleDevices)
	s.mux.HandleFunc("/api/devices/", s.handleDeviceActions)
	s.mux.HandleFunc("/api/alerts", s.handleAlerts)
	s.mux.HandleFunc("/api/alerts/", s.handleAlertAction)
	s.mux.HandleFunc("/api/scan", s.handleScan)
	s.mux.HandleFunc("/api/cleanup-fake", s.handleCleanupFake)

	// Servidor de archivos estáticos para la SPA de React
	s.mux.HandleFunc("/", s.handleStaticFiles)
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Cabeceras de seguridad y CORS para entorno de desarrollo
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Logging ligero de peticiones API
	if strings.HasPrefix(r.URL.Path, "/api/") {
		log.Printf("[HTTP] %s %s", r.Method, r.URL.Path)
	}

	s.mux.ServeHTTP(w, r)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	resp := map[string]interface{}{
		"status":      "operational",
		"service":     "Cyberguru Security Agent",
		"version":     "1.0.0",
		"uptime_sec":  int(time.Since(s.started).Seconds()),
		"is_scanning": s.scanner.IsScanning(),
		"db_ok":       true,
	}

	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	stats, err := s.database.GetStats()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, stats)
}

func (s *Server) handleDevices(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	query := r.URL.Query()
	devType := query.Get("type")
	status := query.Get("status")

	devices, err := s.database.GetDevices(devType, status)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if devices == nil {
		devices = []models.Device{}
	}

	writeJSON(w, http.StatusOK, devices)
}

func (s *Server) handleStatsHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	history, err := s.database.GetStatsHistory(limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if history == nil {
		history = []models.NetworkStatsSnapshot{}
	}

	writeJSON(w, http.StatusOK, history)
}

func (s *Server) handleDeviceActions(w http.ResponseWriter, r *http.Request) {
	subpath := strings.TrimPrefix(r.URL.Path, "/api/devices/")
	parts := strings.Split(subpath, "/")
	if len(parts) < 2 {
		http.Error(w, "Ruta no encontrada", http.StatusNotFound)
		return
	}

	id, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		http.Error(w, "ID de dispositivo inválido", http.StatusBadRequest)
		return
	}

	action := parts[1]

	switch action {
	case "verify":
		if r.Method != http.MethodPost {
			http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
			return
		}

		dev, err := s.database.GetDeviceByID(id)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Dispositivo no encontrado"})
			return
		}

		// Ejecutar comprobación activa en tiempo real
		vRes := scanner.VerifyDevice(dev.IP, dev.MAC, dev.IsGateway)
		now := time.Now()
		dev.LastSeen = now
		dev.LastVerifiedAt = now

		if vRes.Responsive {
			dev.Status = "online"
			dev.Verified = true
			dev.VerificationMethod = vRes.Method
			dev.ResponseTimeMs = vRes.LatencyMs
			dev.ChecksPassed++
			if vRes.Hostname != "" && (dev.Hostname == "" || strings.HasPrefix(dev.Hostname, "host-")) {
				dev.Hostname = vRes.Hostname
			}
			if len(vRes.Services) > 0 {
				dev.Services = strings.Join(vRes.Services, ", ")
			}
		} else {
			dev.Status = "offline"
			dev.ChecksFailed++
			dev.ResponseTimeMs = 0
		}

		_, err = s.database.UpsertDevice(dev)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success":    true,
			"device":     dev,
			"responsive": vRes.Responsive,
			"method":     vRes.Method,
			"latency_ms": vRes.LatencyMs,
		})

	case "events":
		if r.Method != http.MethodGet {
			http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
			return
		}

		events, err := s.database.GetDeviceEvents(id, 30)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if events == nil {
			events = []models.DeviceEvent{}
		}

		writeJSON(w, http.StatusOK, events)

	default:
		http.Error(w, "Acción no reconocida", http.StatusNotFound)
	}
}

func (s *Server) handleCleanupFake(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	if err := s.database.PurgeMockDevices(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "success",
		"message": "Dispositivos de prueba y datos simulados eliminados exitosamente. Inventario limpio.",
	})
}

func (s *Server) handleAlerts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	onlyPending := r.URL.Query().Get("pending") == "true"
	alerts, err := s.database.GetAlerts(onlyPending)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if alerts == nil {
		alerts = []models.Alert{}
	}

	writeJSON(w, http.StatusOK, alerts)
}

func (s *Server) handleAlertAction(w http.ResponseWriter, r *http.Request) {
	// Espera ruta: /api/alerts/{id}/ack
	path := strings.TrimPrefix(r.URL.Path, "/api/alerts/")
	parts := strings.Split(path, "/")

	if len(parts) >= 2 && parts[1] == "ack" && r.Method == http.MethodPost {
		id, err := strconv.ParseInt(parts[0], 10, 64)
		if err != nil {
			http.Error(w, "ID de alerta inválido", http.StatusBadRequest)
			return
		}

		if err := s.database.AcknowledgeAlert(id); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "alert_acknowledged"})
		return
	}

	http.Error(w, "Ruta no encontrada", http.StatusNotFound)
}

func (s *Server) handleScan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req models.ScanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ScanType == "" {
		req.ScanType = "all"
	}

	history, err := s.scanner.RunScan(req.ScanType)
	if err != nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, history)
}

func init() {
	_ = mime.AddExtensionType(".js", "application/javascript")
	_ = mime.AddExtensionType(".mjs", "application/javascript")
	_ = mime.AddExtensionType(".css", "text/css")
	_ = mime.AddExtensionType(".svg", "image/svg+xml")
	_ = mime.AddExtensionType(".png", "image/png")
	_ = mime.AddExtensionType(".ico", "image/x-icon")
	_ = mime.AddExtensionType(".json", "application/json")
}

// handleStaticFiles sirve los archivos estáticos de la SPA de React o un dashboard integrado de fallback
func (s *Server) handleStaticFiles(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") {
		http.NotFound(w, r)
		return
	}

	// 1. Probar primero si se especificó un directorio en disco existente
	distDir := s.cfg.FrontendDir
	if distDir != "" {
		if _, err := os.Stat(distDir); err == nil {
			filePath := filepath.Join(distDir, filepath.Clean(r.URL.Path))
			info, err := os.Stat(filePath)
			if err == nil && !info.IsDir() {
				http.ServeFile(w, r, filePath)
				return
			}

			// Si es una ruta de navegación SPA, servir index.html del disco
			indexPath := filepath.Join(distDir, "index.html")
			if _, err := os.Stat(indexPath); err == nil {
				http.ServeFile(w, r, indexPath)
				return
			}
		}
	}

	// 2. Servir desde el sistema de archivos embebido en el binario (100% portable)
	if s.embeddedFS != nil {
		reqPath := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		reqPath = strings.ReplaceAll(reqPath, "\\", "/")
		if reqPath == "" || reqPath == "." {
			reqPath = "index.html"
		}

		if f, err := s.embeddedFS.Open(reqPath); err == nil {
			stat, _ := f.Stat()
			if stat != nil && !stat.IsDir() {
				_ = f.Close()
				http.FileServer(http.FS(s.embeddedFS)).ServeHTTP(w, r)
				return
			}
			_ = f.Close()
		}

		// Fallback para Client-Side Routing en React: servir index.html embebido
		if indexFile, err := s.embeddedFS.Open("index.html"); err == nil {
			data, err := io.ReadAll(indexFile)
			_ = indexFile.Close()
			if err == nil {
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write(data)
				return
			}
		}
	}

	// 3. Fallback informativo si aún no se ha compilado el frontend
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`
		<!DOCTYPE html>
		<html lang="es">
		<head>
			<meta charset="UTF-8">
			<title>Cyberguru - Security Suite</title>
			<style>
				body { background: #0b0f19; color: #00f2fe; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
				.card { background: #111827; border: 1px solid #1e293b; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 242, 254, 0.2); max-width: 500px; text-align: center; }
				h1 { color: #38bdf8; margin-bottom: 0.5rem; }
				p { color: #94a3b8; line-height: 1.5; }
				a { color: #4ade80; text-decoration: none; font-weight: bold; }
			</style>
		</head>
		<body>
			<div class="card">
				<h1>🛡️ Cyberguru Core Backend</h1>
				<p>El backend de ciberseguridad está activo en el puerto 8080.</p>
				<p>El frontend se está cargando o no se encontró en <code>` + distDir + `</code>.</p>
				<p><a href="/api/health">Consultar Estado de la API</a> | <a href="/api/stats">Ver Métricas</a></p>
			</div>
		</body>
		</html>
	`))
}
