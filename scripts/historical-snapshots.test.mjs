import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSnapshotInputs, estimateSnapshot, planSnapshotBackfill } from '../src/utils/historicalSnapshotLedger.js'

const days = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16']
const holdings = [{ stock_code: '510720', quantity: 100 }]
const opening = { pool_id: null, type: 'add', amount: 1000, note: '初始', created_at: '2026-11-01T00:00:00+08:00' }
const confirmed = { pool_id: 1, stock_code: '510720', type: 'buy', status: 'verified', quantity: 100, amount: 100, actual_amount: 105, trade_date: '2026-11-02' }
const openingTrade = { pool_id: 1, type: 'remove', amount: 105, note: '买入 510720', created_at: '2026-11-02T04:01:00Z' }
const closes = { '510720': { '2026-11-10': 1.1, '2026-11-11': 1.2, '2026-11-12': 1.3, '2026-11-13': 1.4, '2026-11-16': 1.5 } }

test('第十一天补录第八天买入，只重算成交日及其后补算的快照', () => {
  const before = buildSnapshotInputs(days, holdings, [confirmed], [opening, openingTrade])
  const cache = Object.fromEntries(before.map(input => [input.date, estimateSnapshot(input, closes)]))
  const backdated = { ...confirmed, trade_date: '2026-11-12', amount: 120, actual_amount: 125 }
  const tradeLog = { ...openingTrade, amount: 125, created_at: '2026-11-17T02:00:00Z' }
  const after = buildSnapshotInputs(days, [{ ...holdings[0], quantity: 200 }], [confirmed, backdated], [opening, openingTrade, tradeLog])
  const { pending, reusable } = planSnapshotBackfill(after, [], cache)
  assert.deepEqual(pending.map(input => input.date), days.slice(2))
  assert.deepEqual(reusable.map(snapshot => snapshot.date), days.slice(0, 2))
  assert.deepEqual(after.map(input => input.cash), [895, 895, 770, 770, 770])
  assert.deepEqual(pending.map(input => estimateSnapshot(input, closes).asset), [1030, 1050, 1070])
})

test('交易日现金计入增资和校对，只有外部增减资计入当日资金变动', () => {
  const nextDayInChina = '2026-11-11T16:30:00Z'
  const capital = { ...opening, amount: 70, note: '追加', created_at: nextDayInChina }
  const adjust = { ...capital, amount: 5, category: 'adjust' }
  const inputs = buildSnapshotInputs(days.slice(1, 3), holdings, [confirmed], [opening, openingTrade, capital, adjust])
  assert.deepEqual(inputs.map(input => [input.cash, input.capitalChange]), [[895, 0], [970, 70]])
})

test('缺少任意持仓的当日收盘价时不生成快照', () => {
  const [input] = buildSnapshotInputs(days, holdings, [confirmed], [opening, openingTrade])
  assert.equal(estimateSnapshot(input, { '510720': { '2026-11-09': 1.1 } }), null)
})

test('已调整的买入流水只记一笔，沿用资金账本的金额', () => {
  const backdated = { ...confirmed, trade_date: days[1] }
  const adjustedLog = { ...openingTrade, amount: 108, created_at: '2026-11-17T02:00:00Z' }
  const inputs = buildSnapshotInputs(days, holdings, [backdated], [opening, adjustedLog])
  assert.deepEqual(inputs.map(input => input.cash), [1000, 892, 892, 892, 892])
})

test('已入账的旧版待校对交易也按成交日还原仓位', () => {
  const legacyTrade = { ...confirmed, status: 'pending', trade_date: days[1], actual_amount: null }
  const legacyLog = { ...openingTrade, amount: 100, created_at: '2026-11-17T02:00:00Z' }
  const inputs = buildSnapshotInputs(days.slice(0, 2), holdings, [legacyTrade], [opening, legacyLog])
  assert.deepEqual(inputs.map(input => input.positions), [[], [['510720', 100]]])
  assert.deepEqual(inputs.map(input => input.cash), [1000, 900])
})

test('流水备注里的其他股票代码不影响金额唯一匹配的补录交易', () => {
  const backdated = { ...confirmed, trade_date: days[1] }
  const editedNote = { ...openingTrade, note: '买入 123456', created_at: '2026-11-17T02:00:00Z' }
  const inputs = buildSnapshotInputs(days.slice(0, 2), holdings, [backdated], [opening, editedNote])
  assert.deepEqual(inputs.map(input => input.cash), [1000, 895])
})

test('原始快照优先，其他日期可重新补算', () => {
  const inputs = buildSnapshotInputs(days, holdings, [confirmed], [opening, openingTrade])
  const existing = [{ date: days[0], asset: 999, ratio: 10 }]
  const { pending, reusable } = planSnapshotBackfill(inputs, existing, { [days[0]]: estimateSnapshot(inputs[0], closes) })
  assert.deepEqual(pending.map(input => input.date), days.slice(1))
  assert.deepEqual(reusable, [])
})
