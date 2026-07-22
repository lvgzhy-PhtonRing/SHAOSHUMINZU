<template>
  <div class="page trade-page" style="padding:16px">
    <div class="page-header">
      <span class="page-title">录入交易</span>
      <span class="operator-tag">操作人：管理员</span>
    </div>

    <div class="type-switch">
      <div class="type-tab" :class="{ active: isBuy }" @click="isBuy = true">买入</div>
      <div class="type-tab" :class="{ active: !isBuy }" @click="isBuy = false">卖出</div>
    </div>

    <StockSearch ref="searchRef" @stock-selected="onStockSelected" />

    <TradeForm
      ref="formRef"
      :pools="poolStore.pools"
      :is-buy="isBuy"
      :stock-price="currentPrice"
      :submitting="txStore.submitting"
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
import { usePoolStore } from '@/stores/pools'
import { useTransactionStore } from '@/stores/transactions'
import { useHoldingStore } from '@/stores/holdings'
import { calcNewCostPrice } from '@/utils/calculators'
import { upsertHolding, deleteHolding, insertCapitalLog } from '@/api/supabase'
import StockSearch from '@/components/trade/StockSearch.vue'
import TradeForm from '@/components/trade/TradeForm.vue'
import VerificationCard from '@/components/trade/VerificationCard.vue'

const poolStore = usePoolStore()
const txStore = useTransactionStore()
const holdingStore = useHoldingStore()

const isBuy = ref(true)
const currentPrice = ref(0)
const stockCode = ref('')
const stockName = ref('')
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
      type: isBuy.value ? 'buy' : 'sell',
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

    if (isBuy.value) {
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
      type: isBuy.value ? 'remove' : 'add',
      amount: data.amount,
      note: `${isBuy.value ? '买入' : '卖出'} ${stockCode.value}`,
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
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0 12px;
}
.page-title { font-size: 18px; font-weight: 700; }
.operator-tag { font-size: 12px; padding: 4px 10px; background: var(--bg-hover); border-radius: var(--radius-sm); color: var(--text-secondary); }
.type-switch {
  display: flex;
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 3px;
  margin-bottom: 16px;
}
.type-tab {
  flex: 1;
  text-align: center;
  padding: 10px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}
.type-tab.active { background: var(--color-fall); color: #fff; }
</style>
