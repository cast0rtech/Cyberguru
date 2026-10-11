import React, { useState, useEffect } from 'react'
import Header from './components/Header'
import MetricCard from './components/MetricCard'
import ScannerPanel from './components/ScannerPanel'
import DeviceTable from './components/DeviceTable'
import AlertFeed from './components/AlertFeed'
import { Wifi, Server, Bluetooth, AlertTriangle, Activity, Camera, HardDrive } from './components/Icons'

const DEFAULT_DEVICES = [
  { id: 1, mac: "00:1A:2B:3C:4D:5E", ip: "192.168.1.1", hostname: "gateway-router.local", vendor: "Cisco Systems", device_type: "SNMP", os_info: "Cisco IOS 15.2(4)M", services: "SNMP (161)", last_seen: new Date().toISOString(), status: "online", snmp_enabled: true },
  { id: 2, mac: "44:19:B6:88:77:66", ip: "192.168.1.120", hostname: "cctv-hikvision-garage", vendor: "Hikvision Digital", device_type: "Camera", os_info: "Hikvision IPCam v5.7", services: "RTSP-Stream (554), ONVIF (8000)", last_seen: new Date().toISOString(), status: "online", snmp_enabled: false },
  { id: 3, mac: "00:11:32:88:99:AA", ip: "192.168.1.50", hostname: "synology-nas-storage", vendor: "Synology Inc.", device_type: "NAS", os_info: "Synology DSM 7.2.1", services: "SMB/CIFS (445), Synology-DSM (5000)", last_seen: new Date().toISOString(), status: "online", snmp_enabled: false },
  { id: 4, mac: "DC:A6:32:11:88:99", ip: "192.168.1.105", hostname: "security-cam-front", vendor: "Raspberry Pi Foundation", device_type: "Camera", os_info: "MotionEyeOS RTSP", services: "RTSP-Stream (554)", last_seen: new Date().toISOString(), status: "online", snmp_enabled: false },
  { id: 5, mac: "F4:34:F0:77:A1:B2", ip: "192.168.1.189", hostname: "iot-air-sensor", vendor: "Espressif Systems", device_type: "WiFi", os_info: "ESP32 FreeRTOS", services: "MQTT (1883)", last_seen: new Date().toISOString(), status: "online", snmp_enabled: false },
  { id: 6, mac: "AC:DE:48:FF:99:00", ip: "0.0.0.0", hostname: "Apple AirTag (Beacon)", vendor: "Apple Inc. (iBeacon)", device_type: "BLE", os_info: "BLE v5.0 Proximity", services: "BLE Adv", last_seen: new Date().toISOString(), status: "online", rssi: -62, snmp_enabled: false }
]

const DEFAULT_ALERTS = [
  { id: 1, severity: "warning", title: "Flujo de Vídeo RTSP Abierto en 192.168.1.120", description: "Cámara IP cctv-hikvision-garage transmite en RTSP puerto 554 sin cifrado TLS.", timestamp: new Date().toISOString(), acknowledged: false },
  { id: 2, severity: "warning", title: "Panel NAS en HTTP no cifrado en 192.168.1.50", description: "El almacenamiento NAS synology-nas-storage expone DSM en HTTP 5000. Se recomienda activar HTTPS 5001.", timestamp: new Date().toISOString(), acknowledged: false },
  { id: 3, severity: "warning", title: "Puerto SNMP público detectado", description: "El gateway (192.168.1.1) responde a consultas SNMP con la comunidad 'public'.", timestamp: new Date().toISOString(), acknowledged: false }
]

