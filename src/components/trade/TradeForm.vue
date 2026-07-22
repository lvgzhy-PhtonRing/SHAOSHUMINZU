<template>
  <div class="trade-form">
    <van-form @submit="onSubmit">
      <div v-if="!hidePool" class="form-section">
        <label class="form-label">所属子池</label>
        <PoolSelector
          :pools="pools"
          :current="selectedPool"
          :show-all="false"
          @select="selectedPool = $event"
        />
        <div v-if="!selectedPool && submitted" class="form-error">请选择子池</div>
      </div>

      <van-field
        v-model="form.totalAmount"
        label="成交总金额（元）"
        type="number"
        placeholder="输入成交总金额（含手续费）"
        class="trade-form-field"
        :rules="[{ required: true, message: '请输入成交总金额' }]"
      />

      <van-field
        v-model="form.quantity"
        label="成交数量（股）"
        type="digit"
        placeholder="100的整数倍"
        class="trade-form-field"
        :rules="[
          { required: true, message: '请输入成交数量' },
          { validator: v => /^\d+$/.test(v) && parseInt(v) % 100 === 0, message: 'A股需为100的整数倍' }
        ]"
      />

      <div class="calc-display">
        <div class="calc-item">
          <span class="calc-label">计算成本价</span>
          <span class="calc-value num-mono">{{ computedCostPrice }}</span>
        </div>
        <div class="calc-item" v-if="stockPrice > 0">
          <span class="calc-label">实时市价</span>
          <span class="calc-value num-mono rise">{{ formatPrice(stockPrice) }}</span>
        </div>
        <div class="calc-item" v-if="stockPrice > 0 && parseInt(form.quantity)">
          <span class="calc-label">当前市值</span>
          <span class="calc-value num-mono">{{ formatMoney(stockPrice * (parseInt(form.quantity) || 0)) }}</span>
        </div>
      </div>

      <van-field
        v-model="form.date"
        label="成交日期"
        type="date"
        class="trade-form-field"
        :rules="[{ required: true, message: '请选择日期' }]"
      />

      <van-field v-model="form.note" label="备注（可选）" placeholder="如：盘中买入" class="trade-form-field" />

      <div style="margin: 16px 0">
        <van-button
          round
          block
          type="primary"
          :loading="submitting"
          :color="isBuy ? '#e94560' : '#00d2a1'"
          @click="onSubmit"
        >
          {{ isBuy ? '📝 录入买入' : '📝 录入卖出' }}
        </van-button>
      </div>
      <div v-if="submitError" style="color:var(--color-fall);font-size:12px;text-align:center;margin-bottom:8px">{{ submitError }}</div>
    </van-form>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { formatMoney, formatPrice } from '@/utils/formatters'
import PoolSelector from '@/components/common/PoolSelector.vue'

const props = defineProps({
  pools: { type: Array, default: () => [] },
  isBuy: { type: Boolean, default: true },
  stockPrice: { type: Number, default: 0 },
  submitting: { type: Boolean, default: false },
  hidePool: { type: Boolean, default: false },
  presetPoolId: { type: Number, default: null }
})

const emit = defineEmits(['submit'])
const selectedPool = ref(props.presetPoolId)
const submitted = ref(false)
const submitError = ref('')

const form = ref({
  totalAmount: '',
  quantity: '',
  date: new Date().toISOString().split('T')[0],
  note: ''
})

const computedCostPrice = computed(() => {
  const amount = parseFloat(form.value.totalAmount) || 0
  const qty = parseInt(form.value.quantity) || 0
  if (amount > 0 && qty > 0) {
    return formatPrice(amount / qty)
  }
  return '—'
})

function onSubmit() {
  submitted.value = true
  submitError.value = ''
  if (!selectedPool.value && !props.hidePool) {
    submitError.value = '请选择所属子池'
    return
  }
  if (!form.value.totalAmount || parseFloat(form.value.totalAmount) <= 0) {
    submitError.value = '请输入成交总金额'
    return
  }
  if (!form.value.quantity || parseInt(form.value.quantity) <= 0) {
    submitError.value = '请输入成交数量'
    return
  }
  if (parseInt(form.value.quantity) % 100 !== 0) {
    submitError.value = '数量必须为100的整数倍'
    return
  }
  const amount = parseFloat(form.value.totalAmount)
  const qty = parseInt(form.value.quantity)
  emit('submit', {
    pool_id: selectedPool.value || props.presetPoolId,
    quantity: qty,
    price: qty > 0 ? amount / qty : 0,
    amount: amount,
    trade_date: form.value.date,
    note: form.value.note
  })
}
</script>

<style scoped>
.trade-form { }
.form-section { margin-bottom: 12px; }
.form-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; display: block; }
.form-error { color: var(--color-fall); font-size: 12px; margin-top: 4px; }
.calc-display {
  padding: 10px 12px;
  background: rgba(255,255,255,0.03);
  border-radius: var(--radius-md);
  margin: 8px 0;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.calc-item { display: flex; flex-direction: column; gap: 2px; }
.calc-label { font-size: 11px; color: var(--text-secondary); }
.calc-value { font-size: 16px; font-weight: 600; font-family: var(--font-number); }
.calc-value.rise { color: var(--color-rise); }
</style>

<style>
/* Vant 表单域暗色主题覆写 */
.van-cell.trade-form-field {
  background: rgba(255,255,255,0.04) !important;
  border-radius: var(--radius-md) !important;
  margin-bottom: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(255,255,255,0.06);
}
.van-cell.trade-form-field .van-field__label {
  color: var(--text-secondary);
  font-size: 12px;
  width: auto;
  margin-right: 8px;
}
.van-cell.trade-form-field .van-field__control {
  color: #fff;
  font-size: 15px;
  text-align: right;
  font-family: var(--font-number);
}
.van-cell.trade-form-field .van-field__control::placeholder {
  color: rgba(255,255,255,0.25);
}
.van-cell.trade-form-field .van-field__body {
  background: transparent;
}
</style>
