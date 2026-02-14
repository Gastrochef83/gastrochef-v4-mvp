import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

import AppLayout from './layouts/AppLayout'

import Dashboard from './pages/Dashboard'
import Ingredients from './pages/Ingredients'
import Recipes from './pages/Recipes'
import RecipeEditor from './pages/RecipeEditor'
import Settings from './pages/Settings'

import RecipeCookMode from './pages/RecipeCookMode' // ✅ add this page

import Login from './pages/Login'
import Register from './pages/Register'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    let mounted = true

    const boot = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setAuthed(!!data.session)
      setChecking(false)
    }

    boot()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setAuthed(!!session)
      setChecking(false)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  if (checking) return <div className="gc-card p-6">Loading…</div>
  if (!authed) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected app */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          {/* default */}
          <Route index element={<Navigate to="dashboard" replace />} />

          {/* app pages */}
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="ingredients" element={<Ingredients />} />
          <Route path="recipes" element={<Recipes />} />
          <Route path="recipe" element={<RecipeEditor />} />      {/* ✅ /#/recipe?id=... */}
          <Route path="cook" element={<RecipeCookMode />} />      {/* ✅ /#/cook?id=... */}
          <Route path="settings" element={<Settings />} />

          {/* inside-app fallback */}
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* Global fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  )
}
