<template>
  <div class="page trade-page">
    <div class="page-header">
      <span class="page-title">{{ isSell ? '卖出' : '录入买入' }}</span>
    </div>

    <!-- 买入表单 -->
    <template v-if="!isSell">
      <div class="section-card">
        <div class="search-section-label">搜索股票</div>
        <StockSearch @stock-selected="onStockSelected" />
      </div>
      <div class="section-card">
        <TradeForm
          ref="formRef"
          :pools="poolStore.pools"
          :is-buy="true"
          :stock-price="currentPrice"
          :submitting="submitting"
          @submit="onBuySubmit"
        />
        <div v-if="formError" class="form-err">{{ formError }}</div>
      </div>
    </template>

    <!-- 卖出表单（多池联动滑块） -->
    <template v-if="isSell">
      <div class="section-card preset-section">
        <div class="preset-name">{{ stockName }} <span class="preset-code">{{ stockCode }}</span></div>
        <div class="preset-info">
          <span>现价 {{ formatPrice(currentPrice) }}</span>
          <span>总持仓 {{ sellTotalHolding }} 股</span>
        </div>
      </div>
      <div class="section-card">
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
          <div class="section-title">各池分配</div>
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
    </template>

    <!-- 历史买卖记录 -->
    <div class="section-card" v-if="tradeLogs.length">
      <div class="section-title">股票交易记录</div>
      <div class="trade-log-list">
        <van-swipe-cell v-for="log in tradeLogs" :key="log.id" :right-width="140">
          <div class="trade-log-item">
            <div class="tli-body" @click="startEditTrade(log)">
              <div class="tli-header">
                <span class="tli-action" :class="log.type === 'add' ? 'rise' : 'fall'">
                  {{ log.type === 'add' ? '卖出' : '买入' }} {{ log.stock_code }}
                </span>
                <span class="tli-name">{{ log.stock_name }}</span>
                <span v-if="log.quantity" class="tli-qty">{{ log.quantity }}股</span>
              </div>
              <div class="tli-meta">
                <span>{{ formatMoney(log.amount) }}</span>
                <span v-if="log.fee > 0" class="tli-fee">· 费 {{ formatMoney(log.fee) }}</span>
                <span> · {{ log.pool_name }}</span>
                <span> · {{ formatDateString(log.trade_date) }}</span>
              </div>
            </div>
            <span class="tli-arrow">›</span>
          </div>
          <template #right>
            <div class="swipe-actions">
              <button class="swipe-edit-btn" @click.stop="startEditTrade(log)">编辑</button>
              <button class="swipe-del-btn" @click.stop="confirmDeleteTrade(log)">删除</button>
            </div>
          </template>
        </van-swipe-cell>
      </div>
    </div>

    <!-- 编辑交易弹窗 -->
    <teleport to="body">
      <div v-if="editingTrade" class="overlay" @click.self="editingTrade = null">
        <div class="dialog">
          <div class="dlg-title">编辑交易记录</div>
          <div class="dlg-field">
            <label class="dlg-label">类型</label>
            <span class="dlg-value">{{ editingTrade.type === 'add' ? '卖出' : '买入' }}</span>
          </div>
          <div class="dlg-field">
            <label class="dlg-label">股票代码</label>
            <span class="dlg-value">{{ editStockCode }}</span>
          </div>
          <div class="dlg-field">
            <label class="dlg-label">成交数量（股）</label>
            <input v-model="editQuantity" type="number" inputmode="numeric" class="dlg-input num-mono" placeholder="0" />
          </div>
          <div class="dlg-field">
            <label class="dlg-label">成交金额（不含费）</label>
            <input v-model="editAmount" type="number" inputmode="decimal" class="dlg-input num-mono" @input="onEditAmountChange" />
          </div>
          <div class="dlg-field">
            <label class="dlg-label">手续费（{{ editingTrade?.type === 'add' ? '0.5954' : '0.0854' }}‰ 最低5元）</label>
            <span class="dlg-value num-mono">{{ formatMoney(editFee) }}</span>
          </div>
          <div class="dlg-field">
            <label class="dlg-label">交易日期</label>
            <input v-model="editDate" type="date" class="dlg-input" />
          </div>
          <div class="dlg-field">
            <label class="dlg-label">备注</label>
            <input v-model="editNote" type="text" class="dlg-input" placeholder="备注" />
          </div>
          <div class="dlg-btns">
            <button class="d-cancel" @click="editingTrade = null">取消</button>
            <button class="d-ok" @click="saveEditTrade">✅ 保存</button>
          </div>
        </div>
      </div>

      <!-- 删除确认弹窗 -->
      <div v-if="deletingTrade" class="overlay" @click.self="deletingTrade = null">
        <div class="dialog">
          <div class="dlg-title">⚠️ 确认删除交易</div>
          <div class="dlg-info">此操作不可撤销！</div>
          <div class="dlg-rows">
            <div class="dlg-row">
              <span>{{ deletingTrade.type === 'add' ? '卖出' : '买入' }}</span>
              <span class="num-mono">{{ formatMoney(deletingTrade.amount) }}</span>
            </div>
            <div v-if="deletingTrade.stock_code" class="dlg-row">
              <span>股票</span>
              <span>{{ deletingTrade.stock_code }} {{ deletingTrade.stock_name }}</span>
            </div>
            <div v-if="deletingTrade.pool_name" class="dlg-row">
              <span>子池</span>
              <span>{{ deletingTrade.pool_name }}</span>
            </div>
            <div v-if="deletingTrade.note" class="dlg-row">
              <span>备注</span>
              <span>{{ deletingTrade.note }}</span>
            </div>
          </div>
          <div class="dlg-warn">⚠️ 删除后将同步删除关联交易、更新持仓和可用资金，不可恢复！</div>
          <div class="dlg-btns">
            <button class="d-cancel" @click="deletingTrade = null">取消</button>
            <button class="d-ok del" @click="doDeleteTrade">🗑️ 确认删除</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { usePoolStore } from '@/stores/pools'
