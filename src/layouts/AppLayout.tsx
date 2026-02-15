import { useEffect, useState } from 'react'
import { NavLink, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

import Dashboard from '../pages/Dashboard'
import Ingredients from '../pages/Ingredients'
import Recipes from '../pages/Recipes'
import Settings from '../pages/Settings'
import RecipeEditor from '../pages/RecipeEditor'
import RecipeCookMode from '../pages/RecipeCookMode'

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block rounded-xl px-4 py-3 text-sm font-semibold transition ${
          isActive ? 'bg-neutral-900 text-white shadow' : 'text-neutral-700 hover:bg-neutral-100'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

export default function AppLayout() {
  const location = useLocation()
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const boot = async () => {
      const { data } = await supabase.auth.getUser()
      if (!mounted) return
      setUserEmail(data.user?.email ?? null)
    }

    boot()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setUserEmail(session?.user?.email ?? null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const onSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-neutral-100">
      <div className="container-app">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          {/* Sidebar */}
          <aside className="gc-card p-4">
            {/* Brand row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {/* Logo */}
                <div className="h-10 w-10 rounded-2xl bg-white border border-neutral-200 flex items-center justify-center overflow-hidden">
                  <img
                    src="/logo-gastrochef.png"
                    alt="GastroChef"
                    className="h-9 w-9 object-contain"
                  />
                </div>

                {/* Name */}
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-neutral-500">GastroChef</div>
                  <div className="text-lg font-extrabold text-neutral-900">v4 PRO</div>
                </div>
              </div>

              <button className="gc-btn gc-btn-ghost" onClick={onSignOut}>
                Sign out
              </button>
            </div>

            {/* Email */}
            <div className="mt-3 text-xs text-neutral-500 truncate">
              {userEmail ? userEmail : '—'}
            </div>

            {/* Nav */}
            <div className="mt-4 space-y-2">
              <NavItem to="/dashboard" label="Dashboard" />
              <NavItem to="/ingredients" label="Ingredients" />
              <NavItem to="/recipes" label="Recipes" />
              <NavItem to="/settings" label="Settings" />
            </div>

            {/* Quick / Status */}
            <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-neutral-600">Quick</div>
                <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-white border border-neutral-200 text-neutral-600">
                  MVP → PRO UI
                </span>
              </div>

              <div className="mt-2 text-xs text-neutral-500">
                Current: <span className="font-mono">{location.pathname}</span>
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="space-y-6">
            <Routes>
              {/* default */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/ingredients" element={<Ingredients />} />
              <Route path="/recipes" element={<Recipes />} />
              <Route path="/settings" element={<Settings />} />

              {/* ✅ Editor (accept /recipe, /recipe/, /recipe/anything) */}
              <Route path="/recipe/*" element={<RecipeEditor />} />

              {/* ✅ Cook Mode (accept /cook, /cook/, /cook/anything) */}
              <Route path="/cook/*" element={<RecipeCookMode />} />

              {/* fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  )
}
