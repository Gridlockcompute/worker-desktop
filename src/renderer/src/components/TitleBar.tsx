import { useEffect, useState } from 'react'
import CloseConfirmDialog from './CloseConfirmDialog'
import { loadStoredTheme, persistTheme, type AppTheme } from '../lib/theme'

type WindowApi = {
  minimize: () => void
  maximize: () => void
  close: () => void
  quit: () => void
  onClosePrompt: (cb: () => void) => () => void
}

type GridlockApi = {
  window: WindowApi
  settings: {
    load: () => Promise<Record<string, unknown>>
    save: (cfg: unknown) => Promise<{ ok: boolean }>
  }
}

const api = () => (window as unknown as { gridlock?: GridlockApi }).gridlock

export default function TitleBar() {
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [theme, setTheme] = useState<AppTheme>('dark')

  useEffect(() => {
    const gl = api()
    void loadStoredTheme(gl?.settings).then(setTheme)

    const winApi = gl?.window
    if (!winApi?.onClosePrompt) return
    return winApi.onClosePrompt(() => setCloseDialogOpen(true))
  }, [])

  const keepRunning = () => {
    setCloseDialogOpen(false)
    void api()?.window.close()
  }

  const exitApp = () => {
    setCloseDialogOpen(false)
    void api()?.window.quit()
  }

  const toggleTheme = () => {
    const next: AppTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    void persistTheme(next, api()?.settings)
  }

  const iconBtnStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    background: 'none',
    border: 'none',
    borderRadius: 5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    opacity: 0.55,
    transition: 'opacity 0.1s, background 0.1s',
  }

  const onIconEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.opacity = '1'
    e.currentTarget.style.background = 'var(--bg-4)'
  }

  const onIconLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.opacity = '0.55'
    e.currentTarget.style.background = 'none'
  }

  return (
    <>
      <div style={{
        height: 38,
        background: 'var(--bg-1)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}>
        <div style={{ width: 180, display: 'flex', alignItems: 'center', paddingLeft: 16, gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <rect x="0.5" y="0.5" width="5.5" height="5.5" rx="1.5" fill="var(--accent)"/>
            <rect x="8" y="0.5" width="5.5" height="5.5" rx="1.5" fill="var(--title-logo-2)"/>
            <rect x="0.5" y="8" width="5.5" height="5.5" rx="1.5" fill="var(--title-logo-3)"/>
            <rect x="8" y="8" width="5.5" height="5.5" rx="1.5" fill="var(--title-logo-4)"/>
          </svg>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '0.12em' }}>
            GRIDLOCK
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', WebkitAppRegion: 'no-drag', paddingRight: 6, gap: 1, alignItems: 'center' } as React.CSSProperties}>
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={iconBtnStyle}
            onMouseEnter={onIconEnter}
            onMouseLeave={onIconLeave}
          >
            {theme === 'dark' ? (
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M7 1.2v1.6M7 11.2v1.6M1.2 7h1.6M11.2 7h1.6M2.8 2.8l1.1 1.1M10.1 10.1l1.1 1.1M2.8 11.2l1.1-1.1M10.1 3.9l1.1-1.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <path d="M10.8 8.9a4.4 4.4 0 0 1-6.1-6.1A4.4 4.4 0 1 0 10.8 8.9Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
            )}
          </button>

          {([
            { fn: () => api()?.window.minimize(), title: 'Minimize', path: 'M4 7h6', stroke: 'currentColor' },
            { fn: () => api()?.window.maximize(), title: 'Maximize', path: 'M4 4h6v6H4z', stroke: 'currentColor' },
            { fn: () => setCloseDialogOpen(true), title: 'Close', path: 'M4 4l6 6M10 4L4 10', stroke: 'currentColor' },
          ] as const).map(({ fn, title, path, stroke }) => (
            <button key={title} type="button" onClick={fn} title={title} style={iconBtnStyle}
              onMouseEnter={onIconEnter}
              onMouseLeave={onIconLeave}
            >
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                <path d={path} stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ))}
        </div>
      </div>

      <CloseConfirmDialog
        open={closeDialogOpen}
        onKeepRunning={keepRunning}
        onExit={exitApp}
        onCancel={() => setCloseDialogOpen(false)}
      />
    </>
  )
}
