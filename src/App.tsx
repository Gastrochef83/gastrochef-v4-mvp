import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* ✅ IMPORTANT: AppLayout must own all routes */}
        <Route path="/*" element={<AppLayout />} />

        {/* fallback (usually not reached) */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter>
  )
}
