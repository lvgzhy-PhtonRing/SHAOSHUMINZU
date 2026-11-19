export const CORRECTION_CATEGORIES = [
  { value: 'stock_dividend', label: '股票红利', sign: 'positive' },
  { value: 'reverse_repo', label: '逆回购收益', sign: 'positive' },
  { value: 'interest', label: '利息归本', sign: 'positive' },
  { value: 'dividend_tax', label: '股息个税', sign: 'negative' },
  { value: 'fee_error', label: '费用误差', sign: 'directional' }
]

export const CORRECTION_CATEGORY_LABELS = Object.fromEntries(
  CORRECTION_CATEGORIES.map(category => [category.value, category.label])
)

const CATEGORY_BY_VALUE = new Map(CORRECTION_CATEGORIES.map(category => [category.value, category]))
const NOTE_PREFIX = '[校对分项]'

function parseCents(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('请输入大于零的金额')
  return Math.round((amount + Number.EPSILON) * 100)
}

export function normalizeCorrectionItems(items) {
  if (!Array.isArray(items)) throw new Error('校对分项格式无效')
  return items.map(item => {
    const category = CATEGORY_BY_VALUE.get(item.category)
    if (!category) throw new Error('请选择有效的分项类别')
    const cents = parseCents(item.amount)
    const stockName = String(item.stockName || '').trim()
    if (category.value === 'stock_dividend' && !stockName) throw new Error('股票红利请填写股票名称')

    let sign = 1
    if (category.sign === 'negative') sign = -1
    if (category.sign === 'directional') {
      if (item.direction !== 'add' && item.direction !== 'remove') throw new Error('请选择费用误差的增减方向')
      sign = item.direction === 'add' ? 1 : -1
    }

    return {
      category: category.value,
      stockName: category.value === 'stock_dividend' ? stockName : '',
      signedAmount: cents * sign
    }
  })
}

export function sumCorrectionItems(items) {
  return items.reduce((sum, item) => sum + item.signedAmount, 0)
}

export function resolveCorrectionTotal(items) {
  if (!items.length) return null
  const cents = sumCorrectionItems(items)
  if (cents === 0) return null
  return {
    cents,
    type: cents > 0 ? 'add' : 'remove',
    amount: Math.abs(cents) / 100
  }
}

export function formatSignedAmount(cents) {
  const sign = cents < 0 ? '-' : '+'
  return sign + (Math.abs(cents) / 100).toFixed(2)
}

export function parseCorrectionNote(value) {
  const note = String(value || '')
  if (!note.startsWith(NOTE_PREFIX)) return { note, items: [] }
  try {
    const data = JSON.parse(note.slice(NOTE_PREFIX.length))
    if (data.version !== 1 || typeof data.note !== 'string' || !Array.isArray(data.items)) {
      return { note, items: [] }
    }
    const items = data.items.map(item => ({
      category: String(item.category || ''),
      stockName: String(item.stockName || ''),
      signedAmount: Number(item.signedAmount)
    }))
    if (items.some(item => !CATEGORY_BY_VALUE.has(item.category) || !Number.isInteger(item.signedAmount))) {
      return { note, items: [] }
    }
    return { note: data.note, items }
  } catch {
    return { note, items: [] }
  }
}

export function serializeCorrectionNote(note, items) {
  return NOTE_PREFIX + JSON.stringify({ version: 1, note: String(note || '').trim(), items })
}
