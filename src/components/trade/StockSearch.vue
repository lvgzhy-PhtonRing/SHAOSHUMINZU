<template>
  <div class="stock-search">
    <div class="search-row">
      <van-field
        v-model="code"
        maxlength="6"
        placeholder="输入6位股票代码"
        type="digit"
        :border="false"
        class="code-input"
        @update:model-value="onCodeChange"
      />
      <van-button size="small" type="primary" @click="search" :loading="searching">
        查询
      </van-button>
    </div>
    <div v-if="stockInfo" class="stock-info-card">
      <div class="stock-info-header">
        <span class="si-name">{{ stockInfo.stock_name }}</span>
        <span class="si-code">{{ stockInfo.stock_code }}</span>
        <span class="si-market">{{ stockInfo.stock_code?.startsWith('3') ? '创业板' : stockInfo.stock_code?.startsWith('6') ? '沪市' : '深市' }}</span>
      </div>
      <div class="stock-info-price">
        <span class="si-price num-mono">{{ formatPrice(stockInfo.price) }}</span>
        <span class="si-change" :class="(stockInfo.change_pct || 0) >= 0 ? 'rise' : 'fall'">
          {{ stockInfo.change_pct >= 0 ? '+' : '' }}{{ stockInfo.change_pct?.toFixed(2) }}%
        </span>
      </div>
      <div class="stock-info-extra">
        昨收 {{ formatPrice(stockInfo.prev_close) }} · 今开 {{ formatPrice(stockInfo.open) }}
      </div>
    </div>
    <div v-else-if="searched && !searching" class="stock-not-found">
      未找到股票信息，请检查代码
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { fetchStockPrice } from '@/api/stock'
import { isValidStockCode } from '@/utils/validators'
import { formatPrice } from '@/utils/formatters'

const emit = defineEmits(['stock-selected'])
const code = ref('')
const stockInfo = ref(null)
const searching = ref(false)
const searched = ref(false)

function onCodeChange(val) {
  if (val.length < 6) {
    stockInfo.value = null
    searched.value = false
  }
}

async function search() {
  if (!isValidStockCode(code.value)) return
  searching.value = true
  searched.value = true
  try {
    const result = await fetchStockPrice(code.value)
    stockInfo.value = result
    if (result) emit('stock-selected', result)
  } catch (e) {
    stockInfo.value = null
  } finally {
    searching.value = false
  }
}
</script>

<style scoped>
.stock-search { }
.search-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.code-input {
  flex: 1;
  background: var(--bg-card) !important;
  border-radius: var(--radius-md) !important;
  padding: 4px 12px;
}
.stock-info-card {
  margin-top: 8px;
  padding: 12px;
  background: rgba(0,210,161,0.06);
  border-radius: var(--radius-md);
}
.stock-info-header { margin-bottom: 6px; }
.si-name { font-size: 15px; font-weight: 600; margin-right: 8px; }
.si-code { font-size: 12px; color: var(--text-secondary); }
.si-market { font-size: 11px; color: var(--text-secondary); margin-left: 6px; }
.stock-info-price { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
.si-price { font-size: 22px; font-weight: 700; font-family: var(--font-number); }
.si-change { font-size: 14px; font-family: var(--font-number); }
.si-change.rise { color: var(--color-rise); }
.si-change.fall { color: var(--color-fall); }
.stock-info-extra { font-size: 11px; color: var(--text-muted); }
.stock-not-found {
  padding: 12px;
  color: var(--color-fall);
  font-size: 13px;
  text-align: center;
}
</style>
