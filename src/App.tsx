import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import WorkItemFormPage from './pages/WorkItemFormPage'
import AdminPage from './pages/AdminPage'
import RecordsPage from './pages/RecordsPage'
import DashboardPage from './pages/DashboardPage'

export default function App() {
  return (
    <BrowserRouter basename="/kpi-tracker">
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/form" element={<WorkItemFormPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/records" element={<RecordsPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

