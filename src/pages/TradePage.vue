<template>
  <div class="page trade-page">
    <div class="page-header">
      <span class="page-title">{{ isSell ? '卖出' : '录入买入' }}</span>
    </div>

    <!-- step 1: 填写交易信息（买入） -->
    <template v-if="!isSell && !pendingTrades.length">
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
          :submitting="false"
          @submit="onBuySubmit"
        />
        <div v-if="formError" class="form-err">{{ formError }}</div>
      </div>
    </template>

    <!-- step 1: 填写交易信息（卖出-多池联动） -->
    <template v-if="isSell && !pendingTrades.length">
      <div class="section-card preset-section">
        <div class="preset-name">{{ stockName }} <span class="preset-code">{{ stockCode }}</span></div>
        <div class="preset-info">
          <span>现价 {{ formatPrice(currentPrice) }}</span>
          <span>总持仓 {{ sellTotalHolding }} 股</span>
        </div>
      </div>
      <div class="section-card">
        <div class="sell-total-row">
          <div class="stl-header">
            <span class="stl-label">卖出总量</span>
            <span class="stl-val num-mono">{{ sellTotalQty }} 股</span>
          </div>
          <input
            type="range"
            :min="0"
            :max="sellTotalHolding"
            :step="100"
            v-model.number="sellTotalQty"
            class="sell-slider"
            @input="onTotalSliderChange"
          />
          <div class="stl-estimate" v-if="sellTotalQty > 0">
            ≈ {{ formatMoney(sellTotalQty * currentPrice) }}
          </div>
        </div>
        <div v-if="sellTotalQty > 0" class="sell-pools-section">
          <div class="section-title">各池分配</div>
          <div v-for="entry in sellEntries" :key="entry.pool_id" class="sell-pool-row">
            <div class="spr-header">
              <span class="spr-pool-name" :style="{ color: poolColor(entry.pool_name) }">{{ entry.pool_name }}</span>
              <span class="spr-holding">持有 <span class="num-mono">{{ entry.holding_qty }}</span> 股</span>
            </div>
            <input
              type="range"
              :min="0"
              :max="entry.max_sell"
              :step="100"
              v-model.number="entry.sell_qty"
              class="sell-slider"
              @input="onPoolSliderChange(entry)"
            />
            <div class="spr-bottom">
              <span class="num-mono">{{ entry.sell_qty }} 股</span>
              <span class="spr-estimate" v-if="entry.sell_qty > 0">≈ {{ formatMoney(entry.sell_qty * currentPrice) }}</span>
            </div>
          </div>
          <div v-if="sellRemaining > 0" class="sell-remaining">
            待分配 <span class="num-mono">{{ sellRemaining }}</span> 股
          </div>
        </div>
        <div class="sell-date-row">
          <label class="sdr-label">成交日期</label>
          <input v-model="sellDate" type="date" class="sdr-input" />
        </div>
        <div style="margin: 16px 0">
          <van-button
            round block type="primary"
            :color="sellValid ? 'var(--color-rise)' : '#666'"
            :disabled="!sellValid"
            @click="submitSell"
          >
            📝 录入卖出（{{ sellTotalQty }} 股）
          </van-button>
        </div>
        <div v-if="formError" class="form-err">{{ formError }}</div>
      </div>
    </template>

    <!-- step 2: 校对（买入） -->
    <template v-if="pendingBuy">
      <div class="verify-required">
        <div class="vr-title">⚠️ 必须核实券商实际成交金额</div>
        <div class="vr-info">
          <div class="vr-row">
            <span>{{ pendingBuy.stock_name || pendingBuy.stock_code }}</span>
            <span class="num-mono">{{ formatPrice(pendingBuy.price) }} × {{ pendingBuy.quantity }} 股</span>
          </div>
          <div class="vr-row">
            <span>买入总金额（预估）</span>
            <span class="num-mono">{{ formatMoney(pendingBuy.amount) }}</span>
          </div>
        </div>
        <div class="verify-input-row">
          <span class="vr-label">券商实际成交金额</span>
          <input v-model="buyActualAmount" type="number" inputmode="decimal" placeholder="输入券商APP里的真实金额" class="verify-input num-mono" />
          <span>元</span>
        </div>
        <div v-if="buyActualAmount" class="verify-diff" :class="buyDiff > 0 ? 'fall' : 'rise'">
          差额 {{ buyDiff > 0 ? '+' : '' }}{{ formatMoney(Math.abs(buyDiff)) }}（手续费）
        </div>
        <div class="verify-btns">
          <button class="v-btn cancel" @click="cancelBuy">取消</button>
          <button class="v-btn confirm" :disabled="!buyActualAmount || submitting" @click="confirmBuy">
            ✅ {{ submitting ? '提交中…' : '确认并记录' }}
          </button>
        </div>
      </div>
    </template>

    <!-- step 2: 校对（卖出-多池批量） -->
    <template v-if="pendingTrades.length">
      <div class="verify-required">
        <div class="vr-title">⚠️ 核实券商实际成交金额</div>
        <div class="vr-info">
          <div class="vr-row">
            <span>{{ stockName }} {{ stockCode }}</span>
            <span class="num-mono">共 {{ sellTotalQty }} 股</span>
          </div>
          <div class="vr-row">
            <span>预估总金额</span>
            <span class="num-mono">{{ formatMoney(pendingTotalAmount) }}</span>
          </div>
        </div>
        <div v-for="(pt, idx) in pendingTrades" :key="pt.pool_id" class="sell-verify-row">
          <div class="svr-header">
            <span class="svr-pool" :style="{ color: poolColor(pt.pool_name) }">{{ pt.pool_name }}</span>
            <span class="num-mono">{{ pt.quantity }} 股 × {{ formatPrice(priceForTrade(pt)) }}</span>
          </div>
          <div class="verify-input-row">
            <span class="vr-label">实际成交</span>
            <input v-model="pt._actual" type="number" inputmode="decimal" placeholder="券商实际金额" class="verify-input num-mono" />
            <span>元</span>
          </div>
        </div>
        <div class="verify-btns">
          <button class="v-btn cancel" @click="cancelSell">取消</button>
          <button class="v-btn confirm" :disabled="!allSellVerified || submitting" @click="confirmSell">
            ✅ {{ submitting ? '提交中…' : '确认并记录 ' + sellTotalQty + ' 股' }}
          </button>
        </div>
      </div>
    </template>

    <!-- 历史买卖记录 -->
    <div class="section-card" v-if="tradeLogs.length">
      <div class="section-title">股票交易记录</div>
      <div class="trade-log-list">
        <div v-for="log in tradeLogs" :key="log.id" class="trade-log-item">
          <div class="tli-body">
            <div class="tli-header">
              <span class="tli-action" :class="log.type === 'add' ? 'rise' : 'fall'">
                {{ log.type === 'add' ? '卖出' : '买入' }} {{ log.stock_code }}
              </span>
              <span class="tli-name">{{ log.stock_name }}</span>
              <span v-if="log.quantity" class="tli-qty">{{ log.quantity }}股</span>
            </div>
            <div class="tli-meta">
              <span>{{ formatMoney(log.amount) }}</span>
              <span> · {{ log.pool_name }}</span>
              <span> · {{ formatDateString(log.trade_date) }}</span>
            </div>
          </div>
          <div class="tli-actions">
            <button class="tli-edit-btn" @click="startEditTrade(log)">✏️</button>
            <button class="tli-del-btn" @click="confirmDeleteTrade(log)">✕</button>
          </div>
        </div>
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
            <label class="dlg-label">金额（元）</label>
            <input v-model="editAmount" type="number" inputmode="decimal" class="dlg-input num-mono" />
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
          <div class="dlg-warn">
            ⚠️ 删除后将同步删除关联交易、更新持仓和可用资金，不可恢复！
          </div>
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
import { upsertHolding, deleteHolding, insertCapitalLog, deleteCapitalLog, updateCapitalLog, updateTransaction, deleteTransaction, fetchTransactionsByPoolStock, loadPoolAllocation } from '@/api/supabase'
import StockSearch from '@/components/trade/StockSearch.vue'
import TradeForm from '@/components/trade/TradeForm.vue'

