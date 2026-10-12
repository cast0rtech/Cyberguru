# 📘 Guía Técnica y de Desarrollo — Cyberguru

**Autor:** `cast0rtech`  
**Versión:** 1.0.0  
**Proyecto:** Cyberguru Security Suite  

Guía completa para desarrollo, arquitectura de comprobación activa, base de datos para estadísticas y despliegue.

---

## 🌐 Índice / Table of Contents
1. [🇪🇸 Guía en Español](#-guía-en-español)
2. [🇬🇧 English Guide](#-english-guide)

---

# 🇪🇸 Guía en Español

## 1. Arquitectura de Comprobación Activa de Dispositivos Reales

A diferencia de escáneres convencionales que listan entradas obsoletas de la caché ARP del sistema operativo o insertan dispositivos simulados, Cyberguru implementa un pipeline estricto de comprobación previa antes de admitir cualquier equipo en la base de datos:

### 1.1 Flujo del Algoritmo de Verificación (`backend/scanner/verify.go`)

```text
[Candidato IP/MAC detectado]
          │
          ├──> 1. Filtro L2/L3: ¿Es Broadcast, Multicast o APIPA (169.254)?
          │         └──> Sí: Descartar inmediatamente.
          │
          ├──> 2. Prueba ICMP Ping Nativa (Timeout 700ms)
          │         └──> ¿Responde? -> Guardar RTT (ms) y marcar comprobado.
          │
          ├──> 3. Sondeo Concurrente de Sockets TCP (Timeout 350ms)
          │         Puertos probados: 53 (DNS), 80/443 (Web), 445 (SMB), 135 (RPC),
          │                           22 (SSH), 554 (RTSP), 5000 (DSM), 8080.
          │         └──> Conexión establecida o RST (Connection Refused):
          │              Confirma presencia real del host en la red.
          │
          ├──> 4. Comprobación por Tabla de Rutas del Sistema
          │         └──> ¿Es la IP de la Puerta de Enlace (Default Gateway)?
          │              Confirmar como equipo de enrutamiento del sistema.
          │
          └──> 5. Resolución de Hostname
                    DNS reverso (net.LookupAddr) para obtener el nombre FQDN/NetBIOS.
```

Si el dispositivo no responde a ninguna prueba activa y no es la puerta de enlace activa del sistema, es **descartado automáticamente** y no entra en la lista de equipos en línea.

---

## 2. Base de Datos SQLite y Motor de Estadísticas

El archivo SQLite se ubica en `./data/cyberguru.db` (en modo portable) o en el volumen Docker persistente.

### 2.1 Tablas Principales (`backend/db/database.go`)

* **`devices`**:
  * `mac` (TEXT UNIQUE): Dirección física normalizada IEEE 802.
  * `ip` (TEXT): Dirección IPv4 verificada.
  * `verified` (BOOLEAN): `1` para dispositivos confirmados con prueba de vida.
  * `verification_method` (TEXT): Método exacto (`ICMP Ping (6ms)`, `TCP Probe`, etc.).
  * `response_time_ms` (INTEGER): Latencia real en milisegundos.
  * `is_gateway` (BOOLEAN): Bandera que distingue el router de red.
  * `checks_passed` / `checks_failed` (INTEGER): Historial de fiabilidad.
  * `last_verified_at` (DATETIME): Momento exacto de la última comprobación.

* **`device_events`**:
  Auditoría cronológica de eventos por equipo (`VERIFIED_ONLINE`, `OFFLINE`, `LATENCY_UPDATE`).

* **`network_stats_history`**:
  Instantáneas temporales tomadas en cada escaneo para generar gráficas de tendencias:
  * `total_devices`, `online_devices`, `verified_devices`
  * `avg_latency_ms` (latencia media en ms)
  * `gateways_count`, `snmp_count`, `iot_count`

### 2.2 Purga Automática de Datos Ficticios
La función `PurgeMockDevices()` se ejecuta en el inicio del backend y vía `POST /api/cleanup-fake`, eliminando permanentemente cualquier MAC ficticia previa (`00:1A:2B...`, `44:19:B6...`, etc.) y registros huérfanos.

---

## 3. Internacionalización del Dashboard (i18n)

El frontend en React cuenta con un sistema de traducción centralizado en [`frontend/src/i18n.js`](file:///c:/Castor%20Programs/Cyberguru/frontend/src/i18n.js):
* **Idiomas Soportados**: Español (`es`), Inglés (`en`), Alemán (`de`).
* **Selector en Cabecera**: Botones de acceso rápido (`🇪🇸 ES`, `🇬🇧 EN`, `🇩🇪 DE`) con persistencia en `localStorage`.
* **Traducción Integral**: Traduce métricas, panel de control, tablas de dispositivos, alertas y analíticas de base de datos.

---

## 4. Compilación y Despliegue en Windows

### 4.1 Generación de Binarios Portables
Para compilar tanto el frontend integrado como el binario Go independiente para Windows:
```powershell
.\build-windows.ps1
```
Este script genera automáticamente:
1. `bin\Cyberguru.exe` (Binario único independiente con frontend embebido vía `go:embed`).
2. `dist-windows\Cyberguru-Setup.exe` (Instalador universal en 1 clic).
3. `dist-windows\Cyberguru-Portable\` (Carpeta lista para ejecutar desde memoria USB).
4. `dist-windows\Cyberguru-v1.0.0-Windows-Portable.zip` (Archivo comprimido para distribución).

---
---

# 🇬🇧 English Guide

## 1. Real Device Active Verification Architecture

Unlike standard network scanners that blindly ingest stale entries from operating system ARP caches or inject simulated demo devices, Cyberguru enforces a strict active verification pipeline before committing any endpoint into the database:

### 1.1 Verification Algorithm Flow (`backend/scanner/verify.go`)

```text
[Discovered Candidate IP/MAC]
          │
          ├──> 1. L2/L3 Pre-Filter: Is it Broadcast, Multicast, or APIPA (169.254)?
          │         └──> Yes: Drop immediately.
          │
          ├──> 2. Native ICMP Ping Probe (700ms timeout)
          │         └──> Responsive? -> Record RTT latency (ms) and mark verified.
          │
          ├──> 3. Concurrent TCP Socket Probing (350ms timeout)
          │         Tested ports: 53 (DNS), 80/443 (HTTP/S), 445 (SMB), 135 (RPC),
          │                       22 (SSH), 554 (RTSP), 5000 (DSM), 8080 (Alt-Web).
          │         └──> Connected or RST (Connection Refused):
          │              Confirms physical presence of the target host.
          │
          ├──> 4. System Routing Table Check
          │         └──> Is it the default gateway IP?
          │              Confirm as active system gateway router.
          │
          └──> 5. Hostname Resolution
                    Reverse DNS lookup (net.LookupAddr) for FQDN/NetBIOS resolution.
```

If an IP candidate fails all active verification checks and is not the active system default gateway, it is **discarded automatically** and will not be listed among online devices.

---

## 2. SQLite Database & Statistical Engine

The SQLite database file is stored in `./data/cyberguru.db` (portable mode) or in the persistent Docker volume.

### 2.1 Schema Tables (`backend/db/database.go`)

* **`devices`**:
  * `mac` (TEXT UNIQUE): Normalized IEEE 802 hardware address.
  * `ip` (TEXT): Verified IPv4 address.
  * `verified` (BOOLEAN): `1` for endpoints confirmed via active reachability test.
  * `verification_method` (TEXT): Exact method (`ICMP Ping (6ms)`, `TCP Probe`, etc.).
  * `response_time_ms` (INTEGER): Real response time in milliseconds.
  * `is_gateway` (BOOLEAN): Flag identifying the network default router.
  * `checks_passed` / `checks_failed` (INTEGER): Liveness reliability counters.
  * `last_verified_at` (DATETIME): Timestamp of the most recent verification.

* **`device_events`**:
  Chronological audit trail for every endpoint (`VERIFIED_ONLINE`, `OFFLINE`, `LATENCY_UPDATE`).

* **`network_stats_history`**:
  Periodic time-series snapshots recorded on each scan cycle to plot network health trends:
  * `total_devices`, `online_devices`, `verified_devices`
  * `avg_latency_ms` (average network latency in ms)
  * `gateways_count`, `snmp_count`, `iot_count`

### 2.2 Automated Mock & Ghost Data Purge
The `PurgeMockDevices()` routine runs automatically on startup and on demand via `POST /api/cleanup-fake`, removing legacy mock MACs (`00:1A:2B...`, `44:19:B6...`, etc.) and unverified offline records.

---

## 3. Multilingual Dashboard (i18n)

The React frontend features a centralized translation module in [`frontend/src/i18n.js`](file:///c:/Castor%20Programs/Cyberguru/frontend/src/i18n.js):
* **Supported Languages**: Spanish (`es`), English (`en`), German (`de`).
* **Header Switcher**: Quick-toggle pills (`🇪🇸 ES`, `🇬🇧 EN`, `🇩🇪 DE`) persisted in `localStorage`.
* **Full Coverage**: Translates metric cards, scanner control panels, device inventory tables, alerts, and analytics dashboards.

---

## 4. Windows Build & Packaging

### 4.1 Automated Packaging
To compile both the production React bundle and the standalone Go executable for Windows:
```powershell
.\build-windows.ps1
```
This script creates:
1. `bin\Cyberguru.exe` (Single standalone executable with embedded frontend using `go:embed`).
2. `dist-windows\Cyberguru-Setup.exe` (1-click universal Windows installer).
3. `dist-windows\Cyberguru-Portable\` (Ready-to-run folder for USB drives and workstations).
4. `dist-windows\Cyberguru-v1.0.0-Windows-Portable.zip` (Compressed distribution archive).
