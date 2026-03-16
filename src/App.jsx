import { lazy, Suspense, useState, useEffect } from 'react'
import { GlobalStyles, T } from './components/ui'
import { useAuth } from './hooks/useAuth'
import { useOrders } from './hooks/useOrders'
import { useTeams } from './hooks/useTeams'
import LoginPage from './components/LoginPage'

const ManagerApp = lazy(() => import('./components/ManagerApp'))
const EmployeeApp = lazy(() => import('./components/EmployeeApp'))

function LoadingScreen() {
  const [slow, setSlow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setSlow(true), 3000); return () => clearTimeout(t) }, [])
  return (
    <div style={{ fontFamily: T.font, minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, margin: '0 auto 16px', background: T.grad1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, animation: 'livePulse 1.5s infinite' }}>⚡</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>กำลังโหลด...</div>
        {slow && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 12 }}>โหลดนานกว่าปกติ...</div>}
      </div>
    </div>
  )
}

export default function App() {
  const { user, profile, loading: authLoading, signIn, signOut, createUser, updateProfile, fetchAllProfiles } = useAuth()
  const { teams, loading: teamsLoading, createTeam, updateTeam, deleteTeam } = useTeams()
  const isManager = profile?.role === 'manager'
  const { orders, createOrder, fetchOrdersByDate } = useOrders(
    user && profile ? (isManager ? {} : { teamId: profile?.team_id }) : { skip: true }
  )

  // ถ้าโหลดนานเกิน 5 วินาที ให้หยุดรอแล้วไปหน้า Login
  const [forceReady, setForceReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setForceReady(true), 5000)
    return () => clearTimeout(t)
  }, [])

  const handleLogin = async ({ email, password }) => {
    const { error } = await signIn({ email, password })
    if (error) throw error
  }

  const isLoading = (authLoading || teamsLoading) && !forceReady

  if (isLoading) return <><GlobalStyles /><LoadingScreen /></>
  if (!user || !profile) return <><GlobalStyles /><LoginPage onLogin={handleLogin} /></>

  if (isManager) {
    return (
      <><GlobalStyles />
        <Suspense fallback={<LoadingScreen />}>
          <ManagerApp
            profile={profile} orders={orders} teams={teams}
            onCreateTeam={createTeam} onUpdateTeam={updateTeam} onDeleteTeam={deleteTeam}
            onCreateUser={createUser} onUpdateProfile={updateProfile}
            onFetchProfiles={fetchAllProfiles} onFetchByDate={fetchOrdersByDate}
            onSignOut={signOut}
          />
        </Suspense>
      </>
    )
  }

  return (
    <><GlobalStyles />
      <Suspense fallback={<LoadingScreen />}>
        <EmployeeApp
          profile={profile} orders={orders}
          onCreateOrder={createOrder} onFetchByDate={fetchOrdersByDate}
          onSignOut={signOut}
        />
      </Suspense>
    </>
  )
}
