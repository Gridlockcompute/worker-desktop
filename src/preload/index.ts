import { contextBridge, ipcRenderer } from 'electron'

export type DaemonEvent = { event: string; [k: string]: unknown }
export type ComputeDevice = 'auto' | 'cpu' | 'gpu'
export type AppTheme = 'dark' | 'light'

export type WorkerSettings = {
  wallet: string
  earningsWallet: string
  teeMode: boolean
  autoStart: boolean
  maxVramPct: number
  tier: string
  computeDevice: ComputeDevice
  gpuIndex: number
  theme: AppTheme
}

export type WorkerEarningsView = {
  today: number
  week: number
  total: number
  penalties_paid: number
  earnings_wallet: string | null
  sla_pass_rate: number | null
  jobs_today: number
  history: { day: string; earn: number; jobs: number }[]
  source: 'router' | 'local'
}

export type GPUInfo = {
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

export type CPUInfo = {
  name: string
  cores: number
  threads: number
  detected?: boolean
}

const api = {
  daemon: {
    status: (): Promise<{
      running: boolean
      backend_ok?: boolean
      last_backend_error?: string | null
      wallet_connected?: boolean
      inference_ready?: boolean
      inference_error?: string | null
      inference_backend?: string | null
      worker_address?: string
      tee_mode_requested?: boolean
      tee_hardware_detected?: boolean
      tee_gpu_name?: string | null
      tee_capable?: boolean
      router_tee_capable?: boolean | null
      tee_warning?: string | null
      tee_force_override?: boolean
      compute_mode?: ComputeDevice
      effective_compute?: ComputeDevice | 'gpu' | 'cpu'
      gpu_index?: number
      cpu?: CPUInfo | null
      gpus?: GPUInfo[]
      gpu_detected?: boolean
      gpu: GPUInfo | null
      active_job: unknown
      tokens_per_sec: number
      jobs_today: number
      earnings_today: number
    }> =>
      ipcRenderer.invoke('daemon:status'),
    onEvent: (cb: (e: DaemonEvent) => void) => {
      ipcRenderer.on('daemon:event', (_e, data) => cb(data as DaemonEvent))
      return () => ipcRenderer.removeAllListeners('daemon:event')
    }
  },
  worker: {
    start:    (): Promise<{ ok: boolean; error?: string; message?: string; inference_backend?: string }> =>
      ipcRenderer.invoke('worker:start'),
    stop:     (): Promise<{ ok: boolean }> => ipcRenderer.invoke('worker:stop'),
    jobs:     (): Promise<{ jobs: unknown[] }> => ipcRenderer.invoke('worker:jobs'),
    earnings: (): Promise<WorkerEarningsView> =>
      ipcRenderer.invoke('worker:earnings')
  },
  settings: {
    load: (): Promise<WorkerSettings> => ipcRenderer.invoke('settings:load'),
    save: (cfg: WorkerSettings): Promise<{ ok: boolean; teeRestarted?: boolean }> => ipcRenderer.invoke('settings:save', cfg)
  },
  setup: {
    check: () => ipcRenderer.invoke('setup:check'),
    installOllama: () => ipcRenderer.invoke('setup:installOllama'),
    pullModel: () => ipcRenderer.invoke('setup:pullModel'),
    openOllamaDownload: () => ipcRenderer.invoke('setup:openOllamaDownload'),
    onProgress: (cb: (data: { phase: string; line: string; model?: string }) => void) => {
      const handler = (_e: unknown, data: { phase: string; line: string; model?: string }) => cb(data)
      ipcRenderer.on('setup:progress', handler)
      return () => ipcRenderer.removeListener('setup:progress', handler)
    },
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close:    () => ipcRenderer.invoke('window:close'),
    quit:     () => ipcRenderer.invoke('window:quit'),
    onClosePrompt: (cb: () => void) => {
      const handler = () => cb()
      ipcRenderer.on('window:close-prompt', handler)
      return () => ipcRenderer.removeListener('window:close-prompt', handler)
    },
  },
  app: {
    openStakePage: (): Promise<void> => ipcRenderer.invoke('app:openStakePage'),
    openDashboard: (): Promise<void> => ipcRenderer.invoke('app:openDashboard'),
  }
}

contextBridge.exposeInMainWorld('gridlock', api)
