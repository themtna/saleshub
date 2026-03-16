import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useOrders({ teamId = null, employeeId = null } = {}) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('orders')
      .select('*, profiles(full_name, team_id)')
      .order('created_at', { ascending: false })
      .limit(300)

    if (teamId) query = query.eq('team_id', teamId)
    if (employeeId) query = query.eq('employee_id', employeeId)

    const { data, error } = await query
    if (!error && data) {
      // เติม employee_name จาก profiles ถ้าว่าง
      setOrders(data.map(o => ({
        ...o,
        employee_name: o.employee_name || o.profiles?.full_name || '—',
      })))
    }
    setLoading(false)
  }, [teamId, employeeId])

  const fetchOrdersByDate = useCallback(async (date) => {
    let query = supabase
      .from('orders')
      .select('*, profiles(full_name)')
      .eq('order_date', date)
      .order('daily_seq', { ascending: true })

    if (teamId) query = query.eq('team_id', teamId)

    const { data } = await query
    return (data || []).map(o => ({
      ...o,
      employee_name: o.employee_name || o.profiles?.full_name || '—',
    }))
  }, [teamId])

  useEffect(() => {
    fetchOrders()
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' },
        async (payload) => {
          const o = payload.new
          if (teamId && o.team_id !== teamId) return
          if (employeeId && o.employee_id !== employeeId) return
          // ดึงชื่อพนักงานถ้าว่าง
          if (!o.employee_name && o.employee_id) {
            const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', o.employee_id).single()
            o.employee_name = prof?.full_name || '—'
          }
          setOrders(prev => [o, ...prev])
        }
      ).subscribe()
    return () => supabase.removeChannel(channel)
  }, [teamId, employeeId, fetchOrders])

  const createOrder = async (d) => {
    const { data, error } = await supabase.from('orders').insert({
      order_date: new Date().toISOString().split('T')[0],
      customer_phone: d.customerPhone,
      customer_name: d.customerName,
      customer_address: d.customerAddress,
      sub_district: d.subDistrict || '',
      district: d.district || '',
      zip_code: d.zipCode || '',
      customer_social: d.customerSocial || '',
      sales_channel: d.salesChannel || '',
      sale_price: parseFloat(d.salePrice) || 0,
      cod_amount: parseFloat(d.codAmount) || 0,
      remark: d.remark || '',
      employee_id: d.employeeId,
      team_id: d.teamId,
      employee_name: d.employeeName || '',
    }).select().single()
    return { data, error }
  }

  return { orders, loading, createOrder, fetchOrdersByDate, refetch: fetchOrders }
}
