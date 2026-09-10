<template>
  <van-popup
    v-model:show="visible"
    position="bottom"
    round
    :close-on-click-overlay="false"
    :style="{ height: '74%' }"
  >
    <div class="trade-sheet">
      <div class="sheet-head">
        <div class="sheet-title">
          <span>录入卖出</span>
        </div>
        <button class="sheet-close" @click="visible = false">✕</button>
      </div>

      <div class="sheet-body">
        <div class="section-card preset-section edge-fall">
          <div class="preset-name">{{ stockName }} <span class="preset-code">{{ stockCode }}</span></div>
          <div class="preset-info">
            <span>现价 {{ formatPrice(currentPrice) }}</span>
            <span>总持仓 {{ sellTotalHolding }} 股</span>
          </div>
        </div>

        <div class="section-card edge-fall">
          <div class="sell-price-row">
            <label class="spr-label">卖出单价</label>
            <input v-model.number="sellPrice" type="number" inputmode="decimal" step="0.01" class="spr-price-input num-mono" />
            <span class="spr-unit">元</span>
          </div>
          <div class="sell-total-row">
            <div class="stl-header">
              <span class="stl-label">卖出总量</span>
              <span class="stl-val num-mono">{{ sellTotalQty }} 股</span>
            </div>
            <input type="range" :min="0" :max="sellTotalHolding" :step="100" v-model.number="sellTotalQty" class="sell-slider" @input="onTotalSliderChange" />
            <div class="stl-estimate" v-if="sellTotalQty > 0">≈ {{ formatMoney(sellTotalQty * sellPrice) }}</div>
          </div>
          <div v-if="sellTotalQty > 0" class="sell-pools-section">
            <div class="section-title"><span class="title-accent title-accent--fall"></span>各池分配</div>
            <div v-for="entry in sellEntries" :key="entry.pool_id" class="sell-pool-row">
              <div class="spr-header">
                <span class="spr-pool-name" :style="{ color: poolColor(entry.pool_name) }">{{ entry.pool_name }}</span>
                <span class="spr-holding">持有 <span class="num-mono">{{ entry.holding_qty }}</span> 股</span>
              </div>
              <input type="range" :min="0" :max="entry.max_sell" :step="100" v-model.number="entry.sell_qty" class="sell-slider" @input="onPoolSliderChange(entry)" />
              <div class="spr-bottom">
                <span class="num-mono">{{ entry.sell_qty }} 股</span>
                <span class="spr-estimate" v-if="entry.sell_qty > 0">≈ {{ formatMoney(entry.sell_qty * sellPrice) }}</span>
              </div>
            </div>
            <div v-if="sellRemaining > 0" class="sell-remaining">待分配 <span class="num-mono">{{ sellRemaining }}</span> 股</div>
          </div>
          <div class="sell-date-row">
            <label class="sdr-label">成交日期</label>
            <input v-model="sellDate" type="date" class="sdr-input" />
          </div>
          <div class="sell-fee-row" v-if="sellTotalQty > 0">
            <div class="sfr-item"><span>预估总金额</span><span class="num-mono">{{ formatMoney(sellTotalQty * sellPrice) }}</span></div>
            <div class="sfr-item"><span>手续费</span><span class="num-mono">{{ formatMoney(sellFee) }}</span></div>
            <div class="sfr-item"><span>实际到账</span><span class="num-mono rise">{{ formatMoney(sellTotalQty * sellPrice - sellFee) }}</span></div>
          </div>
          <div style="margin: 16px 0">
            <van-button round block type="primary"
              :color="sellValid ? 'var(--color-rise)' : '#666'"
              :disabled="!sellValid || submitting"
              :loading="submitting"
              @click="submitSell">
              📝 录入卖出（{{ sellTotalQty }} 股）
            </van-button>
          </div>
          <div v-if="formError" class="form-err">{{ formError }}</div>
        </div>
      </div>
    </div>
  </van-popup>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { formatMoney, formatPrice } from '@/utils/formatters'
import { calcSellFee, calcSellActual } from '@/utils/feeCalculator'
import { upsertHolding, deleteHolding, insertCapitalLog, fetchTransactionsByPoolStock } from '@/api/supabase'
import { usePoolStore } from '@/stores/pools'
import { useTransactionStore } from '@/stores/transactions'
import { useHoldingStore } from '@/stores/holdings'
import { useFundStore } from '@/stores/funds'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  stock: { type: Object, default: () => ({ code: '', name: '', price: 0 }) }
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

const currentPrice = ref(0)
const stockCode = ref('')
const stockName = ref('')
const formError = ref('')
const submitting = ref(false)

const sellDate = ref(new Date().toISOString().split('T')[0])
const sellTotalQty = ref(0)
const sellPrice = ref(0)
const sellEntries = ref([])

