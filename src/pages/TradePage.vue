<template>
  <div class="page trade-page">
    <div class="page-header">
      <span class="page-title">{{ isSell ? '录入卖出' : '交易记录' }}</span>
    </div>

    <!-- 买入表单 -->
    <template v-if="!isSell">
      <div class="section-card">
        <StockSearch @stock-selected="onStockSelected" @buy-clicked="onBuyClicked" />
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
    </template>

    <!-- 历史买卖记录 -->
    <div class="section-card" v-if="!isSell && tradeLogs.length">
      <div class="section-title trade-rec-title">
        股票交易记录
        <span class="swipe-hint">◀ 左滑编辑</span>
      </div>

      <!-- 按股票过滤 -->
      <div class="filter-row">
        <span class="rec-all-tag" :class="{ active: !filterStockCode }" @click="clearFilter">全部</span>
        <div class="filter-input-wrap">
          <van-field
            v-model="filterQuery"
            placeholder="输入名称首字母/代码过滤"
            maxlength="20"
            :border="false"
            class="filter-input"
            @update:model-value="onFilterInput"
            @focus="onFilterFocus"
            @blur="onFilterBlur"
          />
          <span v-if="filterStockCode" class="filter-clear" @click="clearFilter">✕</span>
          <div v-if="showFilterDropdown" class="filter-dropdown">
            <div
              v-for="item in filterSuggestions"
              :key="item.stock_code"
              class="filter-sugg-item"
              @mousedown.prevent="selectFilterStock(item)"
              @touchstart.prevent="selectFilterStock(item)"
            >
              <span class="fs-name">{{ item.stock_name }}</span>
              <span class="fs-code num-mono">{{ item.stock_code }}</span>
              <span class="fs-count">{{ item.count }}条</span>
            </div>
            <div v-if="!filterSuggestions.length" class="fs-empty">未找到已交易股票</div>
          </div>
        </div>
      </div>

      <div v-if="filterStockCode" class="filter-summary">
        {{ filterStockName }}（{{ filterStockCode }}）共 {{ filteredLogs.length }} 条记录
      </div>

      <div v-if="!filteredLogs.length" class="filter-empty">该股票暂无交易记录</div>
      <div v-else class="trade-log-list">
        <van-swipe-cell v-for="log in displayedLogs" :key="log.id" :right-width="140">
          <div class="trade-log-item">
            <div class="tli-body">
              <div class="tli-header">
                <span class="tli-action" :class="log.type === 'add' ? 'rise' : 'fall'">
                  {{ log.type === 'add' ? '卖出' : '买入' }} {{ log.stock_code }}
                </span>
                <span class="tli-name">{{ log.stock_name }}</span>
                <span v-if="log.quantity" class="tli-qty">{{ log.quantity }}股</span>
              </div>
              <div class="tli-meta">
                <span>@{{ formatPrice(log.price) }}</span>
                <span> · {{ formatMoney(log.amount) }}</span>
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
      <div v-if="filteredLogs.length > 10" class="log-toggle" @click="showAllLogs = !showAllLogs">
        {{ showAllLogs ? '▲ 收起' : '▼ 展开全部（' + filteredLogs.length + ' 条）' }}
      </div>
    </div>

    <!-- 编辑交易弹窗 -->
    <teleport to="body">
      <div v-if="editingTrade" class="overlay" @click.self="editingTrade = null">
        <div class="dialog">
          <div class="dlg-title">编辑交易记录</div>
          <div class="dlg-row-flex">
            <div class="dlg-field dlg-half">
              <label class="dlg-label">类型</label>
              <span class="dlg-value">{{ editingTrade.type === 'add' ? '卖出' : '买入' }}</span>
            </div>
            <div class="dlg-field dlg-half">
              <label class="dlg-label">股票代码</label>
              <span class="dlg-value">{{ editStockCode }}</span>
            </div>
          </div>
          <div class="dlg-row-flex">
            <div class="dlg-field dlg-half">
              <label class="dlg-label">子池</label>
              <select v-model="editPoolId" class="dlg-input">
                <option v-for="p in poolStore.allPools" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </div>
            <div class="dlg-field dlg-half">
              <label class="dlg-label">成交单价</label>
              <input v-model="editPrice" type="number" inputmode="decimal" class="dlg-input num-mono" step="0.001" @input="onEditPriceOrQtyChange" />
            </div>
          </div>
          <div class="dlg-field">
            <label class="dlg-label">成交数量（股）</label>
            <input v-model="editQuantity" type="number" inputmode="numeric" class="dlg-input num-mono" placeholder="0" @input="onEditPriceOrQtyChange" />
          </div>
          <div class="dlg-row-flex">
            <div class="dlg-field dlg-half">
              <label class="dlg-label">成交金额（{{ formatMoney(editComputedAmount) }}）</label>
              <span class="dlg-value num-mono">含费 {{ formatMoney(editComputedActual) }}</span>
            </div>
            <div class="dlg-field dlg-half">
              <label class="dlg-label">手续费（{{ editingTrade?.type === 'add' ? '0.5954' : '0.0854' }}‰）</label>
              <span class="dlg-value num-mono">{{ formatMoney(editFee) }}</span>
            </div>
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

      <!-- 买入股票弹窗 -->
      <div v-if="showBuyModal" class="overlay" @click.self="showBuyModal = false">
        <div class="dialog buy-dialog">
          <div class="buy-dlg-header">
            <span class="buy-dlg-title">📈 买入 {{ stockName || stockCode }}</span>
            <span class="buy-dlg-price num-mono" v-if="currentPrice">{{ formatPrice(currentPrice) }}</span>
            <button class="buy-dlg-close" @click="showBuyModal = false">✕</button>
          </div>
          <TradeForm
            ref="formRef"
            :pools="poolStore.pools"
            :is-buy="true"
            :stock-price="currentPrice"
            :submitting="submitting"
            @submit="onBuySubmit"
          />
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
import { calcBuyActual, calcSellActual, calcBuyFee, calcSellFee } from '@/utils/feeCalculator'
import { upsertHolding, deleteHolding, insertCapitalLog, deleteCapitalLog, updateCapitalLog, updateTransaction, deleteTransaction, fetchTransactionsByPoolStock, loadPoolAllocation } from '@/api/supabase'
import StockSearch from '@/components/trade/StockSearch.vue'
import TradeForm from '@/components/trade/TradeForm.vue'
import { matchTradedStocks } from '@/api/stock'

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
const showBuyModal = ref(false)

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
    const { saveCurrentPositionSnapshot } = await import('@/utils/positionSnapshot')
    saveCurrentPositionSnapshot().catch(e => console.error('Snapshot:', e))
    stockCode.value = ''; stockName.value = ''; currentPrice.value = 0; formError.value = ''; showBuyModal.value = false
  } catch (e) { console.error('Buy error:', e); formError.value = '提交失败：' + e.message } finally { submitting.value = false }
}

