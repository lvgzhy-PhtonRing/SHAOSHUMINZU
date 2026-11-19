import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeCorrectionItems,
  sumCorrectionItems,
  formatSignedAmount,
  parseCorrectionNote,
  serializeCorrectionNote,
  resolveCorrectionTotal
} from '../src/utils/correctionDetails.js'

test('retains multiple named dividend items and sums signed amounts to cents', () => {
  const items = normalizeCorrectionItems([
    { category: 'stock_dividend', stockName: '格林美', amount: '448.00' },
    { category: 'stock_dividend', stockName: '立讯精密', amount: '307.78' },
    { category: 'reverse_repo', amount: '181.54' },
    { category: 'interest', amount: '41.59' },
    { category: 'dividend_tax', amount: '55.00' },
    { category: 'fee_error', direction: 'remove', amount: '10.00' }
  ])

  assert.deepEqual(items.map(item => item.signedAmount), [44800, 30778, 18154, 4159, -5500, -1000])
  assert.equal(sumCorrectionItems(items), 91391)
})

test('formats positive and negative correction amounts with visible signs', () => {
  assert.equal(formatSignedAmount(12668), '+126.68')
  assert.equal(formatSignedAmount(-5500), '-55.00')
})

test('derives correction direction and refuses a zero or empty breakdown', () => {
  assert.deepEqual(resolveCorrectionTotal([{ signedAmount: 12668 }]), { cents: 12668, type: 'add', amount: 126.68 })
  assert.deepEqual(resolveCorrectionTotal([{ signedAmount: -5500 }]), { cents: -5500, type: 'remove', amount: 55 })
  assert.equal(resolveCorrectionTotal([{ signedAmount: 500 }, { signedAmount: -500 }]), null)
  assert.equal(resolveCorrectionTotal([]), null)
})

test('round trips a structured breakdown and leaves legacy notes as legacy', () => {
  const items = normalizeCorrectionItems([
    { category: 'stock_dividend', stockName: '巨化股份', amount: '550.00' },
    { category: 'dividend_tax', amount: '55.00' }
  ])
  const note = serializeCorrectionNote('11月资金核对', items)
  assert.deepEqual(parseCorrectionNote(note), { note: '11月资金核对', items })
  assert.deepEqual(parseCorrectionNote('误差与逆回购收益'), { note: '误差与逆回购收益', items: [] })
  assert.deepEqual(parseCorrectionNote(null), { note: '', items: [] })
})

test('rejects unnamed dividends and invalid amounts', () => {
  assert.throws(() => normalizeCorrectionItems([
    { category: 'stock_dividend', stockName: '', amount: '10.00' }
  ]), /股票名称/)
  assert.throws(() => normalizeCorrectionItems([
    { category: 'reverse_repo', amount: 'abc' }
  ]), /金额/)
})
