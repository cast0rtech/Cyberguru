import React from 'react'

export default function MetricCard({ title, value, subtitle, icon: Icon, color = "cyan", trend }) {
  const colorMap = {
    cyan: { text: "var(--accent-cyan)", border: "rgba(0, 242, 254, 0.3)", bg: "rgba(0, 242, 254, 0.1)" },
    emerald: { text: "var(--accent-emerald)", border: "rgba(16, 185, 129, 0.3)", bg: "rgba(16, 185, 129, 0.1)" },
    amber: { text: "var(--accent-amber)", border: "rgba(245, 158, 11, 0.3)", bg: "rgba(245, 158, 11, 0.1)" },
    rose: { text: "var(--accent-rose)", border: "rgba(244, 63, 94, 0.3)", bg: "rgba(244, 63, 94, 0.1)" },
    indigo: { text: "var(--accent-indigo)", border: "rgba(99, 102, 241, 0.3)", bg: "rgba(99, 102, 241, 0.1)" }
  }

  const currentTheme = colorMap[color] || colorMap.cyan

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {title}
        </span>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          background: currentTheme.bg,
          border: `1px solid ${currentTheme.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: currentTheme.text
        }}>
          {Icon && <Icon size={18} />}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span className="font-mono" style={{ fontSize: '1.875rem', fontWeight: '700', color: currentTheme.text }}>
          {value}
        </span>
      </div>

      {subtitle && (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          {subtitle}
        </span>
      )}
    </div>
  )
}
