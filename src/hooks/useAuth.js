import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) await fetchProfile(session.user.id)
        else { setProfile(null); setLoading(false) }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, teams(id, name)')
      .eq('id', userId)
      .single()
    if (!error && data) setProfile(data)
    setLoading(false)
  }

  // หัวหน้าสร้างบัญชีพนักงาน
  async function createUser({ email, password, fullName, role, teamId }) {
    // ใช้ Supabase Auth Admin (ต้องใช้ service_role สำหรับ production)
    // ใน MVP ใช้ signUp แล้ว signIn กลับ
    const currentSession = await supabase.auth.getSession()

    // สร้าง user ใหม่
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error }

    // สร้าง profile
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: fullName,
      role: role || 'employee',
      team_id: teamId || null,
    })
    if (profileError) return { error: profileError }

    // login กลับเป็น manager
    if (currentSession.data.session) {
      await supabase.auth.setSession({
        access_token: currentSession.data.session.access_token,
        refresh_token: currentSession.data.session.refresh_token,
      })
    }

    return { data }
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null); setProfile(null)
  }

  // แก้ไข profile (เปลี่ยนทีม, ชื่อ, etc.)
  async function updateProfile(userId, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()
    return { data, error }
  }

  // ดึงรายชื่อพนักงานทั้งหมด (สำหรับ manager)
  async function fetchAllProfiles() {
    const { data } = await supabase
      .from('profiles')
      .select('*, teams(id, name)')
      .order('created_at', { ascending: false })
    return data || []
  }

  return { user, profile, loading, signIn, signOut, createUser, updateProfile, fetchAllProfiles }
}
