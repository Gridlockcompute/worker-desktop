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
      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 20 }}>Earnings</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'TODAY', val: `${today.toFixed(4)} credits`, sub: 'worker share' },
          { label: 'THIS WEEK', val: `${week.toFixed(4)} credits`, sub: 'last 7 days' },
          { label: 'ALL TIME', val: `${total.toFixed(4)} credits`, sub: data?.source === 'router' ? 'from router' : 'local estimate' },
          { label: 'SLA PASS', val: data?.sla_pass_rate != null ? `${data.sla_pass_rate.toFixed(1)}%` : '—', sub: 'today' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '11px 13px' }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '1.2px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 7 }}>{s.label}</div>
            <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 3 }}>{s.val}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {history.length > 0 && (
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '1.2px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 14 }}>DAILY EARNINGS — LAST 7 DAYS</div>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={history} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barSize={26}>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 700 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as DayData
                return (
                  <div style={{
                    background: '#111111',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    minWidth: 120,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#ffffff', marginBottom: 4 }}>{d.day}</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#CCFF00' }}>{d.earn.toFixed(4)} <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(204, 255, 0, 0.45)' }}>credits</span></div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{d.jobs} jobs</div>
                  </div>
                )
              }}
            />
            <Bar dataKey="earn" radius={[3, 3, 0, 0]}>
              {history.map((d, i) => (
                <Cell key={i} fill={d.earn === maxBar ? '#CCFF00' : 'rgba(204, 255, 0, 0.18)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      )}

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '1.2px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 14 }}>PAYOUTS</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 14 }}>
          Earnings accumulate as credits on the router ledger. SLA misses deduct penalties from your pending balance automatically — no bond required.
          {data?.earnings_wallet && (
            <> Payout wallet: <span className="mono" style={{ color: 'var(--accent)' }}>{shortAddr(data.earnings_wallet)}</span>.</>
          )}
        </div>
        <button type="button" onClick={openDashboard} style={{ width: '100%', padding: '8px 0', background: 'var(--accent)', color: '#000000', border: '1px solid var(--accent)', borderRadius: 5, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
          WITHDRAW ON WEB DASHBOARD →
        </button>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '1.2px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 14 }}>OPTIONAL STAKING</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 14 }}>
          Stake ETH on the web for fee-share boosts. Separate from SLA penalties — missing a tier still deducts from pending earnings.
        </div>
        <button type="button" onClick={openStakePage} style={{ width: '100%', padding: '8px 0', background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-border)', borderRadius: 5, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          OPEN STAKE PAGE →
        </button>
      </div>

      <div className="card">
        <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '1.2px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>SLA PENALTIES DEDUCTED</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: penalties > 0 ? '#f87171' : 'var(--text-muted)' }}>
              {penalties > 0 ? `−${penalties.toFixed(4)}` : '0.0000'} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>credits</span>
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
