import React, { useState, useEffect } from 'react'
import { Shield, Activity, Radio } from './Icons'

export default function Header({ isScanning, lastScanTime, lang = 'es', onLangChange, t }) {
  const [time, setTime] = useState(new Date().toLocaleTimeString())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(timer)
  }, [])

  const headerT = t?.header || {}

  return (
    <header className="glass-panel" style={{ margin: '1rem', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <img
          src="/app_icon.png"
          alt="Cyberguru Logo"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            border: '1px solid var(--accent-cyan)',
            boxShadow: '0 0 15px var(--accent-cyan-glow)',
            objectFit: 'cover'
          }}
        />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              CYBERGURU
            </h1>
            <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(0, 242, 254, 0.1)', color: 'var(--accent-cyan)', border: '1px solid rgba(0, 242, 254, 0.3)', fontWeight: '600' }}>
              {headerT.soc_agent || "SOC AGENT"}
            </span>
            <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: '600' }}>
              v1.1.0
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {headerT.sensor_desc || "Sensor de Red & Proximidad BLE • network_mode: host"}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        {/* Selector de Idioma (Español / Inglés / Alemán) */}
        <div style={{
          display: 'flex',
          background: 'rgba(15, 23, 42, 0.7)',
          padding: '2px',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          gap: '2px'
        }}>
          {[
            { code: 'es', label: '🇪🇸 ES' },
            { code: 'en', label: '🇬🇧 EN' },
            { code: 'de', label: '🇩🇪 DE' }
          ].map(item => (
            <button
              key={item.code}
              onClick={() => onLangChange && onLangChange(item.code)}
              title={item.code === 'es' ? 'Español' : item.code === 'en' ? 'English' : 'Deutsch'}
              style={{
                background: lang === item.code ? 'var(--accent-cyan-glow)' : 'transparent',
                color: lang === item.code ? 'var(--accent-cyan)' : 'var(--text-muted)',
                border: lang === item.code ? '1px solid rgba(0,242,254,0.3)' : '1px solid transparent',
                borderRadius: '6px',
                padding: '0.3rem 0.55rem',
                fontSize: '0.75rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isScanning ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-cyan)', background: 'rgba(0, 242, 254, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '20px', border: '1px solid var(--accent-cyan)' }}>
            <Radio size={16} className="animate-spin" />
            <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>
              {headerT.scanning || "Escaneando Red..."}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <span className="pulse-green"></span>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', fontWeight: '500' }}>
              {headerT.host_active || "Host Activo"}
            </span>
          </div>
        )}

        <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '1rem' }}>
          <div className="font-mono" style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>
            {time}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
            {headerT.port || "Puerto:"} <span className="font-mono">8080</span>
          </div>
        </div>
      </div>
    </header>
  )
}
