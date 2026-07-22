# 结构化动态仓位配置亏损计划 — 设计文档

> 作者：大王陛下 & AI 助手
> 日期：2026-07-22
> 状态：设计稿（待审核）

---

## 1. 项目概述

### 1.1 项目目的

一个面向5人合伙股票账户的移动端持仓管理与交易录入系统。支持按子池（共有 + 4位合伙人）独立核算资金与股票持仓，实时获取A股行情，记录交易并支持校正。

### 1.2 核心功能

| 功能 | 说明 |
|------|------|
| **持仓总览** | 展示总资产、总市值、可用资金、仓位比例、浮动盈亏、当日盈亏 |
| **子池切换** | 总账户 / 共有 / 春 / 维 / 队 / 回 六个视图切换 |
| **仓位分析** | 环形饼图展示总仓位及子池分布，各池可用资金明细 |
| **交易录入** | 记录买入/卖出，自动填入股票名称和现价，指定子池，成交校正 |
| **资金池管理** | 增资/减资 → 分配到5个子池，资金变动历史 |
| **实时行情** | 接入新浪财经 A股 实时行情接口 |

### 1.3 用户角色

| 角色 | 权限 |
|------|------|
| **管理员** | 全部权限：交易录入、资金管理、密码管理 |
| **查看者** | 浏览持仓、仓位分析（共用同一密码进入） |

> **信任模型：** 4位合伙人共用统一4位数字密码，信任度高。日常仅查看，由指定管理员执行交易和资金操作。

---

## 2. 技术架构

### 2.1 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端框架** | Vue 3 (Composition API) | 响应式数据驱动，组件化开发 |
| **UI 组件库** | Vant 4 | 移动端优先的 Vue 组件库 |
| **CSS 方案** | 组件级样式 + CSS Variables | 深色主题，卡片化设计 |
| **构建工具** | Vite 5 | 极速构建，按需加载 |
| **数据存储** | Supabase (PostgreSQL) | 云端数据库，REST API + 实时订阅 |
| **行情接口** | 新浪财经 `hq.sinajs.cn` | 免费 A 股实时行情 |
| **部署** | GitHub Pages | 静态托管，CI/CD 自动部署 |
| **版本管理** | Git + GitHub | 代码托管与协作 |

### 2.2 架构示意图

```
┌─────────────────────────────────────────────────┐
│                  浏览器 (移动端)                    │
│  ┌─────────────────────────────────────────────┐ │
│  │          Vue 3 SPA (Vite 构建)               │ │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌───────────┐  │ │
│  │  │持仓页│ │仓位页│ │交易页│ │ 资金池页   │  │ │
│  │  └──┬───┘ └──┬───┘ └──┬───┘ └─────┬─────┘  │ │
│  │     │         │         │            │        │ │
│  │  ┌──┴─────────┴─────────┴────────────┴──┐    │ │
│  │  │         状态管理层 (Pinia)              │    │ │
│  │  └──┬───────────────────────────────┬───┘    │ │
│  │     │                               │        │ │
│  │  ┌──┴────────┐               ┌──────┴───┐   │ │
│  │  │Supabase JS│               │新浪行情API│   │ │
│  │  └───┬───────┘               └──────┬───┘   │ │
│  └──────┼───────────────────────────────┼───────┘ │
└─────────┼───────────────────────────────┼─────────┘
          │                               │
    ┌─────┴──────┐               ┌───────┴──────┐
    │  Supabase  │               │   sina.com   │
    │PostgreSQL  │               │ 行情接口(只读) │
    └────────────┘               └──────────────┘
```

### 2.3 部署流程

```
git push → GitHub → GitHub Actions → build → deploy to GitHub Pages
                                                ↕
                                         supabase.co (数据层)
```

---

## 3. UI/UX 设计

### 3.1 设计语言

