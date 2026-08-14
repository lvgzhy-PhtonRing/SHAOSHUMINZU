<template>
  <div class="stock-search">
    <div class="search-row">
      <div class="search-input-wrapper">
        <van-field
          v-model="query"
          placeholder="要买入股票的首字母/代码"
          maxlength="20"
          :border="false"
          class="code-input"
          @update:model-value="onInputChange"
          @focus="onFocus"
          @blur="onBlur"
        />
        <!-- 联想下拉 -->
        <div v-if="showDropdown" class="suggestions-dropdown">
          <div v-if="loadingSuggestions" class="sugg-status">搜索中…</div>
          <template v-else>
            <div
              v-for="item in suggestions"
              :key="item.stock_code"
              class="suggestion-item"
              @mousedown.prevent="selectSuggestion(item)"
              @touchstart.prevent="selectSuggestion(item)"
            >
              <span class="sugg-name">{{ item.stock_name }}</span>
              <span class="sugg-code num-mono">{{ item.stock_code }}</span>
              <span class="sugg-market">{{ item.market === '沪' ? '沪市' : '深市' }}</span>
            </div>
            <div v-if="!loadingSuggestions && suggestions.length === 0 && query.length > 0 && !isCode" class="sugg-empty">
              未找到匹配股票
            </div>
          </template>
        </div>
      </div>
      <van-button size="small" color="#e94560" @click="onBuyClick" :loading="searching" class="buy-btn">
        买入股票
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
    <div v-else-if="searched && !searching && isCode" class="stock-not-found">
      未找到股票信息，请检查代码
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { fetchStockPrice, fetchStockSuggestions, preloadStockList } from '@/api/stock'
import { isValidStockCode } from '@/utils/validators'
import { formatPrice } from '@/utils/formatters'

const emit = defineEmits(['stock-selected', 'buy-clicked'])
const query = ref('')
const stockInfo = ref(null)
const searching = ref(false)
const searched = ref(false)
const suggestions = ref([])
const loadingSuggestions = ref(false)
const showDropdown = ref(false)

let lastRequestId = 0

const isCode = computed(() => /^\d{6}$/.test(query.value))

function onInputChange(val) {
  stockInfo.value = null
  searched.value = false

  if (!val || val.length === 0) {
    suggestions.value = []
    showDropdown.value = false
    return
  }

  // 纯6位数字：自动搜索（现有行为）
  if (/^\d{6}$/.test(val)) {
    showDropdown.value = false
    suggestions.value = []
    search()
    return
  }

  // 纯数字不足6位：等待用户继续输入
  if (/^\d+$/.test(val)) {
    showDropdown.value = false
    return
  }

  // 含字母/中文：本地搜索，毫秒级响应
  const requestId = ++lastRequestId
  loadingSuggestions.value = true
  showDropdown.value = true
  fetchStockSuggestions(query.value).then(results => {
    if (requestId === lastRequestId) {
      suggestions.value = results || []
      loadingSuggestions.value = false
    }
  })
}

function onFocus() {
  preloadStockList()  // 提前加载本地股票列表
  if (query.value && !/^\d+$/.test(query.value) && suggestions.value.length) {
    showDropdown.value = true
  }
}

function onBlur() {
  // 延迟隐藏，让 click/touch 事件先触发
  setTimeout(() => {
    showDropdown.value = false
  }, 150)
}

function selectSuggestion(item) {
  query.value = item.stock_code
  showDropdown.value = false
  suggestions.value = []
  search()
}

async function onBuyClick() {
  if (stockInfo.value) {
    emit('buy-clicked', stockInfo.value)
  } else if (isValidStockCode(query.value)) {
    await search()
    if (stockInfo.value) emit('buy-clicked', stockInfo.value)
  }
}

async function search() {
  if (!isValidStockCode(query.value)) return
  searching.value = true
  searched.value = true
  try {
    const result = await fetchStockPrice(query.value)
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
.buy-btn {
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}
.search-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.search-input-wrapper {
  flex: 1;
  position: relative;
}
.code-input {
  background: var(--bg-card) !important;
  border-radius: var(--radius-md) !important;
  padding: 4px 12px;
}

/* ===== 联想下拉 ===== */
.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 220px;
  overflow-y: auto;
  background: var(--bg-card);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  box-shadow: 0 6px 16px rgba(0,0,0,0.4);
  z-index: 200;
}
.sugg-status {
  padding: 12px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
}
.sugg-empty {
  padding: 12px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}
.suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  cursor: pointer;
  transition: background 0.1s;
}
.suggestion-item:active {
  background: rgba(255,255,255,0.06);
}
.sugg-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sugg-code {
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.sugg-market {
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}

/* ===== 股票信息卡片（不变） ===== */
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
