// ═══ Google Sheet Realtime Sync ═══
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbxPoooGWacm6H1SAjvj_AN1qdp6-Qe7a1vdpwFzha22980Whru_abzfty0Uenv4pD_Ppg/exec'

export function syncOrderToSheet(order, employeeName) {
  if (!SHEET_URL) return
  try {
    fetch(SHEET_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync',
        orders: [{
          phone: order.customer_phone,
          name: order.customer_name,
          address: order.customer_address,
          sub_district: order.sub_district,
          district: order.district,
          zip: order.zip_code,
          fb: order.customer_social,
          channel: order.sales_channel,
          admin: order.employee_name || employeeName || '',
          price: order.sale_price,
          cod: order.cod_amount,
          remark: order.remark,
          province: order.province || '',
          slip: order.slip_url || '',
          order_number: order.order_number,
        }]
      })
    })
  } catch {}
}

export function deleteOrderFromSheet(orderNumber) {
  if (!SHEET_URL || !orderNumber) return
  try {
    fetch(SHEET_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', order_number: orderNumber })
    })
  } catch {}
}

export function syncAllToSheet(orders, profiles) {
  if (!SHEET_URL || !orders.length) return
  try {
    const rows = orders.map(o => ({
      phone: o.customer_phone, name: o.customer_name, address: o.customer_address,
      sub_district: o.sub_district, district: o.district, zip: o.zip_code,
      fb: o.customer_social, channel: o.sales_channel,
      admin: o.employee_name || (profiles || []).find(p => p.id === o.employee_id)?.full_name || '',
      price: o.sale_price, cod: o.cod_amount, remark: o.remark,
      province: o.province || '', slip: o.slip_url || '', order_number: o.order_number,
    }))
    fetch(SHEET_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync', orders: rows })
    })
  } catch {}
}
