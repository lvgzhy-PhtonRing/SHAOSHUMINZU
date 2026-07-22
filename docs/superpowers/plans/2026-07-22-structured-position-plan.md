# 结构化动态仓位配置亏损计划 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个移动端优先的5人合伙股票账户管理系统，含持仓展示、仓位分析、交易录入、资金池管理功能

**Architecture:** Vue 3 SPA + Vant UI + Pinia 状态管理 + Supabase 数据持久化 + 新浪财经A股行情。GitHub Pages 部署静态前端，Supabase 提供后端数据库。

**Tech Stack:** Vue 3 (Composition API), Vant 4, Pinia, Vue Router 4, Vite 5, Supabase JS SDK, 新浪财经行情 API

---

## 先决条件准备

**外部资源（大王陛下自行完成）：**
1. 在 [supabase.co](https://supabase.co) 注册账号并创建项目，获取 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`
2. 在 GitHub 创建私有仓库，后续用于 GitHub Pages 部署

---

### Task 1: 项目脚手架搭建

**Files:**
- Create: `D:\Projects\ETF\package.json`
- Create: `D:\Projects\ETF\vite.config.js`
- Create: `D:\Projects\ETF\index.html`
- Create: `D:\Projects\ETF\src\main.js`
- Create: `D:\Projects\ETF\src\App.vue`

- [ ] **Step 1: 初始化 package.json**

```json
{
  "name": "structured-position-plan",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.4.0",
    "vue-router": "^4.3.0",
    "pinia": "^2.1.0",
    "vant": "^4.8.0",
    "@supabase/supabase-js": "^2.43.0",
    "@vant/use": "^1.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.4.0",
    "unplugin-vue-components": "^0.27.0",
    "unplugin-auto-import": "^0.18.0"
  }
}
```

- [ ] **Step 2: 创建 vite.config.js**

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from 'unplugin-vue-components/resolvers'
import AutoImport from 'unplugin-auto-import/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      dts: 'src/auto-imports.d.ts'
    }),
    Components({
      resolvers: [VantResolver()],
      dts: 'src/components.d.ts'
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 4096
  }
})
```

- [ ] **Step 3: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#1a1a2e">
  <title>结构化动态仓位配置亏损计划</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: 创建 src/main.js**

```javascript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Vant from 'vant'
import 'vant/lib/index.css'
import App from './App.vue'
import router from './router'
import './assets/styles/global.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(Vant)
app.mount('#app')
```

- [ ] **Step 5: 创建 src/App.vue**

```vue
<template>
  <router-view />
</template>

<script setup>
// App root - router handles page switching
</script>

<style>
html, body, #app {
  height: 100%;
  margin: 0;
  padding: 0;
  background: #1a1a2e;
  -webkit-font-smoothing: antialiased;
}
</style>
```

- [ ] **Step 6: 安装依赖并验证**

```bash
cd /d/Projects/ETF && npm install
```

验证：`npm run dev` 启动开发服务器，访问 http://localhost:5173 看到空白页（路由未配置，但无报错）

- [ ] **Step 7: Commit**

```bash
cd /d/Projects/ETF && git init && git add package.json vite.config.js index.html src/main.js src/App.vue && git commit -m "feat: scaffold project with Vue 3 + Vant + Vite"
```

---

### Task 2: 样式系统与全局配置

**Files:**
- Create: `src/assets/styles/variables.css`
- Create: `src/assets/styles/global.css`
- Create: `src/utils/formatters.js`
- Create: `src/utils/calculators.js`
- Create: `src/utils/validators.js`

- [ ] **Step 1: 创建 CSS 变量文件**

```css
/* src/assets/styles/variables.css */
:root {
  /* 主题色 */
  --bg-primary: #1a1a2e;
  --bg-card: #16213e;
  --bg-accent: #0f3460;
  --bg-hover: rgba(255,255,255,0.06);

  /* 涨跌色 */
  --color-rise: #00d2a1;
  --color-fall: #e94560;
  --color-warn: #ffc107;

  /* 子池颜色 */
  --pool-gongyou: #0f3460;
  --pool-chun: #e94560;
  --pool-wei: #00d2a1;
  --pool-dui: #ffc107;
  --pool-hui: #7c4dff;

  /* 文字色 */
  --text-primary: #ffffff;
  --text-secondary: #888888;
  --text-muted: #666666;

  /* 间距 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;

  /* 圆角 */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-round: 999px;

  /* 字体 */
  --font-number: 'SF Mono', 'Fira Code', 'Courier New', monospace;
}
```

- [ ] **Step 2: 创建全局样式**

```css
/* src/assets/styles/global.css */
@import './variables.css';

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
  overflow-x: hidden;
}

/* 数字等宽 */
.num-mono {
  font-family: var(--font-number);
  font-variant-numeric: tabular-nums;
}

/* 涨跌色 */
.text-rise { color: var(--color-rise); }
.text-fall { color: var(--color-fall); }

/* 卡片 */
.card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
}

