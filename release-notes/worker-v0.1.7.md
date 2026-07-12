# Gridlock Worker v0.1.7

Download **one** installer below for your operating system.

## Which file do I need?

| OS | Download this file | Notes |
|----|-------------------|--------|
| **Windows 10/11** | `Gridlock-Worker-Setup-0.1.7.exe` | 64-bit installer (NSIS) |
| **macOS** | `Gridlock-Worker-0.1.7.dmg` | Universal build — **Intel and Apple Silicon** |
| **Linux** | `Gridlock-Worker-0.1.7.AppImage` | 64-bit; may need `libfuse2` on some distros |

`latest.yml` is for the Windows auto-updater only — end users can ignore it.

## First launch

1. Open **Gridlock Worker**
2. Complete **Setup** in the app (installs Ollama + downloads the default model)
3. Enter your operator wallet in **Settings**
4. Click **Start Worker** on the Dashboard

## Highlights in v0.1.7

- **macOS / CPU-only machines:** Auto and CPU compute modes now apply immediately and show the correct **CPU COMPUTE** panel (no more stuck on “No GPU detected”)
- Compute device changes auto-save and restart the worker daemon so Ollama uses CPU layers when no NVIDIA/AMD GPU is present
- Dashboard correctly resolves Auto → CPU when only Apple Silicon / integrated graphics is available

## Previous (v0.1.6)

- macOS: removed duplicate native traffic-light window buttons

## Requirements

- Internet for setup (Ollama + ~2 GB model download)
- NVIDIA or AMD GPU optional — CPU mode supported
- Robinhood Chain operator wallet (`0x…`)
