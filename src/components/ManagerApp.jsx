import { useState, useMemo, useEffect } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { T, glass, fmt, fmtDate, fmtDateFull, sameDay, withinDays, thisMonth, Stat, Tabs, Btn, Input, Toast, Modal, Empty, LiveDot } from './ui'

function FI({ label, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>{label}</label>}
      <input {...props} style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box', ...(props.style || {}) }} />
    </div>
  )
}

export default function ManagerApp({ profile, orders, teams, onCreateTeam, onUpdateTeam, onDeleteTeam, onCreateUser, onUpdateProfile, onFetchProfiles, onFetchByDate, onSignOut }) {
  const [tab, setTab] = useState('dashboard')
  const [dateFilter, setDateFilter] = useState('')
  const [dateOrders, setDateOrders] = useState(null)
  const [toast, setToast] = useState(null)

  // Team modal
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [editTeam, setEditTeam] = useState(null)

  // User modal
  const [showUserModal, setShowUserModal] = useState(false)
  const [userForm, setUserForm] = useState({ email: '', password: '', fullName: '', role: 'employee', teamId: '' })
  const [userLoading, setUserLoading] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [editUserTeam, setEditUserTeam] = useState('')

  // All profiles
  const [allProfiles, setAllProfiles] = useState([])

  useEffect(() => {
    if (onFetchProfiles) onFetchProfiles().then(setAllProfiles)
  }, [])

  const handleDateChange = async (d) => {
    setDateFilter(d)
    if (d && onFetchByDate) setDateOrders(await onFetchByDate(d)); else setDateOrders(null)
  }

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const today = orders.filter(o => sameDay(o.created_at, new Date()))
  const todaySum = today.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
  const todayCod = today.reduce((s, o) => s + (parseFloat(o.cod_amount) || 0), 0)
  const weekSum = orders.filter(o => withinDays(o.created_at, 7)).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
  const monthSum = orders.filter(o => thisMonth(o.created_at)).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)

  const chart7 = useMemo(() => {
    const a = []
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const dy = orders.filter(o => sameDay(o.created_at, d)); a.push({ date: fmtDate(d), ยอดขาย: dy.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0) }) }
    return a
  }, [orders])

  const teamStats = useMemo(() =>
    teams.map(t => ({
      ...t,
      sales: orders.filter(o => o.team_id === t.id && thisMonth(o.created_at)).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0),
      count: orders.filter(o => o.team_id === t.id && thisMonth(o.created_at)).length,
      todaySales: orders.filter(o => o.team_id === t.id && sameDay(o.created_at, new Date())).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0),
      todayCount: orders.filter(o => o.team_id === t.id && sameDay(o.created_at, new Date())).length,
    })).sort((a, b) => b.sales - a.sales)
  , [teams, orders])

  // ยอดขายรายพนักงาน
  const empStats = useMemo(() => {
    const empMap = {}
    orders.forEach(o => {
      if (!o.employee_id) return
      if (!empMap[o.employee_id]) {
        // หาชื่อจาก allProfiles ก่อน ถ้าไม่เจอค่อยใช้จาก order
        const prof = allProfiles.find(p => p.id === o.employee_id)
        empMap[o.employee_id] = {
          id: o.employee_id,
          name: prof?.full_name || o.employee_name || '—',
          team_id: prof?.team_id || o.team_id,
          todaySales: 0, todayCount: 0, weekSales: 0, monthSales: 0, monthCount: 0
        }
      }
      const e = empMap[o.employee_id]
      const amt = parseFloat(o.sale_price) || 0
      if (sameDay(o.created_at, new Date())) { e.todaySales += amt; e.todayCount++ }
      if (withinDays(o.created_at, 7)) e.weekSales += amt
      if (thisMonth(o.created_at)) { e.monthSales += amt; e.monthCount++ }
    })
    return Object.values(empMap).map(e => ({
      ...e,
      teamName: teams.find(t => t.id === e.team_id)?.name || '—',
    })).sort((a, b) => b.monthSales - a.monthSales)
  }, [orders, teams, allProfiles])

  const displayOrders = dateOrders || orders.slice(0, 60)
  const ts = { background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, fontFamily: T.font, fontSize: 13 }

  const handleCreateTeam = async () => {
    const n = newTeamName.trim()
    if (!n) return
    const { error } = await onCreateTeam(n)
    if (error) flash(`❌ ${error.message}`); else { flash(`✅ สร้างทีม "${n}" สำเร็จ`); setNewTeamName(''); setShowTeamModal(false) }
  }

  const handleUpdateTeam = async () => {
    const n = newTeamName.trim()
    if (!n || !editTeam) return
    const { error } = await onUpdateTeam(editTeam.id, n)
    if (error) flash(`❌ ${error.message}`); else { flash(`✅ แก้ชื่อทีมเป็น "${n}" สำเร็จ`); setNewTeamName(''); setEditTeam(null); setShowTeamModal(false) }
  }

  const handleDeleteTeam = async () => {
    if (!editTeam) return
    if (!confirm(`ลบทีม "${editTeam.name}" จริงหรือ?`)) return
    const { error } = await onDeleteTeam(editTeam.id)
    if (error) flash(`❌ ${error.message}`); else { flash(`🗑 ลบทีม "${editTeam.name}" แล้ว`); setEditTeam(null); setShowTeamModal(false) }
  }

  const handleUpdateUserTeam = async () => {
    if (!editUser) return
    const { error } = await onUpdateProfile(editUser.id, { team_id: editUserTeam || null })
    if (error) flash(`❌ ${error.message}`); else {
      flash(`✅ เปลี่ยนทีมของ ${editUser.full_name} สำเร็จ`)
      setEditUser(null)
      if (onFetchProfiles) onFetchProfiles().then(setAllProfiles)
    }
  }

  const handleCreateUser = async () => {
    if (!userForm.email || !userForm.password || !userForm.fullName) { flash('❌ กรุณากรอกให้ครบ'); return }
    if (userForm.password.length < 6) { flash('❌ รหัสผ่านต้อง 6 ตัวขึ้นไป'); return }
    setUserLoading(true)
    const { error } = await onCreateUser({
      email: userForm.email,
      password: userForm.password,
      fullName: userForm.fullName,
      role: userForm.role,
      teamId: userForm.teamId || null,
    })
    if (error) { flash(`❌ ${error.message}`) } else {
      flash(`✅ สร้างบัญชี "${userForm.fullName}" สำเร็จ`)
      setUserForm({ email: '', password: '', fullName: '', role: 'employee', teamId: '' })
      setShowUserModal(false)
      if (onFetchProfiles) onFetchProfiles().then(setAllProfiles)
    }
    setUserLoading(false)
  }

  return (
    <div style={{ fontFamily: T.font, minHeight: '100vh', background: T.bg, color: T.text, paddingBottom: 40 }}>
      <Toast message={toast} />

      {/* Header */}
      <div style={{ ...glass, borderRadius: 0, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.95)', borderBottom: `1px solid ${T.border}`, backdropFilter: 'blur(20px)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 20, fontWeight: 900 }}>⚡ SalesHub</span><LiveDot /></div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>{profile.full_name} — หัวหน้า</div>
        </div>
        <button onClick={onSignOut} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.textDim, fontSize: 12, cursor: 'pointer', fontFamily: T.font }}>ออก</button>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <Tabs items={[
          { id: 'dashboard', label: '📈 ภาพรวม' },
          { id: 'orders', label: '📋 รายงาน' },
          { id: 'teams', label: '👥 ทีม' },
          { id: 'users', label: '🧑‍💼 จัดการผู้ใช้' },
        ]} active={tab} onChange={setTab} />
      </div>

      <div style={{ padding: 16 }}>
        {/* ══ DASHBOARD ══ */}
        {tab === 'dashboard' && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <Stat label="วันนี้" value={todaySum} icon="🔥" gradient={T.grad3} sub={`${today.length} ออเดอร์ · COD ฿${fmt(todayCod)}`} />
            <Stat label="7 วัน" value={weekSum} icon="📊" gradient={T.grad1} />
            <Stat label="เดือนนี้" value={monthSum} icon="🏆" gradient={T.grad2} />
            <Stat label="เฉลี่ย/วัน" value={Math.round(monthSum / Math.max(new Date().getDate(), 1))} icon="📉" gradient={T.grad4} />
          </div>

          {/* กราฟ 7 วัน */}
          <div style={{ ...glass, padding: '18px 14px 10px', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>📈 ยอดขาย 7 วัน</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chart7}>
                <defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.accent} stopOpacity={0.35}/><stop offset="100%" stopColor={T.accent} stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="date" stroke={T.textMuted} fontSize={11} tickLine={false} />
                <YAxis stroke={T.textMuted} fontSize={11} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={ts} formatter={(v) => [`฿${fmt(v)}`, 'ยอดขาย']} />
                <Area type="monotone" dataKey="ยอดขาย" stroke={T.accent} strokeWidth={2.5} fill="url(#gA)" dot={{ r: 3, fill: T.accent }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* กราฟทีม */}
          <div style={{ ...glass, padding: '18px 14px 10px', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>🏅 ผลงานทีม (เดือนนี้)</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={teamStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="name" stroke={T.textMuted} fontSize={11} tickLine={false} />
                <YAxis stroke={T.textMuted} fontSize={11} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={ts} formatter={(v) => [`฿${fmt(v)}`, 'ยอดขาย']} />
                <defs><linearGradient id="gBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.accent}/><stop offset="100%" stopColor="#D4A843"/></linearGradient></defs>
                <Bar dataKey="sales" fill="url(#gBar)" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ยอดขายรายทีม */}
          <div style={{ ...glass, padding: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>👥 ยอดขายรายทีม</div>
            {teamStats.map((t, i) => (
              <div key={t.id} style={{ padding: '12px 0', borderBottom: i < teamStats.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: [T.grad1, T.grad2, T.grad3, T.grad4][i % 4], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>{i + 1}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: T.textDim }}>วันนี้ {t.todayCount} ออเดอร์ · เดือนนี้ {t.count} ออเดอร์</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 900, background: [T.grad1, T.grad2, T.grad3, T.grad4][i % 4], WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>฿{fmt(t.sales)}</div>
                    <div style={{ fontSize: 10, color: T.textDim }}>วันนี้ ฿{fmt(t.todaySales)}</div>
                  </div>
                </div>
                {/* สมาชิกในทีม */}
                <div style={{ paddingLeft: 42 }}>
                  {(() => {
                    const teamEmps = empStats.filter(e => e.team_id === t.id)
                    const teamProfs = allProfiles.filter(p => p.team_id === t.id && p.role === 'employee')
                    const allMembers = [...teamEmps]
                    teamProfs.forEach(p => {
                      if (!teamEmps.find(e => e.id === p.id)) {
                        allMembers.push({ id: p.id, name: p.full_name, todaySales: 0, monthSales: 0 })
                      }
                    })
                    return allMembers.map(e => (
                      <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 12 }}>
                        <span style={{ color: T.textDim }}>👤 {e.name}</span>
                        <div style={{ display: 'flex', gap: 14 }}>
                          <span style={{ color: T.textDim }}>วันนี้ <strong style={{ color: T.text }}>฿{fmt(e.todaySales)}</strong></span>
                          <span style={{ color: T.textDim }}>เดือน <strong style={{ color: T.text }}>฿{fmt(e.monthSales)}</strong></span>
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              </div>
            ))}
          </div>

          {/* อันดับพนักงาน */}
          <div style={{ ...glass, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>🏆 อันดับพนักงาน (เดือนนี้)</div>
            {empStats.map((e, i) => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < empStats.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: i === 0 ? T.grad1 : i === 1 ? T.grad4 : i === 2 ? T.grad2 : T.surfaceAlt,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, color: i < 3 ? '#fff' : T.textDim,
                }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: T.textDim }}>{e.teamName} · {e.monthCount} ออเดอร์</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: T.gold }}>฿{fmt(e.monthSales)}</div>
                  <div style={{ fontSize: 10, color: T.textDim }}>วันนี้ ฿{fmt(e.todaySales)} · 7 วัน ฿{fmt(e.weekSales)}</div>
                </div>
              </div>
            ))}
            {empStats.length === 0 && <Empty text="ยังไม่มีข้อมูลพนักงาน" />}
          </div>
        </>}

        {/* ══ ORDERS REPORT ══ */}
        {tab === 'orders' && <>
          <div style={{ ...glass, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📅 เลือกวันที่ดูรายงาน</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="date" value={dateFilter} onChange={e => handleDateChange(e.target.value)} style={{ flex: 1, padding: '11px 14px', borderRadius: T.radiusSm, background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.text, fontSize: 14, fontFamily: T.font, outline: 'none',  }} />
              {dateFilter && <Btn sm outline onClick={() => handleDateChange('')}>ล้าง</Btn>}
            </div>
            {dateFilter && dateOrders && (
              <div style={{ marginTop: 14, padding: 14, borderRadius: T.radiusSm, background: 'rgba(184,134,11,0.05)', border: '1px solid rgba(184,134,11,0.12)' }}>
                <div style={{ fontSize: 13, color: T.textDim, marginBottom: 6 }}>{fmtDateFull(dateFilter)}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div><div style={{ fontSize: 11, color: T.textMuted }}>ออเดอร์</div><div style={{ fontSize: 22, fontWeight: 900, background: T.grad1, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{dateOrders.length}</div></div>
                  <div><div style={{ fontSize: 11, color: T.textMuted }}>ยอดขาย</div><div style={{ fontSize: 22, fontWeight: 900, background: T.grad2, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>฿{fmt(dateOrders.reduce((s,o)=>s+(parseFloat(o.sale_price)||0),0))}</div></div>
                  <div><div style={{ fontSize: 11, color: T.textMuted }}>COD</div><div style={{ fontSize: 22, fontWeight: 900, background: T.grad3, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>฿{fmt(dateOrders.reduce((s,o)=>s+(parseFloat(o.cod_amount)||0),0))}</div></div>
                </div>
              </div>
            )}
          </div>
          <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
            {displayOrders.length ? displayOrders.map(o => (
              <div key={o.id} style={{ ...glass, padding: '14px 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(184,134,11,0.1)', color: T.gold, marginRight: 8 }}>{o.order_number}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{o.customer_name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 15, background: T.grad2, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>฿{fmt(parseFloat(o.sale_price) || 0)}</div>
                    <div style={{ fontSize: 10, color: T.textDim }}>COD ฿{fmt(parseFloat(o.cod_amount) || 0)}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.8 }}>
                  📱 {o.customer_phone} · 📍 {o.district || '—'} {o.sales_channel && <span>· 📦 {o.sales_channel}</span>}
                  {o.customer_social && <span> · 📘 {o.customer_social}</span>}
                  {o.employee_name && <span> · 👤 {o.employee_name}</span>}
                  {o.remark && <div>💬 {o.remark}</div>}
                </div>
              </div>
            )) : <Empty text="เลือกวันที่เพื่อดูรายงาน" />}
          </div>
        </>}

        {/* ══ TEAMS ══ */}
        {tab === 'teams' && <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>ทีมทั้งหมด ({teams.length})</div>
            <Btn sm onClick={() => { setEditTeam(null); setNewTeamName(''); setShowTeamModal(true) }}>+ สร้างทีม</Btn>
          </div>

          {/* Create / Edit Team Modal */}
          <Modal show={showTeamModal} onClose={() => setShowTeamModal(false)} title={editTeam ? '✏️ แก้ไขทีม' : '🏗 สร้างทีมใหม่'}>
            <FI label="ชื่อทีม" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="ชื่อทีม" />
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn full onClick={editTeam ? handleUpdateTeam : handleCreateTeam} grad={T.grad2}>
                {editTeam ? '💾 บันทึก' : '✅ สร้าง'}
              </Btn>
              <Btn full outline onClick={() => setShowTeamModal(false)}>ยกเลิก</Btn>
            </div>
            {editTeam && (
              <button onClick={handleDeleteTeam} style={{
                width: '100%', marginTop: 12, padding: '12px', borderRadius: T.radiusSm,
                border: `1px solid rgba(214,48,49,0.2)`, background: 'rgba(214,48,49,0.04)',
                color: T.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: T.font,
              }}>🗑 ลบทีมนี้</button>
            )}
          </Modal>

          {teamStats.map((t, i) => (
            <div key={t.id} style={{ ...glass, padding: 18, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                  <div style={{ width: 38, height: 38, borderRadius: T.radiusSm, background: [T.grad1, T.grad2, T.grad3, T.grad4][i % 4], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff' }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: T.textDim }}>วันนี้ {t.todayCount} · เดือน {t.count} ออเดอร์</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, background: [T.grad1, T.grad2, T.grad3, T.grad4][i % 4], WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>฿{fmt(t.sales)}</div>
                    <div style={{ fontSize: 10, color: T.textDim }}>วันนี้ ฿{fmt(t.todaySales)}</div>
                  </div>
                  <button onClick={() => { setEditTeam(t); setNewTeamName(t.name); setShowTeamModal(true) }} style={{
                    padding: '6px 10px', borderRadius: 8, border: `1px solid ${T.border}`,
                    background: T.surfaceAlt, color: T.textDim, fontSize: 12, cursor: 'pointer', fontFamily: T.font,
                  }}>✏️</button>
                </div>
              </div>
              {/* สมาชิกในทีม — รวมคนที่ยังไม่มีออเดอร์ */}
              {(() => {
                const teamEmps = empStats.filter(e => e.team_id === t.id)
                const teamProfs = allProfiles.filter(p => p.team_id === t.id && p.role === 'employee')
                // รวมพนักงานที่มี profile แต่ยังไม่มี order
                const allMembers = [...teamEmps]
                teamProfs.forEach(p => {
                  if (!teamEmps.find(e => e.id === p.id)) {
                    allMembers.push({ id: p.id, name: p.full_name, todaySales: 0, todayCount: 0, monthSales: 0, monthCount: 0 })
                  }
                })
                if (allMembers.length === 0) return null
                return (
                  <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
                    {allMembers.map(e => (
                      <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', fontSize: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 6, background: T.grad1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>{e.name?.[0] || '?'}</div>
                          <span>{e.name}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                          <span style={{ color: T.textDim }}>วันนี้ <strong style={{ color: T.text }}>฿{fmt(e.todaySales)}</strong> ({e.todayCount})</span>
                          <span style={{ color: T.textDim }}>เดือน <strong style={{ color: T.gold }}>฿{fmt(e.monthSales)}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          ))}
        </>}

        {/* ══ USER MANAGEMENT ══ */}
        {tab === 'users' && <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>จัดการผู้ใช้ ({allProfiles.length})</div>
            <Btn sm onClick={() => setShowUserModal(true)}>+ เพิ่มผู้ใช้</Btn>
          </div>

          {/* Create User Modal */}
          <Modal show={showUserModal} onClose={() => setShowUserModal(false)} title="🧑‍💼 เพิ่มผู้ใช้ใหม่">
            <FI label="ชื่อ-นามสกุล *" value={userForm.fullName} onChange={e => setUserForm(p => ({ ...p, fullName: e.target.value }))} placeholder="สมชาย ใจดี" />
            <FI label="อีเมล *" type="email" value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} placeholder="user@example.com" />
            <FI label="รหัสผ่าน * (6 ตัวขึ้นไป)" type="password" value={userForm.password} onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" />

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>ตำแหน่ง</label>
              <select value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))} style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box' }}>
                <option value="employee">👤 พนักงาน</option>
                <option value="manager">🏢 หัวหน้า</option>
              </select>
            </div>

            {userForm.role === 'employee' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>ทีม</label>
                <select value={userForm.teamId} onChange={e => setUserForm(p => ({ ...p, teamId: e.target.value }))} style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">— เลือกทีม —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <Btn full onClick={handleCreateUser} grad={T.grad2} disabled={userLoading}>{userLoading ? '⏳ กำลังสร้าง...' : '✅ สร้างบัญชี'}</Btn>
              <Btn full outline onClick={() => setShowUserModal(false)}>ยกเลิก</Btn>
            </div>
          </Modal>

          {/* Edit User Team Modal */}
          <Modal show={!!editUser} onClose={() => setEditUser(null)} title={`✏️ แก้ทีม — ${editUser?.full_name}`}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>เลือกทีม</label>
              <select value={editUserTeam} onChange={e => setEditUserTeam(e.target.value)} style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box' }}>
                <option value="">— ไม่มีทีม —</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn full onClick={handleUpdateUserTeam} grad={T.grad1}>💾 บันทึก</Btn>
              <Btn full outline onClick={() => setEditUser(null)}>ยกเลิก</Btn>
            </div>
          </Modal>

          {/* User List */}
          {allProfiles.map((p, i) => (
            <div key={p.id} style={{ ...glass, padding: '16px 18px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: T.radiusSm, flexShrink: 0,
                background: p.role === 'manager' ? T.grad3 : T.grad1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 800, color: '#fff',
              }}>{p.full_name?.[0] || '?'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.full_name}</div>
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
                  {p.role === 'manager' ? '🏢 หัวหน้า' : '👤 พนักงาน'}
                  {p.teams?.name && <span> · {p.teams.name}</span>}
                </div>
              </div>
              <button onClick={() => { setEditUser(p); setEditUserTeam(p.team_id || '') }} style={{
                padding: '6px 10px', borderRadius: 8, border: `1px solid ${T.border}`,
                background: T.surfaceAlt, color: T.textDim, fontSize: 12, cursor: 'pointer', fontFamily: T.font,
              }}>✏️ ทีม</button>
            </div>
          ))}
          {allProfiles.length === 0 && <Empty text="ยังไม่มีผู้ใช้" />}
        </>}
      </div>
    </div>
  )
}
