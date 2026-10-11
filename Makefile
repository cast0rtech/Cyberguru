.PHONY: all build build-frontend build-backend run docker-build docker-up docker-down clean

all: build

build: build-frontend build-backend

build-frontend:
	@echo "==> Compilando Frontend (React + Vite)..."
	@cd frontend && npm install && npm run build

build-backend:
	@echo "==> Compilando Backend (Go)..."
	@mkdir -p bin
	@cd backend && go build -ldflags="-s -w" -o ../bin/cyberguru .

run: build
	@echo "==> Ejecutando Cyberguru localmente..."
	@PORT=8080 DB_PATH="./backend/data/cyberguru.db" FRONTEND_DIR="./frontend/dist" ./bin/cyberguru

docker-build:
	@echo "==> Construyendo imagen Docker multi-etapa..."
	@docker compose build

docker-up:
	@echo "==> Iniciando contenedor en modo host..."
	@docker compose up -d
	@echo "Accede en http://localhost:8080"

docker-down:
	@echo "==> Deteniendo contenedor..."
	@docker compose down

clean:
	@rm -rf bin frontend/dist frontend/node_modules
	@echo "==> Limpieza completada."
