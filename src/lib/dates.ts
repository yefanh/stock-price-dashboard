export function formatShortDateFromUnixSeconds(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
}
