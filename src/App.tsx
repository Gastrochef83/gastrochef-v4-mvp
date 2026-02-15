import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import { ModeProvider } from './state/mode'

export default function App() {
  return (
    <ModeProvider>
      <HashRouter>
        <Routes>
          {/* ✅ IMPORTANT: AppLayout must own all routes */}
          <Route path="/*" element={<AppLayout />} />

          {/* fallback (usually not reached) */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </HashRouter>
    </ModeProvider>
  )
}
