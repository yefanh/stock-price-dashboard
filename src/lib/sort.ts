import type { Quote } from './quotes'

export type SortKey = 'symbol' | 'price' | 'changePercent'
export type SortDir = 'asc' | 'desc'

export function sortQuotes(quotes: Quote[], sortKey: SortKey, sortDir: SortDir): Quote[] {
  const factor = sortDir === 'asc' ? 1 : -1

  return [...quotes].sort((a, b) => {
    if (sortKey === 'symbol') {
      return a.symbol.localeCompare(b.symbol) * factor
    }

    if (sortKey === 'price') {
      return (a.price - b.price) * factor
    }

    return (a.changePercent - b.changePercent) * factor
  })
}
