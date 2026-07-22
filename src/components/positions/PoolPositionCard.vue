<template>
  <div class="pool-pos-card" :class="{ wide }" :style="{ borderLeftColor: color }">
    <div class="pos-label">{{ name }}</div>
    <div class="pos-percent num-mono">{{ percent.toFixed(1) }}%</div>
    <div class="pos-amount num-mono">市值 {{ formatMoney(marketValue) }}</div>
  </div>
</template>

<script setup>
import { formatMoney } from '@/utils/formatters'
defineProps({
  name: { type: String, required: true },
  percent: { type: Number, default: 0 },
  marketValue: { type: Number, default: 0 },
  color: { type: String, default: '#0f3460' },
  wide: { type: Boolean, default: false }
})
</script>

<style scoped>
.pool-pos-card {
  background: var(--bg-card); border-radius: var(--radius-lg); padding: 12px 14px; border-left: 3px solid;
}
.pool-pos-card.wide .pos-percent { font-size: 26px; }
.pos-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.pos-percent {
  font-size: 20px; font-weight: 700; margin-bottom: 4px; font-family: var(--font-number);
}
.pos-amount { font-size: 12px; color: var(--text-secondary); font-family: var(--font-number); }
</style>
