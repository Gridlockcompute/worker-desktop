type Props = {
  open: boolean
  onKeepRunning: () => void
  onExit: () => void
  onCancel: () => void
}

export default function CloseConfirmDialog({ open, onKeepRunning, onExit, onCancel }: Props) {
  if (!open) return null

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--overlay)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 400,
          maxWidth: 'calc(100vw - 48px)',
          padding: '22px 24px 20px',
          border: '1px solid var(--border-2)',
          boxShadow: 'var(--dialog-shadow)',
        }}
      >
        <div className="dialog-title" style={{ marginBottom: 8 }}>
          Close Gridlock Worker?
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 22 }}>
          You can keep the worker running in the background to continue processing jobs, or exit completely and stop the worker.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={onKeepRunning}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid var(--accent-border)',
              background: 'var(--accent-dim)',
              color: 'var(--accent-text)',
              fontSize: 13,
              fontWeight: 600,
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-mid)'
              e.currentTarget.style.borderColor = 'var(--accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent-dim)'
              e.currentTarget.style.borderColor = 'var(--accent-border)'
            }}
          >
            Keep running in background
          </button>

          <button
            onClick={onExit}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid var(--border-2)',
              background: 'var(--bg-3)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 500,
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-4)'
              e.currentTarget.style.borderColor = 'var(--border-3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-3)'
              e.currentTarget.style.borderColor = 'var(--border-2)'
            }}
          >
            Exit completely
          </button>

          <button
            onClick={onCancel}
            style={{
              width: '100%',
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--border-2)',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 500,
              transition: 'color 0.15s, border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)'
              e.currentTarget.style.borderColor = 'var(--border-3)'
              e.currentTarget.style.background = 'var(--bg-3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.borderColor = 'var(--border-2)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
