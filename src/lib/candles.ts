import { ApiError } from './quotes'

export type CandlePoint = {
  // Unix timestamp in seconds
  t: number
  close: number
}

export type CandleSeries = {
  symbol: string
  points: CandlePoint[]
}

export async function fetchCandles(symbol: string, signal?: AbortSignal): Promise<CandleSeries> {
  const url = new URL('/api/candles', window.location.origin)
  url.searchParams.set('symbol', symbol)

  const res = await fetch(url, { signal })

  if (!res.ok) {
    const text = await res.text().catch(() => '')

    let parsedError: string | null = null
    try {
      const parsed = JSON.parse(text) as { error?: string }
      if (parsed && typeof parsed.error === 'string' && parsed.error.trim().length > 0) {
        parsedError = parsed.error
      }
    } catch {
      // Ignore JSON parse errors and fall back.
    }

    if (parsedError) {
      throw new ApiError(parsedError, res.status)
    }

    throw new ApiError(text || `Request failed with status ${res.status}`, res.status)
  }

  const data = (await res.json()) as {
    symbol: string
    points: Array<{ t: number; c: number }>
  }

  return {
    symbol: data.symbol,
    points: data.points.map((p) => ({ t: p.t, close: p.c })),
  }
}
