import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useTeams() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTeams = useCallback(async () => {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('name')

    if (!error && data) {
      setTeams(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  const createTeam = async (name) => {
    const { data, error } = await supabase
      .from('teams')
      .insert({ name })
      .select()
      .single()

    if (!error && data) {
      setTeams(prev => [...prev, data])
    }
    return { data, error }
  }

  return { teams, loading, createTeam, refetch: fetchTeams }
}
