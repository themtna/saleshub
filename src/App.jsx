import { lazy, Suspense } from 'react'
import { GlobalStyles, T } from './components/ui'
import { useAuth } from './hooks/useAuth'
import { useOrders } from './hooks/useOrders'
import { useTeams } from './hooks/useTeams'
import LoginPage from './components/LoginPage'

const ManagerApp = lazy(() => import('./components/ManagerApp'))
const EmployeeApp = lazy(() => import('./components/EmployeeApp'))

function LoadingScreen() {
  return (
    <div style={{ fontFamily: T.font, minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, margin: '0 auto 16px', background: T.grad1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, animation: 'livePulse 1.5s infinite' }}>⚡</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>กำลังโหลด...</div>
      </div>
    </div>
  )
}

export default function App() {
  const { user, profile, loading, error, signIn, signOut, createUser, updateProfile, fetchAllProfiles } = useAuth()
  const { teams, createTeam, updateTeam, deleteTeam } = useTeams()
  const isManager = profile?.role === 'manager'
  const { orders, createOrder, fetchOrdersByDate } = useOrders(
    profile ? (isManager ? {} : { teamId: profile.team_id }) : { skip: true }
  )

  // กำลังเช็ค session → โชว์โหลดแป๊บเดียว
  if (loading) return <><GlobalStyles /><LoadingScreen /></>

  // ยังไม่ login หรือไม่มี profile → ไปหน้า Login
  if (!user || !profile) {
    return (
      <><GlobalStyles />
        <LoginPage
          onLogin={signIn}
          error={error}
        />
      </>
    )
  }

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
