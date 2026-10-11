import React, { useState } from 'react'
import { Search, Wifi, Server, Bluetooth, Radio } from './Icons'

export default function DeviceTable({ devices, loading }) {
  const [filterType, setFilterType] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  const filteredDevices = devices.filter(dev => {
    const matchesType = 
      filterType === 'ALL' ||
      (filterType === 'SNMP' && dev.snmp_enabled) ||
      (filterType === dev.device_type)

    const matchesSearch = 
      (dev.ip && dev.ip.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (dev.mac && dev.mac.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (dev.hostname && dev.hostname.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (dev.vendor && dev.vendor.toLowerCase().includes(searchTerm.toLowerCase()))

    return matchesType && matchesSearch
  })

  const getBadgeClass = (type, snmp) => {
    if (snmp) return "badge badge-snmp"
    switch (type) {
      case 'BLE': return "badge badge-ble"
      case 'WiFi': return "badge badge-wifi"
      default: return "badge badge-ethernet"
    }
  }

  const getTypeIcon = (type, snmp) => {
    if (snmp) return <Server size={12} />
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
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-main)' }}>
            Inventario de Dispositivos Detectados
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Total mostrados: {filteredDevices.length} de {devices.length} activos
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
              placeholder="Buscar IP, MAC, Hostname..."
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
                width: '220px'
              }}
            />
          </div>

          {/* Filtros de Pestaña */}
          <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.6)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            {['ALL', 'Ethernet', 'WiFi', 'SNMP', 'BLE'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterType(tab)}
                style={{
                  background: filterType === tab ? 'var(--accent-cyan-glow)' : 'transparent',
                  color: filterType === tab ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  border: filterType === tab ? '1px solid rgba(0,242,254,0.3)' : '1px solid transparent',
                  borderRadius: '6px',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab === 'ALL' ? 'Todos' : tab}
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
              <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>Dispositivo / Host</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>Dirección MAC</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>Fabricante (OUI)</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>Tipo</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>Detalles / Señal</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>Estado</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>Último Visto</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-dim)' }}>
                  No se encontraron dispositivos que coincidan con el criterio de búsqueda.
                </td>
              </tr>
            ) : (
              filteredDevices.map((dev) => (
                <tr
                  key={dev.id || dev.mac}
                  style={{
                    borderBottom: '1px solid rgba(30, 41, 59, 0.5)',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(30, 41, 59, 0.4)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                      {dev.hostname || 'Desconocido'}
                    </div>
                    <div className="font-mono" style={{ fontSize: '0.75rem', color: dev.ip === '0.0.0.0' ? 'var(--text-dim)' : 'var(--accent-cyan)' }}>
                      {dev.ip === '0.0.0.0' ? 'Sin IP (BLE)' : dev.ip}
                    </div>
                  </td>
                  <td className="font-mono" style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>
                    {dev.mac}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                    {dev.vendor}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className={getBadgeClass(dev.device_type, dev.snmp_enabled)}>
                      {getTypeIcon(dev.device_type, dev.snmp_enabled)}
                      {dev.snmp_enabled ? 'SNMP' : dev.device_type}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                    {dev.device_type === 'BLE' && dev.rssi ? (
                      <span className="font-mono" style={{ color: dev.rssi > -65 ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                        RSSI: {dev.rssi} dBm
                      </span>
                    ) : (
                      dev.os_info || 'Protocolo ARP estándar'
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className="pulse-green"></span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: '500' }}>
                        Online
                      </span>
                    </div>
                  </td>
                  <td className="font-mono" style={{ padding: '0.75rem 1rem', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                    {formatLastSeen(dev.last_seen)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
