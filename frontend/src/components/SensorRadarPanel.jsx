import React, { useState, useEffect } from 'react'
import {
  Bluetooth,
  NFC,
  GPS,
  UWB,
  Zigbee,
  ZWave,
  Thread,
  LPWAN,
  RefreshCw,
  Activity,
  CheckCircle,
  MapPin,
  Radio,
  Zap,
  Shield,
  Satellite
} from './Icons'
import {
  checkClientCapabilities,
  scanBluetoothBLE,
  scanNFC,
  scanGPSLocation,
  scanUWB,
  scanZigbee,
  scanZWave,
  scanThread,
  scanLPWAN
} from '../utils/sensorScanner'

export default function SensorRadarPanel({ onDeviceDiscovered, onTriggerScan, onOpenGnssModal, isScanning, t }) {
  const [activeSensor, setActiveSensor] = useState(null)
  const [sensorStatus, setSensorStatus] = useState({})
  const [lastMessage, setLastMessage] = useState(null)
  const [capabilities, setCapabilities] = useState({})
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    setCapabilities(checkClientCapabilities())
  }, [])

  const scT = t?.sensors || {
    title: "Centro de Sensores & Hardware Inalámbrico (APK & Multiplataforma)",
    subtitle: "Rastreo activo de sensores físicos y radio: Zigbee, Z-Wave, Thread, UWB, NFC, Bluetooth/BLE, GPS/GNSS y LPWAN",
    scan_all: "Escanear Todos los Sensores",
    scanning: "Escaneando...",
    ready: "Listo",
    detected: "Detectado",
    reading_nfc: "Acerca una tarjeta o tag NFC al dispositivo...",
    gps_fix: "Obteniendo fix satelital GNSS...",
    active_now: "Activo"
  }

  const handleRunSensor = async (type) => {
    setActiveSensor(type)
    setLastMessage(null)

    try {
      let result = null

      switch (type) {
        case 'ble':
          result = await scanBluetoothBLE()
          break
        case 'nfc':
          setLastMessage({ type: 'info', text: scT.reading_nfc })
          result = await scanNFC()
          break
        case 'gps':
          setLastMessage({ type: 'info', text: scT.gps_fix })
          result = await scanGPSLocation()
          break
        case 'uwb':
          result = await scanUWB()
          break
        case 'zigbee':
          result = await scanZigbee()
          break
        case 'zwave':
          result = await scanZWave()
          break
        case 'thread':
          result = await scanThread()
          break
        case 'lpwan':
          result = await scanLPWAN()
          break
        default:
          break
      }

      if (result) {
        setSensorStatus(prev => ({
          ...prev,
          [type]: {
            count: (prev[type]?.count || 0) + 1,
            last: new Date().toLocaleTimeString(),
            lastDevice: result.hostname,
            gnss_telemetry: result.gnss_telemetry || null
          }
        }))

        setLastMessage({
          type: 'success',
          text: (scT.detected_success || '¡{type} detectado con éxito! [{hostname} - {mac}]')
            .replace('{type}', result.device_type)
            .replace('{hostname}', result.hostname)
            .replace('{mac}', result.mac)
        })

        if (onDeviceDiscovered) {
          onDeviceDiscovered(result)
        }
      }

      // Además, si está disponible el backend, ejecutar escaneo en el host
      if (onTriggerScan) {
        await onTriggerScan(type)
      }
    } catch (err) {
      setLastMessage({
        type: 'error',
        text: err.message || (scT.sweep_error || 'Error durante la lectura del sensor.')
      })
    } finally {
      setActiveSensor(null)
    }
  }

  const handleScanAllSensors = async () => {
    setActiveSensor('ALL_SENSORS')
    setLastMessage({ type: 'info', text: scT.sweep_running || 'Ejecutando barrido completo de todos los sensores y protocolos de radio...' })

    try {
      // Ejecutar en secuencia los sensores disponibles
      const gpsRes = await scanGPSLocation().catch(() => null)
      if (gpsRes && onDeviceDiscovered) onDeviceDiscovered(gpsRes)

      const bleRes = await scanBluetoothBLE().catch(() => null)
      if (bleRes && onDeviceDiscovered) onDeviceDiscovered(bleRes)

      const uwbRes = await scanUWB().catch(() => null)
      if (uwbRes && onDeviceDiscovered) onDeviceDiscovered(uwbRes)

      const zbRes = await scanZigbee().catch(() => null)
      if (zbRes && onDeviceDiscovered) onDeviceDiscovered(zbRes)

      const zwRes = await scanZWave().catch(() => null)
      if (zwRes && onDeviceDiscovered) onDeviceDiscovered(zwRes)

      const thRes = await scanThread().catch(() => null)
      if (thRes && onDeviceDiscovered) onDeviceDiscovered(thRes)

      const lpRes = await scanLPWAN().catch(() => null)
      if (lpRes && onDeviceDiscovered) onDeviceDiscovered(lpRes)

      // Notificar al backend para ciclo wireless completo
      if (onTriggerScan) {
        await onTriggerScan('wireless')
      }

      setLastMessage({
        type: 'success',
        text: scT.sweep_completed || '¡Barrido multi-sensor completado! Se actualizaron e integraron todos los nodos de radio en el inventario.'
      })
    } catch (err) {
      setLastMessage({ type: 'error', text: (scT.sweep_error || 'Error durante el barrido multi-sensor: ') + err.message })
    } finally {
      setActiveSensor(null)
    }
  }

  const sensorCards = [
    {
      id: 'ble',
      title: 'Bluetooth / BLE',
      proto: 'IEEE 802.15.1 • 2.4 GHz',
      desc: scT.cards?.ble_desc || 'Beacons, SmartTags, Wearables y Periféricos',
      icon: Bluetooth,
      color: '#34d399',
      border: 'rgba(16, 185, 129, 0.4)',
      bg: 'rgba(16, 185, 129, 0.08)'
    },
    {
      id: 'nfc',
      title: 'NFC Contactless',
      proto: 'ISO/IEC 14443 • 13.56 MHz',
      desc: scT.cards?.nfc_desc || 'Tarjetas RFID, Badges, NTAG y Tokens',
      icon: NFC,
      color: '#facc15',
      border: 'rgba(234, 179, 8, 0.4)',
      bg: 'rgba(234, 179, 8, 0.08)'
    },
    {
      id: 'gps',
      title: 'GPS / GNSS Telemetría',
      proto: 'Galileo / GPS / GLONASS Fix',
      desc: scT.cards?.gps_desc || 'Geoposicionamiento, Altitud y NMEA 0183',
      icon: GPS,
      color: '#4ade80',
      border: 'rgba(34, 197, 94, 0.4)',
      bg: 'rgba(34, 197, 94, 0.08)'
    },
    {
      id: 'uwb',
      title: 'UWB (Ultra-Wideband)',
      proto: 'IEEE 802.15.4z • 6.5-8.0 GHz',
      desc: scT.cards?.uwb_desc || 'Ranging ToF de hiperprecisión y balizas',
      icon: UWB,
      color: '#22d3ee',
      border: 'rgba(6, 182, 212, 0.4)',
      bg: 'rgba(6, 182, 212, 0.08)'
    },
    {
      id: 'zigbee',
      title: 'Zigbee 3.0',
      proto: `IEEE 802.15.4 • ${scT.cards?.mesh_network || 'Red de Malla'}`,
      desc: scT.cards?.zigbee_desc || 'Philips Hue, Zigbee2MQTT, Aqara y Sonoff',
      icon: Zigbee,
      color: '#fbbf24',
      border: 'rgba(245, 158, 11, 0.4)',
      bg: 'rgba(245, 158, 11, 0.08)'
    },
    {
      id: 'zwave',
      title: 'Z-Wave Plus',
      proto: 'ITU-T G.9959 • 868/908 MHz',
      desc: scT.cards?.zwave_desc || 'Controladores Aeotec, Fibaro y Z-Wave JS',
      icon: ZWave,
      color: '#60a5fa',
      border: 'rgba(59, 130, 246, 0.4)',
      bg: 'rgba(59, 130, 246, 0.08)'
    },
    {
      id: 'thread',
      title: 'Thread / Matter',
      proto: '6LoWPAN / IPv6 Mesh',
      desc: scT.cards?.thread_desc || 'Border Routers (Apple, Nest, OpenThread)',
      icon: Thread,
      color: '#c084fc',
      border: 'rgba(168, 85, 247, 0.4)',
      bg: 'rgba(168, 85, 247, 0.08)'
    },
    {
      id: 'lpwan',
      title: 'LPWAN (LoRaWAN)',
      proto: `Semtech UDP 1700 • ${scT.cards?.long_range || 'Larga Distancia'}`,
      desc: scT.cards?.lpwan_desc || 'Gateways ChirpStack, TTN, Dragino, Mikrotik',
      icon: LPWAN,
      color: '#f472b6',
      border: 'rgba(236, 72, 153, 0.4)',
      bg: 'rgba(236, 72, 153, 0.08)'
    }
  ]

  return (
    <div className="glass-panel" style={{
      padding: '1.25rem',
      marginBottom: '1.5rem',
      background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.85) 0%, rgba(10, 15, 30, 0.95) 100%)',
      border: '1px solid rgba(0, 242, 254, 0.25)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
      borderRadius: '12px'
    }}>
      {/* Cabecera del Panel de Sensores */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: isExpanded ? '1rem' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.2), rgba(168, 85, 247, 0.2))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)',
            border: '1px solid rgba(0, 242, 254, 0.4)'
          }}>
            <Radio size={20} className={activeSensor ? "animate-spin" : ""} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)', margin: 0, letterSpacing: '-0.01em' }}>
                {scT.title}
              </h3>
              <span style={{
                fontSize: '0.65rem',
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--accent-emerald)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                fontWeight: '700'
              }}>
                {scT.active_badge || "8 SENSORES ACTIVOS"}
              </span>
              {capabilities.isAndroidApp && (
                <span style={{
                  fontSize: '0.65rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '4px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--accent-indigo)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  fontWeight: '700'
                }}>
                  {scT.android_native_badge || "MODO ANDROID NATIVO"}
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              {scT.subtitle}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={handleScanAllSensors}
            disabled={activeSensor !== null || isScanning}
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}
          >
            <RefreshCw size={14} className={activeSensor === 'ALL_SENSORS' ? "animate-spin" : ""} />
            <span>{activeSensor === 'ALL_SENSORS' ? scT.scanning : scT.scan_all}</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              borderRadius: '6px',
              padding: '0.4rem 0.6rem',
              cursor: 'pointer',
              fontSize: '0.75rem'
            }}
          >
            {isExpanded ? (scT.hide_btn || '▲ Ocultar') : (scT.show_btn || '▼ Mostrar Sensores')}
          </button>
        </div>
      </div>

      {/* Banner de Mensajes / Estado */}
      {lastMessage && (
        <div style={{
          padding: '0.6rem 0.9rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: lastMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : lastMessage.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 242, 254, 0.15)',
          color: lastMessage.type === 'success' ? 'var(--accent-emerald)' : lastMessage.type === 'error' ? 'var(--accent-rose)' : 'var(--accent-cyan)',
          border: `1px solid ${lastMessage.type === 'success' ? 'rgba(16, 185, 129, 0.35)' : lastMessage.type === 'error' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(0, 242, 254, 0.35)'}`
        }}>
          {lastMessage.type === 'success' ? <CheckCircle size={15} /> : <Zap size={15} />}
          <span>{lastMessage.text}</span>
        </div>
      )}

      {/* Grid de 8 Sensores Especializados */}
      {isExpanded && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '0.85rem'
        }}>
          {sensorCards.map((sensor) => {
            const IconComp = sensor.icon
            const isCurrentlyScanning = activeSensor === sensor.id
            const stat = sensorStatus[sensor.id]

            return (
              <div
                key={sensor.id}
                style={{
                  background: sensor.bg,
                  border: `1px solid ${sensor.border}`,
                  borderRadius: '10px',
                  padding: '0.9rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.65rem',
                  transition: 'all 0.2s ease',
                  boxShadow: isCurrentlyScanning ? `0 0 15px ${sensor.border}` : 'none'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '8px',
                        background: 'rgba(15, 23, 42, 0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: sensor.color,
                        border: `1px solid ${sensor.border}`
                      }}>
                        <IconComp size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>
                          {sensor.title}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: sensor.color, fontWeight: '600' }}>
                          {sensor.proto}
                        </div>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '0.6rem',
                      fontWeight: '700',
                      padding: '0.1rem 0.35rem',
                      borderRadius: '4px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      color: isCurrentlyScanning ? 'var(--accent-cyan)' : 'var(--accent-emerald)',
                      border: `1px solid ${isCurrentlyScanning ? 'var(--accent-cyan)' : 'rgba(16, 185, 129, 0.3)'}`
                    }}>
                      {isCurrentlyScanning ? (scT.scanning_status || 'Sondeando...') : stat?.count ? `${stat.count} ${scT.nodes_count || 'Nodos'}` : (scT.active_now || 'Activo')}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.35 }}>
                    {sensor.desc}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.07)', paddingTop: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                    {stat?.last ? `${scT.last_prefix || 'Último:'} ${stat.last}` : (scT.available || 'Sensor disponible')}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {sensor.id === 'gps' && onOpenGnssModal && (
                      <button
                        onClick={() => onOpenGnssModal(stat?.gnss_telemetry || null)}
                        title={scT.view_satellites_title || "Ver satélites visibles y posición actual en el radar polar"}
                        style={{
                          background: 'rgba(6, 182, 212, 0.2)',
                          color: 'var(--accent-cyan)',
                          border: '1px solid rgba(0, 242, 254, 0.45)',
                          borderRadius: '6px',
                          padding: '0.3rem 0.55rem',
                          fontSize: '0.72rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          transition: 'all 0.15s ease',
                          boxShadow: '0 0 10px rgba(0, 242, 254, 0.2)'
                        }}
                      >
                        <Satellite size={12} className="animate-pulse" />
                        <span>{scT.view_satellites || "Satélites"}</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleRunSensor(sensor.id)}
                      disabled={activeSensor !== null || isScanning}
                      style={{
                        background: isCurrentlyScanning ? 'var(--accent-cyan)' : 'rgba(15, 23, 42, 0.9)',
                        color: isCurrentlyScanning ? '#070a12' : sensor.color,
                        border: `1px solid ${sensor.border}`,
                        borderRadius: '6px',
                        padding: '0.3rem 0.65rem',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <IconComp size={12} className={isCurrentlyScanning ? "animate-spin" : ""} />
                      <span>{isCurrentlyScanning ? (scT.scanning_action || 'Rastreando') : (scT.scan_action || 'Escanear')}</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
