<template>
  <div class="page trade-page">
    <div class="page-header">
      <span class="page-title">{{ isSell ? '卖出' : '录入买入' }}</span>
    </div>

    <!-- step 1: 填写交易信息 -->
    <template v-if="!pendingTrade">
      <div v-if="isSell" class="section-card preset-section">
        <div class="preset-name">{{ stockName }} <span class="preset-code">{{ stockCode }}</span></div>
        <div class="preset-info">
          <span>现价 {{ formatPrice(currentPrice) }}</span>
          <span class="preset-pool">子池：{{ sellPoolName }}</span>
        </div>
      </div>

      <div v-if="!isSell" class="section-card">
        <div class="search-section-label">搜索股票</div>
        <StockSearch @stock-selected="onStockSelected" />
      </div>

      <div class="section-card">
        <TradeForm
          ref="formRef"
          :pools="poolStore.pools"
          :is-buy="!isSell"
          :stock-price="currentPrice"
          :submitting="false"
          :hide-pool="isSell"
          :preset-pool-id="sellPoolId"
          @submit="onFormSubmit"
        />

        <div v-if="formError" class="form-err">{{ formError }}</div>
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
            </div>
            <div class="tli-meta">
              <span>{{ formatMoney(log.amount) }}</span>
              <span> · {{ log.pool_name }}</span>
              <span> · {{ formatDateString(log.created_at) }}</span>
            </div>
          </div>
          <div class="tli-actions">
            <button class="tli-edit-btn" @click="startEditTrade(log)">✏️</button>
            <button class="tli-del-btn" @click="confirmDeleteTrade(log)">✕</button>
          </div>
        </div>
      </div>
    </div>

    <!-- step 2: 校对（必须） -->
    <template v-if="pendingTrade">
      <div class="verify-required">
        <div class="vr-title">⚠️ 必须核实券商实际成交金额</div>
        <div class="vr-info">
          <div class="vr-row">
            <span>{{ pendingTrade.stock_name || pendingTrade.stock_code }}</span>
            <span class="num-mono">{{ formatPrice(pendingTrade.price) }} × {{ pendingTrade.quantity }} 股</span>
          </div>
          <div class="vr-row">
            <span>{{ isSell ? '卖出' : '买入' }}总金额（预估）</span>
            <span class="num-mono">{{ formatMoney(pendingTrade.amount) }}</span>
          </div>
        </div>
        <div class="verify-input-row">
          <span class="vr-label">券商实际成交金额</span>
          <input
            v-model="actualAmount"
            type="number"
            inputmode="decimal"
            placeholder="输入券商APP里的真实金额"
            class="verify-input num-mono"
          />
          <span>元</span>
        </div>
        <div v-if="actualAmount" class="verify-diff" :class="diff > 0 ? 'fall' : 'rise'">
          差额 {{ diff > 0 ? '+' : '' }}{{ formatMoney(Math.abs(diff)) }}（手续费）
        </div>
        <div class="verify-btns">
          <button class="v-btn cancel" @click="cancelTrade">取消</button>
          <button class="v-btn confirm" :disabled="!actualAmount" @click="confirmTrade">
            ✅ 确认并记录
          </button>
        </div>
      </div>
    </template>

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
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { usePoolStore } from '@/stores/pools'
import { useTransactionStore } from '@/stores/transactions'
import { useHoldingStore } from '@/stores/holdings'
import { useFundStore } from '@/stores/funds'
import { calcNewCostPrice } from '@/utils/calculators'
import { formatMoney, formatPrice } from '@/utils/formatters'
import { upsertHolding, deleteHolding, insertCapitalLog, deleteCapitalLog, updateCapitalLog, updateTransaction, deleteTransaction, fetchTransactionsByPoolStock } from '@/api/supabase'
import StockSearch from '@/components/trade/StockSearch.vue'
import TradeForm from '@/components/trade/TradeForm.vue'

