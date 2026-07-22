<!-- src/components/common/PoolSelector.vue -->
<template>
  <div class="scroll-x pool-selector">
    <div
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
  current: { type: Number, default: null }
})
defineEmits(['select'])

function poolColor(name) {
  const map = { '共有': '#0f3460', '春': '#e94560', '维': '#00d2a1', '队': '#ffc107', '回': '#7c4dff' }
  return map[name] || '#0f3460'
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
