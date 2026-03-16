import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function fetchProfile(userId) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*, teams(id, name)')
        .eq('id', userId)
        .single()
      if (data) { setProfile(data); return data }
    } catch {}
    return null
  }

  // เช็ค session ตอนเปิดเว็บ
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setUser(session.user)
          await fetchProfile(session.user.id)
        }
      } catch {}
      setLoading(false) // ← จบเสมอ ไม่ว่าจะเกิดอะไร
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser(session.user)
          await fetchProfile(session.user.id)
        } else {
          setUser(null)
          setProfile(null)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  async function signIn({ email, password }) {
    setError(null)
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); return { error: err } }
    // ดึง profile ทันทีหลัง login
    if (data.user) {
      setUser(data.user)
      const prof = await fetchProfile(data.user.id)
      if (!prof) { setError('ไม่พบโปรไฟล์ — ติดต่อหัวหน้าเพื่อสร้างบัญชี'); return { error: { message: 'ไม่พบโปรไฟล์' } } }
    }
    return { data }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  async function createUser({ email, password, fullName, role, teamId }) {
    const currentSession = await supabase.auth.getSession()
    const { data, error: err } = await supabase.auth.signUp({ email, password })
    if (err) return { error: err }

    const { error: profErr } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: fullName,
      role: role || 'employee',
      team_id: teamId || null,
    })
    if (profErr) return { error: profErr }

    // login กลับเป็น manager
    if (currentSession.data.session) {
      await supabase.auth.setSession({
        access_token: currentSession.data.session.access_token,
        refresh_token: currentSession.data.session.refresh_token,
      })
    }
    return { data }
  }

  async function updateProfile(userId, updates) {
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single()
    return { data, error }
  }

  async function fetchAllProfiles() {
    const { data } = await supabase.from('profiles').select('*, teams(id, name)').order('created_at', { ascending: false })
    return data || []
  }

  return { user, profile, loading, error, signIn, signOut, createUser, updateProfile, fetchAllProfiles }
}
