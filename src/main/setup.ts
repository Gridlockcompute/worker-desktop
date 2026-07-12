import { app, ipcMain, shell, type BrowserWindow } from 'electron'
import { spawn, spawnSync } from 'child_process'
import { createWriteStream, existsSync } from 'fs'
import { mkdir, rm, unlink } from 'fs/promises'
import { dirname, join } from 'path'
import { homedir, tmpdir } from 'os'
import { get } from 'https'
import { PACKAGED_OLLAMA_MODEL } from './python.js'

const OLLAMA_WINDOWS_INSTALLER_URL = 'https://ollama.com/download/OllamaSetup.exe'
const OLLAMA_MAC_DMG_URL = 'https://ollama.com/download/Ollama.dmg'
const OLLAMA_API = 'http://127.0.0.1:11434'
const MAC_OLLAMA_APP = '/Applications/Ollama.app'

export type SetupStatus = {
  pythonReady: boolean
  ollamaInstalled: boolean
  ollamaRunning: boolean
  modelReady: boolean
  modelName: string
  ready: boolean
}

function whichOnPath(command: string): string | null {
  const lookup = process.platform === 'win32' ? 'where' : 'which'
  const result = spawnSync(lookup, [command], { encoding: 'utf8' })
  const line = result.stdout?.split(/\r?\n/).map((s) => s.trim()).find(Boolean)
  if (!line) return null
  if (process.platform === 'win32') return existsSync(line) ? line : null
  return existsSync(line) ? line : null
}

function ollamaExeCandidates(): string[] {
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA ?? ''
    const pf = process.env.ProgramFiles ?? 'C:\\Program Files'
    return [
      join(local, 'Programs', 'Ollama', 'ollama.exe'),
      join(pf, 'Ollama', 'ollama.exe'),
    ]
  }

  if (process.platform === 'darwin') {
    return [
      '/usr/local/bin/ollama',
      '/opt/homebrew/bin/ollama',
      join(MAC_OLLAMA_APP, 'Contents', 'Resources', 'ollama'),
      join(homedir(), 'Applications', 'Ollama.app', 'Contents', 'Resources', 'ollama'),
    ]
  }

  return [
    '/usr/local/bin/ollama',
    '/usr/bin/ollama',
    join(homedir(), '.local', 'bin', 'ollama'),
    '/snap/bin/ollama',
  ]
}

export function findOllamaExecutable(): string | null {
  for (const candidate of ollamaExeCandidates()) {
    if (existsSync(candidate)) return candidate
  }
  return whichOnPath(process.platform === 'win32' ? 'ollama.exe' : 'ollama')
}

function isOllamaInstalled(): boolean {
  if (findOllamaExecutable()) return true
  if (process.platform === 'darwin') {
    return existsSync(MAC_OLLAMA_APP) || existsSync(join(homedir(), 'Applications', 'Ollama.app'))
  }
  return false
}

async function ollamaApiOk(timeoutMs = 4000): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_API}/api/tags`, {
      signal: AbortSignal.timeout(timeoutMs),
    })
    return res.ok
  } catch {
    return false
  }
}

async function modelIsPulled(modelName: string): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_API}/api/tags`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return false
    const data = (await res.json()) as { models?: { name?: string }[] }
    const want = modelName.split(':')[0]
    return (data.models ?? []).some((m) => {
      const n = (m.name ?? '').split(':')[0]
      return n === want || (m.name ?? '').startsWith(modelName)
    })
  } catch {
    return false
  }
}

export async function checkSetup(): Promise<SetupStatus> {
  const modelName = PACKAGED_OLLAMA_MODEL
  const ollamaInstalled = isOllamaInstalled()
  const ollamaRunning = await ollamaApiOk()
  const modelReady = ollamaRunning && await modelIsPulled(modelName)
  const pythonReady = !app.isPackaged || process.platform !== 'win32' || existsSync(
    join(process.resourcesPath, 'python-runtime', 'python.exe'),
  )

  return {
    pythonReady,
    ollamaInstalled,
    ollamaRunning,
    modelReady,
    modelName,
    ready: pythonReady && ollamaRunning && modelReady,
  }
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const fetchUrl = (u: string) => {
      get(u, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          fetchUrl(res.headers.location)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`))
          return
        }
        const file = createWriteStream(dest)
        res.pipe(file)
        file.on('finish', () => file.close(() => resolve()))
        file.on('error', reject)
      }).on('error', reject)
    }
    fetchUrl(url)
  })
}

function execCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} failed (exit ${code ?? 'unknown'})`))
    })
  })
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

