import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-bg">
      <Sidebar />
      <main className="pt-14">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
