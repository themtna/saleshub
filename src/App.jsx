import { useState, useEffect } from 'react'
import { GlobalStyles, T } from './components/ui'
import { useAuth } from './hooks/useAuth'
import { useOrders } from './hooks/useOrders'
import { useTeams } from './hooks/useTeams'
import LoginPage from './components/LoginPage'
import ManagerApp from './components/ManagerApp'
import EmployeeApp from './components/EmployeeApp'

function LoadingScreen() {
  return (
    <div style={{
      fontFamily: T.font, minHeight: '100vh', background: T.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: T.text,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18, margin: '0 auto 16px',
          background: T.grad1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 30, animation: 'livePulse 1.5s infinite',
        }}>⚡</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>กำลังโหลด...</div>
      </div>
    </div>
  )
}

export default function App() {
  const { user, profile, loading: authLoading, signUp, signIn, signOut } = useAuth()
  const { teams, loading: teamsLoading, createTeam } = useTeams()

  // Orders — ถ้าเป็น employee ดึงเฉพาะทีมตัวเอง, manager ดึงทั้งหมด
  const isManager = profile?.role === 'manager'
  const { orders, createOrder } = useOrders(
    isManager ? {} : { teamId: profile?.team_id }
  )

  const handleLogin = async ({ email, password, fullName, role, teamId, isSignUp: isNew }) => {
    if (isNew) {
      const { error } = await signUp({ email, password, fullName, role, teamId })
      if (error) throw error
    } else {
      const { error } = await signIn({ email, password })
      if (error) throw error
    }
  }

  if (authLoading || teamsLoading) {
    return (
      <>
        <GlobalStyles />
        <LoadingScreen />
      </>
    )
  }

  if (!user || !profile) {
    return (
      <>
        <GlobalStyles />
        <LoginPage teams={teams} onLogin={handleLogin} />
      </>
    )
  }

  if (isManager) {
    return (
      <>
        <GlobalStyles />
        <ManagerApp
          profile={profile}
          orders={orders}
          teams={teams}
          onCreateTeam={createTeam}
          onSignOut={signOut}
        />
      </>
    )
  }

  return (
    <>
      <GlobalStyles />
      <EmployeeApp
        profile={profile}
        orders={orders}
        onCreateOrder={createOrder}
        onSignOut={signOut}
      />
    </>
  )
}
