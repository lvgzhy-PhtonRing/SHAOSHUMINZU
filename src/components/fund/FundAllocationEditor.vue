<template>
  <teleport to="body">
    <div class="overlay" @click.self="close">
      <div class="editor">
        <div class="ed-head">
          <span class="ed-title">调整初始分配</span>
          <button class="ed-close" @click="close">✕</button>
        </div>

        <div class="ed-sub">总可用资金 <b class="num-mono">{{ formatMoney(totalAvailable) }}</b></div>

        <div class="link-row">
          <span class="link-label">🔗 四人联动</span>
          <button class="link-btn" :class="{ on: linked }" @click="toggleLink">
            {{ linked ? '已联动 · 等额' : '已解除 · 独立' }}
          </button>
        </div>

        <template v-if="linked">
          <div class="slider-row">
            <div class="sr-head">
              <span class="sr-name">每人初始分配</span>
              <b class="num-mono">{{ wan(sharedVal) }} 万</b>
            </div>
            <van-slider v-model="sharedVal" :min="sliderMin" :max="sliderMax" :step="STEP" />
            <div class="sr-meta">
              四人合计 {{ wan(usersTotal) }}万 ·
              每人可用 {{ formatMoney(sharedVal - maxCost) }}
            </div>
          </div>
        </template>
        <template v-else>
          <div v-for="u in users" :key="u.key" class="slider-row">
            <div class="sr-head">
              <span class="sr-name"><i :style="{ background: u.color }"></i>{{ u.name }}</span>
              <b class="num-mono">{{ wan(amounts[u.key]) }} 万</b>
            </div>
            <van-slider v-model="amounts[u.key]" :min="floorOf(u.key)" :max="maxOf(u.key)" :step="STEP" />
            <div class="sr-meta">可用 {{ formatMoney(availableOf(u.key)) }}</div>
          </div>
        </template>

        <div class="public-row">
          <span>公共池（剩余）</span>
          <span class="num-mono">{{ wan(publicAlloc) }} 万 · 可用 {{ formatMoney(publicAvailable) }}</span>
        </div>

        <div v-if="errorMsg" class="err">{{ errorMsg }}</div>

        <div class="ed-btns">
          <button class="d-cancel" @click="close">取消</button>
          <button class="d-ok" :disabled="!canSave" @click="doSave">✅ 保存分配</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { formatMoney } from '@/utils/formatters'

const props = defineProps({
  allocation: { type: Object, default: () => ({}) },
  poolCosts: { type: Object, default: () => ({}) },
  totalAvailable: { type: Number, default: 0 }
})
const emit = defineEmits(['close', 'save'])

const STEP = 10000
const users = [
  { key: '春', name: '春', color: '#e94560' },
  { key: '维', name: '维', color: '#00d2a1' },
  { key: '队', name: '队', color: '#ffc107' },
  { key: '回', name: '回', color: '#7c4dff' }
]
const userKeys = users.map(u => u.key)

// ===== 初始金额（元），从 props.allocation 初始化，缺省按均分 =====
function defaultEach() {
  return Math.floor(props.totalAvailable / 5 / STEP) * STEP
}
const amounts = reactive({})
for (const k of userKeys) amounts[k] = props.allocation[k] || defaultEach()

// 联动默认开启；若存储的四人金额不等（上次独立保存），则初始为独立态
function initialLinked() {
  const first = amounts[userKeys[0]]
  return userKeys.every(k => amounts[k] === first)
}
const linked = ref(initialLinked())

// ===== 成本 / 下限 / 上限 =====
const costOf = (k) => props.poolCosts[k] || 0
const floorOf = (k) => Math.ceil((costOf(k) + 1) / STEP) * STEP
const availableOf = (k) => amounts[k] - costOf(k)
const cap = computed(() => props.totalAvailable - costOf('公共池')) // 四人合计上限
const sumFloors = computed(() => userKeys.reduce((s, k) => s + floorOf(k), 0))

// 联动：共享值范围 [floorShared, sliderMax]，sliderMax 钳制到不小于下限
const floorShared = computed(() => Math.max(...userKeys.map(k => floorOf(k))))
const vMax = computed(() => Math.floor((cap.value - 1) / 4 / STEP) * STEP)
const sliderMin = computed(() => floorShared.value)
const sliderMax = computed(() => Math.max(vMax.value, floorShared.value))
const sharedVal = computed({
  get: () => amounts[userKeys[0]],
  set: (v) => { for (const k of userKeys) amounts[k] = v }
})
const maxCost = computed(() => Math.max(...userKeys.map(k => costOf(k))))

