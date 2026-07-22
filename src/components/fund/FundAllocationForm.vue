<template>
  <div class="allocation-form">
    <van-form @submit="onSubmit">
      <div class="type-switch">
        <div class="type-tab" :class="{ active: isAdd }" @click="isAdd = true">增资 ➕</div>
        <div class="type-tab" :class="{ active: !isAdd }" @click="isAdd = false">减资 ➖</div>
      </div>

      <van-field
        v-model="totalAmount"
        label="总金额（元）"
        type="digit"
        placeholder="请输入总金额"
        :rules="[{ required: true, message: '请输入总金额' }]"
        @update:model-value="calcAutoAllocation"
      />

      <div class="alloc-section">
        <div class="alloc-header">
          <span class="alloc-title">分配到各子池</span>
          <van-button size="mini" plain @click="equalAllocate">平均</van-button>
        </div>
        <div v-for="(pool, i) in allocations" :key="pool.id" class="alloc-row">
          <span class="pool-name" :style="{ color: poolColors[i] }">{{ pool.name }}</span>
          <van-field v-model="pool.amount" type="digit" placeholder="0" :border="false" class="alloc-input" @update:model-value="updatePercent" />
          <span class="alloc-percent num-mono">{{ pool.percent.toFixed(1) }}%</span>
        </div>
        <div class="alloc-total">
          <span>合计</span>
          <span class="num-mono" :class="totalDiff ? 'fall' : 'rise'">{{ formatMoney(allocationSum) }}</span>
          <span class="alloc-status" v-if="!totalDiff">✓</span>
          <span class="alloc-status fall" v-else>差额 {{ formatMoney(Math.abs(totalDiff)) }}</span>
        </div>
      </div>

      <van-field v-model="note" label="备注（可选）" placeholder="例：7月新增资金" />

      <div style="margin: 16px 0">
        <van-button round block type="primary" native-type="submit" :color="isAdd ? '#00d2a1' : '#e94560'" :disabled="!allocationValid" :loading="submitting">
          {{ isAdd ? '✅ 确认增资并分配' : '✅ 确认减资并扣除' }}
        </van-button>
      </div>
    </van-form>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { formatMoney } from '@/utils/formatters'

const props = defineProps({
  pools: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false }
})

const emit = defineEmits(['submit'])
const isAdd = ref(true)
const totalAmount = ref('')
const note = ref('')

const poolColors = ['#0f3460', '#e94560', '#00d2a1', '#ffc107', '#7c4dff']

const allocations = ref([])

function initAllocations() {
  allocations.value = props.pools.map(p => ({ ...p, amount: '', percent: 0 }))
}

function equalAllocate() {
  const total = parseFloat(totalAmount.value) || 0
  const each = allocations.value.length > 0 ? total / allocations.value.length : 0
  allocations.value.forEach(a => { a.amount = each.toFixed(2); a.percent = allocations.value.length > 0 ? 100 / allocations.value.length : 0 })
}

function calcAutoAllocation() {
  if (allocations.value.every(a => !a.amount)) {
    equalAllocate()
  }
}

function updatePercent() {
  const total = parseFloat(totalAmount.value) || 0
  allocations.value.forEach(a => {
    const val = parseFloat(a.amount) || 0
    a.percent = total > 0 ? (val / total) * 100 : 0
  })
}

const allocationSum = computed(() => allocations.value.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0))
const totalDiff = computed(() => (parseFloat(totalAmount.value) || 0) - allocationSum.value)
const allocationValid = computed(() => totalAmount.value && parseFloat(totalAmount.value) > 0 && Math.abs(totalDiff.value) < 0.01)

function onSubmit() {
  if (!allocationValid.value) return
  emit('submit', {
    type: isAdd.value ? 'add' : 'remove',
    totalAmount: parseFloat(totalAmount.value),
    allocations: allocations.value.map(a => ({ pool_id: a.id, amount: parseFloat(a.amount) || 0 })),
    note: note.value
  })
}

initAllocations()
</script>

<style scoped>
.allocation-form { padding: 0 4px; }
.type-switch { display: flex; background: var(--bg-card); border-radius: var(--radius-md); padding: 3px; margin-bottom: 16px; }
.type-tab { flex: 1; text-align: center; padding: 10px; border-radius: 6px; font-weight: 600; font-size: 14px; color: var(--text-secondary); cursor: pointer; }
.type-tab.active { background: var(--color-rise); color: #1a1a2e; }
.type-tab:last-child.active { background: var(--color-fall); color: #fff; }
.alloc-section { background: var(--bg-card); border-radius: var(--radius-md); padding: 12px; margin-bottom: 12px; }
.alloc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.alloc-title { font-size: 13px; font-weight: 600; }
.alloc-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
.alloc-row:last-child { border-bottom: none; }
.pool-name { font-size: 13px; font-weight: 500; width: 36px; }
.alloc-input { flex: 1; }
.alloc-percent { font-size: 12px; color: var(--text-secondary); width: 60px; text-align: right; font-family: var(--font-number); }
.alloc-total { display: flex; align-items: center; gap: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 13px; font-weight: 600; }
.alloc-total .num-mono { flex: 1; text-align: right; font-family: var(--font-number); }
.alloc-total .rise { color: var(--color-rise); }
.alloc-total .fall { color: var(--color-fall); }
.alloc-status { font-size: 12px; font-weight: 400; }
</style>
