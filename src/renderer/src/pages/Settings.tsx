import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { currentTheme } from '../lib/theme'

type ComputeDevice = 'auto' | 'cpu' | 'gpu'

function Field({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: sub ? 2 : 8 }}>{label}</div>
      {sub && <div className="text-subtle" style={{ marginBottom: 8 }}>{sub}</div>}
      {children}
    </div>
  )
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      width: 40, height: 22, borderRadius: 11, border: '1px solid var(--border-2)',
        background: on ? 'var(--accent)' : 'var(--bg-4)',
        cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0
    }}>
      <div style={{
        position: 'absolute', top: 2, left: on ? 19 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: on ? 'var(--on-accent)' : 'var(--text-muted)',
        transition: 'left 0.2s'
      }} />
    </button>
  )
}

export default function Settings() {
  const [wallet, setWallet] = useState('')
  const [earningsWallet, setEarningsWallet] = useState('')
  const [teeMode, setTeeMode] = useState(false)
  const [autoStart, setAutoStart] = useState(false)
  const [maxVram, setMaxVram] = useState('90')
  const [tier, setTier] = useState('Batch')
  const [computeDevice, setComputeDevice] = useState<ComputeDevice>('auto')
  const [gpuIndex, setGpuIndex] = useState(0)
  const [detectedGpus, setDetectedGpus] = useState<{ index: number; name: string; vendor?: string }[]>([])
  const [cpuName, setCpuName] = useState('')
  const [saved, setSaved] = useState(false)
  const [teeHardwareDetected, setTeeHardwareDetected] = useState(false)
  const [teeCapable, setTeeCapable] = useState(false)
  const [routerTeeCapable, setRouterTeeCapable] = useState<boolean | null>(null)
  const [teeWarning, setTeeWarning] = useState<string | null>(null)
  const [teeForceOverride, setTeeForceOverride] = useState(false)

  useEffect(() => {
    const gl = (window as unknown as { gridlock?: {
      settings: { load: () => Promise<Record<string, unknown>> }
      daemon: { status: () => Promise<{
        gpus?: { index?: number; name: string; vendor?: string }[]
        cpu?: { name?: string }
        tee_hardware_detected?: boolean
        tee_capable?: boolean
        router_tee_capable?: boolean | null
        tee_warning?: string | null
        tee_force_override?: boolean
      }> }
    } }).gridlock
    gl?.settings.load().then((cfg) => {
      if (typeof cfg.wallet === 'string') setWallet(cfg.wallet)
      if (typeof cfg.earningsWallet === 'string') setEarningsWallet(cfg.earningsWallet)
      if (typeof cfg.teeMode === 'boolean') setTeeMode(cfg.teeMode)
      if (typeof cfg.autoStart === 'boolean') setAutoStart(cfg.autoStart)
      if (typeof cfg.maxVramPct === 'number') setMaxVram(String(cfg.maxVramPct))
      if (typeof cfg.tier === 'string') setTier(cfg.tier)
      if (cfg.computeDevice === 'auto' || cfg.computeDevice === 'cpu' || cfg.computeDevice === 'gpu') {
        setComputeDevice(cfg.computeDevice)
      }
      if (typeof cfg.gpuIndex === 'number') setGpuIndex(cfg.gpuIndex)
    }).catch(() => {})
    gl?.daemon.status().then((s) => {
      if (s.gpus?.length) {
        setDetectedGpus(s.gpus.map(g => ({ index: g.index ?? 0, name: g.name, vendor: g.vendor })))
      }
      if (s.cpu?.name) setCpuName(s.cpu.name)
      setTeeHardwareDetected(Boolean(s.tee_hardware_detected))
      setTeeCapable(Boolean(s.tee_capable))
      setRouterTeeCapable(s.router_tee_capable ?? null)
      setTeeWarning(s.tee_warning ?? null)
      setTeeForceOverride(Boolean(s.tee_force_override))
    }).catch(() => {})

    const poll = setInterval(() => {
      gl?.daemon.status().then((s) => {
        setTeeHardwareDetected(Boolean(s.tee_hardware_detected))
        setTeeCapable(Boolean(s.tee_capable))
        setRouterTeeCapable(s.router_tee_capable ?? null)
        setTeeWarning(s.tee_warning ?? null)
        setTeeForceOverride(Boolean(s.tee_force_override))
      }).catch(() => {})
    }, 3000)
    return () => clearInterval(poll)
  }, [])

  const save = async () => {
    const gl = (window as unknown as { gridlock?: { settings: { save: (cfg: unknown) => Promise<{ ok: boolean }> } } }).gridlock
    const cfg = { wallet, earningsWallet, teeMode, autoStart, maxVramPct: Number(maxVram), tier, computeDevice, gpuIndex, theme: currentTheme() }
    try { await gl?.settings.save(cfg) } catch {}
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      <div className="page-title">Settings</div>

      {/* Wallet */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-label">WALLET</div>
        <Field label="EVM Wallet Address" sub="Operator wallet (0x…) used to register with the router. No private key required.">
          <input value={wallet} onChange={e => setWallet(e.target.value)} placeholder="0x operator wallet…" className="mono" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Earnings Wallet" sub="Where ETH payouts are sent. Leave empty to use the operator wallet. Withdraw from the web dashboard (Worker tab).">
          <input value={earningsWallet} onChange={e => setEarningsWallet(e.target.value)} placeholder="0x payout wallet (optional)…" className="mono" style={{ fontSize: 12 }} />
        </Field>
      </div>

      {/* Worker */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-label">WORKER</div>

        <Field label="Compute Device" sub="Choose whether Ollama runs on CPU or GPU. Auto uses a GPU when NVIDIA/AMD is detected, otherwise CPU.">
          <div style={{ display: 'flex', gap: 6, marginBottom: detectedGpus.length > 1 && computeDevice !== 'cpu' ? 10 : 0 }}>
            {(['auto', 'cpu', 'gpu'] as ComputeDevice[]).map(d => (
              <button key={d} onClick={() => setComputeDevice(d)} style={{
                padding: '6px 14px', borderRadius: 5, fontSize: 12, fontWeight: 700,
                border: `1px solid ${computeDevice === d ? 'var(--accent)' : 'var(--border-2)'}`,
                background: computeDevice === d ? 'var(--accent)' : 'var(--accent-dim)',
                color: computeDevice === d ? 'var(--on-accent)' : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all 0.12s', textTransform: 'uppercase',
              }}>{d}</button>
            ))}
          </div>
          {cpuName && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>
              CPU: {cpuName}
            </div>
          )}
          {detectedGpus.length === 0 && computeDevice === 'gpu' && (
            <div style={{ fontSize: 11, color: 'var(--accent-text)', fontWeight: 600, lineHeight: 1.5 }}>
              No GPU detected yet. Install NVIDIA or AMD drivers, or switch to CPU / Auto.
            </div>
          )}
          {detectedGpus.length > 0 && computeDevice !== 'cpu' && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>
              {detectedGpus.map(g => (
                <div key={g.index}>{g.vendor?.toUpperCase() ?? 'GPU'} · {g.name}</div>
              ))}
            </div>
          )}
          {detectedGpus.length > 1 && computeDevice !== 'cpu' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {detectedGpus.map(g => (
                <button key={g.index} onClick={() => setGpuIndex(g.index)} style={{
                  padding: '5px 10px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                  border: `1px solid ${gpuIndex === g.index ? 'var(--accent)' : 'var(--border-2)'}`,
                  background: gpuIndex === g.index ? 'var(--accent)' : 'var(--accent-dim)',
                  color: gpuIndex === g.index ? 'var(--on-accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}>GPU {g.index}</button>
              ))}
            </div>
          )}
        </Field>

        <Field label="Job Tier" sub="Minimum job tier to accept. Higher tiers pay more but require faster hardware.">
          <div style={{ display: 'flex', gap: 6 }}>
            {['Nano', 'Micro', 'Batch', 'Realtime'].map(t => (
              <button key={t} onClick={() => setTier(t)} style={{
                padding: '6px 14px', borderRadius: 5, fontSize: 12, fontWeight: 700,
                border: `1px solid ${tier === t ? 'var(--accent)' : 'var(--border-2)'}`,
                background: tier === t ? 'var(--accent)' : 'var(--accent-dim)',
                color: tier === t ? 'var(--on-accent)' : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all 0.12s',
              }}>{t}</button>
            ))}
          </div>
        </Field>

        <Field label="Max VRAM Usage" sub="Percentage of GPU VRAM the worker can use.">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="range" min={50} max={98} value={maxVram}
              onChange={e => setMaxVram(e.target.value)}
              style={{ flex: 1, accentColor: 'var(--accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 700, minWidth: 36, textAlign: 'right' }}>{maxVram}%</span>
          </div>
        </Field>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: teeMode ? 10 : 18 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 12 }}>TEE / Confidential Mode</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.45 }}>
              Register for confidential privacy jobs. Requires an NVIDIA CC GPU (H100, H200, B200, GB200, L40S, RTX 6000 Ada).
            </div>
          </div>
          <Toggle on={teeMode} onToggle={() => setTeeMode(v => !v)} />
        </div>

        {teeMode && (
          <div style={{ marginBottom: 18, padding: '10px 12px', borderRadius: 6, background: teeCapable ? 'var(--accent-dim)' : 'var(--error-dim)', border: `1px solid ${teeCapable ? 'var(--accent-border)' : 'var(--error-border)'}`, fontSize: 11, lineHeight: 1.55 }}>
            <div style={{ fontWeight: 700, color: teeCapable ? 'var(--accent-text)' : 'var(--error)', marginBottom: 4 }}>
              {teeCapable
                ? routerTeeCapable
                  ? 'TEE active on Gridlock'
                  : 'TEE ready — save to sync with Gridlock'
                : 'No CC-capable GPU detected'}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
              {teeCapable
                ? teeHardwareDetected
                  ? `Detected: ${detectedGpus.find(g => g.index === gpuIndex)?.name ?? 'CC GPU'}`
                  : teeForceOverride
                    ? 'Dev override enabled (mock attestation only — not real TEE hardware).'
                    : 'Checking TEE hardware…'
                : detectedGpus.length > 0
                  ? `Detected GPU: ${detectedGpus.find(g => g.index === gpuIndex)?.name ?? detectedGpus[0]?.name} — not CC-capable.`
                  : 'Your GPU cannot run confidential jobs. Toggle can stay on, but the router will not route privacy work here.'}
            </div>
            {teeWarning && (
              <div style={{ marginTop: 6, color: 'var(--text-secondary)', fontWeight: 600 }}>{teeWarning}</div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 12 }}>Start on Login</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginTop: 2 }}>Launch Gridlock Worker automatically when you log in.</div>
          </div>
          <Toggle on={autoStart} onToggle={() => setAutoStart(v => !v)} />
        </div>
      </div>

      {/* About */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="section-label" style={{ marginBottom: 12 }}>ABOUT</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          {[
            ['Version', '0.1.6'],
            ['Network', 'Robinhood Chain (EVM)'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={save} style={{
        width: '100%', padding: '11px 0', borderRadius: 6, fontWeight: 600, fontSize: 13,
        background: saved ? 'var(--accent-dim)' : 'var(--accent)',
        color: saved ? 'var(--accent-text)' : 'var(--on-accent)',
        border: saved ? '1px solid var(--accent-border)' : '1px solid var(--accent)',
        cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.5px',
      }}>
        {saved ? 'SAVED ✓' : 'SAVE SETTINGS'}
      </button>
    </motion.div>
  )
}
