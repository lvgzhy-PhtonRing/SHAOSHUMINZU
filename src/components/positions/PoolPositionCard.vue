<template>
  <div class="pool-pos-card" :class="{ wide }" :style="{ borderLeftColor: color }">
    <div class="pos-header">
      <span class="pos-label">{{ name }}</span>
      <span class="pos-percent num-mono">{{ percent.toFixed(1) }}%</span>
    </div>
    <div class="pos-ratio-line">
      <span class="pr-label">市值</span>
      <span class="pr-value num-mono">{{ formatMoney(marketValue) }}</span>
      <span class="pr-sep">/</span>
      <span class="pr-label">子池资产</span>
      <span class="pr-value num-mono">{{ formatMoney(totalPoolAsset) }}</span>
    </div>
  </div>
</template>

<script setup>
import { formatMoney } from '@/utils/formatters'
defineProps({
  name: { type: String, required: true },
  percent: { type: Number, default: 0 },
  marketValue: { type: Number, default: 0 },
  totalPoolAsset: { type: Number, default: 0 },
  color: { type: String, default: '#0f3460' },
  wide: { type: Boolean, default: false }
})
</script>

<style scoped>
.pool-pos-card {
  background: var(--bg-card); border-radius: var(--radius-lg); padding: 12px 14px; border-left: 3px solid;
}
.wide .pos-percent { font-size: 26px; }
.pos-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
.pos-label { font-size: 12px; color: var(--text-secondary); }
.pos-percent { font-size: 20px; font-weight: 700; font-family: var(--font-number); }
.pos-ratio-line {
  display: flex; align-items: baseline; gap: 4px; flex-wrap: wrap;
}
.pr-label { font-size: 10px; color: var(--text-muted); }
.pr-value { font-size: 12px; font-weight: 600; font-family: var(--font-number); color: var(--text-secondary); }
.pr-sep { font-size: 10px; color: var(--text-muted); }
</style>
