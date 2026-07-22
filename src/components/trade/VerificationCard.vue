<template>
  <div class="verify-card">
    <div class="verify-header">
      <span class="verify-title">🔍 校对交易</span>
      <span class="verify-hint">实际成交可能有手续费差异</span>
    </div>
    <div class="verify-body">
      <div class="verify-row">
        <span class="verify-label">原始金额</span>
        <span class="verify-value num-mono">{{ formatMoney(originalAmount) }}</span>
      </div>
      <div class="verify-row">
        <span class="verify-label">实际金额</span>
        <van-field v-model="actualAmount" type="digit" placeholder="输入券商实际成交金额" :border="false" class="verify-input" />
      </div>
      <div v-if="diff !== 0" class="verify-diff" :class="diff > 0 ? 'fall' : 'rise'">
        差额：{{ diff > 0 ? '+' : '' }}{{ formatMoney(diff) }}（含手续费）
      </div>
      <van-button size="small" :color="verified ? '#00d2a1' : '#e94560'" :disabled="!actualAmount || verified" @click="doVerify" class="verify-btn">
        {{ verified ? '✓ 已校正' : '确认校正' }}
      </van-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { formatMoney } from '@/utils/formatters'

const props = defineProps({
  originalAmount: { type: Number, required: true }
})
const emit = defineEmits(['verified'])
const actualAmount = ref('')
const verified = ref(false)

const diff = computed(() => {
  const actual = parseFloat(actualAmount.value) || 0
  return actual - props.originalAmount
})

function doVerify() {
  const actual = parseFloat(actualAmount.value)
  if (!actual) return
  verified.value = true
  emit('verified', actual)
}
</script>

<style scoped>
.verify-card {
  margin: 16px 4px;
  padding: 14px;
  background: rgba(233,69,96,0.04);
  border-radius: var(--radius-lg);
  border: 1px dashed rgba(233,69,96,0.2);
}
.verify-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.verify-title { font-size: 13px; font-weight: 600; color: var(--color-fall); }
.verify-hint { font-size: 11px; color: var(--text-muted); }
.verify-body { display: flex; flex-direction: column; gap: 8px; }
.verify-row { display: flex; justify-content: space-between; align-items: center; }
.verify-label { font-size: 13px; color: var(--text-secondary); }
.verify-value { font-size: 14px; font-weight: 600; font-family: var(--font-number); }
.verify-input { flex: 1; margin-left: 12px; }
.verify-diff { font-size: 12px; font-family: var(--font-number); text-align: right; }
.verify-diff.fall { color: var(--color-fall); }
.verify-diff.rise { color: var(--color-rise); }
.verify-btn { margin-top: 8px; align-self: flex-end; }
</style>
