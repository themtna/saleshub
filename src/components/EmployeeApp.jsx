import { useState, useMemo, useEffect, useRef } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { T, glass, fmt, fmtDate, fmtDateFull, fmtDateTime, sameDay, withinDays, thisMonth, Stat, Tabs, Btn, Toast, Empty, LiveDot } from './ui'

// โหลด addresses แบบ lazy — ไม่บล็อคหน้าเว็บ
let _addrCache = null
async function getAddresses() {
  if (_addrCache) return _addrCache
  const mod = await import('../data/addresses.json')
  _addrCache = mod.default
  return _addrCache
}

// ════════════════════════════════════════════
//  Smart Paste Parser
// ════════════════════════════════════════════
function parseSmartPaste(text, addressData = []) {
  const result = {}
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean)
  // แก้ typo: อ.เภอ → อำเภอ
  const fixedLines = lines.map(l => l.replace(/อ\.เภอ/g, 'อำเภอ'))
  const all = fixedLines.join(' ')

  // 1. เบอร์โทร — รองรับ โทร0624325651, 080-439-7802
  const cleaned = all.replace(/(\d)\s*[-–—]\s*(\d)/g, '$1$2')
  const phoneMatch = cleaned.match(/(?<!\d)(0[689]\d{8})(?!\d)/)
  if (phoneMatch) result.customerPhone = phoneMatch[1]

  // 2. รหัสไปรษณีย์ (5 หลัก)
  const zipCandidates = all.match(/[1-9]\d{4}/g) || []
  for (const z of zipCandidates) {
    if (result.customerPhone && result.customerPhone.includes(z)) continue
    if (parseInt(z) >= 10000 && parseInt(z) <= 96000) { result.zipCode = z; break }
  }

  // 3. ยอดเงิน — จับจาก COD, ปลายทาง (รวมใน @ ด้วย)
  const amtMatch = all.match(/(?:COD|ปลายทาง)\s*(\d+)/i)
  if (amtMatch) result.amount = amtMatch[1]

  // 4. FB / Line
  for (const line of fixedLines) {
    const fbM = line.match(/^(?:FB|Facebook)[:\s]+(.+)/i)
    if (fbM) result.customerSocial = fbM[1].trim()
    const liM = line.match(/^(?:Line|ไลน์)[:\s]+(.+)/i)
    if (liM) result.customerSocial = liM[1].trim()
  }

  // 5. P: = ชื่อเพจ (ทั้งก้อน)
  for (const line of fixedLines) {
    const pM = line.match(/^P[:\s]+(.+)/i)
    if (pM) { result.salesChannel = pM[1].trim(); break }
  }

  // 6. @ = หมายเหตุ
  for (const line of fixedLines) {
    const atM = line.match(/^@\s*(.+)/i)
    if (atM) { result.remark = atM[1].trim(); break }
  }

  // 7. ตำบล/อำเภอ/จังหวัด — ต้องมี space/ขึ้นบรรทัดก่อน ต./อ./จ.
  const tdMatch = all.match(/(?:^|\s)(?:ต\.|ตำบล)\s*([ก-๙ะ-์]+?)(?=\s|อ\.|อำเภอ|จ\.|จังหวัด|\d|$)/u)
  if (tdMatch) result.subDistrict = tdMatch[1]
  const dtMatch = all.match(/(?:^|\s)(?:อ\.|อำเภอ)\s*([ก-๙ะ-์]+?)(?=\s|จ\.|จังหวัด|\d|$)/u)
  if (dtMatch) result.district = dtMatch[1]
  const provMatch = all.match(/(?:^|\s)(?:จ\.|จังหวัด)\s*([ก-๙ะ-์]+?)(?=\s|\d|$)/u)
  if (provMatch) result.province = provMatch[1]

  // 8. Lookup จาก address data — เติม zip/ตำบล/อำเภอ/จังหวัด ที่ขาด
  if (addressData.length > 0) {
    if (result.zipCode && !result.subDistrict) {
      const matched = addressData.filter(a => a.z === result.zipCode)
      if (matched.length > 0) { const best = matched.find(a => all.includes(a.s)) || matched[0]; result.subDistrict = best.s; result.district = best.d; result.province = best.p }
    }
    if (!result.zipCode && result.subDistrict) {
      const found = addressData.find(a => a.s === result.subDistrict && (result.district ? a.d.includes(result.district) : true))
      if (found) { result.zipCode = found.z; if (!result.district) result.district = found.d; if (!result.province) result.province = found.p }
    }
    if (result.zipCode && !result.province) { const m = addressData.find(a => a.z === result.zipCode); if (m) result.province = m.p }
    if (!result.zipCode && !result.subDistrict && result.district) {
      const found = addressData.find(a => a.d.includes(result.district))
      if (found) { result.zipCode = found.z; result.subDistrict = found.s; if (!result.province) result.province = found.p }
    }
    // zip ผิด → ลอง verify กับ ตำบล+อำเภอ แล้วแก้ให้ถูก
    if (result.subDistrict && result.zipCode) {
      const verify = addressData.find(a => a.s === result.subDistrict && a.z === result.zipCode)
      if (!verify) {
        const correct = addressData.find(a => a.s === result.subDistrict && (result.district ? a.d.includes(result.district) : true))
        if (correct) { result.zipCode = correct.z; result.district = correct.d; result.province = correct.p }
      }
    }
  }

  // 9. ชื่อ
  const skipRe = /\d{3,}|ม\.|ต\.|ตำบล|อ\.|อำเภอ|จ\.|จังหวัด|COD|FB|^P:|^R\d|^@|Line:|หมู่|ซอย|ถนน|บ้านเลขที่|โทร/i

  // 9a. บรรทัด ชื่อ.xxx
  for (const line of fixedLines) {
    const nameM = line.match(/^ชื่อ[.\s:]+(.+)/i)
    if (nameM) { result.customerName = nameM[1].trim(); break }
  }

  // 9b. ชื่อ+ที่อยู่บรรทัดเดียว
  if (!result.customerName) {
    for (const line of fixedLines) {
      if (/^@|^FB|^P:|^R\d|^Line|^COD|^โทร|^ชื่อ/i.test(line)) continue
      const split = line.match(/^([ก-๙ะ-์\s]{4,40}?)\s+(\d.+)/)
      if (split) {
        const n = split[1].trim()
        if (n.length >= 3 && !/ต\.|อ\.|จ\.|ม\.|หมู่|ซอย|ถนน|บ้าน/.test(n)) {
          result.customerName = n
          let addr = split[2].trim()
          if (result.subDistrict) addr = addr.replace(new RegExp('(?:ต\\.|ตำบล)\\s*' + result.subDistrict, 'g'), '')
          if (result.district) addr = addr.replace(new RegExp('(?:อ\\.|อำเภอ)\\s*' + result.district, 'g'), '')
          addr = addr.replace(/จ[.\s]*[ก-๙ะ-์]+/gu, '').replace(/\d{5}/, '').replace(/[,.\s]+$/, '').trim()
          if (addr.length >= 3 && !result.customerAddress) result.customerAddress = addr
          break
        }
      }
    }
  }

  // 9c. บรรทัดแรกที่เป็นชื่อล้วน
  if (!result.customerName) {
    for (const line of fixedLines) {
      if (line.length >= 3 && line.length <= 50 && !skipRe.test(line) && /[ก-๙]/.test(line) && !/\d{5}/.test(line)) {
        result.customerName = line.replace(/^ชื่อ[.\s:]+/i, '').trim(); break
      }
    }
  }

  // 10. ที่อยู่ — รวมบรรทัดที่มี บ้านเลขที่/ซอย/หมู่
  if (!result.customerAddress) {
    const addrParts = []
    for (const line of fixedLines) {
      if (/^@|^FB|^P:|^R\d|^Line|^COD|^โทร|^ชื่อ/i.test(line)) continue
      if (line === result.customerName) continue
      if (/บ้านเลขที่|บ้านเลข|\d+\/\d|ซอย|ซ\.|หมู่|ม\.|ถนน|ถ\./.test(line)) {
        let addr = line
        if (result.subDistrict) addr = addr.replace(new RegExp('(?:ต\\.|ตำบล)\\s*' + result.subDistrict, 'g'), '')
        if (result.district) addr = addr.replace(new RegExp('(?:อ\\.|อำเภอ)\\s*' + result.district, 'g'), '')
        addr = addr.replace(/จ[.\s]*[ก-๙ะ-์]+/gu, '').replace(/\d{5}/, '').replace(/[,.\s]+$/, '').trim()
        if (addr.length >= 2) addrParts.push(addr)
      }
    }
    if (addrParts.length > 0) result.customerAddress = addrParts.join(' ')
  }

  // 11. Fallback
  if (!result.customerName && fixedLines.length === 1 && result.customerPhone) {
    const after = all.replace(/(?:โทร)?\s*0[689][\d\s-]{8,12}/, '').trim()
    const nm = after.match(/^([\s\u0E00-\u0E7F]{2,30})/)
    if (nm) { result.customerName = nm[1].trim(); let rest = after.substring(nm[0].length).replace(/\d{5}/, '').trim(); if (rest.length > 3) result.customerAddress = rest }
  }

  return result
}

