<template>
  <div class="trade-form">
    <van-form @submit="onSubmit">
      <div v-if="!hidePool" class="form-section">
        <label class="form-label">所属子池 <span class="required">*</span></label>
        <PoolSelector
          :pools="pools"
          :current="selectedPool"
          :show-all="false"
          @select="selectedPool = $event"
        />
        <div v-if="!selectedPool && submitted" class="form-error">请选择子池</div>
      </div>

      <van-field
        v-model="form.price"
        label="成交单价（元）"
        type="number"
        placeholder="输入成交单价"
        class="trade-form-field"
        :rules="[{ required: true, message: '请输入成交单价' }]"
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
          <span class="calc-label">股票总金额</span>
          <span class="calc-value num-mono">{{ computedAmount || '—' }}</span>
        </div>
        <div class="calc-item">
          <span class="calc-label">手续费</span>
          <span class="calc-value num-mono">{{ computedFee || '—' }}</span>
        </div>
        <div class="calc-item" v-if="stockPrice > 0">
          <span class="calc-label">实时市价</span>
          <span class="calc-value num-mono" :class="priceVsMarket >= 0 ? 'rise' : 'fall'">{{ formatPrice(stockPrice) }}</span>
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
import { ref, computed, watch } from 'vue'
import { formatMoney, formatPrice } from '@/utils/formatters'
import { calcBuyFee } from '@/utils/feeCalculator'
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
const selectedPool = ref(props.presetPoolId || null)
const submitted = ref(false)

watch(() => props.pools, (list) => {
  if (!selectedPool.value && list && list.length && !props.hidePool) {
    selectedPool.value = list[0]?.id || null
  }
}, { immediate: true })
const submitError = ref('')

const form = ref({
  price: '',
  quantity: '',
  date: new Date().toISOString().split('T')[0],
  note: ''
})

const computedAmount = computed(() => {
  const p = parseFloat(form.value.price) || 0
  const q = parseInt(form.value.quantity) || 0
  if (p > 0 && q > 0) return formatMoney(p * q)
  return ''
})
const computedFee = computed(() => {
  const p = parseFloat(form.value.price) || 0
  const q = parseInt(form.value.quantity) || 0
  if (p > 0 && q > 0) return formatMoney(calcBuyFee(p * q))
  return ''
})
const priceVsMarket = computed(() => {
  const p = parseFloat(form.value.price) || 0
  return props.stockPrice > 0 ? p - props.stockPrice : 0
})

function onSubmit() {
  submitted.value = true
  submitError.value = ''
  if (!selectedPool.value && !props.hidePool) {
    submitError.value = '请选择所属子池'
    return
  }
  const price = parseFloat(form.value.price)
  if (!price || price <= 0) {
    submitError.value = '请输入成交单价'
    return
  }
  const qty = parseInt(form.value.quantity)
  if (!qty || qty <= 0) {
    submitError.value = '请输入成交数量'
    return
  }
  if (qty % 100 !== 0) {
    submitError.value = '数量必须为100的整数倍'
    return
  }
  const amount = parseFloat((price * qty).toFixed(2))
  emit('submit', {
    pool_id: selectedPool.value || props.presetPoolId,
    quantity: qty,
    price,
    amount,
    trade_date: form.value.date,
    note: form.value.note
  })
}
</script>

<style scoped>
.trade-form { }
.form-section { margin-bottom: 12px; }
.form-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; display: block; }
.required { color: var(--color-fall); }
.form-error { color: var(--color-fall); font-size: 12px; margin-top: 4px; }
.calc-display {
  padding: 10px 12px;
  background: rgba(255,255,255,0.03);
  border-radius: var(--radius-md);
  margin: 8px 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
}
.calc-item { display: flex; flex-direction: column; gap: 2px; }
.calc-label { font-size: 11px; color: var(--text-secondary); }
.calc-value { font-size: 16px; font-weight: 600; font-family: var(--font-number); }
.calc-value.rise { color: var(--color-rise); }
.calc-value.fall { color: var(--color-fall); }
</style>

<style>
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
