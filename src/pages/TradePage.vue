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
import { upsertHolding, deleteHolding, insertCapitalLog } from '@/api/supabase'
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
</style>
