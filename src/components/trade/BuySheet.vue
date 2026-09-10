<template>
  <van-popup
    v-model:show="visible"
    position="bottom"
    round
    :close-on-click-overlay="false"
    :style="{ height: '62%' }"
  >
    <div class="trade-sheet">
      <div class="sheet-head">
        <button v-if="step === 'form'" class="sheet-back" @click="step = 'search'">←</button>
        <div class="sheet-title">
          <span v-if="step === 'search'">买入股票</span>
          <template v-else>
            <span>📈 买入 {{ stockName || stockCode }}</span>
            <span class="st-price num-mono" v-if="currentPrice">{{ formatPrice(currentPrice) }}</span>
          </template>
        </div>
        <button class="sheet-close" @click="visible = false">✕</button>
      </div>

      <div class="sheet-body">
        <template v-if="step === 'search'">
          <StockSearch @stock-selected="onStockSelected" @buy-clicked="onBuyClicked" />
          <div v-if="formError" class="form-err">{{ formError }}</div>
        </template>
        <template v-else>
          <TradeForm
            :key="session"
            :pools="poolStore.pools"
            :is-buy="true"
            :stock-price="currentPrice"
            :submitting="submitting"
            @submit="onBuySubmit"
          />
          <div v-if="formError" class="form-err">{{ formError }}</div>
        </template>
      </div>
    </div>
  </van-popup>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { formatMoney, formatPrice } from '@/utils/formatters'
import { calcBuyActual } from '@/utils/feeCalculator'
import { calcNewCostPrice } from '@/utils/calculators'
import { insertCapitalLog, upsertHolding, loadPoolAllocation } from '@/api/supabase'
import { usePoolStore } from '@/stores/pools'
import { useTransactionStore } from '@/stores/transactions'
import { useHoldingStore } from '@/stores/holdings'
import { useFundStore } from '@/stores/funds'
import StockSearch from '@/components/trade/StockSearch.vue'
import TradeForm from '@/components/trade/TradeForm.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'changed'])

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const poolStore = usePoolStore()
const txStore = useTransactionStore()
const holdingStore = useHoldingStore()
const fundStore = useFundStore()

function loadLocalAlloc() {
  const raw = localStorage.getItem('poolAmounts')
  if (!raw) return null
  const parsed = JSON.parse(raw)
  if (parsed['共有'] !== undefined && parsed['公共池'] === undefined) { parsed['公共池'] = parsed['共有']; delete parsed['共有'] }
  const vals = Object.values(parsed)
  const sum = vals.reduce((s, v) => s + v, 0)
  if (vals.every(v => v <= 100) && Math.abs(sum - 100) < 1) {
    const amt = {}; for (const k of Object.keys(parsed)) amt[k] = (fundStore.totalCapital || 0) * parsed[k] / 100; return amt
  }
  return parsed
}
function defaultAlloc() { const each = Math.floor((fundStore.totalCapital || 1000000) / 5 / 10000) * 10000; return { '公共池': each, '春': each, '维': each, '队': each, '回': each } }
const poolAmounts = reactive({})

async function refreshAlloc() {
  let base = loadLocalAlloc() || defaultAlloc()
  for (const k of Object.keys(poolAmounts)) delete poolAmounts[k]
  for (const k of Object.keys(base)) poolAmounts[k] = base[k]
  try {
    const server = await loadPoolAllocation()
    if (server) {
      let s = server
      if (s['共有'] !== undefined && s['公共池'] === undefined) { s = { ...s }; s['公共池'] = s['共有']; delete s['共有'] }
      for (const k of Object.keys(s)) { if (poolAmounts[k] !== undefined) poolAmounts[k] = s[k] }
    }
  } catch (e) {}
}

const step = ref('search')
const session = ref(0)
const currentPrice = ref(0)
const stockCode = ref('')
const stockName = ref('')
const formError = ref('')
const submitting = ref(false)

