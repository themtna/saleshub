import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { T, glass, fmt, fmtDate, fmtDateFull, sameDay, withinDays, thisMonth, Stat, Tabs, Btn, Toast, Empty, LiveDot } from './ui'
import addressData from '../data/addresses.json'

const channels = ['Facebook', 'Line', 'TikTok', 'Shopee', 'Lazada', 'Walk-in', 'อื่นๆ']

// ════════════════════════════════════════════
//  Smart Paste Parser
// ════════════════════════════════════════════
function parseSmartPaste(text) {
  const result = {}
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean)
  const all = lines.join(' ')

  // 1. เบอร์โทร — รองรับ 080-439-7802, 080 4397802, 0804397802
  const cleaned = all.replace(/(\d)\s*[-–—]\s*(\d)/g, '$1$2')
  const phoneMatch = cleaned.match(/(?<!\d)(0[689]\d{8})(?!\d)/)
  if (phoneMatch) result.customerPhone = phoneMatch[1]

  // 2. รหัสไปรษณีย์ (5 หลัก, ขึ้นต้น 1-9, ไม่ใช่ส่วนเบอร์โทร)
  const zipCandidates = all.match(/[1-9]\d{4}/g) || []
  for (const z of zipCandidates) {
    if (result.customerPhone && result.customerPhone.includes(z)) continue
    if (parseInt(z) >= 10000 && parseInt(z) <= 96000) { result.zipCode = z; break }
  }

  // 3. COD + ราคาขาย
  const codMatch = all.match(/COD\s*[:\s]*(\d+)/i)
  if (codMatch) { result.codAmount = codMatch[1]; result.salePrice = codMatch[1] }

  // 4. FB / Line (จากทั้งบรรทัด)
  for (const line of lines) {
    const fbM = line.match(/^(?:FB|Facebook)[:\s]+(.+)/i)
    if (fbM) { result.customerSocial = fbM[1].trim(); result.salesChannel = 'Facebook' }
    const liM = line.match(/^(?:Line|ไลน์)[:\s]+(.+)/i)
    if (liM) { result.customerSocial = liM[1].trim(); result.salesChannel = 'Line' }
  }
  if (!result.salesChannel) {
    if (/FB|Facebook|เฟส/i.test(all)) result.salesChannel = 'Facebook'
    else if (/Line|ไลน์/i.test(all)) result.salesChannel = 'Line'
    else if (/TikTok/i.test(all)) result.salesChannel = 'TikTok'
    else if (/Shopee/i.test(all)) result.salesChannel = 'Shopee'
  }

  // 5. P: สินค้า/หมายเหตุ
  for (const line of lines) {
    const pM = line.match(/^P[:\s]+(.+)/i)
    if (pM) { result.remark = pM[1].trim(); break }
  }

  // 6. ตำบล/อำเภอ — รองรับ ต.โพนเขวาอ.เมือง (ติดกัน)
  const tdMatch = all.match(/(?:ต\.|ตำบล)\s*([ก-๙ะ-์]+?)(?=\s|อ\.|อำเภอ|จ\.|จังหวัด|\d|$)/u)
  if (tdMatch) result.subDistrict = tdMatch[1]

  const dtMatch = all.match(/(?:อ\.|อำเภอ)\s*([ก-๙ะ-์]+?)(?=\s|จ\.|จังหวัด|\d|$)/u)
  if (dtMatch) result.district = dtMatch[1]

  // 6b. Fallback: ใช้ address data ถ้า zip ตรง
  if (result.zipCode && !result.subDistrict) {
    const matched = addressData.filter(a => a.z === result.zipCode)
    if (matched.length > 0) {
      const best = matched.find(a => all.includes(a.s)) || matched[0]
      result.subDistrict = best.s
      result.district = best.d
    }
  }

  // 7. ชื่อ = บรรทัดแรกที่เป็นชื่อคน (ไม่มีตัวเลข/keyword)
  const skipRe = /\d{3,}|ม\.|ต\.|ตำบล|อ\.|อำเภอ|จ\.|จังหวัด|COD|FB|^P:|^R\d|Line:|หมู่|ซอย|ถนน/i
  for (const line of lines) {
    if (line.length >= 3 && line.length <= 50 && !skipRe.test(line) && /[ก-๙]/.test(line)) {
      result.customerName = line.trim(); break
    }
  }

  // 8. ที่อยู่ = บรรทัดที่มีเลขบ้าน/ม./ซอย
  for (const line of lines) {
    if (/\d/.test(line) && /[ก-๙]/.test(line)) {
      if (/^0[689]|^COD|^FB|^P:|^R\d|^Line/i.test(line)) continue
      if (line === result.customerName) continue
      let addr = line.trim()
      if (result.subDistrict) addr = addr.replace(new RegExp('(?:ต\\.|ตำบล)\\s*' + result.subDistrict, 'g'), '')
      if (result.district) addr = addr.replace(new RegExp('(?:อ\\.|อำเภอ)\\s*' + result.district, 'g'), '')
      addr = addr.replace(/จ[.\s]*[ก-๙ะ-์]+/gu, '')
      addr = addr.replace(/\d{5}/, '').replace(/[,.\s]+$/, '').trim()
      if (addr.length >= 3) { result.customerAddress = addr; break }
    }
  }

  // 9. Fallback: บรรทัดเดียว
  if (!result.customerName && lines.length === 1 && result.customerPhone) {
    const after = all.replace(/0[689][\d\s-]{8,12}/, '').trim()
    const nm = after.match(/^([\s\u0E00-\u0E7F]{2,30})/)
    if (nm) {
      result.customerName = nm[1].trim()
      let rest = after.substring(nm[0].length).replace(/\d{5}/, '').trim()
      if (rest.length > 3) result.customerAddress = rest
    }
  }

  return result
}

