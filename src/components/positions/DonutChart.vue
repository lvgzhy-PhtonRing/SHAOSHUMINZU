<template>
  <div class="donut-chart">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
      <circle
        :cx="center" :cy="center" :r="radius"
        fill="none" stroke="rgba(255,255,255,0.06)"
        :stroke-width="strokeWidth"
      />
      <circle
        v-for="(seg, i) in segments"
        :key="i"
        :cx="center" :cy="center" :r="radius"
        fill="none"
        :stroke="seg.color"
        :stroke-width="strokeWidth"
        :stroke-dasharray="`${seg.arcLength} ${circumference - seg.arcLength}`"
        :stroke-dashoffset="seg.offset"
        stroke-linecap="round"
        :transform="`rotate(-90 ${center} ${center})`"
        class="donut-segment"
      />
      <text :x="center" :y="center - 8" text-anchor="middle" fill="#fff" font-size="32" font-weight="700" font-family="var(--font-number)">
        {{ totalPercent.toFixed(1) }}%
      </text>
      <text :x="center" :y="center + 16" text-anchor="middle" fill="#888" font-size="13">
        总仓位
      </text>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  segments: { type: Array, default: () => [] },
  totalPercent: { type: Number, default: 0 },
  size: { type: Number, default: 200 }
})

const center = computed(() => props.size / 2)
const radius = computed(() => props.size / 2 - 20)
const strokeWidth = computed(() => Math.max(props.size * 0.08, 14))
const circumference = computed(() => 2 * Math.PI * radius.value)
</script>

<style scoped>
.donut-chart {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}
.donut-segment {
  transition: stroke-dasharray 0.6s ease;
}
</style>
