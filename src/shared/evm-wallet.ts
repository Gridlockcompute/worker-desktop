import { getAddress, isAddress } from 'viem'

export function isValidEvmWallet(raw: string): boolean {
  return isAddress(raw.trim())
}

export function normalizeEvmWallet(raw: string): string | null {
  const wallet = raw.trim()
  if (!isAddress(wallet)) return null
  return getAddress(wallet)
}

export function shortEvmWallet(addr: string): string {
  const w = addr.trim()
  if (w.length >= 10) return `${w.slice(0, 6)}…${w.slice(-4)}`
  return w
}
