# worker-desktop

Cross-platform desktop app for contributing GPU or CPU compute to the [Gridlock](https://grid-lock.tech) inference network. Built with **Electron** and a bundled **Python** worker daemon that connects to the [router](https://github.com/Gridlockcompute/router) and runs local inference via **Ollama**.

**Production router:** [https://api.grid-lock.tech](https://api.grid-lock.tech)

## What it is

Gridlock Worker is the operator-facing desktop client for the Gridlock network. It wraps a Python daemon (`python/daemon.py`) in a modern Electron UI with:

- Dashboard — connection status, GPU/CPU info, throughput
- Setup wizard — install Ollama and download a model (one-click on Windows)
- Jobs and earnings views tied to your wallet
- System tray — run in the background while serving jobs

The app uses your **Solana public address** only (never your private key). Stake GRID and withdraw earned SOL on the web at [https://grid-lock.tech/worker](https://grid-lock.tech/worker) and [https://grid-lock.tech/stake](https://grid-lock.tech/stake).

## Features

- **Download-and-go Windows installer** — bundled Python 3.12 runtime and dependencies in the NSIS setup
- **In-app Setup panel** — guided Ollama install and model download (`llama3.2:3b` in packaged builds)
- **Multi-platform releases** — Windows (`.exe`), macOS (`.dmg`), Linux (`.AppImage`) via GitHub Actions
- **Hardware auto-detection** — NVIDIA, AMD, and CPU-only modes via Ollama
- **Local daemon API** — Electron UI talks to Python on `127.0.0.1:7420`
- **WebSocket + REST** — same router protocol as [worker-cli](https://github.com/Gridlockcompute/worker-cli)
- **Configurable compute** — Auto, CPU, or GPU; VRAM limit and SLA tier in Settings

## Prerequisites

### End users (packaged app)

- Windows 10+, macOS 12+, or a recent Linux distro
- NVIDIA or AMD GPU with drivers (optional — CPU mode supported)
- Internet connection
- A Solana wallet **public address**

Download the latest release from [GitHub Releases](https://github.com/Gridlockcompute/worker-desktop/releases) (tags: `worker-v*`).

### Developers

- **Node.js** 20+
- **Python** 3.10+ (system Python for `npm run dev`)
- **Ollama** ([download](https://ollama.com/download))
- **Pillow** (for icon generation): `pip install pillow`

## Installation

### From release (recommended)

1. Download `Gridlock-Worker-Setup-x.y.z.exe` (Windows), `.dmg` (macOS), or `.AppImage` (Linux) from [Releases](https://github.com/Gridlockcompute/worker-desktop/releases)
2. Install and open **Gridlock Worker**
3. Complete **Setup** — Install Ollama → Download model
4. Enter your wallet public address in Settings
5. Click **Start Worker**

### From source

```bash
git clone https://github.com/Gridlockcompute/worker-desktop.git
cd worker-desktop
npm install
npm run dev
```

Dev mode uses system Python and local Ollama; the Setup panel appears if Ollama or the model is missing.

## Configuration

Production router URL is fixed to `https://api.grid-lock.tech`. Override for local development only:

| Variable | Default | Description |
|----------|---------|-------------|
| `GRIDLOCK_BACKEND_URL` | `https://api.grid-lock.tech` | Router API (dev override) |
| `GRIDLOCK_STAKE_URL` | `https://grid-lock.tech/stake` | Staking web UI |
| `GRIDLOCK_WALLET` | — | Solana public address |
| `GRIDLOCK_COMPUTE_DEVICE` | `auto` | `auto`, `cpu`, or `gpu` |
| `GRIDLOCK_GPU_INDEX` | `0` | GPU index when multiple devices |
| `GRIDLOCK_OLLAMA_MODEL` | `llama3.1:8b` (dev) / `llama3.2:3b` (packaged) | Ollama model |
| `GRIDLOCK_ROLE` | `Prefill` | Worker role at registration |
| `GRIDLOCK_TEE` | `false` | Register as TEE-capable |

Settings are persisted in the Electron user data directory (`settings.json`).

## Usage

**Typical operator flow:**

1. Install from GitHub Releases
2. Open the app → complete Setup (Ollama + model)
3. Settings → enter Solana public address, choose compute device and SLA tier
4. **Start Worker** — daemon registers, heartbeats, and accepts WebSocket jobs
5. Monitor jobs and earnings in-app; view network status at [https://grid-lock.tech/worker](https://grid-lock.tech/worker)

**Packaged app contents:**

| Component | Bundled? |
|-----------|----------|
| Electron UI + Python daemon | Yes |
| Python 3.12 + `websocket-client` | Yes (Windows installer) |
| Ollama | No — installed via in-app Setup |
| AI model | No — downloaded via in-app Setup (~2 GB) |

## Development

```bash
npm run dev              # Electron + Vite hot reload
npm run build            # Compile main/preload/renderer
npm run bundle-python    # Embed Python runtime (Windows packaging)
npm run generate-icons   # Regenerate build/icon.ico from chevron mark
npm run package          # Full installer (platform-specific)
```

### Build installers locally

On Windows (or CI `windows-latest`):

```powershell
npm install
npm run package
# → release/Gridlock-Worker-Setup-0.1.3.exe
```

See [RELEASE.md](./RELEASE.md) for release tagging, code signing, and CI details.

### Release workflow

Push a tag to trigger multi-platform builds:

```bash
git tag worker-v0.1.3
git push origin worker-v0.1.3
```

Workflow: `.github/workflows/release-worker.yml` — builds Windows, macOS, and Linux artifacts and publishes a GitHub Release.

Keep `package.json` `"version"` in sync with release tags.

## Project layout

```
worker-desktop/
├── src/
│   ├── main/           # Electron main process, daemon spawn, setup IPC
│   ├── preload/        # Context bridge
│   └── renderer/       # React UI (Dashboard, Jobs, Earnings, Settings)
├── python/
│   ├── daemon.py       # Worker daemon — router WS, Ollama inference
│   ├── inference.py
│   └── hardware_detect.py
├── scripts/
│   ├── bundle-python.cjs
│   └── generate-icons.py
├── build/              # App icons
├── RELEASE.md          # Packaging and signing guide
└── package.json
```

## Related repos

| Repo | Role |
|------|------|
| [router](https://github.com/Gridlockcompute/router) | Hono API — job routing, WebSocket hub |
| [worker-cli](https://github.com/Gridlockcompute/worker-cli) | Headless CLI worker (Ollama/vLLM) |
| [programs](https://github.com/Gridlockcompute/programs) | Solana on-chain programs |

**Website:** [https://grid-lock.tech](https://grid-lock.tech) · **Docs:** [https://grid-lock.tech/docs](https://grid-lock.tech/docs)

## License

MIT
