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
    <div class="pos-fund-line">
      <span class="pf-label">初始分配</span>
      <span class="pf-value num-mono">{{ formatMoney(capitalAlloc) }}</span>
      <span class="pf-sep">|</span>
      <span class="pf-label">可用资金</span>
      <span class="pf-value num-mono" :class="availableFunds >= 0 ? '' : 'negative'">{{ formatMoney(availableFunds) }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatMoney } from '@/utils/formatters'
const props = defineProps({
  name: { type: String, required: true },
  percent: { type: Number, default: 0 },
  marketValue: { type: Number, default: 0 },
  totalPoolAsset: { type: Number, default: 0 },
  capitalAlloc: { type: Number, default: 0 },
  poolCost: { type: Number, default: 0 },
  color: { type: String, default: '#0f3460' },
  wide: { type: Boolean, default: false }
})
const availableFunds = computed(() => props.capitalAlloc - props.poolCost)
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
.pos-fund-line {
  display: flex; align-items: baseline; gap: 4px; flex-wrap: wrap;
  margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.04);
}
.pf-label { font-size: 10px; color: var(--text-muted); }
.pf-value { font-size: 11px; font-weight: 600; font-family: var(--font-number); color: var(--text-secondary); }
.pf-value.negative { color: var(--color-fall); }
.pf-sep { font-size: 9px; color: var(--text-muted); padding: 0 2px; }
</style>
