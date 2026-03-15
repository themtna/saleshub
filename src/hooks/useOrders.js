import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useOrders({ teamId = null, employeeId = null } = {}) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  // ── ดึงออเดอร์ ──────────────────────────────
  const fetchOrders = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('orders')
      .select(`
        *,
        profiles ( full_name ),
        teams ( name )
      `)
      .order('created_at', { ascending: false })
      .limit(300)

    if (teamId) query = query.eq('team_id', teamId)
    if (employeeId) query = query.eq('employee_id', employeeId)

    const { data, error } = await query

    if (!error && data) {
      // แปลงข้อมูลให้ใช้ง่าย
      setOrders(data.map(o => ({
        ...o,
        employee_name: o.profiles?.full_name || '—',
        team_name: o.teams?.name || '—',
      })))
    }
    setLoading(false)
  }, [teamId, employeeId])

  // ── Realtime subscription ───────────────────
  useEffect(() => {
    fetchOrders()

    // ⚡ สมัครรับออเดอร์ใหม่แบบ Real-time
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        async (payload) => {
          // ดึงข้อมูล profile + team ของออเดอร์ใหม่
          const { data } = await supabase
            .from('orders')
            .select('*, profiles(full_name), teams(name)')
            .eq('id', payload.new.id)
            .single()

          if (data) {
            const enriched = {
              ...data,
              employee_name: data.profiles?.full_name || '—',
              team_name: data.teams?.name || '—',
            }

            // กรองตาม team/employee ถ้ามี
            if (teamId && data.team_id !== teamId) return
            if (employeeId && data.employee_id !== employeeId) return

            setOrders(prev => [enriched, ...prev])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [teamId, employeeId, fetchOrders])

  // ── สร้างออเดอร์ ────────────────────────────
  const createOrder = async ({ description, amount, quantity, employeeId: empId, teamId: tId }) => {
    const { data, error } = await supabase
      .from('orders')
      .insert({
        employee_id: empId,
        team_id: tId,
        description,
        amount: parseFloat(amount),
        quantity: parseInt(quantity),
      })
      .select()
      .single()

    // ไม่ต้อง setOrders เอง → Realtime จะส่งมาให้อัตโนมัติ!
    return { data, error }
  }

  return { orders, loading, createOrder, refetch: fetchOrders }
}