function onStockSelected(stock) { currentPrice.value = stock.price; stockCode.value = stock.stock_code; stockName.value = stock.stock_name || '' }

function onBuyClicked(stock) {
  onStockSelected(stock)
  showBuyModal.value = true
}

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
const showAllLogs = ref(false)
const tradeLogs = computed(() => {
  return fundStore.capitalLogs.filter(l => l.pool_id !== null).map(l => {
    const note = l.note || ''; const parts = note.split(' ')
    const code = parts.length > 1 && /^\d{6}$/.test(parts[parts.length - 1]) ? parts[parts.length - 1] : ''
    const tx = txStore.transactions.find(t => t.pool_id === l.pool_id && code && (t.stock_code === code) && (Math.abs(t.amount - l.amount) < 0.01 || Math.abs((t.actual_amount || t.amount) - l.amount) < 0.01))
    return { ...l, stock_code: code, stock_name: tx?.stock_name || '', quantity: tx?.quantity || 0, price: tx?.price || 0, fee: tx?.fee || 0, trade_date: tx?.trade_date || l.created_at, pool_name: poolStore.pools.find(p => p.id === l.pool_id)?.name || '' }
  }).sort((a, b) => new Date(b.trade_date) - new Date(a.trade_date))
})

// ===== 按股票过滤交易记录 =====
const filterQuery = ref('')
const filterStockCode = ref('')
const filterStockName = ref('')
const showFilterDropdown = ref(false)
const filterSuggestions = ref([])
let filterReqId = 0