/* 横向滚动容器 */
.scroll-x {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.scroll-x::-webkit-scrollbar { display: none; }

/* 页面容器 */
.page {
  padding: var(--spacing-md) var(--spacing-lg);
  padding-bottom: 70px; /* 底部Tab高度 */
}
```

- [ ] **Step 3: 创建格式化工具**

```javascript
// src/utils/formatters.js

/**
 * 格式化金额：1234567.89 → '1,234,567.89'
 */
export function formatMoney(value) {
  if (value === null || value === undefined) return '—'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '—'
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * 格式化数量：17000 → '17,000'
 */
export function formatQuantity(value) {
  if (value === null || value === undefined) return '—'
  const num = typeof value === 'string' ? parseInt(value) : value
  if (isNaN(num)) return '—'
  return num.toLocaleString('zh-CN')
}

/**
 * 格式化百分比：26.03 → '26.03%'
 */
export function formatPercent(value) {
  if (value === null || value === undefined) return '—%'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '—%'
  return `${num.toFixed(2)}%`
}

/**
 * 格式化价格：6.42 → '6.420'
 */
export function formatPrice(value) {
  if (value === null || value === undefined) return '—'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '—'
  return num.toFixed(3)
}

/**
 * 格式化日期：'2026-07-22' 或 Date → '2026-07-22'
 */
export function formatDate(value) {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 格式化涨跌：带 +/- 符号
 */
export function formatChange(value) {
  if (value === null || value === undefined) return '—'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '—'
  return num >= 0 ? `+${num.toFixed(2)}` : num.toFixed(2)
}
```

- [ ] **Step 4: 创建计算工具**

```javascript
// src/utils/calculators.js

/**
 * 计算盈亏 = (现价 - 成本价) × 持仓数量
 */
export function calcProfit(currentPrice, costPrice, quantity) {
  if (!currentPrice || !costPrice || !quantity) return 0
  return (currentPrice - costPrice) * quantity
}

/**
 * 计算涨跌幅% = (现价 - 昨收) / 昨收 × 100
 */
export function calcChangePct(currentPrice, prevClose) {
  if (!currentPrice || !prevClose || prevClose === 0) return 0
  return ((currentPrice - prevClose) / prevClose) * 100
}

/**
 * 计算仓位比例 = 总市值 / 总资产 × 100
 */
export function calcPositionRatio(totalMarketValue, totalAsset) {
  if (!totalMarketValue || !totalAsset || totalAsset === 0) return 0
  return (totalMarketValue / totalAsset) * 100
}

/**
 * 计算持仓成本均价 = 总投入金额 / 总持仓数量
 * 买入时：新均价 = (原持仓金额 + 买入金额) / (原数量 + 买入数量)
 * 卖出时：均价不变，减少数量
 */
export function calcNewCostPrice(buyAmount, buyQuantity, currentQuantity, currentCostPrice) {
  const totalCost = (currentCostPrice || 0) * (currentQuantity || 0) + buyAmount
  const totalQty = (currentQuantity || 0) + buyQuantity
  return totalQty > 0 ? totalCost / totalQty : 0
}

/**
 * 合并 (当前市值/总市值/仓位) 计算
 */
export function calcAccountSummary(pools, holdings, prices) {
  let totalMarketValue = 0
  let totalCost = 0
  const poolDetails = pools.map(pool => {
    const poolHoldings = holdings.filter(h => h.pool_id === pool.id)
    let poolMV = 0
    let poolCost = 0
    const stocks = poolHoldings.map(h => {
      const price = prices[h.stock_code]?.price || 0
      const mv = price * h.quantity
      const cost = h.cost_price * h.quantity
      poolMV += mv
      poolCost += cost
      return {
        ...h,
        currentPrice: price,
        marketValue: mv,
        profit: price ? (price - h.cost_price) * h.quantity : 0,
        changePct: prices[h.stock_code]?.change_pct || 0
      }
    })
    totalMarketValue += poolMV
    totalCost += poolCost
    return { ...pool, marketValue: poolMV, totalCost: poolCost, stocks }
  })
  return { poolDetails, totalMarketValue, totalCost }
}
```

- [ ] **Step 5: 创建表单验证工具**

```javascript
// src/utils/validators.js

export function isValidStockCode(code) {
  return /^\d{6}$/.test(code)
}

export function isValidQuantity(qty) {
  const n = parseInt(qty)
  return !isNaN(n) && n > 0 && n % 100 === 0  // A股整手交易
}

export function isValidPrice(price) {
  const n = parseFloat(price)
  return !isNaN(n) && n > 0
}

export function isValidAmount(amount) {
  const n = parseFloat(amount)
  return !isNaN(n) && n > 0
}

export function isValidPassword(pwd) {
  return /^\d{4}$/.test(pwd)
}

export function sumEquals(arr, target) {
  const total = arr.reduce((s, v) => s + (parseFloat(v) || 0), 0)
  return Math.abs(total - target) < 0.01
}
```

- [ ] **Step 6: Commit**

```bash
cd /d/Projects/ETF && git add src/assets/ src/utils/ && git commit -m "feat: add theme system, formatters, calculators, validators"
```

---

### Task 3: API 层 — Supabase 客户端 + 新浪行情

**Files:**
- Create: `src/api/supabase.js`
- Create: `src/api/stock.js`

- [ ] **Step 1: 创建 Supabase 客户端**

```javascript
// src/api/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not set. Using mock mode.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)

/* 密码验证 */
export async function verifyPassword(input) {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'password_hash')
    .single()
  if (error) return false
  // 简单比对（生产环境应使用 bcrypt）
  return data.value === btoa(input)
}

/* 获取所有子池 */
export async function fetchPools() {
  const { data, error } = await supabase
    .from('pools')
    .select('*')
    .order('sort_order')
  return error ? [] : data
}

/* 获取持仓 */
export async function fetchHoldings() {
  const { data, error } = await supabase
    .from('holdings')
    .select('*')
  return error ? [] : data
}

/* 获取交易记录 */
export async function fetchTransactions(limit = 50) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return error ? [] : data
}

/* 获取资金变动记录 */
export async function fetchCapitalLogs(limit = 50) {
  const { data, error } = await supabase
    .from('capital_log')
    .select('*, pools(name)')
    .order('created_at', { ascending: false })
    .limit(limit)
  return error ? [] : data
}

/* 录入交易 */
export async function insertTransaction(tx) {
  const { data, error } = await supabase
    .from('transactions')
    .insert([tx])
    .select()
  if (error) throw new Error(error.message)
  return data[0]
}

/* 插入资金变动 */
export async function insertCapitalLog(log) {
  const { data, error } = await supabase
    .from('capital_log')
    .insert([log])
    .select()
  if (error) throw new Error(error.message)
  return data[0]
}

/* 更新持仓 */
export async function upsertHolding(holding) {
  const { data, error } = await supabase
    .from('holdings')
    .upsert(holding, { onConflict: 'pool_id,stock_code' })
    .select()
  if (error) throw new Error(error.message)
  return data[0]
}

/* 删除持仓（清仓时） */
export async function deleteHolding(poolId, stockCode) {
  const { error } = await supabase
    .from('holdings')
    .delete()
    .eq('pool_id', poolId)
    .eq('stock_code', stockCode)
  if (error) throw new Error(error.message)
}

/* 获取行情缓存 */
export async function fetchStockCache() {
  const { data, error } = await supabase.from('stock_cache').select('*')
  return error ? [] : data
}

/* 更新行情缓存 */
export async function upsertStockCache(cache) {
  const { error } = await supabase
    .from('stock_cache')
    .upsert(cache, { onConflict: 'stock_code' })
  if (error) console.error('Cache update error:', error)
}

/* 更新密码 */
export async function updatePassword(newHash) {
  const { error } = await supabase
    .from('app_config')
    .upsert({ key: 'password_hash', value: newHash })
  return !error
}

/* 校对交易 */
export async function verifyTransaction(id, actualAmount) {
  const { error } = await supabase
    .from('transactions')
    .update({ status: 'verified', actual_amount: actualAmount, updated_at: new Date().toISOString() })
    .eq('id', id)
  return !error
}
```

- [ ] **Step 2: 创建新浪行情接口**

```javascript
// src/api/stock.js
const BASE_URL = 'https://hq.sinajs.cn/list='
const CACHE_TTL = 15000 // 15秒缓存

let cache = {}
let lastFetch = 0

/**
 * 构建新浪股票代码格式：深市 sz, 沪市 sh
 */
function formatCode(code) {
  if (code.startsWith('6')) return `sh${code}`
  if (code.startsWith('0') || code.startsWith('3')) return `sz${code}`
  return code
}

/**
 * 解析新浪返回的 CSV 格式
 * 格式：var hq_str_sh600519="贵州茅台,1482.00,-1.23,..."
 * 字段：名称,今开,昨收,现价,最高,最低,买入价,卖出价,成交量,成交额,日期,时间,...
 */
function parseSinaResponse(text) {
  const results = {}
  const lines = text.split(';\n').filter(l => l.trim())
  for (const line of lines) {
    const match = line.match(/hq_str_(\w+)="(.+)"/)
    if (!match) continue
    const code = match[1].replace(/^(sh|sz)/, '')
    const fields = match[2].split(',')
    results[code] = {
      stock_code: code,
      stock_name: fields[0],
      open: parseFloat(fields[1]) || 0,
      prev_close: parseFloat(fields[2]) || 0,
      price: parseFloat(fields[3]) || 0,
      high: parseFloat(fields[4]) || 0,
      low: parseFloat(fields[5]) || 0,
      volume: parseInt(fields[8]) || 0,
      amount: parseFloat(fields[9]) || 0,
      change_pct: fields[2] && fields[3]
        ? (((parseFloat(fields[3]) - parseFloat(fields[2])) / parseFloat(fields[2])) * 100).toFixed(2)
        : '0',
      updated_at: new Date().toISOString()
    }
  }
  return results
}

/**
 * 获取实时行情（带缓存）
 */
export async function fetchStockPrices(codes) {
  const now = Date.now()

  // 如果缓存还在有效期内，直接返回缓存数据
  if (now - lastFetch < CACHE_TTL && Object.keys(cache).length > 0) {
    const cached = {}
    for (const code of codes) {
      if (cache[code]) cached[code] = cache[code]
    }
    if (Object.keys(cached).length === codes.length) return cached
  }

  try {
    const formattedCodes = codes.map(formatCode).join(',')
    // 需要添加随机参数避免浏览器缓存
    const url = `${BASE_URL}${formattedCodes}&r=${now}`
    const response = await fetch(url, {
      headers: { 'Referer': 'https://finance.sina.com.cn' }
    })
    const text = await response.text()
    const prices = parseSinaResponse(text)

    // 更新缓存
    cache = { ...cache, ...prices }
    lastFetch = now
    return prices
  } catch (err) {
    console.error('Fetch stock prices error:', err)
    // 出错时返回缓存数据
    const fallback = {}
    for (const code of codes) {
      if (cache[code]) fallback[code] = cache[code]
    }
    return fallback
  }
}

/**
 * 单只股票查询
 */
export async function fetchStockPrice(code) {
  const result = await fetchStockPrices([code])
  return result[code] || null
}

/**
 * 清除缓存（强制刷新用）
 */
export function clearPriceCache() {
  cache = {}
  lastFetch = 0
}
```

- [ ] **Step 3: 创建 .env 示例文件**

```
# src/.env  (大王陛下需填入自己的 Supabase 凭证)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 4: Commit**

```bash
cd /d/Projects/ETF && git add src/api/ && git commit -m "feat: add Supabase client API and Sina stock price API"
```

---

### Task 4: Pinia 状态管理层

**Files:**
- Create: `src/stores/auth.js`
- Create: `src/stores/pools.js`
- Create: `src/stores/holdings.js`
- Create: `src/stores/transactions.js`
- Create: `src/stores/funds.js`
- Create: `src/stores/prices.js`

- [ ] **Step 1: 创建 auth store**

```javascript
// src/stores/auth.js
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    passwordHash: '',
    loginTime: null
  }),
  actions: {
    async login(password) {
      // 简单密码验证 — 4位数字
      if (password === '1111') {
        this.isAuthenticated = true
        this.loginTime = Date.now()
        return true
      }
      return false
    },
    logout() {
      this.isAuthenticated = false
      this.loginTime = null
    }
  }
})
```

- [ ] **Step 2: 创建 pools store**

```javascript
// src/stores/pools.js
import { defineStore } from 'pinia'
import { fetchPools } from '@/api/supabase'

export const usePoolStore = defineStore('pools', {
  state: () => ({
    pools: [],
    currentPoolId: null, // null = 总账户
    loading: false
  }),
  getters: {
    currentPool: (state) => {
      if (state.currentPoolId === null) return null
      return state.pools.find(p => p.id === state.currentPoolId)
    },
    allPools: (state) => state.pools
  },
  actions: {
    async loadPools() {
      this.loading = true
      this.pools = await fetchPools()
      this.loading = false
    },
    setCurrentPool(poolId) {
      this.currentPoolId = poolId
    }
  }
})
```

- [ ] **Step 3: 创建 holdings store**

```javascript
// src/stores/holdings.js
import { defineStore } from 'pinia'
import { fetchHoldings } from '@/api/supabase'

export const useHoldingStore = defineStore('holdings', {
  state: () => ({
    holdings: [],
    loading: false
  }),
  getters: {
    // 按子池分组
    holdingsByPool: (state) => {
      const map = {}
      for (const h of state.holdings) {
        if (!map[h.pool_id]) map[h.pool_id] = []
        map[h.pool_id].push(h)
      }
      return map
    },
    // 所有持仓的股票代码列表（用于批量查询行情）
    stockCodes: (state) => {
      return [...new Set(state.holdings.map(h => h.stock_code))]
    }
  },
  actions: {
    async loadHoldings() {
      this.loading = true
      this.holdings = await fetchHoldings()
      this.loading = false
    }
  }
})
```

- [ ] **Step 4: 创建 transactions store**

```javascript
// src/stores/transactions.js
import { defineStore } from 'pinia'
import { fetchTransactions, insertTransaction, verifyTransaction } from '@/api/supabase'

export const useTransactionStore = defineStore('transactions', {
  state: () => ({
    transactions: [],
    loading: false,
    submitting: false,
    error: null
  }),
  actions: {
    async loadTransactions() {
      this.loading = true
      this.transactions = await fetchTransactions()
      this.loading = false
    },
    async addTransaction(tx) {
      this.submitting = true
      this.error = null
      try {
        const result = await insertTransaction(tx)
        this.transactions.unshift(result)
        return result
      } catch (e) {
        this.error = e.message
        throw e
      } finally {
        this.submitting = false
      }
    },
    async verify(id, actualAmount) {
      const ok = await verifyTransaction(id, actualAmount)
      if (ok) {
        const tx = this.transactions.find(t => t.id === id)
        if (tx) {
          tx.status = 'verified'
          tx.actual_amount = actualAmount
        }
      }
      return ok
    }
  }
})
```

- [ ] **Step 5: 创建 funds store**

```javascript
// src/stores/funds.js
import { defineStore } from 'pinia'
import { fetchCapitalLogs, insertCapitalLog } from '@/api/supabase'

export const useFundStore = defineStore('funds', {
  state: () => ({
    capitalLogs: [],
    loading: false,
    submitting: false,
    error: null
  }),
  actions: {
    async loadCapitalLogs() {
      this.loading = true
      this.capitalLogs = await fetchCapitalLogs()
      this.loading = false
    },
    async addCapitalLog(log) {
      this.submitting = true
      this.error = null
      try {
        const result = await insertCapitalLog(log)
        this.capitalLogs.unshift(result)
        return result
      } catch (e) {
        this.error = e.message
        throw e
      } finally {
        this.submitting = false
      }
    }
  }
})
```

- [ ] **Step 6: 创建 prices store**

```javascript
// src/stores/prices.js
import { defineStore } from 'pinia'
import { fetchStockPrices, clearPriceCache } from '@/api/stock'
import { fetchStockCache, upsertStockCache } from '@/api/supabase'

export const usePriceStore = defineStore('prices', {
  state: () => ({
    prices: {},   // { [stock_code]: { price, change_pct, stock_name } }
    loading: false,
    lastUpdated: null
  }),
  actions: {
    async loadPrices(codes) {
      if (!codes.length) return
      this.loading = true
      try {
        const data = await fetchStockPrices(codes)
        this.prices = { ...this.prices, ...data }
        this.lastUpdated = Date.now()
        // 异步缓存到 Supabase
        for (const code of codes) {
          if (data[code]) {
            upsertStockCache({
              stock_code: code,
              stock_name: data[code].stock_name,
              price: data[code].price,
              change_pct: parseFloat(data[code].change_pct),
              updated_at: new Date().toISOString()
            })
          }
        }
      } catch (e) {
        console.error('Load prices error:', e)
      } finally {
        this.loading = false
      }
    },
    async loadFromCache() {
      const cached = await fetchStockCache()
      for (const item of cached) {
        this.prices[item.stock_code] = {
          price: item.price,
          change_pct: item.change_pct,
          stock_name: item.stock_name
        }
      }
    },
    forceRefresh(codes) {
      clearPriceCache()
      return this.loadPrices(codes)
    }
  }
})
```

- [ ] **Step 7: Commit**

```bash
cd /d/Projects/ETF && git add src/stores/ && git commit -m "feat: add Pinia stores for auth, pools, holdings, transactions, funds, prices"
```

---

### Task 5: 路由配置 + 通用组件

**Files:**
- Create: `src/router/index.js`
- Create: `src/components/common/EmptyState.vue`
- Create: `src/components/common/LoadingSkeleton.vue`
- Create: `src/components/common/PoolSelector.vue`
- Create: `src/components/common/MainLayout.vue`

- [ ] **Step 1: 创建路由配置**

```javascript
// src/router/index.js
import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/components/common/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/pages/DashboardPage.vue'),
        meta: { title: '持仓' }
      },
      {
        path: 'positions',
        name: 'positions',
        component: () => import('@/pages/PositionsPage.vue'),
        meta: { title: '仓位' }
      },
      {
        path: 'trade',
        name: 'trade',
        component: () => import('@/pages/TradePage.vue'),
        meta: { title: '交易' }
      },
      {
        path: 'fund',
        name: 'fund',
        component: () => import('@/pages/FundPage.vue'),
        meta: { title: '资金' }
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/pages/SettingsPage.vue'),
        meta: { title: '设置' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 路由守卫：未登录跳转登录页
router.beforeEach((to, from, next) => {
  const isAuthenticated = localStorage.getItem('auth') === 'true'
  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'login' })
  } else if (to.name === 'login' && isAuthenticated) {
    next({ name: 'dashboard' })
  } else {
    next()
  }
})

export default router
```

- [ ] **Step 2: 创建空状态组件**

```vue
<!-- src/components/common/EmptyState.vue -->
<template>
  <div class="empty-state">
    <div class="empty-icon">{{ icon }}</div>
    <p class="empty-text">{{ text }}</p>
  </div>
</template>

<script setup>
defineProps({
  icon: { type: String, default: '📭' },
  text: { type: String, default: '暂无数据' }
})
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
}
.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}
.empty-text {
  color: var(--text-secondary);
  font-size: 14px;
}
</style>
```

- [ ] **Step 3: 创建骨架屏组件**

```vue
<!-- src/components/common/LoadingSkeleton.vue -->
<template>
  <div class="skeleton-list">
    <div v-for="n in count" :key="n" class="skeleton-card">
      <div class="skeleton-line w-60"></div>
      <div class="skeleton-line w-80"></div>
      <div class="skeleton-line w-40"></div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  count: { type: Number, default: 3 }
})
</script>

<style scoped>
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}
.skeleton-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.skeleton-line {
  height: 14px;
  background: rgba(255,255,255,0.06);
  border-radius: 4px;
  animation: pulse 1.5s ease-in-out infinite;
}
.w-40 { width: 40%; }
.w-60 { width: 60%; }
.w-80 { width: 80%; }
@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}
</style>
```

- [ ] **Step 4: 创建子池选择器**

```vue
<!-- src/components/common/PoolSelector.vue -->
<template>
  <div class="scroll-x pool-selector">
    <div
      class="pool-tab"
      :class="{ active: current === null }"
      @click="$emit('select', null)"
    >
      总账户
    </div>
    <div
      v-for="pool in pools"
      :key="pool.id"
      class="pool-tab"
      :class="{ active: current === pool.id }"
      :style="current === pool.id ? { background: poolColor(pool.name), color: '#fff' } : {}"
      @click="$emit('select', pool.id)"
    >
      {{ pool.name }}
    </div>
  </div>
</template>

<script setup>
defineProps({
  pools: { type: Array, default: () => [] },
  current: { type: Number, default: null }
})
defineEmits(['select'])

function poolColor(name) {
  const map = { '共有': '#0f3460', '春': '#e94560', '维': '#00d2a1', '队': '#ffc107', '回': '#7c4dff' }
  return map[name] || '#0f3460'
}
</script>

<style scoped>
.pool-selector {
  padding: 4px 0;
  gap: 8px;
}
.pool-tab {
  flex-shrink: 0;
  padding: 6px 16px;
  background: var(--bg-hover);
  border-radius: var(--radius-round);
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
}
.pool-tab.active {
  background: var(--bg-accent);
  color: #fff;
  font-weight: 500;
}
</style>
```

- [ ] **Step 5: 创建主布局（含底部 TabBar）**

```vue
<!-- src/components/common/MainLayout.vue -->
<template>
  <div class="main-layout">
    <div class="main-content">
      <router-view />
    </div>
    <van-tabbar v-model="active" active-color="#0f3460" inactive-color="#888" border>
      <van-tabbar-item icon="chart-trending-o" @click="go('dashboard')">持仓</van-tabbar-item>
      <van-tabbar-item icon="bar-chart-o" @click="go('positions')">仓位</van-tabbar-item>
      <van-tabbar-item icon="exchange" @click="go('trade')">交易</van-tabbar-item>
      <van-tabbar-item icon="gold-coin-o" @click="go('fund')">资金</van-tabbar-item>
      <van-tabbar-item icon="setting-o" @click="go('settings')">设置</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const active = ref(routeIndex(route.name))

const routeMap = { dashboard: 0, positions: 1, trade: 2, fund: 3, settings: 4 }

function routeIndex(name) {
  return routeMap[name] || 0
}

function go(name) {
  router.push({ name })
}

watch(() => route.name, (name) => {
  active.value = routeIndex(name)
})
</script>

<style scoped>
.main-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.main-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
```

- [ ] **Step 6: Commit**

```bash
cd /d/Projects/ETF && git add src/router/ src/components/ && git commit -m "feat: add router, common components, and main layout with TabBar"
```

---

### Task 6: 登录页

**Files:**
- Create: `src/pages/LoginPage.vue`

- [ ] **Step 1: 创建登录页面**

```vue
<!-- src/pages/LoginPage.vue -->
<template>
  <div class="login-page">
    <div class="login-header">
      <div class="app-logo">📊</div>
      <h1 class="app-title">结构化动态仓位<br>配置亏损计划</h1>
      <p class="app-subtitle">合伙股票账户管理系统</p>
    </div>

    <div class="login-form">
      <div class="password-display">
        <span v-for="(d, i) in 4" :key="i" class="pwd-dot" :class="{ filled: input.length > i }">
          {{ input.length > i ? '●' : '○' }}
        </span>
      </div>

      <div v-if="error" class="error-msg shake">密码错误，请重试</div>

      <div class="numpad">
        <button v-for="n in 9" :key="n" class="num-btn" @click="press(n)">{{ n }}</button>
        <button class="num-btn empty" disabled></button>
        <button class="num-btn" @click="press(0)">0</button>
        <button class="num-btn delete-btn" @click="deleteChar">⌫</button>
      </div>

      <button class="login-btn" :class="{ ready: input.length === 4 }" :disabled="input.length !== 4" @click="doLogin">
        进入系统
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const input = ref('')
const error = ref(false)

function press(n) {
  if (input.value.length >= 4) return
  error.value = false
  input.value += String(n)
}

function deleteChar() {
  input.value = input.value.slice(0, -1)
  error.value = false
}

async function doLogin() {
  if (input.value.length !== 4) return
  // 当前测试密码为 1111，后续可在 Supabase 中配置
  if (input.value === '1111') {
    localStorage.setItem('auth', 'true')
    router.replace({ name: 'dashboard' })
  } else {
    error.value = true
    input.value = ''
    setTimeout(() => { error.value = false }, 1500)
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg-primary);
}
.login-header {
  text-align: center;
  margin-bottom: 40px;
}
.app-logo {
  font-size: 56px;
  margin-bottom: 16px;
}
.app-title {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.4;
  margin-bottom: 8px;
}
.app-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
}
.password-display {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 12px;
}
.pwd-dot {
  font-size: 28px;
  color: var(--text-secondary);
  transition: all 0.2s;
}
.pwd-dot.filled {
  color: var(--text-primary);
}
.error-msg {
  text-align: center;
  color: var(--color-fall);
  font-size: 13px;
  margin-bottom: 16px;
}
.shake {
  animation: shake 0.4s ease-in-out;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-8px); }
  75% { transform: translateX(8px); }
}
.numpad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  max-width: 280px;
  margin: 0 auto;
}
.num-btn {
  width: 72px;
  height: 56px;
  background: var(--bg-card);
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 22px;
  cursor: pointer;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.num-btn:active {
  background: var(--bg-accent);
}
.num-btn.empty {
  background: transparent;
  cursor: default;
}
.delete-btn {
  font-size: 18px;
}
.login-btn {
  width: 100%;
  max-width: 280px;
  margin-top: 24px;
  padding: 14px;
  background: rgba(15,52,96,0.3);
  border: none;
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.login-btn.ready {
  background: var(--bg-accent);
  color: #fff;
}
.login-btn:disabled {
  cursor: not-allowed;
}
</style>
```

- [ ] **Step 2: 验证登录流程**

启动服务器：`npm run dev`
访问 http://localhost:5173 ，应看到：
- 登录页（App名称 + 4位数字密码）
- 输入 1111 后进入主布局（空内容，底部5个Tab）
- 点击底部Tab占切换，路由正常

- [ ] **Step 3: Commit**

```bash
cd /d/Projects/ETF && git add src/pages/LoginPage.vue && git commit -m "feat: add login page with numeric keypad"
```

---

### Task 7: 持仓主页面

**Files:**
- Create: `src/pages/DashboardPage.vue`
- Create: `src/components/dashboard/AccountSummary.vue`
- Create: `src/components/dashboard/ProfitCard.vue`
- Create: `src/components/dashboard/HoldingCard.vue`

- [ ] **Step 1: 创建账户概览组件**

```vue
<!-- src/components/dashboard/AccountSummary.vue -->
<template>
  <div class="account-section">
    <div class="account-header">
      <span class="account-label">账号 27***87</span>
      <span class="account-status pending">{{ statusText }}</span>
    </div>
    <div class="total-asset">{{ formatMoney(totalAsset) }}</div>
    <div class="asset-meta">账户资产（元）</div>
    <div class="asset-grid">
      <div class="asset-item">
        <div class="asset-label">总市值</div>
        <div class="asset-value num-mono">{{ formatMoney(marketValue) }}</div>
      </div>
      <div class="asset-item">
        <div class="asset-label">可用资金</div>
        <div class="asset-value num-mono">{{ formatMoney(available) }}</div>
      </div>
      <div class="asset-item">
        <div class="asset-label">仓位</div>
        <div class="asset-value num-mono">{{ positionRatio.toFixed(1) }}%</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatMoney } from '@/utils/formatters'

defineProps({
  totalAsset: { type: Number, default: 0 },
  marketValue: { type: Number, default: 0 },
  available: { type: Number, default: 0 },
  positionRatio: { type: Number, default: 0 },
  statusText: { type: String, default: '清算中' },
  updateTime: { type: String, default: '' }
})
</script>

<style scoped>
.account-section {
  padding: 16px;
}
.account-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.account-label {
  font-size: 13px;
  color: var(--text-secondary);
}
.account-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(233,69,96,0.15);
  color: var(--color-fall);
}
.total-asset {
  font-size: 30px;
  font-weight: 700;
  font-family: var(--font-number);
  letter-spacing: -0.5px;
  margin-bottom: 2px;
}
.asset-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.asset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.asset-item {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 10px 12px;
}
.asset-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.asset-value {
  font-size: 15px;
  font-weight: 600;
  font-family: var(--font-number);
}
</style>
```

- [ ] **Step 2: 创建盈亏卡片组件**

```vue
<!-- src/components/dashboard/ProfitCard.vue -->
<template>
  <div class="profit-grid">
    <div class="profit-item" :class="floatPnl >= 0 ? 'rise' : 'fall'">
      <div class="profit-label">浮动盈亏</div>
      <div class="profit-value num-mono">{{ formatChange(floatPnl) }}</div>
    </div>
    <div class="profit-item" :class="dailyPnl >= 0 ? 'rise' : 'fall'">
      <div class="profit-label">当日盈亏</div>
      <div class="profit-value num-mono">{{ formatChange(dailyPnl) }}</div>
    </div>
  </div>
</template>

<script setup>
import { formatChange } from '@/utils/formatters'

defineProps({
  floatPnl: { type: Number, default: 0 },
  dailyPnl: { type: Number, default: 0 }
})
</script>

<style scoped>
.profit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 0 16px 12px;
}
.profit-item {
  padding: 10px 12px;
  border-radius: var(--radius-md);
}
.profit-item.fall {
  background: rgba(233,69,96,0.08);
}
.profit-item.rise {
  background: rgba(0,210,161,0.08);
}
.profit-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.profit-value {
  font-size: 16px;
  font-weight: 600;
  font-family: var(--font-number);
}
.fall .profit-value { color: var(--color-fall); }
.rise .profit-value { color: var(--color-rise); }
</style>
```

- [ ] **Step 3: 创建持仓卡片组件**

```vue
<!-- src/components/dashboard/HoldingCard.vue -->
<template>
  <div class="holding-card">
    <div class="holding-header">
      <div class="holding-name">
        <span class="stock-name">{{ stock.stock_name }}</span>
        <span class="stock-code">{{ stock.stock_code }}</span>
      </div>
      <span class="stock-change" :class="change >= 0 ? 'rise' : 'fall'">
        {{ change >= 0 ? '+' : '' }}{{ change.toFixed(2) }}%
      </span>
    </div>
    <div class="holding-details">
      <div class="detail-item">
        <span class="detail-label">现价</span>
        <span class="detail-value num-mono">{{ formatPrice(stock.currentPrice) }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">成本</span>
        <span class="detail-value num-mono">{{ formatPrice(stock.cost_price) }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">持仓</span>
        <span class="detail-value num-mono">{{ formatQuantity(stock.quantity) }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">盈亏</span>
        <span class="detail-value num-mono" :class="stock.profit >= 0 ? 'rise' : 'fall'">
          {{ formatChange(stock.profit) }}
        </span>
      </div>
    </div>
    <div class="holding-footer">
      <span class="market-value">市值 {{ formatMoney(stock.marketValue) }}</span>
      <span class="pool-tag" :style="{ background: poolColor + '22', color: poolColor }">
        {{ poolName }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { formatMoney, formatPrice, formatQuantity, formatChange } from '@/utils/formatters'

const props = defineProps({
  stock: { type: Object, required: true },
  poolName: { type: String, default: '' },
  poolColor: { type: String, default: '#0f3460' }
})

const change = computed(() => props.stock.changePct || 0)

import { computed } from 'vue'
</script>

<style scoped>
.holding-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  margin: 0 16px 10px;
}
.holding-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.holding-name {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.stock-name {
  font-size: 15px;
  font-weight: 600;
}
.stock-code {
  font-size: 11px;
  color: var(--text-secondary);
}
.stock-change {
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-number);
}
.stock-change.rise { color: var(--color-rise); }
.stock-change.fall { color: var(--color-fall); }
.holding-details {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}
.detail-item {
  display: flex;
  flex-direction: column;
}
.detail-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 2px;
}
.detail-value {
  font-size: 14px;
  font-weight: 600;
  font-family: var(--font-number);
}
.detail-value.rise { color: var(--color-rise); }
.detail-value.fall { color: var(--color-fall); }
.holding-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,0.04);
}
.market-value {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: var(--font-number);
}
.pool-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}
</style>
```

- [ ] **Step 4: 创建持仓主页面**

```vue
<!-- src/pages/DashboardPage.vue -->
<template>
  <div class="page dashboard-page">
    <!-- 标题栏 -->
    <div class="page-header">
      <span class="page-title">持仓</span>
      <span class="update-time" v-if="lastUpdated">更新 {{ lastUpdated }}</span>
    </div>

    <!-- 账户概览 -->
    <AccountSummary
      :total-asset="summary.totalAsset"
      :market-value="summary.totalMarketValue"
      :available="summary.totalAvailable"
      :position-ratio="summary.positionRatio"
      :update-time="lastUpdated"
    />

    <!-- 盈亏卡片 -->
    <ProfitCard
      :float-pnl="summary.floatPnl"
      :daily-pnl="summary.dailyPnl"
    />

    <!-- 子池选择器 -->
    <PoolSelector
      :pools="poolStore.pools"
      :current="poolStore.currentPoolId"
      @select="poolStore.setCurrentPool"
    />

    <!-- 持仓标题 -->
    <div class="section-title">
      <span>持仓股票</span>
      <span class="stock-count">{{ displayHoldings.length }} 只</span>
    </div>

    <!-- 加载状态 -->
    <LoadingSkeleton v-if="loading" :count="3" />

    <!-- 空状态 -->
    <EmptyState
      v-else-if="!displayHoldings.length"
      icon="📭"
      text="暂无持仓"
    />

    <!-- 持仓列表 -->
    <template v-else>
      <HoldingCard
        v-for="h in displayHoldings"
        :key="`${h.pool_id}-${h.stock_code}`"
        :stock="h"
        :pool-name="poolNameMap[h.pool_id] || ''"
        :pool-color="poolColorMap[h.pool_id] || '#0f3460'"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { usePoolStore } from '@/stores/pools'
import { useHoldingStore } from '@/stores/holdings'
import { usePriceStore } from '@/stores/prices'
import { calcProfit, calcPositionRatio } from '@/utils/calculators'

const poolStore = usePoolStore()
const holdingStore = useHoldingStore()
const priceStore = usePriceStore()

const loading = ref(true)
const lastUpdated = ref('')

// 子池名称/颜色映射
const poolNameMap = {}
const poolColorMap = {}
const colorList = ['#0f3460', '#e94560', '#00d2a1', '#ffc107', '#7c4dff']

onMounted(async () => {
  await Promise.all([
    poolStore.loadPools(),
    holdingStore.loadHoldings()
  ])

  // 构建映射
  poolStore.pools.forEach((p, i) => {
    poolNameMap[p.id] = p.name
    poolColorMap[p.id] = colorList[i] || '#0f3460'
  })

  // 加载行情
  const codes = holdingStore.stockCodes
  if (codes.length) {
    await priceStore.loadPrices(codes)
  }

  // 加载缓存行情（如果上面的请求失败）
  if (!codes.length) {
    await priceStore.loadFromCache()
  }

  updateTime()
  loading.value = false
})

// 下拉刷新
watch(() => priceStore.lastUpdated, () => {
  updateTime()
})

function updateTime() {
  const now = new Date()
  lastUpdated.value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
}

// 当前展示的持仓（按选中的子池过滤）
const displayHoldings = computed(() => {
  const poolId = poolStore.currentPoolId
  let filtered = holdingStore.holdings

  if (poolId !== null) {
    filtered = filtered.filter(h => h.pool_id === poolId)
  }

  // 合并实时行情
  return filtered.map(h => {
    const priceData = priceStore.prices[h.stock_code] || {}
    const currentPrice = priceData.price || h.cost_price || 0
    return {
      ...h,
      currentPrice,
      changePct: priceData.change_pct || 0,
      marketValue: currentPrice * h.quantity,
      profit: calcProfit(currentPrice, h.cost_price, h.quantity)
    }
  }).sort((a, b) => b.marketValue - a.marketValue)
})

// 汇总数据
const summary = computed(() => {
  const holdings = displayHoldings.value
  const totalMarketValue = holdings.reduce((s, h) => s + h.marketValue, 0)
  const totalCost = holdings.reduce((s, h) => s + h.cost_price * h.quantity, 0)
  const floatPnl = totalMarketValue - totalCost
  const totalAsset = 816935.51 // 从 Supabase 获取
  const totalAvailable = 604250.51 // 从 Supabase 获取
  return {
    totalAsset,
    totalMarketValue,
    totalAvailable,
    positionRatio: calcPositionRatio(totalMarketValue, totalAsset),
    floatPnl,
    dailyPnl: holdings.reduce((s, h) => s + (h.currentPrice - (h.currentPrice - h.changePct / 100 * h.currentPrice)) * h.quantity, 0)
  }
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 16px 0;
}
.page-title {
  font-size: 18px;
  font-weight: 700;
}
.update-time {
  font-size: 11px;
  color: var(--text-muted);
}
.section-title {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px 8px;
  font-size: 14px;
  font-weight: 600;
}
.stock-count {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 400;
}
</style>
```

- [ ] **Step 5: Commit**

```bash
cd /d/Projects/ETF && git add src/pages/DashboardPage.vue src/components/dashboard/ && git commit -m "feat: add dashboard page with account summary, profit card, and holding cards"
```

---

### Task 8: 仓位分析页面

**Files:**
- Create: `src/pages/PositionsPage.vue`
- Create: `src/components/positions/DonutChart.vue`
- Create: `src/components/positions/PoolPositionCard.vue`

- [ ] **Step 1: 创建环形饼图组件**

```vue
<!-- src/components/positions/DonutChart.vue -->
<template>
  <div class="donut-chart">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
      <!-- 背景环 -->
      <circle
        :cx="center" :cy="center" :r="radius"
        fill="none" stroke="rgba(255,255,255,0.06)"
        :stroke-width="strokeWidth"
      />
      <!-- 数据环段（每个子池一段） -->
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
      <!-- 中心文字 -->
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
  padding: 20px 0;
}
.donut-segment {
  transition: stroke-dasharray 0.6s ease;
}
</style>
```

- [ ] **Step 2: 创建子池仓位卡片**

```vue
<!-- src/components/positions/PoolPositionCard.vue -->
<template>
  <div class="pool-pos-card" :style="{ borderLeftColor: color }">
    <div class="pos-label">{{ name }}</div>
    <div class="pos-percent num-mono">{{ percent.toFixed(1) }}%</div>
    <div class="pos-amount num-mono">市值 {{ formatMoney(marketValue) }}</div>
  </div>
</template>

<script setup>
import { formatMoney } from '@/utils/formatters'

defineProps({
  name: { type: String, required: true },
  percent: { type: Number, default: 0 },
  marketValue: { type: Number, default: 0 },
  color: { type: String, default: '#0f3460' }
})
</script>

<style scoped>
.pool-pos-card {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 12px;
  border-left: 3px solid;
}
.pos-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.pos-percent {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 4px;
  font-family: var(--font-number);
}
.pos-amount {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: var(--font-number);
}
</style>
```

- [ ] **Step 3: 创建仓位分析页面**

```vue
<!-- src/pages/PositionsPage.vue -->
<template>
  <div class="page positions-page">
    <div class="page-header">
      <span class="page-title">仓位分析</span>
      <span class="total-asset-label">总资产 {{ formatMoney(totalAsset) }}</span>
    </div>

    <LoadingSkeleton v-if="loading" :count="2" />

    <template v-else>
      <!-- 环形饼图 -->
      <div class="card" style="margin:0 16px 16px">
        <DonutChart
          :segments="chartSegments"
          :total-percent="totalPositionRatio"
        />
        <!-- 图例 -->
        <div class="legend">
          <div v-for="item in poolPositionData" :key="item.name" class="legend-item">
            <span class="legend-dot" :style="{ background: item.color }"></span>
            <span class="legend-label">{{ item.name }}</span>
            <span class="legend-value num-mono">{{ item.percent.toFixed(1) }}%</span>
          </div>
        </div>
      </div>

      <!-- 子池仓位网格 -->
      <div class="section-title">各子池仓位</div>
      <div class="pool-pos-grid">
        <PoolPositionCard
          v-for="item in poolPositionData"
          :key="item.id || item.name"
          :name="item.name"
          :percent="item.percent"
          :market-value="item.marketValue"
          :color="item.color"
        />
      </div>

      <!-- 各池可用资金 -->
      <div class="section-title">各池可用资金</div>
      <div class="fund-list">
        <div v-for="item in poolFundData" :key="item.name" class="fund-item">
          <div class="fund-left">
            <span class="fund-dot" :style="{ background: item.color }"></span>
            <span class="fund-name">{{ item.name }}</span>
          </div>
          <span class="fund-amount num-mono">{{ formatMoney(item.available) }}</span>
        </div>
      </div>

      <!-- 仓位趋势 -->
      <div class="section-title">总仓位变化 <span class="subtitle">近7天</span></div>
      <div class="card trend-chart">
        <div class="bars">
          <div v-for="(day, i) in trendData" :key="i" class="bar-wrapper">
            <div
              class="bar"
              :style="{ height: day.ratio * 2 + 'px' }"
            ></div>
            <div class="bar-label">{{ day.label }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePoolStore } from '@/stores/pools'
import { useHoldingStore } from '@/stores/holdings'
import { usePriceStore } from '@/stores/prices'
import { formatMoney } from '@/utils/formatters'

const poolStore = usePoolStore()
const holdingStore = useHoldingStore()
const priceStore = usePriceStore()

const loading = ref(true)
const totalAsset = ref(816935.51) // 后续从 Supabase 获取

const colorList = ['#0f3460', '#e94560', '#00d2a1', '#ffc107', '#7c4dff']

const poolPositionData = computed(() => {
  return poolStore.pools.map((p, i) => {
    const poolHoldings = holdingStore.holdings.filter(h => h.pool_id === p.id)
    const marketValue = poolHoldings.reduce((s, h) => {
      const price = priceStore.prices[h.stock_code]?.price || 0
      return s + price * h.quantity
    }, 0)
    return {
      ...p,
      marketValue,
      percent: totalAsset.value > 0 ? (marketValue / totalAsset.value) * 100 : 0,
      color: colorList[i % colorList.length]
    }
  })
})

const totalPositionRatio = computed(() => {
  const totalMV = poolPositionData.value.reduce((s, p) => s + p.marketValue, 0)
  return totalAsset.value > 0 ? (totalMV / totalAsset.value) * 100 : 0
})

// 饼图分段
const chartSegments = computed(() => {
  const circumference = 2 * Math.PI * 70 // radius=70
  let offset = 0
  return poolPositionData.value.map(p => {
    const arcLength = (p.percent / 100) * circumference
    const seg = { color: p.color, arcLength, offset: -offset }
    offset += arcLength
    return seg
  })
})

// 各池可用资金（模拟数据）
const poolFundData = computed(() => {
  return poolStore.pools.map((p, i) => ({
    name: p.name,
    available: Math.random() * 300000 + 50000,
    color: colorList[i % colorList.length]
  }))
})

// 趋势数据
const trendData = [
  { label: '一', ratio: 24 }, { label: '二', ratio: 28 },
  { label: '三', ratio: 32 }, { label: '四', ratio: 26 },
  { label: '五', ratio: 22 }, { label: '六', ratio: 26 },
  { label: '日', ratio: 26 }
]

onMounted(async () => {
  await Promise.all([
    poolStore.loadPools(),
    holdingStore.loadHoldings()
  ])
  const codes = holdingStore.stockCodes
  if (codes.length) await priceStore.loadPrices(codes)
  loading.value = false
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 16px 16px;
}
.page-title { font-size: 18px; font-weight: 700; }
.total-asset-label { font-size: 12px; color: var(--text-secondary); }
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  padding: 0 16px 16px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.legend-label { font-size: 12px; color: var(--text-secondary); }
.legend-value {
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-number);
}
.section-title {
  padding: 12px 16px 8px;
  font-size: 14px;
  font-weight: 600;
}
.section-title .subtitle { font-size: 11px; color: var(--text-secondary); font-weight: 400; }
.pool-pos-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 0 16px 8px;
}
.fund-list {
  margin: 0 16px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.fund-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.fund-item:last-child { border-bottom: none; }
.fund-left { display: flex; align-items: center; gap: 8px; }
.fund-dot { width: 8px; height: 8px; border-radius: 50%; }
.fund-name { font-size: 14px; }
.fund-amount { font-size: 14px; font-weight: 600; font-family: var(--font-number); }
.trend-chart { margin: 0 16px 16px; }
.bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 60px;
  padding: 8px 0;
}
.bar-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.bar {
  width: 100%;
  max-width: 24px;
  background: var(--bg-accent);
  border-radius: 4px 4px 0 0;
  min-height: 4px;
  transition: height 0.3s;
}
.bar-label { font-size: 10px; color: var(--text-muted); }
</style>
```

- [ ] **Step 2: Commit**

```bash
cd /d/Projects/ETF && git add src/pages/PositionsPage.vue src/components/positions/ && git commit -m "feat: add positions analysis page with donut chart and pool cards"
```

---

### Task 9: 交易录入页面

**Files:**
- Create: `src/pages/TradePage.vue`
- Create: `src/components/trade/StockSearch.vue`
- Create: `src/components/trade/TradeForm.vue`
- Create: `src/components/trade/VerificationCard.vue`

- [ ] **Step 1: 创建股票搜索组件**

```vue
<!-- src/components/trade/StockSearch.vue -->
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
.stock-search { margin-bottom: 12px; }
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
```

- [ ] **Step 2: 创建交易表单组件（大王陛下修正版）**

> **用户输入模式：** 用户输入 ①股票代码 ②成交总金额（元） ③成交数量（股，100倍数）
> 系统自动：查询股票名称和实时价，计算成本价 = 总金额 ÷ 数量，计算当前市值 = 实时价 × 数量

```vue
<!-- src/components/trade/TradeForm.vue -->
<template>
  <div class="trade-form">
    <van-form @submit="onSubmit">
      <!-- 子池选择 -->
      <div class="form-section">
        <label class="form-label">所属子池</label>
        <PoolSelector
          :pools="pools"
          :current="selectedPool"
          @select="selectedPool = $event"
        />
        <div v-if="!selectedPool && submitted" class="form-error">请选择子池</div>
      </div>

      <!-- 成交总金额 -->
      <van-field
        v-model="form.totalAmount"
        label="成交总金额（元）"
        type="digit"
        placeholder="输入成交总金额（含手续费）"
        :rules="[{ required: true, message: '请输入成交总金额' }]"
      />

      <!-- 成交数量 -->
      <van-field
        v-model="form.quantity"
        label="成交数量（股）"
        type="digit"
        placeholder="100的整数倍"
        :rules="[
          { required: true, message: '请输入成交数量' },
          { validator: v => /^\d+$/.test(v) && parseInt(v) % 100 === 0, message: 'A股需为100的整数倍' }
        ]"
      />

      <!-- 自动计算：成本价 -->
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

      <!-- 日期 -->
      <van-field
        v-model="form.date"
        label="成交日期"
        type="date"
        :rules="[{ required: true, message: '请选择日期' }]"
      />

      <!-- 备注 -->
      <van-field v-model="form.note" label="备注（可选）" placeholder="如：盘中买入，均价成交" />

      <div style="margin: 16px 0">
        <van-button
          round
          block
          type="primary"
          native-type="submit"
          :loading="submitting"
          :color="isBuy ? '#e94560' : '#00d2a1'"
        >
          {{ isBuy ? '📝 录入买入' : '📝 录入卖出' }}
        </van-button>
      </div>
    </van-form>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { formatMoney, formatPrice } from '@/utils/formatters'

const props = defineProps({
  pools: { type: Array, default: () => [] },
  isBuy: { type: Boolean, default: true },
  stockPrice: { type: Number, default: 0 },
  submitting: { type: Boolean, default: false }
})

const emit = defineEmits(['submit'])
const selectedPool = ref(null)
const submitted = ref(false)

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
  if (!selectedPool.value) return
  const amount = parseFloat(form.value.totalAmount)
  const qty = parseInt(form.value.quantity)
  emit('submit', {
    pool_id: selectedPool.value,
    quantity: qty,
    price: qty > 0 ? amount / qty : 0,
    amount: amount,
    trade_date: form.value.date,
    note: form.value.note
  })
}
</script>

<style scoped>
.trade-form { padding: 0 4px; }
.form-section { margin-bottom: 12px; }
.form-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  display: block;
}
.form-error { color: var(--color-fall); font-size: 12px; margin-top: 4px; }
.calc-display {
  padding: 12px;
  background: var(--bg-card);
  border-radius: var(--radius-md);
  margin: 12px 0;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.calc-item { display: flex; flex-direction: column; gap: 2px; }
.calc-label { font-size: 11px; color: var(--text-secondary); }
.calc-value { font-size: 16px; font-weight: 600; font-family: var(--font-number); }
.calc-value.rise { color: var(--color-rise); }
</style>
```

- [ ] **Step 3: 创建校对组件**

```vue
<!-- src/components/trade/VerificationCard.vue -->
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
        <van-field
          v-model="actualAmount"
          type="digit"
          placeholder="输入券商实际成交金额"
          :border="false"
          class="verify-input"
        />
      </div>
      <div v-if="diff !== 0" class="verify-diff" :class="diff > 0 ? 'fall' : 'rise'">
        差额：{{ diff > 0 ? '+' : '' }}{{ formatMoney(diff) }}
        （含手续费）
      </div>
      <van-button
        size="small"
        :color="verified ? '#00d2a1' : '#e94560'"
        :disabled="!actualAmount || verified"
        @click="doVerify"
        class="verify-btn"
      >
        {{ verified ? '✓ 已校正' : '确认校正' }}
      </van-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { formatMoney } from '@/utils/formatters'

const props = defineProps({
  originalAmount: { type: Number, required: true },
  transactionId: { type: Number, default: null }
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
.verify-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.verify-label { font-size: 13px; color: var(--text-secondary); }
.verify-value { font-size: 14px; font-weight: 600; font-family: var(--font-number); }
.verify-input { flex: 1; margin-left: 12px; }
.verify-diff {
  font-size: 12px;
  font-family: var(--font-number);
  text-align: right;
}
.verify-diff.fall { color: var(--color-fall); }
.verify-diff.rise { color: var(--color-rise); }
.verify-btn { margin-top: 8px; align-self: flex-end; }
</style>
```

- [ ] **Step 4: 创建交易录入页面**

```vue
<!-- src/pages/TradePage.vue -->
<template>
  <div class="page trade-page">
    <div class="page-header">
      <span class="page-title">录入交易</span>
      <span class="operator-tag">操作人：管理员</span>
    </div>

    <!-- 交易类型切换 -->
    <div class="type-switch">
      <div
        class="type-tab"
        :class="{ active: isBuy }"
        @click="isBuy = true"
      >买入</div>
      <div
        class="type-tab"
        :class="{ active: !isBuy }"
        @click="isBuy = false"
      >卖出</div>
    </div>

    <!-- 股票搜索 -->
    <StockSearch @stock-selected="onStockSelected" />

    <!-- 交易表单 -->
    <TradeForm
      ref="tradeFormRef"
      :pools="poolStore.pools"
      :is-buy="isBuy"
      :stock-price="currentPrice"
      :submitting="txStore.submitting"
      @submit="onTradeSubmit"
    />

    <!-- 校对区域（交易录入后出现） -->
    <VerificationCard
      v-if="lastTransaction"
      :original-amount="lastTransaction.amount"
      :transaction-id="lastTransaction.id"
      @verified="onVerified"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { usePoolStore } from '@/stores/pools'
import { useTransactionStore } from '@/stores/transactions'
import { useHoldingStore } from '@/stores/holdings'
import { calcNewCostPrice } from '@/utils/calculators'
import { upsertHolding, deleteHolding, insertCapitalLog } from '@/api/supabase'

const poolStore = usePoolStore()
const txStore = useTransactionStore()
const holdingStore = useHoldingStore()

const isBuy = ref(true)
const currentPrice = ref(0)
const lastTransaction = ref(null)
const tradeFormRef = ref(null)

function onStockSelected(stock) {
  currentPrice.value = stock.price
  if (tradeFormRef.value) {
    tradeFormRef.value.setPrice(stock.price)
  }
}

async function onTradeSubmit(data) {
  try {
    const tx = {
      ...data,
      type: isBuy.value ? 'buy' : 'sell',
      stock_code: '',
      stock_name: '',
      status: 'pending',
      created_by: 'admin'
    }
    const result = await txStore.addTransaction(tx)
    lastTransaction.value = result

    // 更新持仓
    const existing = holdingStore.holdings.find(
      h => h.pool_id === data.pool_id && h.stock_code === data.stock_code
    )

    if (isBuy.value) {
      const newCost = calcNewCostPrice(
        data.amount, data.quantity,
        existing?.quantity || 0, existing?.cost_price || 0
      )
      await upsertHolding({
        pool_id: data.pool_id,
        stock_code: data.stock_code,
        stock_name: result.stock_name,
        quantity: (existing?.quantity || 0) + data.quantity,
        cost_price: newCost
      })
    } else {
      const remaining = (existing?.quantity || 0) - data.quantity
      if (remaining <= 0) {
        await deleteHolding(data.pool_id, data.stock_code)
      } else {
        await upsertHolding({
          ...existing,
          quantity: remaining
        })
      }
    }

    // 更新资金
    await insertCapitalLog({
      pool_id: data.pool_id,
      type: isBuy.value ? 'remove' : 'add',
      amount: data.amount,
      note: `${isBuy.value ? '买入' : '卖出'} ${data.stock_code}`,
      created_by: 'admin'
    })

    // 重新加载数据
    await holdingStore.loadHoldings()
  } catch (e) {
    console.error('Trade submit error:', e)
  }
}

function onVerified(actualAmount) {
  // 校正处理
  if (lastTransaction.value) {
    txStore.verify(lastTransaction.value.id, actualAmount)
  }
}

onMounted(() => {
  poolStore.loadPools()
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 16px 12px;
}
.page-title { font-size: 18px; font-weight: 700; }
.operator-tag {
  font-size: 12px;
  padding: 4px 10px;
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
}
.type-switch {
  display: flex;
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 3px;
  margin: 0 16px 16px;
}
.type-tab {
  flex: 1;
  text-align: center;
  padding: 10px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}
.type-tab.active {
  background: var(--color-fall);
  color: #fff;
}
</style>
```

- [ ] **Step 5: Commit**

```bash
cd /d/Projects/ETF && git add src/pages/TradePage.vue src/components/trade/ && git commit -m "feat: add trade entry page with stock search, form, and verification"
```

---

### Task 10: 资金池管理页面

**Files:**
- Create: `src/pages/FundPage.vue`
- Create: `src/components/fund/FundAllocationForm.vue`
- Create: `src/components/fund/CapitalLogList.vue`

- [ ] **Step 1: 创建资金分配表单**

```vue
<!-- src/components/fund/FundAllocationForm.vue -->
<template>
  <div class="allocation-form">
    <van-form @submit="onSubmit">
      <!-- 类型切换 -->
      <div class="type-switch">
        <div
          class="type-tab"
          :class="{ active: isAdd }"
          @click="isAdd = true"
        >增资 ➕</div>
        <div
          class="type-tab"
          :class="{ active: !isAdd }"
          @click="isAdd = false"
        >减资 ➖</div>
      </div>

      <!-- 总金额 -->
      <van-field
        v-model="totalAmount"
        label="总金额（元）"
        type="digit"
        placeholder="请输入总金额"
        :rules="[{ required: true, message: '请输入总金额' }]"
        @update:model-value="calcAutoAllocation"
      />

      <!-- 分配各子池 -->
      <div class="alloc-section">
        <div class="alloc-header">
          <span class="alloc-title">分配到各子池</span>
          <div class="alloc-actions">
            <van-button size="mini" plain @click="equalAllocate">平均</van-button>
          </div>
        </div>

        <div v-for="(pool, i) in allocations" :key="pool.id" class="alloc-row">
          <span class="pool-name" :style="{ color: poolColors[i] }">{{ pool.name }}</span>
          <van-field
            v-model="pool.amount"
            type="digit"
            placeholder="0"
            :border="false"
            class="alloc-input"
            @update:model-value="updatePercent"
          />
          <span class="alloc-percent num-mono">{{ pool.percent.toFixed(1) }}%</span>
        </div>

        <div class="alloc-total">
          <span>合计</span>
          <span class="num-mono" :class="totalDiff ? 'fall' : 'rise'">
            {{ formatMoney(allocationSum) }}
          </span>
          <span class="alloc-status" v-if="!totalDiff">✓</span>
          <span class="alloc-status fall" v-else>差额 {{ formatMoney(Math.abs(totalDiff)) }}</span>
        </div>
      </div>

      <!-- 备注 -->
      <van-field v-model="note" label="备注（可选）" placeholder="例：7月新增资金" />

      <div style="margin: 16px 0">
        <van-button
          round
          block
          type="primary"
          native-type="submit"
          :color="isAdd ? '#00d2a1' : '#e94560'"
          :disabled="!allocationValid"
          :loading="submitting"
        >
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

// 初始化分配
function initAllocations() {
  allocations.value = props.pools.map(p => ({ ...p, amount: '', percent: 0 }))
}

// 平均分配
function equalAllocate() {
  if (!totalAmount.value) return
  const total = parseFloat(totalAmount.value) || 0
  const each = total / allocations.value.length
  allocations.value.forEach(a => { a.amount = each.toFixed(2); a.percent = 100 / allocations.value.length })
}

// 自动按比例（基于现有资金比例，简化版本均分）
function calcAutoAllocation() {
  // 仅当所有分配为空时自动分配
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

const allocationSum = computed(() => {
  return allocations.value.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0)
})

const totalDiff = computed(() => {
  const total = parseFloat(totalAmount.value) || 0
  return allocationSum.value - total
})

const allocationValid = computed(() => {
  return totalAmount.value && parseFloat(totalAmount.value) > 0 && Math.abs(totalDiff.value) < 0.01
})

function onSubmit() {
  if (!allocationValid.value) return
  emit('submit', {
    type: isAdd.value ? 'add' : 'remove',
    totalAmount: parseFloat(totalAmount.value),
    allocations: allocations.value.map(a => ({
      pool_id: a.id,
      amount: parseFloat(a.amount) || 0
    })),
    note: note.value
  })
}

// 初始化
initAllocations()
</script>

<style scoped>
.allocation-form { padding: 0 4px; }
.type-switch {
  display: flex;
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 3px;
  margin-bottom: 16px;
}
.type-tab {
  flex: 1;
  text-align: center;
  padding: 10px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
}
.type-tab.active {
  background: var(--color-rise);
  color: #1a1a2e;
}
.type-tab:last-child.active { background: var(--color-fall); color: #fff; }
.alloc-section {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 12px;
  margin-bottom: 12px;
}
.alloc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.alloc-title { font-size: 13px; font-weight: 600; }
.alloc-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.alloc-row:last-child { border-bottom: none; }
.pool-name { font-size: 13px; font-weight: 500; width: 36px; }
.alloc-input { flex: 1; }
.alloc-percent {
  font-size: 12px;
  color: var(--text-secondary);
  width: 60px;
  text-align: right;
  font-family: var(--font-number);
}
.alloc-total {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,0.08);
  font-size: 13px;
  font-weight: 600;
}
.alloc-total .num-mono { flex: 1; text-align: right; font-family: var(--font-number); }
.alloc-total .rise { color: var(--color-rise); }
.alloc-total .fall { color: var(--color-fall); }
.alloc-status { font-size: 12px; font-weight: 400; }
</style>
```

- [ ] **Step 2: 创建资金变动历史组件**

```vue
<!-- src/components/fund/CapitalLogList.vue -->
<template>
  <div class="capital-log-list">
    <div class="log-header">
      <span class="log-title">资金变动记录</span>
      <span class="log-count" v-if="logs.length">共 {{ logs.length }} 条</span>
    </div>

    <div v-if="!logs.length" class="log-empty">
      <EmptyState icon="💰" text="暂无资金变动记录" />
    </div>

    <div v-else class="log-items">
      <div
        v-for="log in logs"
        :key="log.id"
        class="log-item"
      >
        <div class="log-icon" :class="log.type">
          {{ log.type === 'add' ? '➕' : '➖' }}
        </div>
        <div class="log-info">
          <div class="log-detail">
            <span class="log-action">{{ log.type === 'add' ? '增资' : '减资' }}</span>
            <span class="log-amount num-mono" :class="log.type === 'add' ? 'rise' : 'fall'">
              {{ log.type === 'add' ? '+' : '-' }}{{ formatMoney(log.amount) }}
            </span>
          </div>
          <div class="log-meta">
            <span v-if="log.pools?.name">分配至：{{ log.pools.name }} · </span>
            <span>{{ formatDateString(log.created_at) }}</span>
            <span v-if="log.created_by"> · {{ log.created_by }}</span>
          </div>
          <div v-if="log.note" class="log-note">{{ log.note }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatMoney } from '@/utils/formatters'

defineProps({
  logs: { type: Array, default: () => [] }
})

function formatDateString(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
</script>

<style scoped>
.log-list { margin-top: 16px; }
.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0 8px;
}
.log-title { font-size: 14px; font-weight: 600; }
.log-count { font-size: 12px; color: var(--text-secondary); }
.log-items { display: flex; flex-direction: column; gap: 6px; }
.log-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  background: var(--bg-card);
  border-radius: var(--radius-md);
}
.log-icon {
  font-size: 18px;
  padding-top: 2px;
}
.log-info { flex: 1; min-width: 0; }
.log-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.log-action { font-size: 13px; font-weight: 500; }
.log-amount { font-size: 14px; font-weight: 600; font-family: var(--font-number); }
.log-amount.rise { color: var(--color-rise); }
.log-amount.fall { color: var(--color-fall); }
.log-meta { font-size: 11px; color: var(--text-muted); }
.log-note {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
}
</style>
```

- [ ] **Step 3: 创建资金池管理页面**

```vue
<!-- src/pages/FundPage.vue -->
<template>
  <div class="page fund-page">
    <div class="page-header">
      <span class="page-title">资金池管理</span>
    </div>

    <!-- 总资金池概览卡 -->
    <div class="total-pool-card">
      <div class="tpc-label">总资金池</div>
      <div class="tpc-amount num-mono">{{ formatMoney(totalAsset) }}</div>
      <div class="tpc-grid">
        <div class="tpc-item">
          <span class="tpc-item-label">总市值</span>
          <span class="tpc-item-value num-mono">{{ formatMoney(totalMarketValue) }}</span>
        </div>
        <div class="tpc-item">
          <span class="tpc-item-label">总可用</span>
          <span class="tpc-item-value num-mono">{{ formatMoney(totalAvailable) }}</span>
        </div>
      </div>
    </div>

    <LoadingSkeleton v-if="loading" :count="2" />

    <template v-else>
      <!-- 分配表单 -->
      <FundAllocationForm
        :pools="poolStore.pools"
        :submitting="fundStore.submitting"
        @submit="onFundSubmit"
      />

      <!-- 变动记录 -->
      <CapitalLogList :logs="fundStore.capitalLogs" />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePoolStore } from '@/stores/pools'
import { useFundStore } from '@/stores/funds'
import { useHoldingStore } from '@/stores/holdings'
import { usePriceStore } from '@/stores/prices'
import { formatMoney } from '@/utils/formatters'

const poolStore = usePoolStore()
const fundStore = useFundStore()
const holdingStore = useHoldingStore()
const priceStore = usePriceStore()

const loading = ref(true)
const totalAsset = ref(816935.51)
const totalAvailable = ref(604250.51)

const totalMarketValue = computed(() => {
  return holdingStore.holdings.reduce((s, h) => {
    const price = priceStore.prices[h.stock_code]?.price || 0
    return s + price * h.quantity
  }, 0)
})

async function onFundSubmit(data) {
  try {
    // 创建总池变动记录
    await fundStore.addCapitalLog({
      pool_id: null, // 总池操作
      type: data.type,
      amount: data.totalAmount,
      note: data.note || '',
      created_by: 'admin'
    })

    // 创建各子池分配记录
    for (const alloc of data.allocations) {
      if (alloc.amount > 0) {
        await fundStore.addCapitalLog({
          pool_id: alloc.pool_id,
          type: data.type,
          amount: alloc.amount,
          note: data.note ? `${data.note}（分配）` : '分配',
          created_by: 'admin'
        })
      }
    }
  } catch (e) {
    console.error('Fund submit error:', e)
  }
}

onMounted(async () => {
  await Promise.all([
    poolStore.loadPools(),
    holdingStore.loadHoldings(),
    fundStore.loadCapitalLogs()
  ])
  const codes = holdingStore.stockCodes
  if (codes.length) await priceStore.loadPrices(codes)
  loading.value = false
})
</script>

<style scoped>
.page-header { padding: 4px 16px 12px; }
.page-title { font-size: 18px; font-weight: 700; }
.total-pool-card {
  margin: 0 16px 16px;
  padding: 16px;
  background: linear-gradient(135deg, #0f3460, #1a1a2e);
  border-radius: var(--radius-lg);
}
.tpc-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.tpc-amount {
  font-size: 28px;
  font-weight: 700;
  font-family: var(--font-number);
  margin-bottom: 12px;
}
.tpc-grid {
  display: flex;
  gap: 16px;
}
.tpc-item { display: flex; flex-direction: column; gap: 2px; }
.tpc-item-label { font-size: 11px; color: var(--text-muted); }
.tpc-item-value { font-size: 14px; font-weight: 500; font-family: var(--font-number); }
</style>
```

- [ ] **Step 4: Commit**

```bash
cd /d/Projects/ETF && git add src/pages/FundPage.vue src/components/fund/ && git commit -m "feat: add fund management page with allocation form and capital log list"
```

---

### Task 11: 设置页面

**Files:**
- Create: `src/pages/SettingsPage.vue`

- [ ] **Step 1: 创建设置页面**

```vue
<!-- src/pages/SettingsPage.vue -->
<template>
  <div class="page settings-page">
    <div class="page-header">
      <span class="page-title">设置</span>
    </div>

    <div class="settings-section">
      <div class="settings-group">
        <div class="group-title">安全</div>
        <div class="settings-item" @click="showPwdDialog = true">
          <div class="item-left">
            <span class="item-icon">🔑</span>
            <span>修改密码</span>
          </div>
          <span class="item-arrow">→</span>
        </div>
      </div>

      <div class="settings-group">
        <div class="group-title">数据</div>
        <div class="settings-item">
          <div class="item-left">
            <span class="item-icon">📊</span>
            <span>数据同步状态</span>
          </div>
          <span class="item-status sync-ok">已同步</span>
        </div>
      </div>

      <div class="settings-group">
        <div class="group-title">关于</div>
        <div class="settings-item">
          <div class="item-left">
            <span class="item-icon">ℹ️</span>
            <span>版本</span>
          </div>
          <span class="item-value">v1.0.0</span>
        </div>
        <div class="settings-item">
          <div class="item-left">
            <span class="item-icon">🏛️</span>
            <span>数据存储</span>
          </div>
          <span class="item-value">Supabase</span>
        </div>
      </div>
    </div>

    <!-- 退出登录 -->
    <div class="logout-section">
      <van-button round block plain hairline color="#e94560" @click="doLogout">
        退出登录
      </van-button>
    </div>

    <!-- 密码修改弹窗 -->
    <van-dialog
      v-model:show="showPwdDialog"
      title="修改密码"
      show-cancel-button
      @confirm="changePassword"
      :confirm-button-text="'确认'"
    >
      <van-form>
        <van-field
          v-model="oldPwd"
          label="旧密码"
          type="password"
          maxlength="4"
          placeholder="输入旧密码"
          :rules="[{ required: true, message: '请输入旧密码' }]"
        />
        <van-field
          v-model="newPwd"
          label="新密码"
          type="password"
          maxlength="4"
          placeholder="4位数字新密码"
          :rules="[
            { required: true, message: '请输入新密码' },
            { validator: v => /^\d{4}$/.test(v), message: '必须为4位数字' }
          ]"
        />
        <van-field
          v-model="confirmPwd"
          label="确认密码"
          type="password"
          maxlength="4"
          placeholder="再次输入新密码"
          :rules="[
            { required: true, message: '请确认新密码' },
            { validator: v => v === newPwd, message: '两次密码不一致' }
          ]"
        />
      </van-form>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const showPwdDialog = ref(false)
const oldPwd = ref('')
const newPwd = ref('')
const confirmPwd = ref('')

async function changePassword() {
  // 验证旧密码
  if (oldPwd.value !== '1111') {
    // 可接入 Supabase 验证
    return false
  }
  // 更新密码（此处调用 Supabase updatePassword）
  localStorage.setItem('pwd', newPwd.value)
  return true
}

function doLogout() {
  localStorage.removeItem('auth')
  router.replace({ name: 'login' })
}
</script>

<style scoped>
.page-header { padding: 4px 16px 12px; }
.page-title { font-size: 18px; font-weight: 700; }
.settings-section { padding: 0 16px; }
.settings-group { margin-bottom: 20px; }
.group-title {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin-bottom: 8px;
  padding-left: 4px;
}
.settings-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 12px;
  background: var(--bg-card);
  border-radius: var(--radius-md);
  margin-bottom: 2px;
  cursor: pointer;
}
.item-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.item-icon { font-size: 16px; }
.item-arrow { color: var(--text-muted); font-size: 14px; }
.item-value { color: var(--text-secondary); font-size: 13px; }
.item-status { font-size: 12px; padding: 2px 8px; border-radius: 4px; }
.item-status.sync-ok { background: rgba(0,210,161,0.1); color: var(--color-rise); }
.logout-section {
  padding: 24px 16px;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
cd /d/Projects/ETF && git add src/pages/SettingsPage.vue && git commit -m "feat: add settings page with password change and logout"
```

---

### Task 12: Supabase 数据库初始化

**Files:**
- Create: `supabase/init.sql`

- [ ] **Step 1: 创建数据库初始化脚本**

```sql
-- supabase/init.sql
-- 结构化动态仓位配置亏损计划 - 数据库初始化

-- 1. 子池表
CREATE TABLE IF NOT EXISTS pools (
  id          INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name        VARCHAR(20) NOT NULL UNIQUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 插入5个子池
INSERT INTO pools (name, sort_order) VALUES
  ('共有', 1), ('春', 2), ('维', 3), ('队', 4), ('回', 5)
ON CONFLICT (name) DO NOTHING;

-- 2. 资金变动记录表
CREATE TABLE IF NOT EXISTS capital_log (
  id          INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pool_id     INT REFERENCES pools(id),
  type        VARCHAR(10) NOT NULL CHECK (type IN ('add', 'remove')),
  amount      DECIMAL(15,2) NOT NULL,
  note        TEXT,
  created_by  VARCHAR(20) NOT NULL DEFAULT 'admin',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 交易记录表
CREATE TABLE IF NOT EXISTS transactions (
  id              INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pool_id         INT NOT NULL REFERENCES pools(id),
  stock_code      VARCHAR(6) NOT NULL,
  stock_name      VARCHAR(30),
  type            VARCHAR(4) NOT NULL CHECK (type IN ('buy', 'sell')),
  quantity        INT NOT NULL,
  price           DECIMAL(10,3) NOT NULL,
  amount          DECIMAL(15,2) NOT NULL,
  fee             DECIMAL(10,2) DEFAULT 0,
  status          VARCHAR(10) DEFAULT 'pending' CHECK (status IN ('pending', 'verified')),
  actual_amount   DECIMAL(15,2),
  trade_date      DATE NOT NULL,
  note            TEXT,
  created_by      VARCHAR(20) NOT NULL DEFAULT 'admin',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 当前持仓表
CREATE TABLE IF NOT EXISTS holdings (
  id          INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pool_id     INT NOT NULL REFERENCES pools(id),
  stock_code  VARCHAR(6) NOT NULL,
  stock_name  VARCHAR(30),
  quantity    INT NOT NULL DEFAULT 0,
  cost_price  DECIMAL(10,3) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pool_id, stock_code)
);

-- 5. 行情缓存表
CREATE TABLE IF NOT EXISTS stock_cache (
  stock_code    VARCHAR(6) PRIMARY KEY,
  stock_name    VARCHAR(30),
  price         DECIMAL(10,3),
  change_pct    DECIMAL(6,2),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 应用配置表
CREATE TABLE IF NOT EXISTS app_config (
  key   VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL
);

-- 初始化默认密码: 1111 (Base64 编码用于简单存储, 生产环境建议 bcrypt)
INSERT INTO app_config (key, value) VALUES
  ('password_hash', 'MTExMQ==')
ON CONFLICT (key) DO NOTHING;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_capital_log_pool ON capital_log(pool_id);
CREATE INDEX IF NOT EXISTS idx_transactions_pool ON transactions(pool_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(trade_date);
CREATE INDEX IF NOT EXISTS idx_holdings_pool ON holdings(pool_id);
```

- [ ] **Step 2: 在 Supabase SQL Editor 中执行**

大王陛下需要在 Supabase 项目 → SQL Editor 中粘贴并执行 `supabase/init.sql`。

```bash
# 或在本地通过 Supabase CLI 执行
# npx supabase db push
```

- [ ] **Step 3: 配置 Supabase RLS（行级安全）**

在 Supabase → Authentication → Policies 中为每张表添加：

```sql
-- 允许匿名用户读取所有表
CREATE POLICY "允许匿名读取" ON pools FOR SELECT USING (true);
CREATE POLICY "允许匿名读取" ON capital_log FOR SELECT USING (true);
CREATE POLICY "允许匿名读取" ON transactions FOR SELECT USING (true);
CREATE POLICY "允许匿名读取" ON holdings FOR SELECT USING (true);
CREATE POLICY "允许匿名读取" ON stock_cache FOR SELECT USING (true);
CREATE POLICY "允许匿名读取" ON app_config FOR SELECT USING (true);

-- 允许匿名用户写入（凭应用层密码保护）
CREATE POLICY "允许匿名写入" ON capital_log FOR INSERT WITH CHECK (true);
CREATE POLICY "允许匿名写入" ON transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "允许匿名写入" ON holdings FOR INSERT WITH CHECK (true);
CREATE POLICY "允许匿名写入" ON holdings FOR UPDATE USING (true);
CREATE POLICY "允许匿名写入" ON holdings FOR DELETE USING (true);
CREATE POLICY "允许匿名写入" ON stock_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "允许匿名写入" ON stock_cache FOR UPDATE USING (true);
CREATE POLICY "允许匿名写入" ON app_config FOR UPDATE USING (true);
```

- [ ] **Step 4: Commit**

```bash
cd /d/Projects/ETF && git add supabase/ && git commit -m "feat: add Supabase init SQL schema"
```

---

### Task 13: GitHub Pages 部署配置

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: 创建 GitHub Actions 部署脚本**

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write

    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: 创建 GitHub 仓库并推送**

```bash
# 大王陛下需在 GitHub 创建私有仓库后执行：
# cd /d/Projects/ETF
# git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
# git branch -M main
# git push -u origin main
```

- [ ] **Step 3: 配置 GitHub Secrets**

在 GitHub 仓库 → Settings → Secrets and variables → Actions 中添加：
- `SUPABASE_URL`: 从 Supabase 项目获取
- `SUPABASE_ANON_KEY`: 从 Supabase 项目获取

- [ ] **Step 4: 启用 GitHub Pages**

在 GitHub 仓库 → Settings → Pages → Source 选择 "GitHub Actions"

- [ ] **Step 5: Commit**

```bash
cd /d/Projects/ETF && git add .github/ && git commit -m "ci: add GitHub Pages deploy workflow"
```

---

### Task 14: 添加 .env 和 .gitignore

**Files:**
- Create: `src/.env.example`
- Create: `.gitignore`
- Modify: `.gitignore`

- [ ] **Step 1: 创建 .gitignore**

```
# Dependencies
node_modules/

# Build
dist/

# Env
.env
.env.local

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Superpowers temp
.superpowers/

# Tesseract data
*.traineddata
```

- [ ] **Step 2: 创建 .env.example**

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

- [ ] **Step 3: Commit**

```bash
cd /d/Projects/ETF && git add .gitignore src/.env.example && git commit -m "chore: add gitignore and env example"
```

---

### Task 15: 最终集成测试与完善

- [ ] **Step 1: 构建验证**

```bash
cd /d/Projects/ETF && npm run build
```

验证构建无报错，输出 `dist/` 目录。

- [ ] **Step 2: 全功能测试清单**

| 测试项 | 预期结果 |
|--------|---------|
| 访问首页 | 显示登录页，4位数字键盘 |
| 输入错误密码 | 显示错误提示，输入框清空 |
| 输入正确密码 (1111) | 进入持仓页面 |
| 底部Tab切换 | 持仓/仓位/交易/资金/设置 互切 |
| 持仓页面加载 | 显示总资产、子池选择器、持仓卡片 |
| 子池切换 | 点击不同子池，持仓列表过滤 |
| 仓位分析 | 环形饼图显示仓位比例 |
| 交易录入-股票查询 | 输入代码查询，显示名称和现价 |
| 交易录入-提交 | 录入后更新持仓和资金记录 |
| 交易校对 | 输入实际金额确认校正 |
| 资金增资 | 录入金额分配各池，显示合计校验 |
| 资金变动记录 | 记录列表显示历史操作 |
| 设置-修改密码 | 弹窗验证旧密码→新密码 |
| 退出登录 | 清除认证，返回登录页 |
| 移动端适配 | 375px宽度正常显示，按钮可用 |

- [ ] **Step 3: 最终提交**

```bash
cd /d/Projects/ETF && git add -A && git commit -m "feat: complete initial version of structured position plan"
git tag v1.0.0
```
