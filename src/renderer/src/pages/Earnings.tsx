import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

type DayData = { day: string; earn: number; jobs: number }

type EarningsView = {
  today: number
  week: number
  total: number
  penalties_paid: number
  earnings_wallet: string | null
  sla_pass_rate: number | null
  jobs_today: number
  history: DayData[]
  source: 'router' | 'local'
}

function openStakePage(): void {
  const gl = (window as unknown as { gridlock?: { app: { openStakePage: () => Promise<void> } } }).gridlock
  void gl?.app.openStakePage()
}

function openDashboard(): void {
  const gl = (window as unknown as { gridlock?: { app: { openDashboard: () => Promise<void> } } }).gridlock
  void gl?.app.openDashboard()
}

function shortAddr(addr: string): string {
  if (addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function Earnings() {
  const [data, setData] = useState<EarningsView | null>(null)

  useEffect(() => {
    const gl = (window as unknown as { gridlock?: { worker: { earnings: () => Promise<EarningsView> } } }).gridlock
    if (!gl) return
    const poll = () => {
      gl.worker.earnings().then(setData).catch(() => {})
    }
    poll()
    const iv = setInterval(poll, 5000)
    return () => clearInterval(iv)
  }, [])

  const today = data?.today ?? 0
  const week = data?.week ?? 0
  const total = data?.total ?? 0
  const penalties = data?.penalties_paid ?? 0
  const history = data?.history ?? []
  const maxBar = history.length ? Math.max(...history.map(d => d.earn), 0.0001) : 0.0001

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      <div className="page-title">Earnings</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'TODAY', val: `${today.toFixed(4)} credits`, sub: 'worker share' },
          { label: 'THIS WEEK', val: `${week.toFixed(4)} credits`, sub: 'last 7 days' },
          { label: 'ALL TIME', val: `${total.toFixed(4)} credits`, sub: data?.source === 'router' ? 'from router' : 'local estimate' },
          { label: 'SLA PASS', val: data?.sla_pass_rate != null ? `${data.sla_pass_rate.toFixed(1)}%` : '—', sub: 'today' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '11px 13px' }}>
            <div className="section-label section-label--tight">{s.label}</div>
            <div className="stat-value">{s.val}</div>
            <div className="text-subtle" style={{ fontSize: 10, marginTop: 3 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {history.length > 0 && (
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="section-label">DAILY EARNINGS — LAST 7 DAYS</div>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={history} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barSize={26}>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 700 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'var(--chart-cursor)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as DayData
                return (
                  <div style={{
                    background: 'var(--tooltip-bg)',
                    border: '1px solid var(--tooltip-border)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    minWidth: 120,
                  }}>
                    <div className="text-strong" style={{ fontSize: 11, marginBottom: 4 }}>{d.day}</div>
                    <div className="stat-value" style={{ fontSize: 13, color: 'var(--accent-text)' }}>
                      {d.earn.toFixed(4)} <span className="text-subtle" style={{ fontSize: 10, color: 'var(--accent-text-muted)' }}>credits</span>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tooltip-muted)', marginTop: 2 }}>{d.jobs} jobs</div>
                  </div>
                )
              }}
            />
            <Bar dataKey="earn" radius={[3, 3, 0, 0]}>
              {history.map((d, i) => (
                <Cell key={i} fill={d.earn === maxBar ? 'var(--accent)' : 'var(--accent-mid)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      )}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="section-label">PAYOUTS</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 14 }}>
          Earnings accumulate as credits on the router ledger. SLA misses deduct penalties from your pending balance automatically — no bond required.
          {data?.earnings_wallet && (
            <> Payout wallet: <span className="mono" style={{ color: 'var(--accent)' }}>{shortAddr(data.earnings_wallet)}</span>.</>
          )}
        </div>
        <button type="button" onClick={openDashboard} style={{ width: '100%', padding: '8px 0', background: 'var(--accent)', color: 'var(--on-accent)', border: '1px solid var(--accent)', borderRadius: 5, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
          WITHDRAW ON WEB DASHBOARD →
        </button>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="section-label">OPTIONAL STAKING</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 14 }}>
          Stake ETH on the web for fee-share boosts. Separate from SLA penalties — missing a tier still deducts from pending earnings.
        </div>
        <button type="button" onClick={openStakePage} style={{ width: '100%', padding: '8px 0', background: 'var(--accent-dim)', color: 'var(--accent-text)', border: '1px solid var(--accent-border)', borderRadius: 5, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          OPEN STAKE PAGE →
        </button>
      </div>

      <div className="card">
        <div className="section-label" style={{ marginBottom: 12 }}>SLA PENALTIES DEDUCTED</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="stat-value stat-value--xl" style={{ color: penalties > 0 ? '#f87171' : 'var(--text-muted)' }}>
              {penalties > 0 ? `−${penalties.toFixed(4)}` : '0.0000'} <span className="text-subtle" style={{ fontSize: 12 }}>credits</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginTop: 3 }}>
              Deducted from pending earnings when you miss TTFT targets
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
