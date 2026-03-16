import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useTeams() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTeams = useCallback(async () => {
    const { data } = await supabase.from('teams').select('*').order('name')
    if (data) setTeams(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchTeams() }, [fetchTeams])

  const createTeam = async (name) => {
    const { data, error } = await supabase.from('teams').insert({ name }).select().single()
    if (!error && data) setTeams(prev => [...prev, data])
    return { data, error }
  }

  const updateTeam = async (id, name) => {
    const { data, error } = await supabase.from('teams').update({ name }).eq('id', id).select().single()
    if (!error && data) setTeams(prev => prev.map(t => t.id === id ? data : t))
    return { data, error }
  }

  const deleteTeam = async (id) => {
    const { error } = await supabase.from('teams').delete().eq('id', id)
    if (!error) setTeams(prev => prev.filter(t => t.id !== id))
    return { error }
  }

  return { teams, loading, createTeam, updateTeam, deleteTeam, refetch: fetchTeams }
}