import { useTransactionStore } from '@/stores/transactions'
import { useHoldingStore } from '@/stores/holdings'
import { useFundStore } from '@/stores/funds'
import { calcNewCostPrice } from '@/utils/calculators'
import { formatMoney, formatPrice } from '@/utils/formatters'
import { calcCostPrice, calcBuyActual, calcSellActual, calcBuyFee, calcSellFee } from '@/utils/feeCalculator'
import { upsertHolding, deleteHolding, insertCapitalLog, deleteCapitalLog, updateCapitalLog, updateTransaction, deleteTransaction, fetchTransactionsByPoolStock, loadPoolAllocation } from '@/api/supabase'
import StockSearch from '@/components/trade/StockSearch.vue'
import TradeForm from '@/components/trade/TradeForm.vue'

const route = useRoute()
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
const poolAmounts = reactive(loadLocalAlloc() || defaultAlloc())

const isSell = ref(false)
const currentPrice = ref(0)
const stockCode = ref('')
const stockName = ref('')
const formError = ref('')
const submitting = ref(false)

// ===== 买入 =====
async function onBuySubmit(data) {
  formError.value = ''
  if (!stockCode.value) { formError.value = '请先搜索并选择股票代码'; return }
  const pool = poolStore.pools.find(p => p.id === data.pool_id)
  if (pool) {
    const poolCost = holdingStore.holdings.filter(h => h.pool_id === data.pool_id).reduce((s, h) => s + h.cost_price * h.quantity, 0)
    let available
    if (pool.name === '公共池') {
      const totalCost = holdingStore.holdings.reduce((s, h) => s + h.cost_price * h.quantity, 0)
      const totalAvailable = fundStore.totalCapital - totalCost
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
    const { fee, actualAmount } = calcActualAmount(amount)
    const tx = { pool_id: data.pool_id, stock_code: stockCode.value, stock_name: stockName.value, type: 'buy', quantity: qty, price, amount, fee, status: 'verified', actual_amount: actualAmount, trade_date: data.trade_date, note: data.note || `买入 ${stockCode.value}`, created_by: 'admin' }
    await txStore.addTransaction(tx)
    const existing = holdingStore.holdings.find(h => h.pool_id === data.pool_id && h.stock_code === stockCode.value)
    const newCost = calcNewCostPrice(actualAmount, qty, existing?.quantity || 0, existing?.cost_price || 0)
    await upsertHolding({ pool_id: data.pool_id, stock_code: stockCode.value, stock_name: stockName.value, quantity: (existing?.quantity || 0) + qty, cost_price: newCost })
    await insertCapitalLog({ pool_id: data.pool_id, type: 'remove', amount: actualAmount, note: `买入 ${stockCode.value}`, created_by: 'admin' })
    await Promise.all([holdingStore.loadHoldings(), fundStore.loadCapitalLogs()])
    const { saveCurrentPositionSnapshot } = await import('@/utils/positionSnapshot')
    saveCurrentPositionSnapshot().catch(e => console.error('Snapshot:', e))
    stockCode.value = ''; stockName.value = ''; currentPrice.value = 0; formError.value = ''
  } catch (e) { console.error('Buy error:', e); formError.value = '提交失败：' + e.message } finally { submitting.value = false }
}

function onStockSelected(stock) { currentPrice.value = stock.price; stockCode.value = stock.stock_code; stockName.value = stock.stock_name || '' }

// ===== 卖出（多池联动滑块） =====
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
      if (remaining <= 0) await deleteHolding(e.pool_id, stockCode.value)
      else await upsertHolding({ pool_id: e.pool_id, stock_code: stockCode.value, stock_name: existing?.stock_name || stockName.value, quantity: remaining, cost_price: existing?.cost_price || 0 })
      await insertCapitalLog({ pool_id: e.pool_id, type: 'add', amount: actualAmount, note: `卖出 ${stockCode.value}`, created_by: 'admin' })
    }
    await Promise.all([holdingStore.loadHoldings(), fundStore.loadCapitalLogs()])
    const { saveCurrentPositionSnapshot } = await import('@/utils/positionSnapshot')
    saveCurrentPositionSnapshot().catch(e => console.error('Snapshot:', e))
    resetSell()
  } catch (e) { console.error('Sell error:', e); formError.value = '提交失败：' + e.message } finally { submitting.value = false }
}