function validatePhone(phone) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 0) return { valid: true, msg: '' }
  if (digits.length < 10) return { valid: false, msg: `เบอร์ขาด ${10 - digits.length} หลัก (${digits.length}/10)` }
  if (digits.length > 10) return { valid: false, msg: `เบอร์เกิน ${digits.length - 10} หลัก (${digits.length}/10)` }
  if (!digits.startsWith('0')) return { valid: false, msg: 'เบอร์ต้องขึ้นต้นด้วย 0' }
  return { valid: true, msg: '✅' }
}

function AddressSearch({ onSelect, currentValue, addresses = [] }) {
  const [query, setQuery] = useState(currentValue || '')
  const [results, setResults] = useState([])
  const [show, setShow] = useState(false)
  useEffect(() => { setQuery(currentValue || '') }, [currentValue])
  const search = (q) => {
    setQuery(q)
    if (q.length < 2) { setResults([]); return }
    setResults(addresses.filter(a => a.s.includes(q) || a.d.includes(q) || a.p.includes(q) || a.z.includes(q)).slice(0, 8))
    setShow(true)
  }
  return (
    <div style={{ position: 'relative', marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>🔍 ค้นหาตำบล/อำเภอ/รหัสไปรษณีย์</label>
      <input value={query} onChange={e => search(e.target.value)} onFocus={() => results.length > 0 && setShow(true)} onBlur={() => setTimeout(() => setShow(false), 200)}
        placeholder="พิมพ์ตำบล อำเภอ หรือ รหัสไปรษณีย์"
        style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box' }} />
      {show && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#fff', border: `1px solid ${T.border}`, borderRadius: T.radiusSm, maxHeight: 240, overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.12)' }}>
          {results.map((a, i) => (
            <div key={i} onClick={() => { onSelect(a); setQuery(`${a.s} > ${a.d} > ${a.p} ${a.z}`); setShow(false) }}
              style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: `1px solid ${T.border}`, fontSize: 13 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,134,11,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{a.s} → {a.d}</div>
              <div style={{ fontSize: 11, color: T.textDim }}>{a.p} · {a.z}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FI({ label, error, success, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>{label}</label>}
      <input {...props} style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${error ? 'rgba(214,48,49,0.4)' : T.border}`, background: error ? 'rgba(214,48,49,0.03)' : 'rgba(255,255,255,0.03)', color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box', ...(props.style || {}) }} />
      {error && <div style={{ fontSize: 11, color: T.danger, marginTop: 4 }}>{error}</div>}
      {success && <div style={{ fontSize: 11, color: T.success, marginTop: 4 }}>{success}</div>}
    </div>
  )
}

export default function EmployeeApp({ profile, onLogout }) {
  const [tab, setTab] = useState('create')
  const [form, setForm] = useState({ customerPhone: '', customerName: '', customerAddress: '', subDistrict: '', district: '', zipCode: '', province: '', customerSocial: '', salesChannel: '', amount: '', remark: '' })
  const [phoneError, setPhoneError] = useState('')
  const [addressWarning, setAddressWarning] = useState('')
  const [paymentType, setPaymentType] = useState('cod')
  const [slipFile, setSlipFile] = useState(null)
  const [slipPreview, setSlipPreview] = useState(null)
  const [dateFilter, setDateFilter] = useState('')
  const [dateOrders, setDateOrders] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [pasteDetected, setPasteDetected] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [addresses, setAddresses] = useState([])
  const [orders, setOrders] = useState([])

  // โหลด addresses + orders
  useEffect(() => {
    getAddresses().then(setAddresses).catch(() => {})

    // ดึง orders ของทีม (ถ้ามี team_id)
    const fetchOrders = async () => {
      try {
        let q = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100)
        if (profile.team_id) q = q.eq('team_id', profile.team_id)
        else q = q.eq('employee_id', profile.id)
        const { data } = await q
        setOrders(data || [])
      } catch {}
    }
    fetchOrders()

    // Realtime
    const ch = supabase.channel('emp-orders-' + profile.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' },
      (payload) => {
        const o = payload.new
        if ((profile.team_id && o.team_id === profile.team_id) || o.employee_id === profile.id) {
          setOrders(prev => [o, ...prev])
        }
      }
    ).subscribe()
    return () => supabase.removeChannel(ch)
  }, [profile.id, profile.team_id])

  const validateAddress = (f) => {
    const { subDistrict, district, zipCode, province } = f
    if (!subDistrict && !district && !zipCode) { setAddressWarning(''); return }
    if (addresses.length === 0) { setAddressWarning(''); return }

    const msgs = []

    // เช็คตำบล + อำเภอ
    if (subDistrict && district) {
      const m = addresses.find(a => a.s === subDistrict && a.d.includes(district))
      if (!m) {
        const correct = addresses.find(a => a.s === subDistrict)
        msgs.push(`ตำบล "${subDistrict}" ไม่อยู่ในอำเภอ "${district}"${correct ? ' (ควรเป็น ' + correct.d + ')' : ''}`)
      }
    }

    // เช็คตำบล + รหัส ปณ.
    if (subDistrict && zipCode) {
      const m = addresses.find(a => a.s === subDistrict && a.z === zipCode)
      if (!m) {
        const correct = addresses.find(a => a.s === subDistrict)
        if (correct) msgs.push(`รหัส ปณ. ของ "${subDistrict}" ควรเป็น ${correct.z} ไม่ใช่ ${zipCode}`)
      }
    }

    // เช็คอำเภอ + จังหวัด
    if (district && province) {
      const m = addresses.find(a => a.d.includes(district) && a.p === province)
      if (!m) {
        const correct = addresses.find(a => a.d.includes(district))
        msgs.push(`อำเภอ "${district}" ไม่อยู่ใน "${province}"${correct ? ' (ควรเป็น ' + correct.p + ')' : ''}`)
      }
    }

    // เช็ค รหัส ปณ. + จังหวัด
    if (zipCode && province && !district) {
      const m = addresses.find(a => a.z === zipCode && a.p === province)
      if (!m) {
        const correct = addresses.find(a => a.z === zipCode)
        if (correct) msgs.push(`รหัส ปณ. "${zipCode}" อยู่ใน "${correct.p}" ไม่ใช่ "${province}"`)
      }
    }

    setAddressWarning(msgs.length > 0 ? '⚠️ ' + msgs.join(' · ') : '')
  }

  const set = (k) => (e) => {
    const newForm = { ...form, [k]: e.target.value }
    setForm(newForm)
    if (k === 'customerPhone') setPhoneError(validatePhone(e.target.value).valid ? '' : validatePhone(e.target.value).msg)
    if (['subDistrict', 'district', 'zipCode', 'province'].includes(k)) validateAddress(newForm)
  }

  const handleAddressSelect = (a) => {
    const newForm = { ...form, subDistrict: a.s, district: a.d, zipCode: a.z, province: a.p }
    setForm(newForm)
    setAddressWarning('') // เลือกจาก dropdown ถูกต้องเสมอ
  }

  const clearForm = () => { setForm({ customerPhone: '', customerName: '', customerAddress: '', subDistrict: '', district: '', zipCode: '', province: '', customerSocial: '', salesChannel: '', amount: '', remark: '' }); setPhoneError(''); setAddressWarning(''); setPasteText(''); setPaymentType('cod'); setSlipFile(null); setSlipPreview(null) }

  const submit = async () => {
    if (!validatePhone(form.customerPhone).valid) { setToast('❌ เบอร์โทรไม่ถูกต้อง'); setTimeout(() => setToast(null), 2500); return }
    if (!form.customerPhone || !form.customerName || !form.customerAddress || !form.amount) { setToast('❌ กรุณากรอก เบอร์, ชื่อ, ที่อยู่, ยอดเงิน'); setTimeout(() => setToast(null), 2500); return }
    if (paymentType === 'transfer' && !slipFile) { setToast('❌ กรุณาอัพโหลดสลิปโอนเงิน'); setTimeout(() => setToast(null), 2500); return }
    setSubmitting(true)
    const amt = parseFloat(form.amount) || 0

    // อัพโหลดสลิป (ถ้ามี)
    let slipUrl = ''
    if (slipFile && paymentType === 'transfer') {
      const fileName = `slips/${Date.now()}_${Math.random().toString(36).slice(2)}.${slipFile.name.split('.').pop()}`
      const { error: upErr } = await supabase.storage.from('slips').upload(fileName, slipFile)
      if (upErr) { setToast(`❌ อัพโหลดสลิปไม่สำเร็จ: ${upErr.message}`); setSubmitting(false); setTimeout(() => setToast(null), 2500); return }
      const { data: urlData } = supabase.storage.from('slips').getPublicUrl(fileName)
      slipUrl = urlData?.publicUrl || ''
    }

    const { error } = await supabase.from('orders').insert({
      order_date: new Date().toISOString().split('T')[0],
      customer_phone: form.customerPhone, customer_name: form.customerName,
      customer_address: form.customerAddress, sub_district: form.subDistrict,
      district: form.district, zip_code: form.zipCode, province: form.province,
      customer_social: form.customerSocial,
      sales_channel: form.salesChannel, sale_price: amt,
      cod_amount: paymentType === 'cod' ? amt : 0,
      payment_type: paymentType,
      slip_url: slipUrl,
      remark: form.remark, employee_id: profile.id, team_id: profile.team_id, employee_name: profile.full_name,
    })
    if (error) { setToast(`❌ ${error.message}`) } else { setToast('✅ บันทึกออเดอร์สำเร็จ!'); clearForm() }
    setSubmitting(false); setTimeout(() => setToast(null), 2500)
  }

  const handleDateChange = async (d) => {
    setDateFilter(d)
    if (d) {
      try {
        let q = supabase.from('orders').select('*').eq('order_date', d).order('daily_seq')
        if (profile.team_id) q = q.eq('team_id', profile.team_id)
        else q = q.eq('employee_id', profile.id)
        const { data } = await q
        setDateOrders(data || [])
      } catch { setDateOrders([]) }
    } else setDateOrders(null)
  }

  const todayOrders = orders.filter(o => sameDay(o.created_at, new Date()))
  const todaySum = todayOrders.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
  const weekSum = orders.filter(o => withinDays(o.created_at, 7)).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
  const monthSum = orders.filter(o => thisMonth(o.created_at)).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
  const chart7 = useMemo(() => { const a = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); a.push({ date: fmtDate(d), ยอดขาย: orders.filter(o => sameDay(o.created_at, d)).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0) }) } return a }, [orders])
  const displayOrders = dateOrders || orders.slice(0, 50)
  const ts = { background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, fontFamily: T.font, fontSize: 13 }
  const phoneOk = form.customerPhone.length === 10 && !phoneError
  const amt = parseFloat(form.amount) || 0

  return (
    <div style={{ fontFamily: T.font, minHeight: '100vh', background: T.bg, color: T.text, paddingBottom: 40 }}>
      <Toast message={toast} />
      {pasteDetected && <div style={{ position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)', background: T.grad1, padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 8px 30px rgba(184,134,11,0.25)', fontFamily: T.font, color: '#fff' }}>📋 Smart Paste — แยกข้อมูลแล้ว!</div>}

      <div style={{ ...glass, borderRadius: 0, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.95)', borderBottom: `1px solid ${T.border}` }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 20, fontWeight: 900 }}>👤 ADMIN THE MT</span><LiveDot /></div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>{profile.full_name} · {profile.teams?.name || '—'}</div>
        </div>
        <button onClick={onLogout} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.textDim, fontSize: 12, cursor: 'pointer', fontFamily: T.font }}>ออก</button>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <Tabs items={[{ id: 'create', label: '➕ สร้างออเดอร์' }, { id: 'summary', label: '📊 สรุปยอด' }, { id: 'history', label: '📋 รายงาน' }]} active={tab} onChange={setTab} />
      </div>

      <div style={{ padding: 16 }}>
        {tab === 'create' && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
            <Stat compact label="วันนี้" value={todaySum} gradient={T.grad3} />
            <Stat compact label="7 วัน" value={weekSum} gradient={T.grad1} />
            <Stat compact label="เดือน" value={monthSum} gradient={T.grad2} />
          </div>
          <div style={{ ...glass, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>📝 ลำดับที่ {todayOrders.length + 1} ของวันนี้</div>
              <div style={{ fontSize: 11, color: T.textDim }}>👤 {profile.full_name}</div>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16, background: 'rgba(184,134,11,0.05)', border: '1px solid rgba(184,134,11,0.12)', fontSize: 12, color: T.gold, display: 'flex', alignItems: 'center', gap: 8 }}>
              📋 วางข้อมูลลูกค้าที่กล่อง Smart Paste ด้านล่าง → ระบบแยกให้อัตโนมัติ
            </div>

            {/* Smart Paste Box */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: T.gold, fontWeight: 600, marginBottom: 6 }}>📋 วางข้อมูลลูกค้าตรงนี้ (Smart Paste)</label>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                onPaste={e => {
                  const pasted = e.clipboardData.getData('text')
                  if (pasted && pasted.length >= 10) {
                    e.preventDefault()
                    setPasteText(pasted)
                    const p = parseSmartPaste(pasted, addresses)
                    setForm(prev => ({
                      ...prev,
                      customerPhone: p.customerPhone || prev.customerPhone, customerName: p.customerName || prev.customerName,
                      customerAddress: p.customerAddress || prev.customerAddress, subDistrict: p.subDistrict || prev.subDistrict,
                      district: p.district || prev.district, zipCode: p.zipCode || prev.zipCode, province: p.province || prev.province,
                      customerSocial: p.customerSocial || prev.customerSocial, salesChannel: p.salesChannel || prev.salesChannel,
                      amount: p.amount || prev.amount, remark: p.remark || prev.remark,
                    }))
                    if (p.customerPhone) { const v = validatePhone(p.customerPhone); setPhoneError(v.valid ? '' : v.msg) }
                    validateAddress({ subDistrict: p.subDistrict || form.subDistrict, district: p.district || form.district, zipCode: p.zipCode || form.zipCode, province: p.province || form.province })
                    setPasteDetected(true); setTimeout(() => setPasteDetected(false), 3000)
                    setToast('✅ Smart Paste สำเร็จ!'); setTimeout(() => setToast(null), 2500)
                  }
                }}
                placeholder={"วางข้อมูลจาก Line/Facebook ตรงนี้ เช่น:\nพันทิวา โพธิ์ขาว\n146ม.4ต.โพนเขวาอ.เมือง\nจ.ศรีสะเกษ33000\n080-4397802\nR2 COD 190\nFB: Pan Tiwa\nP: Rnine-ครีม\n@ ฝากไว้หน้าบ้าน"}
                rows={5}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: T.radiusSm,
                  border: '1px solid rgba(184,134,11,0.15)', background: 'rgba(184,134,11,0.03)',
                  color: T.text, fontSize: 14, fontFamily: T.font, outline: 'none',
                  boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.7,
                }}
              />
              {pasteText && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <Btn sm grad={T.grad1} onClick={() => {
                    const p = parseSmartPaste(pasteText, addresses)
                    setForm(prev => ({
                      ...prev,
                      customerPhone: p.customerPhone || prev.customerPhone, customerName: p.customerName || prev.customerName,
                      customerAddress: p.customerAddress || prev.customerAddress, subDistrict: p.subDistrict || prev.subDistrict,
                      district: p.district || prev.district, zipCode: p.zipCode || prev.zipCode, province: p.province || prev.province,
                      customerSocial: p.customerSocial || prev.customerSocial, salesChannel: p.salesChannel || prev.salesChannel,
                      amount: p.amount || prev.amount, remark: p.remark || prev.remark,
                    }))
                    if (p.customerPhone) { const v = validatePhone(p.customerPhone); setPhoneError(v.valid ? '' : v.msg) }
                    validateAddress({ subDistrict: p.subDistrict || form.subDistrict, district: p.district || form.district, zipCode: p.zipCode || form.zipCode, province: p.province || form.province })
                    setToast('✅ แยกข้อมูลสำเร็จ!'); setTimeout(() => setToast(null), 2000)
                  }}>✨ แยกข้อมูล</Btn>
                  <Btn sm outline onClick={() => { setPasteText(''); clearForm() }}>🗑 ล้าง</Btn>
                </div>
              )}
            </div>

            <FI label="📱 เบอร์มือถือ * (10 หลัก)" type="tel" maxLength={10} value={form.customerPhone} onChange={set('customerPhone')} placeholder="08xxxxxxxx" error={phoneError} success={phoneOk ? '✅ เบอร์ถูกต้อง' : ''} style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2 }} />
            <FI label="👤 ชื่อลูกค้า *" value={form.customerName} onChange={set('customerName')} placeholder="คุณลูกค้า" />
            <FI label="📍 ที่อยู่ *" value={form.customerAddress} onChange={set('customerAddress')} placeholder="29 หมู่ที่ 1 ถนน..." />

            <AddressSearch onSelect={handleAddressSelect} addresses={addresses} currentValue={form.subDistrict ? `${form.subDistrict} > ${form.district} > ${form.province} ${form.zipCode}` : ''} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FI label="ตำบล" value={form.subDistrict} onChange={set('subDistrict')} placeholder="ตำบล" />
              <FI label="อำเภอ" value={form.district} onChange={set('district')} placeholder="อำเภอ" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FI label="รหัส ปณ." value={form.zipCode} onChange={set('zipCode')} placeholder="10500" />
              <FI label="จังหวัด" value={form.province} onChange={set('province')} placeholder="กรุงเทพ" />
            </div>
            {addressWarning && (
              <div style={{ padding: '10px 14px', borderRadius: T.radiusSm, marginBottom: 14, background: 'rgba(214,48,49,0.05)', border: '1px solid rgba(214,48,49,0.15)', fontSize: 12, color: T.danger, lineHeight: 1.7 }}>
                {addressWarning}
              </div>
            )}
            {form.subDistrict && !addressWarning && addresses.length > 0 && (
              <div style={{ fontSize: 11, color: T.success, marginTop: -10, marginBottom: 14 }}>✅ ที่อยู่ถูกต้อง</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FI label="📘 ชื่อเฟสบุค" value={form.customerSocial} onChange={set('customerSocial')} placeholder="ชื่อ Facebook" />
              <FI label="📦 ชื่อเพจ (จาก P:)" value={form.salesChannel} onChange={set('salesChannel')} placeholder="เช่น ครีมหลงเลย หน้าขาว เพจหลักบริษัท" />
            </div>

            <FI label="💰 ยอดเงิน (฿) *" type="number" value={form.amount} onChange={set('amount')} placeholder="0" style={{ fontSize: 22, fontWeight: 800, textAlign: 'center' }} />

            {/* ประเภทการชำระเงิน */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 8 }}>💳 ประเภทการชำระเงิน</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button onClick={() => { setPaymentType('cod'); setSlipFile(null); setSlipPreview(null) }} style={{
                  padding: '12px', borderRadius: T.radiusSm, cursor: 'pointer', fontFamily: T.font, fontSize: 14, fontWeight: 600,
                  border: paymentType === 'cod' ? '2px solid ' + T.gold : '1px solid ' + T.border,
                  background: paymentType === 'cod' ? 'rgba(184,134,11,0.08)' : T.surface,
                  color: paymentType === 'cod' ? T.gold : T.textDim,
                }}>📦 เก็บเงินปลายทาง (COD)</button>
                <button onClick={() => setPaymentType('transfer')} style={{
                  padding: '12px', borderRadius: T.radiusSm, cursor: 'pointer', fontFamily: T.font, fontSize: 14, fontWeight: 600,
                  border: paymentType === 'transfer' ? '2px solid ' + T.success : '1px solid ' + T.border,
                  background: paymentType === 'transfer' ? 'rgba(45,138,78,0.08)' : T.surface,
                  color: paymentType === 'transfer' ? T.success : T.textDim,
                }}>🏦 โอนเงิน</button>
              </div>
            </div>

            {/* อัพโหลดสลิป (เฉพาะโอนเงิน) */}
            {paymentType === 'transfer' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 8 }}>🧾 อัพโหลดสลิปโอนเงิน *</label>
                <div style={{
                  padding: 16, borderRadius: T.radiusSm, textAlign: 'center',
                  border: `2px dashed ${slipFile ? T.success : T.border}`,
                  background: slipFile ? 'rgba(45,138,78,0.03)' : T.surfaceAlt,
                  cursor: 'pointer', position: 'relative',
                }} onClick={() => document.getElementById('slip-input').click()}>
                  <input id="slip-input" type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) { setToast('❌ ไฟล์ใหญ่เกิน 5MB'); setTimeout(() => setToast(null), 2500); return }
                        setSlipFile(file)
                        const reader = new FileReader()
                        reader.onload = (ev) => setSlipPreview(ev.target.result)
                        reader.readAsDataURL(file)
                      }
                    }}
                  />
                  {slipPreview ? (
                    <div>
                      <img src={slipPreview} alt="สลิป" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, marginBottom: 8 }} />
                      <div style={{ fontSize: 12, color: T.success, fontWeight: 600 }}>✅ {slipFile.name}</div>
                      <button onClick={e => { e.stopPropagation(); setSlipFile(null); setSlipPreview(null) }}
                        style={{ marginTop: 8, padding: '6px 14px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.textDim, fontSize: 12, cursor: 'pointer', fontFamily: T.font }}>
                        🗑 ลบสลิป
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.textDim }}>กดเพื่อเลือกรูปสลิป</div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>รองรับ JPG, PNG ไม่เกิน 5MB</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {amt > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div style={{ textAlign: 'center', padding: 12, borderRadius: T.radiusSm, background: 'rgba(184,134,11,0.05)', border: '1px solid rgba(184,134,11,0.12)' }}>
                  <div style={{ fontSize: 11, color: T.textDim }}>ราคาขาย</div>
                  <div style={{ fontSize: 22, fontWeight: 900, background: T.grad1, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>฿{fmt(amt)}</div>
                </div>
                <div style={{ textAlign: 'center', padding: 12, borderRadius: T.radiusSm, background: paymentType === 'cod' ? 'rgba(45,138,78,0.05)' : 'rgba(45,138,78,0.02)', border: `1px solid ${paymentType === 'cod' ? 'rgba(45,138,78,0.12)' : T.border}` }}>
                  <div style={{ fontSize: 11, color: T.textDim }}>{paymentType === 'cod' ? 'COD' : 'โอนแล้ว'}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, background: T.grad2, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {paymentType === 'cod' ? `฿${fmt(amt)}` : '✅'}
                  </div>
                </div>
              </div>
            )}

            <FI label="💬 หมายเหตุ" value={form.remark} onChange={set('remark')} placeholder="สินค้า / รายละเอียดเพิ่มเติม" />
            <Btn full grad={T.grad2} onClick={submit} disabled={submitting || !!phoneError}>{submitting ? '⏳ กำลังบันทึก...' : '✅ บันทึกออเดอร์'}</Btn>
            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: T.textMuted }}>🔒 ไม่สามารถแก้ไขหรือลบได้หลังบันทึก</div>
          </div>
        </>}

        {tab === 'summary' && (() => {
          const todayCod = todayOrders.filter(o => o.payment_type !== 'transfer')
          const todayTrans = todayOrders.filter(o => o.payment_type === 'transfer')
          const todayCodSum = todayCod.reduce((s,o) => s+(parseFloat(o.cod_amount)||0), 0)
          const todayTransSum = todayTrans.reduce((s,o) => s+(parseFloat(o.sale_price)||0), 0)
          const monthOrders = orders.filter(o => thisMonth(o.created_at))
          const monthCodSum = monthOrders.filter(o => o.payment_type !== 'transfer').reduce((s,o) => s+(parseFloat(o.cod_amount)||0), 0)
          const monthTransSum = monthOrders.filter(o => o.payment_type === 'transfer').reduce((s,o) => s+(parseFloat(o.sale_price)||0), 0)
          return <>
            {/* ยอดรวม */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <Stat label="วันนี้" value={todaySum} icon="🔥" gradient={T.grad3} sub={`${todayOrders.length} ออเดอร์`} />
              <Stat label="7 วัน" value={weekSum} icon="📊" gradient={T.grad1} />
            </div>
            <Stat label="เดือนนี้" value={monthSum} icon="🏆" gradient={T.grad2} sub={`${monthOrders.length} ออเดอร์`} />

            {/* แยก COD / โอน — วันนี้ */}
            <div style={{ ...glass, padding: 16, marginTop: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📊 วันนี้ — แยกประเภท</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: 14, borderRadius: T.radiusSm, background: 'rgba(184,134,11,0.04)', border: '1px solid rgba(184,134,11,0.12)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: T.textDim }}>📦 COD ({todayCod.length})</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: T.gold }}>฿{fmt(todayCodSum)}</div>
                </div>
                <div style={{ padding: 14, borderRadius: T.radiusSm, background: 'rgba(45,138,78,0.04)', border: '1px solid rgba(45,138,78,0.12)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: T.textDim }}>🏦 โอนเงิน ({todayTrans.length})</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: T.success }}>฿{fmt(todayTransSum)}</div>
                </div>
              </div>
            </div>

            {/* แยก COD / โอน — เดือนนี้ */}
            <div style={{ ...glass, padding: 16, marginTop: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📊 เดือนนี้ — แยกประเภท</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: 14, borderRadius: T.radiusSm, background: 'rgba(184,134,11,0.04)', border: '1px solid rgba(184,134,11,0.12)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: T.textDim }}>📦 COD ({monthOrders.filter(o=>o.payment_type!=='transfer').length})</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: T.gold }}>฿{fmt(monthCodSum)}</div>
                </div>
                <div style={{ padding: 14, borderRadius: T.radiusSm, background: 'rgba(45,138,78,0.04)', border: '1px solid rgba(45,138,78,0.12)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: T.textDim }}>🏦 โอนเงิน ({monthOrders.filter(o=>o.payment_type==='transfer').length})</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: T.success }}>฿{fmt(monthTransSum)}</div>
                </div>
              </div>
            </div>

            {/* กราฟ */}
            <div style={{ ...glass, padding: '18px 14px 10px', marginTop: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>📈 ยอดขาย 7 วัน</div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chart7}>
                  <defs><linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.success} stopOpacity={0.35}/><stop offset="100%" stopColor={T.success} stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                  <XAxis dataKey="date" stroke={T.textMuted} fontSize={11} tickLine={false} />
                  <YAxis stroke={T.textMuted} fontSize={11} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={ts} formatter={v => [`฿${fmt(v)}`, 'ยอดขาย']} />
                  <Area type="monotone" dataKey="ยอดขาย" stroke={T.success} strokeWidth={2.5} fill="url(#gE)" dot={{ r: 3, fill: T.success }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        })()}

        {tab === 'history' && <>
          <div style={{ ...glass, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📅 เลือกวันที่</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="date" value={dateFilter} onChange={e => handleDateChange(e.target.value)} style={{ flex: 1, padding: '11px 14px', borderRadius: T.radiusSm, background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.text, fontSize: 14, fontFamily: T.font, outline: 'none' }} />
              {dateFilter && <Btn sm outline onClick={() => handleDateChange('')}>ล้าง</Btn>}
            </div>
            {dateFilter && dateOrders && (() => {
              const codOrd = dateOrders.filter(o => o.payment_type !== 'transfer')
              const transOrd = dateOrders.filter(o => o.payment_type === 'transfer')
              return (
                <div style={{ marginTop: 12, padding: 14, borderRadius: T.radiusSm, background: 'rgba(184,134,11,0.05)', border: '1px solid rgba(184,134,11,0.12)' }}>
                  <div style={{ fontSize: 13, color: T.textDim, marginBottom: 6 }}>{fmtDateFull(dateFilter)}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div><div style={{ fontSize: 10, color: T.textMuted }}>ทั้งหมด</div><div style={{ fontSize: 20, fontWeight: 900, color: T.gold }}>{dateOrders.length}</div><div style={{ fontSize: 18, fontWeight: 900, color: T.success }}>฿{fmt(dateOrders.reduce((s,o)=>s+(parseFloat(o.sale_price)||0),0))}</div></div>
                    <div><div style={{ fontSize: 10, color: T.textMuted }}>📦 COD ({codOrd.length})</div><div style={{ fontSize: 18, fontWeight: 900, color: T.gold }}>฿{fmt(codOrd.reduce((s,o)=>s+(parseFloat(o.cod_amount)||0),0))}</div></div>
                    <div><div style={{ fontSize: 10, color: T.textMuted }}>🏦 โอน ({transOrd.length})</div><div style={{ fontSize: 18, fontWeight: 900, color: T.success }}>฿{fmt(transOrd.reduce((s,o)=>s+(parseFloat(o.sale_price)||0),0))}</div></div>
                  </div>
                </div>
              )
            })()}
          </div>

          {dateFilter && dateOrders ? (() => {
            const codOrd = dateOrders.filter(o => o.payment_type !== 'transfer')
            const transOrd = dateOrders.filter(o => o.payment_type === 'transfer')
            const renderOrd = (o, idx) => (
              <div key={o.id} style={{ ...glass, padding: '12px 16px', marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(184,134,11,0.1)', color: T.gold, marginRight: 6 }}>ลำดับที่ {o.daily_seq || (idx+1)}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{o.customer_name}</span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: T.success }}>฿{fmt(parseFloat(o.sale_price)||0)}</div>
                </div>
                <div style={{ fontSize: 11, color: T.textDim }}>📱 {o.customer_phone} {o.sales_channel && `· 📦 ${o.sales_channel}`} {o.remark && `· 💬 ${o.remark}`}</div>
                <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>🕐 {fmtDateTime(o.created_at)}</div>
                {o.slip_url && <a href={o.slip_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, padding: '3px 8px', borderRadius: 6, background: 'rgba(45,138,78,0.06)', border: '1px solid rgba(45,138,78,0.15)', fontSize: 11, color: T.success, fontWeight: 600, textDecoration: 'none' }}>🧾 ดูสลิป</a>}
              </div>
            )
            return (
              <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
                {codOrd.length > 0 && <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>📦 COD</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.gold }}>{codOrd.length} รายการ · ฿{fmt(codOrd.reduce((s,o)=>s+(parseFloat(o.cod_amount)||0),0))}</div>
                  </div>
                  {codOrd.map((o,i) => renderOrd(o,i))}
                </>}
                {transOrd.length > 0 && <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: 10, marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>🏦 โอนเงิน</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.success }}>{transOrd.length} รายการ · ฿{fmt(transOrd.reduce((s,o)=>s+(parseFloat(o.sale_price)||0),0))}</div>
                  </div>
                  {transOrd.map((o,i) => renderOrd(o,i))}
                </>}
                {dateOrders.length === 0 && <Empty text="ไม่มีออเดอร์วันนี้" />}
              </div>
            )
          })() : (
            <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
              {displayOrders.length ? displayOrders.map((o,i) => (
                <div key={o.id} style={{ ...glass, padding: '12px 16px', marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(184,134,11,0.1)', color: T.gold, marginRight: 6 }}>ลำดับที่ {o.daily_seq || (i+1)}</span>
                      <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: o.payment_type === 'transfer' ? 'rgba(45,138,78,0.1)' : 'rgba(184,134,11,0.08)', color: o.payment_type === 'transfer' ? T.success : T.gold }}>
                        {o.payment_type === 'transfer' ? '🏦 โอน' : '📦 COD'}
                      </span>
                      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{o.customer_name}</div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: T.success }}>฿{fmt(parseFloat(o.sale_price)||0)}</div>
                  </div>
                  <div style={{ fontSize: 11, color: T.textDim }}>📱 {o.customer_phone} {o.remark && `· 💬 ${o.remark}`}</div>
                  <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>🕐 {fmtDateTime(o.created_at)}</div>
                </div>
              )) : <Empty text="ไม่พบออเดอร์" />}
            </div>
          )}
        </>}
      </div>
      <style>{`@keyframes toastIn { from { transform:translate(-50%,-120%); opacity:0; } to { transform:translate(-50%,0); opacity:1; } }`}</style>
    </div>
  )
}
