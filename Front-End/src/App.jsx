import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Login        from './pages/Login'
import Dashboard    from './pages/Dashboard'
import Users        from './pages/Users'
import Roles        from './pages/Roles'
import Brands       from './pages/Brands'
import QRCodes      from './pages/QRCodes'
import UPISources   from './pages/UPISources'
import BankAccounts from './pages/BankAccounts'
import Deposits     from './pages/Deposits'
import Withdrawals  from './pages/Withdrawals'
import AuditLogs    from './pages/AuditLogs'
import Profile      from './pages/Profile'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={
        <ProtectedRoute>
          <Layout><Dashboard /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/users" element={
        <ProtectedRoute roles={['admin']}>
          <Layout><Users /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/roles" element={
        <ProtectedRoute roles={['admin']}>
          <Layout><Roles /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/brands" element={
        <ProtectedRoute roles={['admin']}>
          <Layout><Brands /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/qr-codes" element={
        <ProtectedRoute>
          <Layout><QRCodes /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/upi-sources" element={
        <ProtectedRoute>
          <Layout><UPISources /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/bank-accounts" element={
        <ProtectedRoute>
          <Layout><BankAccounts /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/deposits" element={
        <ProtectedRoute>
          <Layout><Deposits /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/withdrawals" element={
        <ProtectedRoute>
          <Layout><Withdrawals /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/audit-logs" element={
        <ProtectedRoute roles={['admin']}>
          <Layout><AuditLogs /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/profile" element={
        <ProtectedRoute>
          <Layout><Profile /></Layout>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
