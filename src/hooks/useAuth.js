import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // ตั้ง timeout กันค้าง
    const timeout = setTimeout(() => {
      if (mounted && loading) setLoading(false)
    }, 4000)

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => { if (mounted) setLoading(false) })
      } else {
        setLoading(false)
      }
    }).catch(() => {
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
      }
    )

    return () => { mounted = false; clearTimeout(timeout); subscription.unsubscribe() }
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, teams(id, name)')
        .eq('id', userId)
        .single()
      if (!error && data) setProfile(data)
    } catch {}
  }

  async function createUser({ email, password, fullName, role, teamId }) {
    const currentSession = await supabase.auth.getSession()
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: fullName,
      role: role || 'employee',
      team_id: teamId || null,
    })
    if (profileError) return { error: profileError }

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

  async function updateProfile(userId, updates) {
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single()
    return { data, error }
  }

  async function fetchAllProfiles() {
    const { data } = await supabase.from('profiles').select('*, teams(id, name)').order('created_at', { ascending: false })
    return data || []
  }

  return { user, profile, loading, signIn, signOut, createUser, updateProfile, fetchAllProfiles }
}
