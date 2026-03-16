import { useState } from 'react'
import { T, glass, Btn } from './ui'

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = async () => {
    if (!email || !password) { setError('กรุณากรอกอีเมลและรหัสผ่าน'); return }
    setError('')
    setLoading(true)
    const errMsg = await onLogin(email, password)
    if (errMsg) { setError(errMsg); setLoading(false) }
    // สำเร็จ → App re-render เอง ไม่ต้องทำอะไร
  }

  return (
    <div style={{ fontFamily: T.font, minHeight: '100vh', background: 'linear-gradient(170deg, #FAFAF7 0%, #F5F0E0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, color: T.text }}>
      <div style={{ ...glass, padding: '40px 30px', width: '100%', maxWidth: 400, boxShadow: '0 8px 40px rgba(184,134,11,0.08)', border: '1px solid rgba(184,134,11,0.2)' }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{ width: 68, height: 68, borderRadius: 18, margin: '0 auto 14px', background: T.grad1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, boxShadow: '0 10px 30px rgba(184,134,11,0.3)', color: '#fff' }}>⚡</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: T.gold }}>ADMIN THE MT</h1>
          <p style={{ margin: '4px 0 0', color: T.textDim, fontSize: 13 }}>ระบบจัดการยอดขาย Real-time</p>
        </div>

        {error && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(214,48,49,0.06)', border: '1px solid rgba(214,48,49,0.15)', color: T.danger, fontSize: 13, marginBottom: 14 }}>{error}</div>}

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>อีเมล</label>
          <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError('') }} placeholder="you@example.com" onKeyDown={e => e.key === 'Enter' && login()}
            style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>รหัสผ่าน</label>
          <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError('') }} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && login()}
            style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <Btn full onClick={login} disabled={loading}>{loading ? '⏳ กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ →'}</Btn>
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: T.textMuted }}>หัวหน้าเป็นผู้สร้างบัญชีให้พนักงาน</div>
      </div>
    </div>
  )
}
