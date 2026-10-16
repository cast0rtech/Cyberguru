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
import { Wifi, Server, Bluetooth, AlertTriangle, Activity, Camera, HardDrive, CheckCircle, Zap, Globe, BarChart } from './components/Icons'

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

  // Sin dispositivos ficticios ni mocks pre-cargados
  const [devices, setDevices] = useState(() => {
    const saved = localStorage.getItem('cyberguru_devices')
    return saved ? JSON.parse(saved) : []
  })
  const [alerts, setAlerts] = useState(() => {
    const saved = localStorage.getItem('cyberguru_alerts')
    return saved ? JSON.parse(saved) : []
  })

  const [activeTab, setActiveTab] = useState('inventory') // 'inventory' | 'stats'
  const [isScanning, setIsScanning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [verifyingDeviceId, setVerifyingDeviceId] = useState(null)
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem('cyberguru_server_url') || '')
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [isGnssModalOpen, setIsGnssModalOpen] = useState(false)
  const [gnssModalData, setGnssModalData] = useState(null)

  const handleOpenGnssModal = (telemetryData = null) => {
    setGnssModalData(telemetryData)
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
      }
    } catch (err) {
      // Error de red
    } finally {
      setIsScanning(false)
    }
  }

  // Registrar dispositivos descubiertos directamente por los sensores del dispositivo cliente (móvil/APK)
  const handleDeviceDiscovered = async (newDev) => {
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
    try {
      await fetch(getEndpoint('/api/devices'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDev)
      })
      await fetchData()
    } catch (e) {
      // Modo offline / standalone en dispositivo móvil
    }
  }

  // Comprobación individual de un dispositivo en tiempo real
  const handleVerifyDevice = async (id) => {
    setVerifyingDeviceId(id)
    try {
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
      // ignore
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
            {t.tabs.inventory} ({devices.length})
          </button>

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
            {t.tabs.stats}
          </button>
        </div>

        {/* Indicador de Estado de Conexión */}
        {isOfflineMode && (
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--accent-rose)',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            padding: '0.35rem 0.75rem'
          }}>
            {t.tabs.offline_warn}
          </div>
        )}
      </div>

      <main style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Fila de Métricas Principales */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          <MetricCard
            title={t.metrics.real_devices}
            value={stats.verified_devices || devices.length}
            subtitle={t.metrics.real_devices_sub}
            icon={CheckCircle}
            color="emerald"
          />
          <MetricCard
            title={t.metrics.avg_latency}
            value={stats.avg_latency_ms ? `${stats.avg_latency_ms.toFixed(0)} ms` : '0 ms'}
            subtitle={stats.gateway_ip ? `Gateway: ${stats.gateway_ip}` : t.metrics.rtt_sub}
            icon={Zap}
            color="cyan"
          />
          <MetricCard
            title={t.metrics.cams}
            value={stats.camera_devices || 0}
            subtitle={t.metrics.cams_sub}
            icon={Camera}
            color="rose"
          />
          <MetricCard
            title={t.metrics.nas}
            value={stats.nas_devices || 0}
            subtitle={t.metrics.nas_sub}
            icon={HardDrive}
            color="emerald"
          />
          <MetricCard
            title={t.metrics.snmp}
            value={stats.snmp_devices || 0}
            subtitle={t.metrics.snmp_sub}
            icon={Server}
            color="amber"
          />
          <MetricCard
            title={t.metrics.alerts}
            value={stats.pending_alerts || alerts.filter(a => !a.acknowledged).length}
            subtitle={`${stats.critical_alerts || 0} ${t.metrics.critical_sub}`}
            icon={AlertTriangle}
            color="rose"
          />
        </div>

        {/* Vista 1: Inventario de Dispositivos */}
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

        {/* Vista 2: Estadísticas y Base de Datos */}
        {activeTab === 'stats' && (
          <StatsAnalytics
            stats={stats}
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
          initialData={gnssModalData}
          t={t}
        />
      </main>

      <footer style={{ textAlign: 'center', marginTop: '2.5rem', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
        {t.footer.copyright}
      </footer>
    </div>
  )
}
