export type Quote = {
  symbol: string
  price: number
  change: number
  changePercent: number
  marketTimestamp: number
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function fetchQuote(symbol: string, signal?: AbortSignal): Promise<Quote> {
  const url = new URL('/api/quote', window.location.origin)
  url.searchParams.set('symbol', symbol)

  const res = await fetch(url, { signal })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(text || `Request failed with status ${res.status}`, res.status)
  }

  const data = (await res.json()) as Quote
  return data
}
