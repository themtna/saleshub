import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useOrders({ teamId = null, employeeId = null } = {}) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)

    if (teamId) query = query.eq('team_id', teamId)
    if (employeeId) query = query.eq('employee_id', employeeId)

    const { data, error } = await query
    if (!error && data) setOrders(data)
    setLoading(false)
  }, [teamId, employeeId])

  const fetchOrdersByDate = useCallback(async (date) => {
    let query = supabase
      .from('orders')
      .select('*')
      .eq('order_date', date)
      .order('daily_seq', { ascending: true })

    if (teamId) query = query.eq('team_id', teamId)

    const { data } = await query
    return data || []
  }, [teamId])

  useEffect(() => {
    fetchOrders()
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const o = payload.new
          if (teamId && o.team_id !== teamId) return
          if (employeeId && o.employee_id !== employeeId) return
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
