# Gridlock Worker v0.1.5

Download **one** installer below for your operating system.

## Which file do I need?

| OS | Download this file | Notes |
|----|-------------------|--------|
| **Windows 10/11** | `Gridlock-Worker-Setup-0.1.5.exe` | 64-bit installer (NSIS) |
| **macOS** | `Gridlock-Worker-0.1.5.dmg` | Universal build — **Intel and Apple Silicon** |
| **Linux** | `Gridlock-Worker-0.1.5.AppImage` | 64-bit; may need `libfuse2` on some distros |

`latest.yml` is for the Windows auto-updater only — end users can ignore it.

## First launch

1. Open **Gridlock Worker**
2. Complete **Setup** in the app (installs Ollama + downloads the default model)
3. Enter your operator wallet in **Settings**
4. Click **Start Worker** on the Dashboard

## Highlights in v0.1.5

- **macOS / Linux:** one-click Ollama install when missing (fixes `spawn ollama ENOENT`)
- **macOS:** universal DMG (Intel + Apple Silicon)
- **Windows:** silent Ollama install (unchanged)
- Theme refresh, TEE handling, earnings wallet, live job timers (from v0.1.4)

## Requirements

- Internet for setup (Ollama + ~2 GB model download)
- NVIDIA or AMD GPU optional — CPU mode supported
- Robinhood Chain operator wallet (`0x…`)
