package api

import (
	"embed"
	"io/fs"
	"log"
)

//go:embed all:dist
var distEmbedFS embed.FS

// getStaticFS devuelve el sistema de archivos embebido de la SPA React.
func getStaticFS() fs.FS {
	sub, err := fs.Sub(distEmbedFS, "dist")
	if err != nil {
		log.Printf("[Static] Error extrayendo sub-directorio dist embebido: %v", err)
		return distEmbedFS
	}
	return sub
}