const sellHoldingPools = computed(() => {
  if (!stockCode.value) return []
  return holdingStore.holdings.filter(h => h.stock_code === stockCode.value && h.quantity > 0).map(h => {
    const pool = poolStore.pools.find(p => p.id === h.pool_id)
    return { pool_id: h.pool_id, pool_name: pool?.name || '', holding_qty: h.quantity }
  })
})
const sellTotalHolding = computed(() => sellHoldingPools.value.reduce((s, h) => s + h.holding_qty, 0))
const sellRemaining = computed(() => {
  const allocated = sellEntries.value.reduce((s, e) => s + (e.sell_qty || 0), 0)
  return Math.max(0, sellTotalQty.value - allocated)
})
const sellFee = computed(() => {
  const amt = sellTotalQty.value * sellPrice.value
  return amt > 0 ? calcSellFee(amt) : 0
})

const sellValid = computed(() => {
  if (sellTotalQty.value <= 0 || sellRemaining.value > 0) return false
  for (const e of sellEntries.value) { if (e.sell_qty > e.holding_qty || e.sell_qty % 100 !== 0) return false }
  return true
})

let _redistributing = false
function onTotalSliderChange() {
  if (_redistributing) return; _redistributing = true
  const total = sellTotalQty.value; let remaining = total
  const entries = sellEntries.value
  for (let i = 0; i < entries.length; i++) {
    if (i === entries.length - 1) { entries[i].sell_qty = Math.min(remaining, entries[i].holding_qty); entries[i].sell_qty = Math.floor(entries[i].sell_qty / 100) * 100 }
    else { const ratio = entries[i].holding_qty / sellTotalHolding.value; let qty = Math.floor(total * ratio / 100) * 100; qty = Math.min(qty, entries[i].holding_qty); entries[i].sell_qty = qty; remaining -= qty }
  }
  updateMaxSliders(); _redistributing = false
}
function onPoolSliderChange(changed) {
  if (_redistributing) return; _redistributing = true
  const actualTotal = sellEntries.value.reduce((s, e) => s + (e.sell_qty || 0), 0)
  if (actualTotal > sellTotalQty.value) {
    const excess = actualTotal - sellTotalQty.value
    const others = sellEntries.value.filter(e => e.pool_id !== changed.pool_id && e.sell_qty > 0)
    let toRemove = excess
    for (const o of others) { if (toRemove <= 0) break; const take = Math.min(o.sell_qty, toRemove); o.sell_qty -= take; toRemove -= take }
  } else if (actualTotal < sellTotalQty.value) {
    const shortage = sellTotalQty.value - actualTotal
    const others = sellEntries.value.filter(e => e.pool_id !== changed.pool_id)
    let toAdd = shortage
    for (const o of others) { if (toAdd <= 0) break; const space = o.holding_qty - (o.sell_qty || 0); const add = Math.min(space, toAdd); if (add > 0) { o.sell_qty = (o.sell_qty || 0) + add; toAdd -= add } }
    if (toAdd > 0) sellTotalQty.value = actualTotal
  }
  for (const e of sellEntries.value) { e.sell_qty = Math.floor(e.sell_qty / 100) * 100; if (e.sell_qty > e.holding_qty) e.sell_qty = Math.floor(e.holding_qty / 100) * 100 }
  updateMaxSliders(); _redistributing = false
}
function updateMaxSliders() { for (const e of sellEntries.value) e.max_sell = e.holding_qty }

async function submitSell() {
  formError.value = ''
  if (!sellValid.value) return
  const entries = sellEntries.value.filter(e => e.sell_qty > 0)
  if (!entries.length) { formError.value = '请至少输入一个子池的卖出数量'; return }
  submitting.value = true
  try {
    for (const e of entries) {
      const amt = Math.round(e.sell_qty * sellPrice.value * 100) / 100
      const { fee, actualAmount } = calcSellActual(amt)
      const tx = { pool_id: e.pool_id, stock_code: stockCode.value, stock_name: stockName.value, type: 'sell', quantity: e.sell_qty, price: sellPrice.value, amount: amt, fee, status: 'verified', actual_amount: actualAmount, trade_date: sellDate.value, note: `卖出 ${stockCode.value}`, created_by: 'admin' }
      await txStore.addTransaction(tx)
      const existing = holdingStore.holdings.find(h => h.pool_id === e.pool_id && h.stock_code === stockCode.value)
      const remaining = (existing?.quantity || 0) - e.sell_qty
      const allPoolTxs = await fetchTransactionsByPoolStock(e.pool_id, stockCode.value)
      const buyTotal = allPoolTxs.filter(t => t.type === 'buy').reduce((s, t) => s + (t.actual_amount || t.amount), 0)
      const sellTotal = allPoolTxs.filter(t => t.type === 'sell').reduce((s, t) => s + (t.actual_amount || t.amount), 0) + actualAmount
      const netInvestment = buyTotal - sellTotal
      const newCost = remaining > 0 ? parseFloat((netInvestment / remaining).toFixed(3)) : 0
      if (remaining <= 0) await deleteHolding(e.pool_id, stockCode.value)
      else await upsertHolding({ pool_id: e.pool_id, stock_code: stockCode.value, stock_name: existing?.stock_name || stockName.value, quantity: remaining, cost_price: newCost })
      await insertCapitalLog({ pool_id: e.pool_id, type: 'add', amount: actualAmount, note: `卖出 ${stockCode.value}`, created_by: 'admin' })
    }
    await Promise.all([holdingStore.loadHoldings(), fundStore.loadCapitalLogs()])
    resetSell()
    visible.value = false
    emit('changed')
  } catch (e) { console.error('Sell error:', e); formError.value = '提交失败：' + e.message } finally { submitting.value = false }
}

