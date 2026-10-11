import React, { useState, useEffect } from 'react'
import Header from './components/Header'
import MetricCard from './components/MetricCard'
import ScannerPanel from './components/ScannerPanel'
import DeviceTable from './components/DeviceTable'
import AlertFeed from './components/AlertFeed'
import { Wifi, Server, Bluetooth, AlertTriangle, Activity } from './components/Icons'

export default function App() {
  const [stats, setStats] = useState({
    total_devices: 0,
    online_devices: 0,
    snmp_devices: 0,
    ble_devices: 0,
    total_alerts: 0,
    pending_alerts: 0,
    critical_alerts: 0,
    last_scan_time: ''
  })
  const [devices, setDevices] = useState([])
  const [alerts, setAlerts] = useState([])
  const [isScanning, setIsScanning] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const [statsRes, devRes, alertsRes, healthRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/devices'),
        fetch('/api/alerts'),
        fetch('/api/health')
      ])

      if (statsRes.ok) setStats(await statsRes.json())
      if (devRes.ok) setDevices(await devRes.json())
      if (alertsRes.ok) setAlerts(await alertsRes.json())
      if (healthRes.ok) {
        const health = await healthRes.json()
        setIsScanning(health.is_scanning)
      }
    } catch (err) {
      console.error("Error al sincronizar datos con el backend de Cyberguru:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleTriggerScan = async (scanType) => {
    setIsScanning(true)
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scan_type: scanType })
      })
      if (res.ok) {
        await fetchData()
      }
    } catch (err) {
      console.error("Error al ejecutar escaneo:", err)
    } finally {
      setIsScanning(false)
    }
  }

  const handleAcknowledgeAlert = async (id) => {
    try {
      const res = await fetch(`/api/alerts/${id}/ack`, { method: 'POST' })
      if (res.ok) {
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a))
        fetchData()
      }
    } catch (err) {
      console.error("Error reconociendo alerta:", err)
    }
  }

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '2.5rem' }}>
      <Header isScanning={isScanning} lastScanTime={stats.last_scan_time} />

      <main style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Fila de Métricas */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem'
        }}>
          <MetricCard
            title="Dispositivos Totales"
            value={stats.total_devices}
            subtitle="Inventariados en SQLite"
            icon={Activity}
            color="cyan"
          />
          <MetricCard
            title="Equipos Online"
            value={stats.online_devices}
            subtitle="Activos en la subred local"
            icon={Wifi}
            color="emerald"
          />
          <MetricCard
            title="Servicios SNMP"
            value={stats.snmp_devices}
            subtitle="Puerto UDP 161 respondiendo"
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
            subtitle={`${stats.pending_alerts} alertas pendientes`}
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
        Cyberguru Security Suite &copy; 2026 • Contenedor Autónomo • Docker <span className="font-mono">network_mode: host</span>
      </footer>
    </div>
  )
}