const route = useRoute()
const poolStore = usePoolStore()
const txStore = useTransactionStore()
const holdingStore = useHoldingStore()
const fundStore = useFundStore()

// 子池分配金额
function loadLocalAlloc() {
  const raw = localStorage.getItem('poolAmounts')
  if (!raw) return null
  const parsed = JSON.parse(raw)
  if (parsed['共有'] !== undefined && parsed['公共池'] === undefined) {
    parsed['公共池'] = parsed['共有']; delete parsed['共有']
  }
  const vals = Object.values(parsed)
  const sum = vals.reduce((s, v) => s + v, 0)
  if (vals.every(v => v <= 100) && Math.abs(sum - 100) < 1) {
    const amt = {}
    for (const k of Object.keys(parsed)) amt[k] = (fundStore.totalCapital || 0) * parsed[k] / 100
    return amt
  }
  return parsed
}
function defaultAlloc() {
  const each = Math.floor((fundStore.totalCapital || 1000000) / 5 / 10000) * 10000
  return { '公共池': each, '春': each, '维': each, '队': each, '回': each }
}
const poolAmounts = reactive(loadLocalAlloc() || defaultAlloc())

const isSell = ref(false)
const currentPrice = ref(0)
const stockCode = ref('')
const stockName = ref('')
const sellPoolId = ref(null)
const sellPoolName = ref('')
const formError = ref('')

