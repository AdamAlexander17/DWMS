import { useLocation } from 'react-router-dom'
import Sidebar, { MASTER_PATHS, PAYMENT_PATHS, TXN_PATHS } from './Sidebar'

export default function Layout({ children }) {
  const location = useLocation()
  const hasSub   = [...MASTER_PATHS, ...PAYMENT_PATHS, ...TXN_PATHS].some(p => location.pathname.startsWith(p))

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar />
      <main className={hasSub ? 'pt-24' : 'pt-14'}>
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
