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
import DepositHistory from './pages/DepositHistory'
import Withdrawals  from './pages/Withdrawals'
import WithdrawalHistory from './pages/WithdrawalHistory'
import AuditLogs    from './pages/AuditLogs'
import Gateways     from './pages/Gateways'

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
        <ProtectedRoute modules={['users']}>
          <Layout><Users /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/roles" element={
        <ProtectedRoute modules={['roles']}>
          <Layout><Roles /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/brands" element={
        <ProtectedRoute modules={['brands']}>
          <Layout><Brands /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/qr-codes" element={
        <ProtectedRoute modules={['qr_codes']}>
          <Layout><QRCodes /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/upi-sources" element={
        <ProtectedRoute modules={['upi_sources']}>
          <Layout><UPISources /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/bank-accounts" element={
        <ProtectedRoute modules={['bank_accounts']}>
          <Layout><BankAccounts /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/deposits" element={
        <ProtectedRoute modules={['deposits']}>
          <Layout><Deposits /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/deposit-history" element={
        <ProtectedRoute modules={['deposit_history']}>
          <Layout><DepositHistory /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/withdrawals" element={
        <ProtectedRoute modules={['withdrawals']}>
          <Layout><Withdrawals /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/withdrawal-history" element={
        <ProtectedRoute modules={['withdrawal_history']}>
          <Layout><WithdrawalHistory /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/audit-logs" element={
        <ProtectedRoute modules={['audit_logs']}>
          <Layout><AuditLogs /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/gateways" element={
        <ProtectedRoute modules={['gateways']}>
          <Layout><Gateways /></Layout>
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
