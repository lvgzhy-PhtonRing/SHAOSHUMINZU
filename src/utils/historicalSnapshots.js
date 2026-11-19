import { fetchKLine, fetchMarketDailyBars } from '@/api/stock'
import { fetchHistoricalSnapshotLedger, fetchPositionSnapshots } from '@/api/supabase'
import { buildSnapshotInputs, estimateSnapshot, hasSnapshotValues, marketDate, planSnapshotBackfill } from './historicalSnapshotLedger'

const CACHE_KEY = 'etf_historical_snapshots_v1'
const SNAPSHOT_LIMIT = 500
const PRICE_CONCURRENCY = 6
let refreshJob
let rerunRequested = false

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}
  } catch {
    return {}
  }
}

function saveCache(snapshots) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(snapshots.map(s => [s.date, s]))))
  } catch (error) {
    console.warn('历史快照无法写入浏览器缓存：', error)
  }
}

export function mergeHistorySnapshots(originals, estimates) {
  const byDate = new Map(estimates.map(snapshot => [snapshot.date, snapshot]))
  for (const snapshot of originals.filter(hasSnapshotValues)) byDate.set(snapshot.date, snapshot)
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

async function prepareHistoricalSnapshots() {
  const today = marketDate()
  const cached = readCache()
  const [stored, ledger, marketBars] = await Promise.all([
    fetchPositionSnapshots(SNAPSHOT_LIMIT, { strict: true }),
    fetchHistoricalSnapshotLedger(),
    fetchMarketDailyBars()
  ])
  const originals = stored.filter(hasSnapshotValues)
  const firstDate = [
    originals[0]?.date,
    ...ledger.capitalLogs.map(log => marketDate(log.created_at || '')),
    ...ledger.transactions.filter(tx => tx.status === 'verified').map(tx => tx.trade_date)
  ].filter(Boolean).sort()[0]
  const tradingDates = [...new Set(marketBars.map(bar => marketDate(bar.timestamp)))].filter(Boolean).sort()
  const eligible = date => firstDate && date >= firstDate && date < today
  // 行情服务暂不可用时，仍可用本地账本验证已缓存的估算。
  const dates = (tradingDates.length ? tradingDates : Object.keys(cached)).filter(eligible)
  const inputs = buildSnapshotInputs(dates, ledger.holdings, ledger.transactions, ledger.capitalLogs)
  const { pending, reusable } = planSnapshotBackfill(inputs, originals, cached)
  const closes = {}

  if (tradingDates.length) {
    const codes = [...new Set(pending.flatMap(input => input.positions.map(([code]) => code)))]
    for (let index = 0; index < codes.length; index += PRICE_CONCURRENCY) {
      await Promise.all(codes.slice(index, index + PRICE_CONCURRENCY).map(async code => {
        const bars = await fetchKLine(code, 'day')
        closes[code] = Object.fromEntries(bars.map(bar => [marketDate(bar.timestamp), bar.close]))
      }))
    }
  }
  const estimates = [...reusable]
  if (tradingDates.length) {
    for (const input of pending) {
      const estimate = estimateSnapshot(input, closes)
      if (estimate) estimates.push(estimate)
    }
  }
  return { originals, estimates, tradingDates }
}

export function refreshHistoricalSnapshots({ afterLedgerChange = false } = {}) {
  if (refreshJob) {
    if (afterLedgerChange) rerunRequested = true
    return refreshJob
  }
  refreshJob = (async () => {
    for (;;) {
      rerunRequested = false
      try {
        const result = await prepareHistoricalSnapshots()
        // 交易可能在行情请求期间录入。先读新的账本，再发布估算。
        if (rerunRequested) continue
        saveCache(result.estimates)
        return result
      } catch (error) {
        if (!rerunRequested) throw error
      }
    }
  })().finally(() => { refreshJob = undefined })
  return refreshJob
}
