<template>
  <div class="page fund-page">
    <div class="page-header">
      <span class="page-title">资金池管理</span>
    </div>

    <div class="total-pool-card">
      <div class="tpc-label">总资金池</div>
      <div class="tpc-amount num-mono">{{ formatMoney(totalAsset) }}</div>
      <div class="tpc-grid">
        <div class="tpc-item">
          <span class="tpc-item-label">总市值</span>
          <span class="tpc-item-value num-mono">{{ formatMoney(totalMarketValue) }}</span>
        </div>
        <div class="tpc-item">
          <span class="tpc-item-label">总可用</span>
          <span class="tpc-item-value num-mono">{{ formatMoney(totalAvailable) }}</span>
        </div>
      </div>
    </div>

    <LoadingSkeleton v-if="loading" :count="2" />
    <template v-else>
      <FundAllocationForm
        :pools="poolStore.pools"
        :total-available="totalAvailable"
        :submitting="fundStore.submitting"
        @capital-change="onCapitalChange"
        @alloc-change="onAllocChange"
      />
      <div class="section-card">
        <CapitalLogList :logs="fundStore.capitalLogs" @delete="onDeleteLog" @edit="onEditLog" />
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
import { formatMoney } from '@/utils/formatters'
import { deleteCapitalLog } from '@/api/supabase'
import FundAllocationForm from '@/components/fund/FundAllocationForm.vue'
import CapitalLogList from '@/components/fund/CapitalLogList.vue'
import LoadingSkeleton from '@/components/common/LoadingSkeleton.vue'

const poolStore = usePoolStore()
const fundStore = useFundStore()
const holdingStore = useHoldingStore()
const priceStore = usePriceStore()

const loading = ref(true)
const totalCapital = ref(829661.35)

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

async function onCapitalChange({ type, amount, note }) {
  try {
    await fundStore.addCapitalLog({
      pool_id: null, type, amount,
      note: note || '',
      created_by: 'admin'
    })
    if (type === 'add') totalCapital.value += amount
    else totalCapital.value -= amount
    await fundStore.loadCapitalLogs()
  } catch (e) {
    console.error('Capital change error:', e)
  }
}

function onAllocChange({ pools: allocs }) {
  console.log('Allocation saved:', allocs)
}

async function onEditLog({ id, amount, note }) {
  try {
    await fundStore.editCapitalLog(id, { amount, note })
  } catch (e) {
    console.error('Edit log error:', e)
  }
}

async function onDeleteLog(id) {
  try {
    await deleteCapitalLog(id)
    await fundStore.loadCapitalLogs()
  } catch (e) {
    console.error('Delete log error:', e)
  }
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
.total-pool-card {
  margin-bottom: 16px;
  padding: 16px;
  background: linear-gradient(135deg, #0f3460, #1a1a2e);
  border-radius: var(--radius-lg);
}
.tpc-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.tpc-amount { font-size: 28px; font-weight: 700; font-family: var(--font-number); margin-bottom: 12px; }
.tpc-grid { display: flex; gap: 16px; }
.tpc-item { display: flex; flex-direction: column; gap: 2px; }
.tpc-item-label { font-size: 11px; color: var(--text-muted); }
.tpc-item-value { font-size: 14px; font-weight: 500; font-family: var(--font-number); }
</style>
