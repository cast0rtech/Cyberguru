# 📖 Guía Completa de Usuario y Administración — Cyberguru

Bienvenido a la **Guía Oficial de Cyberguru**, la plataforma integral de inventario de red 100% verificado, observatorio satelital GNSS y auditoría de sensores físicos e inalámbricos (**Zigbee, Z-Wave, Thread, UWB, NFC, Bluetooth/BLE, GPS y LPWAN**).

---

## 📑 Tabla de Contenidos

1. [Filosofía y Arquitectura "Zero-Ghosting"](#1-filosofía-y-arquitectura-zero-ghosting)
2. [Instalación y Despliegue por Plataforma](#2-instalación-y-despliegue-por-plataforma)
   - [2.1 Android (APK y AAB)](#21-android-apk-y-aab)
   - [2.2 Windows (Portable e Instalador)](#22-windows-portable-e-instalador)
   - [2.3 Contenedor Docker & Docker Compose](#23-contenedor-docker--docker-compose)
   - [2.4 Compilación desde Código Fuente](#24-compilación-desde-código-fuente)
3. [Manual del Observatorio Satelital GNSS (Sky View)](#3-manual-del-observatorio-satelital-gnss-sky-view)
   - [3.1 Cómo abrir el Observatorio](#31-cómo-abrir-el-observatorio)
   - [3.2 Interpretación de la Carta Polar Celeste](#32-interpretación-de-la-carta-polar-celeste)
   - [3.3 Código de Colores de Constelaciones](#33-código-de-colores-de-constelaciones)
   - [3.4 Satélites en Fix vs Satélites en Seguimiento](#34-satélites-en-fix-vs-satélites-en-seguimiento)
   - [3.5 Datos de Nuestra Posición Actual](#35-datos-de-nuestra-posicion-actual)
4. [Manual del Centro de Sensores e IoT](#4-manual-del-centro-de-sensores-e-iot)
   - [4.1 Bluetooth y BLE](#41-bluetooth-y-ble)
   - [4.2 NFC / RFID Contactless](#42-nfc--rfid-contactless)
   - [4.3 Zigbee 3.0](#43-zigbee-30)
   - [4.4 Z-Wave Plus](#44-z-wave-plus)
   - [4.5 Thread y Matter](#45-thread-y-matter)
   - [4.6 UWB (Ultra-Wideband)](#46-uwb-ultra-wideband)
   - [4.7 LPWAN (LoRaWAN)](#47-lpwan-lorawan)
5. [Inventario de Red y Comprobación Activa](#5-inventario-de-red-y-comprobación-activa)
6. [Resolución de Problemas (Troubleshooting)](#6-resolución-de-problemas-troubleshooting)

---

## 1. Filosofía y Arquitectura "Zero-Ghosting"

A diferencia de las herramientas convencionales que rellenan el inventario con datos obsoletos de caché o simulaciones artificiales, **Cyberguru implementa una estricta política Zero-Ghosting**:

* **Prueba de Vida Obligatoria**: Antes de registrar un dispositivo en el inventario o la base de datos, el motor somete la IP a una comprobación activa doble (Ping ICMP y conexión TCP concurrente a puertos representativos: DNS 53, HTTP 80, HTTPS 443, SMB 445, SSH 22, RTSP 554 y DSM 5000).
* **Medición de Latencia en Milisegundos**: Cada respuesta exitosa registra el Round-Trip Time (RTT) real.
* **Eliminación de Falsos Positivos**: Si un equipo no responde o se desconecta, se degrada a estado offline y no se agregan mocks ni datos inventados.

---

## 2. Instalación y Despliegue por Plataforma

### 2.1 Android (APK y AAB)

La versión móvil está diseñada para operar tanto de forma autónoma (aprovechando los sensores del teléfono) como conectada al agente de escritorio/servidor:

1. **Instalación directa del archivo APK**:
   - Conecta el dispositivo Android por USB con la depuración USB habilitada y ejecuta:
     ```powershell
     adb install -r Cyberguru.apk
     ```
   - O bien, transfiere el archivo `Cyberguru.apk` al almacenamiento de tu teléfono y ábrelo con cualquier explorador de archivos para instalarlo.
2. **Permisos Requeridos**:
   - **Ubicación Precisa**: Requerido para acceder al chip GNSS/GPS y calcular azimut, elevación y constelaciones visibles.
   - **Dispositivos Cercanos (Bluetooth)**: Requerido para escanear balizas BLE y etiquetas de proximidad.
   - **NFC**: Requerido para interactuar con credenciales, tags RFID y tarjetas de control de acceso.
3. **Modo Conectado / Servidor Central**:
   - En la cabecera de la app móvil, puedes introducir la dirección IP y puerto del servidor Cyberguru de tu red local (por ejemplo `http://192.168.1.100:8080`) para sincronizar en tiempo real el inventario detectado por el móvil con la base de datos central.

---

### 2.2 Windows (Portable e Instalador)

La versión de Windows está compilada de manera 100% nativa y autosuficiente:

1. **Versión Portable (`dist-windows\Cyberguru-Portable\Cyberguru.exe`)**:
   - No requiere privilegios de administrador ni instalación.
   - Ideal para llevar en una memoria USB de auditoría técnica.
   - Al ejecutarse, inicializa la base de datos SQLite en su propia carpeta y abre automáticamente el dashboard en tu navegador predeterminado (`http://localhost:8080`).
2. **Instalador Formal (`dist-windows\Cyberguru-Setup.exe`)**:
   - Asistente de instalación estándar para Windows 10 y Windows 11.
   - Crea accesos directos en el Escritorio y Menú Inicio, e incluye un desinstalador limpio.
3. **Parámetros de Línea de Comandos**:
   ```cmd
   Cyberguru.exe --no-browser      :: Inicia el servicio sin abrir el navegador automáticamente
   PORT=9000 Cyberguru.exe         :: Fuerza el uso de un puerto específico
   ```

---

### 2.3 Contenedor Docker & Docker Compose

Para servidores Linux, NAS (Synology, QNAP, Unraid) o entornos virtualizados:

1. **Levantar el contenedor con Docker Compose**:
   ```bash
   docker compose up --build -d
   ```
2. **Detalles de Configuración (`docker-compose.yml`)**:
   - `network_mode: host`: Es **indispensable** para que el escáner de red pueda acceder directamente a la tabla ARP del host, escuchar paquetes de difusión y sondear puertos sin la limitación de la red NAT virtual de Docker.
   - `cap_add: [NET_ADMIN, NET_RAW]`: Otorga los privilegios necesarios para enviar paquetes ICMP y sondeos de red a bajo nivel.
   - `SIMULATE_BLE_IF_ABSENT=false`: Garantiza que el backend trabaje exclusivamente con telemetría de hardware real.

---

### 2.4 Compilación desde Código Fuente

Si deseas recompilar cualquiera de las versiones tú mismo:

* **Compilar Android (APK y AAB)**:
  ```powershell
  .\build-apk.ps1
  ```
* **Compilar Windows (Portable e Instalador)**:
  ```powershell
  .\build-windows.ps1
  ```

---

## 3. Manual del Observatorio Satelital GNSS (Sky View)

### 3.1 Cómo abrir el Observatorio

Puedes acceder al observatorio satelital desde dos ubicaciones dentro de la aplicación:
1. En el panel **Centro de Sensores e IoT**, en la tarjeta **GPS / GNSS Telemetría**, haz clic en el botón azul **"Satélites"**.
2. En la tabla de inventario, si se ha detectado el receptor satelital, haz clic en el botón **"Satélites"** en la columna de acciones.

---

### 3.2 Interpretación de la Carta Polar Celeste

El radar central representa la bóveda celeste completa (360°) vista desde el punto en el que te encuentras:

```
                  N (0° Azimut)
                       ▲
                       |
               30°     |     30°
           \           |           /
             \      60°|     /
               \       |   /
      W (270°) --------●-------- E (90°)
                 Cenit (90° Elevación)
               /       |   \
             /         |     \
           /           |           \
                       |
                       ▼
                  S (180° Azimut)
```

* **Círculo Exterior (0° de Elevación)**: Representa la línea del horizonte geográfico terrestre. Los satélites situados aquí están saliendo o poniéndose.
* **Círculos Intermedios (30° y 60°)**: Elevación media sobre el horizonte.
* **Punto Central (90° de Elevación / Cenit)**: El punto vertical situado directamente sobre tu cabeza. Los satélites aquí disfrutan de la menor atenuación atmosférica y la señal más limpia.
* **Azimut (0° a 360°)**: Orientación angular cardinal (Norte: 0°, Este: 90°, Sur: 180°, Oeste: 270°).

---

### 3.3 Código de Colores de Constelaciones

Cada constelación satelital se diferencia mediante un color exclusivo y su identificador PRN/SVID:

| Constelación | País / Región | Color en Radar | Prefijo | Satélites en Órbita |
|---|---|:---:|:---:|:---:|
| **GPS (NAVSTAR)** | Estados Unidos | 🔵 Azul Eléctrico | `G` (ej. `G14`) | 31 MEO |
| **Galileo** | Unión Europea | 🟢 Verde Esmeralda | `E` (ej. `E05`) | 24 MEO |
| **GLONASS** | Federación Rusa | 🔴 Rojo Rubí | `R` (ej. `R08`) | 24 MEO |
| **BeiDou (BDS)** | República Popular China | 🟣 Púrpura Neón | `C` (ej. `C22`) | 27 MEO / IGSO |
| **SBAS / QZSS** | EGNOS / WAAS / Japón | 🟡 Dorado / Ámbar | `S` (ej. `S120`) | Geoestacionarios |

---

### 3.4 Satélites en Fix vs Satélites en Seguimiento

* **Satélites en Fix (`usedInFix = true`)**:
  - Se representan con un **nodo brillante y un halo exterior pulsante**.
  - Son los satélites cuyos datos de tiempo y pseudodistancia están siendo procesados en ese instante para calcular las coordenadas tridimensionales de la estación.
  - Para un fix 3D de alta precisión se requieren habitualmente un mínimo de 4 satélites con buena geometría GDOP.
* **Satélites en Seguimiento (`usedInFix = false`)**:
  - Se representan como círculos más pequeños sin halo exterior.
  - El receptor los tiene visibles sobre el horizonte y recibe sus efemérides/almanaque, pero por ángulo bajo o relación señal/ruido no están siendo computados en la solución principal.
* **Nivel de Señal C/N0 (Carrier-to-Noise Density)**:
  - Expresado en **dB-Hz** en la tabla lateral.
  - 🟢 **> 38 dB-Hz**: Señal excelente (satélite alto con línea de vista despejada).
  - 🟡 **28 - 38 dB-Hz**: Señal adecuada para navegación.
  - 🔴 **< 28 dB-Hz**: Señal débil (cerca del horizonte o atenuada por estructuras).

---

### 3.5 Datos de Nuestra Posición Actual

En la tarjeta lateral derecha se muestran los parámetros calculados:
* **Coordenadas Decimales**: Formato estándar de alta resolución (ej. `40.416800°, -3.703800°`).
* **Coordenadas Sexagesimales (DMS)**: Grados, minutos y segundos (ej. `40° 25' 0.5" N, 3° 42' 13.7" W`).
* **Botón Copiar**: Guarda las coordenadas instantáneamente en el portapapeles.
* **Enlaces a Mapas**: Botones directos para abrir la ubicación en **Google Maps** o **OpenStreetMap**.
* **Altitud y Precisión**: Altura sobre el nivel medio del mar (SNM) y margen de error en metros (ej. `±3.2 m`).
* **Brújula de Rumbo**: Indicador giratorio visual con el rumbo angular de desplazamiento en grados.

---

## 4. Manual del Centro de Sensores e IoT

### 4.1 Bluetooth y BLE
* **Qué detecta**: Balizas iBeacon, altavoces, periféricos, relojes inteligentes y tags BLE en el rango de proximidad de 2.4 GHz.
* **Cómo opera**:
  - En Android: Mediante la Web Bluetooth API y permisos de escaneo Bluetooth.
  - En Windows: Mediante auditoría PnP de dispositivos Bluetooth emparejados y cercanos.
  - En Linux/Docker: Mediante las utilidades del paquete `bluez`.

### 4.2 NFC / RFID Contactless
* **Qué detecta**: Tarjetas de transporte, badges de acceso Mifare Classic/DESFire, pulseras de eventos y tags NDEF (NTAG213/215/216).
* **Cómo opera**: Al pulsar "Escanear", acerca la tarjeta a la parte trasera del teléfono o al lector USB PC/SC conectado al equipo. La app lee el número de serie (UID) y los registros NDEF de texto/URI.

### 4.3 Zigbee 3.0
* **Qué detecta**: Bombillas inteligentes (Philips Hue, Ikea Trådfri), sensores de movimiento (Aqara, Sonoff), enchufes y conmutadores de malla IEEE 802.15.4.
* **Cómo opera**:
  - Sondea puertos COM serie en busca de chips de coordinación CP210x, CH340 y sticks dresden ConBee II/III.
  - Prospección de red en busca de pasarelas Zigbee2MQTT (puertos 8080/8099) y bridges Philips Hue.

### 4.4 Z-Wave Plus
* **Qué detecta**: Cerraduras inteligentes, termostatos y relés domóticos bajo la norma ITU-T G.9959 (bandas sub-GHz de 868 o 908 MHz).
* **Cómo opera**: Inspecciona controladores serie USB (Aeotec Z-Stick, Zooz) y servidores Z-Wave JS UI en el puerto 8091.

### 4.5 Thread y Matter
* **Qué detecta**: Enrutadores de borde (Thread Border Routers) que comunican la red IPv6 local con la malla 6LoWPAN (Apple TV 4K, HomePod, Google Nest Hub, OpenThread Border Routers).
* **Cómo opera**: Rastreo de anuncios mDNS bajo los servicios `_meshcop._udp` y consultas CoAP en el puerto 5683/5684.

### 4.6 UWB (Ultra-Wideband)
* **Qué detecta**: Chips de banda ultraancha (IEEE 802.15.4z) como Apple U1/U2, Qorvo/Decawave DW3000 y balizas de localización en interiores por tiempo de vuelo (Time-of-Flight / ToF).
* **Cómo opera**: Comprueba la presencia del subsistema de hardware UWB en teléfonos compatibles y ejecuta el algoritmo de medición de distancia fina.

### 4.7 LPWAN (LoRaWAN)
* **Qué detecta**: Pasarelas de largo alcance LoRaWAN (Mikrotik wAP LR, Dragino, concentradores The Things Network).
* **Cómo opera**: Envía sondas de protocolo Semtech LoRaWAN Packet Forwarder (paquetes UDP en el puerto 1700).

---

## 5. Inventario de Red y Comprobación Activa

En la pestaña **Inventario Real**, cada equipo registrado presenta:
* **Dirección MAC y Fabricante Real (OUI)**: Identificación del fabricante de la tarjeta de red (ej. Apple, Samsung, Intel, Cisco, Raspberry Pi).
* **Servicios Comprobados**: Listado de puertos abiertos confirmados (ej. `HTTP (80), HTTPS (443), SMB (445)`).
* **Botón Comprobar**: Permite lanzar en cualquier momento una verificación en vivo individual contra ese host para auditar si sigue en línea y re-medir su tiempo de respuesta.

---

## 6. Resolución de Problemas (Troubleshooting)

### P: ¿Por qué en interiores veo pocos satélites o con señal baja?
**R:** Las señales satelitales GNSS operan en frecuencias de microondas de muy baja potencia (~1.2 a 1.5 GHz) y son atenuadas fuertemente por techos de hormigón y estructuras metálicas. Para obtener la máxima precisión y ver más de 20 satélites en fix, coloca el dispositivo cerca de una ventana o en exteriores con línea de vista despejada hacia el cielo.

### P: La aplicación Android pide permisos de ubicación al abrir el radar satelital.
**R:** Es el comportamiento estándar de Android. La API `GnssStatus` requiere obligatoriamente el permiso `ACCESS_FINE_LOCATION` para poder acceder al receptor físico del dispositivo. Selecciona **"Permitir mientras se usa la app"** o **"Siempre"**.

### P: En Windows el puerto 8080 está ocupado por otra aplicación.
**R:** Cyberguru cuenta con un mecanismo de tolerancia a fallos automático: si el puerto 8080 está en uso, explorará dinámicamente los siguientes puertos libres (8081, 8082, etc.) y se vinculará a él sin interrumpir el servicio.

### P: En Docker no se descubren dispositivos de la red Wi-Fi o Ethernet.
**R:** Asegúrate de que el contenedor se ejecute con `network_mode: host`. Los contenedores con red bridge por defecto están aislados en una subred virtual privada (172.x.x.x) y no pueden enviar difusiones ARP ni capturar paquetes físicos del router principal.

---

*Cyberguru Security Suite © 2026 • Documentación elaborada por cast0rtech*
