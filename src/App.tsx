import { useMemo, useState } from 'react'
import { formatPercent, formatUsd } from './lib/format'
import { ApiError, fetchQuote, type Quote } from './lib/quotes'
import { DEFAULT_SYMBOLS } from './lib/symbols'
import { sortQuotes, type SortDir, type SortKey } from './lib/sort'

type QuoteRow =
  | { kind: 'loading'; symbol: string }
  | { kind: 'error'; symbol: string; message: string }
  | { kind: 'ok'; quote: Quote }

function App() {
  const [rows, setRows] = useState<QuoteRow[]>(() => DEFAULT_SYMBOLS.map((symbol) => ({ kind: 'loading', symbol })))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('symbol')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  async function refresh() {
    setError(null)
    setLoading(true)

    // Pre-fill with loading rows so the UI feels responsive.
    setRows(DEFAULT_SYMBOLS.map((symbol) => ({ kind: 'loading', symbol })))

    try {
      const results = await Promise.allSettled(DEFAULT_SYMBOLS.map((symbol) => fetchQuote(symbol)))

      const nextRows: QuoteRow[] = results.map((result, i) => {
        const symbol = DEFAULT_SYMBOLS[i]
        if (result.status === 'fulfilled') {
          return { kind: 'ok', quote: result.value }
        }

        const reason = result.reason
        const message =
          reason instanceof ApiError
            ? `${reason.message} (HTTP ${reason.status})`
            : reason instanceof Error
              ? reason.message
              : 'Unknown error'

        return { kind: 'error', symbol, message }
      })

      setRows(nextRows)
      setLastUpdatedAt(new Date())
    } catch (err: any) {
      setError(err?.message ?? 'Failed to refresh quotes')
    } finally {
      setLoading(false)
    }
  }

  const visibleRows = useMemo(() => {
    const q = query.trim().toUpperCase()
    const okQuotes = rows
      .filter((r): r is Extract<QuoteRow, { kind: 'ok' }> => r.kind === 'ok')
      .map((r) => r.quote)

    const okFiltered = q.length === 0 ? okQuotes : okQuotes.filter((quote) => quote.symbol.includes(q))
    const okSorted = sortQuotes(okFiltered, sortKey, sortDir)

    const nonOkRows = rows.filter((r) => r.kind !== 'ok')
    const nonOkFiltered =
      q.length === 0
        ? nonOkRows
        : nonOkRows.filter((r) => (r.kind === 'loading' ? r.symbol : r.symbol).includes(q))

    // Keep non-ok rows after sorted ok quotes.
    return [...okSorted.map((quote) => ({ kind: 'ok', quote } as QuoteRow)), ...nonOkFiltered]
  }, [query, rows, sortDir, sortKey])

  function toggleSort(nextKey: SortKey) {
    if (sortKey !== nextKey) {
      setSortKey(nextKey)
      setSortDir('asc')
      return
    }

    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
          <h1 className="text-xl font-semibold tracking-tight">Stock Price Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Real-time quotes and daily percent change for a small watchlist.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <section className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-sm">
            <label className="block text-sm font-medium text-slate-700" htmlFor="search">
              Search
            </label>
            <input
              id="search"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
              placeholder="Type a symbol (e.g., AAPL)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={refresh}
              disabled={loading}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <div className="text-xs text-slate-600">
              {lastUpdatedAt ? `Updated ${lastUpdatedAt.toLocaleTimeString()}` : 'Not updated yet'}
            </div>
          </div>
        </section>

        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    <button
                      type="button"
                      className="-mx-1 inline-flex items-center rounded px-1 py-0.5 hover:bg-slate-100"
                      onClick={() => toggleSort('symbol')}
                    >
                      Symbol{sortIndicator('symbol')}
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <button
                      type="button"
                      className="-mx-1 inline-flex items-center rounded px-1 py-0.5 hover:bg-slate-100"
                      onClick={() => toggleSort('price')}
                    >
                      Price{sortIndicator('price')}
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <button
                      type="button"
                      className="-mx-1 inline-flex items-center rounded px-1 py-0.5 hover:bg-slate-100"
                      onClick={() => toggleSort('changePercent')}
                    >
                      % Change{sortIndicator('changePercent')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-600" colSpan={3}>
                      No results.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => {
                    if (row.kind === 'loading') {
                      return (
                        <tr key={`loading-${row.symbol}`}>
                          <td className="px-4 py-4 font-medium text-slate-900">{row.symbol}</td>
                          <td className="px-4 py-4 text-slate-600">Loading…</td>
                          <td className="px-4 py-4 text-slate-600">—</td>
                        </tr>
                      )
                    }

                    if (row.kind === 'error') {
                      return (
                        <tr key={`error-${row.symbol}`}>
                          <td className="px-4 py-4 font-medium text-slate-900">{row.symbol}</td>
                          <td className="px-4 py-4 text-red-700" colSpan={2}>
                            {row.message}
                          </td>
                        </tr>
                      )
                    }

                    const { quote } = row
                    const isUp = quote.changePercent >= 0
                    const changeClass = isUp ? 'text-emerald-700' : 'text-red-700'

                    return (
                      <tr key={quote.symbol}>
                        <td className="px-4 py-4 font-medium text-slate-900">{quote.symbol}</td>
                        <td className="px-4 py-4 text-slate-900">{formatUsd(quote.price)}</td>
                        <td className={`px-4 py-4 font-medium ${changeClass}`}>{formatPercent(quote.changePercent)}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-4 text-xs text-slate-500">
          Tip: create a <span className="font-mono">.env</span> file with <span className="font-mono">FINNHUB_API_KEY</span>, then click Refresh.
        </div>
      </main>
    </div>
  )
}

export default App
