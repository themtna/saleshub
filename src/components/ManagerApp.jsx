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
  const [sheetUrl, setSheetUrl] = useState(localStorage.getItem('saleshub_sheet_url') || '')
  const [syncing, setSyncing] = useState(false)
  const [showSheetSetup, setShowSheetSetup] = useState(false)

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 3000) }

  // ═══ Export CSV (รูปแบบ ProShip Flash) ═══
  const exportCSV = (data, filename) => {
    const headers = ['MobileNo*\nเบอร์มือถือ','Name\nชื่อ','Address\nที่อยู่','SubDistrict\nตำบล','District\nอำเภอ','ZIP\nรหัส ปณ.','Customer FB/Line\nเฟส/ไลน์ลูกค้า','SalesChannel\nช่องทางจำหน่าย','SalesPerson\nชื่อแอดมิน','SalePrice\nราคาขาย','COD*\nยอดเก็บเงินปลายทาง','Remark\nหมายเหตุ']
    const rows = data.map(o => [
      o.customer_phone,
      o.customer_name,
      o.customer_address,
      o.sub_district,
      o.district,
      o.zip_code,
      o.customer_social,
      o.sales_channel,
      o.employee_name || profiles.find(p => p.id === o.employee_id)?.full_name || '',
      o.sale_price,
      o.cod_amount,
      o.remark,
    ])
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${String(c||'').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename || 'saleshub-orders.csv'; a.click()
    URL.revokeObjectURL(url)
    flash('✅ ดาวน์โหลด CSV สำเร็จ')
  }

  // ═══ Sync to Google Sheets (รูปแบบ ProShip) ═══
  const syncToGoogleSheet = async (data) => {
    if (!sheetUrl) { setShowSheetSetup(true); return }
    setSyncing(true)
    try {
      const rows = data.map(o => ({
        phone: o.customer_phone,
        name: o.customer_name,
        address: o.customer_address,
        sub_district: o.sub_district,
        district: o.district,
        zip: o.zip_code,
        fb: o.customer_social,
        channel: o.sales_channel,
        admin: o.employee_name || profiles.find(p => p.id === o.employee_id)?.full_name || '',
        price: o.sale_price,
        cod: o.cod_amount,
        remark: o.remark,
        order_number: o.order_number,
      }))
      await fetch(sheetUrl, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: rows }),
      })
      flash('✅ ส่งข้อมูลไป Google Sheet แล้ว!')
    } catch (e) { flash('❌ ส่งไม่สำเร็จ: ' + e.message) }
    setSyncing(false)
  }

  // ═══ โหลดข้อมูลทั้งหมด ═══
  useEffect(() => {
    const load = async () => {
      try {
        const [ordersRes, teamsRes, profilesRes] = await Promise.all([
          supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100),
          supabase.from('teams').select('*').order('name'),
          supabase.from('profiles').select('*, teams(id, name)').order('created_at', { ascending: false }),
        ])
        setOrders(ordersRes.data || [])
        setTeams(teamsRes.data || [])
        setProfiles(profilesRes.data || [])
      } catch (e) { console.error('Load error:', e) }
    }
    load()

    // Realtime
    const ch = supabase.channel('mgr-orders').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' },
      (payload) => { setOrders(prev => [payload.new, ...prev]) }
    ).subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  // ═══ Stats ═══
  const today = orders.filter(o => sameDay(o.created_at, new Date()))
  const todaySum = today.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
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
    if (d) { try { const { data } = await supabase.from('orders').select('*').eq('order_date', d).order('daily_seq'); setDateOrders(data || []) } catch { setDateOrders([]) } }
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
        <Tabs items={[{ id: 'dashboard', label: '📈 ภาพรวม' }, { id: 'orders', label: '📋 รายงาน' }, { id: 'teams', label: '👥 ทีม' }, { id: 'users', label: '🧑‍💼 ผู้ใช้' }, { id: 'backup', label: '💾 Backup' }]} active={tab} onChange={setTab} />
      </div>

      <div style={{ padding: 16 }}>
        {/* ══ DASHBOARD ══ */}
        {tab === 'dashboard' && (() => {
          const todayCodOrd = today.filter(o => o.payment_type !== 'transfer')
          const todayTransOrd = today.filter(o => o.payment_type === 'transfer')
          const todayCodSum = todayCodOrd.reduce((s,o) => s+(parseFloat(o.cod_amount)||0), 0)
          const todayTransSum = todayTransOrd.reduce((s,o) => s+(parseFloat(o.sale_price)||0), 0)
          const monthOrders = orders.filter(o => thisMonth(o.created_at))
          const monthCodOrd = monthOrders.filter(o => o.payment_type !== 'transfer')
          const monthTransOrd = monthOrders.filter(o => o.payment_type === 'transfer')
          const monthCodSum = monthCodOrd.reduce((s,o) => s+(parseFloat(o.cod_amount)||0), 0)
          const monthTransSum = monthTransOrd.reduce((s,o) => s+(parseFloat(o.sale_price)||0), 0)
          return <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <Stat label="วันนี้" value={todaySum} icon="🔥" gradient={T.grad3} sub={`${today.length} ออเดอร์`} />
            <Stat label="7 วัน" value={weekSum} icon="📊" gradient={T.grad1} />
            <Stat label="เดือนนี้" value={monthSum} icon="🏆" gradient={T.grad2} />
            <Stat label="เฉลี่ย/วัน" value={Math.round(monthSum / Math.max(new Date().getDate(), 1))} icon="📉" gradient={T.grad4} />
          </div>

          {/* แยก COD / โอน — วันนี้ */}
          <div style={{ ...glass, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📊 วันนี้ — แยกประเภท</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ padding: 14, borderRadius: T.radiusSm, background: 'rgba(184,134,11,0.04)', border: '1px solid rgba(184,134,11,0.12)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: T.textDim }}>📦 COD ({todayCodOrd.length})</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: T.gold }}>฿{fmt(todayCodSum)}</div>
              </div>
              <div style={{ padding: 14, borderRadius: T.radiusSm, background: 'rgba(45,138,78,0.04)', border: '1px solid rgba(45,138,78,0.12)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: T.textDim }}>🏦 โอนเงิน ({todayTransOrd.length})</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: T.success }}>฿{fmt(todayTransSum)}</div>
              </div>
            </div>
          </div>

          {/* แยก COD / โอน — เดือนนี้ */}
          <div style={{ ...glass, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📊 เดือนนี้ — แยกประเภท</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ padding: 14, borderRadius: T.radiusSm, background: 'rgba(184,134,11,0.04)', border: '1px solid rgba(184,134,11,0.12)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: T.textDim }}>📦 COD ({monthCodOrd.length})</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: T.gold }}>฿{fmt(monthCodSum)}</div>
              </div>
              <div style={{ padding: 14, borderRadius: T.radiusSm, background: 'rgba(45,138,78,0.04)', border: '1px solid rgba(45,138,78,0.12)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: T.textDim }}>🏦 โอนเงิน ({monthTransOrd.length})</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: T.success }}>฿{fmt(monthTransSum)}</div>
              </div>
            </div>
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
        </>
        })()}

        {/* ══ ORDERS ══ */}
        {tab === 'orders' && <>
          <div style={{ ...glass, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📅 เลือกวันที่</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="date" value={dateFilter} onChange={e => handleDateChange(e.target.value)} style={{ flex: 1, padding: '11px 14px', borderRadius: T.radiusSm, background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.text, fontSize: 14, fontFamily: T.font, outline: 'none' }} />
              {dateFilter && <Btn sm outline onClick={() => handleDateChange('')}>ล้าง</Btn>}
            </div>
            {dateFilter && dateOrders && (() => {
              const codOrders = dateOrders.filter(o => o.payment_type !== 'transfer')
              const transferOrders = dateOrders.filter(o => o.payment_type === 'transfer')
              const totalSales = dateOrders.reduce((s,o) => s+(parseFloat(o.sale_price)||0), 0)
              const codSum = codOrders.reduce((s,o) => s+(parseFloat(o.cod_amount)||0), 0)
              const transferSum = transferOrders.reduce((s,o) => s+(parseFloat(o.sale_price)||0), 0)
              return (
                <div style={{ marginTop: 14, padding: 14, borderRadius: T.radiusSm, background: 'rgba(184,134,11,0.05)', border: '1px solid rgba(184,134,11,0.12)' }}>
                  <div style={{ fontSize: 13, color: T.textDim, marginBottom: 8 }}>{fmtDateFull(dateFilter)}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                    <div><div style={{ fontSize: 10, color: T.textMuted }}>ทั้งหมด</div><div style={{ fontSize: 20, fontWeight: 900, color: T.gold }}>{dateOrders.length}</div></div>
                    <div><div style={{ fontSize: 10, color: T.textMuted }}>ยอดรวม</div><div style={{ fontSize: 20, fontWeight: 900, color: T.success }}>฿{fmt(totalSales)}</div></div>
                    <div><div style={{ fontSize: 10, color: T.textMuted }}>📦 COD ({codOrders.length})</div><div style={{ fontSize: 20, fontWeight: 900, color: T.gold }}>฿{fmt(codSum)}</div></div>
                    <div><div style={{ fontSize: 10, color: T.textMuted }}>🏦 โอน ({transferOrders.length})</div><div style={{ fontSize: 20, fontWeight: 900, color: T.success }}>฿{fmt(transferSum)}</div></div>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* แยก COD / โอนเงิน */}
          {dateFilter && dateOrders && (() => {
            const codOrders = dateOrders.filter(o => o.payment_type !== 'transfer')
            const transferOrders = dateOrders.filter(o => o.payment_type === 'transfer')

            const renderOrder = (o, idx) => (
              <div key={o.id} style={{ ...glass, padding: '12px 16px', marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(184,134,11,0.1)', color: T.gold, marginRight: 6 }}>ลำดับที่ {o.daily_seq || (idx + 1)}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{o.customer_name}</span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: T.success }}>฿{fmt(parseFloat(o.sale_price)||0)}</div>
                </div>
                <div style={{ fontSize: 11, color: T.textDim }}>📱 {o.customer_phone} · 📍 {o.district||'—'} {o.sales_channel && `· 📦 ${o.sales_channel}`} · 👤 {o.employee_name || profiles.find(p=>p.id===o.employee_id)?.full_name || '—'}</div>
                {o.remark && <div style={{ fontSize: 11, color: T.textDim }}>💬 {o.remark}</div>}
                {o.slip_url && <a href={o.slip_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, padding: '3px 8px', borderRadius: 6, background: 'rgba(45,138,78,0.06)', border: '1px solid rgba(45,138,78,0.15)', fontSize: 11, color: T.success, fontWeight: 600, textDecoration: 'none' }}>🧾 ดูสลิป</a>}
              </div>
            )

            return (
              <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
                {/* COD Section */}
                {codOrders.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>📦 เก็บเงินปลายทาง (COD)</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.gold }}>{codOrders.length} รายการ · ฿{fmt(codOrders.reduce((s,o)=>s+(parseFloat(o.cod_amount)||0),0))}</div>
                    </div>
                    {codOrders.map((o, i) => renderOrder(o, i))}
                  </div>
                )}

                {/* Transfer Section */}
                {transferOrders.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>🏦 โอนเงิน</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.success }}>{transferOrders.length} รายการ · ฿{fmt(transferOrders.reduce((s,o)=>s+(parseFloat(o.sale_price)||0),0))}</div>
                    </div>
                    {transferOrders.map((o, i) => renderOrder(o, i))}
                  </div>
                )}

                {dateOrders.length === 0 && <Empty text="ไม่มีออเดอร์วันนี้" />}
              </div>
            )
          })()}

          {/* ถ้ายังไม่เลือกวัน แสดง orders ล่าสุด */}
          {!dateFilter && (
            <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
              {displayOrders.map((o, i) => (
                <div key={o.id} style={{ ...glass, padding: '12px 16px', marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(184,134,11,0.1)', color: T.gold, marginRight: 6 }}>ลำดับที่ {o.daily_seq || (i + 1)}</span>
                      <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: o.payment_type === 'transfer' ? 'rgba(45,138,78,0.1)' : 'rgba(184,134,11,0.08)', color: o.payment_type === 'transfer' ? T.success : T.gold }}>
                        {o.payment_type === 'transfer' ? '🏦 โอน' : '📦 COD'}
                      </span>
                      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{o.customer_name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 800, fontSize: 14, color: T.success }}>฿{fmt(parseFloat(o.sale_price)||0)}</div></div>
                  </div>
                  <div style={{ fontSize: 11, color: T.textDim }}>📱 {o.customer_phone} · 📍 {o.district||'—'} · 👤 {o.employee_name || profiles.find(p=>p.id===o.employee_id)?.full_name || '—'}</div>
                  {o.remark && <div style={{ fontSize: 11, color: T.textDim }}>💬 {o.remark}</div>}
                </div>
              ))}
              {displayOrders.length === 0 && <Empty text="เลือกวันที่เพื่อดูรายงาน" />}
            </div>
          )}
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

        {/* ══ BACKUP ══ */}
        {tab === 'backup' && <>
          <div style={{ ...glass, padding: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>💾 Backup ข้อมูลไป Google Sheet</div>
            <div style={{ fontSize: 12, color: T.textDim, marginBottom: 16 }}>ส่งออเดอร์ทั้งหมดไป Google Sheet อัตโนมัติ</div>

            {/* Google Sheet URL Setup */}
            <div style={{ padding: 16, borderRadius: T.radiusSm, background: T.surfaceAlt, border: `1px solid ${T.border}`, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>🔗 Google Apps Script URL</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={sheetUrl} onChange={e => { setSheetUrl(e.target.value); localStorage.setItem('saleshub_sheet_url', e.target.value) }}
                  placeholder="https://script.google.com/macros/s/xxx/exec"
                  style={{ flex: 1, padding: '11px 14px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: '#fff', color: T.text, fontSize: 13, fontFamily: T.font, outline: 'none', boxSizing: 'border-box' }} />
                {sheetUrl && <Btn sm grad={T.grad2} onClick={() => syncToGoogleSheet(orders)} disabled={syncing}>{syncing ? '⏳...' : '🔄 Sync'}</Btn>}
              </div>
              {sheetUrl && <div style={{ fontSize: 11, color: T.success, marginTop: 6 }}>✅ เชื่อมต่อแล้ว — กด Sync เพื่อส่งข้อมูล</div>}
              {!sheetUrl && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>ยังไม่ได้ตั้งค่า — ดูวิธีด้านล่าง</div>}
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <button onClick={() => syncToGoogleSheet(orders)} disabled={syncing || !sheetUrl} style={{
                padding: '16px', borderRadius: T.radiusSm, border: `1px solid ${sheetUrl ? 'rgba(45,138,78,0.2)' : T.border}`,
                background: sheetUrl ? 'rgba(45,138,78,0.04)' : T.surfaceAlt,
                color: sheetUrl ? T.success : T.textMuted, fontSize: 14, fontWeight: 700,
                cursor: sheetUrl ? 'pointer' : 'not-allowed', fontFamily: T.font, opacity: syncing ? 0.5 : 1,
              }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📊</div>
                {syncing ? '⏳ กำลังส่ง...' : 'Sync ทั้งหมด'}
                <div style={{ fontSize: 11, fontWeight: 400, marginTop: 4 }}>{orders.length} ออเดอร์</div>
              </button>
              <button onClick={() => exportCSV(orders, `saleshub-${new Date().toISOString().split('T')[0]}.csv`)} style={{
                padding: '16px', borderRadius: T.radiusSm, border: `1px solid rgba(184,134,11,0.2)`,
                background: 'rgba(184,134,11,0.04)', color: T.gold, fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: T.font,
              }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📥</div>
                ดาวน์โหลด CSV
                <div style={{ fontSize: 11, fontWeight: 400, marginTop: 4 }}>เปิดใน Google Sheet ได้</div>
              </button>
            </div>

            {/* Sync เฉพาะวัน */}
            {dateFilter && dateOrders && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <Btn full onClick={() => syncToGoogleSheet(dateOrders)} disabled={syncing || !sheetUrl}>📊 Sync เฉพาะ {fmtDateFull(dateFilter)} ({dateOrders.length} ออเดอร์)</Btn>
                <Btn full outline onClick={() => exportCSV(dateOrders, `saleshub-${dateFilter}.csv`)}>📥 CSV {fmtDateFull(dateFilter)}</Btn>
              </div>
            )}
          </div>

          {/* วิธีตั้งค่า Google Sheet */}
          <div style={{ ...glass, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>📖 วิธีตั้งค่า Google Sheet (ทำครั้งเดียว)</div>
            <div style={{ fontSize: 13, color: T.textDim, lineHeight: 2.2 }}>
              <div style={{ padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
                <strong style={{ color: T.gold }}>ขั้นที่ 1</strong> — เปิด Google Sheet ใหม่
              </div>
              <div style={{ padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
                <strong style={{ color: T.gold }}>ขั้นที่ 2</strong> — กด <strong>ส่วนขยาย → Apps Script</strong>
              </div>
              <div style={{ padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
                <strong style={{ color: T.gold }}>ขั้นที่ 3</strong> — ลบโค้ดเดิม แล้ววางโค้ดนี้:
              </div>
              <div style={{ background: T.surfaceAlt, padding: 12, borderRadius: 8, margin: '8px 0', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.8, overflowX: 'auto', whiteSpace: 'pre-wrap', userSelect: 'all' }}>
{`function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  var orders = data.orders;

  // สร้างหัวตาราง ProShip (ถ้าว่าง)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['MobileNo*','Name','Address','SubDistrict','District','ZIP','Customer FB/Line','SalesChannel','SalesPerson','SalePrice','COD*','Remark']);
    var h = sheet.getRange(1,1,1,12);
    h.setFontWeight('bold');
    h.setBackground('#B8860B');
    h.setFontColor('#FFFFFF');
  }

  // ป้องกันซ้ำ (เช็คจาก column 13 = order_number)
  var existing = {};
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    try {
      var col = sheet.getRange(2,13,lastRow-1,1).getValues();
      col.forEach(function(r){ if(r[0]) existing[r[0]]=true; });
    } catch(e) {}
  }

  var added = 0;
  orders.forEach(function(o) {
    if (!existing[o.order_number]) {
      sheet.appendRow([o.phone,o.name,o.address,o.sub_district,o.district,o.zip,o.fb,o.channel,o.admin,o.price,o.cod,o.remark,o.order_number]);
      added++;
    }
  });

  return ContentService.createTextOutput(JSON.stringify({ok:true, added:added}));
}`}
              </div>
              <div style={{ padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
                <strong style={{ color: T.gold }}>ขั้นที่ 4</strong> — กด <strong>ทำให้ใช้งานได้ → การทำให้ใช้งานได้แบบใหม่</strong>
                <div style={{ fontSize: 12, marginTop: 4 }}>• ประเภท: <strong>เว็บแอป</strong></div>
                <div style={{ fontSize: 12 }}>• ผู้ที่มีสิทธิ์เข้าถึง: <strong>ทุกคน</strong></div>
                <div style={{ fontSize: 12 }}>• กด <strong>ทำให้ใช้งานได้</strong> → อนุญาตสิทธิ์</div>
              </div>
              <div style={{ padding: '8px 0' }}>
                <strong style={{ color: T.gold }}>ขั้นที่ 5</strong> — คัดลอก URL ที่ได้ มาวางในช่องด้านบน
                <div style={{ fontSize: 12, marginTop: 4, color: T.textMuted }}>URL จะเป็น: https://script.google.com/macros/s/xxxx/exec</div>
              </div>
            </div>
          </div>
        </>}
      </div>
    </div>
  )
}
