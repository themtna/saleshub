import { useState } from 'react'

// ════════════════════════════════════════════
//  Design Tokens — White & Gold
// ════════════════════════════════════════════
export const T = {
  font: "'DM Sans', 'Noto Sans Thai', sans-serif",
  bg: '#FAFAF7',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F3EE',
  border: 'rgba(0,0,0,0.08)',
  borderGold: 'rgba(184,134,11,0.2)',
  text: '#1a1a1a',
  textDim: 'rgba(0,0,0,0.5)',
  textMuted: 'rgba(0,0,0,0.3)',
  accent: '#B8860B',
  accentLight: '#D4A843',
  success: '#2D8A4E',
  danger: '#D63031',
  gold: '#B8860B',
  goldLight: '#F0D78C',
  grad1: 'linear-gradient(135deg, #B8860B 0%, #D4A843 100%)',
  grad2: 'linear-gradient(135deg, #2D8A4E 0%, #55C57A 100%)',
  grad3: 'linear-gradient(135deg, #C0392B 0%, #E74C3C 100%)',
  grad4: 'linear-gradient(135deg, #D4A843 0%, #F0D78C 100%)',
  radius: 14,
  radiusSm: 10,
}

export const glass = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: T.radius,
  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
}

// ════════════════════════════════════════════
//  Utilities
// ════════════════════════════════════════════
export const fmt = (n) => new Intl.NumberFormat('th-TH').format(Math.round(n))
export const fmtDate = (d) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
export const fmtDateFull = (d) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
export const fmtTime = (d) => new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
export const fmtDateTime = (d) => { const dt = new Date(d); return dt.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ' ' + dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' }

export const sameDay = (a, b) => {
  const x = new Date(a), y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}
export const withinDays = (d, n) => {
  const diff = (new Date() - new Date(d)) / 864e5
  return diff >= 0 && diff < n
}
export const thisMonth = (d) => {
  const now = new Date(), t = new Date(d)
  return now.getFullYear() === t.getFullYear() && now.getMonth() === t.getMonth()
}

// ════════════════════════════════════════════
//  Components
// ════════════════════════════════════════════

export function LiveDot() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: T.success,
        boxShadow: `0 0 8px ${T.success}`, animation: 'livePulse 2s infinite',
      }} />
      <span style={{ fontSize: 11, color: T.textDim, fontWeight: 600, letterSpacing: 1 }}>LIVE</span>
    </span>
  )
}

export function Stat({ label, value, icon, gradient, sub, compact }) {
  return (
    <div style={{
      ...glass, padding: compact ? '14px 16px' : '18px 20px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -20, right: -20, width: 80, height: 80,
        borderRadius: '50%', background: gradient, opacity: 0.1, filter: 'blur(20px)',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>{label}</div>
          <div style={{
            fontSize: compact ? 20 : 28, fontWeight: 900, letterSpacing: -0.5,
            background: gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>฿{fmt(value)}</div>
          {sub && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{sub}</div>}
        </div>
        {icon && <span style={{ fontSize: compact ? 20 : 28, opacity: 0.5 }}>{icon}</span>}
      </div>
    </div>
  )
}

export function Tabs({ items, active, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 3, padding: 3, borderRadius: T.radiusSm,
      background: T.surfaceAlt, border: `1px solid ${T.border}`,
      overflowX: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      {items.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          flex: '1 0 auto', padding: '10px 14px', borderRadius: 8, border: 'none',
          background: active === t.id ? T.grad1 : 'transparent',
          color: active === t.id ? '#fff' : T.textDim,
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          fontFamily: T.font, whiteSpace: 'nowrap', transition: 'all 0.25s ease',
        }}>{t.label}</button>
      ))}
    </div>
  )
}

export function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>{label}</label>}
      <input {...props} style={{
        width: '100%', padding: '13px 16px', borderRadius: T.radiusSm,
        border: `1px solid ${T.border}`, background: '#fff',
        color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none',
        boxSizing: 'border-box', transition: 'border-color 0.2s',
        ...(props.style || {}),
      }} />
    </div>
  )
}

export function Btn({ children, grad, onClick, disabled, full, outline, sm }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: sm ? '10px 18px' : '14px 24px',
      borderRadius: T.radiusSm, border: outline ? `1px solid ${T.border}` : 'none',
      background: disabled ? 'rgba(0,0,0,0.06)' : (outline ? '#fff' : (grad || T.grad1)),
      color: outline ? T.textDim : '#fff',
      fontSize: sm ? 13 : 15, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: T.font, transition: 'all 0.2s',
      width: full ? '100%' : 'auto', opacity: disabled ? 0.4 : 1,
      boxShadow: disabled || outline ? 'none' : '0 4px 16px rgba(184,134,11,0.25)',
    }}>{children}</button>
  )
}

export function Toast({ message }) {
  if (!message) return null
  return (
    <div style={{
      position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
      background: T.grad1, padding: '12px 24px', borderRadius: T.radiusSm,
      fontSize: 14, fontWeight: 600, zIndex: 9999,
      boxShadow: '0 8px 30px rgba(184,134,11,0.3)', fontFamily: T.font,
      animation: 'toastIn 0.35s ease', maxWidth: '90vw', textAlign: 'center', color: '#fff',
    }}>{message}</div>
  )
}

export function Modal({ show, onClose, title, children }) {
  if (!show) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: 20,
    }} onClick={onClose}>
      <div style={{
        ...glass, background: '#fff', padding: '28px 24px',
        width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 800, color: T.text }}>{title}</h3>
        {children}
      </div>
    </div>
  )
}

export function Empty({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '50px 20px', color: T.textMuted }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
      <div style={{ fontSize: 14 }}>{text || 'ไม่มีข้อมูล'}</div>
    </div>
  )
}

// Global CSS
export const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700;800;900&family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
    @keyframes livePulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
    @keyframes toastIn { from { transform:translate(-50%,-120%); opacity:0; } to { transform:translate(-50%,0); opacity:1; } }
    body { background: #FAFAF7; }
    ::-webkit-scrollbar { width:4px; }
    ::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.1); border-radius:4px; }
  `}</style>
)