// ===== 买入状态 =====
const pendingBuy = ref(null)
const buyActualAmount = ref('')
const buyDiff = computed(() => {
  if (!buyActualAmount.value || !pendingBuy.value) return 0
  return parseFloat(buyActualAmount.value) - pendingBuy.value.amount
})

// ===== 卖出状态（多池联动） =====
const sellDate = ref(new Date().toISOString().split('T')[0])
const sellTotalQty = ref(0)
const sellEntries = ref([])
const pendingTrades = ref([])

const sellHoldingPools = computed(() => {
  if (!stockCode.value) return []
  return holdingStore.holdings
    .filter(h => h.stock_code === stockCode.value && h.quantity > 0)
    .map(h => {
      const pool = poolStore.pools.find(p => p.id === h.pool_id)
      return { pool_id: h.pool_id, pool_name: pool?.name || '', holding_qty: h.quantity }
    })
})

const sellTotalHolding = computed(() =>
  sellHoldingPools.value.reduce((s, h) => s + h.holding_qty, 0)
)

const sellRemaining = computed(() => {
  const allocated = sellEntries.value.reduce((s, e) => s + (e.sell_qty || 0), 0)
  return Math.max(0, sellTotalQty.value - allocated)
})

const sellValid = computed(() => {
  if (sellTotalQty.value <= 0 || sellRemaining.value > 0) return false
  for (const e of sellEntries.value) {
    if (e.sell_qty > e.holding_qty) return false
    if (e.sell_qty % 100 !== 0) return false
  }
  return true
})

// 总量滑块变动 → 按持仓比例分配
let _redistributing = false
function onTotalSliderChange() {
  if (_redistributing) return
  _redistributing = true
  const total = sellTotalQty.value
  // 按持仓比例分配
  let remaining = total
  const entries = sellEntries.value
  for (let i = 0; i < entries.length; i++) {
    if (i === entries.length - 1) {
      entries[i].sell_qty = Math.min(remaining, entries[i].holding_qty)
      entries[i].sell_qty = Math.floor(entries[i].sell_qty / 100) * 100
    } else {
      const ratio = entries[i].holding_qty / sellTotalHolding.value
      let qty = Math.floor(total * ratio / 100) * 100
      qty = Math.min(qty, entries[i].holding_qty)
      entries[i].sell_qty = qty
      remaining -= qty
    }
  }
  updateMaxSliders()
  _redistributing = false
}

