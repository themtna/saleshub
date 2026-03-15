import { useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useReports() {
  // ยอดขายรายวัน (แยกตามพนักงาน + ทีม)
  const getDailySales = useCallback(async (date = null) => {
    const targetDate = date || new Date().toISOString().split('T')[0]
    const { data, error } = await supabase.rpc('get_daily_sales', {
      target_date: targetDate,
    })
    return { data: data || [], error }
  }, [])

  // ยอดขาย 7 วัน (แยกตามวัน)
  const getWeeklySales = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_weekly_sales')
    return { data: data || [], error }
  }, [])

  // ยอดขายรายเดือน (แยกตามทีม)
  const getMonthlySales = useCallback(async (month = null, year = null) => {
    const now = new Date()
    const { data, error } = await supabase.rpc('get_monthly_sales', {
      m: month || now.getMonth() + 1,
      y: year || now.getFullYear(),
    })
    return { data: data || [], error }
  }, [])

  return { getDailySales, getWeeklySales, getMonthlySales }
}