function resetSell() {
  sellTotalQty.value = 0; sellPrice.value = 0; sellEntries.value = []; formError.value = ''
}

function poolColor(name) { const map = { '公共池': '#4d9fff', '春': '#ff4d6d', '维': '#00f0a8', '队': '#ffd23f', '回': '#b18cff' }; return map[name] || '#4d9fff' }

watch(() => props.modelValue, async v => {
  if (!v) return
  stockCode.value = props.stock.code || ''
  stockName.value = props.stock.name || ''
  currentPrice.value = parseFloat(props.stock.price) || 0
  formError.value = ''
  submitting.value = false
  try {
    await Promise.all([poolStore.loadPools(), fundStore.loadCapitalLogs(), txStore.loadTransactions(), holdingStore.loadHoldings()])
  } catch (e) {}
  initSellEntries()
})

function initSellEntries() {
  sellTotalQty.value = 0
  sellPrice.value = currentPrice.value
  sellEntries.value = sellHoldingPools.value.map(h => ({ pool_id: h.pool_id, pool_name: h.pool_name, holding_qty: h.holding_qty, max_sell: h.holding_qty, sell_qty: 0 }))
}
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
.sheet-title { flex: 1; }
.sheet-title > :first-child { font-size: 16px; font-weight: 700; }
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

.section-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding: 0 0 10px; }
.preset-name { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
.preset-code { font-size: 13px; color: var(--text-secondary); font-weight: 400; }
.preset-info { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-secondary); }
.form-err { color: var(--color-fall); font-size: 13px; text-align: center; margin-top: 8px; }

.sell-price-row { display: flex; align-items: center; gap: 8px; padding: 0 0 12px; }
.spr-label { font-size: 13px; color: var(--text-secondary); white-space: nowrap; }
.spr-price-input { flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 16px; padding: 6px 10px; text-align: right; outline: none; }
.spr-price-input:focus { border-color: var(--color-rise); }
.spr-unit { font-size: 13px; color: var(--text-secondary); }
.sell-total-row { padding: 8px 0 16px; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 12px; }
.stl-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
.stl-label { font-size: 14px; font-weight: 700; }
.stl-val { font-size: 20px; color: var(--color-rise); }
.stl-estimate { font-size: 12px; color: var(--text-muted); margin-top: 2px; text-align: right; }
.sell-slider { width: 100%; height: 6px; -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.1); border-radius: 3px; outline: none; }
.sell-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 24px; height: 24px; border-radius: 50%; background: var(--color-fall); cursor: pointer; border: 2px solid #fff; }
.sell-pools-section { padding-top: 4px; }
.sell-pool-row { padding: 10px 0 12px; border-bottom: 1px solid rgba(255,255,255,0.03); }
.spr-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
.spr-pool-name { font-size: 13px; font-weight: 600; }
.spr-holding { font-size: 11px; color: var(--text-secondary); }
.spr-bottom { display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px; font-size: 13px; }
.spr-estimate { font-size: 11px; color: var(--text-muted); }
.sell-remaining { text-align: center; padding: 8px; font-size: 12px; color: var(--color-warn); background: rgba(255,152,0,0.08); border-radius: var(--radius-md); margin-top: 8px; }
.sell-date-row { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.sdr-label { font-size: 12px; color: var(--text-secondary); white-space: nowrap; }
.sdr-input { flex: 1; padding: 8px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 14px; outline: none; }
.sell-fee-row { padding: 8px 10px; background: rgba(255,255,255,0.03); border-radius: var(--radius-md); margin-top: 8px; }
.sfr-item { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; color: var(--text-secondary); }
.sfr-item .num-mono { font-size: 12px; }
.sfr-item .num-mono.rise { color: var(--color-rise); font-weight: 600; }
</style>
