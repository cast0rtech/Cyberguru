import React, { useState } from 'react'
import { RefreshCw, Wifi, Server, Bluetooth, Activity, Camera } from './Icons'

export default function ScannerPanel({ onTriggerScan, isScanning, t }) {
  const [activeType, setActiveType] = useState(null)
  const scT = t?.scanner || {}

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
            {scT.title || "Centro de Control de Escaneo & Rastreo"}
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {scT.desc || "Inspección activa de red: ARP LAN, sondeo SNMP, radar BLE, cámaras IP (RTSP/ONVIF) y almacenamiento NAS (SMB/DSM)"}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => handleScan('arp')}
            disabled={isScanning}
            title={scT.arp_title || "Escanear tabla ARP de la red local"}
          >
            <Wifi size={15} color="var(--accent-cyan)" />
            <span>{scT.arp_btn || "Barrido ARP"}</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => handleScan('snmp')}
            disabled={isScanning}
            title={scT.snmp_title || "Sondear servicios SNMP expuestos en puerto 161"}
          >
            <Server size={15} color="var(--accent-amber)" />
            <span>{scT.snmp_btn || "Sondeo SNMP"}</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => handleScan('ble')}
            disabled={isScanning}
            title={scT.ble_title || "Descubrir balizas y beacons BLE cercanos"}
          >
            <Bluetooth size={15} color="var(--accent-emerald)" />
            <span>{scT.ble_btn || "Radar BLE"}</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => handleScan('iot')}
            disabled={isScanning}
            title={scT.iot_title || "Sondear cámaras de vigilancia (RTSP/ONVIF) y almacenamiento NAS (SMB/DSM)"}
          >
            <Camera size={15} color="var(--accent-rose)" />
            <span>{scT.iot_btn || "Rastrear NAS & Cams"}</span>
          </button>

          <button
            className="btn btn-primary"
            onClick={() => handleScan('all')}
            disabled={isScanning}
          >
            <RefreshCw size={15} className={isScanning ? "animate-spin" : ""} />
            <span>{isScanning ? (scT.scanning_btn || "Escaneando...") : (scT.all_btn || "Escanear Todo")}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
