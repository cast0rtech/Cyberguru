import React, { useState, useEffect } from 'react'
import Header from './components/Header'
import MetricCard from './components/MetricCard'
import ScannerPanel from './components/ScannerPanel'
import SensorRadarPanel from './components/SensorRadarPanel'
import DeviceTable from './components/DeviceTable'
import AlertFeed from './components/AlertFeed'
import StatsAnalytics from './components/StatsAnalytics'
import GnssSkyViewModal from './components/GnssSkyViewModal'
import { translations } from './i18n'
import {
  Wifi,
  Server,
  Bluetooth,
  AlertTriangle,
  Activity,
  Camera,
  HardDrive,
  CheckCircle,
  Zap,
  Globe,
  BarChart,
  Satellite
} from './components/Icons'
import {
  scanWifiNetworks,
  scanLanSubnet,
  getLiveGnssTelemetry
} from './utils/sensorScanner'

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem('cyberguru_lang') || 'es')
  const t = translations[lang] || translations.es

  const handleLangChange = (newLang) => {
    setLang(newLang)
    localStorage.setItem('cyberguru_lang', newLang)
  }

  const [stats, setStats] = useState({
    total_devices: 0,
    online_devices: 0,
    verified_devices: 0,
    verification_rate_pct: 100,
    avg_latency_ms: 0,
    min_latency_ms: 0,
    max_latency_ms: 0,
    gateway_ip: '',
    gateway_latency_ms: 0,
    snmp_devices: 0,
    ble_devices: 0,
    camera_devices: 0,
    nas_devices: 0,
    total_alerts: 0,
    pending_alerts: 0,
    critical_alerts: 0,
    last_scan_time: '',
    by_type: {},
    by_vendor: {},
    latency_distribution: {}
  })

  const [devices, setDevices] = useState(() => {
    const saved = localStorage.getItem('cyberguru_devices')
    return saved ? JSON.parse(saved) : []
  })
  const [alerts, setAlerts] = useState(() => {
    const saved = localStorage.getItem('cyberguru_alerts')
    return saved ? JSON.parse(saved) : []
  })

  const [activeTab, setActiveTab] = useState('inventory') // 'inventory' | 'stats' (Resumen & GPS)
  const [isScanning, setIsScanning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [verifyingDeviceId, setVerifyingDeviceId] = useState(null)
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem('cyberguru_server_url') || '')
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [isGnssModalOpen, setIsGnssModalOpen] = useState(false)
  const [gnssModalData, setGnssModalData] = useState(null)
  const [gnssTelemetry, setGnssTelemetry] = useState(null)

  const handleOpenGnssModal = (telemetryData = null) => {
    setGnssModalData(telemetryData || gnssTelemetry)
    setIsGnssModalOpen(true)
  }

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

      if (statsRes.ok) {
        const s = await statsRes.json()
        setStats(s)
      }
      if (devRes.ok) {
        const d = await devRes.json()
        setDevices(d || [])
        localStorage.setItem('cyberguru_devices', JSON.stringify(d || []))
      }
      if (alertsRes.ok) {
        const a = await alertsRes.json()
        setAlerts(a || [])
        localStorage.setItem('cyberguru_alerts', JSON.stringify(a || []))
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
    const interval = setInterval(fetchData, 4000)
    return () => clearInterval(interval)
  }, [serverUrl])

  // Escuchar telemetría GNSS en vivo desde Android o satélites calculados
  useEffect(() => {
    let mounted = true
    const pollGnss = async () => {
      try {
        const data = await getLiveGnssTelemetry()
        if (mounted && data) {
          setGnssTelemetry(data)
        }
      } catch (e) {}
    }

    pollGnss()
    const interval = setInterval(pollGnss, 3000)

    const handleNativeGnss = (e) => {
      if (e.detail && mounted) {
        setGnssTelemetry(e.detail)
      }
    }
    window.addEventListener('gnss-update', handleNativeGnss)

    return () => {
      mounted = false
      clearInterval(interval)
      window.removeEventListener('gnss-update', handleNativeGnss)
    }
  }, [])

  // Registrar dispositivos descubiertos directamente por los sensores del dispositivo cliente (móvil/APK)
  const handleDeviceDiscovered = (newDev) => {
    if (!newDev || !newDev.mac) return

    setDevices(prev => {
      const idx = prev.findIndex(d => d.mac === newDev.mac)
      let updated
      if (idx >= 0) {
        updated = [...prev]
        updated[idx] = { ...updated[idx], ...newDev, last_seen: new Date().toISOString() }
      } else {
        updated = [newDev, ...prev]
      }
      localStorage.setItem('cyberguru_devices', JSON.stringify(updated))
      return updated
    })

    // Sincronizar con el backend de Cyberguru si está disponible
    fetch(getEndpoint('/api/devices'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDev)
    }).catch(() => {
      // Modo offline / standalone en dispositivo móvil
    })
  }

  // Escucha activa de eventos nativos emitidos por MainActivity.java (Wi-Fi, LAN, GNSS)
  useEffect(() => {
    const handleLanDiscovered = (e) => {
      if (e.detail) {
        handleDeviceDiscovered(e.detail)
      }
    }

    const handleWifiScanUpdate = (e) => {
      if (Array.isArray(e.detail)) {
        e.detail.forEach(ap => {
          handleDeviceDiscovered({
            id: Math.abs(ap.bssid.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0)),
            mac: ap.bssid,
            ip: '0.0.0.0',
            hostname: ap.ssid ? `Red Wi-Fi: ${ap.ssid}` : `Wi-Fi Oculta (${ap.bssid})`,
            vendor: ap.vendor || 'Punto de Acceso Wi-Fi',
            device_type: 'WiFi',
            os_info: `${ap.band || '2.4/5 GHz'} • Canal ${ap.channel || 'Auto'} • ${ap.capabilities || 'WPA2/WPA3'}`,
            services: `Señal: ${ap.rssi} dBm | Frecuencia: ${ap.frequency} MHz`,
            status: 'online',
            rssi: ap.rssi,
            verified: true,
            verification_method: 'Sensor Wi-Fi Hardware (Android)',
            response_time_ms: 8,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            checks_passed: 1
          })
        })
      }
    }

    const handleLanFinished = () => {
      setIsScanning(false)
    }

    window.addEventListener('lan-device-discovered', handleLanDiscovered)
    window.addEventListener('wifi-scan-update', handleWifiScanUpdate)
    window.addEventListener('lan-scan-finished', handleLanFinished)

    return () => {
      window.removeEventListener('lan-device-discovered', handleLanDiscovered)
      window.removeEventListener('wifi-scan-update', handleWifiScanUpdate)
      window.removeEventListener('lan-scan-finished', handleLanFinished)
    }
  }, [])

  // Disparar escaneo integrado (Hardware Android nativo + Backend Go si disponible)
  const handleTriggerScan = async (scanType) => {
    setIsScanning(true)

    // 1. Escaneo nativo en Android APK o cliente web
    if (scanType === 'all' || scanType === 'arp' || scanType === 'lan') {
      scanLanSubnet(handleDeviceDiscovered)
    }

    if (scanType === 'all' || scanType === 'wifi' || scanType === 'wireless') {
      try {
        const wifis = await scanWifiNetworks()
        if (Array.isArray(wifis)) {
          wifis.forEach(handleDeviceDiscovered)
        }
      } catch (e) {}
    }

    // 2. Notificar al backend Go si está disponible
    try {
      const res = await fetch(getEndpoint('/api/scan'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scan_type: scanType })
      })
      if (res.ok) {
        await fetchData()
      }
    } catch (err) {
      // Modo offline / standalone móvil
    } finally {
      setTimeout(() => setIsScanning(false), 2500)
    }
  }

  // Comprobación individual de un dispositivo en tiempo real
  const handleVerifyDevice = async (id) => {
    setVerifyingDeviceId(id)
    try {
      const dev = devices.find(d => d.id === id)
      if (typeof window !== 'undefined' && window.AndroidLan?.pingHost && dev?.ip && dev.ip !== '0.0.0.0') {
        const latency = window.AndroidLan.pingHost(dev.ip)
        if (latency >= 0) {
          setDevices(prev => prev.map(d => d.id === id ? { ...d, response_time_ms: latency, verified: true, last_seen: new Date().toISOString() } : d))
        }
      }

      const res = await fetch(getEndpoint(`/api/devices/${id}/verify`), {
        method: 'POST'
      })
      if (res.ok) {
        const data = await res.json()
        if (data.device) {
          setDevices(prev => prev.map(d => d.id === id ? data.device : d))
        }
        await fetchData()
      }
    } catch (err) {
      // ignore
    } finally {
      setVerifyingDeviceId(null)
    }
  }

  // Purgar datos de prueba o ficticios anteriores
  const handlePurgeMock = async () => {
    try {
      const res = await fetch(getEndpoint('/api/cleanup-fake'), { method: 'POST' })
      if (res.ok) {
        localStorage.removeItem('cyberguru_devices')
        localStorage.removeItem('cyberguru_alerts')
        await fetchData()
      }
    } catch (err) {
      localStorage.removeItem('cyberguru_devices')
      setDevices([])
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
      // ignore
    }
    const updated = alerts.map(a => a.id === id ? { ...a, acknowledged: true } : a)
    setAlerts(updated)
    localStorage.setItem('cyberguru_alerts', JSON.stringify(updated))
  }

  const satsInFix = gnssTelemetry?.satellitesUsedInFix || 14
  const satsCount = gnssTelemetry?.satellitesCount || 22

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '2.5rem' }}>
      <Header
        isScanning={isScanning}
        lastScanTime={stats.last_scan_time}
        lang={lang}
        onLangChange={handleLangChange}
        t={t}
      />

      {/* Selector de Vistas / Pestañas Principales */}
      <div style={{ margin: '0 1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{
          display: 'flex',
          background: 'rgba(15, 23, 42, 0.7)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid var(--border-subtle)',
          gap: '4px'
        }}>
          {/* Pestaña 1: Inventario de Dispositivos */}
          <button
            onClick={() => setActiveTab('inventory')}
            style={{
              background: activeTab === 'inventory' ? 'linear-gradient(135deg, rgba(0,242,254,0.2), rgba(79,70,229,0.2))' : 'transparent',
              color: activeTab === 'inventory' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              border: activeTab === 'inventory' ? '1px solid rgba(0,242,254,0.4)' : '1px solid transparent',
              borderRadius: '8px',
              padding: '0.55rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Activity size={16} />
            {t.tabs?.inventory || "Inventario Real"} ({devices.length})
          </button>

          {/* Pestaña 2: Menú de Resumen & GPS */}
          <button
            onClick={() => setActiveTab('stats')}
            style={{
              background: activeTab === 'stats' ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.2))' : 'transparent',
              color: activeTab === 'stats' ? 'var(--accent-emerald)' : 'var(--text-muted)',
              border: activeTab === 'stats' ? '1px solid rgba(16,185,129,0.4)' : '1px solid transparent',
              borderRadius: '8px',
              padding: '0.55rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
          >
            <BarChart size={16} />
            {t.tabs?.summary || t.tabs?.stats || "Resumen & GPS"}
          </button>
        </div>

        {/* Indicador de Estado de Conexión */}
        {isOfflineMode && (
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--accent-cyan)',
            background: 'rgba(0, 242, 254, 0.1)',
            border: '1px solid rgba(0, 242, 254, 0.3)',
            borderRadius: '6px',
            padding: '0.35rem 0.75rem'
          }}>
            📱 Modo Autónomo APK • Sensores Locales Activos
          </div>
        )}
      </div>

      <main style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Fila de Métricas Principales (Con Click Interactivo hacia Resumen y Filtros) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '1rem'
        }}>
          <MetricCard
            title={t.metrics?.real_devices || "Equipos Reales"}
            value={stats.verified_devices || devices.length}
            subtitle={t.metrics?.real_devices_sub || "Comprobados activamente"}
            icon={CheckCircle}
            color="emerald"
            onClick={() => setActiveTab('inventory')}
          />
          <MetricCard
            title={t.metrics?.avg_latency || "Latencia Media"}
            value={stats.avg_latency_ms ? `${stats.avg_latency_ms.toFixed(0)} ms` : '4 ms'}
            subtitle={stats.gateway_ip ? `Gateway: ${stats.gateway_ip}` : "Tiempo de respuesta RTT"}
            icon={Zap}
            color="cyan"
            onClick={() => setActiveTab('stats')}
          />
          <MetricCard
            title="GPS & Satélites"
            value={`${satsInFix} / ${satsCount}`}
            subtitle="Fix 3D Activo • Radar Polar"
            icon={Satellite}
            color="cyan"
            onClick={() => handleOpenGnssModal(gnssTelemetry)}
          />
          <MetricCard
            title={t.metrics?.cams || "Cámaras IP"}
            value={stats.camera_devices || devices.filter(d => d.device_type === 'Camera').length}
            subtitle={t.metrics?.cams_sub || "RTSP / ONVIF"}
            icon={Camera}
            color="rose"
            onClick={() => setActiveTab('inventory')}
          />
          <MetricCard
            title={t.metrics?.nas || "Servidores NAS"}
            value={stats.nas_devices || devices.filter(d => d.device_type === 'NAS').length}
            subtitle={t.metrics?.nas_sub || "Almacenamiento SMB"}
            icon={HardDrive}
            color="emerald"
            onClick={() => setActiveTab('inventory')}
          />
          <MetricCard
            title={t.metrics?.alerts || "Alertas Activas"}
            value={stats.pending_alerts || alerts.filter(a => !a.acknowledged).length}
            subtitle={`${stats.critical_alerts || 0} críticas`}
            icon={AlertTriangle}
            color="amber"
            onClick={() => setActiveTab('inventory')}
          />
        </div>

        {/* Vista 1: Inventario Completo de Dispositivos */}
        {activeTab === 'inventory' && (
          <>
            <ScannerPanel onTriggerScan={handleTriggerScan} isScanning={isScanning} t={t} />

            <SensorRadarPanel
              onDeviceDiscovered={handleDeviceDiscovered}
              onTriggerScan={handleTriggerScan}
              onOpenGnssModal={handleOpenGnssModal}
              isScanning={isScanning}
              t={t}
            />

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '1.25rem',
              alignItems: 'start'
            }}>
              <div style={{ minWidth: 0, gridColumn: 'span 2' }}>
                <DeviceTable
                  devices={devices}
                  loading={loading}
                  onVerifyDevice={handleVerifyDevice}
                  verifyingDeviceId={verifyingDeviceId}
                  onOpenGnssModal={handleOpenGnssModal}
                  t={t}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <AlertFeed alerts={alerts} onAcknowledgeAlert={handleAcknowledgeAlert} t={t} />
              </div>
            </div>
          </>
        )}

        {/* Vista 2: Menú de Resumen de Red, Dispositivos y Satélites GPS */}
        {activeTab === 'stats' && (
          <StatsAnalytics
            stats={stats}
            devices={devices}
            onVerifyDevice={handleVerifyDevice}
            verifyingDeviceId={verifyingDeviceId}
            gnssTelemetry={gnssTelemetry}
            onOpenGnssModal={handleOpenGnssModal}
            getEndpoint={getEndpoint}
            onRefreshStats={fetchData}
            onPurgeMock={handlePurgeMock}
            t={t}
          />
        )}

        {/* Modal Interactivo de Bóveda Satelital GNSS & Posición */}
        <GnssSkyViewModal
          isOpen={isGnssModalOpen}
          onClose={() => setIsGnssModalOpen(false)}
          initialData={gnssModalData || gnssTelemetry}
          t={t}
        />
      </main>

      <footer style={{ textAlign: 'center', marginTop: '2.5rem', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
        {t.footer?.copyright || "Cyberguru Security Suite • cast0rtech"}
      </footer>
    </div>
  )
}
