<!-- src/components/dashboard/HoldingCard.vue -->
<template>
  <van-swipe-cell :right-width="80">
    <div class="holding-card" @click="$emit('tap', stock)">
      <div class="holding-header">
        <div class="holding-name">
          <span class="stock-name">{{ stock.stock_name }}</span>
          <span class="stock-code">{{ stock.stock_code }}</span>
        </div>
        <span class="stock-change" :class="costReturn >= 0 ? 'rise' : 'fall'">
          {{ costReturn >= 0 ? '+' : '' }}{{ costReturn.toFixed(2) }}%
        </span>
      </div>
      <div class="holding-details">
        <div class="detail-item">
          <span class="detail-label">现价</span>
          <span class="detail-value num-mono">{{ formatPrice(stock.currentPrice) }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">成本</span>
          <span class="detail-value num-mono">{{ formatPrice(stock.cost_price) }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">持仓</span>
          <span class="detail-value num-mono">{{ formatQuantity(stock.quantity) }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">盈亏</span>
          <span class="detail-value num-mono" :class="stock.profit >= 0 ? 'rise' : 'fall'">
            {{ formatChange(stock.profit) }}
          </span>
        </div>
      </div>
      <div class="holding-footer">
        <span class="market-value">市值 {{ formatMoney(stock.marketValue) }}</span>
        <span class="pool-tag" :style="{ background: poolColor + '22', color: poolColor }">
          {{ poolName }}
        </span>
      </div>
    </div>
    <template #right>
      <div class="swipe-sell-btn" @click="$emit('sell', stock)">
        卖出
      </div>
    </template>
  </van-swipe-cell>
</template>

<script setup>
import { computed } from 'vue'
import { formatMoney, formatPrice, formatQuantity, formatChange } from '@/utils/formatters'

const props = defineProps({
  stock: { type: Object, required: true },
  poolName: { type: String, default: '' },
  poolColor: { type: String, default: '#0f3460' }
})

defineEmits(['sell', 'tap'])

const costReturn = computed(() => {
  const cp = parseFloat(props.stock.cost_price) || 0
  const np = parseFloat(props.stock.currentPrice) || 0
  return cp > 0 ? ((np - cp) / cp) * 100 : 0
})
</script>

<style scoped>
.holding-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  margin-bottom: 6px;
  position: relative;
}
.holding-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.holding-name {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.stock-name { font-size: 15px; font-weight: 600; }
.stock-code { font-size: 11px; color: var(--text-secondary); }
.stock-change { font-size: 13px; font-weight: 500; font-family: var(--font-number); }
.stock-change.rise { color: var(--color-rise); }
.stock-change.fall { color: var(--color-fall); }
.holding-details {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}
.detail-item { display: flex; flex-direction: column; }
.detail-label { font-size: 11px; color: var(--text-secondary); margin-bottom: 2px; }
.detail-value { font-size: 14px; font-weight: 600; font-family: var(--font-number); }
.detail-value.rise { color: var(--color-rise); }
.detail-value.fall { color: var(--color-fall); }
.holding-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,0.04);
}
.market-value { font-size: 12px; color: var(--text-secondary); font-family: var(--font-number); }
.pool-tag { font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 500; }
.swipe-sell-btn {
  height: 100%;
  width: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e94560;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
  margin: 0 16px 10px 0;
}
</style>
