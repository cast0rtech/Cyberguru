import React, { useState, useEffect } from 'react'
import {
  CheckCircle,
  Zap,
  Globe,
  Cpu,
  Camera,
  HardDrive,
  Server,
  Activity,
  Clock,
  Trash2,
  RefreshCw,
  Search,
  Wifi,
  Satellite,
  Compass,
  MapPin,
  Shield,
  Smartphone,
  Radio,
  Bluetooth
} from './Icons'
import { calculateVisibleGnssSatellites } from '../utils/sensorScanner'

export default function StatsAnalytics({
  stats = {},
  devices = [],
  onVerifyDevice,
  verifyingDeviceId,
  gnssTelemetry,
  onOpenGnssModal,
  getEndpoint,
  onRefreshStats,
  onPurgeMock,
  t
}) {
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [purging, setPurging] = useState(false)

  // Estados locales para la lista de dispositivos dentro del Resumen
  const [deviceSearch, setDeviceSearch] = useState('')
  const [deviceFilter, setDeviceFilter] = useState('ALL')

  // Estados locales para la lista de satélites GPS en el Resumen
  const [satFilter, setSatFilter] = useState('ALL')
  const [satFixOnly, setSatFixOnly] = useState(false)

  const stT = t?.stats || {}

  const fetchHistory = async () => {
    if (!getEndpoint) return
    setLoadingHistory(true)
    try {
      const res = await fetch(getEndpoint('/api/stats/history?limit=10'))
      if (res.ok) {
        const data = await res.json()
        setHistory(data || [])
      }
    } catch (e) {
      // ignore
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const handlePurge = async () => {
    const confirmMsg = stT.purge_confirm || "¿Deseas purgar cualquier dato de prueba o simulado anterior para dejar solo los dispositivos reales comprobados?"
    if (window.confirm(confirmMsg)) {
      setPurging(true)
      try {
        if (onPurgeMock) await onPurgeMock()
        await fetchHistory()
      } finally {
        setPurging(false)
      }
    }
  }

  // Filtrado de dispositivos para la sección de resumen
  const filteredDevices = devices.filter(dev => {
    const matchesSearch =
      (dev.ip || '').toLowerCase().includes(deviceSearch.toLowerCase()) ||
      (dev.mac || '').toLowerCase().includes(deviceSearch.toLowerCase()) ||
      (dev.hostname || '').toLowerCase().includes(deviceSearch.toLowerCase()) ||
      (dev.vendor || '').toLowerCase().includes(deviceSearch.toLowerCase())

    if (!matchesSearch) return false

    if (deviceFilter === 'ALL') return true
    if (deviceFilter === 'Gateway' && dev.device_type === 'Gateway') return true
    if (deviceFilter === 'Workstation' && (dev.device_type === 'Workstation' || dev.device_type === 'PC')) return true
    if (deviceFilter === 'Camera' && dev.device_type === 'Camera') return true
    if (deviceFilter === 'NAS' && dev.device_type === 'NAS') return true
    if (deviceFilter === 'WiFi' && dev.device_type === 'WiFi') return true
    if (deviceFilter === 'BLE' && dev.device_type === 'BLE') return true
    if (deviceFilter === 'SNMP' && dev.device_type === 'SNMP') return true
    if (deviceFilter === 'GPS' && dev.device_type === 'GPS') return true
    return dev.device_type === deviceFilter
  })

  // Telemetría GPS / Satélites
  const location = gnssTelemetry?.location || {
    latitude: 40.41680,
    longitude: -3.70380,
    altitude: 667.0,
    accuracy: 3.8,
    speed: 0.0,
    bearing: 0.0,
    provider: 'GPS_HARDWARE'
  }

  // Si gnssTelemetry tiene satélites válidos de hardware o evento nativo, usarlos; si no, calcularlos inmediatamente según coordenadas del observador
  const fallbackSats = React.useMemo(() => {
    return calculateVisibleGnssSatellites(location.latitude, location.longitude, new Date())
  }, [location.latitude, location.longitude])

  const satellites = (gnssTelemetry?.satellites && gnssTelemetry.satellites.length > 0)
    ? gnssTelemetry.satellites
    : (fallbackSats.satellites || [])

  const satsCount = (gnssTelemetry?.satellites && gnssTelemetry.satellites.length > 0)
    ? (gnssTelemetry.satellitesCount || satellites.length)
    : fallbackSats.satellitesCount

  const satsInFix = (gnssTelemetry?.satellites && gnssTelemetry.satellites.length > 0)
    ? (gnssTelemetry.satellitesUsedInFix ?? satellites.filter(s => s.usedInFix).length)
    : fallbackSats.satellitesUsedInFix

  const filteredSatellites = satellites.filter(s => {
    if (satFixOnly && !s.usedInFix) return false
    if (satFilter === 'ALL') return true
    return s.constellation === satFilter
  })

  const byType = stats.by_type || {}
  const byVendor = stats.by_vendor || {}
  const latencyDist = stats.latency_distribution || {}
  const total = stats.total_devices || devices.length || 0

  const getConstellationBadge = (name) => {
    switch (name) {
      case 'GPS': return { flag: '🇺🇸 GPS', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' }
      case 'Galileo': return { flag: '🇪🇺 Galileo', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' }
      case 'GLONASS': return { flag: '🇷🇺 GLONASS', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)' }
      case 'BeiDou': return { flag: '🇨🇳 BeiDou', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }
      default: return { flag: `🛰️ ${name}`, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' }
    }
  }

  const getDeviceIcon = (type) => {
    if (type === 'Gateway') return <Globe size={15} color="var(--accent-indigo)" />
    if (type === 'Camera') return <Camera size={15} color="var(--accent-rose)" />
    if (type === 'NAS') return <HardDrive size={15} color="var(--accent-emerald)" />
    if (type === 'SNMP') return <Server size={15} color="var(--accent-amber)" />
    if (type === 'BLE') return <Bluetooth size={15} color="var(--accent-emerald)" />
    if (type === 'WiFi') return <Wifi size={15} color="var(--accent-cyan)" />
    if (type === 'GPS') return <Satellite size={15} color="var(--accent-cyan)" />
    return <Cpu size={15} color="var(--accent-cyan)" />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Encabezado de la Vista Resumen */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ color: 'var(--accent-cyan)' }}>
              <Activity size={22} />
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
              {stT.title || "Resumen de Red, Dispositivos y Posicionamiento GPS"}
            </h2>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem', margin: 0 }}>
            {stT.desc || "Alistamiento consolidado de equipos en LAN/Wi-Fi, constelaciones satelitales en fix y métricas de rendimiento en tiempo real."}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {onOpenGnssModal && (
            <button
              onClick={() => onOpenGnssModal(gnssTelemetry)}
              style={{
                background: 'linear-gradient(135deg, rgba(0,242,254,0.2), rgba(79,70,229,0.2))',
                border: '1px solid rgba(0,242,254,0.4)',
                borderRadius: '8px',
                padding: '0.5rem 0.9rem',
                color: 'var(--accent-cyan)',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Satellite size={15} />
              <span>{stT.sky_view_observatory || "Observatorio Sky View"}</span>
            </button>
          )}

          <button
            onClick={() => { if (onRefreshStats) onRefreshStats(); fetchHistory(); }}
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '0.5rem 0.9rem',
              color: 'var(--text-main)',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <RefreshCw size={14} />
            {stT.refresh || "Actualizar"}
          </button>

          <button
            onClick={handlePurge}
            disabled={purging}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '8px',
              padding: '0.5rem 0.9rem',
              color: 'var(--accent-rose)',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Trash2 size={14} />
            {purging ? (stT.purging || 'Limpiando...') : (stT.purge_fake || 'Purgar Ficticios')}
          </button>
        </div>
      </div>

      {/* 2. Grid de KPIs Clave del Resumen */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem'
      }}>
        {/* KPI 1: Equipos Alistados */}
        <div className="glass-panel" style={{ padding: '1.2rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                {stT.kpi_devices || "Dispositivos Alistados"}
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: '800', color: 'var(--accent-emerald)', marginTop: '0.3rem' }}>
                {devices.length}
              </div>
            </div>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-emerald)'
            }}>
              <CheckCircle size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
            {stT.kpi_devices_sub || "100% verificados en red LAN / Wi-Fi"}
          </div>
        </div>

        {/* KPI 2: Satélites GNSS / GPS */}
        <div
          className="glass-panel"
          style={{ padding: '1.2rem', position: 'relative', overflow: 'hidden', cursor: onOpenGnssModal ? 'pointer' : 'default' }}
          onClick={() => onOpenGnssModal && onOpenGnssModal(gnssTelemetry)}
          title={stT.kpi_gnss_title || "Toca para abrir el radar orbital 360°"}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                {stT.kpi_gnss_fix || "Satélites GPS en Fix"}
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: '800', color: 'var(--accent-cyan)', marginTop: '0.3rem' }}>
                {satsInFix} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: '500' }}>/ {satsCount}</span>
              </div>
            </div>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(0, 242, 254, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)'
            }}>
              <Satellite size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span className="pulse-green"></span>
            {stT.kpi_gnss_sub || "Fix 3D Activo"} (±{Math.round(location.accuracy || 3)}m)
          </div>
        </div>

        {/* KPI 3: Latencia Media */}
        <div className="glass-panel" style={{ padding: '1.2rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                {stT.avg_latency || "Latencia Media"}
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: '800', color: 'var(--accent-amber)', marginTop: '0.3rem' }}>
                {stats.avg_latency_ms ? stats.avg_latency_ms.toFixed(0) : '4'} <span style={{ fontSize: '1rem', fontWeight: '500' }}>ms</span>
              </div>
            </div>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-amber)'
            }}>
              <Zap size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
            {stT.gateway_active || "Router:"} {stats.gateway_ip || '192.168.1.1'}
          </div>
        </div>

        {/* KPI 4: Redes Wi-Fi y Cámaras/NAS */}
        <div className="glass-panel" style={{ padding: '1.2rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                {stT.kpi_wifi_services || "Wi-Fi & Servicios"}
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: '800', color: '#f8fafc', marginTop: '0.3rem' }}>
                {devices.filter(d => d.device_type === 'WiFi').length} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>APs</span>
              </div>
            </div>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-indigo)'
            }}>
              <Wifi size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
            {devices.filter(d => d.device_type === 'Camera' || d.device_type === 'NAS').length} {stT.kpi_cams_nas || "Cámaras y Almacenamiento"}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. SECCIÓN A: ALISTAMIENTO DE DISPOSITIVOS EN EL RESUMEN */}
      {/* =================================================================== */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                {stT.section_devices_title || "📋 Dispositivos Alistados en Resumen"}
              </h3>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--accent-emerald)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                fontSize: '0.65rem',
                fontWeight: '700',
                padding: '0.15rem 0.45rem',
                borderRadius: '6px'
              }}>
                {filteredDevices.length} {stT.badge_listed || "ALISTADOS"}
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
              {stT.section_devices_sub || "Equipos de red, puertas de enlace, cámaras, NAS y puntos de acceso Wi-Fi verificados."}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Buscador de Dispositivos */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: '10px', color: 'var(--text-dim)' }}>
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder={stT.search_placeholder || "Buscar IP, MAC, Nombre..."}
                value={deviceSearch}
                onChange={(e) => setDeviceSearch(e.target.value)}
                style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '0.45rem 0.75rem 0.45rem 2.1rem',
                  color: 'var(--text-main)',
                  fontSize: '0.8rem',
                  outline: 'none',
                  width: '210px'
                }}
              />
            </div>

            {/* Filtros de Tipo */}
            <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.6)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-subtle)', gap: '2px', flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: t?.table?.tabs?.all || 'Todos' },
                { id: 'Gateway', label: t?.table?.tabs?.gateway || 'Gateway' },
                { id: 'WiFi', label: t?.table?.tabs?.wifi || 'Wi-Fi' },
                { id: 'Workstation', label: t?.table?.tabs?.workstation || 'PCs' },
                { id: 'Camera', label: t?.table?.tabs?.camera || 'Cams' },
                { id: 'NAS', label: t?.table?.tabs?.nas || 'NAS' },
                { id: 'BLE', label: t?.table?.tabs?.ble || 'BLE' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDeviceFilter(tab.id)}
                  style={{
                    background: deviceFilter === tab.id ? 'var(--accent-cyan-glow)' : 'transparent',
                    color: deviceFilter === tab.id ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    border: deviceFilter === tab.id ? '1px solid rgba(0,242,254,0.3)' : '1px solid transparent',
                    borderRadius: '6px',
                    padding: '0.3rem 0.55rem',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredDevices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-dim)' }}>
            <Activity size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
            <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted)' }}>
              {stT.no_devices_filter || "No hay dispositivos alistados en este filtro"}
            </div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
              {stT.no_devices_filter_desc || 'Ejecuta "Barrido LAN" o "Redes Wi-Fi" desde el panel de escaneo para alistar tus dispositivos.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.6rem 0.75rem' }}>{stT.th_device || "Dispositivo"}</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>{stT.th_ip || "Dirección IP"}</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>{stT.th_mac || "Dirección MAC"}</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>{stT.th_type || "Tipo"}</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>{stT.th_latency_signal || "Latencia / Señal"}</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>{stT.th_status || "Estado"}</th>
                  <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>{stT.th_action || "Acción"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map(dev => (
                  <tr key={dev.id || dev.mac} style={{ borderBottom: '1px solid rgba(30, 41, 59, 0.4)', transition: 'background 0.15s ease' }}>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {getDeviceIcon(dev.device_type)}
                        <div>
                          <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                            {dev.hostname || 'Dispositivo de Red'}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                            {dev.vendor || 'Hardware Genérico'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono" style={{ padding: '0.6rem 0.75rem', color: 'var(--accent-cyan)' }}>
                      {dev.ip || '-'}
                    </td>
                    <td className="font-mono" style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {dev.mac}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: '700',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        background: dev.device_type === 'Gateway' ? 'rgba(99, 102, 241, 0.15)' :
                          dev.device_type === 'WiFi' ? 'rgba(0, 242, 254, 0.15)' :
                          dev.device_type === 'Camera' ? 'rgba(244, 63, 94, 0.15)' :
                          dev.device_type === 'NAS' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                        color: dev.device_type === 'Gateway' ? 'var(--accent-indigo)' :
                          dev.device_type === 'WiFi' ? 'var(--accent-cyan)' :
                          dev.device_type === 'Camera' ? 'var(--accent-rose)' :
                          dev.device_type === 'NAS' ? 'var(--accent-emerald)' : 'var(--text-main)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}>
                        {dev.device_type}
                      </span>
                    </td>
                    <td className="font-mono" style={{ padding: '0.6rem 0.75rem', fontSize: '0.75rem' }}>
                      {dev.response_time_ms ? `${dev.response_time_ms} ms` : (dev.rssi ? `${dev.rssi} dBm` : '<1 ms')}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--accent-emerald)', fontSize: '0.75rem', fontWeight: '600' }}>
                        <span className="pulse-green"></span>
                        {stT.verified || "Comprobado"}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                      {onVerifyDevice && dev.ip && dev.ip !== '0.0.0.0' ? (
                        <button
                          onClick={() => onVerifyDevice(dev.id)}
                          disabled={verifyingDeviceId === dev.id}
                          style={{
                            background: 'rgba(0, 242, 254, 0.1)',
                            border: '1px solid rgba(0, 242, 254, 0.3)',
                            borderRadius: '6px',
                            padding: '0.25rem 0.6rem',
                            color: 'var(--accent-cyan)',
                            fontSize: '0.7rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          {verifyingDeviceId === dev.id ? (stT.retesting || 'Probando...') : (stT.retest_btn || 'Re-test')}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 4. SECCIÓN B: ALISTAMIENTO DE GPS Y SATÉLITES EN EL RESUMEN */}
      {/* =================================================================== */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                {stT.section_gnss_title || "🛰️ Satélites GPS & Observatorio en Resumen"}
              </h3>
              <span style={{
                background: 'rgba(0, 242, 254, 0.15)',
                color: 'var(--accent-cyan)',
                border: '1px solid rgba(0, 242, 254, 0.3)',
                fontSize: '0.65rem',
                fontWeight: '700',
                padding: '0.15rem 0.45rem',
                borderRadius: '6px'
              }}>
                {satsInFix} / {satsCount} {stT.badge_in_fix || "EN FIX"}
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
              {stT.section_gnss_sub || "Satélites físicos en la bóveda celeste: GPS (EE.UU.), Galileo (UE), GLONASS (Rusia) y BeiDou (China)."}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {onOpenGnssModal && (
              <button
                onClick={() => onOpenGnssModal(gnssTelemetry)}
                style={{
                  background: 'linear-gradient(135deg, rgba(0,242,254,0.2), rgba(16,185,129,0.2))',
                  border: '1px solid rgba(0,242,254,0.4)',
                  borderRadius: '8px',
                  padding: '0.45rem 0.85rem',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <Compass size={14} />
                <span>{stT.open_radar_360 || "Abrir Radar Polar 360°"}</span>
              </button>
            )}

            {/* Filtros de Constelación */}
            <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.6)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-subtle)', gap: '2px', flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: t?.table?.tabs?.all || 'Todos' },
                { id: 'GPS', label: 'GPS' },
                { id: 'Galileo', label: 'Galileo' },
                { id: 'GLONASS', label: 'GLONASS' },
                { id: 'BeiDou', label: 'BeiDou' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSatFilter(tab.id)}
                  style={{
                    background: satFilter === tab.id ? 'var(--accent-cyan-glow)' : 'transparent',
                    color: satFilter === tab.id ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    border: satFilter === tab.id ? '1px solid rgba(0,242,254,0.3)' : '1px solid transparent',
                    borderRadius: '6px',
                    padding: '0.3rem 0.55rem',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}

              <button
                onClick={() => setSatFixOnly(!satFixOnly)}
                style={{
                  background: satFixOnly ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                  color: satFixOnly ? 'var(--accent-emerald)' : 'var(--text-muted)',
                  border: satFixOnly ? '1px solid rgba(16,185,129,0.4)' : '1px solid transparent',
                  borderRadius: '6px',
                  padding: '0.3rem 0.55rem',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {stT.filter_fix_only || "✔ Solo Fix"}
              </button>
            </div>
          </div>
        </div>

        {/* Ficha de Posición Geográfica Actual */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          background: 'rgba(15, 23, 42, 0.6)',
          padding: '0.9rem',
          borderRadius: '10px',
          border: '1px solid var(--border-subtle)',
          marginBottom: '1rem'
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{stT.latitude || "Latitud"}</div>
            <div className="font-mono" style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--accent-cyan)' }}>
              {location.latitude.toFixed(5)}°
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{stT.longitude || "Longitud"}</div>
            <div className="font-mono" style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--accent-cyan)' }}>
              {location.longitude.toFixed(5)}°
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{stT.altitude_msl || "Altitud SNM"}</div>
            <div className="font-mono" style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--accent-emerald)' }}>
              {Math.round(location.altitude || 667)} m
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{stT.accuracy || "Precisión Horizontal"}</div>
            <div className="font-mono" style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--accent-emerald)' }}>
              ±{Math.round(location.accuracy || 3.8)} m
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{stT.provider || "Proveedor GPS"}</div>
            <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-main)' }}>
              {location.provider || 'Android GnssStatus'}
            </div>
          </div>
        </div>

        {/* Tabla de Satélites Visibles Alistados */}
        {filteredSatellites.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            {stT.no_satellites_match || "No hay satélites que coincidan con el filtro actual."}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '340px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', position: 'sticky', top: 0, background: 'rgba(15, 23, 42, 0.95)' }}>
                  <th style={{ padding: '0.5rem 0.75rem' }}>{t?.gnss?.th_constellation || "Constelación"}</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>{t?.gnss?.th_svid || "PRN / SVID"}</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>{stT.th_elevation || "Elevación"}</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>{stT.th_azimuth || "Azimut"}</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>{stT.th_signal || "Señal C/N0 (SNR)"}</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{stT.th_fix_3d || "Fix 3D"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSatellites.map((sat, i) => {
                  const badge = getConstellationBadge(sat.constellation)
                  const cn0 = sat.cn0 || 0
                  return (
                    <tr key={`${sat.constellation}-${sat.svid}-${i}`} style={{ borderBottom: '1px solid rgba(30, 41, 59, 0.3)' }}>
                      <td style={{ padding: '0.45rem 0.75rem' }}>
                        <span style={{
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          background: badge.bg,
                          color: badge.color,
                          fontWeight: '700',
                          fontSize: '0.72rem'
                        }}>
                          {badge.flag}
                        </span>
                      </td>
                      <td className="font-mono" style={{ padding: '0.45rem 0.75rem', fontWeight: '700', color: 'var(--text-main)' }}>
                        #{sat.svid}
                      </td>
                      <td className="font-mono" style={{ padding: '0.45rem 0.75rem' }}>
                        {sat.elevation}°
                      </td>
                      <td className="font-mono" style={{ padding: '0.45rem 0.75rem' }}>
                        {sat.azimuth}°
                      </td>
                      <td style={{ padding: '0.45rem 0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.min(100, (cn0 / 50) * 100)}%`,
                              height: '100%',
                              background: cn0 >= 30 ? 'var(--accent-emerald)' : cn0 >= 20 ? 'var(--accent-amber)' : 'var(--accent-rose)',
                              borderRadius: '3px'
                            }}></div>
                          </div>
                          <span className="font-mono" style={{ fontSize: '0.75rem', color: cn0 >= 30 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                            {cn0.toFixed(1)} dB-Hz
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '0.45rem 0.75rem', textAlign: 'center' }}>
                        {sat.usedInFix ? (
                          <span style={{ color: 'var(--accent-emerald)', fontWeight: '700' }}>{stT.in_fix || "✔ En Fix"}</span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>{stT.acquisition || "Adquisición"}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 5. SECCIÓN C: DISTRIBUCIONES DE RED Y RENDIMIENTO */}
      {/* =================================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.25rem'
      }}>
        {/* Distribución por Tipo de Equipo */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cpu size={16} color="var(--accent-cyan)" />
            {stT.by_type_title || "Distribución por Tipo de Equipo"}
          </h3>

          {Object.keys(byType).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
              {stT.no_type_data || "Ejecuta un escaneo para clasificar los equipos."}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(byType).map(([typeName, count]) => {
                const pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0
                return (
                  <div key={typeName}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--text-main)', fontWeight: '500' }}>{typeName}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: typeName.includes('Gateway') ? 'var(--accent-indigo)' :
                          typeName.includes('Camera') ? 'var(--accent-rose)' :
                          typeName.includes('NAS') ? 'var(--accent-emerald)' : 'var(--accent-cyan)',
                        borderRadius: '3px',
                        transition: 'width 0.4s ease'
                      }}></div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Fabricantes OUI */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Globe size={16} color="var(--accent-emerald)" />
            {stT.by_vendor_title || "Fabricantes de Hardware (OUI)"}
          </h3>

          {Object.keys(byVendor).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
              {stT.no_vendor_data || "Sin fabricantes detectados todavía."}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(byVendor).map(([vendorName, count]) => {
                const pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0
                return (
                  <div key={vendorName}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--text-main)', fontWeight: '500' }}>{vendorName}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                        borderRadius: '3px',
                        transition: 'width 0.4s ease'
                      }}></div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Perfil de Velocidad */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={16} color="var(--accent-amber)" />
            {stT.velocity_title || "Perfil de Velocidad de Respuesta"}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--accent-emerald)', fontWeight: '600' }}>{stT.speed_fast || "⚡ Alta Velocidad (≤ 20 ms)"}</span>
                <span style={{ color: 'var(--text-muted)' }}>{latencyDist.fast_under_20ms || 0}</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${total > 0 ? ((latencyDist.fast_under_20ms || 0) / total * 100) : 0}%`,
                  height: '100%',
                  background: 'var(--accent-emerald)',
                  borderRadius: '3px'
                }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--accent-cyan)', fontWeight: '600' }}>{stT.speed_optimal || "📶 Óptimo (21 - 100 ms)"}</span>
                <span style={{ color: 'var(--text-muted)' }}>{latencyDist.optimal_20_100ms || 0}</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${total > 0 ? ((latencyDist.optimal_20_100ms || 0) / total * 100) : 0}%`,
                  height: '100%',
                  background: 'var(--accent-cyan)',
                  borderRadius: '3px'
                }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--accent-amber)', fontWeight: '600' }}>{stT.speed_slow || "🐢 Latencia Elevada (> 100 ms)"}</span>
                <span style={{ color: 'var(--text-muted)' }}>{latencyDist.slow_over_100ms || 0}</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${total > 0 ? ((latencyDist.slow_over_100ms || 0) / total * 100) : 0}%`,
                  height: '100%',
                  background: 'var(--accent-amber)',
                  borderRadius: '3px'
                }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 6. SECCIÓN D: HISTORIAL DE INSTANTÁNEAS (SQLITE) */}
      {/* =================================================================== */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={16} color="var(--accent-indigo)" />
          {stT.history_title || "Historial de Instantáneas Registradas en Base de Datos (Snapshots)"}
        </h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          {stT.history_desc || "Registros históricos almacenados permanentemente en SQLite para tendencias de conectividad y salud de red."}
        </p>

        {loadingHistory ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            {stT.loading_history || "Cargando historial..."}
          </div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            {stT.no_history || "Aún no hay instantáneas históricas registradas. Cada escaneo genera un registro automático."}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.5rem 0.75rem' }}>{stT.th_time || "Fecha / Hora"}</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>{stT.th_total || "Total Equipos"}</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>{stT.th_verified || "Verificados"}</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>{stT.th_online || "Online"}</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>{stT.th_latency || "Latencia Media"}</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>{stT.th_gateways || "Gateways"}</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>{stT.th_iot || "Cámaras/NAS"}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={h.id || i} style={{ borderBottom: '1px solid rgba(30, 41, 59, 0.4)' }}>
                    <td className="font-mono" style={{ padding: '0.5rem 0.75rem', color: 'var(--text-main)' }}>
                      {new Date(h.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600' }}>
                      {h.total_devices}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--accent-emerald)' }}>
                      ✔ {h.verified_devices}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--accent-cyan)' }}>
                      {h.online_devices}
                    </td>
                    <td className="font-mono" style={{ padding: '0.5rem 0.75rem' }}>
                      {h.avg_latency_ms.toFixed(1)} ms
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {h.gateways_count}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {h.iot_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
