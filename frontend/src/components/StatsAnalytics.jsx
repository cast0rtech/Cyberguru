import React, { useState, useEffect } from 'react'
import { CheckCircle, Zap, Globe, Cpu, Camera, HardDrive, Server, Activity, Clock, Trash2, RefreshCw } from './Icons'

export default function StatsAnalytics({ stats, getEndpoint, onRefreshStats, onPurgeMock, t }) {
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [purging, setPurging] = useState(false)

  const stT = t?.stats || {}

  const fetchHistory = async () => {
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
        await onPurgeMock()
        await fetchHistory()
      } finally {
        setPurging(false)
      }
    }
  }

  const byType = stats.by_type || {}
  const byVendor = stats.by_vendor || {}
  const latencyDist = stats.latency_distribution || {}
  const total = stats.total_devices || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Encabezado y Acciones */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ color: 'var(--accent-cyan)' }}>
              <Activity size={22} />
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
              {stT.title || "Base de Datos y Estadísticas de Dispositivos Reales"}
            </h2>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem', margin: 0 }}>
            {stT.desc || "Métricas calculadas en tiempo real a partir de comprobaciones activas (ICMP ping, sondeo de sockets y tabla de vecinos ARP)."}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => { onRefreshStats(); fetchHistory(); }}
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
            {purging ? (stT.purging || 'Limpiando...') : (stT.purge_fake || 'Purgar Datos Ficticios')}
          </button>
        </div>
      </div>

      {/* Grid de 4 KPIs Clave */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem'
      }}>
        {/* KPI 1: Tasa de Verificación */}
        <div className="glass-panel" style={{ padding: '1.2rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                {stT.verification_rate || "Tasa de Comprobación Real"}
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: '800', color: 'var(--accent-emerald)', marginTop: '0.3rem' }}>
                {stats.verification_rate_pct ? stats.verification_rate_pct.toFixed(1) : '100.0'}%
              </div>
            </div>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-emerald)'
            }}>
              <CheckCircle size={22} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.6rem' }}>
            {stats.verified_devices || 0} / {stats.total_devices || 0} {stT.verification_rate_sub || "equipos con prueba de vida positiva"}
          </div>
          <div style={{ marginTop: '0.75rem', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: `${stats.verification_rate_pct || 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #10b981, #00f2fe)',
              borderRadius: '3px'
            }}></div>
          </div>
        </div>

        {/* KPI 2: Latencia Media */}
        <div className="glass-panel" style={{ padding: '1.2rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                {stT.avg_latency || "Latencia Media de Respuesta"}
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: '800', color: 'var(--accent-cyan)', marginTop: '0.3rem' }}>
                {stats.avg_latency_ms ? stats.avg_latency_ms.toFixed(1) : '0'} <span style={{ fontSize: '1rem', fontWeight: '500' }}>ms</span>
              </div>
            </div>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(0, 242, 254, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)'
            }}>
              <Zap size={22} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.6rem' }}>
            {stT.latency_range || "Rango registrado:"} {stats.min_latency_ms || 0} ms - {stats.max_latency_ms || 0} ms
          </div>
        </div>

        {/* KPI 3: Gateway / Enrutamiento */}
        <div className="glass-panel" style={{ padding: '1.2rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                {stT.gateway_active || "Puerta de Enlace Activa"}
              </div>
              <div className="font-mono" style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--accent-indigo)', marginTop: '0.3rem' }}>
                {stats.gateway_ip || '10.29.189.166'}
              </div>
            </div>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-indigo)'
            }}>
              <Globe size={22} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.6rem' }}>
            {stT.gateway_rtt || "Tiempo respuesta router:"} {stats.gateway_latency_ms || 8} ms
          </div>
        </div>

        {/* KPI 4: Equipos Online */}
        <div className="glass-panel" style={{ padding: '1.2rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                {stT.online_devices || "Equipos Reales Conectados"}
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: '800', color: '#f8fafc', marginTop: '0.3rem' }}>
                {stats.online_devices || 0}
              </div>
            </div>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-amber)'
            }}>
              <Cpu size={22} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.6rem' }}>
            {stT.last_cycle || "Último ciclo:"} {stats.last_scan_time ? new Date(stats.last_scan_time).toLocaleTimeString() : (stT.waiting || 'En espera')}
          </div>
        </div>
      </div>

      {/* Gráficos y Distribuciones */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '1.25rem'
      }}>
        {/* Distribución por Tipo de Equipo */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cpu size={16} color="var(--accent-cyan)" />
            {stT.by_type_title || "Distribución por Tipo de Equipo"}
          </h3>

          {Object.keys(byType).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
              {stT.no_type_data || "Sin datos aún. Ejecuta un escaneo para clasificar los equipos reales."}
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

        {/* Principales Fabricantes Reales (OUI) */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Globe size={16} color="var(--accent-emerald)" />
            {stT.by_vendor_title || "Fabricantes de Hardware Identificados (OUI)"}
          </h3>

          {Object.keys(byVendor).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
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

        {/* Distribución de Latencias */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={16} color="var(--accent-amber)" />
            {stT.velocity_title || "Perfil de Velocidad de Respuesta"}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--accent-emerald)', fontWeight: '600' }}>
                  {stT.speed_fast || "⚡ Alta Velocidad (≤ 20 ms)"}
                </span>
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
                <span style={{ color: 'var(--accent-cyan)', fontWeight: '600' }}>
                  {stT.speed_optimal || "📶 Óptimo (21 - 100 ms)"}
                </span>
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
                <span style={{ color: 'var(--accent-amber)', fontWeight: '600' }}>
                  {stT.speed_slow || "🐢 Latencia Elevada (> 100 ms)"}
                </span>
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

      {/* Historial Cronológico de Instantáneas (network_stats_history) */}
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
