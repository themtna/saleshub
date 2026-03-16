import { useState } from 'react'
import { T, glass, Tabs, Input, Btn } from './ui'

export default function LoginPage({ teams, onLogin }) {
  const [role, setRole] = useState('employee')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [teamId, setTeamId] = useState(teams[0]?.id || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(true)

  const handleSubmit = async () => {
    if (!email || !password || !name) {
      setError('กรุณากรอกข้อมูลให้ครบ')
      return
    }
    setError('')
    setLoading(true)

    try {
      await onLogin({
        email,
        password,
        fullName: name,
        role,
        teamId: role === 'employee' ? teamId : null,
        isSignUp,
      })
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด')
    }
    setLoading(false)
  }

  return (
    <div style={{
      fontFamily: T.font, minHeight: '100vh', background: T.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, position: 'relative', overflow: 'hidden', color: T.text,
    }}>
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: T.accent, filter: 'blur(150px)', opacity: 0.08, top: '-15%', left: '-10%' }} />

      <div style={{ ...glass, padding: '36px 28px', width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, margin: '0 auto 14px',
            background: T.grad1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, boxShadow: '0 10px 30px rgba(108,92,231,0.35)',
          }}>⚡</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>SalesHub</h1>
          <p style={{ margin: '4px 0 0', color: T.textDim, fontSize: 13 }}>ระบบจัดการยอดขาย Real-time</p>
        </div>

        {/* Role */}
        <div style={{ marginBottom: 18 }}>
          <Tabs
            items={[{ id: 'employee', label: '👤 พนักงาน' }, { id: 'manager', label: '🏢 หัวหน้า' }]}
            active={role}
            onChange={setRole}
          />
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 8,
            background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)',
            color: T.danger, fontSize: 13, marginBottom: 14,
          }}>{error}</div>
        )}

        <Input label="ชื่อ-นามสกุล" value={name} onChange={e => setName(e.target.value)} placeholder="สมชาย ใจดี" />
        <Input label="อีเมล" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
        <Input label="รหัสผ่าน" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร" />

        {role === 'employee' && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>เลือกทีม</label>
            <select value={teamId} onChange={e => setTeamId(e.target.value)} style={{
              width: '100%', padding: '13px 16px', borderRadius: T.radiusSm,
              border: `1px solid ${T.border}`, background: 'rgba(10,14,26,0.95)',
              color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', cursor: 'pointer', boxSizing: 'border-box',
            }}>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          <Btn full onClick={handleSubmit} disabled={loading}>
            {loading ? '⏳ กำลังดำเนินการ...' : (isSignUp ? 'สมัครสมาชิก →' : 'เข้าสู่ระบบ →')}
          </Btn>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button onClick={() => setIsSignUp(!isSignUp)} style={{
            background: 'none', border: 'none', color: T.accent,
            fontSize: 13, cursor: 'pointer', fontFamily: T.font,
          }}>
            {isSignUp ? 'มีบัญชีแล้ว? เข้าสู่ระบบ' : 'ยังไม่มีบัญชี? สมัครสมาชิก'}
          </button>
        </div>
      </div>
    </div>
  )
}
