import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, type NativeImage } from 'electron'
import { join } from 'path'
import { spawn, ChildProcess } from 'child_process'
import { loadSettings, saveSettings, GRIDLOCK_API_URL, GRIDLOCK_STAKE_URL, GRIDLOCK_DASHBOARD_URL, type WorkerSettings } from './settings.js'
import { getDaemonScriptPath, getPythonExecutable, getPythonModuleDir, packagedDaemonEnv } from './python.js'
import { registerSetupHandlers } from './setup.js'
import { fetchWalletJobs, mergeWalletJobs, type WorkerJob } from './wallet-jobs.js'
import { fetchWorkerEarningsFromRouter, type WorkerEarningsView } from './worker-earnings.js'
import { isValidEvmWallet, normalizeEvmWallet } from '@shared/evm-wallet'

const isDev = !app.isPackaged
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let daemon: ChildProcess | null = null
let quitting = false
const DAEMON_PORT = 7420

function iconPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'icon.png')
  }
  return join(__dirname, '../../build/icon.png')
}

function loadAppIcon(size?: number): NativeImage {
  const image = nativeImage.createFromPath(iconPath())
  if (size && !image.isEmpty()) {
    return image.resize({ width: size, height: size })
  }
  return image
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1060,
    height: 720,
    minWidth: 880,
    minHeight: 580,
    backgroundColor: '#0a0a0a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    frame: false,
    icon: iconPath(),
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow!.show())
  mainWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      mainWindow?.webContents.send('window:close-prompt')
    }
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  const icon = loadAppIcon(process.platform === 'win32' ? 16 : 22)
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  const menu = Menu.buildFromTemplate([
    { label: 'Show Gridlock Worker', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit() } }
  ])
  tray.setToolTip('Gridlock Worker')
  tray.setContextMenu(menu)
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
}

function stopDaemon(): void {
  if (!daemon) return
  daemon.kill()
  daemon = null
}

function startDaemon(settings = loadSettings()): void {
  stopDaemon()

  const pythonScript = getDaemonScriptPath()
  const pythonBin = getPythonExecutable()
  const args = [
    pythonScript,
    '--port', String(DAEMON_PORT),
    '--backend', GRIDLOCK_API_URL,
  ]
  if (settings.wallet.trim()) {
    const wallet = normalizeWallet(settings.wallet.trim())
    if (wallet) args.push('--wallet', wallet)
  }
  const earningsWallet = normalizeWallet(settings.earningsWallet?.trim() ?? '')
  if (earningsWallet) {
    args.push('--earnings-wallet', earningsWallet)
  }
  if (settings.teeMode) {
    args.push('--tee')
  }
  args.push('--compute', settings.computeDevice)
  args.push('--gpu-index', String(settings.gpuIndex ?? 0))

  try {
    console.log(`[daemon] starting python backend=${GRIDLOCK_API_URL}`)
    daemon = spawn(pythonBin, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: getPythonModuleDir(),
      env: packagedDaemonEnv({
        GRIDLOCK_BACKEND_URL: GRIDLOCK_API_URL,
        GRIDLOCK_WALLET: settings.wallet,
        GRIDLOCK_EARNINGS_WALLET: settings.earningsWallet ?? '',
        GRIDLOCK_TEE: settings.teeMode ? 'true' : 'false',
        GRIDLOCK_COMPUTE_DEVICE: settings.computeDevice,
        GRIDLOCK_GPU_INDEX: String(settings.gpuIndex ?? 0),
      }),
    })

    daemon.stdout?.on('data', (buf: Buffer) => {
      for (const line of buf.toString().split('\n')) {
        const t = line.trim()
        if (!t) continue
        try {
          const msg = JSON.parse(t) as { event?: string; err?: string; msg?: string; address?: string }
          const ev = msg.event ?? ''
          if (ev.startsWith('ws_') || ev === 'register_failed' || ev === 'backend_error') {
            console.error('[daemon]', t)
          }
          mainWindow?.webContents.send('daemon:event', msg)
        } catch { /* not JSON */ }
      }
    })

    daemon.stderr?.on('data', (buf: Buffer) => {
      console.error('[daemon]', buf.toString().trim())
    })

    daemon.on('exit', (code) => {
      console.log('[daemon] exit', code)
      daemon = null
    })
  } catch (e) {
    console.error('[daemon] failed to start:', e)
  }
}

async function fetchDaemon(path: string, method = 'GET'): Promise<unknown> {
  const res = await fetch(`http://127.0.0.1:${DAEMON_PORT}${path}`, { method })
  return res.json()
}

