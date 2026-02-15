import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type Mode = 'kitchen' | 'mgmt'

type ModeCtx = {
  mode: Mode
  setMode: (m: Mode) => void
  isKitchen: boolean
  isMgmt: boolean
}

const ModeContext = createContext<ModeCtx | null>(null)

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => {
    try {
      const saved = localStorage.getItem('gc_mode')
      return saved === 'mgmt' ? 'mgmt' : 'kitchen'
    } catch {
      return 'kitchen'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('gc_mode', mode)
    } catch {}
    document.documentElement.dataset.mode = mode
  }, [mode])

  const value = useMemo<ModeCtx>(
    () => ({
      mode,
      setMode,
      isKitchen: mode === 'kitchen',
      isMgmt: mode === 'mgmt',
    }),
    [mode]
  )

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>
}

export function useMode() {
  const ctx = useContext(ModeContext)
  if (!ctx) throw new Error('useMode must be used within ModeProvider')
  return ctx
}
