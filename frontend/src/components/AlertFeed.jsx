import React, { useState } from 'react'
import { AlertTriangle, CheckCircle } from './Icons'

export default function AlertFeed({ alerts, onAcknowledgeAlert }) {
  const [showOnlyPending, setShowOnlyPending] = useState(true)

  const displayedAlerts = showOnlyPending 
    ? alerts.filter(a => !a.acknowledged) 
    : alerts

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'danger':
        return <span className="badge badge-severity-danger">Crítica</span>
      case 'warning':
        return <span className="badge badge-severity-warning">Advertencia</span>
      default:
        return <span className="badge badge-severity-info">Informativa</span>
    }
  }

  const formatTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} color="var(--accent-amber)" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: '600', color: 'var(--text-main)' }}>
            Alertas de Ciberseguridad
          </h3>
        </div>

        <button
          onClick={() => setShowOnlyPending(!showOnlyPending)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          {showOnlyPending ? "Ver todas" : "Solo pendientes"}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
        {displayedAlerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-dim)' }}>
            <CheckCircle size={32} color="var(--accent-emerald)" style={{ margin: '0 auto 0.5rem' }} />
            <p style={{ fontSize: '0.85rem' }}>No hay alertas de seguridad pendientes.</p>
          </div>
        ) : (
          displayedAlerts.map((alert) => (
            <div
              key={alert.id}
              style={{
                background: alert.acknowledged ? 'rgba(15, 23, 42, 0.4)' : 'rgba(30, 41, 59, 0.6)',
                border: alert.acknowledged ? '1px solid var(--border-subtle)' : '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '8px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                opacity: alert.acknowledged ? 0.65 : 1
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {getSeverityBadge(alert.severity)}
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>
                    {alert.title}
                  </span>
                </div>
                <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                  {formatTime(alert.timestamp)}
                </span>
              </div>

              <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                {alert.description}
              </p>

              {!alert.acknowledged && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                  <button
                    onClick={() => onAcknowledgeAlert(alert.id)}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '4px',
                      color: 'var(--accent-cyan)',
                      fontSize: '0.7rem',
                      padding: '0.2rem 0.5rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    <CheckCircle size={11} />
                    Resolver
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
