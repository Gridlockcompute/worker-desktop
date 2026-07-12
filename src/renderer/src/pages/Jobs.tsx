import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { isValidEvmWallet } from '@shared/evm-wallet'

type Job = {
  id: string
  status: 'completed' | 'failed' | 'running'
  tokens: number
  earn: number
  tier: string
  duration_ms: number
  ts: number
}

function fmtJobTime(job: Job, now: number): string {
  const s = Math.max(0, Math.floor((now - job.ts * 1000) / 1000))
  if (job.status === 'running') {
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m ${s % 60}s`
  }
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

function isValidWallet(wallet: string): boolean {
  return isValidEvmWallet(wallet)
}

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed'>('all')
  const [walletConnected, setWalletConnected] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    const gl = (window as unknown as {
      gridlock?: {
        worker: { jobs: () => Promise<{ jobs: Job[] }> }
        settings: { load: () => Promise<{ wallet: string }> }
      }
    }).gridlock
    if (!gl) return

    gl.settings.load().then(s => setWalletConnected(isValidWallet(s.wallet))).catch(() => {})

    const poll = () => {
      gl.worker.jobs().then(r => setJobs(r.jobs as Job[])).catch(() => {})
    }
    poll()
    const iv = setInterval(poll, 5000)
    return () => clearInterval(iv)
  }, [])

  const visible = jobs.filter(j => filter === 'all' || j.status === filter)
  const totalEarn = jobs.filter(j => j.status === 'completed').reduce((s, j) => s + j.earn, 0)
  const totalTok  = jobs.filter(j => j.status === 'completed').reduce((s, j) => s + j.tokens, 0)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      <div className="page-title">Jobs</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'TOTAL JOBS',    val: jobs.length.toString() },
          { label: 'COMPLETED',     val: jobs.filter(j => j.status === 'completed').length.toString() },
          { label: 'TOKENS SERVED', val: `${(totalTok / 1_000_000).toFixed(2)}M` },
          { label: 'TOTAL EARNED',  val: `${totalEarn.toFixed(4)} $GRID` },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '11px 13px' }}>
            <div className="section-label section-label--tight">{s.label}</div>
            <div className="stat-value stat-value--md">{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
        {(['all', 'completed', 'failed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '7px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: 'none', border: 'none',
            color: filter === f ? 'var(--accent-text)' : 'var(--text-muted)',
            borderBottom: filter === f ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1, textTransform: 'capitalize',
          }}>{f}</button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {visible.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
            {!walletConnected
              ? 'Connect your wallet in Settings to see job history.'
              : 'No jobs yet — start the worker on the Dashboard.'}
          </div>
        ) : visible.map(j => (
          <div key={j.id} style={{
            display: 'grid', gridTemplateColumns: '24px 1fr 80px 80px 90px 70px',
            alignItems: 'center', padding: '9px 13px',
            borderBottom: '1px solid var(--border)', gap: 8, fontSize: 11,
          }}>
            <span style={{ color: j.status === 'completed' ? 'var(--success)' : j.status === 'running' ? 'var(--accent-text)' : 'var(--error)', fontWeight: 600 }}>
              {j.status === 'completed' ? '✓' : j.status === 'running' ? '…' : '✗'}
            </span>
            <span className="mono" style={{ color: 'var(--text-secondary)', fontSize: 10 }}>#{j.id.slice(0, 12)}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{j.tier ?? '—'}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{j.tokens.toLocaleString()} tok</span>
            <span style={{ fontWeight: 700, color: j.status === 'completed' ? 'var(--accent-text)' : 'var(--text-muted)' }}>
              {j.status === 'completed' ? `+${j.earn}` : '—'}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 10, textAlign: 'right' }}>{fmtJobTime(j, now)}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