function resetSell() {
  sellTotalQty.value = 0; sellPrice.value = 0; sellEntries.value = []; stockCode.value = ''; stockName.value = ''; currentPrice.value = 0; formError.value = ''
}

function poolColor(name) { const map = { '公共池': '#0f3460', '春': '#e94560', '维': '#00d2a1', '队': '#ffc107', '回': '#7c4dff' }; return map[name] || '#0f3460' }

// ===== 交易记录 =====
const tradeLogs = computed(() => {
  return fundStore.capitalLogs.filter(l => l.pool_id !== null).map(l => {
    const note = l.note || ''; const parts = note.split(' ')
    const code = parts.length > 1 && /^\d{6}$/.test(parts[parts.length - 1]) ? parts[parts.length - 1] : ''
    const tx = txStore.transactions.find(t => t.pool_id === l.pool_id && code && (t.stock_code === code) && (Math.abs(t.amount - l.amount) < 0.01 || Math.abs((t.actual_amount || t.amount) - l.amount) < 0.01))
    return { ...l, stock_code: code, stock_name: tx?.stock_name || '', quantity: tx?.quantity || 0, fee: tx?.fee || 0, trade_date: tx?.trade_date || l.created_at, pool_name: poolStore.pools.find(p => p.id === l.pool_id)?.name || '' }
  }).sort((a, b) => new Date(b.trade_date) - new Date(a.trade_date))
})
function formatDateString(isoStr) { if (!isoStr) return ''; const d = new Date(isoStr); return `${d.getMonth()+1}/${d.getDate()}` }

// ===== 编辑/删除 =====
const editingTrade = ref(null); const editAmount = ref(''); const editNote = ref(''); const editQuantity = ref(''); const editStockCode = ref(''); const editDate = ref(''); const deletingTrade = ref(null)
const editFee = ref(0)
const FEE_RATE_DISPLAY = '0.0854'

function editFeeFn(isSell) { return isSell ? calcSellFee : calcBuyFee }

function onEditAmountChange() {
  const amt = parseFloat(editAmount.value) || 0
  const isSell = editingTrade.value?.type === 'add'
  editFee.value = amt > 0 ? editFeeFn(isSell)(amt) : 0
}

