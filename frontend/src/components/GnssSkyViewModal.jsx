import React, { useState, useEffect, useMemo } from 'react'
import {
  Satellite,
  Compass,
  MapPin,
  Crosshair,
  RefreshCw,
  CheckCircle,
  Activity,
  Zap,
  Shield
} from './Icons'
import { getLiveGnssTelemetry, calculateVisibleGnssSatellites } from '../utils/sensorScanner'

export default function GnssSkyViewModal({ isOpen, onClose, initialData, t }) {
  const [telemetry, setTelemetry] = useState(initialData || null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedConstellation, setSelectedConstellation] = useState('ALL')
  const [onlyFix, setOnlyFix] = useState(false)
  const [hoveredSat, setHoveredSat] = useState(null)
  const [copied, setCopied] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Cargar telemetría GNSS inicial y configurar escucha de eventos
  useEffect(() => {
    if (!isOpen) return

    let isMounted = true

    const fetchTelemetry = async () => {
      try {
        const data = await getLiveGnssTelemetry()
        if (isMounted) {
          setTelemetry(data)
        }
      } catch (err) {
        console.error('[GNSS Modal] Error al obtener telemetría:', err)
      }
    }

    fetchTelemetry()

    // Escuchar eventos en tiempo real desde el puente nativo Android (MainActivity.java)
    const handleNativeGnssUpdate = (event) => {
      if (event.detail && isMounted) {
        const detail = event.detail
        if (Array.isArray(detail.satellites) && detail.satellites.length > 0) {
          setTelemetry(detail)
        } else {
          setTelemetry(prev => {
            const loc = detail.location || prev?.location || { latitude: 40.41680, longitude: -3.70380 }
            const fallback = (prev?.satellites && prev.satellites.length > 0)
              ? prev.satellites
              : calculateVisibleGnssSatellites(loc.latitude, loc.longitude, new Date()).satellites
            return {
              ...prev,
              ...detail,
              location: loc,
              satellites: fallback,
              satellitesCount: fallback.length,
              satellitesUsedInFix: fallback.filter(s => s.usedInFix).length
            }
          })
        }
      }
    }

    window.addEventListener('gnss-update', handleNativeGnssUpdate)

    // Intervalo de sondeo regular para actualizar posiciones orbitales
    let interval = null
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchTelemetry()
      }, 2000)
    }

    return () => {
      isMounted = false
      window.removeEventListener('gnss-update', handleNativeGnssUpdate)
      if (interval) clearInterval(interval)
    }
  }, [isOpen, autoRefresh])

  // Cerrar con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const gnssT = t?.gnss || {
    modal_title: "Observatorio Satelital GNSS & Posicionamiento en Vivo",
    modal_subtitle: "Constelaciones GPS, Galileo, GLONASS y BeiDou con Radar Polar",
    sky_view_title: "Bóveda Celeste / Carta Polar (Sky View)",
    zenith: "Cenit (90°)",
    horizon: "Horizonte (0°)",
    current_position: "Nuestra Posición Actual",
    latitude: "Latitud",
    longitude: "Longitud",
    altitude: "Altitud SNM",
    accuracy: "Precisión Horizontal",
    speed: "Velocidad",
    bearing: "Rumbo / Brújula",
    provider: "Proveedor de Posición",
    fix_status_active: "Fix 3D Activo",
    fix_status_searching: "Buscando Fix Satelital...",
    satellites_visible: "Satélites Visibles",
    satellites_in_fix: "Utilizados en Fix",
    snr_avg: "SNR Medio",
    filter_all: "Todos",
    filter_fix_only: "Solo en Fix",
    th_constellation: "Constelación",
    th_svid: "PRN / SVID",
    th_azimuth: "Azimut",
    th_elevation: "Elevación",
    th_snr: "C/N0 (Señal)",
    th_status: "Estado",
    status_used: "Fijado en Solución",
    status_view: "En Seguimiento",
    open_maps: "Google Maps",
    open_osm: "OpenStreetMap",
    copy_coords: "Copiar Coordenadas",
    coords_copied: "¡Copiadas!"
  }

  const location = telemetry?.location || {
    latitude: 40.41680,
    longitude: -3.70380,
    altitude: 667,
    accuracy: 3.5,
    speed: 0,
    bearing: 0
  }

  const activeSatellites = useMemo(() => {
    if (telemetry?.satellites && telemetry.satellites.length > 0) {
      return telemetry.satellites
    }
    return calculateVisibleGnssSatellites(location.latitude, location.longitude, new Date()).satellites || []
  }, [telemetry, location.latitude, location.longitude])

  // Filtrado de satélites
  const filteredSatellites = useMemo(() => {
    return activeSatellites.filter(sat => {
      if (selectedConstellation !== 'ALL' && sat.constellation !== selectedConstellation) {
        return false
      }
      if (onlyFix && !sat.usedInFix) {
        return false
      }
      return true
    })
  }, [activeSatellites, selectedConstellation, onlyFix])

  // Métricas acumuladas
  const metrics = useMemo(() => {
    const sats = activeSatellites
    if (!sats || sats.length === 0) {
      return { total: 0, inFix: 0, avgSnr: 0, byConstellation: {} }
    }
    const total = sats.length
    const inFix = sats.filter(s => s.usedInFix).length
    const sumSnr = sats.reduce((acc, s) => acc + (s.cn0 || 0), 0)
    const avgSnr = Math.round((sumSnr / total) * 10) / 10

    const byConstellation = {}
    sats.forEach(s => {
      byConstellation[s.constellation] = (byConstellation[s.constellation] || 0) + 1
    })

    return { total, inFix, avgSnr, byConstellation }
  }, [activeSatellites])

  if (!isOpen) return null

  const toDMS = (deg, isLat) => {
    const absolute = Math.abs(deg)
    const degrees = Math.floor(absolute)
    const minutesNotTruncated = (absolute - degrees) * 60
    const minutes = Math.floor(minutesNotTruncated)
    const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1)
    const direction = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W')
    return `${degrees}° ${minutes}' ${seconds}" ${direction}`
  }

  const handleCopyCoords = () => {
    const text = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleManualRefresh = async () => {
    setIsLoading(true)
    try {
      const data = await getLiveGnssTelemetry()
      setTelemetry(data)
    } finally {
      setIsLoading(false)
    }
  }

  // Dimensiones del radar polar
  const radarSize = 360
  const center = radarSize / 2
  const maxRadius = center - 28 // Radio exterior (Elevación 0°)

  // Colores distintivos por constelación GNSS
  const getConstellationColor = (constellation) => {
    switch (constellation) {
      case 'GPS': return '#38bdf8'      // Azul Eléctrico
      case 'Galileo': return '#10b981'  // Verde Esmeralda
      case 'GLONASS': return '#f43f5e'  // Rojo Rubí
      case 'BeiDou': return '#c084fc'   // Púrpura Neón
      case 'SBAS': return '#eab308'     // Dorado / Ámbar
      default: return '#94a3b8'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-[#0b101b] border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(0,242,254,0.15)] flex flex-col my-auto max-h-[92vh] overflow-hidden text-gray-100">
        
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#0d1424]/90">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Satellite size={26} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-wide">{gnssT.modal_title}</h2>
                <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 border border-emerald-500/50 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>{(telemetry?.satellitesUsedInFix ?? metrics.inFix) >= 4 ? gnssT.fix_status_active : gnssT.fix_status_searching}</span>
                </span>
              </div>
              <p className="text-xs text-cyan-300/80 font-mono mt-0.5">
                {gnssT.modal_subtitle} • <span className="text-gray-400">{telemetry?.hardwareSource || 'Receptor Satelital'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleManualRefresh}
              disabled={isLoading}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700 text-gray-200 transition"
              title={gnssT.manual_refresh_title || "Actualizar datos satelitales"}
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin text-cyan-400" : ""} />
              <span className="hidden sm:inline">{gnssT.manual_refresh || "Actualizar"}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
              aria-label={gnssT.close || "Cerrar"}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Tira de Métricas Rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 px-6 py-3 bg-[#080d17] border-b border-gray-800/80 text-xs font-mono">
          <div className="bg-[#101726] p-2.5 rounded-xl border border-gray-800 flex flex-col justify-center">
            <span className="text-gray-400 text-[11px] uppercase tracking-wider">{gnssT.satellites_visible}</span>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-xl font-bold text-cyan-400">{metrics.total}</span>
              <span className="text-gray-500 text-[10px]">{gnssT.satellites_unit || "satélites"}</span>
            </div>
          </div>
          <div className="bg-[#101726] p-2.5 rounded-xl border border-gray-800 flex flex-col justify-center">
            <span className="text-gray-400 text-[11px] uppercase tracking-wider">{gnssT.satellites_in_fix}</span>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-xl font-bold text-emerald-400">{metrics.inFix}</span>
              <span className="text-emerald-500/70 text-[10px]">{gnssT.fix_count_label || "fijados"}</span>
            </div>
          </div>
          <div className="bg-[#101726] p-2.5 rounded-xl border border-gray-800 flex flex-col justify-center">
            <span className="text-gray-400 text-[11px] uppercase tracking-wider">{gnssT.accuracy}</span>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-xl font-bold text-amber-300">±{Math.round(location.accuracy || 3.5)}</span>
              <span className="text-gray-500 text-[10px]">{gnssT.meters_unit || "metros"}</span>
            </div>
          </div>
          <div className="bg-[#101726] p-2.5 rounded-xl border border-gray-800 flex flex-col justify-center">
            <span className="text-gray-400 text-[11px] uppercase tracking-wider">{gnssT.altitude}</span>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-xl font-bold text-sky-300">{Math.round(location.altitude || 667)}</span>
              <span className="text-gray-500 text-[10px]">{gnssT.msl_unit || "m SNM"}</span>
            </div>
          </div>
          <div className="bg-[#101726] p-2.5 rounded-xl border border-gray-800 flex flex-col justify-center">
            <span className="text-gray-400 text-[11px] uppercase tracking-wider">{gnssT.snr_avg}</span>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-xl font-bold text-indigo-300">{metrics.avgSnr}</span>
              <span className="text-gray-500 text-[10px]">dB-Hz</span>
            </div>
          </div>
          <div className="bg-[#101726] p-2.5 rounded-xl border border-gray-800 flex flex-col justify-center">
            <span className="text-gray-400 text-[11px] uppercase tracking-wider">{gnssT.speed} / {gnssT.bearing}</span>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-sm font-bold text-purple-300">{((location.speed || 0) * 3.6).toFixed(1)} km/h</span>
              <span className="text-gray-500 text-[10px]">• {Math.round(location.bearing || 0)}°</span>
            </div>
          </div>
        </div>

        {/* Contenido Principal: Dos Columnas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#0a0f19]">
          
          {/* COLUMNA IZQUIERDA: Radar Polar Celeste (Sky View Dome) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-start bg-[#0d1424] border border-gray-800/80 rounded-2xl p-5 shadow-inner">
            <div className="w-full flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-cyan-300 flex items-center space-x-2">
                <Crosshair size={16} className="text-cyan-400" />
                <span>{gnssT.sky_view_title}</span>
              </span>
              <span className="text-[11px] text-gray-400 font-mono">
                {filteredSatellites.length} de {metrics.total} satélites
              </span>
            </div>

            {/* Radar Canvas SVG */}
            <div className="relative flex items-center justify-center my-2 select-none">
              <svg width={radarSize} height={radarSize} className="overflow-visible drop-shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                <defs>
                  {/* Gradiente de fondo del domo */}
                  <radialGradient id="skyDomeGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#082f49" stopOpacity="0.4" />
                    <stop offset="60%" stopColor="#0c192c" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#060c18" stopOpacity="1" />
                  </radialGradient>
                  {/* Filtro de brillo para satélites en fix */}
                  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Fondo circular del domo */}
                <circle cx={center} cy={center} r={maxRadius} fill="url(#skyDomeGrad)" stroke="#1e293b" strokeWidth="2" />

                {/* Anillos de elevación (60° y 30°) */}
                <circle cx={center} cy={center} r={maxRadius * (1 - 60 / 90)} fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx={center} cy={center} r={maxRadius * (1 - 30 / 90)} fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />

                {/* Etiquetas de elevación */}
                <text x={center + 4} y={center - maxRadius * (1 - 60 / 90) + 12} fill="#64748b" fontSize="9" fontFamily="monospace">60°</text>
                <text x={center + 4} y={center - maxRadius * (1 - 30 / 90) + 12} fill="#64748b" fontSize="9" fontFamily="monospace">30°</text>
                <text x={center + 4} y={center - maxRadius + 14} fill="#64748b" fontSize="9" fontFamily="monospace">0°</text>

                {/* Ejes cardinales principales */}
                <line x1={center} y1={center - maxRadius} x2={center} y2={center + maxRadius} stroke="#1e293b" strokeWidth="1.5" />
                <line x1={center - maxRadius} y1={center} x2={center + maxRadius} y2={center} stroke="#1e293b" strokeWidth="1.5" />

                {/* Ejes diagonales secundarios */}
                <line x1={center - maxRadius * 0.707} y1={center - maxRadius * 0.707} x2={center + maxRadius * 0.707} y2={center + maxRadius * 0.707} stroke="#0f172a" strokeWidth="1" strokeDasharray="2 4" />
                <line x1={center - maxRadius * 0.707} y1={center + maxRadius * 0.707} x2={center + maxRadius * 0.707} y2={center - maxRadius * 0.707} stroke="#0f172a" strokeWidth="1" strokeDasharray="2 4" />

                {/* Cenit central (90° Elevación) */}
                <circle cx={center} cy={center} r="3" fill="#38bdf8" />
                <circle cx={center} cy={center} r="7" fill="none" stroke="#38bdf8" strokeWidth="0.8" opacity="0.6" />

                {/* Indicadores de puntos cardinales */}
                <text x={center} y={center - maxRadius - 10} fill="#f43f5e" fontSize="13" fontWeight="bold" textAnchor="middle">N</text>
                <text x={center + maxRadius + 14} y={center + 4} fill="#94a3b8" fontSize="12" fontWeight="bold" textAnchor="middle">E</text>
                <text x={center} y={center + maxRadius + 18} fill="#94a3b8" fontSize="12" fontWeight="bold" textAnchor="middle">S</text>
                <text x={center - maxRadius - 14} y={center + 4} fill="#94a3b8" fontSize="12" fontWeight="bold" textAnchor="middle">W</text>

                {/* Render de Satélites Visibles */}
                {filteredSatellites.map((sat) => {
                  const r = maxRadius * (1 - sat.elevation / 90)
                  const angleRad = (sat.azimuth - 90) * (Math.PI / 180)
                  const x = center + r * Math.cos(angleRad)
                  const y = center + r * Math.sin(angleRad)
                  const color = getConstellationColor(sat.constellation)
                  const isHovered = hoveredSat?.name === sat.name

                  return (
                    <g
                      key={sat.name}
                      className="cursor-pointer transition-transform duration-150"
                      onMouseEnter={() => setHoveredSat(sat)}
                      onMouseLeave={() => setHoveredSat(null)}
                      onClick={() => setHoveredSat(sat)}
                    >
                      {/* Halo pulsante para satélites utilizados en la solución de navegación (usedInFix) */}
                      {sat.usedInFix && (
                        <circle
                          cx={x}
                          cy={y}
                          r="13"
                          fill="none"
                          stroke={color}
                          strokeWidth="1.2"
                          opacity="0.75"
                          className="animate-pulse"
                        />
                      )}

                      {/* Nodo satelital */}
                      <circle
                        cx={x}
                        cy={y}
                        r={isHovered ? "11" : (sat.usedInFix ? "9.5" : "7.5")}
                        fill={color}
                        stroke="#0a0f19"
                        strokeWidth="2"
                        filter={sat.usedInFix ? "url(#glow)" : undefined}
                      />

                      {/* Texto del SVID / PRN */}
                      <text
                        x={x}
                        y={y + 3}
                        fill="#0b0f19"
                        fontSize={sat.name.length > 3 ? "7" : "8"}
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {sat.svid}
                      </text>
                    </g>
                  )
                })}
              </svg>

              {/* Tooltip flotante al pasar el ratón por un satélite */}
              {hoveredSat && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#111a2e] border border-cyan-500/50 rounded-xl px-3 py-1.5 shadow-2xl text-[11px] font-mono z-30 pointer-events-none flex items-center space-x-3 whitespace-nowrap">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getConstellationColor(hoveredSat.constellation) }}></span>
                    <span className="font-bold text-white">{hoveredSat.name}</span>
                    <span className="text-gray-400">({hoveredSat.constellation})</span>
                  </div>
                  <span className="text-cyan-300">Az: {hoveredSat.azimuth}°</span>
                  <span className="text-emerald-300">El: {hoveredSat.elevation}°</span>
                  <span className="text-amber-300">SNR: {hoveredSat.cn0} dB</span>
                  {hoveredSat.usedInFix ? (
                    <span className="text-emerald-400 font-bold">{gnssT.in_fix_badge || "✓ En Fix"}</span>
                  ) : (
                    <span className="text-gray-500">{gnssT.in_view_badge || "En vista"}</span>
                  )}
                </div>
              )}
            </div>

            {/* Selector de Constelaciones (Filtros) */}
            <div className="w-full flex flex-wrap items-center justify-center gap-1.5 mt-4 pt-3 border-t border-gray-800">
              {['ALL', 'GPS', 'Galileo', 'GLONASS', 'BeiDou'].map((cType) => {
                const count = cType === 'ALL' ? metrics.total : (metrics.byConstellation[cType] || 0)
                const isActive = selectedConstellation === cType
                const color = cType === 'ALL' ? '#38bdf8' : getConstellationColor(cType)

                return (
                  <button
                    key={cType}
                    onClick={() => setSelectedConstellation(cType)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition flex items-center space-x-1.5 ${
                      isActive
                        ? 'bg-cyan-950/80 border border-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                        : 'bg-gray-800/50 border border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></span>
                    <span>{cType === 'ALL' ? gnssT.filter_all : cType}</span>
                    <span className="text-[10px] text-gray-400 font-bold">({count})</span>
                  </button>
                )
              })}

              <button
                onClick={() => setOnlyFix(!onlyFix)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition flex items-center space-x-1.5 ${
                  onlyFix
                    ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                    : 'bg-gray-800/50 border border-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                <span>{onlyFix ? '✓ ' + gnssT.filter_fix_only : gnssT.filter_fix_only}</span>
                <span className="text-[10px] font-bold text-emerald-400">({metrics.inFix})</span>
              </button>
            </div>
          </div>

          {/* COLUMNA DERECHA: Nuestra Posición Actual & Tabla de Satélites */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            
            {/* Tarjeta: NUESTRA POSICIÓN ACTUAL */}
            <div className="bg-[#0d1424] border border-cyan-500/20 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>

              <div className="flex items-center justify-between mb-3 border-b border-gray-800/80 pb-2.5">
                <div className="flex items-center space-x-2">
                  <MapPin size={18} className="text-cyan-400" />
                  <h3 className="text-sm font-bold text-white tracking-wide uppercase">{gnssT.current_position}</h3>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleCopyCoords}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono bg-cyan-950/70 hover:bg-cyan-900/70 border border-cyan-500/40 text-cyan-300 transition"
                  >
                    {copied ? gnssT.coords_copied : gnssT.copy_coords}
                  </button>
                  <a
                    href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg text-xs font-mono bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 transition flex items-center space-x-1"
                  >
                    <span>{gnssT.open_maps}</span>
                    <span className="text-[10px]">↗</span>
                  </a>
                </div>
              </div>

              {/* Grid de Coordenadas y Orientación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 font-mono">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wider">{gnssT.latitude} & {gnssT.longitude}</span>
                  <div className="text-lg font-bold text-white tracking-wide text-cyan-300">
                    {location.latitude.toFixed(6)}°, {location.longitude.toFixed(6)}°
                  </div>
                  <div className="text-xs text-gray-400">
                    {toDMS(location.latitude, true)}, {toDMS(location.longitude, false)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-[#111a2e] p-2.5 rounded-xl border border-gray-800">
                    <span className="text-gray-400 block text-[10px] uppercase">{gnssT.altitude}</span>
                    <span className="text-base font-bold text-white">{Math.round(location.altitude || 0)} m</span>
                  </div>
                  <div className="bg-[#111a2e] p-2.5 rounded-xl border border-gray-800">
                    <span className="text-gray-400 block text-[10px] uppercase">{gnssT.accuracy}</span>
                    <span className="text-base font-bold text-emerald-400">±{(location.accuracy || 3.5).toFixed(1)} m</span>
                  </div>
                  <div className="bg-[#111a2e] p-2.5 rounded-xl border border-gray-800">
                    <span className="text-gray-400 block text-[10px] uppercase">{gnssT.speed}</span>
                    <span className="text-base font-bold text-purple-300">{((location.speed || 0) * 3.6).toFixed(1)} km/h</span>
                  </div>
                  <div className="bg-[#111a2e] p-2.5 rounded-xl border border-gray-800 flex items-center justify-between">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase">{gnssT.bearing}</span>
                      <span className="text-base font-bold text-amber-300">{Math.round(location.bearing || 0)}°</span>
                    </div>
                    <div
                      className="w-6 h-6 rounded-full border border-amber-500/40 flex items-center justify-center transition-transform duration-300"
                      style={{ transform: `rotate(${location.bearing || 0}deg)` }}
                    >
                      <span className="text-amber-400 text-[10px] font-bold">▲</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tarjeta: TABLA DE SATÉLITES EN TIEMPO REAL */}
            <div className="bg-[#0d1424] border border-gray-800/80 rounded-2xl p-4 flex-1 flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-800">
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider font-mono">
                  {gnssT.active_satellites_inv || "Inventario de Satélites Activos"} ({filteredSatellites.length})
                </span>
                <span className="text-[11px] text-gray-400 font-mono">
                  Fix: <strong className="text-emerald-400">{metrics.inFix}</strong> {gnssT.fix_count_label || "fijados"}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[290px] pr-1">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="text-[10px] uppercase tracking-wider text-gray-400 bg-[#080d17]/80 sticky top-0 z-10">
                    <tr>
                      <th className="py-2 px-2.5">{gnssT.th_constellation}</th>
                      <th className="py-2 px-2.5">{gnssT.th_svid}</th>
                      <th className="py-2 px-2.5">{gnssT.th_azimuth}</th>
                      <th className="py-2 px-2.5">{gnssT.th_elevation}</th>
                      <th className="py-2 px-2.5">{gnssT.th_snr}</th>
                      <th className="py-2 px-2.5 text-right">{gnssT.th_status}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {filteredSatellites.map((sat) => {
                      const color = getConstellationColor(sat.constellation)
                      const isHovered = hoveredSat?.name === sat.name

                      return (
                        <tr
                          key={sat.name}
                          onMouseEnter={() => setHoveredSat(sat)}
                          onMouseLeave={() => setHoveredSat(null)}
                          className={`transition ${isHovered ? 'bg-cyan-950/40 text-cyan-200' : 'hover:bg-gray-800/40'}`}
                        >
                          <td className="py-2 px-2.5 flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }}></span>
                            <span className="font-semibold text-white">{sat.constellation}</span>
                          </td>
                          <td className="py-2 px-2.5 font-bold" style={{ color: color }}>
                            {sat.name}
                          </td>
                          <td className="py-2 px-2.5 text-gray-300">{sat.azimuth}°</td>
                          <td className="py-2 px-2.5 text-gray-300">{sat.elevation}°</td>
                          <td className="py-2 px-2.5">
                            <div className="flex items-center space-x-2">
                              <span className="w-7 text-[11px] font-bold text-gray-200">{sat.cn0}</span>
                              <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    sat.cn0 >= 38 ? 'bg-emerald-400' : (sat.cn0 >= 28 ? 'bg-amber-400' : 'bg-rose-400')
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(10, ((sat.cn0 - 15) / 32) * 100))}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-2.5 text-right">
                            {sat.usedInFix ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-400">
                                <span>✓</span>
                                <span>{gnssT.status_used}</span>
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-md text-[10px] bg-gray-800/80 text-gray-400">
                                {gnssT.status_view}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>

        {/* Pie del Modal */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-800 bg-[#080d17] text-xs font-mono">
          <div className="flex items-center space-x-4 text-gray-400 text-[11px]">
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span>GPS (NAVSTAR)</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Galileo (UE)</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>GLONASS (Rusia)</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
              <span>BeiDou (China)</span>
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-1.5 text-gray-400 text-[11px] cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded bg-gray-800 border-gray-700 text-cyan-500 focus:ring-0"
              />
              <span>{gnssT.live_update || "Actualización en vivo (2s)"}</span>
            </label>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-medium text-xs transition"
            >
              {gnssT.close || "Cerrar"}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