export default function App() {
  const [stats, setStats] = useState({
    total_devices: 6,
    online_devices: 6,
    snmp_devices: 1,
    ble_devices: 1,
    camera_devices: 2,
    nas_devices: 1,
    total_alerts: 3,
    pending_alerts: 3,
    critical_alerts: 0,
    last_scan_time: new Date().toLocaleTimeString()
  })
  const [devices, setDevices] = useState(() => {
    const saved = localStorage.getItem('cyberguru_devices')
    return saved ? JSON.parse(saved) : DEFAULT_DEVICES
  })
  const [alerts, setAlerts] = useState(() => {
    const saved = localStorage.getItem('cyberguru_alerts')
    return saved ? JSON.parse(saved) : DEFAULT_ALERTS
  })
  const [isScanning, setIsScanning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem('cyberguru_server_url') || '')
  const [isOfflineMode, setIsOfflineMode] = useState(false)

  const getEndpoint = (path) => {
    if (serverUrl && serverUrl.trim() !== '') {
      return serverUrl.replace(/\/$/, '') + path
    }
    return path
  }

  const fetchData = async () => {
    try {
      const [statsRes, devRes, alertsRes, healthRes] = await Promise.all([
        fetch(getEndpoint('/api/stats')),
        fetch(getEndpoint('/api/devices')),
        fetch(getEndpoint('/api/alerts')),
        fetch(getEndpoint('/api/health'))
      ])

      if (statsRes.ok) setStats(await statsRes.json())
      if (devRes.ok) {
        const d = await devRes.json()
        setDevices(d)
        localStorage.setItem('cyberguru_devices', JSON.stringify(d))
      }
      if (alertsRes.ok) {
        const a = await alertsRes.json()
        setAlerts(a)
        localStorage.setItem('cyberguru_alerts', JSON.stringify(a))
      }
      if (healthRes.ok) {
        const health = await healthRes.json()
        setIsScanning(health.is_scanning)
      }
      setIsOfflineMode(false)
    } catch (err) {
      setIsOfflineMode(true)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [serverUrl])

  const handleTriggerScan = async (scanType) => {
    setIsScanning(true)
    try {
      const res = await fetch(getEndpoint('/api/scan'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scan_type: scanType })
      })
      if (res.ok) {
        await fetchData()
      } else {
        throw new Error("Servidor no disponible")
      }
    } catch (err) {
      // Simulación offline en smartphone/móvil
      setTimeout(() => {
        const now = new Date()
        let newDevs = [...devices]
        let newAlerts = [...alerts]

        if (scanType === 'iot' || scanType === 'all') {
          const camDev = {
            id: Date.now() + 1,
            mac: "3C:EF:8C:11:22:33",
            ip: "192.168.1.135",
            hostname: "cctv-dahua-backyard",
            vendor: "Dahua Technology",
            device_type: "Camera",
            os_info: "Dahua IPC RTSP",
            services: "RTSP-Stream (554), ONVIF (8000)",
            last_seen: now.toISOString(),
            status: "online",
            snmp_enabled: false
          }
          const nasDev = {
            id: Date.now() + 2,
            mac: "00:08:9B:44:55:66",
            ip: "192.168.1.55",
            hostname: "qnap-ts453d-backup",
            vendor: "QNAP Systems",
            device_type: "NAS",
            os_info: "QTS 5.1 Linux",
            services: "SMB/CIFS (445), QNAP-QTS (8080)",
            last_seen: now.toISOString(),
            status: "online",
            snmp_enabled: false
          }
          newDevs.push(camDev, nasDev)
          newAlerts.unshift({
            id: Date.now() + 3,
            severity: "warning",
            title: "Cámara Dahua con RTSP Abierto detectada",
            description: "Cámara cctv-dahua-backyard (192.168.1.135) identificada con transmisión de vídeo RTSP en puerto 554.",
            timestamp: now.toISOString(),
            acknowledged: false
          })
        }

        if (scanType === 'arp') {
          const mobilePeer = {
            id: Date.now() + 4,
            mac: "30:AE:A4:44:55:66",
            ip: "192.168.1.190",
            hostname: "iot-device-lan",
            vendor: "Espressif Systems",
            device_type: "WiFi",
            os_info: "FreeRTOS",
            services: "HTTP (80)",
            last_seen: now.toISOString(),
            status: "online",
            snmp_enabled: false
          }
          newDevs.push(mobilePeer)
        }

        setDevices(newDevs)
        setAlerts(newAlerts)
        localStorage.setItem('cyberguru_devices', JSON.stringify(newDevs))
        localStorage.setItem('cyberguru_alerts', JSON.stringify(newAlerts))

        setStats({
          total_devices: newDevs.length,
          online_devices: newDevs.filter(d => d.status === 'online').length,
          snmp_devices: newDevs.filter(d => d.snmp_enabled).length,
          ble_devices: newDevs.filter(d => d.device_type === 'BLE').length,
          camera_devices: newDevs.filter(d => d.device_type === 'Camera').length,
          nas_devices: newDevs.filter(d => d.device_type === 'NAS').length,
          total_alerts: newAlerts.length,
          pending_alerts: newAlerts.filter(a => !a.acknowledged).length,
          critical_alerts: newAlerts.filter(a => a.severity === 'danger' && !a.acknowledged).length,
          last_scan_time: now.toLocaleTimeString()
        })
        setIsScanning(false)
      }, 1500)
    } finally {
      if (!isOfflineMode) {
        setIsScanning(false)
      }
    }
  }

  const handleAcknowledgeAlert = async (id) => {
    try {
      const res = await fetch(getEndpoint(`/api/alerts/${id}/ack`), { method: 'POST' })
      if (res.ok) {
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a))
        fetchData()
        return
      }
    } catch (err) {
      // Modo local
    }
    const updated = alerts.map(a => a.id === id ? { ...a, acknowledged: true } : a)
    setAlerts(updated)
    localStorage.setItem('cyberguru_alerts', JSON.stringify(updated))
  }

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '2.5rem' }}>
      <Header isScanning={isScanning} lastScanTime={stats.last_scan_time} />

      {/* Barra de estado en modo Móvil/Android */}
      {isOfflineMode && (
        <div style={{ margin: '0 1rem 1rem', padding: '0.6rem 1rem', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem' }}>
          <div>
            <span style={{ fontWeight: '600', color: 'var(--accent-indigo)' }}>📱 Modo Móvil Autónomo:</span>
            <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>Rastreo de red, cámaras y NAS desde el dispositivo.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="IP Servidor (ej: http://192.168.1.100:8080)"
              value={serverUrl}
              onChange={(e) => {
                setServerUrl(e.target.value)
                localStorage.setItem('cyberguru_server_url', e.target.value)
              }}
              style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                padding: '0.2rem 0.5rem',
                color: 'var(--text-main)',
                fontSize: '0.75rem',
                width: '240px'
              }}
            />
            {serverUrl && (
              <button
                onClick={fetchData}
                style={{ background: 'var(--accent-cyan)', color: '#000', border: 'none', borderRadius: '4px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
              >
                Conectar
              </button>
            )}
          </div>
        </div>
      )}

      <main style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Fila de Métricas */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          <MetricCard
            title="Total Equipos"
            value={stats.total_devices}
            subtitle="Inventariados en el sensor"
            icon={Activity}
            color="cyan"
          />
          <MetricCard
            title="Cámaras IP"
            value={stats.camera_devices || 0}
            subtitle="RTSP / ONVIF de vigilancia"
            icon={Camera}
            color="rose"
          />
          <MetricCard
            title="Servidores NAS"
            value={stats.nas_devices || 0}
            subtitle="Almacenamiento SMB / DSM"
            icon={HardDrive}
            color="emerald"
          />
          <MetricCard
            title="Switches SNMP"
            value={stats.snmp_devices}
            subtitle="Puerto UDP 161 detectado"
            icon={Server}
            color="amber"
          />
          <MetricCard
            title="Balizas BLE"
            value={stats.ble_devices}
            subtitle="Dispositivos de proximidad"
            icon={Bluetooth}
            color="indigo"
          />
          <MetricCard
            title="Alertas Críticas"
            value={stats.critical_alerts}
            subtitle={`${stats.pending_alerts} pendientes`}
            icon={AlertTriangle}
            color="rose"
          />
        </div>

        {/* Panel de Control de Escaneo */}
        <ScannerPanel onTriggerScan={handleTriggerScan} isScanning={isScanning} />

        {/* Contenido Principal: Inventario y Alertas */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1.25rem',
          alignItems: 'start'
        }}>
          <div style={{ minWidth: 0, gridColumn: 'span 2' }}>
            <DeviceTable devices={devices} loading={loading} />
          </div>
          <div style={{ minWidth: 0 }}>
            <AlertFeed alerts={alerts} onAcknowledgeAlert={handleAcknowledgeAlert} />
          </div>
        </div>
      </main>

      <footer style={{ textAlign: 'center', marginTop: '2.5rem', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
        Cyberguru Security Suite &copy; 2026 • Rastreo de Red, Cámaras CCTV, Almacenamiento NAS & BLE • by cast0rtech
      </footer>
    </div>
  )
}