async function startEditTrade(log) {
  editingTrade.value = log; editNote.value = log.note || ''; editQuantity.value = ''; editStockCode.value = log.stock_code || ''; editDate.value = ''
  // 还原不含手续费的成交金额（买入含费、卖出扣费）
  const isSell = log.type === 'add'
  const baseAmount = isSell ? log.amount + (log.fee || 0) : log.amount - (log.fee || 0)
  editAmount.value = String(baseAmount > 0 ? baseAmount : log.amount)
  editFee.value = log.fee || editFeeFn(isSell)(parseFloat(editAmount.value) || 0)
  if (log.stock_code) {
    try { const txs = await fetchTransactionsByPoolStock(log.pool_id, log.stock_code); const match = txs.find(t => (Math.abs(t.amount - log.amount) < 0.01 || Math.abs((t.actual_amount || t.amount) - log.amount) < 0.01)); if (match) { editQuantity.value = String(match.quantity); editDate.value = match.trade_date || '' } } catch (e) {}
  }
}
async function saveEditTrade() {
  if (!editingTrade.value) return; const amount = parseFloat(editAmount.value); if (!amount || amount <= 0) return
  const log = editingTrade.value; const stockCode = editStockCode.value; const newQty = parseInt(editQuantity.value) || 0
  try {
    if (stockCode) {
      const allTxs = await fetchTransactionsByPoolStock(log.pool_id, stockCode); const matchedTx = allTxs.find(t => (Math.abs(t.amount - log.amount) < 0.01 || Math.abs((t.actual_amount || t.amount) - log.amount) < 0.01))
      if (matchedTx && newQty > 0) {
        const isSellEdit = log.type === 'add'
        const fee = editFeeFn(isSellEdit)(amount)
        const actualAmount = isSellEdit ? parseFloat((amount - fee).toFixed(2)) : parseFloat((amount + fee).toFixed(2))
        const newPrice = amount / newQty; const txUpdates = { quantity: newQty, amount, price: newPrice, fee, actual_amount: actualAmount }; if (editDate.value) txUpdates.trade_date = editDate.value
        await updateTransaction(matchedTx.id, txUpdates); txStore.transactions = txStore.transactions.map(t => t.id === matchedTx.id ? { ...t, ...txUpdates } : t)
        const isBuy = log.type === 'remove'; const otherTxs = allTxs.filter(t => t.id !== matchedTx.id)
        const allCalculated = [...otherTxs, { ...matchedTx, quantity: newQty, amount, price: newPrice, type: isBuy ? 'buy' : 'sell' }]
        let totalBuyQty = 0, totalBuyAmt = 0; for (const tx of allCalculated) { if (tx.type === 'buy') { totalBuyQty += tx.quantity; totalBuyAmt += tx.amount } }
        const newCostPrice = totalBuyQty > 0 ? totalBuyAmt / totalBuyQty : 0; const netQty = allCalculated.reduce((s, tx) => s + (tx.type === 'buy' ? tx.quantity : -tx.quantity), 0)
        if (netQty <= 0) await deleteHolding(log.pool_id, stockCode)
        else await upsertHolding({ pool_id: log.pool_id, stock_code: stockCode, stock_name: matchedTx.stock_name || '', quantity: netQty, cost_price: newCostPrice })
        await holdingStore.loadHoldings()
      }
    }
    const isSellCap = log.type === 'add'
const capFee = editFeeFn(isSellCap)(amount)
const capAmount = isSellCap ? parseFloat((amount - capFee).toFixed(2)) : parseFloat((amount + capFee).toFixed(2))
await updateCapitalLog(log.id, { amount: capAmount, note: editNote.value || '' }); await Promise.all([fundStore.loadCapitalLogs(), txStore.loadTransactions()])
    editingTrade.value = null
  } catch (e) { console.error('Save edit trade error:', e) }
}
function confirmDeleteTrade(log) { deletingTrade.value = log }
async function doDeleteTrade() {
  if (!deletingTrade.value) return; const log = deletingTrade.value
  try {
    const { id, pool_id, amount } = log; const code = log.stock_code
    if (code) {
      const allTxs = await fetchTransactionsByPoolStock(pool_id, code); const matchedTx = allTxs.find(t => Math.abs(t.amount - amount) < 0.01 || Math.abs((t.actual_amount || t.amount) - amount) < 0.01)
      if (matchedTx) { await deleteTransaction(matchedTx.id); txStore.transactions = txStore.transactions.filter(t => t.id !== matchedTx.id) }
      const remaining = allTxs.filter(t => t.id !== (matchedTx?.id))
      if (remaining.length === 0) await deleteHolding(pool_id, code)
      else { let totalBuyQty = 0, totalBuyAmt = 0; for (const tx of remaining) { if (tx.type === 'buy') { totalBuyQty += tx.quantity; totalBuyAmt += tx.amount } }; const netQty = remaining.reduce((s, tx) => s + (tx.type === 'buy' ? tx.quantity : -tx.quantity), 0); if (netQty <= 0) await deleteHolding(pool_id, code); else await upsertHolding({ pool_id, stock_code: code, stock_name: matchedTx?.stock_name || '', quantity: netQty, cost_price: totalBuyQty > 0 ? totalBuyAmt / totalBuyQty : 0 }) }
      await holdingStore.loadHoldings()
    }
    await deleteCapitalLog(id); await Promise.all([fundStore.loadCapitalLogs(), txStore.loadTransactions()])
    deletingTrade.value = null
  } catch (e) { console.error('Delete trade error:', e) }
}