function isValidWallet(wallet: string): boolean {
  return isValidEvmWallet(wallet)
}

function normalizeWallet(wallet: string): string | null {
  return normalizeEvmWallet(wallet)
}

// IPC
ipcMain.handle('daemon:status', () => fetchDaemon('/status').catch(() => ({ running: false, gpu: null })))
ipcMain.handle('worker:start', async () => {
  const settings = loadSettings()
  if (!isValidWallet(settings.wallet)) {
    return { ok: false, error: 'wallet_required', message: 'Connect your wallet before starting.' }
  }
  return fetchDaemon('/worker/start', 'POST').catch(() => ({ ok: false, error: 'daemon_unreachable' }))
})
ipcMain.handle('worker:stop',    () => fetchDaemon('/worker/stop', 'POST').catch(() => ({ ok: false })))
ipcMain.handle('worker:jobs', async () => {
  let localJobs: WorkerJob[] = []
  try {
    const daemon = (await fetchDaemon('/jobs')) as { jobs?: WorkerJob[] }
    localJobs = daemon.jobs ?? []
  } catch {
    /* daemon offline */
  }

  const wallet = loadSettings().wallet.trim()
  if (!isValidWallet(wallet)) {
    return { jobs: localJobs }
  }

  try {
    const remote = await fetchWalletJobs(wallet)
    return { jobs: mergeWalletJobs(remote, localJobs) }
  } catch {
    return { jobs: localJobs }
  }
})
ipcMain.handle('worker:earnings', async () => {
  const wallet = loadSettings().wallet.trim()
  if (isValidWallet(wallet)) {
    const remote = await fetchWorkerEarningsFromRouter(wallet)
    if (remote) return remote
  }
  const local = (await fetchDaemon('/earnings').catch(() => null)) as Partial<WorkerEarningsView> | null
  return {
    today: local?.today ?? 0,
    week: local?.week ?? 0,
    total: local?.total ?? 0,
    penalties_paid: local?.penalties_paid ?? 0,
    earnings_wallet: null,
    sla_pass_rate: null,
    jobs_today: 0,
    history: local?.history ?? [],
    source: 'local' as const,
  }
})
ipcMain.handle('settings:load', () => loadSettings())
async function syncWalletToDaemon(wallet: string, earningsWallet?: string): Promise<boolean> {
  const normalized = normalizeWallet(wallet)
  if (!normalized) return false
  const normalizedEarnings = earningsWallet?.trim() ? normalizeWallet(earningsWallet.trim()) : null
  try {
    const res = await fetch(`http://127.0.0.1:${DAEMON_PORT}/wallet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: normalized,
        ...(normalizedEarnings ? { earnings_wallet: normalizedEarnings } : {}),
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function syncConfigToDaemon(settings: WorkerSettings): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${DAEMON_PORT}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        compute_device: settings.computeDevice,
        gpu_index: settings.gpuIndex ?? 0,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

ipcMain.handle('settings:save', async (_e, cfg: WorkerSettings) => {
  const normalizedWallet = normalizeWallet(cfg.wallet)
  const normalizedEarnings = cfg.earningsWallet?.trim() ? normalizeWallet(cfg.earningsWallet.trim()) : null
  const next: WorkerSettings = {
    ...cfg,
    wallet: normalizedWallet ?? cfg.wallet,
    earningsWallet: normalizedEarnings ?? '',
  }
  saveSettings(next)
  const syncedWallet = normalizedWallet
    ? await syncWalletToDaemon(normalizedWallet, normalizedEarnings ?? undefined)
    : false
  const syncedConfig = await syncConfigToDaemon(next)
  if (!syncedWallet || !syncedConfig) startDaemon(next)
  return { ok: true }
})

ipcMain.handle('app:openStakePage', () => shell.openExternal(GRIDLOCK_STAKE_URL))
ipcMain.handle('app:openDashboard', () => shell.openExternal(GRIDLOCK_DASHBOARD_URL))

ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => mainWindow?.isMaximized() ? mainWindow.restore() : mainWindow?.maximize())
ipcMain.handle('window:close',    () => mainWindow?.hide())
ipcMain.handle('window:quit',     () => { quitting = true; app.quit() })

registerSetupHandlers(() => mainWindow)

app.whenReady().then(() => {
  createWindow()
  createTray()
  startDaemon()
})

app.on('window-all-closed', () => { /* do nothing */ })
app.on('before-quit', () => {
  quitting = true
  stopDaemon()
})