// 已交易过的股票（联想只匹配这些）
const tradedStocks = computed(() => {
  const byCode = new Map()
  for (const l of tradeLogs.value) {
    if (!l.stock_code) continue
    if (!byCode.has(l.stock_code)) byCode.set(l.stock_code, { code: l.stock_code, name: '', count: 0 })
    const t = byCode.get(l.stock_code)
    t.count++
    if (!t.name && l.stock_name) t.name = l.stock_name
  }
  return [...byCode.values()]
})

async function onFilterInput() {
  const q = filterQuery.value.trim()
  if (!q) { filterSuggestions.value = []; showFilterDropdown.value = false; return }
  const reqId = ++filterReqId
  const codes = tradedStocks.value.map(t => t.code)
  const countOf = code => tradedStocks.value.find(t => t.code === code)?.count || 0
  const results = await matchTradedStocks(codes, q)
  if (reqId !== filterReqId) return  // 过期请求丢弃
  if (results === null) {
    // 本地股票列表不可用，降级为子串匹配
    const ql = q.toLowerCase()
    filterSuggestions.value = tradedStocks.value
      .filter(t => t.code.includes(ql) || t.name.toLowerCase().includes(ql))
      .map(t => ({ stock_code: t.code, stock_name: t.name, count: t.count }))
  } else {
    filterSuggestions.value = results.map(r => ({
      stock_code: r.stock_code,
      stock_name: r.stock_name,
      count: countOf(r.stock_code)
    }))
  }
  showFilterDropdown.value = filterSuggestions.value.length > 0
}

function onFilterFocus() {
  if (filterQuery.value.trim() && filterSuggestions.value.length) showFilterDropdown.value = true
}
function onFilterBlur() {
  setTimeout(() => { showFilterDropdown.value = false }, 150)
}

function selectFilterStock(item) {
  filterStockCode.value = item.stock_code
  filterStockName.value = item.stock_name || item.stock_code
  filterQuery.value = item.stock_name || item.stock_code
  showFilterDropdown.value = false
  showAllLogs.value = false
}

function clearFilter() {
  filterStockCode.value = ''
  filterStockName.value = ''
  filterQuery.value = ''
  filterSuggestions.value = []
  showFilterDropdown.value = false
  showAllLogs.value = false
}

const filteredLogs = computed(() => {
  if (!filterStockCode.value) return tradeLogs.value
  return tradeLogs.value.filter(l => l.stock_code === filterStockCode.value)
})

const displayedLogs = computed(() => {
  const base = filteredLogs.value
  return showAllLogs.value ? base : base.slice(0, 10)
})

function formatDateString(isoStr) { if (!isoStr) return ''; const d = new Date(isoStr); return `${d.getMonth()+1}/${d.getDate()}` }

// ===== 编辑/删除 =====
const editingTrade = ref(null); const editPrice = ref(''); const editNote = ref(''); const editQuantity = ref(''); const editStockCode = ref(''); const editDate = ref(''); const editPoolId = ref(null); const deletingTrade = ref(null)
const editFee = ref(0)
const editComputedAmount = ref(0)
const editComputedActual = ref(0)
const FEE_RATE_DISPLAY = '0.0854'

function editFeeFn(isSell) { return isSell ? calcSellFee : calcBuyFee }

function onEditPriceOrQtyChange() {
  const price = parseFloat(editPrice.value) || 0
  const qty = parseInt(editQuantity.value) || 0
  const amount = price * qty
  editComputedAmount.value = amount
  const isSell = editingTrade.value?.type === 'add'
  editFee.value = amount > 0 ? editFeeFn(isSell)(amount) : 0
  editComputedActual.value = amount > 0 ? (isSell ? amount - editFee.value : amount + editFee.value) : 0
}

