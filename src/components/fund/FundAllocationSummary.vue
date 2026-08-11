<template>
  <div class="card">
    <div class="card-title">子池资金分配</div>
    <div class="card-desc">
      总资本 <b class="num-mono">{{ formatMoney(totalCapital) }}</b>
    </div>

    <div class="alloc-list">
      <div class="pool-row">
        <div class="pool-left"><span class="dot" style="background:#0f3460"></span>公共池</div>
        <span class="alloc-wan num-mono">{{ wan(gongyouAlloc) }} 万</span>
        <span class="avl num-mono" :class="{ neg: gongyouAvailable <= 0 }">
          <template v-if="gongyouAvailable <= 0">⚠️ </template>可用 {{ formatMoney(gongyouAvailable) }}
        </span>
        <span class="mv num-mono">市值 {{ formatMoney(gongyouMv) }}</span>
      </div>
      <div class="pool-row" v-for="u in users" :key="u.key">
        <div class="pool-left"><span class="dot" :style="{ background: u.color }"></span>{{ u.name }}</div>
        <span class="alloc-wan num-mono">{{ wan(allocation[u.key] || 0) }} 万</span>
        <span class="avl num-mono" :class="{ neg: availableOf(u.key) <= 0 }">
          <template v-if="availableOf(u.key) <= 0">⚠️ </template>可用 {{ formatMoney(availableOf(u.key)) }}
        </span>
        <span class="mv num-mono">市值 {{ formatMoney(marketValueOf(u.key)) }}</span>
      </div>
    </div>

    <button class="edit-btn" @click="emit('edit')">✏️ 调整分配</button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatMoney } from '@/utils/formatters'

const props = defineProps({
  allocation: { type: Object, default: () => ({}) },
  poolFlows: { type: Object, default: () => ({}) },
  poolMarketValues: { type: Object, default: () => ({}) },
  totalCapital: { type: Number, default: 0 }
})
const emit = defineEmits(['edit'])

const users = [
  { key: '春', name: '春', color: '#e94560' },
  { key: '维', name: '维', color: '#00d2a1' },
  { key: '队', name: '队', color: '#ffc107' },
  { key: '回', name: '回', color: '#7c4dff' }
]

const wan = (yuan) => (yuan / 10000).toFixed(1)

const flowOf = (k) => props.poolFlows[k] || { sellIn: 0, buyOut: 0 }
// 可用 = 初始分配 + 卖出到账 − 买入支出（与 totalAvailable 一致）
const availableOf = (k) => (props.allocation[k] || 0) + flowOf(k).sellIn - flowOf(k).buyOut
const marketValueOf = (k) => props.poolMarketValues[k] || 0

const usersTotal = computed(() => users.reduce((s, u) => s + (props.allocation[u.key] || 0), 0))
const gongyouAlloc = computed(() => props.totalCapital - usersTotal.value)
const gongyouAvailable = computed(() => gongyouAlloc.value + flowOf('公共池').sellIn - flowOf('公共池').buyOut)
const gongyouMv = computed(() => props.poolMarketValues['公共池'] || 0)
</script>

<style scoped>
.card { background: var(--bg-card); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 12px; }
.card-title { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
.card-desc { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }
.card-desc b { color: #fff; }
.alloc-list { border-top: 1px solid rgba(255,255,255,0.06); }
.pool-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
.pool-row:last-child { border-bottom: none; }
.pool-left { display: flex; align-items: center; gap: 6px; min-width: 52px; font-size: 13px; flex-shrink: 0; }
.dot { width: 7px; height: 7px; border-radius: 50%; }
.alloc-wan { margin-left: auto; font-size: 13px; color: var(--text-primary); }
.avl { font-size: 11px; color: var(--text-secondary); font-weight: 500; }
.avl.neg { color: var(--color-fall); }
.mv { font-size: 11px; color: var(--text-muted); }
.edit-btn {
  width: 100%; margin-top: 12px; padding: 12px; border: none; border-radius: var(--radius-md);
  background: var(--bg-accent); color: #fff; font-size: 15px; font-weight: 600; cursor: pointer;
}
</style>