// 独立：拖动某根时，max 动态收紧使累计不超上限（cap − 1 留 1 元给公共池）
function maxOf(key) {
  const others = userKeys.filter(k => k !== key).reduce((s, k) => s + amounts[k], 0)
  const m = Math.floor((cap.value - 1 - others) / STEP) * STEP
  return Math.max(floorOf(key), m)
}

function toggleLink() {
  linked.value = !linked.value
  if (linked.value) {
    const shared = Math.max(...userKeys.map(k => amounts[k]))
    const clamped = Math.min(Math.max(shared, floorShared.value), sliderMax.value)
    for (const k of userKeys) amounts[k] = clamped
  }
}

// ===== 派生显示 =====
const wan = (yuan) => (yuan / 10000).toFixed(1)
const usersTotal = computed(() => userKeys.reduce((s, k) => s + amounts[k], 0))
const publicAlloc = computed(() => props.totalAvailable - usersTotal.value)
const publicAvailable = computed(() => publicAlloc.value - costOf('公共池'))

// ===== 校验 =====
const errorMsg = computed(() => {
  if (cap.value <= 0) return '公共池持仓已超过总可用，无法分配'
  if (linked.value && floorShared.value > vMax.value) return '四人持仓下限超过可分配上限，请先减持或调整公共池'
  if (!linked.value && sumFloors.value > cap.value - 1) return '四人持仓下限合计超过可分配上限，请先减持或调整公共池'
  return ''
})
const canSave = computed(() => {
  if (cap.value <= 0) return false
  if (usersTotal.value > cap.value - 1) return false
  if (linked.value) return floorShared.value <= vMax.value
  return sumFloors.value <= cap.value - 1
})

// ===== 关闭 / 保存 =====
function close() { emit('close') }
function doSave() {
  if (!canSave.value) return
  const config = { '公共池': publicAlloc.value }
  for (const k of userKeys) config[k] = amounts[k]
  emit('save', config)
}
</script>

<style scoped>
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999;
  display: flex; align-items: center; justify-content: center;
}
.editor {
  width: 100%; height: 100%; background: var(--bg-card);
  display: flex; flex-direction: column; padding: 16px; box-sizing: border-box; overflow-y: auto;
}
.ed-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.ed-title { font-size: 17px; font-weight: 700; }
.ed-close { background: transparent; border: none; color: var(--text-secondary); font-size: 18px; cursor: pointer; }
.ed-sub { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }
.ed-sub b { color: #fff; }

.link-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.link-label { font-size: 13px; font-weight: 600; }
.link-btn {
  padding: 4px 12px; border: 1px solid rgba(255,255,255,0.15); border-radius: var(--radius-round);
  background: transparent; color: var(--text-secondary); font-size: 12px; cursor: pointer;
}
.link-btn.on { color: #00d2a1; border-color: #00d2a1; }

.slider-row { margin-bottom: 18px; }
.sr-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
.sr-name { font-size: 13px; display: flex; align-items: center; gap: 6px; }
.sr-name i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
.sr-head b { font-size: 15px; font-family: var(--font-number); }
.sr-meta { font-size: 11px; color: var(--text-muted); margin-top: 4px; }

.public-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 12px; background: rgba(255,255,255,0.03); border-radius: var(--radius-md);
  font-size: 12px; color: var(--text-secondary); margin-top: 4px;
}
.public-row .num-mono { color: var(--text-primary); font-weight: 600; }

.err { font-size: 12px; color: var(--color-warn); margin: 12px 0 4px; text-align: center; }
.ed-btns { display: flex; gap: 10px; margin-top: auto; padding-top: 16px; }
.d-cancel {
  flex: 1; padding: 12px; border: 1px solid rgba(255,255,255,0.12);
  border-radius: var(--radius-md); background: transparent; color: var(--text-secondary);
  font-size: 14px; cursor: pointer;
}
.d-ok {
  flex: 2; padding: 12px; border: none; border-radius: var(--radius-md);
  background: var(--bg-accent); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
}
.d-ok:disabled { opacity: 0.3; cursor: not-allowed; }
</style>
