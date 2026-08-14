<template>
  <div class="scroll-x pool-selector">
    <div
      v-if="showAll"
      class="pool-tab"
      :class="{ active: current === null }"
      @click="$emit('select', null)"
    >
      总账户
    </div>
    <div
      v-for="pool in pools"
      :key="pool.id"
      class="pool-tab"
      :class="{ active: current === pool.id }"
      :style="current === pool.id ? { background: poolColor(pool.name), color: '#fff' } : {}"
      @click="$emit('select', pool.id)"
    >
      {{ pool.name }}
    </div>
  </div>
</template>

<script setup>
defineProps({
  pools: { type: Array, default: () => [] },
  current: { type: Number, default: null },
  showAll: { type: Boolean, default: true }
})
defineEmits(['select'])

function poolColor(name) {
  const map = { '公共池': '#4d9fff', '春': '#ff4d6d', '维': '#00f0a8', '队': '#ffd23f', '回': '#b18cff' }
  return map[name] || '#4d9fff'
}
</script>

<style scoped>
.pool-selector {
  padding: 4px 0;
  gap: 8px;
}
.pool-tab {
  flex-shrink: 0;
  padding: 6px 16px;
  background: var(--bg-hover);
  border-radius: var(--radius-round);
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
}
.pool-tab.active {
  background: var(--bg-accent);
  color: #fff;
  font-weight: 500;
}
</style>