const route = useRoute()
const poolStore = usePoolStore()
const txStore = useTransactionStore()
const holdingStore = useHoldingStore()
const fundStore = useFundStore()

const isSell = ref(false)
const currentPrice = ref(0)
const stockCode = ref('')
const stockName = ref('')
const sellPoolId = ref(null)
const sellPoolName = ref('')
const formError = ref('')
const pendingTrade = ref(null)
const actualAmount = ref('')

// 交易记录编辑/删除
const editingTrade = ref(null)
const editAmount = ref('')
const editNote = ref('')
const editQuantity = ref('')
const editStockCode = ref('')
const deletingTrade = ref(null)

const diff = computed(() => {
  if (!actualAmount.value || !pendingTrade.value) return 0
  return parseFloat(actualAmount.value) - pendingTrade.value.amount
})

// 历史买卖记录（从资金记录中过滤，匹配交易获取股票名称）
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
        pool_name: poolStore.pools.find(p => p.id === l.pool_id)?.name || ''
      }
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
})

function formatDateString(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function onStockSelected(stock) {
  currentPrice.value = stock.price
  stockCode.value = stock.stock_code
  stockName.value = stock.stock_name || ''
}

function onFormSubmit(data) {
  formError.value = ''
  if (!isSell.value && !stockCode.value) {
    formError.value = '请先搜索并选择股票代码'
    return
  }
  // 暂存交易，进入校对步骤
  pendingTrade.value = {
    ...data,
    type: isSell.value ? 'sell' : 'buy',
    stock_code: stockCode.value,
    stock_name: stockName.value,
    created_by: 'admin'
  }
}

function cancelTrade() {
  pendingTrade.value = null
  actualAmount.value = ''
}

async function confirmTrade() {
  if (!actualAmount.value || !pendingTrade.value) return
  const act = parseFloat(actualAmount.value)
  const tx = { ...pendingTrade.value, status: 'verified', actual_amount: act }
  try {
    const result = await txStore.addTransaction(tx)

    const { pool_id, stock_code, stock_name, type, quantity, amount } = tx
    const existing = holdingStore.holdings.find(h => h.pool_id === pool_id && h.stock_code === stock_code)

    if (type === 'buy') {
      const newCost = calcNewCostPrice(amount, quantity, existing?.quantity || 0, existing?.cost_price || 0)
      await upsertHolding({ pool_id, stock_code, stock_name, quantity: (existing?.quantity || 0) + quantity, cost_price: newCost })
    } else {
      const remaining = (existing?.quantity || 0) - quantity
      if (remaining <= 0) await deleteHolding(pool_id, stock_code)
      else await upsertHolding({ pool_id, stock_code, stock_name: existing?.stock_name || stock_name, quantity: remaining, cost_price: existing?.cost_price || 0 })
    }

    await insertCapitalLog({ pool_id, type: type === 'buy' ? 'remove' : 'add', amount, note: `${type === 'buy' ? '买入' : '卖出'} ${stock_code}`, created_by: 'admin' })
    await holdingStore.loadHoldings()

    // 重置
    pendingTrade.value = null
    actualAmount.value = ''
    stockCode.value = ''
    stockName.value = ''
    currentPrice.value = 0
    formError.value = ''
  } catch (e) {
    console.error('Trade submit error:', e)
    formError.value = '提交失败：' + e.message
  }
}

// ===== 交易记录编辑/删除 =====

async function startEditTrade(log) {
  editingTrade.value = log
  editAmount.value = String(log.amount)
  editNote.value = log.note || ''
  editQuantity.value = ''
  editStockCode.value = log.stock_code || ''

  if (log.stock_code) {
    try {
      const txs = await fetchTransactionsByPoolStock(log.pool_id, log.stock_code)
      const match = txs.find(t => Math.abs(t.amount - log.amount) < 0.01)
      if (match) editQuantity.value = String(match.quantity)
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
    // 1. 找对应交易记录
    if (stockCode) {
      const allTxs = await fetchTransactionsByPoolStock(log.pool_id, stockCode)
      const matchedTx = allTxs.find(t => Math.abs(t.amount - log.amount) < 0.01)

      if (matchedTx && newQty > 0) {
        // 2. 更新交易记录（数量+金额）
        const newPrice = amount / newQty
        await updateTransaction(matchedTx.id, { quantity: newQty, amount, price: newPrice })
        txStore.transactions = txStore.transactions.map(t =>
          t.id === matchedTx.id ? { ...t, quantity: newQty, amount, price: newPrice } : t
        )

        // 3. 用所有交易重算该子池+该股票的持仓
        const isBuy = log.type === 'remove'  // capital_log.remove = 买入
        const otherTxs = allTxs.filter(t => t.id !== matchedTx.id)
        const allCalculated = [
          ...otherTxs,
          { ...matchedTx, quantity: newQty, amount, price: newPrice, type: isBuy ? 'buy' : 'sell' }
        ]
        let totalBuyQty = 0, totalBuyAmt = 0
        for (const tx of allCalculated) {
          if (tx.type === 'buy') { totalBuyQty += tx.quantity; totalBuyAmt += tx.amount }
        }
        const newCostPrice = totalBuyQty > 0 ? totalBuyAmt / totalBuyQty : 0
        const netQty = allCalculated.reduce((s, tx) => s + (tx.type === 'buy' ? tx.quantity : -tx.quantity), 0)

        if (netQty <= 0) {
          await deleteHolding(log.pool_id, stockCode)
        } else {
          await upsertHolding({
            pool_id: log.pool_id, stock_code: stockCode,
            stock_name: matchedTx.stock_name || '',
            quantity: netQty, cost_price: newCostPrice
          })
        }
        await holdingStore.loadHoldings()
      }
    }

    // 4. 更新资金记录 + 全量刷新
    await updateCapitalLog(log.id, { amount, note: editNote.value || '' })
    await fundStore.loadCapitalLogs()
    await txStore.loadTransactions()

    editingTrade.value = null
  } catch (e) {
    console.error('Save edit trade error:', e)
  }
}

function confirmDeleteTrade(log) {
  deletingTrade.value = log
}

async function doDeleteTrade() {
  if (!deletingTrade.value) return
  const log = deletingTrade.value

  try {
    const { id, pool_id, amount } = log
    const code = log.stock_code

    if (code) {
      // 找到对应交易记录并删除
      const allTxs = await fetchTransactionsByPoolStock(pool_id, code)
      const matchedTx = allTxs.find(t => Math.abs(t.amount - amount) < 0.01)
      if (matchedTx) {
        await deleteTransaction(matchedTx.id)
        txStore.transactions = txStore.transactions.filter(t => t.id !== matchedTx.id)
      }

      // 用剩余交易重算持仓
      const remaining = allTxs.filter(t => t.id !== (matchedTx?.id))
      if (remaining.length === 0) {
        await deleteHolding(pool_id, code)
      } else {
        let totalBuyQty = 0, totalBuyAmt = 0
        for (const tx of remaining) {
          if (tx.type === 'buy') { totalBuyQty += tx.quantity; totalBuyAmt += tx.amount }
        }
        const netQty = remaining.reduce((s, tx) => s + (tx.type === 'buy' ? tx.quantity : -tx.quantity), 0)
        const costPrice = totalBuyQty > 0 ? totalBuyAmt / totalBuyQty : 0
        if (netQty <= 0) {
          await deleteHolding(pool_id, code)
        } else {
          await upsertHolding({
            pool_id, stock_code: code,
            stock_name: matchedTx?.stock_name || '',
            quantity: netQty, cost_price: costPrice
          })
        }
      }
      await holdingStore.loadHoldings()
    }

    // 删除资金记录 + 刷新
    await deleteCapitalLog(id)
    await fundStore.loadCapitalLogs()
    await txStore.loadTransactions()

    deletingTrade.value = null
  } catch (e) {
    console.error('Delete trade error:', e)
  }
}

onMounted(async () => {
  poolStore.loadPools()
  fundStore.loadCapitalLogs()
  txStore.loadTransactions()
  if (route.query.code) {
    isSell.value = true
    stockCode.value = route.query.code
    stockName.value = route.query.name || ''
    currentPrice.value = parseFloat(route.query.price) || 0
    sellPoolId.value = parseInt(route.query.poolId) || null
    sellPoolName.value = route.query.poolName || ''
  }
})
</script>

<style scoped>
.search-section-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }
.preset-section { border-left: 3px solid var(--color-fall); }
.preset-name { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
.preset-code { font-size: 13px; color: var(--text-secondary); font-weight: 400; }
.preset-info { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-secondary); }
.preset-pool { color: var(--color-fall); }
.form-err { color: var(--color-fall); font-size: 13px; text-align: center; margin-top: 8px; }

/* 校对 */
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
  background: rgba(255,255,255,0.03); border-radius: var(--radius-md); padding: 12px;
}
.vr-label { font-size: 13px; color: var(--text-secondary); white-space: nowrap; }
.verify-input {
  flex: 1; min-width: 0; width: 0;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px; color: #fff; font-size: 18px; padding: 8px 10px;
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
.section-title { font-size: 13px; font-weight: 600; padding: 0 0 8px; }
.trade-log-list { display: flex; flex-direction: column; gap: 6px; }
.trade-log-item {
  padding: 10px 12px; background: rgba(255,255,255,0.03); border-radius: var(--radius-md);
}
.tli-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
.tli-action { font-size: 14px; font-weight: 600; font-family: var(--font-number); }
.tli-action.rise { color: var(--color-rise); }
.tli-action.fall { color: var(--color-fall); }
.tli-name { font-size: 12px; color: var(--text-secondary); }
.tli-meta { font-size: 11px; color: var(--text-muted); display: flex; gap: 4px; flex-wrap: wrap; }
.trade-log-item { display: flex; gap: 8px; align-items: center; }
.tli-body { flex: 1; min-width: 0; }
.tli-actions { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }
.tli-edit-btn, .tli-del-btn {
  background: none; border: none; font-size: 13px; cursor: pointer; padding: 2px 4px; line-height: 1;
  opacity: 0.5; transition: opacity 0.15s; color: var(--text-muted);
}
.tli-edit-btn:hover, .tli-del-btn:hover { opacity: 1; }
.tli-del-btn:active { color: var(--color-fall); }

/* 弹窗共用（与CapitalLogList一致） */
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;
}
.dialog {
  background: var(--bg-card); border-radius: var(--radius-lg); padding: 20px;
  width: 100%; max-width: 360px;
}
.dlg-title { font-size: 17px; font-weight: 700; margin-bottom: 16px; }
.dlg-field { margin-bottom: 12px; }
.dlg-label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.dlg-value { font-size: 14px; color: var(--text-primary); }
.dlg-input {
  width: 100%; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md); background: rgba(255,255,255,0.04); color: #fff;
  font-size: 15px; outline: none; box-sizing: border-box;
}
.dlg-input:focus { border-color: var(--bg-accent); }
.dlg-input.num-mono { font-family: var(--font-number); }
.dlg-btns { display: flex; gap: 10px; margin-top: 16px; }
.d-cancel {
  flex: 1; padding: 10px; border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md); background: transparent; color: var(--text-secondary);
  font-size: 14px; cursor: pointer;
}
.d-ok {
  flex: 2; padding: 10px; border: none; border-radius: var(--radius-md);
  background: var(--bg-accent); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
}
.d-ok.del { background: var(--color-fall); }
.dlg-info { font-size: 14px; color: var(--text-secondary); margin-bottom: 12px; }
.dlg-rows { margin-bottom: 8px; }
.dlg-row {
  display: flex; justify-content: space-between; padding: 5px 0;
  font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.03);
}
.dlg-warn { font-size: 11px; color: var(--color-warn); padding: 6px 0; text-align: center; }
</style>
