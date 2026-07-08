const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export function isValidEvmWallet(raw: string): boolean {
  return EVM_ADDRESS_RE.test(raw.trim())
}

export function normalizeEvmWallet(raw: string): string | null {
  const wallet = raw.trim()
  if (!isValidEvmWallet(wallet)) return null
  return wallet
}

export function shortEvmWallet(addr: string): string {
  const w = addr.trim()
  if (w.length >= 10) return `${w.slice(0, 6)}…${w.slice(-4)}`
  return w
}
