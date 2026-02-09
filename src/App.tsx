import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'

import AppLayout from './layouts/AppLayout'

import Dashboard from './pages/Dashboard'
import Ingredients from './pages/Ingredients'
import Recipes from './pages/Recipes'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Register from './pages/Register'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)
  const location = useLocation()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session)
      setReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session)
      setReady(true)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) return <div className="container-app">Loading…</div>
  if (!authed) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

function AppShell() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const onSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AppLayout userEmail={email} onSignOut={onSignOut}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ingredients" element={<Ingredients />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </AppLayout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/*"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
