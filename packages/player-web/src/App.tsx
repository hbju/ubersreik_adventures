import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ConfigMissing } from './components/ConfigMissing'
import { LoadingCard } from './components/LoadingCard'
import { AuthProvider, useAuth } from './context/AuthContext'
import { RootRedirect } from './routes/RootRedirect'
import { CampaignListScreen } from './screens/CampaignListScreen'
import { LoginScreen } from './screens/LoginScreen'
import { PlayerCampaignHome } from './screens/PlayerCampaignHome'

function LoginRoute() {
  const { configured, loading, session } = useAuth()
  if (!configured) return <ConfigMissing />
  if (loading) return <LoadingCard />
  if (session) return <Navigate to="/" replace />
  return <LoginScreen />
}

function Protected({ children }: { children: ReactNode }) {
  const { configured, loading, session } = useAuth()
  if (!configured) return <ConfigMissing />
  if (loading) return <LoadingCard />
  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div id="app" className="flex min-h-screen w-full flex-col items-center justify-center">
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/" element={<RootRedirect />} />
            <Route
              path="/campaigns"
              element={
                <Protected>
                  <CampaignListScreen />
                </Protected>
              }
            />
            <Route
              path="/play/:campaignId"
              element={
                <Protected>
                  <div className="flex min-h-screen w-full flex-col">
                    <PlayerCampaignHome />
                  </div>
                </Protected>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