| 维度 | 设计原则 |
|------|---------|
| **风格** | 现代简约（Modern Clean）+ SaaS 仪表盘（Dashboard UI） |
| **布局** | 卡片化布局（Card-Based Layout） |
| **配色** | 深色主题（主色 `#1a1a2e`，卡片 `#16213e`，强调 `#0f3460`） |
| **涨跌色** | 跌→红 `#e94560`，涨→绿 `#00d2a1` |
| **字体** | 数字用等宽字体，便于阅读金额和股价 |
| **交互** | 点击反馈、轻触滑动、底部Tab导航 |

### 3.2 页面路由

| 路由 | 页面 | 底部Tab |
|------|------|---------|
| `/` | 登录页（4位数字密码） | — |
| `/dashboard` | 持仓主页面 | 📋 持仓 |
| `/positions` | 仓位分析页面 | 🥧 仓位 |
| `/trade` | 交易录入页面 | 💹 交易 |
| `/fund` | 资金池管理页面 | 💰 资金 |
| `/settings` | 设置页面 | ⚙️ 设置 |

### 3.3 页面详细设计

#### 3.3.1 登录页
- 居中显示 App 名称"结构化动态仓位配置亏损计划"
- 4位数字密码输入框（带遮罩）
- 错误提示：密码错误时显示抖动动画
- 自动对焦移动端数字键盘

#### 3.3.2 持仓主页面 `/dashboard`
- **顶部区域：** 账号标识、更新时间、状态标签（清算中）
- **资产总览卡片：** 总资产（大号字体）、总市值/可用资金/仓位三栏
- **盈亏卡片：** 浮动盈亏（红） + 当日盈亏（红/绿）
- **子池切换条：** 总账户 / 共有 / 春 / 维 / 队 / 回 横向滚动可切换
- **持仓列表：** 每只股票一张卡片，展示：
  - 股票名称 + 代码 + 涨跌幅
  - 现价 / 成本 / 持仓数量 / 盈亏
  - 市值 + 所属子池标签
- **空状态：** 某子池无持仓时显示"暂无持仓"

#### 3.3.3 仓位分析页面 `/positions`
- **环形饼图：** SVG 绘制，展示总仓位百分比
- **子池仓位网格：** 2×3 网格卡片，每个子池显示：
  - 左侧颜色标识条
  - 仓位百分比（大号字体）
  - 市值金额
- **各池可用资金明细：** 列表展示5个子池的可用资金
- **仓位趋势图：** 近7/30天总仓位变化柱状图

#### 3.3.4 交易录入页面 `/trade`
- **交易类型切换：** 买入 / 卖出（Tab切换）
- **股票代码输入：** 输入6位代码，自动查询名称和现价
- **实时行情展示：** 查询后显示股票名称、市场、当前价格
- **子池选择：** 横向标签选择（共有/春/维/队/回），标签变色表示选中
- **数量输入：** 成交股数
- **价格自动填入：** 默认填入实时行情价，可手动修改
- **成交金额：** 自动计算（数量×价格），显示预估手续费
- **成交日期：** 默认当天，可修改
- **备注：** 可选文本
- **提交按钮：** 确认录入

**校对功能区：**
- 录入后可点击"校对"按钮
- 输入实际成交金额（券商端实际扣款/入账）
- 系统自动计算差额（如含额外手续费）
- 确认校正后更新持仓成本

#### 3.3.5 资金池管理页面 `/fund`
- **总资金池概览卡：** 渐变色背景，显示总资产、总市值、总可用
- **增资/减资切换：** Tab切换
- **金额输入：** 总金额
- **分配到各子池：** 5个输入行，每行一个子池
  - 子池名称（带颜色标识）
  - 金额输入框
  - 右侧显示占比百分比
  - 底部合计校验（总和必须等于总金额）
- **快速分配：** "平均分配"、"按比例"快捷按钮
- **备注：** 可选
- **确认按钮：** 提交并记录
- **资金变动记录列表：** 历史记录，显示时间、金额、类型、操作人