// 单池滑块变动 → 重新分配剩余量给其他池
function onPoolSliderChange(changed) {
  if (_redistributing) return
  _redistributing = true
  // 重新计算 total
  const actualTotal = sellEntries.value.reduce((s, e) => s + (e.sell_qty || 0), 0)
  if (actualTotal > sellTotalQty.value) {
    // 该池增加了，从其他池减
    const excess = actualTotal - sellTotalQty.value
    const others = sellEntries.value.filter(e => e.pool_id !== changed.pool_id && e.sell_qty > 0)
    let toRemove = excess
    for (const o of others) {
      if (toRemove <= 0) break
      const take = Math.min(o.sell_qty, toRemove)
      o.sell_qty -= take
      toRemove -= take
    }
  } else if (actualTotal < sellTotalQty.value) {
    // 该池减少了，分配给其他池
    const shortage = sellTotalQty.value - actualTotal
    const others = sellEntries.value.filter(e => e.pool_id !== changed.pool_id)
    let toAdd = shortage
    for (const o of others) {
      if (toAdd <= 0) break
      const space = o.holding_qty - (o.sell_qty || 0)
      const add = Math.min(space, toAdd)
      if (add > 0) {
        o.sell_qty = (o.sell_qty || 0) + add
        toAdd -= add
      }
    }
    // 如果其他池都满了，总量要调整
    if (toAdd > 0) {
      sellTotalQty.value = actualTotal
    }
  }
  // 取整
  for (const e of sellEntries.value) {
    e.sell_qty = Math.floor(e.sell_qty / 100) * 100
    if (e.sell_qty > e.holding_qty) e.sell_qty = Math.floor(e.holding_qty / 100) * 100
  }
  updateMaxSliders()
  _redistributing = false
}

function updateMaxSliders() {
  for (const e of sellEntries.value) {
    e.max_sell = e.holding_qty
  }
}

const pendingTotalAmount = computed(() =>
  pendingTrades.value.reduce((s, t) => s + (t.amount || 0), 0)
)

const allSellVerified = computed(() =>
  pendingTrades.value.length > 0 && pendingTrades.value.every(t => t._actual && parseFloat(t._actual) > 0)
)

function onSellQtyChange(entry) {}

function priceForTrade(pt) {
  return pt.quantity > 0 ? pt.amount / pt.quantity : 0
}

function poolColor(name) {
  const map = { '公共池': '#0f3460', '春': '#e94560', '维': '#00d2a1', '队': '#ffc107', '回': '#7c4dff' }
  return map[name] || '#0f3460'
}

// ===== 交易记录编辑/删除 =====
const submitting = ref(false)
const editingTrade = ref(null)
const editAmount = ref('')
const editNote = ref('')
const editQuantity = ref('')
const editStockCode = ref('')
const editDate = ref('')
const deletingTrade = ref(null)

const tradeLogs = computed(() => {
  return fundStore.capitalLogs
    .filter(l => l.pool_id !== null)
    .map(l => {
      const note = l.note || ''
      const parts = note.split(' ')
      const code = parts.length > 1 && /^\d{6}$/.test(parts[parts.length - 1]) ? parts[parts.length - 1] : ''
      const tx = txStore.transactions.find(t =>
        t.pool_id === l.pool_id && code &&
        (t.stock_code === code) && Math.abs(t.amount - l.amount) < 0.01
      )
      return {
        ...l,
        stock_code: code,
        stock_name: tx?.stock_name || '',
        quantity: tx?.quantity || 0,
        trade_date: tx?.trade_date || l.created_at,
        pool_name: poolStore.pools.find(p => p.id === l.pool_id)?.name || ''
      }
    })
    .sort((a, b) => new Date(b.trade_date) - new Date(a.trade_date))
})

