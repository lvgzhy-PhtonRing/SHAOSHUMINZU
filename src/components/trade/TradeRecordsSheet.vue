<template>
  <van-popup
    v-model:show="visible"
    position="bottom"
    round
    :style="{ height: '85%' }"
  >
    <div class="trade-sheet">
      <div class="sheet-head">
        <div class="sheet-title">交易记录</div>
        <button class="sheet-close" @click="visible = false">✕</button>
      </div>

      <div class="sheet-body">
        <div v-if="!tradeLogs.length" class="filter-empty">暂无交易记录</div>

        <template v-else>
          <div class="section-title trade-rec-title">
            <span class="title-accent title-accent--accent"></span>
            交易记录
            <span class="swipe-hint">◀ 左滑编辑</span>
          </div>

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
        </template>
      </div>
    </div>

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
  </van-popup>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { formatMoney, formatPrice } from '@/utils/formatters'
import { calcBuyFee, calcSellFee } from '@/utils/feeCalculator'
import {
  updateCapitalLog, deleteCapitalLog, updateTransaction, deleteTransaction,
  fetchTransactionsByPoolStock, deleteHolding, upsertHolding
} from '@/api/supabase'
import { matchTradedStocks } from '@/api/stock'
import { usePoolStore } from '@/stores/pools'
import { useTransactionStore } from '@/stores/transactions'
import { useHoldingStore } from '@/stores/holdings'
import { useFundStore } from '@/stores/funds'

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

const showAllLogs = ref(false)
const tradeLogs = computed(() => {
  return fundStore.capitalLogs.filter(l => l.pool_id !== null).map(l => {
    const note = l.note || ''; const parts = note.split(' ')
    const code = parts.length > 1 && /^\d{6}$/.test(parts[parts.length - 1]) ? parts[parts.length - 1] : ''
    const tx = txStore.transactions.find(t => t.pool_id === l.pool_id && code && (t.stock_code === code) && (Math.abs(t.amount - l.amount) < 0.01 || Math.abs((t.actual_amount || t.amount) - l.amount) < 0.01))
    return { ...l, stock_code: code, stock_name: tx?.stock_name || '', quantity: tx?.quantity || 0, price: tx?.price || 0, fee: tx?.fee || 0, trade_date: tx?.trade_date || l.created_at, pool_name: poolStore.pools.find(p => p.id === l.pool_id)?.name || '' }
  }).sort((a, b) => new Date(b.trade_date) - new Date(a.trade_date))
})

const filterQuery = ref('')
const filterStockCode = ref('')
const filterStockName = ref('')
const showFilterDropdown = ref(false)
const filterSuggestions = ref([])
let filterReqId = 0

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
  if (reqId !== filterReqId) return
  if (results === null) {
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

const editingTrade = ref(null); const editPrice = ref(''); const editNote = ref(''); const editQuantity = ref(''); const editStockCode = ref(''); const editDate = ref(''); const editPoolId = ref(null); const deletingTrade = ref(null)
const editFee = ref(0)
const editComputedAmount = ref(0)
const editComputedActual = ref(0)

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
    editingTrade.value = null
    emit('changed')
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
    deletingTrade.value = null
    emit('changed')
  } catch (e) { console.error('Delete trade error:', e) }
}

watch(() => props.modelValue, async v => {
  if (!v) return
  filterStockCode.value = ''
  filterStockName.value = ''
  filterQuery.value = ''
  filterSuggestions.value = []
  showFilterDropdown.value = false
  showAllLogs.value = false
  try {
    await Promise.all([poolStore.loadPools(), fundStore.loadCapitalLogs(), txStore.loadTransactions()])
  } catch (e) {}
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
.sheet-title { flex: 1; font-size: 16px; font-weight: 700; }
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
.trade-rec-title { display: flex; align-items: center; gap: 8px; }
.swipe-hint {
  font-size: 11px;
  background: linear-gradient(135deg, var(--color-rise), #ff8a9a);
  color: #fff;
  padding: 3px 10px;
  border-radius: 12px;
  font-weight: 600;
}
.rec-all-tag { font-size: 11px; padding: 2px 10px; border-radius: 10px; color: var(--text-secondary); background: rgba(255,255,255,0.06); cursor: pointer; flex: 0 0 auto; }
.rec-all-tag.active { color: var(--color-rise); background: rgba(255,77,109,0.14); font-weight: 600; }
.filter-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.filter-input-wrap { position: relative; flex: 1; min-width: 0; }
.filter-input { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-md); padding: 0 34px 0 4px; }
.filter-input :deep(.van-field__control) { font-size: 13px; }
.filter-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 14px; color: var(--text-muted); padding: 4px; cursor: pointer; z-index: 2; }
.filter-clear:active { opacity: 0.6; }
.filter-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20; background: var(--bg-solid); border: 1px solid rgba(255,255,255,0.12); border-radius: var(--radius-md); overflow: hidden; box-shadow: 0 6px 20px rgba(0,0,0,0.4); max-height: 240px; overflow-y: auto; }
.filter-sugg-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer; }
.filter-sugg-item:active { background: rgba(255,255,255,0.06); }
.fs-name { font-size: 13px; font-weight: 600; flex: 0 0 auto; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fs-code { font-size: 12px; color: var(--text-secondary); flex: 0 0 auto; }
.fs-count { font-size: 11px; color: var(--text-muted); margin-left: auto; }
.fs-empty { padding: 14px; text-align: center; font-size: 12px; color: var(--text-muted); }
.filter-summary { font-size: 12px; color: var(--text-secondary); padding: 0 2px 8px; }
.filter-empty { text-align: center; padding: 18px 0; font-size: 13px; color: var(--text-muted); }

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
.dialog { background: var(--bg-solid); border-radius: var(--radius-lg); padding: 20px; width: 100%; max-width: 360px; }
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
</style>
