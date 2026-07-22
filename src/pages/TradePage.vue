<template>
  <div class="page trade-page">
    <div class="page-header">
      <span class="page-title">{{ isSell ? '卖出' : '录入买入' }}</span>
    </div>

    <!-- 卖出模式：显示预填的股票信息 -->
    <div v-if="isSell" class="preset-card">
      <div class="preset-name">{{ stockName }} <span class="preset-code">{{ stockCode }}</span></div>
      <div class="preset-info">
        <span>现价 {{ formatPrice(currentPrice) }}</span>
        <span class="preset-pool">子池：{{ sellPoolName }}</span>
      </div>
    </div>

    <!-- 买入模式：搜索股票 -->
    <StockSearch v-if="!isSell" ref="searchRef" @stock-selected="onStockSelected" />

    <TradeForm
      ref="formRef"
      :pools="poolStore.pools"
      :is-buy="!isSell"
      :stock-price="currentPrice"
      :submitting="txStore.submitting"
      :hide-pool="isSell"
      :preset-pool-id="sellPoolId"
      @submit="onTradeSubmit"
    />

    <VerificationCard
      v-if="lastTransaction"
      :original-amount="lastTransaction.amount"
      @verified="onVerified"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { usePoolStore } from '@/stores/pools'
import { useTransactionStore } from '@/stores/transactions'
import { useHoldingStore } from '@/stores/holdings'
import { calcNewCostPrice } from '@/utils/calculators'
import { formatPrice } from '@/utils/formatters'
import { upsertHolding, deleteHolding, insertCapitalLog } from '@/api/supabase'
import StockSearch from '@/components/trade/StockSearch.vue'
import TradeForm from '@/components/trade/TradeForm.vue'
import VerificationCard from '@/components/trade/VerificationCard.vue'

const route = useRoute()
const poolStore = usePoolStore()
const txStore = useTransactionStore()
const holdingStore = useHoldingStore()

const isSell = ref(false)
const currentPrice = ref(0)
const stockCode = ref('')
const stockName = ref('')
const sellPoolId = ref(null)
const sellPoolName = ref('')
const lastTransaction = ref(null)

function onStockSelected(stock) {
  currentPrice.value = stock.price
  stockCode.value = stock.stock_code
  stockName.value = stock.stock_name || ''
}

async function onTradeSubmit(data) {
  try {
    const tx = {
      ...data,
      type: isSell.value ? 'sell' : 'buy',
      stock_code: stockCode.value,
      stock_name: stockName.value,
      status: 'pending',
      created_by: 'admin'
    }
    const result = await txStore.addTransaction(tx)
    lastTransaction.value = result

    const existing = holdingStore.holdings.find(
      h => h.pool_id === data.pool_id && h.stock_code === stockCode.value
    )

    if (!isSell.value) {
      const newCost = calcNewCostPrice(data.amount, data.quantity, existing?.quantity || 0, existing?.cost_price || 0)
      await upsertHolding({
        pool_id: data.pool_id,
        stock_code: stockCode.value,
        stock_name: stockName.value,
        quantity: (existing?.quantity || 0) + data.quantity,
        cost_price: newCost
      })
    } else {
      const remaining = (existing?.quantity || 0) - data.quantity
      if (remaining <= 0) {
        await deleteHolding(data.pool_id, stockCode.value)
      } else {
        await upsertHolding({ pool_id: data.pool_id, stock_code: stockCode.value, stock_name: existing?.stock_name || stockName.value, quantity: remaining, cost_price: existing?.cost_price || 0 })
      }
    }

    await insertCapitalLog({
      pool_id: data.pool_id,
      type: isSell.value ? 'add' : 'remove',
      amount: data.amount,
      note: `${isSell.value ? '卖出' : '买入'} ${stockCode.value}`,
      created_by: 'admin'
    })

    await holdingStore.loadHoldings()
  } catch (e) {
    console.error('Trade submit error:', e)
  }
}

function onVerified(actualAmount) {
  if (lastTransaction.value) {
    txStore.verify(lastTransaction.value.id, actualAmount)
  }
}

onMounted(() => {
  poolStore.loadPools()
  if (route.query.code) {
    // 从持仓页左滑进入：预填股票信息，卖出模式，隐藏子池选择
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
.page-header { padding: 0 0 12px; }
.page-title { font-size: 18px; font-weight: 700; }
.preset-card {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 14px;
  margin-bottom: 16px;
  border-left: 3px solid var(--color-fall);
}
.preset-name { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
.preset-code { font-size: 13px; color: var(--text-secondary); font-weight: 400; }
.preset-info { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-secondary); }
.preset-pool { color: var(--color-fall); }
</style>