async function onBuySubmit(data) {
  formError.value = ''
  if (!stockCode.value) { formError.value = '请先搜索并选择股票代码'; return }
  const pool = poolStore.pools.find(p => p.id === data.pool_id)
  if (pool) {
    const poolCost = holdingStore.holdings.filter(h => h.pool_id === data.pool_id).reduce((s, h) => s + h.cost_price * h.quantity, 0)
    let available
    if (pool.name === '公共池') {
      const totalCost = holdingStore.holdings.reduce((s, h) => s + h.cost_price * h.quantity, 0)
      const sellIn = fundStore.capitalLogs.filter(l => l.pool_id !== null && l.type === 'add').reduce((s, l) => s + l.amount, 0)
      const buyOut = fundStore.capitalLogs.filter(l => l.pool_id !== null && l.type === 'remove').reduce((s, l) => s + l.amount, 0)
      const totalAvailable = fundStore.totalCapital + sellIn - buyOut
      let subSum = 0
      for (const p of poolStore.pools) { if (p.name === '公共池') continue; const sa = poolAmounts[p.name] || 0; const sc = holdingStore.holdings.filter(h => h.pool_id === p.id).reduce((s, h) => s + h.cost_price * h.quantity, 0); subSum += (sa - sc) }
      available = totalAvailable - subSum
    } else { available = (poolAmounts[pool.name] || 0) - poolCost }
    const need = parseFloat(data.amount) || 0
    if (need > available) { formError.value = `子池「${pool.name}」可用资金不足！剩余 ${formatMoney(available)}，本次需 ${formatMoney(need)}`; return }
  }
  submitting.value = true
  try {
    const amount = parseFloat(data.amount); const qty = data.quantity; const price = data.price
    const { fee, actualAmount } = calcBuyActual(amount)
    const tx = { pool_id: data.pool_id, stock_code: stockCode.value, stock_name: stockName.value, type: 'buy', quantity: qty, price, amount, fee, status: 'verified', actual_amount: actualAmount, trade_date: data.trade_date, note: data.note || `买入 ${stockCode.value}`, created_by: 'admin' }
    await txStore.addTransaction(tx)
    const existing = holdingStore.holdings.find(h => h.pool_id === data.pool_id && h.stock_code === stockCode.value)
    const newCost = calcNewCostPrice(actualAmount, qty, existing?.quantity || 0, existing?.cost_price || 0)
    await upsertHolding({ pool_id: data.pool_id, stock_code: stockCode.value, stock_name: stockName.value, quantity: (existing?.quantity || 0) + qty, cost_price: newCost })
    await insertCapitalLog({ pool_id: data.pool_id, type: 'remove', amount: actualAmount, note: `买入 ${stockCode.value}`, created_by: 'admin' })
    await Promise.all([holdingStore.loadHoldings(), fundStore.loadCapitalLogs()])
    stockCode.value = ''; stockName.value = ''; currentPrice.value = 0; formError.value = ''; step.value = 'search'; visible.value = false
    emit('changed')
  } catch (e) { console.error('Buy error:', e); formError.value = '提交失败：' + e.message } finally { submitting.value = false }
}

function onStockSelected(stock) { currentPrice.value = stock.price; stockCode.value = stock.stock_code; stockName.value = stock.stock_name || '' }

function onBuyClicked(stock) {
  onStockSelected(stock)
  formError.value = ''
  step.value = 'form'
}

watch(() => props.modelValue, async v => {
  if (!v) return
  step.value = 'search'
  stockCode.value = ''; stockName.value = ''; currentPrice.value = 0
  formError.value = ''; submitting.value = false
  session.value++
  try {
    await Promise.all([poolStore.loadPools(), fundStore.loadCapitalLogs(), txStore.loadTransactions(), holdingStore.loadHoldings()])
  } catch (e) {}
  await refreshAlloc()
})
</script>

<style scoped>
.trade-sheet { display: flex; flex-direction: column; height: 100%; }
.sheet-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}
.sheet-title { flex: 1; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.sheet-title > :first-child { font-size: 16px; font-weight: 700; }
.st-price { font-size: 17px; font-weight: 700; color: var(--color-rise); }
.sheet-back {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sheet-back:active { background: rgba(255, 255, 255, 0.15); }
.sheet-close {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sheet-close:active { background: rgba(255, 255, 255, 0.15); }
.sheet-body { flex: 1; overflow-y: auto; padding: 16px; }
.form-err { color: var(--color-fall); font-size: 13px; text-align: center; margin-top: 12px; }
</style>
