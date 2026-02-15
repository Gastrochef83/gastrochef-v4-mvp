import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/*" element={<AppLayout />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter>
  )
}
