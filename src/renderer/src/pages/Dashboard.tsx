import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts'
import { isValidEvmWallet, shortEvmWallet } from '@shared/evm-wallet'
import SetupPanel from '../components/SetupPanel'

type GPU = {
  vendor?: string
  name: string
  index?: number
  vram_used_gb: number
  vram_total_gb: number
  utilization: number
  temperature: number
  power_w: number
  power_max_w: number
  detected?: boolean
  stats_available?: boolean
  cores?: number
  threads?: number
}

type CPU = {
  name: string
  cores: number
  threads: number
  detected?: boolean
}

type Job = { id: string; status: 'completed' | 'failed'; tokens: number; earn: number; ts: number }
type ActiveJob = { id: string; progress: number; tokens: number; tier: string }

const EMPTY_GPU: GPU = {
  vendor: 'none',
  name: 'Detecting…',
  vram_used_gb: 0,
  vram_total_gb: 0,
  utilization: 0,
  temperature: 0,
  power_w: 0,
  power_max_w: 0,
  detected: false,
}

const EMPTY_CPU: CPU = { name: 'Detecting…', cores: 0, threads: 0, detected: false }

function isValidWallet(w: string): boolean {
  return isValidEvmWallet(w)
}

function CircleGauge({ pct, size = 90, stroke = 6, label, value }: {
  pct: number; size?: number; stroke?: number; label: string; value: string
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const gap = circ * 0.28
  const arcLen = circ - gap
  const filled = arcLen * Math.min(1, pct / 100)
  const offset = -circ * 0.14

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--bg-4)" strokeWidth={stroke}
          strokeDasharray={`${arcLen} ${gap}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--accent)" strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          animate={{ strokeDasharray: `${filled} ${circ - filled}` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      }}>
        <div className="stat-value" style={{ lineHeight: 1 }}>{value}</div>
        <div className="section-label section-label--tight" style={{ fontSize: 8, letterSpacing: '0.12em', marginBottom: 0, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

function StatBar({ label, pct, valueLabel }: { label: string; pct: number; valueLabel: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span className="section-label" style={{ marginBottom: 0, fontSize: 9, letterSpacing: '0.14em' }}>{label}</span>
        <span className="text-subtle" style={{ fontSize: 11 }}>{valueLabel}</span>
      </div>
      <div style={{ height: 2, background: 'var(--bg-4)', borderRadius: 1, overflow: 'hidden' }}>
        <motion.div
          animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ height: '100%', background: 'var(--accent)', borderRadius: 1 }}
        />
      </div>
    </div>
  )
}

type GridlockApi = {
      daemon: {
    status: () => Promise<{
      running: boolean
      backend_ok?: boolean
      last_backend_error?: string | null
      gpu_detected?: boolean
      compute_mode?: string
      effective_compute?: string
      cpu?: CPU | null
      gpus?: GPU[]
      wallet_connected?: boolean
      inference_backend?: string | null
      worker_address?: string
      gpu: GPU | null
      active_job: ActiveJob | null
      tokens_per_sec: number
      jobs_today: number
      earnings_today: number
    }>
  }
  worker: {
    start: () => Promise<{ ok: boolean; error?: string; message?: string }>
    stop: () => Promise<{ ok: boolean }>
    jobs: () => Promise<{ jobs: Job[] }>
  }
  settings: {
    load: () => Promise<{ wallet?: string; teeMode?: boolean; autoStart?: boolean; maxVramPct?: number; tier?: string }>
    save: (cfg: unknown) => Promise<{ ok: boolean }>
  }
}

function gl(): GridlockApi | undefined {
  return (window as unknown as { gridlock?: GridlockApi }).gridlock
}

export default function Dashboard() {
  const [workerOn, setWorkerOn] = useState(false)
  const [backendOk, setBackendOk] = useState(false)
  const [wallet, setWallet] = useState('')
  const [walletInput, setWalletInput] = useState('')
  const [walletSaving, setWalletSaving] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [toggleBusy, setToggleBusy] = useState<'starting' | 'stopping' | null>(null)
  const [setupReady, setSetupReady] = useState(true)
  const [gpuDetected, setGpuDetected] = useState(false)
  const [effectiveCompute, setEffectiveCompute] = useState<'cpu' | 'gpu'>('gpu')
  const [cpu, setCpu] = useState<CPU>(EMPTY_CPU)
  const [inferenceBackend, setInferenceBackend] = useState<string | null>(null)
  const [gpu, setGpu] = useState<GPU>(EMPTY_GPU)
  const [jobs, setJobs] = useState<Job[]>([])
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null)
  const [tokensPerSec, setTokensPerSec] = useState(0)
  const [earningsToday, setEarningsToday] = useState(0)
  const [jobsToday, setJobsToday] = useState(0)
  const [history, setHistory] = useState(() =>
    Array.from({ length: 40 }, (_, i) => ({ t: i, v: 0 }))
  )

  const walletConnected = isValidWallet(wallet)

  useEffect(() => {
    gl()?.settings.load().then((cfg) => {
      if (cfg.wallet) {
        setWallet(cfg.wallet)
        setWalletInput(cfg.wallet)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const check = (window as unknown as { gridlock?: { setup?: { check: () => Promise<{ ready: boolean }> } } }).gridlock?.setup?.check
    if (!check) return
    const pollSetup = async () => {
      try {
        const s = await check()
        setSetupReady(s.ready)
      } catch { /* ignore */ }
    }
    void pollSetup()
    const iv = setInterval(pollSetup, 5000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const api = gl()
    if (!api) return
    const poll = async () => {
      try {
        const s = await api.daemon.status()
        if (s.gpu) setGpu(s.gpu)
        if (s.cpu) setCpu(s.cpu)
        setGpuDetected(Boolean(s.gpu_detected ?? (s.gpu?.vendor !== 'cpu' && s.gpu?.detected)))
        const usingCpuNow =
          s.effective_compute === 'cpu' ||
          s.gpu?.vendor === 'cpu' ||
          s.compute_mode === 'cpu' ||
          (s.compute_mode === 'auto' && !s.gpu_detected)
        setEffectiveCompute(usingCpuNow ? 'cpu' : 'gpu')
        setWorkerOn(s.running)
        setToggleBusy(prev => {
          if (prev === 'starting' && s.running) return null
          if (prev === 'stopping' && !s.running) return null
          return prev
        })
        setBackendOk(Boolean(s.backend_ok))
        setInferenceBackend(s.inference_backend ?? null)
        if (s.worker_address && isValidWallet(s.worker_address)) {
          setWallet(s.worker_address)
        }
        if (s.active_job) setActiveJob(s.active_job as ActiveJob)
        else setActiveJob(null)
        const tps = s.tokens_per_sec ?? 0
        setTokensPerSec(tps)
        setJobsToday(s.jobs_today ?? 0)
        setEarningsToday(s.earnings_today ?? 0)
        if (s.running && tps > 0) {
          setHistory(h => [...h.slice(1), { t: h[h.length - 1].t + 1, v: Math.max(1, Math.round(tps)) }])
        }

        const j = await api.worker.jobs()
        setJobs(j.jobs as Job[])
      } catch { /* daemon starting */ }
    }
    poll()
    const iv = setInterval(poll, 1200)
    return () => clearInterval(iv)
  }, [])

  const connectWallet = useCallback(async () => {
    const addr = walletInput.trim()
    if (!isValidWallet(addr)) return
    setWalletSaving(true)
    setStartError(null)
    try {
      const cfg = await gl()?.settings.load()
      await gl()?.settings.save({ ...cfg, wallet: addr })
      setWallet(addr)
      await new Promise(r => setTimeout(r, 800))
      const s = await gl()?.daemon.status()
      if (s && !s.backend_ok) {
        setStartError(s.last_backend_error ?? 'Connected wallet but Gridlock registration failed.')
      }
    } catch {
      setStartError('Failed to save wallet.')
    } finally {
      setWalletSaving(false)
    }
  }, [walletInput])

  const toggle = useCallback(async () => {
    const api = gl()
    if (toggleBusy) return

    if (!workerOn) {
      if (!walletConnected) {
        setStartError('Connect your wallet before starting.')
        return
      }
      setStartError(null)
      setToggleBusy('starting')
      try {
        const res = await api?.worker.start()
        if (!res?.ok) {
          setStartError(res?.message ?? 'Could not start worker.')
          setToggleBusy(null)
          return
        }
        setWorkerOn(true)
        setToggleBusy(null)
      } catch {
        setStartError('Worker daemon not responding.')
        setToggleBusy(null)
      }
    } else {
      setToggleBusy('stopping')
      setStartError(null)
      try {
        await api?.worker.stop()
        setWorkerOn(false)
        setActiveJob(null)
      } catch {
        setStartError('Could not stop worker.')
      } finally {
        setToggleBusy(null)
      }
    }
  }, [workerOn, walletConnected, toggleBusy])

  const usingCpu = effectiveCompute === 'cpu' || gpu.vendor === 'cpu'
  const computeReady = usingCpu ? Boolean(cpu.detected) : gpuDetected
  const canStartWorker = walletConnected && computeReady && setupReady

  const vramPct = gpu.vram_total_gb > 0 ? (gpu.vram_used_gb / gpu.vram_total_gb) * 100 : 0
  const isBusy = toggleBusy !== null
  const statusLabel = toggleBusy === 'starting'
    ? 'STARTING'
    : toggleBusy === 'stopping'
      ? 'STOPPING'
      : activeJob
        ? 'COMPUTING'
        : workerOn
          ? 'IDLE'
          : 'OFFLINE'
  const statusDotColor = workerOn || toggleBusy === 'starting' ? 'var(--accent)' : 'var(--text-muted)'
  const buttonLabel = toggleBusy === 'starting'
    ? 'STARTING…'
    : toggleBusy === 'stopping'
      ? 'STOPPING…'
      : workerOn
        ? 'STOP'
        : 'START WORKER'

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.22 }}>

      <SetupPanel />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div className="page-title page-title--compact">Dashboard</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className={workerOn || toggleBusy === 'starting' ? 'pulse-dot' : ''} style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: statusDotColor }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', color: toggleBusy ? 'var(--accent-text)' : 'var(--text-muted)' }}>{statusLabel}</span>
            {toggleBusy === 'starting' && (
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>
                · checking Ollama & Gridlock…
              </span>
            )}
            {walletConnected && (
              <span style={{ fontSize: 10, fontWeight: 700, color: backendOk ? 'var(--success)' : 'var(--text-muted)' }}>
                · Gridlock {backendOk ? 'connected' : 'pending'}
              </span>
            )}
            {inferenceBackend && workerOn && (
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>
                · {inferenceBackend}{usingCpu ? ' · CPU' : ' · GPU'}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={isBusy || (!workerOn && !canStartWorker)}
          className={isBusy ? 'btn-busy' : undefined}
          style={{
            padding: '8px 22px', borderRadius: 6, fontWeight: 600, fontSize: 11, letterSpacing: '0.06em',
            minWidth: 132, textAlign: 'center',
            background: isBusy
              ? 'var(--accent-mid)'
              : workerOn
                ? 'var(--accent-dim)'
                : canStartWorker
                  ? 'var(--accent)'
                  : 'var(--bg-4)',
            color: isBusy
              ? 'var(--on-accent)'
              : workerOn
                ? 'var(--accent-text)'
                : canStartWorker
                  ? 'var(--on-accent)'
                  : 'var(--text-muted)',
            border: '1px solid var(--border-2)',
            cursor: isBusy || (!workerOn && !canStartWorker) ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s, color 0.15s, transform 0.08s',
            flexShrink: 0,
            opacity: !isBusy && !workerOn && !canStartWorker ? 0.55 : 1,
            transform: isBusy ? 'scale(0.98)' : undefined,
          }}
        >
          {buttonLabel}
        </button>
      </div>

      {/* Wallet gate */}
      {!walletConnected && (
        <div className="card" style={{ marginBottom: 12, border: '1px solid var(--border-2)' }}>
          <div className="section-label section-label--sm">CONNECT WALLET</div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.55 }}>
            Enter your operator wallet (0x…) to register as a worker. Set an optional earnings wallet in Settings for payouts.
          </p>
          <input
            value={walletInput}
            onChange={e => setWalletInput(e.target.value)}
            placeholder="0x wallet address…"
            className="mono"
            style={{ fontSize: 12, marginBottom: 10, width: '100%' }}
            onKeyDown={e => e.key === 'Enter' && connectWallet()}
          />
          <button
            onClick={connectWallet}
            disabled={!isValidWallet(walletInput) || walletSaving}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 6, fontWeight: 600, fontSize: 12,
              background: isValidWallet(walletInput) ? 'var(--accent)' : 'var(--bg-4)',
              color: isValidWallet(walletInput) ? 'var(--on-accent)' : 'var(--text-muted)',
              border: '1px solid var(--border-2)', cursor: isValidWallet(walletInput) ? 'pointer' : 'not-allowed',
            }}
          >
            {walletSaving ? 'CONNECTING…' : 'CONNECT WALLET'}
          </button>
        </div>
      )}

      {walletConnected && (
        <div className="card" style={{ marginBottom: 12, padding: '10px 13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="section-label" style={{ marginBottom: 4 }}>WALLET</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{shortEvmWallet(wallet)}</div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)' }}>CONNECTED</span>
        </div>
      )}

      {startError && (
        <div style={{ marginBottom: 12, padding: '10px 13px', borderRadius: 6, background: 'var(--error-dim)', border: '1px solid var(--error-border)', fontSize: 12, color: 'var(--error)', fontWeight: 600 }}>
          {startError}
        </div>
      )}

      {/* Hardware card */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-label section-label--sm">{usingCpu ? 'CPU COMPUTE' : 'GPU COMPUTE'}</div>
        {usingCpu ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <CircleGauge pct={workerOn && tokensPerSec > 0 ? Math.min(100, tokensPerSec / 2) : 0} label="LOAD" value={workerOn ? 'ON' : '—'} size={88} stroke={6} />
            <div style={{ flex: 1 }}>
              <div className="text-strong" style={{ fontSize: 13, marginBottom: 8 }}>{cpu.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
                Ollama runs on CPU. Slower than GPU but works without a graphics card.
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 10 }}>
                <span style={{ color: 'var(--text-muted)' }}>Cores <strong style={{ color: 'var(--text-secondary)' }}>{cpu.cores || '—'}</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>Threads <strong style={{ color: 'var(--text-secondary)' }}>{cpu.threads || '—'}</strong></span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <CircleGauge pct={gpu.utilization} label="GPU" value={`${Math.round(gpu.utilization)}%`} size={88} stroke={6} />
            <CircleGauge pct={vramPct} label="VRAM" value={`${gpu.vram_used_gb.toFixed(0)}G`} size={88} stroke={6} />
            <div style={{ flex: 1, paddingLeft: 4 }}>
              <div className="text-strong" style={{ fontSize: 13, marginBottom: 4 }}>
                {gpu.vendor && gpu.vendor !== 'none' ? `${gpu.vendor.toUpperCase()} · ` : ''}{gpu.name}
              </div>
              {!gpuDetected && (
                <div style={{ fontSize: 11, color: 'var(--error)', fontWeight: 600, marginBottom: 10, lineHeight: 1.5 }}>
                  No GPU detected. Switch to CPU in Settings, or install NVIDIA / AMD drivers.
                </div>
              )}
              {gpuDetected && !gpu.stats_available && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 10, lineHeight: 1.5 }}>
                  GPU detected. Live stats require NVIDIA drivers or ROCm (AMD).
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <StatBar label="VRAM" pct={vramPct} valueLabel={`${gpu.vram_used_gb.toFixed(1)} / ${gpu.vram_total_gb} GB`} />
                <StatBar label="POWER" pct={gpu.power_max_w > 0 ? (gpu.power_w / gpu.power_max_w) * 100 : 0} valueLabel={`${Math.round(gpu.power_w)}W`} />
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 10 }}>
                <span style={{ color: 'var(--text-muted)' }}>Temp <strong style={{ color: 'var(--text-secondary)' }}>{gpu.temperature}°C</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>Max <strong style={{ color: 'var(--text-secondary)' }}>{gpu.power_max_w}W</strong></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 12 }}>
        {[
          { label: 'JOBS TODAY',   val: jobsToday.toString() },
          { label: 'TOKENS / SEC', val: workerOn && tokensPerSec > 0 ? (tokensPerSec >= 10 ? Math.round(tokensPerSec).toLocaleString() : tokensPerSec.toFixed(1)) : '—' },
          { label: 'EARNED TODAY', val: `${earningsToday.toFixed(4)} credits` },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '11px 13px' }}>
            <div className="section-label section-label--tight">{s.label}</div>
            <div className="stat-value stat-value--md">{s.val}</div>
          </div>
        ))}
      </div>

      {workerOn && history.some(h => h.v > 0) && (
        <div className="card" style={{ marginBottom: 12, padding: '11px 13px' }}>
          <div className="section-label" style={{ marginBottom: 9 }}>THROUGHPUT</div>
          <ResponsiveContainer width="100%" height={46}>
            <AreaChart data={history} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="var(--accent)" strokeWidth={1.4} fill="url(#tg)" dot={false} isAnimationActive={false} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-3)', border: '1px solid var(--border)', fontSize: 10, borderRadius: 4, padding: '3px 8px' }}
                formatter={(v: number) => [`${v.toLocaleString()} tok/s`, '']}
                labelFormatter={() => ''}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeJob && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>CURRENT JOB</div>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text-muted)' }}>
              <span>{activeJob.tier ?? 'standard'}</span>
              <span className="mono" style={{ color: 'var(--text-secondary)' }}>#{activeJob.id.slice(0, 8)}</span>
            </div>
          </div>
          <div style={{ height: 2, background: 'var(--bg-4)', borderRadius: 1, overflow: 'hidden', marginBottom: 5 }}>
            <motion.div
              animate={{ width: `${Math.min(100, activeJob.progress)}%` }}
              style={{ height: '100%', background: 'var(--accent)', borderRadius: 1 }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
            <span>{activeJob.tokens.toLocaleString()} tokens max</span>
            <span>{Math.min(100, Math.floor(activeJob.progress))}%</span>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '9px 13px', borderBottom: '1px solid var(--border)' }}>
          <span className="section-label" style={{ marginBottom: 0 }}>RECENT JOBS</span>
        </div>
        {jobs.length === 0 ? (
          <div style={{ padding: '22px 13px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
            {!walletConnected
              ? 'Connect wallet to begin'
              : workerOn
                ? 'Waiting for jobs from Gridlock…'
                : 'Start the worker to accept jobs'}
          </div>
        ) : (
          jobs.slice(0, 8).map(j => (
            <div key={j.id} style={{
              display: 'flex', alignItems: 'center', padding: '8px 13px',
              borderBottom: '1px solid var(--border)', gap: 10, fontSize: 11,
            }}>
              <span style={{ color: j.status === 'completed' ? 'var(--success)' : 'var(--error)', fontWeight: 600, fontSize: 12, width: 14 }}>
                {j.status === 'completed' ? '✓' : '✗'}
              </span>
              <span className="mono" style={{ color: 'var(--text-secondary)', flex: 1, fontSize: 10 }}>#{j.id.slice(0, 8)}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{j.tokens.toLocaleString()} tok</span>
              <span style={{ color: j.status === 'completed' ? 'var(--accent-text)' : 'var(--text-muted)', fontWeight: 700, minWidth: 82, textAlign: 'right' }}>
                {j.status === 'completed' ? `+${j.earn} $GRID` : '—'}
              </span>
            </div>
          ))
        )}
      </div>
    </motion.div>
  )
}
