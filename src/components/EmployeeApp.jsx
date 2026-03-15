import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { T, glass, fmt, fmtDate, fmtDateFull, sameDay, withinDays, thisMonth, Stat, Tabs, Btn, Input, OrderItem, Toast, Empty, LiveDot } from './ui'

export default function EmployeeApp({ profile, orders, onCreateOrder, onSignOut }) {
  const [tab, setTab] = useState('create')
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [qty, setQty] = useState('1')
  const [dateFilter, setDateFilter] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  const submit = async () => {
    if (!desc.trim() || !amount) return
    setSubmitting(true)

    const { error } = await onCreateOrder({
      description: desc.trim(),
      amount: parseFloat(amount),
      quantity: parseInt(qty) || 1,
      employeeId: profile.id,
      teamId: profile.team_id,
    })

    if (error) {
      setToast(`❌ ${error.message}`)
    } else {
      setToast('✅ บันทึกออเดอร์สำเร็จ!')
      setDesc('')
      setAmount('')
      setQty('1')
    }
    setSubmitting(false)
    setTimeout(() => setToast(null), 2500)
  }

  const todaySum = orders.filter(o => sameDay(o.created_at, new Date())).reduce((s, o) => s + (o.total_amount || 0), 0)
  const weekSum = orders.filter(o => withinDays(o.created_at, 7)).reduce((s, o) => s + (o.total_amount || 0), 0)
  const monthSum = orders.filter(o => thisMonth(o.created_at)).reduce((s, o) => s + (o.total_amount || 0), 0)

  const chart7 = useMemo(() => {
    const arr = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      arr.push({
        date: fmtDate(d),
        ยอดขาย: orders.filter(o => sameDay(o.created_at, d)).reduce((s, o) => s + (o.total_amount || 0), 0),
      })
    }
    return arr
  }, [orders])

  const dateOrders = dateFilter ? orders.filter(o => sameDay(o.created_at, dateFilter)) : null
  const displayOrders = dateOrders || orders.slice(0, 50)
  const total = parseFloat(amount || 0) * (parseInt(qty) || 1)

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
            <span style={{ fontSize: 20, fontWeight: 900 }}>👤 SalesHub</span>
            <LiveDot />
          </div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>
            {profile.full_name} · {profile.teams?.name || '—'}
          </div>
        </div>
        <button onClick={onSignOut} style={{
          padding: '8px 14px', borderRadius: 8, border: `1px solid ${T.border}`,
          background: 'transparent', color: T.textDim, fontSize: 12, cursor: 'pointer', fontFamily: T.font,
        }}>ออก</button>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <Tabs items={[
          { id: 'create', label: '➕ สร้างออเดอร์' },
          { id: 'summary', label: '📊 สรุปยอด' },
          { id: 'history', label: '📋 ประวัติ' },
        ]} active={tab} onChange={setTab} />
      </div>

      <div style={{ padding: 16 }}>
        {tab === 'create' && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 18 }}>
            <Stat compact label="วันนี้" value={todaySum} gradient={T.grad3} />
            <Stat compact label="7 วัน" value={weekSum} gradient={T.grad1} />
            <Stat compact label="เดือน" value={monthSum} gradient={T.grad2} />
          </div>

          <div style={{ ...glass, padding: 20 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 18 }}>📝 สร้างออเดอร์ใหม่</div>
            <Input label="รายละเอียดสินค้า" value={desc} onChange={e => setDesc(e.target.value)} placeholder="เช่น กาแฟ Drip, ลาเต้เย็น" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input label="ราคา (฿)" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={{ fontSize: 20, fontWeight: 800 }} />
              <Input label="จำนวน" type="number" value={qty} onChange={e => setQty(e.target.value)} min="1" style={{ fontSize: 20, fontWeight: 800 }} />
            </div>

            {total > 0 && (
              <div style={{
                textAlign: 'center', padding: 16, borderRadius: T.radiusSm, marginBottom: 16,
                background: 'rgba(108,92,231,0.06)', border: '1px solid rgba(108,92,231,0.12)',
              }}>
                <div style={{ fontSize: 12, color: T.textDim }}>ยอดรวม</div>
                <div style={{
                  fontSize: 34, fontWeight: 900, marginTop: 4,
                  background: T.grad1, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>฿{fmt(total)}</div>
              </div>
            )}

            <Btn full grad={T.grad2} onClick={submit} disabled={!desc.trim() || !amount || submitting}>
              {submitting ? '⏳ กำลังบันทึก...' : '✅ บันทึกออเดอร์'}
            </Btn>
            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: T.textMuted }}>
              🔒 ไม่สามารถแก้ไขหรือลบได้หลังบันทึก
            </div>
          </div>
        </>}

        {tab === 'summary' && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <Stat label="วันนี้" value={todaySum} icon="🔥" gradient={T.grad3}
              sub={`${orders.filter(o => sameDay(o.created_at, new Date())).length} รายการ`} />
            <Stat label="7 วัน" value={weekSum} icon="📊" gradient={T.grad1} />
          </div>
          <Stat label="ยอดขายเดือนนี้" value={monthSum} icon="🏆" gradient={T.grad2}
            sub={`${orders.filter(o => thisMonth(o.created_at)).length} ออเดอร์`} />

          <div style={{ ...glass, padding: '18px 14px 10px', marginTop: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>📈 ยอดขาย 7 วัน</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chart7}>
                <defs>
                  <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.success} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={T.success} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" stroke={T.textMuted} fontSize={11} tickLine={false} />
                <YAxis stroke={T.textMuted} fontSize={11} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => [`฿${fmt(v)}`, 'ยอดขาย']} />
                <Area type="monotone" dataKey="ยอดขาย" stroke={T.success} strokeWidth={2.5} fill="url(#gE)" dot={{ r: 3, fill: T.success }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ ...glass, padding: 18, marginTop: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📅 เลือกวันที่</div>
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
              <div style={{ marginTop: 14, padding: 14, borderRadius: T.radiusSm, background: 'rgba(0,206,201,0.05)', border: '1px solid rgba(0,206,201,0.12)' }}>
                <div style={{ fontSize: 13, color: T.textDim }}>{fmtDateFull(dateFilter)}</div>
                <div style={{ fontSize: 28, fontWeight: 900, background: T.grad2, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '4px 0' }}>
                  ฿{fmt(dateOrders.reduce((s, o) => s + (o.total_amount || 0), 0))}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted }}>{dateOrders.length} ออเดอร์</div>
              </div>
            )}
          </div>
        </>}

        {tab === 'history' && <>
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
            {displayOrders.length ? displayOrders.map(o => <OrderItem key={o.id} order={o} />) : <Empty text="ไม่พบออเดอร์" />}
          </div>
        </>}
      </div>
    </div>
  )
}
