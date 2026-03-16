import { useState, useEffect, lazy, Suspense } from 'react'
import { supabase } from './lib/supabase'
import { GlobalStyles, T } from './components/ui'
import LoginPage from './components/LoginPage'

const ManagerApp = lazy(() => import('./components/ManagerApp'))
const EmployeeApp = lazy(() => import('./components/EmployeeApp'))

export default function App() {
  const [state, setState] = useState({ status: 'loading', user: null, profile: null })

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('*, teams(id, name)').eq('id', session.user.id).single()
        if (data) { setState({ status: 'ready', user: session.user, profile: data }); return }
      }
      setState({ status: 'login', user: null, profile: null })
    }).catch(() => setState({ status: 'login', user: null, profile: null }))
  }, [])

  async function handleLogin(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return error.message
    const { data: prof } = await supabase.from('profiles').select('*, teams(id, name)').eq('id', data.user.id).single()
    if (!prof) { await supabase.auth.signOut(); return 'ไม่พบโปรไฟล์ — ติดต่อหัวหน้า' }
    setState({ status: 'ready', user: data.user, profile: prof })
    return null
  }

  function handleLogout() {
    setState({ status: 'login', user: null, profile: null })
    supabase.auth.signOut()
  }

  if (state.status === 'loading') return <><GlobalStyles /><Splash /></>
  if (state.status !== 'ready') return <><GlobalStyles /><LoginPage onLogin={handleLogin} /></>

  return (
    <><GlobalStyles />
      <Suspense fallback={<Splash />}>
        {state.profile.role === 'manager'
          ? <ManagerApp profile={state.profile} onLogout={handleLogout} />
          : <EmployeeApp profile={state.profile} onLogout={handleLogout} />}
      </Suspense>
    </>
  )
}

function Splash() {
  return (
    <div style={{ fontFamily: T.font, minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, margin: '0 auto 16px', background: T.grad1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, animation: 'livePulse 1.5s infinite' }}>⚡</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>SalesHub</div>
      </div>
    </div>
  )
}
