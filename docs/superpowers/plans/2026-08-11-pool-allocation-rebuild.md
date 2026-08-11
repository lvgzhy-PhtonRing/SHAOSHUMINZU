# 子池资金分配模块重建 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把资金页「子池资金分配」重建为「默认只读结果 + 第二层全屏编辑（联动滑杆、1万步进、5 子池可用资金恒 >0）」，并统一仓位分析页数据源。

**Architecture:** 拆成两个组件：`FundAllocationSummary.vue`（第一层只读卡）与 `FundAllocationEditor.vue`（第二层全屏编辑，含联动开关、Vant 滑杆、下限/上限校验）。`FundPage.vue` 持有分配状态（从 `app_config.pool_amounts` / localStorage 加载，保存时写回），`PositionsPage.vue` 的初始分配改为读同一配置。分配仅存配置、不写 capital_log，因此不影响任何盈亏。

**Tech Stack:** Vue 3 `<script setup>` + Vant 4（`van-slider`，unplugin-vue-components 自动导入）+ Pinia + Supabase。样式沿用现有 CSS 变量（`--bg-card`、`--bg-accent`、`--color-rise/fall`、`--radius-*`）。

**测试说明（重要）：** 本项目**无测试框架**（`package.json` 无 test script）。每个任务的验证以 `npm run build` 构建通过为准；交互行为按「验证」节列出的手动核对步骤在 `npm run dev` 下确认。未接入的组件不会被 Vite 编译，因此 Task 1/2 的编译正确性由 **Task 3 的 build** 统一把关（任务内已注明）。

---

## File Structure

| 文件 | 动作 | 职责 |
|------|------|------|
| `src/components/fund/FundAllocationSummary.vue` | 新建 | 第一层只读结果卡 |
| `src/components/fund/FundAllocationEditor.vue` | 新建 | 第二层全屏编辑（联动 + 滑杆 + 校验） |
| `src/pages/FundPage.vue` | 修改 | 持有 `allocation` 状态、组合两组件、加载/保存 |
| `src/pages/PositionsPage.vue` | 修改 | 初始分配读配置（无配置回退 11 万） |
| `src/components/fund/FundAllocationForm.vue` | 删除 | 被上面两个组件取代 |
| `package.json` | 修改 | version `2.9.81` → `2.9.82` |
| `src/pages/SettingsPage.vue` | 修改 | 版本显示 `v2.9.81` → `v2.9.82` |

**关键数据形状：**
- 分配配置（元）：`{ '公共池': 剩余, '春': n, '维': n, '队': n, '回': n }`，其中 `公共池 = totalAvailable − 四人合计`。
- `poolCosts`（元，以子池名为 key）：`FundPage` 现有 computed，`Σ cost_price × quantity`。
- 子池可用资金 = `分配 − 持仓成本`；约束：5 个子池可用恒 > 0。

---

### Task 1: 新建 `FundAllocationSummary.vue`（第一层只读结果）

**Files:**
- Create: `src/components/fund/FundAllocationSummary.vue`

- [ ] **Step 1: 创建组件文件**

写入完整内容：

