import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import TitleBar from './components/TitleBar'
import Dashboard from './pages/Dashboard'
import Jobs from './pages/Jobs'
import Earnings from './pages/Earnings'
import Settings from './pages/Settings'
import { loadStoredTheme } from './lib/theme'

export type Page = 'dashboard' | 'jobs' | 'earnings' | 'settings'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')

  useEffect(() => {
    const gl = (window as unknown as { gridlock?: { settings: { load: () => Promise<Record<string, unknown>>; save: (cfg: unknown) => Promise<{ ok: boolean }> } } }).gridlock
    void loadStoredTheme(gl?.settings)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-1)' }}>
      <TitleBar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar page={page} setPage={setPage} />
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 28px' }}>
          {page === 'dashboard' && <Dashboard />}
          {page === 'jobs'      && <Jobs />}
          {page === 'earnings'  && <Earnings />}
          {page === 'settings'  && <Settings />}
        </main>
      </div>
    </div>
  )
}
