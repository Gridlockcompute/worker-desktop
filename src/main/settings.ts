import { app } from 'electron'
import fs from 'fs'
import path from 'path'

/** Production Gridlock router — set GRIDLOCK_BACKEND_URL for local router dev (e.g. http://127.0.0.1:8080). */
export const GRIDLOCK_API_URL = (
  process.env.GRIDLOCK_BACKEND_URL?.trim()
  || 'https://api.grid-lock.tech'
).replace(/\/$/, '')

/** Web app stake page — stake/unstake UI lives here, not in the worker. */
export const GRIDLOCK_STAKE_URL = (
  process.env.GRIDLOCK_STAKE_URL ?? 'https://grid-lock.tech/stake'
).replace(/\/$/, '')

/** Web dashboard — withdraw earnings and manage payout wallet (SIWE). */
export const GRIDLOCK_DASHBOARD_URL = (
  process.env.GRIDLOCK_DASHBOARD_URL ?? 'https://grid-lock.tech/dashboard'
).replace(/\/$/, '')

export type ComputeDevice = 'auto' | 'cpu' | 'gpu'
export type AppTheme = 'dark' | 'light'

export interface WorkerSettings {
  wallet: string
  /** Optional payout wallet; defaults to operator wallet at registration. */
  earningsWallet: string
  teeMode: boolean
  autoStart: boolean
  maxVramPct: number
  tier: string
  computeDevice: ComputeDevice
  gpuIndex: number
  theme: AppTheme
}

const DEFAULTS: WorkerSettings = {
  wallet: '',
  earningsWallet: '',
  teeMode: false,
  autoStart: false,
  maxVramPct: 90,
  tier: 'Batch',
  computeDevice: 'auto',
  gpuIndex: 0,
  theme: 'dark',
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): WorkerSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<WorkerSettings & { backendUrl?: string; rpcUrl?: string }>
    delete parsed.backendUrl
    delete parsed.rpcUrl
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(settings: WorkerSettings): void {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true })
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2))
}
