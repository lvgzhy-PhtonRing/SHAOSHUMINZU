const chinaDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' })

export function marketDate(value = new Date()) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? chinaDate.format(date) : ''
}

function cents(amount) {
  const value = Number(amount)
  if (amount == null || !Number.isFinite(value)) throw new Error('资金金额无效')
  return Math.round(value * 100)
}

function add(map, key, amount) {
  map.set(key, (map.get(key) || 0) + amount)
}

function poolFlowKey(pool, direction) {
  return `${pool}:${direction}`
}

function collectFlows(transactions, capitalLogs) {
  const cashByDate = new Map()
  const capitalByDate = new Map()
  const tradesByDate = new Map()
  const poolLogs = new Map()

  for (const log of capitalLogs) {
    const date = marketDate(log.created_at || '')
    if (!date || !['add', 'remove'].includes(log.type)) throw new Error('资金流水日期或类型无效')
    const amount = cents(log.amount) * (log.type === 'add' ? 1 : -1)
    if (log.pool_id == null) {
      add(cashByDate, date, amount)
      if (log.category !== 'adjust' && log.note !== '初始') add(capitalByDate, date, amount)
    } else {
      const key = poolFlowKey(log.pool_id, log.type)
      if (!poolLogs.has(key)) poolLogs.set(key, [])
      const code = (log.note || '').match(/(?:买入|卖出)\s+(\d{6})/)?.[1]
      poolLogs.get(key).push({ date, amount, code })
    }
  }

  const trades = []
  const unmatchedCounts = new Map()
  for (const tx of transactions) {
    const date = tx.trade_date
    const quantity = Number(tx.quantity)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !['buy', 'sell'].includes(tx.type) ||
      !/^\d{6}$/.test(tx.stock_code) || !Number.isFinite(quantity) || quantity <= 0) {
      if (tx.status === 'verified') throw new Error('已核对交易缺少有效的成交信息')
      continue
    }
    const buy = tx.type === 'buy'
    const amounts = new Set([cents(tx.actual_amount ?? tx.amount), cents(tx.amount ?? tx.actual_amount)])
    const key = poolFlowKey(tx.pool_id, buy ? 'remove' : 'add')
    const logs = poolLogs.get(key) || []
    let matched
    for (const value of amounts) {
      let index = logs.findIndex(log => log.code === tx.stock_code && Math.abs(log.amount) === value)
      if (index < 0) index = logs.findIndex(log => !log.code && Math.abs(log.amount) === value)
      if (index >= 0) {
        matched = logs.splice(index, 1)[0]
        break
      }
    }
    const stockKey = `${key}:${tx.stock_code}`
    if (!matched) {
      add(unmatchedCounts, key, 1)
      add(unmatchedCounts, stockKey, 1)
    }
    trades.push({ tx, date, change: quantity * (buy ? 1 : -1), logs, key, stockKey, amounts, matched })
  }

  for (const { tx, date, change, logs, key, stockKey, amounts, matched } of trades) {
    let flow = matched
    // 若流水金额被单独改过，仅在同池、同方向、同代码能唯一配对时移动日期。
    if (!flow && unmatchedCounts.get(stockKey) === 1) {
      const candidates = logs.filter(log => log.code === tx.stock_code)
      if (candidates.length === 1) flow = logs.splice(logs.indexOf(candidates[0]), 1)[0]
    }
    // 备注可被编辑，只有最后一笔交易与流水金额一致时才忽略备注中的代码。
    if (!flow && unmatchedCounts.get(key) === 1 && logs.length === 1 && amounts.has(Math.abs(logs[0].amount))) {
      flow = logs.pop()
    }
    if (tx.status !== 'verified' && !flow) continue
    // 现金只来自资金账本。将配对的流水移到成交日，保留它的账本金额。
    if (flow) add(cashByDate, date, flow.amount)
    if (!tradesByDate.has(date)) tradesByDate.set(date, new Map())
    add(tradesByDate.get(date), tx.stock_code, change)
  }

  for (const logs of poolLogs.values()) {
    for (const log of logs) add(cashByDate, log.date, log.amount)
  }
  return { cashByDate, capitalByDate, tradesByDate }
}

export function buildSnapshotInputs(dates, holdings, transactions, capitalLogs) {
  const { cashByDate, capitalByDate, tradesByDate } = collectFlows(transactions, capitalLogs)
  const positions = new Map()
  for (const h of holdings) {
    const quantity = Number(h.quantity)
    if (!/^\d{6}$/.test(h.stock_code) || !Number.isFinite(quantity) || quantity < 0) {
      throw new Error('当前持仓数据无效')
    }
    add(positions, h.stock_code, quantity)
  }
  let cash = [...cashByDate.values()].reduce((sum, amount) => sum + amount, 0)
  const eventDates = [...new Set([...cashByDate.keys(), ...tradesByDate.keys()])].sort().reverse()
  let eventIndex = 0
  const inputs = []
  for (const date of [...new Set(dates)].sort().reverse()) {
    while (eventIndex < eventDates.length && eventDates[eventIndex] > date) {
      const eventDate = eventDates[eventIndex++]
      cash -= cashByDate.get(eventDate) || 0
      for (const [code, change] of tradesByDate.get(eventDate) || []) add(positions, code, -change)
    }
    const quantities = [...positions].filter(([, quantity]) => quantity !== 0).sort()
    if (quantities.some(([, quantity]) => quantity < 0)) continue
    const capitalChange = capitalByDate.get(date) || 0
    inputs.push({
      date, cash: cash / 100, positions: quantities, capitalChange: capitalChange / 100,
      basis: JSON.stringify([cash, capitalChange, quantities])
    })
  }
  return inputs.reverse()
}

export function hasSnapshotValues(snapshot) {
  return Number.isFinite(snapshot?.asset) && Number.isFinite(snapshot?.ratio)
}

export function planSnapshotBackfill(inputs, originals, cached) {
  const originalDates = new Set(originals.filter(hasSnapshotValues).map(snapshot => snapshot.date))
  const pending = []
  const reusable = []
  for (const input of inputs) {
    if (originalDates.has(input.date)) continue
    const saved = cached[input.date]
    if (hasSnapshotValues(saved) && saved.basis === input.basis) reusable.push(saved)
    else pending.push(input)
  }
  return { pending, reusable }
}

export function estimateSnapshot(input, closes) {
  let marketValue = 0
  for (const [code, quantity] of input.positions) {
    const close = closes[code]?.[input.date]
    if (!Number.isFinite(close) || close <= 0) return null
    marketValue += quantity * close
  }
  const asset = marketValue + input.cash
  return {
    date: input.date,
    asset: Math.round(asset),
    ratio: asset > 0 ? Number((marketValue / asset * 100).toFixed(1)) : 0,
    capitalChange: input.capitalChange,
    basis: input.basis,
    estimated: true
  }
}
