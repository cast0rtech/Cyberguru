import React, { useState } from 'react'
import { RefreshCw, Wifi, Server, Bluetooth, Activity, Camera } from './Icons'

export default function ScannerPanel({ onTriggerScan, isScanning }) {
  const [activeType, setActiveType] = useState(null)

  const handleScan = async (type) => {
    setActiveType(type)
    await onTriggerScan(type)
    setActiveType(null)
  }

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} color="var(--accent-cyan)" />
            Centro de Control de Escaneo & Rastreo
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Inspección activa de red: ARP LAN, sondeo SNMP, radar BLE, cámaras IP (RTSP/ONVIF) y almacenamiento NAS (SMB/DSM)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => handleScan('arp')}
            disabled={isScanning}
            title="Escanear tabla ARP de la red local"
          >
            <Wifi size={15} color="var(--accent-cyan)" />
            <span>Barrido ARP</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => handleScan('snmp')}
            disabled={isScanning}
            title="Sondear servicios SNMP expuestos en puerto 161"
          >
            <Server size={15} color="var(--accent-amber)" />
            <span>Sondeo SNMP</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => handleScan('ble')}
            disabled={isScanning}
            title="Descubrir balizas y beacons BLE cercanos"
          >
            <Bluetooth size={15} color="var(--accent-emerald)" />
            <span>Radar BLE</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => handleScan('iot')}
            disabled={isScanning}
            title="Sondear cámaras de vigilancia (RTSP/ONVIF) y almacenamiento NAS (SMB/DSM)"
          >
            <Camera size={15} color="var(--accent-rose)" />
            <span>Rastrear NAS & Cams</span>
          </button>

          <button
            className="btn btn-primary"
            onClick={() => handleScan('all')}
            disabled={isScanning}
          >
            <RefreshCw size={15} className={isScanning ? "animate-spin" : ""} />
            <span>{isScanning ? "Escaneando..." : "Escanear Todo"}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
