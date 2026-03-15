import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '❌ ยังไม่ได้ตั้งค่า Supabase!\n' +
    '   1. cp .env.example .env\n' +
    '   2. แก้ค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY\n' +
    '   3. restart dev server'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
