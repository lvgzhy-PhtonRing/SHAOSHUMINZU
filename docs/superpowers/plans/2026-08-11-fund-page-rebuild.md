# 资金页重构（资本管理）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把资金页重构为"资本管理"——顶部资本统计卡（资本投入/现在市值/累计盈利+两个弹窗按钮），校对核缺改为输入券商账户资产自动算差额，并加入交易日 9:00–15:30 禁录入强提示。

**Architecture:** 组件化拆分。新增 `CapitalSummary`（统计卡+按钮）、`CapitalChangeDialog`（增资/减资）、`CapitalDetailDialog`（资本变动记录弹窗）；`FundAllocationForm` 瘦身只留分配；`AdjustmentPanel` 改自动差额。所有数据计算复用现有 `fundStore` getter，`category='adjust'` 语义不变。

**Tech Stack:** Vue 3 `<script setup>` + Vant 4 + Pinia + Vite。无测试框架，验证 = `npm run build`（编译门禁）+ 最终手动 dev 检查。

**设计文档:** `docs/superpowers/specs/2026-08-11-fund-page-rebuild-design.md`

**参考代码:**
- 现有统计卡样式来源 `src/pages/FundPage.vue` `.fund-summary/.fs-row/.fs-label/.fs-amount`
- 增资/减资 UI 来源 `src/components/fund/FundAllocationForm.vue`（61-72 行卡片 + 74-87 行确认弹窗）
- 校对核缺弹窗/列表样式来源 `src/components/fund/AdjustmentPanel.vue`（原文件）
- 颜色变量 `src/assets/styles/variables.css`: `--color-rise:#e94560`（红/涨）、`--color-fall:#00d2a1`（绿/跌）
- 金额格式化 `src/utils/formatters.js` `formatMoney(value)` → 千分位+2位小数

---

### Task 1: 改名（Tab「资金」→「资本」，题头「资金管理」→「资本管理」）

**Files:**
- Modify: `src/components/common/MainLayout.vue:12`
- Modify: `src/router/index.js:44`
- Modify: `src/pages/FundPage.vue:4`

- [ ] **Step 1: 改底部导航文案**

在 `src/components/common/MainLayout.vue:12`，把：
```html
      <van-tabbar-item icon="gold-coin-o" @click="go('fund')">资金</van-tabbar-item>
```
改为：
```html
      <van-tabbar-item icon="gold-coin-o" @click="go('fund')">资本</van-tabbar-item>
```

- [ ] **Step 2: 改路由 meta.title**

在 `src/router/index.js:44`，把 `meta: { title: '资金' }` 改为 `meta: { title: '资本' }`（路由 `name: 'fund'` 保持不变）。

- [ ] **Step 3: 改页面题头**

在 `src/pages/FundPage.vue:4`，把：
```html
      <span class="page-title">资金管理</span>
```
改为：
```html
      <span class="page-title">资本管理</span>
```

- [ ] **Step 4: 构建验证**

Run: `npm run build`
Expected: 构建成功，无错误输出。

- [ ] **Step 5: 提交**

```bash
git add src/components/common/MainLayout.vue src/router/index.js src/pages/FundPage.vue
git commit -m "refactor: 资金tab改资本，题头改资本管理"
```

---

### Task 2: 新增 CapitalSummary 组件（顶部统计卡 + 两按钮）

**Files:**
- Create: `src/components/fund/CapitalSummary.vue`

- [ ] **Step 1: 创建组件**

创建 `src/components/fund/CapitalSummary.vue`，完整内容：

