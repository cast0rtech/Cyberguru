# 📘 Guía de Desarrollo — Cyberguru

**Autor:** `cast0rtech`  
**Versión:** 1.0.0  
**Proyecto:** Cyberguru Security Suite  

Guía técnica paso a paso para desarrollar, extender, depurar y mantener la plataforma de ciberseguridad **Cyberguru**.

---

## 📋 Índice

1. [Preparación del entorno](#1-preparación-del-entorno)
2. [Estructura del proyecto](#2-estructura-del-proyecto)
3. [Configuración de Docker](#3-configuración-de-docker)
4. [Backend (Go)](#4-backend-go)
5. [Frontend (React + Vite)](#5-frontend-react--vite)
6. [Base de datos (SQLite)](#6-base-de-datos-sqlite)
7. [Sensores y escaneo (ARP, SNMP, BLE)](#7-sensores-y-escaneo-arp-snmp-ble)
8. [Testing y verificación](#8-testing-y-verificación)
9. [Despliegue y producción](#9-despliegue-y-producción)
10. [Troubleshooting y resolución de problemas](#10-troubleshooting-y-resolución-de-problemas)

---

## 1. Preparación del entorno

### 1.1 Linux (Entorno de producción y pruebas recomendado)

Linux es el sistema óptimo debido a que `network_mode: host` interactúa directamente con la pila del kernel para la captura ARP y los sockets raw.

```bash
# 1. Actualizar repositorios e instalar paquetes básicos
sudo apt update && sudo apt install -y curl git iproute2 net-tools bluez

# 2. Instalar Docker Engine oficial
curl -fsSL https://get.docker.com | sh

# 3. Asignar permisos al usuario actual para operar sin sudo
sudo usermod -aG docker $USER
newgrp docker

# 4. Instalar Docker Compose Plugin
sudo apt install -y docker-compose-plugin

# 5. (Opcional para desarrollo local sin Docker)
sudo apt install -y golang-go nodejs npm
```

### 1.2 Windows (Desarrollo con Docker Desktop & WSL2)

1. Instalar **Docker Desktop para Windows** con el backend de **WSL2** activado.
2. Asegurarse de tener habilitada la característica de *Host Networking* en la configuración de Docker Desktop si se desea acceso directo a interfaces LAN.
3. Node.js (v20+) y npm (v10+) instalados para depurar el frontend localmente.

### 1.3 Herramientas de Desarrollo Opcionales
- **Go:** Versión `1.22+` (recomendado para desarrollo nativo).
- **Node.js:** Versión `20 LTS` o superior.
- **SQLite CLI:** Para inspección manual del archivo de base de datos (`sqlite3`).

---

## 2. Estructura del proyecto

El repositorio está organizado de forma desacoplada para facilitar el desarrollo independiente de cada componente:

```text
Cyberguru/
├── Dockerfile                  # Construcción multi-etapa optimizada (Node -> Go -> Alpine)
├── docker-compose.yml          # Configuración con network_mode: host y volúmenes
├── .dockerignore               # Filtro de archivos para optimizar el contexto de Docker
├── README.md                   # Resumen del proyecto y arquitectura de alto nivel
├── GUIA.md                     # Guía técnica completa para desarrolladores
│
├── backend/                    # Core del agente de ciberseguridad (Go 1.22)
│   ├── go.mod                  # Declaración del módulo y dependencias
│   ├── go.sum                  # Checksums de paquetes Go
│   ├── main.go                 # Punto de entrada, banner, servidor HTTP y graceful shutdown
│   ├── config/
│   │   └── config.go           # Parámetros configurables vía variables de entorno
│   ├── models/
│   │   └── models.go           # Estructuras de datos (Device, Alert, ScanHistory, Stats)
│   ├── db/
│   │   └── database.go         # Conexión, migraciones automáticas y queries SQLite
│   ├── scanner/
│   │   ├── scanner.go          # Orquestador del ciclo de escaneo concurrente
│   │   ├── arp.go              # Resolución de subred, barrido ARP y lookup OUI
│   │   ├── snmp.go             # Sondeo UDP 161 (SNMP v1/v2c) para switches/routers
│   │   └── ble.go              # Detección de balizas Bluetooth Low Energy (BlueZ/HCI)
│   └── api/
│       └── router.go           # Rutas REST (/api/*) y FileServer de la SPA
│
└── frontend/                   # Dashboard moderno estilo SOC (React 18 + Vite)
    ├── package.json            # Scripts de construcción y dependencias npm
    ├── vite.config.js          # Configuración de empaquetado y proxy hacia :8080
    ├── index.html              # Plantilla HTML con tipografía Inter y JetBrains Mono
    └── src/
        ├── main.jsx            # Punto de montaje en el DOM
        ├── App.jsx             # Vista principal, sincronización y polling
        ├── index.css           # Tokens de diseño, modo oscuro y animaciones neón
        └── components/
            ├── Icons.jsx       # Iconografía SVG pura (sin dependencias externas)
            ├── Header.jsx      # Indicadores de estado de red y reloj en vivo
            ├── MetricCard.jsx  # Indicadores clave tipo glassmorphism
            ├── ScannerPanel.jsx# Disparadores manuales de escaneo
            ├── DeviceTable.jsx # Inventario con buscador en tiempo real y filtros
            └── AlertFeed.jsx   # Gestor de incidentes con resolución de alertas
```

---

## 3. Configuración de Docker

### 3.1 Dockerfile Multi-Etapa

El archivo [Dockerfile](file:///c:/Users/castor/Desktop/Cyberguru/Dockerfile) divide la compilación en tres fases aisladas para garantizar una imagen de producción final de menos de **50 MB**:

1. **Etapa 1 (`frontend-builder`):**  
   Utiliza `node:20-alpine`, instala dependencias con `npm install` y genera los artefactos estáticos optimizados mediante `npm run build` en `/app/frontend/dist`.
2. **Etapa 2 (`backend-builder`):**  
   Emplea `golang:1.22-alpine` para compilar el código de Go. Se utiliza la bandera `CGO_ENABLED=0` y `-ldflags="-s -w"` para generar un binario completamente estático, desprovisto de tablas de depuración y dependencias dinámicas.
3. **Etapa 3 (`runtime`):**  
   Basada en `alpine:3.20`. Solo incluye los paquetes de sistema esenciales (`ca-certificates`, `sqlite-libs`, `iproute2`, `net-tools`, `bluez`, `libpcap`). Copia el binario compilado y la carpeta de frontend generada.

### 3.2 docker-compose.yml y Permisos de Red

El archivo [docker-compose.yml](file:///c:/Users/castor/Desktop/Cyberguru/docker-compose.yml) incluye los parámetros indispensables para operaciones de ciberseguridad:

```yaml
services:
  cyberguru:
    build:
      context: .
      dockerfile: Dockerfile
    image: cyberguru:latest
    container_name: cyberguru
    network_mode: host
    restart: unless-stopped
    cap_add:
      - NET_ADMIN
      - NET_RAW
    volumes:
      - cyberguru_data:/app/data
    environment:
      - PORT=8080
      - DB_PATH=/app/data/cyberguru.db
      - FRONTEND_DIR=/app/frontend/dist
      - SCAN_INTERVAL_MIN=5
      - SIMULATE_BLE_IF_ABSENT=true

volumes:
  cyberguru_data:
    driver: local
```

#### Aspectos Críticos:
- **`network_mode: host`:** Elimina el aislamiento de red del contenedor. Esto permite que el backend envíe y reciba paquetes ARP broadcast en la LAN física del host. En este modo, no se utiliza la directiva `ports:`, ya que el puerto `8080` se abre directamente en la IP del host.
- **`cap_add: [NET_ADMIN, NET_RAW]`:** Otorga privilegios a nivel de kernel para manipular interfaces y abrir raw sockets.
- **Volumen `cyberguru_data`:** Garantiza que los registros históricos y las alertas en SQLite permanezcan intactos tras reiniciar el contenedor.

---

## 4. Backend (Go)

### 4.1 Ciclo de Vida del Servidor
En [backend/main.go](file:///c:/Users/castor/Desktop/Cyberguru/backend/main.go):
1. **Inicialización:** Carga la configuración desde las variables de entorno mediante `config.Load()`.
2. **Base de Datos:** Abre la base de datos SQLite y ejecuta migraciones iniciales.
3. **Planificador:** Lanza el motor de escaneo periódico en una goroutine con `context.WithCancel`.
4. **Servidor HTTP:** Escucha en `0.0.0.0:8080` con timeouts configurados.
5. **Graceful Shutdown:** Captura `SIGINT` y `SIGTERM` para cerrar conexiones y flush de la base de datos en menos de 5 segundos.

### 4.2 API REST

Los endpoints definidos en [backend/api/router.go](file:///c:/Users/castor/Desktop/Cyberguru/backend/api/router.go) son:

- `GET /api/health`: Estado general del agente, uptime y estado de escaneo activo.
- `GET /api/stats`: Resumen cuantitativo para los paneles del dashboard.
- `GET /api/devices`: Listado de dispositivos con filtros opcionales (`?type=SNMP&status=online`).
- `GET /api/alerts`: Listado de alertas (`?pending=true` para mostrar solo no resueltas).
- `POST /api/alerts/{id}/ack`: Marca una alerta como resuelta.
- `POST /api/scan`: Inicia un escaneo bajo demanda. Acepta JSON:
  ```json
  { "scan_type": "all" } // Opciones: "arp", "snmp", "ble", "all"
  ```
- `GET /*`: Servidor de archivos estáticos que sirve la SPA de React con fallback a `index.html`.

---

## 5. Frontend (React + Vite)

### 5.1 Sistema de Diseño
El dashboard utiliza un diseño oscuro inspirado en consolas SOC:
- **Fondo:** `#070a12` con gradientes radiales sutiles y cuadrícula de seguridad.
- **Paneles Glassmorphism:** Fondo translúcido `rgba(15, 23, 42, 0.75)` con desenfoque de fondo (`backdrop-filter: blur(12px)`) y bordes `#1e293b`.
- **Acentos:**
  - Cian neón (`#00f2fe`) para elementos primarios y tecnología activa.
  - Esmeralda (`#10b981`) para estado online y balizas BLE.
  - Ámbar (`#f59e0b`) para alertas de advertencia y servicios SNMP.
  - Rosa/Rojo (`#f43f5e`) para alertas críticas y de peligro.
- **Tipografía:** `Inter` para texto de interfaz y `JetBrains Mono` para direcciones IP, MAC y métricas.

### 5.2 Desarrollo Local del Frontend
Para trabajar en la interfaz con recarga rápida (HMR):
```bash
cd frontend
npm install
npm run dev
```
La configuración de [frontend/vite.config.js](file:///c:/Users/castor/Desktop/Cyberguru/frontend/vite.config.js) reenviará automáticamente todas las peticiones a `/api` hacia `http://localhost:8080`.

---

## 6. Base de Datos (SQLite)

### 6.1 Driver y Modo WAL
Se utiliza el driver puro en Go `modernc.org/sqlite`. La conexión se inicializa con:
```go
conn, err := sql.Open("sqlite", dbPath+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
```
- **Modo WAL (Write-Ahead Logging):** Permite lecturas y escrituras concurrentes sin bloqueos.
- **Busy Timeout:** Evita errores de `database is locked` ante transacciones simultáneas del escáner y la API.

### 6.2 Esquema Relacional

```sql
-- Dispositivos inventariados
CREATE TABLE devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mac TEXT UNIQUE,
    ip TEXT,
    hostname TEXT,
    vendor TEXT,
    device_type TEXT, -- "Ethernet", "WiFi", "SNMP", "BLE"
    os_info TEXT,
    first_seen DATETIME,
    last_seen DATETIME,
    status TEXT,      -- "online", "offline"
    rssi INTEGER DEFAULT 0,
    snmp_enabled BOOLEAN DEFAULT 0
);

-- Alertas de seguridad
CREATE TABLE alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER,
    severity TEXT,    -- "info", "warning", "danger"
    title TEXT,
    description TEXT,
    timestamp DATETIME,
    acknowledged BOOLEAN DEFAULT 0,
    FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Historial de ejecuciones de escaneo
CREATE TABLE scan_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_type TEXT,
    started_at DATETIME,
    finished_at DATETIME,
    devices_found INTEGER,
    status TEXT,
    details TEXT
);
```

---

## 7. Sensores y Escaneo (ARP, SNMP, BLE)

### 7.1 Escaneo ARP ([backend/scanner/arp.go](file:///c:/Users/castor/Desktop/Cyberguru/backend/scanner/arp.go))
1. **Detección de Interfaz y Subred:** Detecta la interfaz de red activa y su dirección IPv4 (ej. `192.168.1.100/24`).
2. **Barrido de Provocación:** Emite paquetes UDP rápidos a través de 50 goroutines concurrentes hacia cada dirección del rango `/24` (`1` a `254`). Esto hace que el kernel de Linux emita peticiones de broadcast ARP para resolver las direcciones físicas.
3. **Parseo de `/proc/net/arp`:** Lee las entradas del kernel para extraer IP, MAC e interfaz.
4. **Lookup OUI:** Compara los primeros 3 octetos de la MAC contra una tabla de fabricantes conocidos (Cisco, Apple, Raspberry Pi, Espressif, Ubiquiti, etc.).
5. **Detección de Nuevos Equipos:** Si una MAC no existía previamente en la base de datos, levanta una alerta informativa inmediata.

### 7.2 Sondeo SNMP ([backend/scanner/snmp.go](file:///c:/Users/castor/Desktop/Cyberguru/backend/scanner/snmp.go))
1. **Paquete ASN.1/BER Nativo:** Construye una petición `GetRequest` en SNMP v2c para consultar el OID `1.3.6.1.2.1.1.1.0` (`sysDescr`).
2. **Sondeo UDP 161 Concurrente:** Envía la consulta a todas las IPs activas descubiertas con timeout estricto de 800 ms.
3. **Alerta de Vulnerabilidad:** Si un switch, router o equipo responde a la comunidad por defecto `public`, se actualiza el dispositivo como `snmp_enabled = true` y se registra una alerta de severidad `warning`.

### 7.3 Sensor de Proximidad BLE ([backend/scanner/ble.go](file:///c:/Users/castor/Desktop/Cyberguru/backend/scanner/ble.go))
1. **Detección de Hardware:** Verifica la presencia de controladores Bluetooth en `/sys/class/bluetooth` o mediante `bluetoothctl`.
2. **Intercepción de Balizas:** Lee dispositivos BLE y calcula el nivel de señal RSSI (en dBm).
3. **Modo Simulado / Fallback:** Si el host no dispone de adaptador físico BLE (o se ejecuta en una máquina virtual sin passthrough USB), activa de forma transparente telemetría demostrativa para permitir evaluar la interfaz y las alertas sin interrumpir la ejecución.

---

## 8. Testing y Verificación

### 8.1 Verificación de Compilación del Frontend
```bash
cd frontend
npm run build
```
Debe generar los archivos en `dist/` sin advertencias de sintaxis.

### 8.2 Compilación del Backend en Go
```bash
cd backend
go build -v -o cyberguru .
```

### 8.3 Verificación de la Construcción Docker
```bash
docker build -t cyberguru:test .
```

---

## 9. Despliegue y Producción

### 9.1 Puesta en Marcha
```bash
# Iniciar en segundo plano
docker-compose up --build -d

# Visualizar logs del contenedor
docker-compose logs -f cyberguru
```

### 9.2 Monitorización de Recursos
```bash
docker stats cyberguru
```
El consumo típico en reposo es de:
- **CPU:** < 0.5%
- **Memoria RAM:** ~20 MB a 35 MB

### 9.3 Copias de Seguridad de la Base de Datos
La base de datos SQLite reside en el volumen Docker `cyberguru_data`. Para hacer una copia de seguridad segura en caliente:
```bash
docker cp cyberguru:/app/data/cyberguru.db ./backup_cyberguru_$(date +%Y%m%d).db
```

---

## 10. Troubleshooting y Resolución de Problemas

### Problema 1: `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`
- **Causa:** El motor de Docker Desktop no se ha iniciado en Windows.
- **Solución:** Abre la aplicación **Docker Desktop** desde el menú Inicio de Windows y espera hasta que el estado indique "Engine Running".

### Problema 2: `network_mode: host` no descubre equipos en Windows/macOS
- **Causa:** En entornos de escritorio virtualizados (Windows/macOS), Docker corre dentro de una máquina virtual (WSL2 o Hyper-V), por lo que `network_mode: host` accede a la red de la máquina virtual y no a la tarjeta física WiFi/Ethernet del host.
- **Solución:** Para auditorías reales en LAN física, despliega Cyberguru en un sistema Linux nativo (o Raspberry Pi / servidor doméstico). Para desarrollo en Windows, el modo simulado de BLE y el escaneo de la subred de WSL2 funcionan de manera integrada.

### Problema 3: Conflicto con el Puerto 8080
- **Causa:** Otro proceso en el host ya está utilizando el puerto `8080`.
- **Solución:** Modifica la variable `PORT` en [docker-compose.yml](file:///c:/Users/castor/Desktop/Cyberguru/docker-compose.yml):
  ```yaml
  environment:
    - PORT=8090
  ```

### Problema 4: Error de permisos con Bluetooth en Linux
- **Causa:** El contenedor no tiene acceso al socket de D-Bus de BlueZ.
- **Solución:** Asegúrate de montar `/var/run/dbus` en el `docker-compose.yml`:
  ```yaml
  volumes:
    - /var/run/dbus:/var/run/dbus:ro
  ```

---

## 👨‍💻 Autoría

Desarrollado y mantenido por **`cast0rtech`** para la comunidad de ciberseguridad y administración de redes.