```vue
<template>
  <div class="card">
    <div class="card-title">子池资金分配</div>
    <div class="card-desc">总可用资金 <b class="num-mono">{{ formatMoney(totalAvailable) }}</b></div>

    <div class="alloc-list">
      <div class="pool-row">
        <div class="pool-left"><span class="dot" style="background:#0f3460"></span>公共池</div>
        <span class="alloc-wan num-mono">{{ wan(allocation['公共池'] || 0) }} 万</span>
        <span class="avl num-mono" :class="{ neg: gongyouAvailable <= 0 }">
          <template v-if="gongyouAvailable <= 0">⚠️ </template>可用 {{ formatMoney(gongyouAvailable) }}
        </span>
      </div>
      <div class="pool-row" v-for="u in users" :key="u.key">
        <div class="pool-left"><span class="dot" :style="{ background: u.color }"></span>{{ u.name }}</div>
        <span class="alloc-wan num-mono">{{ wan(allocation[u.key] || 0) }} 万</span>
        <span class="avl num-mono" :class="{ neg: availableOf(u.key) <= 0 }">
          <template v-if="availableOf(u.key) <= 0">⚠️ </template>可用 {{ formatMoney(availableOf(u.key)) }}
        </span>
      </div>
    </div>

    <button class="edit-btn" @click="emit('edit')">✏️ 调整分配</button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatMoney } from '@/utils/formatters'

const props = defineProps({
  allocation: { type: Object, default: () => ({}) },
  poolCosts: { type: Object, default: () => ({}) },
  totalAvailable: { type: Number, default: 0 }
})
const emit = defineEmits(['edit'])

const users = [
  { key: '春', color: '#e94560' },
  { key: '维', color: '#00d2a1' },
  { key: '队', color: '#ffc107' },
  { key: '回', color: '#7c4dff' }
]

const wan = (yuan) => (yuan / 10000).toFixed(1)
const costOf = (k) => props.poolCosts[k] || 0
const availableOf = (k) => (props.allocation[k] || 0) - costOf(k)
const gongyouAvailable = computed(() => (props.allocation['公共池'] || 0) - costOf('公共池'))
</script>

<style scoped>
.card { background: var(--bg-card); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 12px; }
.card-title { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
.card-desc { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }
.card-desc b { color: #fff; }
.alloc-list { border-top: 1px solid rgba(255,255,255,0.06); }
.pool-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
.pool-row:last-child { border-bottom: none; }
.pool-left { display: flex; align-items: center; gap: 6px; min-width: 52px; font-size: 13px; flex-shrink: 0; }
.dot { width: 7px; height: 7px; border-radius: 50%; }
.alloc-wan { margin-left: auto; font-size: 13px; color: var(--text-primary); }
.avl { font-size: 11px; color: var(--text-secondary); font-weight: 500; }
.avl.neg { color: var(--color-fall); }
.edit-btn {
  width: 100%; margin-top: 12px; padding: 12px; border: none; border-radius: var(--radius-md);
  background: var(--bg-accent); color: #fff; font-size: 15px; font-weight: 600; cursor: pointer;
}
</style>
```

- [ ] **Step 2: 验证**

本组件尚未被任何页面引用，Vite 不会编译未引用文件，因此本任务验证 = 代码审阅（对照 spec §4）与文件就绪。编译与集成验证在 **Task 3 的 `npm run build`** 统一执行。**不要 commit**（与 Task 3 一起提交）。

---

### Task 2: 新建 `FundAllocationEditor.vue`（第二层全屏编辑）

**Files:**
- Create: `src/components/fund/FundAllocationEditor.vue`

- [ ] **Step 1: 创建组件文件**

写入完整内容：

```vue
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
  { key: '春', color: '#e94560' },
  { key: '维', color: '#00d2a1' },
  { key: '队', color: '#ffc107' },
  { key: '回', color: '#7c4dff' }
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
```

- [ ] **Step 2: 验证**

同 Task 1：本组件尚未被引用，验证 = 代码审阅（对照 spec §5）+ 文件就绪。编译/集成验证在 **Task 3 的 `npm run build`**。**不要 commit**。

---

### Task 3: 改造 `FundPage.vue` 组合两组件并删除旧表单

**Files:**
- Modify: `src/pages/FundPage.vue`
- Delete: `src/components/fund/FundAllocationForm.vue`

- [ ] **Step 1: 替换 import**

将当前 `src/pages/FundPage.vue` 顶部：
```js
import { deleteCapitalLog, updateCapitalLog, updateTransaction, deleteTransaction, fetchTransactionsByPoolStock, deleteHolding, upsertHolding } from '@/api/supabase'
import FundAllocationForm from '@/components/fund/FundAllocationForm.vue'
```
改为：
```js
import { deleteCapitalLog, updateCapitalLog, updateTransaction, deleteTransaction, fetchTransactionsByPoolStock, deleteHolding, upsertHolding, savePoolAllocation, loadPoolAllocation } from '@/api/supabase'
import FundAllocationSummary from '@/components/fund/FundAllocationSummary.vue'
import FundAllocationEditor from '@/components/fund/FundAllocationEditor.vue'
```