```vue
<template>
  <div class="capital-summary">
    <div class="cs-row">
      <span class="cs-label">资本投入</span>
      <span class="cs-amount num-mono">{{ formatMoney(totalCapital) }}</span>
    </div>
    <div class="cs-row">
      <span class="cs-label">现在市值</span>
      <span class="cs-amount num-mono">{{ formatMoney(marketValue) }}</span>
    </div>
    <div class="cs-row">
      <span class="cs-label" :class="pnlClass">{{ pnlLabel }}</span>
      <span class="cs-amount num-mono" :class="pnlClass">{{ pnlText }}</span>
    </div>
    <div class="cs-btns">
      <button class="cs-btn change" @click="$emit('open-change')">资本增减</button>
      <button class="cs-btn detail" @click="$emit('open-detail')">变动明细</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatMoney } from '@/utils/formatters'

const props = defineProps({
  totalCapital: { type: Number, default: 0 },
  marketValue: { type: Number, default: 0 },
  totalAvailable: { type: Number, default: 0 }
})
defineEmits(['open-change', 'open-detail'])

// 累计盈利 = 账户资产 − 资本投入 = (现在市值 + 可用资金) − 资本投入
const cumPnl = computed(() => (props.marketValue + props.totalAvailable) - props.totalCapital)
const pnlClass = computed(() => (cumPnl.value >= 0 ? 'rise' : 'fall'))
const pnlLabel = computed(() => (cumPnl.value >= 0 ? '累计盈利' : '累计亏损'))
const pnlText = computed(() => (cumPnl.value >= 0 ? `+${formatMoney(cumPnl.value)}` : formatMoney(cumPnl.value)))
</script>

<style scoped>
.capital-summary {
  margin-bottom: 16px;
  padding: 16px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cs-row { display: flex; justify-content: space-between; align-items: baseline; }
.cs-label { font-size: 13px; color: var(--text-secondary); }
.cs-amount { font-size: 22px; font-weight: 700; font-family: var(--font-number); }
.cs-amount.rise { color: var(--color-rise); }
.cs-amount.fall { color: var(--color-fall); }
.cs-label.rise { color: var(--color-rise); }
.cs-label.fall { color: var(--color-fall); }
.cs-btns { display: flex; gap: 10px; }
.cs-btn {
  flex: 1; padding: 12px; border: none; border-radius: var(--radius-md);
  font-size: 15px; font-weight: 600; cursor: pointer;
}
.cs-btn.change { background: var(--bg-accent); color: #fff; }
.cs-btn.detail {
  background: rgba(255,255,255,0.08); color: var(--text-primary);
  border: 1px solid rgba(255,255,255,0.1);
}
</style>
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 构建成功（此时组件未挂载，仅验证语法）。

- [ ] **Step 3: 提交**

```bash
git add src/components/fund/CapitalSummary.vue
git commit -m "feat: 资本统计卡组件（投入/市值/累计盈利+两按钮）"
```

---

### Task 3: FundAllocationForm 瘦身（删除「增减资金池」卡片）

**Files:**
- Modify: `src/components/fund/FundAllocationForm.vue`

- [ ] **Step 1: 删除模板中的「增减资金池」卡片**

删除 `src/components/fund/FundAllocationForm.vue` 模板 61-72 行整块：

```html
    <!-- ===== 2. 增减资金池 ===== -->
    <div class="card">
      <div class="card-title">增减资金池</div>
      <div class="card-desc">为总资金池增加或减少资金</div>
      <div class="amount-row">
        <input v-model="deltaAmount" type="number" inputmode="decimal" placeholder="输入金额" class="big-input num-mono" />
      </div>
      <div class="action-row">
        <button class="act-btn add" :disabled="!deltaValid" @click="doCapital('add')">增资 ➕</button>
        <button class="act-btn remove" :disabled="!deltaValid" @click="doCapital('remove')">减资 ➖</button>
      </div>
    </div>
```

- [ ] **Step 2: 删除 teleport 内「确认增资/减资」弹窗**

删除 teleport 内（原 75-87 行）开头的确认弹窗块：

```html
      <div v-if="showCapitalConfirm" class="overlay" @click.self="showCapitalConfirm=false">
        <div class="dialog">
          <div class="dlg-title">{{ capType === 'add' ? '确认增资' : '确认减资' }}</div>
          <div class="dlg-info">{{ capType === 'add' ? '➕' : '➖' }} <b class="num-mono">{{ formatMoney(capAmount) }}</b> 元</div>
          <van-field v-model="capNote" label="备注" placeholder="选填" :border="false" style="background:rgba(255,255,255,0.03);border-radius:6px;margin:8px 0;padding:8px 10px" />
          <div class="dlg-btns">
            <button class="d-cancel" @click="showCapitalConfirm=false">取消</button>
            <button :class="capType==='add'?'d-ok add':'d-ok remove'" @click="submitCapital">{{ capType==='add'?'✅ 确认增资':'✅ 确认减资' }}</button>
          </div>
        </div>
      </div>
```

删除后 teleport 内只剩「确认资金分配」弹窗（原 89-108 行）。

- [ ] **Step 3: 删除脚本中增资/减资逻辑**

删除脚本（原 126-150 行）整块：

```js
// ====== 增资/减资 ======
const deltaAmount = ref('')
const showCapitalConfirm = ref(false)
const capType = ref('add')
const capAmount = ref(0)
const capNote = ref('')

const deltaValid = computed(() => parseFloat(deltaAmount.value) > 0)

function doCapital(type) {
  capType.value = type
  capAmount.value = parseFloat(deltaAmount.value)
  showCapitalConfirm.value = true
}

