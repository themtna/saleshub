import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // ดึง session ปัจจุบัน
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // ฟัง auth state change
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
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

    if (!error && data) {
      setProfile(data)
    }
    setLoading(false)
  }

  async function signUp({ email, password, fullName, role, teamId }) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error }

    // สร้าง profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        full_name: fullName,
        role: role,
        team_id: teamId || null,
      })

    if (profileError) return { error: profileError }
    return { data }
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return { user, profile, loading, signUp, signIn, signOut, refetchProfile: () => user && fetchProfile(user.id) }
}