- [ ] **Step 2: 替换模板中的旧表单**

将 `<template v-else>` 块内的 `<FundAllocationForm ... @alloc-change="onAllocChange" />` 整体替换为 `<FundAllocationSummary ... @edit="showAllocEditor = true" />`。替换前模板（当前内容）：
```html
    <template v-else>
      <AdjustmentPanel
        :logs="adjustLogs"
        :submitting="fundStore.submitting"
        :market-value="totalMarketValue"
        :total-available="totalAvailable"
        @add="onAdjustChange"
        @delete="onDeleteLog"
      />
      <FundAllocationForm
        :pools="poolStore.pools"
        :total-available="totalAvailable"
        :pool-costs="poolCosts"
        @alloc-change="onAllocChange"
      />
    </template>
```
替换后：
```html
    <template v-else>
      <AdjustmentPanel
        :logs="adjustLogs"
        :submitting="fundStore.submitting"
        :market-value="totalMarketValue"
        :total-available="totalAvailable"
        @add="onAdjustChange"
        @delete="onDeleteLog"
      />
      <FundAllocationSummary
        :allocation="allocation"
        :pool-costs="poolCosts"
        :total-available="totalAvailable"
        @edit="showAllocEditor = true"
      />
    </template>
```

- [ ] **Step 3: 添加编辑层组件**

在模板末尾 `<CapitalDetailDialog ... />` 之后、`</div>` 之前，添加：
```html
    <FundAllocationEditor
      v-if="showAllocEditor"
      :allocation="allocation"
      :pool-costs="poolCosts"
      :total-available="totalAvailable"
      @close="showAllocEditor = false"
      @save="onAllocSave"
    />
```

- [ ] **Step 4: 添加分配状态与加载/保存逻辑**

**插入位置必须放在 `const totalAsset = computed(...)` 之后**（因为 `defaultAllocation()` 引用 `totalAvailable.value`，而 `totalAvailable` 在文件更后面才声明；放在 refs 区域会触发 TDZ 错误）。在 `<script setup>` 的 `const totalAsset = computed(...)` 那一行之后添加：
```js
const showAllocEditor = ref(false)
const USER_KEYS = ['春', '维', '队', '回']

function defaultAllocation() {
  const each = Math.floor(totalAvailable.value / 5 / 10000) * 10000
  const alloc = { '公共池': totalAvailable.value - each * 4 }
  for (const k of USER_KEYS) alloc[k] = each
  return alloc
}
const allocation = ref(defaultAllocation())

async function loadAllocation() {
  try {
    const server = await loadPoolAllocation()
    if (server) { allocation.value = server; return }
  } catch (e) {}
  try {
    const raw = localStorage.getItem('poolAmounts')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed['公共池'] !== undefined) allocation.value = parsed
    }
  } catch (e) {}
}

function onAllocSave(config) {
  allocation.value = config
  localStorage.setItem('poolAmounts', JSON.stringify(config))
  savePoolAllocation(config).catch(e => console.error('Save allocation:', e))
  showAllocEditor.value = false
}
```

- [ ] **Step 5: onMounted 中加入加载**

将现有 `onMounted` 的 `Promise.all` 改为：
```js
onMounted(async () => {
  try {
    await Promise.all([
      poolStore.loadPools(),
      holdingStore.loadHoldings(),
      fundStore.loadCapitalLogs(),
      loadAllocation()
    ])
    const codes = holdingStore.stockCodes
    if (codes.length) await priceStore.loadPrices(codes)
  } catch (e) {
    console.error('Fund page load error:', e)
  } finally {
    loading.value = false
  }
})
```

- [ ] **Step 6: 删除废弃函数**

删除当前文件中的整个 `onAllocChange` 函数：
```js
function onAllocChange({ pools: allocs }) {
  console.log('Allocation saved:', allocs)
}
```

- [ ] **Step 7: 删除旧组件文件**

删除 `src/components/fund/FundAllocationForm.vue`（用 `git rm` 或文件系统删除均可）。

- [ ] **Step 8: 构建验证**