#### 3.3.6 设置页面 `/settings`
- 修改密码：输入旧密码 → 新密码 → 确认新密码
- 显示版本号
- 数据同步状态（Supabase 连接状态）
- 退出登录

### 3.4 交互细节

| 交互 | 行为 |
|------|------|
| **下拉刷新** | 持仓页面下拉刷新行情数据和持仓 |
| **加载状态** | 数据加载时显示 Skeleton 骨架屏 |
| **错误状态** | 网络错误时显示错误提示 + 重试按钮 |
| **空状态** | 无数据时显示友好提示图标 |
| **底部Tab** | 选中态高亮强调色，切换时图标颜色变化 |
| **数字键盘** | 交易和资金页面金额输入弹出数字键盘 |
| **滑动返回** | 支持手势滑动 |

---

## 4. 数据模型

### 4.1 Supabase 表结构

#### 4.1.1 `pools` — 子池表

```sql
CREATE TABLE pools (
  id          INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name        VARCHAR(20) NOT NULL UNIQUE,   -- '共有', '春', '维', '队', '回'
  sort_order  INT NOT NULL DEFAULT 0,        -- 排序
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 初始化数据
INSERT INTO pools (name, sort_order) VALUES
  ('共有', 1), ('春', 2), ('维', 3), ('队', 4), ('回', 5);
```

#### 4.1.2 `capital_log` — 资金变动记录