function formatDateString(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// ===== 买入流程 =====
function onStockSelected(stock) {
  currentPrice.value = stock.price
  stockCode.value = stock.stock_code
  stockName.value = stock.stock_name || ''
}

function onBuySubmit(data) {
  formError.value = ''
  if (!stockCode.value) {
    formError.value = '请先搜索并选择股票代码'; return
  }
  const pool = poolStore.pools.find(p => p.id === data.pool_id)
  if (pool) {
    const poolCost = holdingStore.holdings
      .filter(h => h.pool_id === data.pool_id)
      .reduce((s, h) => s + h.cost_price * h.quantity, 0)
    let available
    if (pool.name === '公共池') {
      const totalCost = holdingStore.holdings.reduce((s, h) => s + h.cost_price * h.quantity, 0)
      const totalAvailable = fundStore.totalCapital - totalCost
      let subSum = 0
      for (const p of poolStore.pools) {
        if (p.name === '公共池') continue
        const sa = poolAmounts[p.name] || 0
        const sc = holdingStore.holdings.filter(h => h.pool_id === p.id).reduce((s, h) => s + h.cost_price * h.quantity, 0)
        subSum += (sa - sc)
      }
      available = totalAvailable - subSum
    } else {
      available = (poolAmounts[pool.name] || 0) - poolCost
    }
    const need = parseFloat(data.amount) || 0
    if (need > available) {
      formError.value = `子池「${pool.name}」可用资金不足！剩余 ${formatMoney(available)}，本次需 ${formatMoney(need)}`
      return
    }
  }
  pendingBuy.value = {
    ...data,
    type: 'buy',
    stock_code: stockCode.value,
    stock_name: stockName.value,
    created_by: 'admin'
  }
}

function cancelBuy() {
  pendingBuy.value = null
  buyActualAmount.value = ''
}

async function confirmBuy() {
  if (!buyActualAmount.value || !pendingBuy.value || submitting.value) return
  submitting.value = true
  formError.value = ''
  const act = parseFloat(buyActualAmount.value)
  const tx = { ...pendingBuy.value, status: 'verified', actual_amount: act }
  try {
    await txStore.addTransaction(tx)
    const { pool_id, stock_code, stock_name, quantity, amount } = tx
    const existing = holdingStore.holdings.find(h => h.pool_id === pool_id && h.stock_code === stock_code)
    const newCost = calcNewCostPrice(amount, quantity, existing?.quantity || 0, existing?.cost_price || 0)
    await upsertHolding({ pool_id, stock_code, stock_name, quantity: (existing?.quantity || 0) + quantity, cost_price: newCost })
    await insertCapitalLog({ pool_id, type: 'remove', amount, note: `买入 ${stock_code}`, created_by: 'admin' })
    await holdingStore.loadHoldings()
    const { saveCurrentPositionSnapshot } = await import('@/utils/positionSnapshot')
    saveCurrentPositionSnapshot().catch(e => console.error('Position snapshot:', e))
    resetAll()
  } catch (e) {
    console.error('Trade submit error:', e)
    formError.value = '提交失败：' + e.message
  } finally {
    submitting.value = false
  }
}

// ===== 卖出流程 =====
function submitSell() {
  formError.value = ''
  if (!sellValid.value) return
  const entries = sellEntries.value.filter(e => e.sell_qty > 0)
  if (!entries.length) { formError.value = '请至少输入一个子池的卖出数量'; return }
  // 生成待校对列表
  pendingTrades.value = entries.map(e => ({
    pool_id: e.pool_id,
    pool_name: e.pool_name,
    quantity: e.sell_qty,
    amount: Math.round(e.sell_qty * currentPrice.value * 100) / 100,
    price: currentPrice.value,
    type: 'sell',
    stock_code: stockCode.value,
    stock_name: stockName.value,
    trade_date: sellDate.value,
    created_by: 'admin',
    _actual: ''
  }))
}

function cancelSell() {
  pendingTrades.value = []
}

async function confirmSell() {
  if (!allSellVerified.value || submitting.value) return
  submitting.value = true
  formError.value = ''
  try {
    for (const pt of pendingTrades.value) {
      const act = parseFloat(pt._actual)
      const tx = {
        pool_id: pt.pool_id, stock_code: pt.stock_code, stock_name: pt.stock_name,
        type: 'sell', quantity: pt.quantity, price: pt.price, amount: pt.amount,
        fee: act - pt.amount, status: 'verified', actual_amount: act,
        trade_date: pt.trade_date, note: `卖出 ${pt.stock_code}`, created_by: 'admin'
      }
      await txStore.addTransaction(tx)
      const existing = holdingStore.holdings.find(h => h.pool_id === pt.pool_id && h.stock_code === pt.stock_code)
      const remaining = (existing?.quantity || 0) - pt.quantity
      if (remaining <= 0) await deleteHolding(pt.pool_id, pt.stock_code)
      else await upsertHolding({ pool_id: pt.pool_id, stock_code: pt.stock_code, stock_name: existing?.stock_name || pt.stock_name, quantity: remaining, cost_price: existing?.cost_price || 0 })
      await insertCapitalLog({ pool_id: pt.pool_id, type: 'add', amount: act, note: `卖出 ${pt.stock_code}`, created_by: 'admin' })
    }
    await holdingStore.loadHoldings()
    const { saveCurrentPositionSnapshot } = await import('@/utils/positionSnapshot')
    saveCurrentPositionSnapshot().catch(e => console.error('Position snapshot:', e))
    resetAll()
  } catch (e) {
    console.error('Sell submit error:', e)
    formError.value = '提交失败：' + e.message
  } finally {
    submitting.value = false
  }
}

function resetAll() {
  pendingBuy.value = null
  buyActualAmount.value = ''
  pendingTrades.value = []
  stockCode.value = ''
  stockName.value = ''
  currentPrice.value = 0
  formError.value = ''
}

// ===== 交易记录编辑/删除 =====
async function startEditTrade(log) {
  editingTrade.value = log
  editAmount.value = String(log.amount)
  editNote.value = log.note || ''
  editQuantity.value = ''
  editStockCode.value = log.stock_code || ''
  editDate.value = ''
  if (log.stock_code) {
    try {
      const txs = await fetchTransactionsByPoolStock(log.pool_id, log.stock_code)
      const match = txs.find(t => Math.abs(t.amount - log.amount) < 0.01)
      if (match) {
        editQuantity.value = String(match.quantity)
        editDate.value = match.trade_date || ''
      }
    } catch (e) { console.error('Fetch tx for edit:', e) }
  }
}

async function saveEditTrade() {
  if (!editingTrade.value) return
  const amount = parseFloat(editAmount.value)
  if (!amount || amount <= 0) return
  const log = editingTrade.value
  const stockCode = editStockCode.value
  const newQty = parseInt(editQuantity.value) || 0
  try {
    if (stockCode) {
      const allTxs = await fetchTransactionsByPoolStock(log.pool_id, stockCode)
      const matchedTx = allTxs.find(t => Math.abs(t.amount - log.amount) < 0.01)
      if (matchedTx && newQty > 0) {
        const newPrice = amount / newQty
        const txUpdates = { quantity: newQty, amount, price: newPrice }
        if (editDate.value) txUpdates.trade_date = editDate.value
        await updateTransaction(matchedTx.id, txUpdates)
        txStore.transactions = txStore.transactions.map(t => t.id === matchedTx.id ? { ...t, ...txUpdates } : t)
        const isBuy = log.type === 'remove'
        const otherTxs = allTxs.filter(t => t.id !== matchedTx.id)
        const allCalculated = [...otherTxs, { ...matchedTx, quantity: newQty, amount, price: newPrice, type: isBuy ? 'buy' : 'sell' }]
        let totalBuyQty = 0, totalBuyAmt = 0
        for (const tx of allCalculated) { if (tx.type === 'buy') { totalBuyQty += tx.quantity; totalBuyAmt += tx.amount } }
        const newCostPrice = totalBuyQty > 0 ? totalBuyAmt / totalBuyQty : 0
        const netQty = allCalculated.reduce((s, tx) => s + (tx.type === 'buy' ? tx.quantity : -tx.quantity), 0)
        if (netQty <= 0) await deleteHolding(log.pool_id, stockCode)
        else await upsertHolding({ pool_id: log.pool_id, stock_code: stockCode, stock_name: matchedTx.stock_name || '', quantity: netQty, cost_price: newCostPrice })
        await holdingStore.loadHoldings()
      }
    }
    await updateCapitalLog(log.id, { amount, note: editNote.value || '' })
    await fundStore.loadCapitalLogs()
    await txStore.loadTransactions()
    editingTrade.value = null
  } catch (e) { console.error('Save edit trade error:', e) }
}

function confirmDeleteTrade(log) { deletingTrade.value = log }

async function doDeleteTrade() {
  if (!deletingTrade.value) return
  const log = deletingTrade.value
  try {
    const { id, pool_id, amount } = log
    const code = log.stock_code
    if (code) {
      const allTxs = await fetchTransactionsByPoolStock(pool_id, code)
      const matchedTx = allTxs.find(t => Math.abs(t.amount - amount) < 0.01)
      if (matchedTx) {
        await deleteTransaction(matchedTx.id)
        txStore.transactions = txStore.transactions.filter(t => t.id !== matchedTx.id)
      }
      const remaining = allTxs.filter(t => t.id !== (matchedTx?.id))
      if (remaining.length === 0) await deleteHolding(pool_id, code)
      else {
        let totalBuyQty = 0, totalBuyAmt = 0
        for (const tx of remaining) { if (tx.type === 'buy') { totalBuyQty += tx.quantity; totalBuyAmt += tx.amount } }
        const netQty = remaining.reduce((s, tx) => s + (tx.type === 'buy' ? tx.quantity : -tx.quantity), 0)
        if (netQty <= 0) await deleteHolding(pool_id, code)
        else await upsertHolding({ pool_id, stock_code: code, stock_name: matchedTx?.stock_name || '', quantity: netQty, cost_price: totalBuyQty > 0 ? totalBuyAmt / totalBuyQty : 0 })
      }
      await holdingStore.loadHoldings()
    }
    await deleteCapitalLog(id)
    await fundStore.loadCapitalLogs()
    await txStore.loadTransactions()
    deletingTrade.value = null
  } catch (e) { console.error('Delete trade error:', e) }
}

onMounted(async () => {
  try {
    const server = await loadPoolAllocation()
    if (server) {
      let s = server
      if (s['共有'] !== undefined && s['公共池'] === undefined) { s = { ...s }; s['公共池'] = s['共有']; delete s['共有'] }
      for (const k of Object.keys(s)) { if (poolAmounts[k] !== undefined) poolAmounts[k] = s[k] }
    }
  } catch (e) { console.error('Load pool allocation:', e) }
  await poolStore.loadPools()
  fundStore.loadCapitalLogs()
  txStore.loadTransactions()
  await holdingStore.loadHoldings()
  if (route.query.code) {
    isSell.value = true
    stockCode.value = route.query.code
    stockName.value = route.query.name || ''
    currentPrice.value = parseFloat(route.query.price) || 0
    sellPoolId.value = parseInt(route.query.poolId) || null
    sellPoolName.value = route.query.poolName || ''
    initSellEntries()
  } else {
    isSell.value = false
  }
})

function initSellEntries() {
  sellTotalQty.value = 0
  sellEntries.value = sellHoldingPools.value.map(h => ({
    pool_id: h.pool_id,
    pool_name: h.pool_name,
    holding_qty: h.holding_qty,
    max_sell: h.holding_qty,
    sell_qty: 0
  }))
}
</script>

<style scoped>
.search-section-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }
.preset-section { border-left: 3px solid var(--color-fall); }
.preset-name { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
.preset-code { font-size: 13px; color: var(--text-secondary); font-weight: 400; }
.preset-info { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-secondary); }
.preset-pool { color: var(--color-fall); }
.form-err { color: var(--color-fall); font-size: 13px; text-align: center; margin-top: 8px; }
.section-title { font-size: 13px; font-weight: 600; padding: 0 0 10px; }