// ════════════════════════════════════════════
//  Phone Validation
// ════════════════════════════════════════════
function validatePhone(phone) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 0) return { valid: true, msg: '' }
  if (digits.length < 10) return { valid: false, msg: `เบอร์ขาด ${10 - digits.length} หลัก (${digits.length}/10)` }
  if (digits.length > 10) return { valid: false, msg: `เบอร์เกิน ${digits.length - 10} หลัก (${digits.length}/10)` }
  if (!digits.startsWith('0')) return { valid: false, msg: 'เบอร์ต้องขึ้นต้นด้วย 0' }
  return { valid: true, msg: '✅ เบอร์ถูกต้อง' }
}

// ════════════════════════════════════════════
//  Address Autocomplete
// ════════════════════════════════════════════
function AddressSearch({ onSelect, currentValue }) {
  const [query, setQuery] = useState(currentValue || '')
  const [results, setResults] = useState([])
  const [show, setShow] = useState(false)
  const ref = useRef()

  useEffect(() => { setQuery(currentValue || '') }, [currentValue])

  const search = (q) => {
    setQuery(q)
    if (q.length < 2) { setResults([]); return }
    const lower = q.toLowerCase()
    const found = addressData
      .filter(a =>
        a.s.includes(q) || a.d.includes(q) || a.p.includes(q) || a.z.includes(q)
      )
      .slice(0, 8)
    setResults(found)
    setShow(found.length > 0)
  }

  return (
    <div style={{ position: 'relative', marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>
        🔍 ค้นหาตำบล/อำเภอ/รหัสไปรษณีย์
      </label>
      <input
        ref={ref}
        value={query}
        onChange={e => search(e.target.value)}
        onFocus={() => results.length > 0 && setShow(true)}
        onBlur={() => setTimeout(() => setShow(false), 200)}
        placeholder="พิมพ์ตำบล อำเภอ หรือ รหัสไปรษณีย์"
        style={{
          width: '100%', padding: '13px 16px', borderRadius: T.radiusSm,
          border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.03)',
          color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box',
        }}
      />
      {show && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'rgba(16,20,36,0.98)', border: `1px solid ${T.border}`,
          borderRadius: T.radiusSm, maxHeight: 240, overflowY: 'auto',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}>
          {results.map((a, i) => (
            <div key={i}
              onClick={() => { onSelect(a); setQuery(`${a.s} > ${a.d} > ${a.p} ${a.z}`); setShow(false) }}
              style={{
                padding: '12px 16px', cursor: 'pointer', borderBottom: `1px solid ${T.border}`,
                fontSize: 13, transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(108,92,231,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{a.s} → {a.d}</div>
              <div style={{ fontSize: 11, color: T.textDim }}>{a.p} · {a.z}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════
//  Input with validation
// ════════════════════════════════════════════
function FormInput({ label, error, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>{label}</label>}
      <input {...props} style={{
        width: '100%', padding: '13px 16px', borderRadius: T.radiusSm,
        border: `1px solid ${error ? 'rgba(255,107,107,0.5)' : T.border}`,
        background: error ? 'rgba(255,107,107,0.04)' : 'rgba(255,255,255,0.03)',
        color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box',
        ...(props.style || {}),
      }} />
      {error && <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 4 }}>{error}</div>}
    </div>
  )
}

// ════════════════════════════════════════════
//  Main Component
// ════════════════════════════════════════════
export default function EmployeeApp({ profile, orders, onCreateOrder, onFetchByDate, onSignOut }) {
  const [tab, setTab] = useState('create')
  const [form, setForm] = useState({
    customerPhone: '', customerName: '', customerAddress: '',
    subDistrict: '', district: '', zipCode: '',
    customerSocial: '', salesChannel: 'Facebook',
    salePrice: '', codAmount: '0', remark: '',
  })
  const [phoneError, setPhoneError] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [dateOrders, setDateOrders] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')

  const set = (k) => (e) => {
    const val = e.target.value
    setForm(p => ({ ...p, [k]: val }))
    if (k === 'customerPhone') {
      const v = validatePhone(val)
      setPhoneError(v.valid ? '' : v.msg)
    }
  }

  const handleSmartPaste = () => {
    if (!pasteText.trim()) return
    const parsed = parseSmartPaste(pasteText)
    setForm(p => ({
      ...p,
      customerPhone: parsed.customerPhone || p.customerPhone,
      customerName: parsed.customerName || p.customerName,
      customerAddress: parsed.customerAddress || p.customerAddress,
      subDistrict: parsed.subDistrict || p.subDistrict,
      district: parsed.district || p.district,
      zipCode: parsed.zipCode || p.zipCode,
      customerSocial: parsed.customerSocial || p.customerSocial,
      salesChannel: parsed.salesChannel || p.salesChannel,
      salePrice: parsed.salePrice || p.salePrice,
      codAmount: parsed.codAmount || p.codAmount,
      remark: parsed.remark || p.remark,
    }))
    if (parsed.customerPhone) {
      const v = validatePhone(parsed.customerPhone)
      setPhoneError(v.valid ? '' : v.msg)
    }
    setPasteText('')
    setShowPaste(false)
    setToast('✅ วางข้อมูลสำเร็จ!')
    setTimeout(() => setToast(null), 2000)
  }

  const handleAddressSelect = (addr) => {
    setForm(p => ({
      ...p,
      subDistrict: addr.s,
      district: addr.d,
      zipCode: addr.z,
    }))
  }

  const submit = async () => {
    // Validate
    const phoneVal = validatePhone(form.customerPhone)
    if (!phoneVal.valid) { setToast('❌ ' + phoneVal.msg); setTimeout(() => setToast(null), 2500); return }
    if (!form.customerPhone || !form.customerName || !form.customerAddress || !form.salePrice) {
      setToast('❌ กรุณากรอก เบอร์, ชื่อ, ที่อยู่, ราคาขาย'); setTimeout(() => setToast(null), 2500); return
    }
    setSubmitting(true)
    const { error } = await onCreateOrder({
      ...form,
      employeeId: profile.id,
      teamId: profile.team_id,
      employeeName: profile.full_name,
    })
    if (error) {
      setToast(`❌ ${error.message}`)
    } else {
      setToast('✅ บันทึกออเดอร์สำเร็จ!')
      setForm({
        customerPhone: '', customerName: '', customerAddress: '',
        subDistrict: '', district: '', zipCode: '',
        customerSocial: '', salesChannel: 'Facebook',
        salePrice: '', codAmount: '0', remark: '',
      })
      setPhoneError('')
    }
    setSubmitting(false)
    setTimeout(() => setToast(null), 2500)
  }

  const handleDateChange = async (date) => {
    setDateFilter(date)
    if (date && onFetchByDate) {
      const data = await onFetchByDate(date)
      setDateOrders(data)
    } else { setDateOrders(null) }
  }

  const todaySum = orders.filter(o => sameDay(o.created_at, new Date())).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
  const todayCount = orders.filter(o => sameDay(o.created_at, new Date())).length
  const weekSum = orders.filter(o => withinDays(o.created_at, 7)).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
  const monthSum = orders.filter(o => thisMonth(o.created_at)).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)

  const chart7 = useMemo(() => {
    const arr = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      arr.push({
        date: fmtDate(d),
        ยอดขาย: orders.filter(o => sameDay(o.created_at, d)).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0),
      })
    }
    return arr
  }, [orders])

  const displayOrders = dateOrders || orders.slice(0, 50)
  const tooltipStyle = { background: 'rgba(10,14,26,0.96)', border: `1px solid ${T.border}`, borderRadius: 12, fontFamily: T.font, fontSize: 13 }

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
          { id: 'history', label: '📋 รายงาน' },
        ]} active={tab} onChange={setTab} />
      </div>

      <div style={{ padding: 16 }}>
        {/* ──── CREATE ──── */}
        {tab === 'create' && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
            <Stat compact label="วันนี้" value={todaySum} gradient={T.grad3} />
            <Stat compact label="7 วัน" value={weekSum} gradient={T.grad1} />
            <Stat compact label="เดือน" value={monthSum} gradient={T.grad2} />
          </div>

          <div style={{ ...glass, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>📝 ออเดอร์ #{todayCount + 1} วันนี้</div>
              <button onClick={() => setShowPaste(!showPaste)} style={{
                padding: '8px 14px', borderRadius: 10,
                background: showPaste ? T.grad1 : 'rgba(108,92,231,0.1)',
                border: 'none', color: showPaste ? '#fff' : '#a29bfe',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: T.font,
              }}>📋 Smart Paste</button>
            </div>

            {/* Smart Paste Box */}
            {showPaste && (
              <div style={{
                padding: 16, borderRadius: T.radiusSm, marginBottom: 16,
                background: 'rgba(108,92,231,0.06)', border: '1px solid rgba(108,92,231,0.15)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#a29bfe' }}>
                  📋 วางข้อมูลลูกค้าทั้งก้อน
                </div>
                <div style={{ fontSize: 11, color: T.textDim, marginBottom: 10, lineHeight: 1.6 }}>
                  วางข้อมูลจาก Line/Facebook/Notepad — ระบบจะแยกเบอร์ ชื่อ ที่อยู่ ให้อัตโนมัติ
                </div>
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder={"ตัวอย่าง:\n0815591110 คุณลูกค้า\n29 หมู่ที่ 1 ป่าแดด เมืองเชียงใหม่ 50100"}
                  rows={4}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: T.radiusSm,
                    border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.03)',
                    color: T.text, fontSize: 14, fontFamily: T.font, outline: 'none',
                    boxSizing: 'border-box', resize: 'vertical',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <Btn sm grad={T.grad1} onClick={handleSmartPaste}>✨ แยกข้อมูลอัตโนมัติ</Btn>
                  <Btn sm outline onClick={() => { setShowPaste(false); setPasteText('') }}>ปิด</Btn>
                </div>
              </div>
            )}

            {/* Phone with validation */}
            <FormInput
              label="📱 เบอร์มือถือ * (10 หลัก)"
              type="tel"
              maxLength={10}
              value={form.customerPhone}
              onChange={set('customerPhone')}
              placeholder="08xxxxxxxx"
              error={phoneError}
              style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2 }}
            />
            {form.customerPhone && !phoneError && form.customerPhone.length === 10 && (
              <div style={{ fontSize: 11, color: '#00cec9', marginTop: -10, marginBottom: 10 }}>✅ เบอร์ถูกต้อง (10 หลัก)</div>
            )}

            <FormInput label="👤 ชื่อลูกค้า *" value={form.customerName} onChange={set('customerName')} placeholder="คุณลูกค้า" />
            <FormInput label="📍 ที่อยู่ *" value={form.customerAddress} onChange={set('customerAddress')} placeholder="29 หมู่ที่ 1 ถนน..." />

            {/* Address Search */}
            <AddressSearch
              onSelect={handleAddressSelect}
              currentValue={form.subDistrict ? `${form.subDistrict} > ${form.district} > ${form.zipCode}` : ''}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <FormInput label="ตำบล" value={form.subDistrict} onChange={set('subDistrict')} placeholder="ตำบล" />
              <FormInput label="อำเภอ" value={form.district} onChange={set('district')} placeholder="อำเภอ" />
              <FormInput label="รหัส ปณ." value={form.zipCode} onChange={set('zipCode')} placeholder="10500" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FormInput label="เฟส/ไลน์" value={form.customerSocial} onChange={set('customerSocial')} placeholder="ชื่อเฟส" />
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>ช่องทาง</label>
                <select value={form.salesChannel} onChange={set('salesChannel')} style={{
                  width: '100%', padding: '13px 16px', borderRadius: T.radiusSm,
                  border: `1px solid ${T.border}`, background: 'rgba(10,14,26,0.95)',
                  color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box',
                }}>
                  {channels.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FormInput label="💰 ราคาขาย (฿) *" type="number" value={form.salePrice} onChange={set('salePrice')} placeholder="0" style={{ fontSize: 20, fontWeight: 800 }} />
              <FormInput label="📦 ยอด COD (฿)" type="number" value={form.codAmount} onChange={set('codAmount')} placeholder="0" style={{ fontSize: 20, fontWeight: 800 }} />
            </div>

            <FormInput label="💬 หมายเหตุ" value={form.remark} onChange={set('remark')} placeholder="สินค้าสีแดง x2, ฝากไว้หน้าบ้าน" />

            {parseFloat(form.salePrice) > 0 && (
              <div style={{
                textAlign: 'center', padding: 16, borderRadius: T.radiusSm, marginBottom: 16,
                background: 'rgba(108,92,231,0.06)', border: '1px solid rgba(108,92,231,0.12)',
              }}>
                <div style={{ fontSize: 12, color: T.textDim }}>ราคาขาย</div>
                <div style={{ fontSize: 34, fontWeight: 900, marginTop: 4, background: T.grad1, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  ฿{fmt(parseFloat(form.salePrice))}
                </div>
                {parseFloat(form.codAmount) > 0 && (
                  <div style={{ fontSize: 13, color: T.textDim, marginTop: 4 }}>COD: ฿{fmt(parseFloat(form.codAmount))}</div>
                )}
              </div>
            )}

            <Btn full grad={T.grad2} onClick={submit} disabled={submitting || !!phoneError}>
              {submitting ? '⏳ กำลังบันทึก...' : '✅ บันทึกออเดอร์'}
            </Btn>
            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: T.textMuted }}>
              🔒 ไม่สามารถแก้ไขหรือลบได้หลังบันทึก
            </div>
          </div>
        </>}

        {/* ──── SUMMARY ──── */}
        {tab === 'summary' && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <Stat label="วันนี้" value={todaySum} icon="🔥" gradient={T.grad3} sub={`${todayCount} ออเดอร์`} />
            <Stat label="7 วัน" value={weekSum} icon="📊" gradient={T.grad1} />
          </div>
          <Stat label="ยอดขายเดือนนี้" value={monthSum} icon="🏆" gradient={T.grad2}
            sub={`${orders.filter(o => thisMonth(o.created_at)).length} ออเดอร์`} />
          <div style={{ ...glass, padding: '18px 14px 10px', marginTop: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>📈 ยอดขาย 7 วัน</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chart7}>
                <defs><linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.success} stopOpacity={0.35}/><stop offset="100%" stopColor={T.success} stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" stroke={T.textMuted} fontSize={11} tickLine={false} />
                <YAxis stroke={T.textMuted} fontSize={11} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => [`฿${fmt(v)}`, 'ยอดขาย']} />
                <Area type="monotone" dataKey="ยอดขาย" stroke={T.success} strokeWidth={2.5} fill="url(#gE)" dot={{ r: 3, fill: T.success }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>}

        {/* ──── HISTORY ──── */}
        {tab === 'history' && <>
          <div style={{ ...glass, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📅 เลือกวันที่ดูออเดอร์</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="date" value={dateFilter} onChange={e => handleDateChange(e.target.value)}
                style={{
                  flex: 1, padding: '11px 14px', borderRadius: T.radiusSm,
                  background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`,
                  color: T.text, fontSize: 14, fontFamily: T.font, outline: 'none', colorScheme: 'dark',
                }} />
              {dateFilter && <Btn sm outline onClick={() => handleDateChange('')}>ล้าง</Btn>}
            </div>
            {dateFilter && dateOrders && (
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: T.textDim }}>{fmtDateFull(dateFilter)}</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, background: T.grad2, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    ฿{fmt(dateOrders.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0))}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{dateOrders.length} ออเดอร์</div>
                </div>
              </div>
            )}
          </div>
          <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
            {displayOrders.length ? displayOrders.map(o => (
              <div key={o.id} style={{ ...glass, padding: '14px 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      background: 'rgba(108,92,231,0.15)', color: '#a29bfe', marginRight: 8,
                    }}>{o.order_number}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{o.customer_name}</span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 15, background: T.grad2, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    ฿{fmt(parseFloat(o.sale_price) || 0)}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.8 }}>
                  📱 {o.customer_phone} · {o.sales_channel || '—'}
                  {parseFloat(o.cod_amount) > 0 && <span> · COD ฿{fmt(parseFloat(o.cod_amount))}</span>}
                  {o.remark && <div>💬 {o.remark}</div>}
                </div>
              </div>
            )) : <Empty text="ไม่พบออเดอร์" />}
          </div>
        </>}
      </div>
    </div>
  )
}
