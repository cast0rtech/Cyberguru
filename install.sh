#!/usr/bin/env bash
# ==============================================================================
# Cyberguru - Script de Instalación y Ejecución Local
# Autor: cast0rtech
# ==============================================================================
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "   ______      __                                   "
echo "  / ____/_  __/ /_  ___  _________ ___  ___________ "
echo " / /   / / / / __ \/ _ \/ ___/ __ \`/ / / / ___/ / / / "
echo "/ /___/ /_/ / /_/ /  __/ /  / /_/ / /_/ / /  / /_/ /  "
echo "\____/\__, /_.___/\___/_/   \__, /\__,_/_/   \__,_/   "
echo "     /____/                /____/                     "
echo -e "   Cyberguru Local Installer — by cast0rtech${NC}\n"

# 1. Comprobar si se desea instalar con Docker o Nativo
MODE="native"
if ! command -v go &> /dev/null || ! command -v npm &> /dev/null; then
    if command -v docker &> /dev/null; then
        echo -e "${YELLOW}[!] Go o Node.js no están instalados. Se usará el modo Docker.${NC}"
        MODE="docker"
    else
        echo -e "${RED}[X] Error: Se requiere Go (1.22+) y Node.js (20+), o Docker Engine para ejecutar Cyberguru.${NC}"
        echo "Instala Go y Node.js, o instala Docker: https://docs.docker.com/engine/install/"
        exit 1
    fi
fi

if [ "$1" == "--docker" ]; then
    MODE="docker"
fi

if [ "$MODE" == "docker" ]; then
    echo -e "${CYAN}[1/2] Construyendo y levantando contenedor Docker en segundo plano...${NC}"
    docker compose up --build -d
    echo -e "${GREEN}[✓] Contenedor iniciado exitosamente.${NC}"
    echo -e "${GREEN}[*] Dashboard accesible en: http://localhost:8080${NC}"
    exit 0
fi

# 2. Modo Nativo: Construcción del Frontend
echo -e "${CYAN}[1/3] Construyendo el frontend de React (Vite)...${NC}"
cd frontend
npm install
npm run build
cd ..

# 3. Compilación del Backend Go
echo -e "${CYAN}[2/3] Compilando el backend en Go...${NC}"
cd backend
mkdir -p data
go build -ldflags="-s -w" -o ../bin/cyberguru .
cd ..

# 4. Iniciar la aplicación
echo -e "${GREEN}[3/3] ¡Instalación local completada!${NC}"
echo -e "${GREEN}[*] Iniciando Cyberguru en puerto 8080...${NC}"
echo -e "${YELLOW}Presiona Ctrl+C para detener el servidor.${NC}\n"

export PORT=8080
export DB_PATH="./backend/data/cyberguru.db"
export FRONTEND_DIR="./frontend/dist"

# En Linux se recomienda ejecutar con permisos para sockets crudos (ARP)
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}[Nota] Para escaneo de paquetes crudos (ARP en interfaces físicas) se recomienda ejecutar con sudo o asignar caps:${NC}"
    echo "  sudo setcap cap_net_raw,cap_net_admin=eip ./bin/cyberguru"
fi

./bin/cyberguru