```sql
CREATE TABLE capital_log (
  id          INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pool_id     INT REFERENCES pools(id),           -- null 表示总池操作
  type        VARCHAR(10) NOT NULL,               -- 'add' 增资, 'remove' 减资
  amount      DECIMAL(15,2) NOT NULL,             -- 金额
  note        TEXT,
  created_by  VARCHAR(20) NOT NULL DEFAULT 'admin',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4.1.3 `transactions` — 交易记录表

```sql
CREATE TABLE transactions (
  id              INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pool_id         INT NOT NULL REFERENCES pools(id),
  stock_code      VARCHAR(6) NOT NULL,            -- 6位股票代码
  stock_name      VARCHAR(30),                    -- 股票名称
  type            VARCHAR(4) NOT NULL,            -- 'buy' 买入, 'sell' 卖出
  quantity        INT NOT NULL,                   -- 成交股数
  price           DECIMAL(10,3) NOT NULL,         -- 成交价格
  amount          DECIMAL(15,2) NOT NULL,         -- 成交金额（含预估手续费）
  fee             DECIMAL(10,2) DEFAULT 0,        -- 预估手续费
  status          VARCHAR(10) DEFAULT 'pending',  -- 'pending' 待校对, 'verified' 已校对
  actual_amount   DECIMAL(15,2),                  -- 实际成交金额（校正后）
  trade_date      DATE NOT NULL,                  -- 成交日期
  note            TEXT,
  created_by      VARCHAR(20) NOT NULL DEFAULT 'admin',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4.1.4 `holdings` — 当前持仓视图（由交易实时计算）

```sql
CREATE TABLE holdings (
  id          INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pool_id     INT NOT NULL REFERENCES pools(id),
  stock_code  VARCHAR(6) NOT NULL,
  stock_name  VARCHAR(30),
  quantity    INT NOT NULL DEFAULT 0,             -- 持仓数量
  cost_price  DECIMAL(10,3) NOT NULL DEFAULT 0,   -- 持仓成本均价
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pool_id, stock_code)
);
```

#### 4.1.5 `stock_cache` — 行情缓存

```sql
CREATE TABLE stock_cache (
  stock_code    VARCHAR(6) PRIMARY KEY,
  stock_name    VARCHAR(30),
  price         DECIMAL(10,3),                    -- 当前价
  change_pct    DECIMAL(6,2),                     -- 涨跌幅%
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4.1.6 `app_config` — 应用配置

```sql
CREATE TABLE app_config (
  key         VARCHAR(50) PRIMARY KEY,
  value       TEXT NOT NULL
);

-- 初始化
INSERT INTO app_config (key, value) VALUES
  ('password_hash', '<bcrypt-hash>');             -- 4位密码的 bcrypt 哈希
```

### 4.2 核心数据流

```
买入交易流程：
  [录入交易] → insert transactions(type='buy')
              → update holdings(quantity +, cost_price 重新计算)
              → update capital_log(pool_id, type='remove', amount=成交金额)

卖出交易流程：
  [录入交易] → insert transactions(type='sell')
              → update holdings(quantity -, 若归零则删除)
              → update capital_log(pool_id, type='add', amount=成交金额)

校对流程：
  [点击校对] → update transactions(status='verified', actual_amount=实际金额)
             → 重新计算 holdings.cost_price（差额分摊）

行情刷新流程：
  [下拉刷新] → 从新浪接口获取持仓股票最新行情
             → 更新 stock_cache
             → 更新持仓页面的现价和盈亏计算
```

---

## 5. 组件设计

### 5.1 组件树

```
App.vue
├── LoginPage.vue (4位密码登录)
└── MainLayout.vue (登录后的主布局)
    ├── TabBar.vue (底部5个Tab导航)
    ├── DashboardPage.vue (持仓主页面)
    │   ├── AccountSummary.vue (总资产概览)
    │   ├── ProfitCard.vue (盈亏卡片)
    │   ├── PoolSelector.vue (子池切换条)
    │   ├── HoldingCard.vue (持仓股票卡片)
    │   └── EmptyState.vue (空状态)
    ├── PositionsPage.vue (仓位分析)
    │   ├── DonutChart.vue (环形饼图 SVG)
    │   ├── PoolPositionCard.vue (子池仓位卡片)
    │   └── TrendChart.vue (仓位趋势柱状图)
    ├── TradePage.vue (交易录入)
    │   ├── TradeTypeSwitch.vue (买入/卖出切换)
    │   ├── StockSearch.vue (股票查询)
    │   ├── PoolSelector.vue (子池选择 - 复用)
    │   ├── TradeForm.vue (交易表单)
    │   └── VerificationCard.vue (校对功能区)
    ├── FundPage.vue (资金池管理)
    │   ├── CapitalTypeSwitch.vue (增/减资切换)
    │   ├── FundAllocationForm.vue (分配表单)
    │   └── CapitalLogList.vue (变动记录列表)
    └── SettingsPage.vue (设置)
        └── PasswordChange.vue (密码修改)
```

### 5.2 跨组件共享状态（Pinia Store）

| Store | 状态 |
|-------|------|
| **useAuthStore** | password, isAuthenticated |
| **usePoolStore** | pools[], currentPoolId |
| **useHoldingStore** | holdings[], accountSummary (totalAsset, totalMarketValue, available, floatPnl, dailyPnl, positionRatio) |
| **useTransactionStore** | transactions[], currentTrade |
| **useFundStore** | capitalLogs[], poolBalances |
| **usePriceStore** | stockPrices{} (由新浪接口更新) |

---

## 6. 外部接口

### 6.1 新浪财经行情接口

```
请求: GET https://hq.sinajs.cn/list=sz002340,sz300736
响应: var hq_str_sz002340="格林美,6.420,-0.71,..."
```

**解析逻辑：**
```
格式: 股票名称, 现价, 涨跌幅, 昨收, 今开, 成交量, 成交额...
示例: 格林美,6.420,6.466,17000,109140.000,...
```

**调用策略：**
- 页面加载时批量查询所有持仓股票
- 下拉刷新时重新获取
- 缓存 15 秒内不重复请求
- 错误时显示上次缓存数据 + 错误标识

### 6.2 Supabase API

使用 `@supabase/supabase-js` 客户端库直接连接：

```javascript
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

**安全策略：** 启用行级安全（RLS），确保数据访问需要匿名密钥配合应用逻辑保护。

---

## 7. 数据同步策略（关闭时同步）

### 7.1 同步机制

| 场景 | 策略 |
|------|------|
| **页面关闭时** | 触发 `beforeunload` 事件，通过 `navigator.sendBeacon()` 发送最后的同步信号 |
| **每次操作后** | 交易/资金变更实时写入 Supabase（不依赖关闭时同步） |
| **页面加载时** | 从 Supabase 拉取最新数据 |
| **离线警告** | 网络断开时显示提示，数据暂存本地，恢复连接后同步 |

### 7.2 为什么需要"关闭时同步"

用户的描述"每次关闭时同步"——实际上数据是每次操作实时写入 Supabase 的，关闭时同步主要是：
1. 确保最后一次操作已提交
2. 清理本地缓存状态
3. 记录登录/退出日志

---

## 8. 安全设计

| 维度 | 措施 |
|------|------|
| **应用密码** | 4位数字密码，bcrypt 哈希后存 Supabase |
| **传输安全** | Supabase 默认 HTTPS |
| **行情接口** | 只读公开接口，无密钥 |
| **数据访问** | 通过 Supabase RLS 控制 |
| **GitHub 部署** | 仓库私有，环境变量（Supabase URL/Key）通过 GitHub Actions Secrets |

---

## 9. 目录结构

```
etf-portfolio/
├── public/
│   └── favicon.ico
├── src/
│   ├── api/
│   │   ├── supabase.js          # Supabase 客户端初始化
│   │   └── stock.js             # 新浪行情接口封装
│   ├── assets/
│   │   └── styles/
│   │       ├── variables.css     # CSS 变量（主题色）
│   │       └── global.css        # 全局样式
│   ├── components/
│   │   ├── common/
│   │   │   ├── EmptyState.vue
│   │   │   ├── LoadingSkeleton.vue
│   │   │   └── PoolSelector.vue
│   │   ├── dashboard/
│   │   │   ├── AccountSummary.vue
│   │   │   ├── ProfitCard.vue
│   │   │   └── HoldingCard.vue
│   │   ├── positions/
│   │   │   ├── DonutChart.vue
│   │   │   └── PoolPositionCard.vue
│   │   ├── trade/
│   │   │   ├── StockSearch.vue
│   │   │   ├── TradeForm.vue
│   │   │   └── VerificationCard.vue
│   │   └── fund/
│   │       ├── FundAllocationForm.vue
│   │       └── CapitalLogList.vue
│   ├── pages/
│   │   ├── LoginPage.vue
│   │   ├── DashboardPage.vue
│   │   ├── PositionsPage.vue
│   │   ├── TradePage.vue
│   │   ├── FundPage.vue
│   │   └── SettingsPage.vue
│   ├── stores/
│   │   ├── auth.js
│   │   ├── pools.js
│   │   ├── holdings.js
│   │   ├── transactions.js
│   │   ├── funds.js
│   │   └── prices.js
│   ├── utils/
│   │   ├── formatters.js        # 金额、日期格式化
│   │   ├── calculators.js       # 盈亏、仓位计算
│   │   └── validators.js        # 表单验证
│   ├── router/
│   │   └── index.js
│   ├── App.vue
│   └── main.js
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

---

## 10. 扩展性考虑

| 场景 | 预留设计 |
|------|---------|
| **增加更多子池** | pools 表支持动态添加，UI 子池选择器自动适配 |
| **增加用户权限** | 预留角色字段，可扩展为每人独立密码+权限 |
| **导出报表** | 交易记录和资金记录支持 CSV 导出 |
| **多市场** | 行情接口层抽象，可扩展为港股/美股 |
| **历史K线** | 预留趋势图组件，可扩展显示更多维度 |

---

## 审核清单

- [x] 所有页面设计已在大王陛下面前确认
- [x] 命名规范已确认：标题、子池名、用户名
- [x] 数据模型覆盖所有业务场景
- [x] 技术方案已选定（Vue 3 + Vant + Supabase）
- [x] 外部接口已确定（新浪财经）
- [x] 无占位符和 TBD 项
- [x] 架构与功能描述一致