/* ===== 多池卖出滑块 ===== */
.sell-empty { font-size: 12px; color: var(--text-muted); padding: 8px 0; }
.sell-total-row {
  padding: 8px 0 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 12px;
}
.stl-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
.stl-label { font-size: 14px; font-weight: 700; }
.stl-val { font-size: 20px; color: var(--color-rise); }
.stl-estimate { font-size: 12px; color: var(--text-muted); margin-top: 2px; text-align: right; }
.sell-slider {
  width: 100%; height: 6px;
  -webkit-appearance: none; appearance: none;
  background: rgba(255,255,255,0.1);
  border-radius: 3px; outline: none;
}
.sell-slider::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 24px; height: 24px;
  border-radius: 50%;
  background: var(--color-rise);
  cursor: pointer; border: 2px solid #fff;
}
.sell-pools-section { padding-top: 4px; }
.sell-pool-row {
  padding: 10px 0 12px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.spr-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
.spr-pool-name { font-size: 13px; font-weight: 600; }
.spr-holding { font-size: 11px; color: var(--text-secondary); }
.spr-bottom {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-top: 4px; font-size: 13px;
}
.spr-estimate { font-size: 11px; color: var(--text-muted); }
.sell-remaining {
  text-align: center; padding: 8px;
  font-size: 12px; color: var(--color-warn);
  background: rgba(255,152,0,0.08);
  border-radius: var(--radius-md);
  margin-top: 8px;
}
.sell-date-row { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.sdr-label { font-size: 12px; color: var(--text-secondary); white-space: nowrap; }
.sdr-input {
  flex: 1; padding: 8px 10px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px; color: #fff; font-size: 14px; outline: none;
}

/* ===== 多池校对 ===== */
.sell-verify-row {
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  margin-bottom: 6px;
}
.svr-header {
  display: flex; justify-content: space-between;
  font-size: 13px; margin-bottom: 6px;
}
.svr-pool { font-weight: 600; }

/* ===== 校对共用 ===== */
.verify-required {
  background: var(--bg-card); border-radius: var(--radius-lg); padding: 20px;
  border: 1px solid rgba(233,69,96,0.2);
}
.vr-title { font-size: 16px; font-weight: 700; color: var(--color-fall); margin-bottom: 16px; text-align: center; }
.vr-info { margin-bottom: 16px; }
.vr-row {
  display: flex; justify-content: space-between; padding: 6px 0;
  font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.04);
}
.verify-input-row {
  display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
  background: rgba(255,255,255,0.03); border-radius: var(--radius-md); padding: 8px 10px;
}
.vr-label { font-size: 12px; color: var(--text-secondary); white-space: nowrap; }
.verify-input {
  flex: 1; min-width: 0; width: 0;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px; color: #fff; font-size: 16px; padding: 6px 8px;
  text-align: right; outline: none; font-family: var(--font-number);
}
.verify-diff { font-size: 12px; text-align: right; margin-bottom: 12px; font-family: var(--font-number); }
.verify-diff.fall { color: var(--color-fall); }
.verify-diff.rise { color: var(--color-rise); }
.verify-btns { display: flex; gap: 10px; }
.v-btn { flex: 1; padding: 12px; border: none; border-radius: var(--radius-md); font-size: 15px; font-weight: 600; cursor: pointer; }
.v-btn.cancel { background: rgba(255,255,255,0.06); color: var(--text-secondary); }
.v-btn.confirm { background: #00d2a1; color: #1a1a2e; }
.v-btn.confirm:disabled { opacity: 0.3; cursor: not-allowed; }

/* 买卖记录 */
.trade-log-list { display: flex; flex-direction: column; gap: 6px; }
.trade-log-item { padding: 10px 12px; background: rgba(255,255,255,0.03); border-radius: var(--radius-md); display: flex; gap: 8px; align-items: center; }
.tli-body { flex: 1; min-width: 0; }
.tli-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
.tli-action { font-size: 14px; font-weight: 600; font-family: var(--font-number); }
.tli-action.rise { color: var(--color-rise); }
.tli-action.fall { color: var(--color-fall); }
.tli-name { font-size: 12px; color: var(--text-secondary); }
.tli-qty { font-size: 11px; color: var(--text-muted); }
.tli-meta { font-size: 11px; color: var(--text-muted); display: flex; gap: 4px; flex-wrap: wrap; }
.tli-actions { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }
.tli-edit-btn, .tli-del-btn { background: none; border: none; font-size: 13px; cursor: pointer; padding: 2px 4px; line-height: 1; opacity: 0.5; transition: opacity 0.15s; color: var(--text-muted); }
.tli-edit-btn:hover, .tli-del-btn:hover { opacity: 1; }
.tli-del-btn:active { color: var(--color-fall); }

/* 弹窗共用 */
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
.d-cancel { flex: 1; padding: 10px; border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-md); background: transparent; color: var(--text-secondary); font-size: 14px; cursor: pointer; }
.d-ok { flex: 2; padding: 10px; border: none; border-radius: var(--radius-md); background: var(--bg-accent); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
.d-ok.del { background: var(--color-fall); }
.dlg-info { font-size: 14px; color: var(--text-secondary); margin-bottom: 12px; }
.dlg-rows { margin-bottom: 8px; }
.dlg-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.03); }
.dlg-warn { font-size: 11px; color: var(--color-warn); padding: 6px 0; text-align: center; }
</style>
