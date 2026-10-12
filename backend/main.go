package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strconv"
	"syscall"
	"time"

	"cyberguru/api"
	"cyberguru/config"
	"cyberguru/db"
	"cyberguru/scanner"
)

func main() {
	banner := `
   ______      __                                   
  / ____/_  __/ /_  ___  _________ ___  ___________ 
 / /   / / / / __ \/ _ \/ ___/ __ ` + "`" + `/ / / / ___/ / / / 
/ /___/ /_/ / /_/ /  __/ /  / /_/ / /_/ / /  / /_/ /  
\____/\__, /_.___/\___/_/   \__, /\__,_/_/   \__,_/   
     /____/                /____/                     
    Cybersecurity Network & BLE Sensor Suite v1.0
`
	fmt.Println(banner)

	cfg := config.Load()
	log.Printf("[Init] Iniciando Cyberguru con puerto=%s, bd=%s", cfg.Port, cfg.DBPath)

	database, err := db.InitDB(cfg.DBPath)
	if err != nil {
		log.Fatalf("[Init] Error fatal iniciando base de datos SQLite: %v", err)
	}
	defer database.Close()
	log.Printf("[Init] Base de datos SQLite lista en %s", cfg.DBPath)

	engine := scanner.NewEngine(database, cfg)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Iniciar programador automático de escaneos
	engine.StartPeriodicScanning(ctx)

	// Disparar un escaneo inicial en segundo plano tras 2 segundos para poblar la red
	go func() {
		time.Sleep(2 * time.Second)
		log.Println("[Init] Disparando escaneo de descubrimiento inicial en la red local...")
		_, _ = engine.RunScan("all")
	}()

	// Comprobar puerto o asignar automáticamente uno libre
	listener, err := net.Listen("tcp", ":"+cfg.Port)
	if err != nil {
		log.Printf("[Server] Puerto %s no disponible (%v). Buscando puerto libre...", cfg.Port, err)
		basePort := 8080
		if p, errConv := strconv.Atoi(cfg.Port); errConv == nil {
			basePort = p
		}
		for offset := 1; offset <= 20; offset++ {
			candidate := strconv.Itoa(basePort + offset)
			listener, err = net.Listen("tcp", ":"+candidate)
			if err == nil {
				cfg.Port = candidate
				log.Printf("[Server] Puerto libre asignado exitosamente: %s", cfg.Port)
				break
			}
		}
		if listener == nil {
			log.Fatalf("[Server] Error fatal: No se encontró ningún puerto disponible: %v", err)
		}
	}
	defer listener.Close()

	server := api.NewServer(database, engine, cfg)
	httpServer := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      server,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Manejo de señales para apagado elegante (Graceful Shutdown)
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("[Server] Servidor web y API escuchando en http://0.0.0.0:%s (http://localhost:%s)", cfg.Port, cfg.Port)
		if err := httpServer.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[Server] Error en servidor HTTP: %v", err)
		}
	}()

	// En Windows o entorno de escritorio, abrir navegador automáticamente
	go func() {
		time.Sleep(800 * time.Millisecond)
		if os.Getenv("NO_BROWSER") == "" && !containsArg(os.Args, "--no-browser") {
			url := "http://localhost:" + cfg.Port
			log.Printf("[Desktop] Abriendo dashboard en navegador: %s", url)
			openBrowser(url)
		}
	}()

	<-stopChan
	log.Println("[Shutdown] Recibida señal de detención. Cerrando servicios...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("[Shutdown] Error cerrando servidor HTTP: %v", err)
	}

	log.Println("[Shutdown] Cyberguru detenido limpiamente.")
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", "", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	if err := cmd.Start(); err != nil {
		log.Printf("[Desktop] No se pudo lanzar navegador automáticamente: %v. Abre manualmente: %s", err, url)
	}
}

func containsArg(args []string, target string) bool {
	for _, a := range args {
		if a == target {
			return true
		}
	}
	return false
}
