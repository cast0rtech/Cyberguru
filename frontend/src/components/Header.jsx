import React, { useState, useEffect } from 'react'
import { Shield, Activity, Radio } from './Icons'

export default function Header({ isScanning, lastScanTime }) {
  const [time, setTime] = useState(new Date().toLocaleTimeString())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <header className="glass-panel" style={{ margin: '1rem', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, rgba(0,242,254,0.2) 0%, rgba(99,102,241,0.2) 100%)',
          border: '1px solid var(--accent-cyan)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent-cyan)',
          boxShadow: '0 0 15px var(--accent-cyan-glow)'
        }}>
          <Shield size={24} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              CYBERGURU
            </h1>
            <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(0, 242, 254, 0.1)', color: 'var(--accent-cyan)', border: '1px solid rgba(0, 242, 254, 0.3)', fontWeight: '600' }}>
              SOC AGENT
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Sensor de Red & Proximidad BLE • <span className="font-mono">network_mode: host</span>
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
        {isScanning ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-cyan)', background: 'rgba(0, 242, 254, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '20px', border: '1px solid var(--accent-cyan)' }}>
            <Radio size={16} className="animate-spin" />
            <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>Escaneando Red...</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <span className="pulse-green"></span>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', fontWeight: '500' }}>Host Activo</span>
          </div>
        )}

        <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '1.25rem' }}>
          <div className="font-mono" style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>
            {time}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
            Puerto: <span className="font-mono">8080</span>
          </div>
        </div>
      </div>
    </header>
  )
}