```bash
npm run build
```
Expected: 构建成功（`✓ built in ...s`）。此时 Task 1/2 的两个新组件随 FundPage 一起编译，任何语法/模板错误都会在此暴露。

- [ ] **Step 9: 手动核对（`npm run dev`）**

1. 进入资金页：券商APP校对下方显示「子池资金分配」只读卡（公共池 + 春/维/队/回 五行，含 分配(万)/可用(元)）。
2. 点「✏️ 调整分配」→ 全屏弹层出现，默认「已联动 · 等额」，一根滑杆显示「每人初始分配」，步进 1 万。
3. 拖动滑杆：四人同步变化，下方「四人合计 / 公共池（剩余）/ 公共池可用」实时更新。
4. 切「已解除 · 独立」→ 四根独立滑杆；拖动任意一根，其余滑杆 max 动态收紧。
5. 点「保存分配」→ 弹层关闭，只读卡数字更新；刷新页面仍保持（已写 localStorage + Supabase）。

- [ ] **Step 10: 提交**

```bash
git add -A
git commit -m "feat: 子池资金分配重建 — 只读结果+全屏编辑（联动滑杆/1万步进/可用恒正）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 改造 `PositionsPage.vue` 统一数据源

**Files:**
- Modify: `src/pages/PositionsPage.vue`

- [ ] **Step 1: 加 import 与状态**

在当前 `<script setup>` 的 import 区添加 `loadPoolAllocation`，并在 `const loading = ref(true)` 附近添加：
```js
import { loadPoolAllocation } from '@/api/supabase'
...
const allocConfig = ref(null)
```

- [ ] **Step 2: 替换初始分配来源**

将 `poolPositionData` computed 内的初始分配块：
```js
  // 每个子池的初始分配
  const poolInitial = {}
  for (const p of poolStore.pools) {
    poolInitial[p.id] = p.name === '公共池'
      ? totalCapital.value - SUB_POOL_INIT * (poolStore.pools.length - 1)
      : SUB_POOL_INIT
  }
```
改为：
```js
  // 每个子池的初始分配：优先读取保存的分配配置，无配置回退 11 万
  const poolInitial = {}
  for (const p of poolStore.pools) {
    const cfg = allocConfig.value?.[p.name]
    poolInitial[p.id] = cfg !== undefined
      ? cfg
      : (p.name === '公共池' ? totalCapital.value - SUB_POOL_INIT * (poolStore.pools.length - 1) : SUB_POOL_INIT)
  }
```
`SUB_POOL_INIT = 110000` 常量保留（仅作无配置回退）。

- [ ] **Step 3: onMounted 加载配置**

在 `onMounted` 的 `try` 块内、`Promise.all` 之前添加：
```js
try { allocConfig.value = await loadPoolAllocation() } catch (e) {}
```

- [ ] **Step 4: 构建验证**

```bash
npm run build
```
Expected: 构建成功。

- [ ] **Step 5: 手动核对（`npm run dev`）**

1. 进入仓位分析页：各子池「初始分配」与资金页只读卡一致（读同一配置）。
2. 在资金页重新分配并保存后，返回仓位分析页 → 各子池「初始分配」「可用资金」「仓位%」按新基线更新。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: 仓位分析页初始分配改读分配配置（无配置回退11万）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: 版本号 2.9.82 + 最终构建 + 推送

**Files:**
- Modify: `package.json`
- Modify: `src/pages/SettingsPage.vue`

- [ ] **Step 1: 升级 package.json**

`package.json` 中 `"version": "2.9.81"` → `"version": "2.9.82"`。

- [ ] **Step 2: 升级设置页显示**

`src/pages/SettingsPage.vue` 中 `<span class="item-value">v2.9.81</span>` → `<span class="item-value">v2.9.82</span>`。

- [ ] **Step 3: 最终构建**

```bash
npm run build
```
Expected: 构建成功，无报错。

- [ ] **Step 4: 提交并推送**

```bash
git add -A
git commit -m "chore: bump v2.9.82

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```
Expected: 推送成功，GitHub Actions 自动触发 GitHub Pages 部署。