async function waitForOllama(maxMs = 120_000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    if (await ollamaApiOk(3000)) return true
    await new Promise((r) => setTimeout(r, 2000))
  }
  return false
}

export function launchOllamaApp(): Promise<boolean> {
  return new Promise((resolve) => {
    if (process.platform === 'darwin') {
      const appPath = existsSync(MAC_OLLAMA_APP)
        ? MAC_OLLAMA_APP
        : join(homedir(), 'Applications', 'Ollama.app')
      if (!existsSync(appPath)) {
        resolve(false)
        return
      }
      const child = spawn('open', ['-a', appPath], { detached: true, stdio: 'ignore' })
      child.on('error', () => resolve(false))
      child.on('exit', (code) => resolve(code === 0))
      return
    }

    if (process.platform === 'linux') {
      const exe = findOllamaExecutable()
      if (!exe) {
        resolve(false)
        return
      }
      const child = spawn(exe, ['serve'], { detached: true, stdio: 'ignore' })
      child.on('error', () => resolve(false))
      child.unref()
      resolve(true)
      return
    }

    const cli = findOllamaExecutable()
    if (!cli) {
      resolve(false)
      return
    }
    const gui = join(dirname(cli), 'Ollama.exe')
    const target = existsSync(gui) ? gui : cli
    const child = spawn(target, [], { detached: true, stdio: 'ignore' })
    child.on('error', () => resolve(false))
    child.unref()
    resolve(true)
  })
}

function launchHint(): string {
  if (process.platform === 'darwin') return 'Open Ollama from Applications, then click Retry.'
  if (process.platform === 'linux') return 'Start Ollama, then click Retry.'
  return 'Open Ollama from the Start menu, then click Retry.'
}

export async function ensureOllamaRunning(): Promise<{ ok: boolean; message?: string }> {
  if (await ollamaApiOk(2000)) return { ok: true }

  if (isOllamaInstalled()) {
    await launchOllamaApp()
    const up = await waitForOllama(60_000)
    if (up) return { ok: true }
    return { ok: false, message: launchHint() }
  }

  return installOllamaFresh()
}

async function installOllamaWindows(): Promise<{ ok: boolean; message?: string }> {
  const dir = join(tmpdir(), 'gridlock-worker')
  await mkdir(dir, { recursive: true })
  const installer = join(dir, 'OllamaSetup.exe')

  try {
    await downloadFile(OLLAMA_WINDOWS_INSTALLER_URL, installer)
  } catch (e) {
    await shell.openExternal('https://ollama.com/download')
    return { ok: false, message: `Could not download Ollama. Install manually: ${String(e)}` }
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(installer, ['/VERYSILENT', '/NORESTART'], {
        detached: true,
        stdio: 'ignore',
      })
      child.on('error', reject)
      child.on('exit', (code) => {
        if (code === 0 || code === null) resolve()
        else reject(new Error(`Ollama installer exited with code ${code}`))
      })
    })
  } catch (e) {
    return { ok: false, message: `Ollama install failed: ${String(e)}` }
  } finally {
    try { await unlink(installer) } catch { /* ignore */ }
  }

  const up = await waitForOllama(180_000)
  if (!up) {
    return { ok: false, message: `Ollama installed but not responding. ${launchHint()}` }
  }
  return { ok: true }
}

