import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import Dashboard from './pages/Dashboard'
import Ingredients from './pages/Ingredients'
import Recipes from './pages/Recipes'
import RecipeEditor from './pages/RecipeEditor'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Register from './pages/Register'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/ingredients" element={<Ingredients />} />
        <Route path="/recipes" element={<Recipes />} />

        {/* ✅ IMPORTANT: This enables /recipe-editor?id=... */}
        <Route path="/recipe-editor" element={<RecipeEditor />} />

        <Route path="/settings" element={<Settings />} />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
