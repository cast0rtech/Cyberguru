import React, { useState } from 'react'
import {
  Search, Wifi, Server, Bluetooth, Radio, Camera, HardDrive, Globe, Cpu, Smartphone,
  CheckCircle, RefreshCw, Zap, Zigbee, ZWave, Thread, UWB, NFC, GPS, LPWAN, MapPin
} from './Icons'

export default function DeviceTable({ devices, loading, onVerifyDevice, verifyingDeviceId, t }) {
  const [filterType, setFilterType] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  const tbT = t?.table || {}
  const tabNames = tbT.tabs || {}

  const filteredDevices = devices.filter(dev => {
    const matchesType = 
      filterType === 'ALL' ||
      (filterType === 'Gateway' && (dev.is_gateway || dev.device_type === 'Gateway/Router')) ||
      (filterType === 'Workstation' && (dev.device_type === 'Workstation/PC')) ||
      (filterType === 'Camera' && dev.device_type === 'Camera') ||
      (filterType === 'NAS' && dev.device_type === 'NAS') ||
      (filterType === 'SNMP' && dev.snmp_enabled) ||
      (filterType === 'BLE' && dev.device_type === 'BLE') ||
      (filterType === 'NFC' && dev.device_type === 'NFC') ||
      (filterType === 'GPS' && dev.device_type === 'GPS') ||
      (filterType === 'Zigbee' && dev.device_type === 'Zigbee') ||
      (filterType === 'ZWave' && (dev.device_type === 'Z-Wave' || dev.device_type === 'ZWave')) ||
      (filterType === 'Thread' && dev.device_type === 'Thread') ||
      (filterType === 'UWB' && dev.device_type === 'UWB') ||
      (filterType === 'LPWAN' && dev.device_type === 'LPWAN') ||
      (filterType === 'WiFi' && dev.device_type === 'WiFi') ||
      (filterType === 'Ethernet' && dev.device_type === 'Ethernet')

    const matchesSearch = 
      (dev.ip && dev.ip.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (dev.mac && dev.mac.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (dev.hostname && dev.hostname.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (dev.vendor && dev.vendor.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (dev.services && dev.services.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (dev.verification_method && dev.verification_method.toLowerCase().includes(searchTerm.toLowerCase()))

    return matchesType && matchesSearch
  })

  const getBadgeClass = (type, snmp, isGateway) => {
    if (isGateway || type === 'Gateway/Router') return "badge badge-gateway"
    if (type === 'Camera') return "badge badge-camera"
    if (type === 'NAS') return "badge badge-nas"
    if (type === 'Zigbee') return "badge badge-zigbee"
    if (type === 'Z-Wave' || type === 'ZWave') return "badge badge-zwave"
    if (type === 'Thread') return "badge badge-thread"
    if (type === 'UWB') return "badge badge-uwb"
    if (type === 'NFC') return "badge badge-nfc"
    if (type === 'GPS') return "badge badge-gps"
    if (type === 'LPWAN') return "badge badge-lpwan"
    if (snmp) return "badge badge-snmp"
    switch (type) {
      case 'BLE': return "badge badge-ble"
      case 'WiFi': return "badge badge-wifi"
      case 'Workstation/PC': return "badge badge-workstation"
      default: return "badge badge-ethernet"
    }
  }

  const getTypeIcon = (type, snmp, isGateway) => {
    if (isGateway || type === 'Gateway/Router') return <Globe size={12} />
    if (type === 'Camera') return <Camera size={12} />
    if (type === 'NAS') return <HardDrive size={12} />
    if (type === 'Zigbee') return <Zigbee size={12} />
    if (type === 'Z-Wave' || type === 'ZWave') return <ZWave size={12} />
    if (type === 'Thread') return <Thread size={12} />
    if (type === 'UWB') return <UWB size={12} />
    if (type === 'NFC') return <NFC size={12} />
    if (type === 'GPS') return <GPS size={12} />
    if (type === 'LPWAN') return <LPWAN size={12} />
    if (snmp) return <Server size={12} />
    if (type === 'Workstation/PC') return <Cpu size={12} />
    if (type === 'Mobile') return <Smartphone size={12} />
    if (type === 'BLE') return <Bluetooth size={12} />
    if (type === 'WiFi') return <Wifi size={12} />
    return <Radio size={12} />
  }

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return '-'
    const date = new Date(timestamp)
    return date.toLocaleTimeString()
  }

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-main)', margin: 0 }}>
              {tbT.title || "Inventario de Dispositivos Reales Comprobados"}
            </h3>
            <span style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--accent-emerald)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontSize: '0.65rem',
              fontWeight: '700',
              padding: '0.15rem 0.45rem',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}>
              <CheckCircle size={10} />
              {tbT.badge_active || "VERIFICACIÓN ACTIVA"}
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', margin: 0 }}>
            {filteredDevices.length} {tbT.subtitle || "equipos confirmados mediante respuesta activa (ping / sockets / tabla ARP)."}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Barra de Búsqueda */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '10px', color: 'var(--text-dim)' }}>
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder={tbT.search_placeholder || "Buscar IP, MAC, Fabricante..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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

          {/* Filtros de Pestaña */}
          <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.6)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '2px' }}>
            {[
              { id: 'ALL', label: tabNames.all || 'Todos' },
              { id: 'Gateway', label: tabNames.gateway || '🌐 Gateway' },
              { id: 'Workstation', label: tabNames.workstation || '💻 PCs' },
              { id: 'Camera', label: tabNames.camera || '📷 Cámaras' },
              { id: 'NAS', label: tabNames.nas || '💾 NAS' },
              { id: 'SNMP', label: tabNames.snmp || 'SNMP' },
              { id: 'BLE', label: tabNames.ble || 'BLE' },
              { id: 'NFC', label: '🏷️ NFC' },
              { id: 'GPS', label: '🛰️ GPS' },
              { id: 'Zigbee', label: '🐝 Zigbee' },
              { id: 'ZWave', label: '🌊 Z-Wave' },
              { id: 'Thread', label: '🧵 Thread' },
              { id: 'UWB', label: '📶 UWB' },
              { id: 'LPWAN', label: '📻 LPWAN' },
              { id: 'WiFi', label: tabNames.wifi || 'WiFi' },
              { id: 'Ethernet', label: tabNames.ethernet || 'Ethernet' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                style={{
                  background: filterType === tab.id ? 'var(--accent-cyan-glow)' : 'transparent',
                  color: filterType === tab.id ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  border: filterType === tab.id ? '1px solid rgba(0,242,254,0.3)' : '1px solid transparent',
                  borderRadius: '6px',
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla Responsiva */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>{tbT.th_device || "Dispositivo / Host"}</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>{tbT.th_mac || "Dirección MAC"}</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>{tbT.th_vendor || "Fabricante Real (OUI)"}</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>{tbT.th_type || "Tipo"}</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>{tbT.th_verification || "Comprobación / Latencia"}</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>{tbT.th_services || "Servicios Activos"}</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>{tbT.th_status || "Estado"}</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: '600', textAlign: 'center' }}>{tbT.th_action || "Acción"}</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-dim)' }}>
                  <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      background: 'rgba(0, 242, 254, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-cyan)'
                    }}>
                      <Search size={24} />
                    </div>
                    <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                      {devices.length === 0 ? (tbT.empty_title || 'No hay dispositivos alistados aún') : (tbT.no_match || 'No hay coincidencias')}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {devices.length === 0
                        ? (tbT.empty_desc || 'Cyberguru no muestra equipos de prueba ficticios. Ejecuta un escaneo para descubrir y verificar activamente los dispositivos reales en tu red local.')
                        : (tbT.no_match || 'Prueba cambiando el filtro de búsqueda.')}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredDevices.map((dev) => {
                const isVerifying = verifyingDeviceId === dev.id
                return (
                  <tr
                    key={dev.id || dev.mac}
                    style={{
                      borderBottom: '1px solid rgba(30, 41, 59, 0.5)',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(30, 41, 59, 0.4)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Dispositivo / Host */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                          {dev.hostname || 'Host LAN'}
                        </span>
                        {dev.is_gateway && (
                          <span style={{
                            background: 'rgba(99, 102, 241, 0.2)',
                            color: 'var(--accent-indigo)',
                            fontSize: '0.65rem',
                            fontWeight: '700',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px'
                          }}>
                            GATEWAY
                          </span>
                        )}
                      </div>
                      <div className="font-mono" style={{ fontSize: '0.75rem', color: dev.ip === '0.0.0.0' ? 'var(--text-dim)' : 'var(--accent-cyan)' }}>
                        {dev.ip === '0.0.0.0' ? 'Sin IP (BLE)' : dev.ip}
                      </div>
                    </td>

                    {/* MAC */}
                    <td className="font-mono" style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>
                      {dev.mac}
                    </td>

                    {/* Fabricante OUI */}
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                      {dev.vendor}
                    </td>

                    {/* Tipo */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className={getBadgeClass(dev.device_type, dev.snmp_enabled, dev.is_gateway)}>
                        {getTypeIcon(dev.device_type, dev.snmp_enabled, dev.is_gateway)}
                        {dev.is_gateway ? 'Gateway' : dev.device_type === 'Camera' ? 'Cámara' : dev.device_type}
                      </span>
                    </td>

                    {/* Comprobación / Latencia */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{
                          background: dev.verified ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: dev.verified ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                          border: `1px solid ${dev.verified ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          <CheckCircle size={10} />
                          {dev.verified ? (tbT.verified || 'Comprobado') : (tbT.not_verified || 'No verificado')}
                        </span>
                        {dev.response_time_ms > 0 && (
                          <span className="font-mono" style={{
                            fontSize: '0.75rem',
                            color: dev.response_time_ms <= 20 ? 'var(--accent-emerald)' : dev.response_time_ms <= 100 ? 'var(--accent-cyan)' : 'var(--accent-amber)',
                            fontWeight: '600'
                          }}>
                            {dev.response_time_ms} ms
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                        {dev.verification_method || 'Respuesta de red validada'}
                      </div>
                    </td>

                    {/* Servicios / Telemetría */}
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {dev.services && (
                          <span style={{ color: 'var(--accent-cyan)', fontWeight: '500' }}>
                            {dev.services}
                          </span>
                        )}
                        {dev.coordinates && (
                          <a
                            href={`https://www.google.com/maps?q=${dev.coordinates}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              color: 'var(--accent-emerald)',
                              fontSize: '0.7rem',
                              textDecoration: 'none',
                              background: 'rgba(16, 185, 129, 0.1)',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                              width: 'fit-content'
                            }}
                          >
                            <MapPin size={11} />
                            <span>GPS: {dev.coordinates}</span>
                          </a>
                        )}
                        {dev.rssi ? (
                          <span className="font-mono" style={{ fontSize: '0.7rem', color: dev.rssi > -65 ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                            Potencia RSSI: {dev.rssi} dBm
                          </span>
                        ) : !dev.services && !dev.coordinates ? (
                          <span>{dev.os_info || 'Protocolo validado'}</span>
                        ) : null}
                      </div>
                    </td>

                    {/* Estado */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span className={dev.status === 'online' ? "pulse-green" : "pulse-red"}></span>
                        <span style={{
                          fontSize: '0.75rem',
                          color: dev.status === 'online' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                          fontWeight: '600'
                        }}>
                          {dev.status === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <div className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>
                        {formatLastSeen(dev.last_seen)}
                      </div>
                    </td>

                    {/* Acción: Re-comprobar individual */}
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      {onVerifyDevice && dev.ip && dev.ip !== '0.0.0.0' && (
                        <button
                          onClick={() => onVerifyDevice(dev.id)}
                          disabled={isVerifying}
                          title={tbT.verify_btn || "Volver a comprobar este dispositivo en tiempo real"}
                          style={{
                            background: isVerifying ? 'rgba(0, 242, 254, 0.2)' : 'rgba(30, 41, 59, 0.8)',
                            border: '1px solid var(--border-subtle)',
                            color: isVerifying ? 'var(--accent-cyan)' : 'var(--text-main)',
                            borderRadius: '6px',
                            padding: '0.3rem 0.6rem',
                            fontSize: '0.7rem',
                            fontWeight: '600',
                            cursor: isVerifying ? 'wait' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <RefreshCw size={12} className={isVerifying ? 'animate-spin' : ''} />
                          {isVerifying ? (tbT.verifying_btn || 'Comprobando') : (tbT.verify_btn || 'Comprobar')}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