async function installOllamaDarwin(): Promise<{ ok: boolean; message?: string }> {
  const dir = join(tmpdir(), 'gridlock-worker')
  const dmgPath = join(dir, 'Ollama.dmg')
  const mountDir = join(dir, 'ollama-mount')

  try {
    await mkdir(dir, { recursive: true })
    await downloadFile(OLLAMA_MAC_DMG_URL, dmgPath)
    await mkdir(mountDir, { recursive: true })
    await execCommand('hdiutil', ['attach', dmgPath, '-mountpoint', mountDir, '-nobrowse', '-quiet'])

    const appSrc = join(mountDir, 'Ollama.app')
    if (!existsSync(appSrc)) {
      throw new Error('Ollama.app not found in downloaded disk image')
    }

    const installScript = `rm -rf ${shellQuote(MAC_OLLAMA_APP)} && cp -R ${shellQuote(appSrc)} ${shellQuote(MAC_OLLAMA_APP)}`
    await execCommand('osascript', [
      '-e',
      `do shell script "${installScript.replace(/"/g, '\\"')}" with administrator privileges`,
    ])
    await execCommand('hdiutil', ['detach', mountDir, '-quiet'])
  } catch (e) {
    try { await rm(mountDir, { recursive: true, force: true }) } catch { /* ignore */ }
    try { await unlink(dmgPath) } catch { /* ignore */ }
    await shell.openExternal('https://ollama.com/download')
    return {
      ok: false,
      message: `Could not install Ollama automatically (${String(e)}). Use the download page, then retry.`,
    }
  } finally {
    try { await unlink(dmgPath) } catch { /* ignore */ }
    try { await rm(mountDir, { recursive: true, force: true }) } catch { /* ignore */ }
  }

  await launchOllamaApp()
  const up = await waitForOllama(180_000)
  if (!up) {
    return { ok: false, message: `Ollama installed but not responding. ${launchHint()}` }
  }
  return { ok: true }
}

async function installOllamaLinux(): Promise<{ ok: boolean; message?: string }> {
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('sh', ['-c', 'curl -fsSL https://ollama.com/install.sh | sh'], {
        stdio: 'ignore',
        env: process.env,
      })
      child.on('error', reject)
      child.on('exit', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`Ollama install script exited with code ${code}`))
      })
    })
  } catch (e) {
    await shell.openExternal('https://ollama.com/download')
    return { ok: false, message: `Could not install Ollama automatically: ${String(e)}` }
  }

  await launchOllamaApp()
  const up = await waitForOllama(180_000)
  if (!up) {
    return { ok: false, message: `Ollama installed but not responding. ${launchHint()}` }
  }
  return { ok: true }
}

async function installOllamaFresh(): Promise<{ ok: boolean; message?: string }> {
  if (process.platform === 'win32') return installOllamaWindows()
  if (process.platform === 'darwin') return installOllamaDarwin()
  if (process.platform === 'linux') return installOllamaLinux()

  await shell.openExternal('https://ollama.com/download')
  return { ok: false, message: 'Install Ollama from the browser, then return here.' }
}

export function pullOllamaModel(
  modelName: string,
  onLine: (line: string) => void,
): Promise<{ ok: boolean; message?: string }> {
  return new Promise((resolve) => {
    const exe = findOllamaExecutable()
    if (!exe) {
      resolve({ ok: false, message: 'Ollama CLI not found. Install Ollama first.' })
      return
    }

    const child = spawn(exe, ['pull', modelName], { stdio: ['ignore', 'pipe', 'pipe'] })

    const handle = (buf: Buffer) => {
      for (const line of buf.toString().split(/\r?\n/)) {
        const t = line.trim()
        if (t) onLine(t)
      }
    }

    child.stdout?.on('data', handle)
    child.stderr?.on('data', handle)
    child.on('error', (err) => resolve({ ok: false, message: err.message }))
    child.on('exit', (code) => {
      if (code === 0) resolve({ ok: true })
      else resolve({ ok: false, message: `Model download failed (exit ${code})` })
    })
  })
}

export function registerSetupHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('setup:check', () => checkSetup())

  ipcMain.handle('setup:installOllama', async () => ensureOllamaRunning())

  ipcMain.handle('setup:pullModel', async () => {
    const model = PACKAGED_OLLAMA_MODEL
    const win = getWindow()
    return pullOllamaModel(model, (line) => {
      win?.webContents.send('setup:progress', { phase: 'pull', line, model })
    })
  })

  ipcMain.handle('setup:openOllamaDownload', async () => {
    await shell.openExternal('https://ollama.com/download')
    return { ok: true }
  })
}
