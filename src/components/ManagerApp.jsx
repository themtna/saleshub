import { useState, useEffect, useMemo } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { T, glass, fmt, fmtDate, fmtDateFull, sameDay, withinDays, thisMonth, Stat, Tabs, Btn, Toast, Modal, Empty, LiveDot } from './ui'

function FI({ label, ...p }) {
  return <div style={{ marginBottom: 14 }}>{label && <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>{label}</label>}<input {...p} style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box', ...(p.style||{}) }} /></div>
}

export default function ManagerApp({ profile, onLogout }) {
  const [tab, setTab] = useState('dashboard')
  const [orders, setOrders] = useState([])
  const [teams, setTeams] = useState([])
  const [profiles, setProfiles] = useState([])
  const [toast, setToast] = useState(null)
  const [dateFilter, setDateFilter] = useState('')
  const [dateOrders, setDateOrders] = useState(null)

  // Team modal
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [editTeam, setEditTeam] = useState(null)
  const [teamName, setTeamName] = useState('')

  // User modal
  const [showUserModal, setShowUserModal] = useState(false)
  const [userForm, setUserForm] = useState({ email: '', password: '', fullName: '', role: 'employee', teamId: '' })
  const [editUser, setEditUser] = useState(null)
  const [editUserTeam, setEditUserTeam] = useState('')

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 2500) }

  // ═══ โหลดข้อมูลทั้งหมด ═══
  useEffect(() => {
    supabase.from('orders').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setOrders((data || []).map(o => ({ ...o, employee_name: o.employee_name || o.profiles?.full_name || '—' }))))
    supabase.from('teams').select('*').order('name').then(({ data }) => setTeams(data || []))
    supabase.from('profiles').select('*, teams(id, name)').order('created_at', { ascending: false }).then(({ data }) => setProfiles(data || []))

    // Realtime
    const ch = supabase.channel('mgr-orders').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' },
      async (payload) => {
        const o = payload.new
        if (!o.employee_name) {
          try { const { data: p } = await supabase.from('profiles').select('full_name').eq('id', o.employee_id).single(); o.employee_name = p?.full_name || '—' } catch {}
        }
        setOrders(prev => [o, ...prev])
      }
    ).subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  // ═══ Stats ═══
  const today = orders.filter(o => sameDay(o.created_at, new Date()))
  const todaySum = today.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
  const todayCod = today.reduce((s, o) => s + (parseFloat(o.cod_amount) || 0), 0)
  const weekSum = orders.filter(o => withinDays(o.created_at, 7)).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
  const monthSum = orders.filter(o => thisMonth(o.created_at)).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)

  const chart7 = useMemo(() => {
    const a = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); a.push({ date: fmtDate(d), ยอดขาย: orders.filter(o => sameDay(o.created_at, d)).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0) }) }; return a
  }, [orders])

  const teamStats = useMemo(() => teams.map(t => ({
    ...t,
    sales: orders.filter(o => o.team_id === t.id && thisMonth(o.created_at)).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0),
    count: orders.filter(o => o.team_id === t.id && thisMonth(o.created_at)).length,
    todaySales: orders.filter(o => o.team_id === t.id && sameDay(o.created_at, new Date())).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0),
    todayCount: orders.filter(o => o.team_id === t.id && sameDay(o.created_at, new Date())).length,
  })).sort((a, b) => b.sales - a.sales), [teams, orders])

  const empStats = useMemo(() => {
    const m = {}
    orders.forEach(o => {
      if (!o.employee_id) return
      if (!m[o.employee_id]) { const p = profiles.find(x => x.id === o.employee_id); m[o.employee_id] = { id: o.employee_id, name: p?.full_name || o.employee_name || '—', team_id: p?.team_id || o.team_id, todaySales: 0, todayCount: 0, weekSales: 0, monthSales: 0, monthCount: 0 } }
      const e = m[o.employee_id]; const a = parseFloat(o.sale_price) || 0
      if (sameDay(o.created_at, new Date())) { e.todaySales += a; e.todayCount++ }
      if (withinDays(o.created_at, 7)) e.weekSales += a
      if (thisMonth(o.created_at)) { e.monthSales += a; e.monthCount++ }
    })
    // เพิ่มพนักงานที่ยังไม่มี order
    profiles.filter(p => p.role === 'employee' && !m[p.id]).forEach(p => { m[p.id] = { id: p.id, name: p.full_name, team_id: p.team_id, todaySales: 0, todayCount: 0, weekSales: 0, monthSales: 0, monthCount: 0 } })
    return Object.values(m).map(e => ({ ...e, teamName: teams.find(t => t.id === e.team_id)?.name || '—' })).sort((a, b) => b.monthSales - a.monthSales)
  }, [orders, profiles, teams])

  const displayOrders = dateOrders || orders.slice(0, 60)
  const ts = { background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, fontFamily: T.font, fontSize: 13 }

  // ═══ Handlers ═══
  const handleDateChange = async (d) => {
    setDateFilter(d)
    if (d) { const { data } = await supabase.from('orders').select('*, profiles(full_name)').eq('order_date', d).order('daily_seq'); setDateOrders((data||[]).map(o => ({ ...o, employee_name: o.employee_name || o.profiles?.full_name || '—' }))) }
    else setDateOrders(null)
  }

  const saveTeam = async () => {
    const n = teamName.trim(); if (!n) return
    if (editTeam) {
      const { error } = await supabase.from('teams').update({ name: n }).eq('id', editTeam.id)
      if (error) { flash('❌ ' + error.message); return }
      setTeams(prev => prev.map(t => t.id === editTeam.id ? { ...t, name: n } : t))
      flash('✅ แก้ชื่อทีมสำเร็จ')
    } else {
      const { data, error } = await supabase.from('teams').insert({ name: n }).select().single()
      if (error) { flash('❌ ' + error.message); return }
      setTeams(prev => [...prev, data])
      flash('✅ สร้างทีมสำเร็จ')
    }
    setShowTeamModal(false)
  }

  const deleteTeam = async () => {
    if (!editTeam || !confirm(`ลบทีม "${editTeam.name}"?`)) return
    const { error } = await supabase.from('teams').delete().eq('id', editTeam.id)
    if (error) { flash('❌ ' + error.message); return }
    setTeams(prev => prev.filter(t => t.id !== editTeam.id))
    setShowTeamModal(false); flash('🗑 ลบทีมแล้ว')
  }

  const createUser = async () => {
    const f = userForm; if (!f.email || !f.password || !f.fullName) { flash('❌ กรอกให้ครบ'); return }
    if (f.password.length < 6) { flash('❌ รหัสผ่าน 6 ตัวขึ้นไป'); return }
    const { data: { session: cur } } = await supabase.auth.getSession()
    const { data, error } = await supabase.auth.signUp({ email: f.email, password: f.password })
    if (error) { flash('❌ ' + error.message); return }
    await supabase.from('profiles').insert({ id: data.user.id, full_name: f.fullName, role: f.role, team_id: f.teamId || null })
    if (cur) await supabase.auth.setSession({ access_token: cur.access_token, refresh_token: cur.refresh_token })
    const { data: profs } = await supabase.from('profiles').select('*, teams(id, name)').order('created_at', { ascending: false })
    setProfiles(profs || [])
    setShowUserModal(false); setUserForm({ email: '', password: '', fullName: '', role: 'employee', teamId: '' })
    flash('✅ สร้างบัญชีสำเร็จ')
  }

  const updateUserTeam = async () => {
    if (!editUser) return
    await supabase.from('profiles').update({ team_id: editUserTeam || null }).eq('id', editUser.id)
    const { data: profs } = await supabase.from('profiles').select('*, teams(id, name)').order('created_at', { ascending: false })
    setProfiles(profs || [])
    setEditUser(null); flash('✅ เปลี่ยนทีมสำเร็จ')
  }

  return (
    <div style={{ fontFamily: T.font, minHeight: '100vh', background: T.bg, color: T.text, paddingBottom: 40 }}>
      <Toast message={toast} />

      {/* Header */}
      <div style={{ ...glass, borderRadius: 0, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.95)', borderBottom: `1px solid ${T.border}` }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 20, fontWeight: 900 }}>⚡ SalesHub</span><LiveDot /></div>
          <div style={{ fontSize: 11, color: T.textDim }}>{profile.full_name} — หัวหน้า</div>
        </div>
        <button onClick={onLogout} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.textDim, fontSize: 12, cursor: 'pointer', fontFamily: T.font }}>ออก</button>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <Tabs items={[{ id: 'dashboard', label: '📈 ภาพรวม' }, { id: 'orders', label: '📋 รายงาน' }, { id: 'teams', label: '👥 ทีม' }, { id: 'users', label: '🧑‍💼 ผู้ใช้' }]} active={tab} onChange={setTab} />
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
          <div style={{ ...glass, padding: '18px 14px 10px', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>📈 ยอดขาย 7 วัน</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chart7}>
                <defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.accent} stopOpacity={0.35}/><stop offset="100%" stopColor={T.accent} stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" /><XAxis dataKey="date" stroke={T.textMuted} fontSize={11} tickLine={false} /><YAxis stroke={T.textMuted} fontSize={11} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={ts} formatter={v => [`฿${fmt(v)}`, 'ยอดขาย']} /><Area type="monotone" dataKey="ยอดขาย" stroke={T.accent} strokeWidth={2.5} fill="url(#gA)" dot={{ r: 3, fill: T.accent }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* ยอดทีม + พนักงาน */}
          <div style={{ ...glass, padding: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>👥 ยอดขายรายทีม</div>
            {teamStats.map((t, i) => (
              <div key={t.id} style={{ padding: '12px 0', borderBottom: i < teamStats.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: [T.grad1, T.grad2, T.grad3, T.grad4][i%4], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>{i+1}</div>
                    <div><div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div><div style={{ fontSize: 11, color: T.textDim }}>วันนี้ {t.todayCount} · เดือน {t.count} ออเดอร์</div></div>
                  </div>
                  <div style={{ textAlign: 'right' }}><div style={{ fontSize: 16, fontWeight: 900, color: T.gold }}>฿{fmt(t.sales)}</div><div style={{ fontSize: 10, color: T.textDim }}>วันนี้ ฿{fmt(t.todaySales)}</div></div>
                </div>
                <div style={{ paddingLeft: 42 }}>
                  {empStats.filter(e => e.team_id === t.id).map(e => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12 }}>
                      <span style={{ color: T.textDim }}>👤 {e.name}</span>
                      <span>วันนี้ <strong>฿{fmt(e.todaySales)}</strong> · เดือน <strong style={{ color: T.gold }}>฿{fmt(e.monthSales)}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* อันดับพนักงาน */}
          <div style={{ ...glass, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>🏆 อันดับพนักงาน (เดือนนี้)</div>
            {empStats.map((e, i) => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < empStats.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: i < 3 ? [T.grad1, T.grad4, T.grad2][i] : T.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: i < 3 ? '#fff' : T.textDim }}>{i+1}</div>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{e.name}</div><div style={{ fontSize: 11, color: T.textDim }}>{e.teamName} · {e.monthCount} ออเดอร์</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 800, fontSize: 14, color: T.gold }}>฿{fmt(e.monthSales)}</div><div style={{ fontSize: 10, color: T.textDim }}>วันนี้ ฿{fmt(e.todaySales)}</div></div>
              </div>
            ))}
          </div>
        </>}

        {/* ══ ORDERS ══ */}
        {tab === 'orders' && <>
          <div style={{ ...glass, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📅 เลือกวันที่</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="date" value={dateFilter} onChange={e => handleDateChange(e.target.value)} style={{ flex: 1, padding: '11px 14px', borderRadius: T.radiusSm, background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.text, fontSize: 14, fontFamily: T.font, outline: 'none' }} />
              {dateFilter && <Btn sm outline onClick={() => handleDateChange('')}>ล้าง</Btn>}
            </div>
            {dateFilter && dateOrders && (
              <div style={{ marginTop: 14, padding: 14, borderRadius: T.radiusSm, background: 'rgba(184,134,11,0.05)', border: '1px solid rgba(184,134,11,0.12)' }}>
                <div style={{ fontSize: 13, color: T.textDim, marginBottom: 6 }}>{fmtDateFull(dateFilter)}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div><div style={{ fontSize: 11, color: T.textMuted }}>ออเดอร์</div><div style={{ fontSize: 22, fontWeight: 900, color: T.gold }}>{dateOrders.length}</div></div>
                  <div><div style={{ fontSize: 11, color: T.textMuted }}>ยอดขาย</div><div style={{ fontSize: 22, fontWeight: 900, color: T.success }}>฿{fmt(dateOrders.reduce((s,o)=>s+(parseFloat(o.sale_price)||0),0))}</div></div>
                  <div><div style={{ fontSize: 11, color: T.textMuted }}>COD</div><div style={{ fontSize: 22, fontWeight: 900, color: T.danger }}>฿{fmt(dateOrders.reduce((s,o)=>s+(parseFloat(o.cod_amount)||0),0))}</div></div>
                </div>
              </div>
            )}
          </div>
          <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
            {displayOrders.map(o => (
              <div key={o.id} style={{ ...glass, padding: '14px 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(184,134,11,0.1)', color: T.gold, marginRight: 8 }}>{o.order_number}</span><span style={{ fontSize: 13, fontWeight: 600 }}>{o.customer_name}</span></div>
                  <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 800, fontSize: 14, color: T.success }}>฿{fmt(parseFloat(o.sale_price)||0)}</div></div>
                </div>
                <div style={{ fontSize: 11, color: T.textDim }}>📱 {o.customer_phone} · 📍 {o.district||'—'} {o.sales_channel && `· 📦 ${o.sales_channel}`} {o.employee_name && `· 👤 ${o.employee_name}`}</div>
                {o.remark && <div style={{ fontSize: 11, color: T.textDim }}>💬 {o.remark}</div>}
              </div>
            ))}
            {displayOrders.length === 0 && <Empty text="เลือกวันที่เพื่อดูรายงาน" />}
          </div>
        </>}

        {/* ══ TEAMS ══ */}
        {tab === 'teams' && <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><div style={{ fontSize: 15, fontWeight: 700 }}>ทีม ({teams.length})</div><Btn sm onClick={() => { setEditTeam(null); setTeamName(''); setShowTeamModal(true) }}>+ สร้างทีม</Btn></div>
          <Modal show={showTeamModal} onClose={() => setShowTeamModal(false)} title={editTeam ? '✏️ แก้ไขทีม' : '🏗 สร้างทีม'}>
            <FI label="ชื่อทีม" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="ชื่อทีม" />
            <div style={{ display: 'flex', gap: 10 }}><Btn full onClick={saveTeam} grad={T.grad2}>{editTeam ? '💾 บันทึก' : '✅ สร้าง'}</Btn><Btn full outline onClick={() => setShowTeamModal(false)}>ยกเลิก</Btn></div>
            {editTeam && <button onClick={deleteTeam} style={{ width: '100%', marginTop: 12, padding: 12, borderRadius: T.radiusSm, border: '1px solid rgba(214,48,49,0.2)', background: 'rgba(214,48,49,0.04)', color: T.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: T.font }}>🗑 ลบทีม</button>}
          </Modal>
          {teamStats.map((t, i) => (
            <div key={t.id} style={{ ...glass, padding: 18, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: T.radiusSm, background: [T.grad1,T.grad2,T.grad3,T.grad4][i%4], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff' }}>{i+1}</div>
                  <div><div style={{ fontWeight: 700 }}>{t.name}</div><div style={{ fontSize: 11, color: T.textDim }}>วันนี้ {t.todayCount} · เดือน {t.count}</div></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: T.gold }}>฿{fmt(t.sales)}</div>
                  <button onClick={() => { setEditTeam(t); setTeamName(t.name); setShowTeamModal(true) }} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.textDim, fontSize: 12, cursor: 'pointer', fontFamily: T.font }}>✏️</button>
                </div>
              </div>
              {empStats.filter(e => e.team_id === t.id).map(e => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 6px 48px', fontSize: 12, borderTop: `1px solid ${T.border}` }}>
                  <span>👤 {e.name}</span><span>วันนี้ <strong>฿{fmt(e.todaySales)}</strong> · เดือน <strong style={{ color: T.gold }}>฿{fmt(e.monthSales)}</strong></span>
                </div>
              ))}
            </div>
          ))}
        </>}

        {/* ══ USERS ══ */}
        {tab === 'users' && <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><div style={{ fontSize: 15, fontWeight: 700 }}>ผู้ใช้ ({profiles.length})</div><Btn sm onClick={() => setShowUserModal(true)}>+ เพิ่มผู้ใช้</Btn></div>
          <Modal show={showUserModal} onClose={() => setShowUserModal(false)} title="🧑‍💼 เพิ่มผู้ใช้">
            <FI label="ชื่อ *" value={userForm.fullName} onChange={e => setUserForm(p=>({...p,fullName:e.target.value}))} placeholder="สมชาย ใจดี" />
            <FI label="อีเมล *" type="email" value={userForm.email} onChange={e => setUserForm(p=>({...p,email:e.target.value}))} placeholder="user@mail.com" />
            <FI label="รหัสผ่าน *" type="password" value={userForm.password} onChange={e => setUserForm(p=>({...p,password:e.target.value}))} placeholder="6 ตัวขึ้นไป" />
            <div style={{ marginBottom: 14 }}><label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>ตำแหน่ง</label>
              <select value={userForm.role} onChange={e => setUserForm(p=>({...p,role:e.target.value}))} style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box' }}><option value="employee">👤 พนักงาน</option><option value="manager">🏢 หัวหน้า</option></select>
            </div>
            {userForm.role === 'employee' && <div style={{ marginBottom: 14 }}><label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>ทีม</label>
              <select value={userForm.teamId} onChange={e => setUserForm(p=>({...p,teamId:e.target.value}))} style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box' }}><option value="">— เลือกทีม —</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </div>}
            <div style={{ display: 'flex', gap: 10 }}><Btn full onClick={createUser} grad={T.grad2}>✅ สร้าง</Btn><Btn full outline onClick={() => setShowUserModal(false)}>ยกเลิก</Btn></div>
          </Modal>
          <Modal show={!!editUser} onClose={() => setEditUser(null)} title={`✏️ ทีม — ${editUser?.full_name}`}>
            <div style={{ marginBottom: 14 }}><label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>เลือกทีม</label>
              <select value={editUserTeam} onChange={e => setEditUserTeam(e.target.value)} style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box' }}><option value="">— ไม่มีทีม —</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}><Btn full onClick={updateUserTeam} grad={T.grad1}>💾 บันทึก</Btn><Btn full outline onClick={() => setEditUser(null)}>ยกเลิก</Btn></div>
          </Modal>
          {profiles.map(p => (
            <div key={p.id} style={{ ...glass, padding: '16px 18px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: T.radiusSm, background: p.role === 'manager' ? T.grad3 : T.grad1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff' }}>{p.full_name?.[0]||'?'}</div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{p.full_name}</div><div style={{ fontSize: 11, color: T.textDim }}>{p.role === 'manager' ? '🏢 หัวหน้า' : '👤 พนักงาน'}{p.teams?.name && ` · ${p.teams.name}`}</div></div>
              <button onClick={() => { setEditUser(p); setEditUserTeam(p.team_id || '') }} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.textDim, fontSize: 12, cursor: 'pointer', fontFamily: T.font }}>✏️ ทีม</button>
            </div>
          ))}
        </>}
      </div>
    </div>
  )
}