function submitCapital() {
  emit('capital-change', {
    type: capType.value,
    amount: capAmount.value,
    note: capNote.value
  })
  showCapitalConfirm.value = false
  deltaAmount.value = ''
  capNote.value = ''
}
```

- [ ] **Step 4: 更新 emits 声明**

把（原 124 行）：
```js
const emit = defineEmits(['capital-change', 'alloc-change'])
```
改为：
```js
const emit = defineEmits(['alloc-change'])
```

- [ ] **Step 5: 删除孤儿样式**

删除 `<style scoped>` 中仅被删除卡片使用的样式块：

```css
/* 增资/减资 */
.big-input {
  flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-md); color: #fff; font-size: 22px; padding: 12px;
  text-align: center; outline: none; font-family: var(--font-number);
}
.big-input:focus { border-color: var(--bg-accent); }
.amount-row { display: flex; align-items: center; margin-bottom: 12px; }
.action-row { display: flex; gap: 10px; }
.act-btn {
  flex: 1; padding: 12px; border: none; border-radius: var(--radius-md);
  font-size: 15px; font-weight: 600; cursor: pointer;
}
.act-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.act-btn.add { background: #00d2a1; color: #1a1a2e; }
.act-btn.remove { background: #e94560; color: #fff; }
```

- [ ] **Step 6: 构建验证**

Run: `npm run build`
Expected: 构建成功。若有 `ref`/`computed`/`formatMoney` 未使用告警可忽略（`ref` 仍被 `isLinked`、`showAllocConfirm` 使用，`computed` 仍被分配逻辑使用，`formatMoney` 仍被合计行使用）。

- [ ] **Step 7: 提交**

```bash
git add src/components/fund/FundAllocationForm.vue
git commit -m "refactor: FundAllocationForm 移除增减资金池卡片，只留子池分配"
```

---

### Task 4: 新增 CapitalChangeDialog（资本增减弹窗）

**Files:**
- Create: `src/components/fund/CapitalChangeDialog.vue`

- [ ] **Step 1: 创建组件**

创建 `src/components/fund/CapitalChangeDialog.vue`，完整内容：

```vue
<template>
  <teleport to="body">
    <div v-if="show" class="overlay" @click.self="close">
      <div class="dialog">
        <template v-if="!confirming">
          <div class="dlg-head">
            <span class="dlg-title">资本增减</span>
            <button class="dlg-close" @click="close">✕</button>
          </div>
          <div class="dlg-info">为总资金池增加或减少资金</div>
          <div class="amount-row">
            <input v-model="deltaAmount" type="number" inputmode="decimal" placeholder="输入金额" class="big-input num-mono" />
          </div>
          <div class="action-row">
            <button class="act-btn add" :disabled="!deltaValid" @click="doCapital('add')">增资 ➕</button>
            <button class="act-btn remove" :disabled="!deltaValid" @click="doCapital('remove')">减资 ➖</button>
          </div>
        </template>
        <template v-else>
          <div class="dlg-title">{{ capType === 'add' ? '确认增资' : '确认减资' }}</div>
          <div class="dlg-info">{{ capType === 'add' ? '➕' : '➖' }} <b class="num-mono">{{ formatMoney(capAmount) }}</b> 元</div>
          <div class="dlg-field">
            <label class="dlg-label">备注</label>
            <input v-model="capNote" type="text" class="dlg-input" placeholder="选填" />
          </div>
          <div class="dlg-btns">
            <button class="d-cancel" @click="confirming = false">返回</button>
            <button :class="capType === 'add' ? 'd-ok add' : 'd-ok remove'" @click="submit">{{ capType === 'add' ? '✅ 确认增资' : '✅ 确认减资' }}</button>
          </div>
        </template>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { formatMoney } from '@/utils/formatters'

const props = defineProps({ show: { type: Boolean, default: false } })
const emit = defineEmits(['update:show', 'capital-change'])

const deltaAmount = ref('')
const confirming = ref(false)
const capType = ref('add')
const capAmount = ref(0)
const capNote = ref('')

const deltaValid = computed(() => parseFloat(deltaAmount.value) > 0)

function close() {
  emit('update:show', false)
  confirming.value = false
  deltaAmount.value = ''
  capNote.value = ''
}

function doCapital(type) {
  capType.value = type
  capAmount.value = parseFloat(deltaAmount.value)
  confirming.value = true
}

function submit() {
  emit('capital-change', { type: capType.value, amount: capAmount.value, note: capNote.value })
  close()
}
</script>

<style scoped>
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;
}
.dialog {
  background: var(--bg-card); border-radius: var(--radius-lg); padding: 20px;
  width: 100%; max-width: 360px;
}
.dlg-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.dlg-title { font-size: 17px; font-weight: 700; }
.dlg-close { background: none; border: none; color: var(--text-secondary); font-size: 16px; cursor: pointer; padding: 0 2px; }
.dlg-info { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }
.dlg-info b { color: #fff; }
.amount-row { display: flex; align-items: center; margin-bottom: 12px; }
.big-input {
  flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-md); color: #fff; font-size: 22px; padding: 12px;
  text-align: center; outline: none; font-family: var(--font-number);
}
.big-input:focus { border-color: var(--bg-accent); }
.action-row { display: flex; gap: 10px; }
.act-btn {
  flex: 1; padding: 12px; border: none; border-radius: var(--radius-md);
  font-size: 15px; font-weight: 600; cursor: pointer;
}
.act-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.act-btn.add { background: #00d2a1; color: #1a1a2e; }
.act-btn.remove { background: #e94560; color: #fff; }
.dlg-field { margin-bottom: 12px; }
.dlg-label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.dlg-input {
  width: 100%; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md); background: rgba(255,255,255,0.04); color: #fff;
  font-size: 15px; outline: none; box-sizing: border-box;
}
.dlg-input:focus { border-color: var(--bg-accent); }
.dlg-btns { display: flex; gap: 10px; margin-top: 16px; }
.d-cancel {
  flex: 1; padding: 10px; border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md); background: transparent; color: var(--text-secondary);
  font-size: 14px; cursor: pointer;
}
.d-ok {
  flex: 2; padding: 10px; border: none; border-radius: var(--radius-md);
  font-size: 14px; font-weight: 600; cursor: pointer; color: #fff;
}
.d-ok.add { background: #00d2a1; color: #1a1a2e; }
.d-ok.remove { background: #e94560; }
</style>
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 3: 提交**

```bash
git add src/components/fund/CapitalChangeDialog.vue
git commit -m "feat: 资本增减弹窗组件"
```

---

### Task 5: 新增 CapitalDetailDialog（变动明细弹窗）

**Files:**
- Create: `src/components/fund/CapitalDetailDialog.vue`

- [ ] **Step 1: 创建组件**

创建 `src/components/fund/CapitalDetailDialog.vue`，完整内容：

```vue
<template>
  <teleport to="body">
    <div v-if="show" class="overlay" @click.self="$emit('update:show', false)">
      <div class="dialog">
        <div class="dlg-head">
          <span class="dlg-title">变动明细</span>
          <button class="dlg-close" @click="$emit('update:show', false)">✕</button>
        </div>
        <div class="dlg-list">
          <CapitalLogList :logs="logs" @delete="$emit('delete', $event)" @edit="$emit('edit', $event)" />
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import CapitalLogList from './CapitalLogList.vue'

defineProps({
  show: { type: Boolean, default: false },
  logs: { type: Array, default: () => [] }
})
defineEmits(['update:show', 'delete', 'edit'])
</script>

<style scoped>
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;
}
.dialog {
  background: var(--bg-card); border-radius: var(--radius-lg); padding: 20px;
  width: 100%; max-width: 420px; max-height: 80vh; display: flex; flex-direction: column;
}
.dlg-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.dlg-title { font-size: 17px; font-weight: 700; }
.dlg-close { background: none; border: none; color: var(--text-secondary); font-size: 16px; cursor: pointer; padding: 0 2px; }
.dlg-list { overflow-y: auto; max-height: 60vh; }
</style>
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 3: 提交**

```bash
git add src/components/fund/CapitalDetailDialog.vue
git commit -m "feat: 变动明细弹窗组件"
```

---

### Task 6: FundPage 组合改造

**Files:**
- Modify: `src/pages/FundPage.vue`

- [ ] **Step 1: 替换模板顶部统计区**

把 `src/pages/FundPage.vue` 模板 7-16 行整块：
```html
    <div class="fund-summary">
      <div class="fs-row">
        <span class="fs-label">总可用资金</span>
        <span class="fs-amount num-mono">{{ formatMoney(totalAvailable) }}</span>
      </div>
      <div class="fs-row">
        <span class="fs-label">股票总市值</span>
        <span class="fs-amount num-mono">{{ formatMoney(totalMarketValue) }}</span>
      </div>
    </div>
```
替换为：
```html
    <CapitalSummary
      :total-capital="totalCapital"
      :market-value="totalMarketValue"
      :total-available="totalAvailable"
      @open-change="showChangeDialog = true"
      @open-detail="showDetailDialog = true"
    />
```

- [ ] **Step 2: 移除 FundAllocationForm 的 capital-change 监听、给 AdjustmentPanel 加市值参数**

把（原 20-34 行）：
```html
      <FundAllocationForm
        :pools="poolStore.pools"
        :total-available="totalAvailable"
        :pool-costs="poolCosts"
        :submitting="fundStore.submitting"
        @capital-change="onCapitalChange"
        @alloc-change="onAllocChange"
      />
      <AdjustmentPanel
        :logs="adjustLogs"
        :submitting="fundStore.submitting"
        @add="onAdjustChange"
        @edit="onAdjustEdit"
        @delete="onDeleteLog"
      />
      <div class="section-card">
        <CapitalLogList :logs="capitalLogs" @delete="onDeleteLog" @edit="onEditLog" />
      </div>
```
替换为：
```html
      <FundAllocationForm
        :pools="poolStore.pools"
        :total-available="totalAvailable"
        :pool-costs="poolCosts"
        :submitting="fundStore.submitting"
        @alloc-change="onAllocChange"
      />
      <AdjustmentPanel
        :logs="adjustLogs"
        :submitting="fundStore.submitting"
        :market-value="totalMarketValue"
        :total-available="totalAvailable"
        @add="onAdjustChange"
        @edit="onAdjustEdit"
        @delete="onDeleteLog"
      />
```
（`CapitalLogList` 移入 `CapitalDetailDialog`，不再直接渲染在页面；若其导入引用移除后无告警则保留导入无害，见 Step 4。）

- [ ] **Step 3: 模板末尾追加两个弹窗**

在 `</template>`（原 39 行）前、`<template v-else>` 块之后追加：
```html

    <CapitalChangeDialog v-model:show="showChangeDialog" @capital-change="onCapitalChange" />
    <CapitalDetailDialog v-model:show="showDetailDialog" :logs="capitalLogs" @delete="onDeleteLog" @edit="onEditLog" />
```

- [ ] **Step 4: 更新脚本导入与状态**

把（原 47-54 行）导入区：
```js
import FundAllocationForm from '@/components/fund/FundAllocationForm.vue'
import CapitalLogList from '@/components/fund/CapitalLogList.vue'
import AdjustmentPanel from '@/components/fund/AdjustmentPanel.vue'
import LoadingSkeleton from '@/components/common/LoadingSkeleton.vue'
```
替换为：
```js
import FundAllocationForm from '@/components/fund/FundAllocationForm.vue'
import AdjustmentPanel from '@/components/fund/AdjustmentPanel.vue'
import CapitalSummary from '@/components/fund/CapitalSummary.vue'
import CapitalChangeDialog from '@/components/fund/CapitalChangeDialog.vue'
import CapitalDetailDialog from '@/components/fund/CapitalDetailDialog.vue'
import LoadingSkeleton from '@/components/common/LoadingSkeleton.vue'
```

在 `const loading = ref(true)`（原 62 行）下方追加：
```js
const showChangeDialog = ref(false)
const showDetailDialog = ref(false)
```

删除 `src/pages/FundPage.vue` 中（原 49 行）不再使用的导入：
```js
import { formatMoney } from '@/utils/formatters'
```
（移除顶部统计区后模板不再调用 `formatMoney`，脚本函数 `onEditLog`/`onDeleteLog` 内也不使用它，此导入已无引用。）

- [ ] **Step 5: 删除孤儿样式**

删除 `<style scoped>` 中整块（原 304-316 行）：
```css
.fund-summary {
  margin-bottom: 16px;
  padding: 16px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.fs-row { display: flex; justify-content: space-between; align-items: baseline; }
.fs-label { font-size: 13px; color: var(--text-secondary); }
.fs-amount { font-size: 22px; font-weight: 700; font-family: var(--font-number); }
```

- [ ] **Step 6: 构建验证**

Run: `npm run build`
Expected: 构建成功。`formatMoney` 若仍被脚本其他处使用则保留；若无其他引用，Vite 不会因未使用的导入报错（`formatMoney` 仍被 `onEditLog`/`onDeleteLog` 弹窗使用，保持导入不变）。

- [ ] **Step 7: 提交**

```bash
git add src/pages/FundPage.vue
git commit -m "feat: 资金页接入资本统计卡与增减/明细弹窗"
```

---

### Task 7: AdjustmentPanel 改造（券商账户资产自动差额 + 交易时段锁）

**Files:**
- Modify: `src/components/fund/AdjustmentPanel.vue`（整文件重写）

- [ ] **Step 1: 重写组件**

用以下内容**整体覆盖** `src/components/fund/AdjustmentPanel.vue`：

```vue
<template>
  <div class="card">
    <div class="card-title">校对核缺</div>
    <div class="card-desc">输入券商APP显示的「账户资产」，系统自动计算差额并记录。只调可用资金/总资产，不计入总资本</div>

    <div v-if="tradingLocked" class="lock-banner">
      ⛔ 交易时段内（工作日 9:00–15:30）禁止校对核缺，请在 15:30 收盘后操作
      <div class="lock-note">法定休市日仍按工作日判断，以券商实际休市为准</div>
    </div>

    <div class="amount-row">
      <input
        v-model="brokerAsset"
        type="number"
        inputmode="decimal"
        placeholder="券商账户资产（元）"
        class="big-input num-mono"
        :disabled="tradingLocked"
      />
    </div>
    <div class="action-row">
      <button class="act-btn gen" :disabled="tradingLocked || !brokerValid" @click="generate">生成校对核缺</button>
    </div>
    <div v-if="brokerValid" class="diff-preview" :class="diff >= 0 ? 'pos' : 'neg'">
      差额 = 券商账户资产 − 系统账户资产 =
      <b class="num-mono">{{ diff >= 0 ? '+' : '' }}{{ formatMoney(diff) }}</b>
      <span class="hint">系统账户资产（市值 + 可用资金）{{ formatMoney(systemAsset) }}</span>
    </div>

    <!-- 确认/编辑弹窗 -->
    <teleport to="body">
      <div v-if="showDialog" class="overlay" @click.self="closeDialog">
        <div class="dialog">
          <div class="dlg-title">{{ editingId ? '编辑校对核缺' : '确认校对核缺' }}</div>
          <div class="dlg-info">
            {{ adjType === 'add' ? '➕' : '➖' }} <b class="num-mono">{{ formatMoney(adjAmount) }}</b> 元
          </div>
          <div class="dlg-field">
            <label class="dlg-label">日期</label>
            <input v-model="adjDate" type="date" class="dlg-input" />
          </div>
          <div class="dlg-field">
            <label class="dlg-label">备注</label>
            <input v-model="adjNote" type="text" class="dlg-input" placeholder="选填，如分红、手续费差等" />
          </div>
          <div class="dlg-btns">
            <button class="d-cancel" @click="closeDialog">取消</button>
            <button :class="adjType==='add'?'d-ok add':'d-ok remove'" @click="submit">✅ 确认</button>
          </div>
        </div>
      </div>

      <!-- 删除确认 -->
      <div v-if="deleting" class="overlay" @click.self="deleting = null">
        <div class="dialog">
          <div class="dlg-title">确认删除</div>
          <div class="dlg-info">确定删除此条校对核缺记录？</div>
          <div class="dlg-rows">
            <div class="dlg-row">
              <span>{{ deleting.type === 'add' ? '校对核缺+' : '校对核缺−' }}</span>
              <span class="num-mono">{{ formatMoney(deleting.amount) }}</span>
            </div>
            <div v-if="deleting.note" class="dlg-row">
              <span>备注</span>
              <span>{{ deleting.note }}</span>
            </div>
          </div>
          <div class="dlg-btns">
            <button class="d-cancel" @click="deleting = null">取消</button>
            <button class="d-ok del" @click="doDelete">🗑️ 确认删除</button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- 独立列表明细 -->
    <div class="adjust-list">
      <div class="log-header">
        <span class="log-title">校对核缺明细</span>
        <span class="log-count" v-if="logs.length">共 {{ logs.length }} 条</span>
      </div>
      <div v-if="!logs.length" class="list-empty">暂无校对核缺记录</div>
      <div v-else class="log-items">
        <div v-for="log in logs" :key="log.id" class="log-item">
          <div class="log-icon">{{ log.type === 'add' ? '➕' : '➖' }}</div>
          <div class="log-info">
            <div class="log-detail">
              <span class="log-action adjust">{{ log.type === 'add' ? '校对核缺+' : '校对核缺−' }}</span>
              <span class="log-amount num-mono" :class="log.type === 'add' ? 'rise' : 'fall'">
                {{ log.type === 'add' ? '+' : '-' }}{{ formatMoney(log.amount) }}
              </span>
            </div>
            <div class="log-meta">
              <span>{{ formatDate(log.created_at) }}</span>
              <span v-if="log.note"> · {{ log.note }}</span>
            </div>
          </div>
          <div class="log-actions">
            <button class="edit-btn" @click="startEdit(log)">✏️</button>
            <button class="del-btn" @click="deleting = log">✕</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { formatMoney } from '@/utils/formatters'

const props = defineProps({
  logs: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false },
  marketValue: { type: Number, default: 0 },
  totalAvailable: { type: Number, default: 0 }
})
const emit = defineEmits(['add', 'edit', 'delete'])

// ===== 交易时段判定：工作日 9:00–15:30 禁止（分秒 540–930） =====
const tradingLocked = computed(() => {
  const d = new Date()
  const day = d.getDay() // 0=周日 6=周六
  if (day === 0 || day === 6) return false
  const minutes = d.getHours() * 60 + d.getMinutes()
  return minutes >= 540 && minutes < 930
})

// ===== 券商账户资产 → 差额 =====
const brokerAsset = ref('')
const brokerValid = computed(() => {
  const v = parseFloat(brokerAsset.value)
  return !isNaN(v) && v > 0
})
const systemAsset = computed(() => props.marketValue + props.totalAvailable)
const diff = computed(() => {
  if (!brokerValid.value) return 0
  return parseFloat(brokerAsset.value) - systemAsset.value
})

// ===== 确认/编辑弹窗 =====
const showDialog = ref(false)
const adjType = ref('add')
const adjAmount = ref(0)
const adjDate = ref(todayStr())
const adjNote = ref('')
const editingId = ref(null)

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function generate() {
  const d = diff.value
  if (Math.abs(d) < 0.005) {
    alert('系统与券商一致，无需校对')
    return
  }
  adjType.value = d > 0 ? 'add' : 'remove'
  adjAmount.value = Math.abs(d)
  editingId.value = null
  adjDate.value = todayStr()
  adjNote.value = ''
  showDialog.value = true
}

function startEdit(log) {
  adjType.value = log.type
  adjAmount.value = log.amount
  editingId.value = log.id
  adjDate.value = (log.created_at || '').slice(0, 10) || todayStr()
  adjNote.value = log.note || ''
  showDialog.value = true
}

function closeDialog() {
  showDialog.value = false
  editingId.value = null
}

function submit() {
  if (!adjAmount.value || adjAmount.value <= 0) return
  if (editingId.value) {
    emit('edit', { id: editingId.value, amount: adjAmount.value, note: adjNote.value, date: adjDate.value, type: adjType.value })
  } else {
    emit('add', { type: adjType.value, amount: adjAmount.value, note: adjNote.value, date: adjDate.value })
  }
  closeDialog()
  brokerAsset.value = ''
}

// ===== 删除 =====
const deleting = ref(null)
function doDelete() {
  if (!deleting.value) return
  emit('delete', deleting.value)
  deleting.value = null
}

function formatDate(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
</script>

<style scoped>
.card { background: var(--bg-card); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 12px; }
.card-title { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
.card-desc { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }

.lock-banner {
  background: rgba(233,69,96,0.12); color: var(--color-rise);
  font-size: 12px; padding: 8px 10px; border-radius: var(--radius-md);
  margin-bottom: 12px; line-height: 1.5;
}
.lock-note { font-size: 10px; color: var(--text-muted); margin-top: 2px; }

.amount-row { display: flex; align-items: center; margin-bottom: 12px; }
.big-input {
  flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-md); color: #fff; font-size: 22px; padding: 12px;
  text-align: center; outline: none; font-family: var(--font-number);
}
.big-input:focus { border-color: var(--color-warn); }
.big-input:disabled { opacity: 0.4; cursor: not-allowed; }
.action-row { display: flex; gap: 10px; }
.act-btn {
  flex: 1; padding: 12px; border: none; border-radius: var(--radius-md);
  font-size: 15px; font-weight: 600; cursor: pointer;
}
.act-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.act-btn.gen { background: #7c4dff; color: #fff; }

.diff-preview {
  font-size: 12px; color: var(--text-secondary); margin-top: 10px;
  padding: 8px 10px; background: rgba(255,255,255,0.03); border-radius: var(--radius-md);
}
.diff-preview b { font-size: 14px; }
.diff-preview.pos b { color: var(--color-rise); }
.diff-preview.neg b { color: var(--color-fall); }
.diff-preview .hint { font-size: 10px; color: var(--text-muted); display: block; margin-top: 2px; }

/* 列表明细 */
.adjust-list { margin-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; }
.log-header { display: flex; justify-content: space-between; align-items: center; padding: 0 0 8px; }
.log-title { font-size: 14px; font-weight: 600; }
.log-count { font-size: 12px; color: var(--text-secondary); }
.list-empty { font-size: 12px; color: var(--text-muted); padding: 10px 0; text-align: center; }
.log-items { display: flex; flex-direction: column; gap: 4px; }
.log-item { display: flex; gap: 10px; padding: 8px 10px; background: rgba(255,255,255,0.03); border-radius: var(--radius-md); }
.log-icon { font-size: 18px; padding-top: 2px; }
.log-info { flex: 1; min-width: 0; }
.log-detail { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.log-action { font-size: 13px; font-weight: 500; }
.log-action.adjust { color: var(--color-warn); }
.log-amount { font-size: 14px; font-weight: 600; font-family: var(--font-number); }
.log-amount.rise { color: var(--color-rise); }
.log-amount.fall { color: var(--color-fall); }
.log-meta { font-size: 11px; color: var(--text-muted); }
.log-actions { display: flex; flex-direction: column; gap: 4px; align-self: flex-start; }
.edit-btn {
  background: none; border: none; font-size: 13px; cursor: pointer; padding: 0 2px; line-height: 1;
  opacity: 0.5; transition: opacity 0.15s;
}
.edit-btn:hover { opacity: 1; }
.del-btn {
  background: none; border: none; color: var(--text-muted); font-size: 13px;
  cursor: pointer; padding: 0 2px; line-height: 1;
}
.del-btn:active { color: var(--color-fall); }

/* 弹窗 */
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;
}
.dialog {
  background: var(--bg-card); border-radius: var(--radius-lg); padding: 20px;
  width: 100%; max-width: 360px;
}
.dlg-title { font-size: 17px; font-weight: 700; margin-bottom: 8px; }
.dlg-info { font-size: 14px; color: var(--text-secondary); margin-bottom: 12px; }
.dlg-info b { color: #fff; }
.dlg-field { margin-bottom: 12px; }
.dlg-label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.dlg-input {
  width: 100%; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md); background: rgba(255,255,255,0.04); color: #fff;
  font-size: 15px; outline: none; box-sizing: border-box;
}
.dlg-input:focus { border-color: var(--color-warn); }
.dlg-btns { display: flex; gap: 10px; margin-top: 16px; }
.d-cancel {
  flex: 1; padding: 10px; border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md); background: transparent; color: var(--text-secondary);
  font-size: 14px; cursor: pointer;
}
.d-ok {
  flex: 2; padding: 10px; border: none; border-radius: var(--radius-md);
  font-size: 14px; font-weight: 600; cursor: pointer; color: #fff;
}
.d-ok.add { background: #7c4dff; }
.d-ok.remove { background: #ff6b35; }
.d-ok.del { background: var(--color-fall); }
.dlg-rows { margin-bottom: 8px; }
.dlg-row {
  display: flex; justify-content: space-between; padding: 5px 0;
  font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.03);
}
</style>
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 3: 提交**

```bash
git add src/components/fund/AdjustmentPanel.vue
git commit -m "feat: 校对核缺改为券商账户资产自动差额，交易日9-15:30禁录"
```

---

### Task 8: 版本升级 + 构建 + 推送

**Files:**
- Modify: `src/pages/SettingsPage.vue:40`
- Modify: `package.json:4`

版本规则（CLAUDE.md）：重构/新功能 → 升大版本。此重构计划升 **v3.0.0**。若用户指定其他版本号，以用户为准。

- [ ] **Step 1: 升级 SettingsPage 显示版本**

在 `src/pages/SettingsPage.vue:40`，把：
```html
          <span class="item-value">v2.9.3</span>
```
改为：
```html
          <span class="item-value">v3.0.0</span>
```

- [ ] **Step 2: 升级 package.json 版本**

在 `package.json:4`，把：
```json
  "version": "2.9.3",
```
改为：
```json
  "version": "3.0.0",
```

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 4: 手动 dev 验证**

Run: `npm run dev`（0.0.0.0:5173），逐项检查：

| 检查项 | 预期 |
|--------|------|
| 底部导航 | 第 5 个 tab 显示「资本」 |
| 资本页题头 | 「资本管理」 |
| 资本投入 | 852,462.51 |
| 现在市值 | 与其它页总市值一致 |
| 累计盈利 | =（市值+可用资金）− 852,462.51；正→红「累计盈利」，负→绿「累计亏损」 |
| 资本增减按钮 | 弹窗可输入金额，增资/减资确认后可用资金联动变化 |
| 变动明细按钮 | 弹窗显示资本变动记录，编辑/删除正常 |
| 校对核缺 | 输入券商账户资产 → 显示实时差额；点「生成校对核缺」→ 差额≠0 出确认弹窗、差额≈0 提示无需校对 |
| 交易时段锁 | 临时改系统时间到工作日 9:00–15:30 → 输入禁用 + 红色横幅；其他时段正常 |

- [ ] **Step 5: 提交并推送**

```bash
git add src/pages/SettingsPage.vue package.json
git commit -m "feat: 资金页重构为资本管理（统计卡+弹窗+校对自动差额）; bump v3.0.0"
git push
```
