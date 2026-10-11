package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
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
		log.Printf("[Server] Servidor web y API escuchando en http://0.0.0.0:%s", cfg.Port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[Server] Error en servidor HTTP: %v", err)
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
