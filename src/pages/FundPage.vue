<template>
  <div class="page fund-page">
    <div class="page-header">
      <span class="page-title">资金管理</span>
    </div>

    <div class="fund-summary">
      <div class="fs-row">
        <span class="fs-label">总可用资金</span>
        <span class="fs-amount num-mono">{{ formatMoney(totalAvailable) }}</span>
      </div>
      <div class="fs-row">
        <span class="fs-label">股票总市值</span>
        <span class="fs-amount num-mono">{{ formatMoney(totalMarketValue) }}</span>
      </div>
    </div>

    <LoadingSkeleton v-if="loading" :count="2" />
    <template v-else>
      <FundAllocationForm
        :pools="poolStore.pools"
        :total-available="totalAvailable"
        :pool-costs="poolCosts"
        :submitting="fundStore.submitting"
        @capital-change="onCapitalChange"
        @alloc-change="onAllocChange"
      />
      <div class="section-card">
        <CapitalLogList :logs="capitalLogs" @delete="onDeleteLog" @edit="onEditLog" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePoolStore } from '@/stores/pools'
import { useFundStore } from '@/stores/funds'
import { useHoldingStore } from '@/stores/holdings'
import { usePriceStore } from '@/stores/prices'
import { useTransactionStore } from '@/stores/transactions'
import { formatMoney } from '@/utils/formatters'
import { deleteCapitalLog, updateCapitalLog, updateTransaction, deleteTransaction, fetchTransactionsByPoolStock, deleteHolding, upsertHolding } from '@/api/supabase'
import FundAllocationForm from '@/components/fund/FundAllocationForm.vue'
import CapitalLogList from '@/components/fund/CapitalLogList.vue'
import LoadingSkeleton from '@/components/common/LoadingSkeleton.vue'

const poolStore = usePoolStore()
const fundStore = useFundStore()
const holdingStore = useHoldingStore()
const priceStore = usePriceStore()
const txStore = useTransactionStore()

const loading = ref(true)
const totalCapital = computed(() => fundStore.totalCapital)

// 各子池持仓成本（用于计算可用资金）
const poolCosts = computed(() => {
  const map = {}
  for (const h of holdingStore.holdings) {
    const pool = poolStore.pools.find(p => p.id === h.pool_id)
    if (pool) map[pool.name] = (map[pool.name] || 0) + h.cost_price * h.quantity
  }
  return map
})

const totalCost = computed(() => {
  return holdingStore.holdings.reduce((s, h) => {
    return s + h.cost_price * h.quantity
  }, 0)
})

const totalMarketValue = computed(() => {
  return holdingStore.holdings.reduce((s, h) => {
    const price = priceStore.prices[h.stock_code]?.price || 0
    return s + price * h.quantity
  }, 0)
})

const floatPnl = computed(() => totalMarketValue.value - totalCost.value)
const totalAsset = computed(() => totalCapital.value + floatPnl.value)
const totalAvailable = computed(() => totalCapital.value - totalCost.value)
// 资金变动记录（仅外部资金，不含股票买卖）
const capitalLogs = computed(() => fundStore.capitalLogs.filter(l => l.pool_id === null))

async function onCapitalChange({ type, amount, note }) {
  try {
    await fundStore.addCapitalLog({
      pool_id: null, type, amount,
      note: note || '',
      created_by: 'admin'
    })
    const { saveCurrentPositionSnapshot } = await import('@/utils/positionSnapshot')
    saveCurrentPositionSnapshot().catch(e => console.error('Position snapshot:', e))
  } catch (e) {
    console.error('Capital change error:', e)
  }
}

function onAllocChange({ pools: allocs }) {
  console.log('Allocation saved:', allocs)
}

