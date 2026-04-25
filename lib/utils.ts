import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Decimal precision per asset (matches on-chain / testnet config).
 * XLM  – 7 decimals (1 XLM = 10,000,000 stroops)
 * USDC – 2 decimals (standard fiat-pegged stablecoin on Stellar testnet)
 */
export const ASSET_DECIMALS: Record<string, number> = {
  XLM: 7,
  USDC: 2,
}

/**
 * Format a numeric amount for display using Intl.NumberFormat.
 * Respects the user's locale for grouping separators.
 *
 * @param amount  - The numeric value to format
 * @param asset   - Asset ticker (e.g. "XLM", "USDC"). Defaults to "XLM"
 * @param locale  - BCP 47 locale string. Defaults to the runtime locale
 */
export function formatAmount(
  amount: number,
  asset: string = 'XLM',
  locale?: string,
): string {
  const decimals = ASSET_DECIMALS[asset] ?? 2
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  }).format(amount)
}

/** @deprecated Use formatAmount(amount, 'XLM') instead */
export function formatXLM(amount: number): string {
  return formatAmount(amount, 'XLM')
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}
