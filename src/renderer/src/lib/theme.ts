export type AppTheme = 'dark' | 'light'

export const THEME_BACKGROUND: Record<AppTheme, string> = {
  dark: '#080808',
  light: '#F4F4F5',
}

export function applyTheme(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme
}

export function normalizeTheme(value: unknown): AppTheme {
  return value === 'light' ? 'light' : 'dark'
}

export function currentTheme(): AppTheme {
  return normalizeTheme(document.documentElement.dataset.theme)
}

type SettingsApi = {
  load: () => Promise<Record<string, unknown>>
  save: (cfg: unknown) => Promise<{ ok: boolean }>
}

export async function persistTheme(theme: AppTheme, settings?: SettingsApi): Promise<void> {
  applyTheme(theme)
  if (!settings) return
  try {
    const current = await settings.load()
    await settings.save({ ...current, theme })
  } catch { /* offline */ }
}

export async function loadStoredTheme(settings?: SettingsApi): Promise<AppTheme> {
  if (!settings) return currentTheme()
  try {
    const cfg = await settings.load()
    const theme = normalizeTheme(cfg.theme)
    applyTheme(theme)
    return theme
  } catch {
    return currentTheme()
  }
}
