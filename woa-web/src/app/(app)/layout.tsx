import { Sidebar } from '@/components/Sidebar'
import { BottomNav } from '@/components/BottomNav'
import { FloatingAppButton } from '@/components/FloatingAppButton'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop sidebar */}
      <div style={{ display: 'none' }} className="md-sidebar">
        <Sidebar />
      </div>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          minHeight: '100vh',
          paddingBottom: 70, // mobile bottom nav clearance
        }}
        className="app-main"
      >
        {children}
      </main>

      {/* Mobile bottom nav */}
      <div className="md-bottom-nav">
        <BottomNav />
      </div>

      <FloatingAppButton />

      <style>{`
        @media (min-width: 768px) {
          .md-sidebar { display: block !important; }
          .app-main { margin-left: 200px; padding-bottom: 0 !important; }
          .md-bottom-nav { display: none !important; }
        }
        @media (max-width: 767px) {
          .md-sidebar { display: none !important; }
          .md-bottom-nav { display: block !important; }
        }
      `}</style>
    </div>
  )
}
