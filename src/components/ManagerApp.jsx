import { useState, useMemo } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { T, glass, fmt, fmtDate, fmtDateFull, sameDay, withinDays, thisMonth, Stat, Tabs, Btn, Input, OrderItem, Toast, Modal, Empty, LiveDot } from './ui'

export default function ManagerApp({ profile, orders, teams, onCreateTeam, onSignOut }) {
  const [tab, setTab] = useState('dashboard')
  const [dateFilter, setDateFilter] = useState('')
  const [toast, setToast] = useState(null)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')

  // ── สถิติ ────────────────────────
  const today = orders.filter(o => sameDay(o.created_at, new Date()))
  const todaySum = today.reduce((s, o) => s + (o.total_amount || 0), 0)
  const weekSum = orders.filter(o => withinDays(o.created_at, 7)).reduce((s, o) => s + (o.total_amount || 0), 0)
  const monthSum = orders.filter(o => thisMonth(o.created_at)).reduce((s, o) => s + (o.total_amount || 0), 0)

  // ── กราฟ 7 วัน ───────────────────
  const chart7 = useMemo(() => {
    const arr = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const dayOrd = orders.filter(o => sameDay(o.created_at, d))
      arr.push({
        date: fmtDate(d),
        ยอดขาย: dayOrd.reduce((s, o) => s + (o.total_amount || 0), 0),
      })
    }
    return arr
  }, [orders])

  // ── ข้อมูลทีม ────────────────────
  const teamStats = useMemo(() =>
    teams.map(t => ({
      ...t,
      sales: orders.filter(o => o.team_id === t.id && thisMonth(o.created_at)).reduce((s, o) => s + (o.total_amount || 0), 0),
      count: orders.filter(o => o.team_id === t.id && thisMonth(o.created_at)).length,
    })).sort((a, b) => b.sales - a.sales)
  , [teams, orders])

  const dateOrders = dateFilter ? orders.filter(o => sameDay(o.created_at, dateFilter)) : null
  const displayOrders = dateOrders || orders.slice(0, 60)

  const handleCreateTeam = async () => {
    const n = newTeamName.trim()
    if (!n) return
    const { error } = await onCreateTeam(n)
    if (error) {
      setToast(`❌ ${error.message}`)
    } else {
      setToast(`✅ สร้าง "${n}" สำเร็จ`)
      setNewTeamName('')
      setShowTeamModal(false)
    }
    setTimeout(() => setToast(null), 2500)
  }

  const tooltipStyle = {
    background: 'rgba(10,14,26,0.96)', border: `1px solid ${T.border}`,
    borderRadius: 12, fontFamily: T.font, fontSize: 13,
  }

  return (
    <div style={{ fontFamily: T.font, minHeight: '100vh', background: T.bg, color: T.text, paddingBottom: 40 }}>
      <Toast message={toast} />

      {/* Header */}
      <div style={{
        ...glass, borderRadius: 0, padding: '14px 18px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10,14,26,0.85)', borderBottom: `1px solid ${T.border}`,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20, fontWeight: 900 }}>⚡ SalesHub</span>
            <LiveDot />
          </div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>
            {profile.full_name} — หัวหน้า
          </div>
        </div>
        <button onClick={onSignOut} style={{
          padding: '8px 14px', borderRadius: 8, border: `1px solid ${T.border}`,
          background: 'transparent', color: T.textDim, fontSize: 12, cursor: 'pointer', fontFamily: T.font,
        }}>ออก</button>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <Tabs items={[
          { id: 'dashboard', label: '📈 ภาพรวม' },
          { id: 'orders', label: '📋 ออเดอร์' },
          { id: 'teams', label: '👥 ทีม' },
        ]} active={tab} onChange={setTab} />
      </div>

      <div style={{ padding: 16 }}>
        {tab === 'dashboard' && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <Stat label="วันนี้" value={todaySum} icon="🔥" gradient={T.grad3} sub={`${today.length} ออเดอร์`} />
            <Stat label="7 วัน" value={weekSum} icon="📊" gradient={T.grad1} />
            <Stat label="เดือนนี้" value={monthSum} icon="🏆" gradient={T.grad2} />
            <Stat label="เฉลี่ย/วัน" value={Math.round(monthSum / Math.max(new Date().getDate(), 1))} icon="📉" gradient={T.grad4} />
          </div>

          <div style={{ ...glass, padding: '18px 14px 10px', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>📈 ยอดขาย 7 วัน</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chart7}>
                <defs>
                  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.accent} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={T.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" stroke={T.textMuted} fontSize={11} tickLine={false} />
                <YAxis stroke={T.textMuted} fontSize={11} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`฿${fmt(v)}`, 'ยอดขาย']} />
                <Area type="monotone" dataKey="ยอดขาย" stroke={T.accent} strokeWidth={2.5} fill="url(#gA)" dot={{ r: 3, fill: T.accent }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ ...glass, padding: '18px 14px 10px', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>🏅 ผลงานทีม (เดือนนี้)</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={teamStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" stroke={T.textMuted} fontSize={11} tickLine={false} />
                <YAxis stroke={T.textMuted} fontSize={11} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`฿${fmt(v)}`, 'ยอดขาย']} />
                <defs>
                  <linearGradient id="gBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.accent} />
                    <stop offset="100%" stopColor="#764ba2" />
                  </linearGradient>
                </defs>
                <Bar dataKey="sales" fill="url(#gBar)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ ...glass, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📅 ดูยอดขายตามวันที่</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                style={{
                  flex: 1, padding: '11px 14px', borderRadius: T.radiusSm,
                  background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`,
                  color: T.text, fontSize: 14, fontFamily: T.font, outline: 'none', colorScheme: 'dark',
                }} />
              {dateFilter && <Btn sm outline onClick={() => setDateFilter('')}>ล้าง</Btn>}
            </div>
            {dateFilter && dateOrders && (
              <div style={{ marginTop: 16, padding: 16, borderRadius: T.radiusSm, background: 'rgba(108,92,231,0.06)', border: '1px solid rgba(108,92,231,0.12)' }}>
                <div style={{ fontSize: 13, color: T.textDim }}>{fmtDateFull(dateFilter)}</div>
                <div style={{ fontSize: 30, fontWeight: 900, background: T.grad1, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '6px 0 4px' }}>
                  ฿{fmt(dateOrders.reduce((s, o) => s + (o.total_amount || 0), 0))}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted }}>{dateOrders.length} ออเดอร์</div>
              </div>
            )}
          </div>
        </>}

        {tab === 'orders' && <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
              style={{
                flex: 1, padding: '11px 14px', borderRadius: T.radiusSm,
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`,
                color: T.text, fontSize: 14, fontFamily: T.font, outline: 'none', colorScheme: 'dark',
              }} />
            {dateFilter && <Btn sm outline onClick={() => setDateFilter('')}>✕</Btn>}
          </div>
          <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
            {displayOrders.length ? displayOrders.map(o => <OrderItem key={o.id} order={o} showWho />) : <Empty text="ไม่พบออเดอร์" />}
          </div>
        </>}

        {tab === 'teams' && <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>ทีมทั้งหมด ({teams.length})</div>
            <Btn sm onClick={() => setShowTeamModal(true)}>+ สร้างทีม</Btn>
          </div>

          <Modal show={showTeamModal} onClose={() => setShowTeamModal(false)} title="🏗 สร้างทีมใหม่">
            <Input label="ชื่อทีม" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="ทีม Delta" />
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn full onClick={handleCreateTeam} grad={T.grad2}>สร้าง</Btn>
              <Btn full outline onClick={() => setShowTeamModal(false)}>ยกเลิก</Btn>
            </div>
          </Modal>

          {teamStats.map((t, i) => (
            <div key={t.id} style={{ ...glass, padding: 18, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: T.radiusSm,
                    background: [T.grad1, T.grad2, T.grad3, T.grad4][i % 4],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 800, color: '#fff',
                  }}>{i + 1}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: T.textDim }}>{t.count} ออเดอร์เดือนนี้</div>
                  </div>
                </div>
                <div style={{
                  fontSize: 20, fontWeight: 900,
                  background: [T.grad1, T.grad2, T.grad3, T.grad4][i % 4],
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>฿{fmt(t.sales)}</div>
              </div>
            </div>
          ))}
        </>}
      </div>
    </div>
  )
}