// ===== 初始化 =====
onMounted(async () => {
  try {
    const server = await loadPoolAllocation(); if (server) { let s = server; if (s['共有'] !== undefined && s['公共池'] === undefined) { s = { ...s }; s['公共池'] = s['共有']; delete s['共有'] }; for (const k of Object.keys(s)) { if (poolAmounts[k] !== undefined) poolAmounts[k] = s[k] } }
  } catch (e) {}
  await Promise.all([poolStore.loadPools(), fundStore.loadCapitalLogs(), txStore.loadTransactions(), holdingStore.loadHoldings()])
  if (route.query.code) {
    isSell.value = true
    stockCode.value = route.query.code; stockName.value = route.query.name || ''; currentPrice.value = parseFloat(route.query.price) || 0
    initSellEntries()
  }
})
function initSellEntries() {
  sellTotalQty.value = 0
  sellPrice.value = currentPrice.value
  sellEntries.value = sellHoldingPools.value.map(h => ({ pool_id: h.pool_id, pool_name: h.pool_name, holding_qty: h.holding_qty, max_sell: h.holding_qty, sell_qty: 0 }))
}
</script>

<style scoped>
.search-section-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }
.preset-section { border-left: 3px solid var(--color-fall); }
.preset-name { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
.preset-code { font-size: 13px; color: var(--text-secondary); font-weight: 400; }
.preset-info { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-secondary); }
.form-err { color: var(--color-fall); font-size: 13px; text-align: center; margin-top: 8px; }
.section-title { font-size: 13px; font-weight: 600; padding: 0 0 10px; }

.sell-empty { font-size: 12px; color: var(--text-muted); padding: 8px 0; }
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
.sell-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 24px; height: 24px; border-radius: 50%; background: var(--color-rise); cursor: pointer; border: 2px solid #fff; }
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

.trade-log-list { display: flex; flex-direction: column; gap: 2px; }
.trade-log-item { padding: 12px 14px; background: var(--bg-card); display: flex; gap: 8px; align-items: center; cursor: pointer; }
.trade-log-item:active { background: rgba(255,255,255,0.06); }
.tli-body { flex: 1; min-width: 0; }
.tli-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
.tli-action { font-size: 14px; font-weight: 600; font-family: var(--font-number); }
.tli-action.rise { color: var(--color-rise); }
.tli-action.fall { color: var(--color-fall); }
.tli-name { font-size: 12px; color: var(--text-secondary); }
.tli-qty { font-size: 11px; color: var(--text-muted); }
.tli-fee { font-size: 11px; color: var(--text-muted); }
.tli-meta { font-size: 11px; color: var(--text-muted); display: flex; gap: 4px; flex-wrap: wrap; align-items: baseline; }
.tli-arrow { font-size: 16px; color: var(--text-muted); opacity: 0.3; flex-shrink: 0; }
.swipe-actions { display: flex; height: 100%; }
.swipe-edit-btn { width: 70px; border: none; background: var(--bg-accent); color: #fff; font-size: 13px; font-weight: 500; cursor: pointer; }
.swipe-del-btn { width: 70px; border: none; background: var(--color-fall); color: #fff; font-size: 13px; font-weight: 500; cursor: pointer; }

.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; }
.dialog { background: var(--bg-card); border-radius: var(--radius-lg); padding: 20px; width: 100%; max-width: 360px; }
.dlg-title { font-size: 17px; font-weight: 700; margin-bottom: 16px; }
.dlg-field { margin-bottom: 12px; }
.dlg-label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.dlg-value { font-size: 14px; color: var(--text-primary); }
.dlg-input { width: 100%; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-md); background: rgba(255,255,255,0.04); color: #fff; font-size: 15px; outline: none; box-sizing: border-box; }
.dlg-input:focus { border-color: var(--bg-accent); }
.dlg-input.num-mono { font-family: var(--font-number); }
.dlg-btns { display: flex; gap: 10px; margin-top: 16px; }
.dlg-info { font-size: 14px; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.6; }
.d-cancel { flex: 1; padding: 10px; border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-md); background: transparent; color: var(--text-secondary); font-size: 14px; cursor: pointer; }
.d-ok { flex: 2; padding: 10px; border: none; border-radius: var(--radius-md); background: var(--bg-accent); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
.d-ok.del { background: var(--color-fall); }
.dlg-rows { margin-bottom: 8px; }
.dlg-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.03); }
.dlg-warn { font-size: 11px; color: var(--color-warn); padding: 6px 0; text-align: center; }
</style>