async function onEditLog(payload) {
  try {
    const { id, amount, note } = payload
    // 普通资金变动（增资/减资）：更新后刷新，确保总可用联动
    if (!payload.pool_id) {
      await fundStore.editCapitalLog(id, { amount, note })
      await fundStore.loadCapitalLogs()
      return
    }
    // 买入/卖出：需要联动交易 + 持仓
    const { stock_code, quantity: newQty, pool_id, type: capType } = payload
    if (!stock_code || !newQty) {
      await fundStore.editCapitalLog(id, { amount, note })
      await fundStore.loadCapitalLogs()
      return
    }

    // 1. 找对应交易记录（用原金额匹配，因为金额已修改）
    const allTxs = await fetchTransactionsByPoolStock(pool_id, stock_code)
    const matchAmount = payload.origAmount || amount
    const matchedTx = allTxs.find(t => Math.abs(t.amount - matchAmount) < 0.01)
    if (!matchedTx) {
      await fundStore.editCapitalLog(id, { amount, note })
      await fundStore.loadCapitalLogs()
      return
    }

    // 2. 更新交易记录（数量 + 金额）
    const newPrice = newQty > 0 ? amount / newQty : 0
    await updateTransaction(matchedTx.id, { quantity: newQty, amount, price: newPrice, note })
    txStore.transactions = txStore.transactions.map(t =>
      t.id === matchedTx.id ? { ...t, quantity: newQty, amount, price: newPrice, note } : t
    )

    // 3. 用所有交易重算该子池+该股票的持仓
    const isBuy = capType === 'remove'  // capital_log.remove = 买入
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
      const { deleteHolding } = await import('@/api/supabase')
      await deleteHolding(pool_id, stock_code)
    } else {
      const { upsertHolding } = await import('@/api/supabase')
      await upsertHolding({
        pool_id, stock_code,
        stock_name: matchedTx.stock_name || '',
        quantity: netQty,
        cost_price: newCostPrice
      })
    }
    await holdingStore.loadHoldings()

    // 4. 更新资金记录 + 全量刷新
    await fundStore.editCapitalLog(id, { amount, note })
    await fundStore.loadCapitalLogs()
  } catch (e) {
    console.error('Edit log error:', e)
  }
  const { saveCurrentPositionSnapshot } = await import('@/utils/positionSnapshot')
  saveCurrentPositionSnapshot().catch(e => console.error('Position snapshot:', e))
}

async function onDeleteLog(log) {
  try {
    // 普通资金变动（增资/减资）：只删记录
    if (!log.pool_id) {
      await deleteCapitalLog(log.id)
      await fundStore.loadCapitalLogs()
      return
    }

    // 买入/卖出：需要级联交易 + 持仓
    const { id, pool_id, type: capType, amount, note } = log
    const code = parseStockCode2(note)
    if (!code) {
      await deleteCapitalLog(id)
      await fundStore.loadCapitalLogs()
      return
    }

    // 找到对应交易记录
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

    // 最后删资金记录 + 刷新
    await deleteCapitalLog(id)
    await fundStore.loadCapitalLogs()
  } catch (e) {
    console.error('Delete cascade error:', e)
  }
  const { saveCurrentPositionSnapshot } = await import('@/utils/positionSnapshot')
  saveCurrentPositionSnapshot().catch(e => console.error('Position snapshot:', e))
}

function parseStockCode2(note) {
  if (!note) return ''
  const parts = note.split(' ')
  return parts.length > 1 && /^\d{6}$/.test(parts[parts.length - 1]) ? parts[parts.length - 1] : ''
}

onMounted(async () => {
  try {
    await Promise.all([poolStore.loadPools(), holdingStore.loadHoldings(), fundStore.loadCapitalLogs()])
    const codes = holdingStore.stockCodes
    if (codes.length) await priceStore.loadPrices(codes)
  } catch (e) {
    console.error('Fund page load error:', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.fund-summary {
  margin-bottom: 16px;
  padding: 16px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.fs-row { display: flex; justify-content: space-between; align-items: baseline; }
.fs-label { font-size: 13px; color: var(--text-secondary); }
.fs-amount { font-size: 22px; font-weight: 700; font-family: var(--font-number); }
</style>