async function startEditTrade(log) {
  editingTrade.value = log; editNote.value = log.note || ''; editQuantity.value = ''; editStockCode.value = log.stock_code || ''; editDate.value = ''
  editPoolId.value = log.pool_id
  editPrice.value = ''; editFee.value = 0; editComputedAmount.value = 0; editComputedActual.value = 0
  if (log.stock_code) {
    try {
      const txs = await fetchTransactionsByPoolStock(log.pool_id, log.stock_code)
      const match = txs.find(t => (Math.abs(t.amount - log.amount) < 0.01 || Math.abs((t.actual_amount || t.amount) - log.amount) < 0.01))
      if (match) {
        editQuantity.value = String(match.quantity)
        editDate.value = match.trade_date || ''
        editPrice.value = String(match.price || (match.quantity > 0 ? (match.amount / match.quantity).toFixed(3) : ''))
      }
    } catch (e) {}
  }
  onEditPriceOrQtyChange()
}

// 提取持仓重算逻辑
async function recalcHoldingsForPool(poolId, stockCode, stockName) {
  const allTxs = await fetchTransactionsByPoolStock(poolId, stockCode)
  if (allTxs.length === 0) {
    await deleteHolding(poolId, stockCode)
    return
  }
  let totalBuyQty = 0, totalBuyAmt = 0, netQty = 0
  for (const tx of allTxs) {
    if (tx.type === 'buy') { totalBuyQty += tx.quantity; totalBuyAmt += tx.amount }
    netQty += tx.type === 'buy' ? tx.quantity : -tx.quantity
  }
  if (netQty <= 0) {
    await deleteHolding(poolId, stockCode)
  } else {
    const costPrice = totalBuyQty > 0 ? totalBuyAmt / totalBuyQty : 0
    await upsertHolding({ pool_id: poolId, stock_code: stockCode, stock_name: stockName || '', quantity: netQty, cost_price: costPrice })
  }
}

