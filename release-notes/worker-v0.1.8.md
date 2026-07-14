# Gridlock Worker v0.1.8

Download **one** installer below for your operating system.

## Which file do I need?

| OS | Download this file | Notes |
|----|-------------------|--------|
| **Windows 10/11** | `Gridlock-Worker-Setup-0.1.8.exe` | 64-bit installer (NSIS) |
| **macOS** | `Gridlock-Worker-0.1.8.dmg` | Universal build — **Intel and Apple Silicon** |
| **Linux** | `Gridlock-Worker-0.1.8.AppImage` | 64-bit; may need `libfuse2` on some distros |

`latest.yml` is for the Windows auto-updater only — end users can ignore it.

## First launch

1. Open **Gridlock Worker**
2. Complete **Setup** in the app (installs Ollama + downloads the default model)
3. Enter your operator wallet in **Settings**
4. Click **Start Worker** on the Dashboard

## Highlights in v0.1.8

- **Faster job responses:** Ollama now keeps the model loaded for 30 minutes between jobs (`keep_alive`), so time-to-first-token no longer includes a full cold model load on every dispatch
- Improves SLA pass rate on standard-tier jobs for desktop workers

## Previous (v0.1.7)

- macOS / CPU-only machines: Auto and CPU compute modes apply immediately with correct CPU COMPUTE panel
- Compute device changes auto-save and restart the daemon

## Requirements

- Internet for setup (Ollama + ~2 GB model download)
- NVIDIA or AMD GPU optional — CPU mode supported
- Robinhood Chain operator wallet (`0x…`)
