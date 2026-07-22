<!-- src/components/dashboard/ProfitCard.vue -->
<template>
  <div class="profit-grid">
    <div class="profit-item" :class="floatPnl >= 0 ? 'rise' : 'fall'">
      <div class="profit-label">浮动盈亏</div>
      <div class="profit-value num-mono">{{ formatChange(floatPnl) }}</div>
    </div>
    <div class="profit-item" :class="dailyPnl >= 0 ? 'rise' : 'fall'">
      <div class="profit-label">当日盈亏</div>
      <div class="profit-value num-mono">{{ formatChange(dailyPnl) }}</div>
    </div>
  </div>
</template>

<script setup>
import { formatChange } from '@/utils/formatters'

defineProps({
  floatPnl: { type: Number, default: 0 },
  dailyPnl: { type: Number, default: 0 }
})
</script>

<style scoped>
.profit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.profit-item {
  padding: 10px 12px;
  border-radius: var(--radius-md);
}
.profit-item.fall {
  background: rgba(233,69,96,0.08);
}
.profit-item.rise {
  background: rgba(0,210,161,0.08);
}
.profit-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.profit-value {
  font-size: 16px;
  font-weight: 600;
  font-family: var(--font-number);
}
.fall .profit-value { color: var(--color-fall); }
.rise .profit-value { color: var(--color-rise); }
</style>