async function saveEditTrade() {
  if (!editingTrade.value) return
  const price = parseFloat(editPrice.value); const newQty = parseInt(editQuantity.value) || 0
  if (!price || price <= 0 || !newQty) return
  const amount = parseFloat((price * newQty).toFixed(2))
  const log = editingTrade.value; const stockCode = editStockCode.value; const newPoolId = editPoolId.value; const oldPoolId = log.pool_id
  const poolChanged = newPoolId && newPoolId !== oldPoolId

  try {
    if (stockCode) {
      const allTxs = await fetchTransactionsByPoolStock(oldPoolId, stockCode)
      const matchedTx = allTxs.find(t => (Math.abs(t.amount - log.amount) < 0.01 || Math.abs((t.actual_amount || t.amount) - log.amount) < 0.01))
      if (matchedTx) {
        const isSell = log.type === 'add'
        const fee = editFeeFn(isSell)(amount)
        const actualAmount = isSell ? parseFloat((amount - fee).toFixed(2)) : parseFloat((amount + fee).toFixed(2))
        const txUpdates = { quantity: newQty, amount, price, fee, actual_amount: actualAmount }
        if (editDate.value) txUpdates.trade_date = editDate.value
        if (poolChanged) txUpdates.pool_id = newPoolId

        await updateTransaction(matchedTx.id, txUpdates)
        txStore.transactions = txStore.transactions.map(t => t.id === matchedTx.id ? { ...t, ...txUpdates } : t)

        if (poolChanged) {
          await recalcHoldingsForPool(oldPoolId, stockCode, matchedTx.stock_name)
          await recalcHoldingsForPool(newPoolId, stockCode, matchedTx.stock_name)
        } else {
          await recalcHoldingsForPool(oldPoolId, stockCode, matchedTx.stock_name)
        }
        await holdingStore.loadHoldings()

        const capUpdates = { amount: actualAmount, note: editNote.value || '' }
        if (poolChanged) capUpdates.pool_id = newPoolId
        await updateCapitalLog(log.id, capUpdates)

        if (poolChanged) {
          fundStore.capitalLogs = fundStore.capitalLogs.map(c => c.id === log.id ? { ...c, pool_id: newPoolId, amount: actualAmount, note: editNote.value || '' } : c)
        }
      }
    }

    await Promise.all([fundStore.loadCapitalLogs(), txStore.loadTransactions()])
    const { saveCurrentPositionSnapshot } = await import('@/utils/positionSnapshot')
    await saveCurrentPositionSnapshot().catch(e => console.error('Snapshot:', e))
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
      await recalcHoldingsForPool(pool_id, code, matchedTx?.stock_name || '')
      await holdingStore.loadHoldings()
    }
    await deleteCapitalLog(id); await Promise.all([fundStore.loadCapitalLogs(), txStore.loadTransactions()])
    const { saveCurrentPositionSnapshot } = await import('@/utils/positionSnapshot')
    await saveCurrentPositionSnapshot().catch(e => console.error('Snapshot:', e))
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
.buy-section-label { font-size: 17px; font-weight: 700; color: var(--color-rise); margin-bottom: 10px; text-align: center; }
.preset-section { border-left: 3px solid var(--color-fall); }
.preset-name { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
.preset-code { font-size: 13px; color: var(--text-secondary); font-weight: 400; }
.preset-info { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-secondary); }
.form-err { color: var(--color-fall); font-size: 13px; text-align: center; margin-top: 8px; }
.section-title { font-size: 13px; font-weight: 600; padding: 0 0 10px; }

/* ===== 交易记录过滤 ===== */
.trade-rec-title { display: flex; align-items: center; gap: 8px; }
.swipe-hint {
  font-size: 11px;
  background: linear-gradient(135deg, #e94560, #ff6b6b);
  color: #fff;
  padding: 3px 10px;
  border-radius: 12px;
  font-weight: 600;
}
.rec-all-tag { font-size: 11px; padding: 2px 10px; border-radius: 10px; color: var(--text-secondary); background: rgba(255,255,255,0.06); cursor: pointer; flex: 0 0 auto; }
.rec-all-tag.active { color: var(--color-rise); background: rgba(233,69,96,0.12); font-weight: 600; }
.filter-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.filter-input-wrap { position: relative; flex: 1; min-width: 0; }
.filter-input { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-md); padding: 0 34px 0 4px; }
.filter-input :deep(.van-field__control) { font-size: 13px; }
.filter-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 14px; color: var(--text-muted); padding: 4px; cursor: pointer; z-index: 2; }
.filter-clear:active { opacity: 0.6; }
.filter-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20; background: #1c1c22; border: 1px solid rgba(255,255,255,0.12); border-radius: var(--radius-md); overflow: hidden; box-shadow: 0 6px 20px rgba(0,0,0,0.4); max-height: 240px; overflow-y: auto; }
.filter-sugg-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer; }
.filter-sugg-item:active { background: rgba(255,255,255,0.06); }
.fs-name { font-size: 13px; font-weight: 600; flex: 0 0 auto; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fs-code { font-size: 12px; color: var(--text-secondary); flex: 0 0 auto; }
.fs-count { font-size: 11px; color: var(--text-muted); margin-left: auto; }
.fs-empty { padding: 14px; text-align: center; font-size: 12px; color: var(--text-muted); }
.filter-summary { font-size: 12px; color: var(--text-secondary); padding: 0 2px 8px; }
.filter-empty { text-align: center; padding: 18px 0; font-size: 13px; color: var(--text-muted); }

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
.sell-fee-row { padding: 8px 10px; background: rgba(255,255,255,0.03); border-radius: var(--radius-md); margin-top: 8px; }
.sfr-item { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; color: var(--text-secondary); }
.sfr-item .num-mono { font-size: 12px; }

.trade-log-list { display: flex; flex-direction: column; gap: 8px; }
.log-toggle { text-align: center; padding: 14px 0 2px; font-size: 12px; color: var(--text-secondary); cursor: pointer; }
.log-toggle:active { opacity: 0.6; }
.trade-log-item { padding: 12px 14px; background: var(--bg-hover); display: flex; gap: 8px; align-items: center; border-radius: var(--radius-md); }
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
.dlg-row-flex { display: flex; gap: 12px; margin-bottom: 12px; }
.dlg-half { flex: 1; min-width: 0; }
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

/* 买入弹窗 */
.buy-dialog { max-width: 380px; }
.buy-dlg-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.buy-dlg-title { font-size: 16px; font-weight: 700; flex: 1; }
.buy-dlg-price { font-size: 18px; font-weight: 700; color: var(--color-rise); }
.buy-dlg-close {
  width: 28px; height: 28px;
  border: none; border-radius: 50%;
  background: rgba(255,255,255,0.08);
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.buy-dlg-close:active { background: rgba(255,255,255,0.15); }
</style>
