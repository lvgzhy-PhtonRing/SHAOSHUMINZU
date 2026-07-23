# ETF 合伙账户管理系统 — 项目指令

## 项目简介

5人合伙股票账户管理 SPA，支持多子池持仓管理、交易录入（强制校对）、资金池分配、仓位分析。

## 技术栈

| 层面 | 技术 |
|------|------|
| 框架 | Vue 3 (Composition API + `<script setup>`) |
| UI 库 | Vant 4 |
| 状态管理 | Pinia |
| 构建 | Vite 5 |
| 路由 | vue-router (Hash History) |
| 数据库 | Supabase (PostgreSQL) |
| 部署 | GitHub Pages (GitHub Actions) |
| 行情 | Supabase Edge Function → 新浪 API |

## 核心架构决策

### 子池设计
- 5个子池：公共池 + 春/维/队/回（4位合伙人）
- 总账户模式：相同股票跨子池合并显示
- 各池独立计算仓位百分比 = 市值 / 子池资产

### 交易流程（强制校对）
1. 填写交易信息（买入需搜索股票，卖出从持仓左滑带入）
2. 进入校对步骤 → 输入券商实际成交金额
3. 确认后保存（status = verified）
4. 自动更新持仓 + 资金记录 + 仓位快照

### 行情接口
- 优先调 Supabase Edge Function（stock-proxy）
- Edge Function 不可用时降级到新浪 JSONP
- 股票名称永久缓存、价格 60 分钟过期

### 认证
- 4位数字密码，本地 localStorage 缓存 SHA-256 哈希
- 同时同步到 Supabase app_config 表（跨设备）
- 登录时优先验证服务器（权威来源），网络不可达时回退本地
- 密码修改后自动同步到所有设备

### 仓位快照
- 每次交易/资金变动后自动保存当日仓位比例
- 最近 10 天数据以折线图展示在仓位分析页

## 核心规则

### 先升版后推送
每次 git push 前必须先升级版本号。位置：
- `src/pages/SettingsPage.vue` 页面显示
- `package.json` 的 `version` 字段

版本规则：bug修复/微调升小版本，新功能/重构升大版本。

### 修改原则
- **最小动刀**：只改必须改的部分，不碰无关代码
- **不添加预测性功能**：不写"未来可能有用"的代码
- **暴露困惑**：需求不明确时必须指出

### 涨跌色
涨红跌绿（A股习惯），CSS 变量 `--color-rise`（涨/红）、`--color-fall`（跌/绿）。

## 关键代码路径

| 需求 | 位置 |
|------|------|
| 初始资金逻辑 | `src/stores/funds.js` → `totalCapital` getter（从 capital_log 动态累加） |
| 版本号 | `src/pages/SettingsPage.vue` + `package.json` |
| 子池分配持久化 | `src/components/fund/FundAllocationForm.vue`（localStorage + Supabase sync） |
| 行情接口配置 | `src/api/stock.js` |
| 数据库 Schema | `supabase/init.sql` |
| 密码验证 | `src/api/supabase.js` → `verifyPassword` / `updatePassword` |
| 密码哈希工具 | `src/utils/crypto.js` → `hashPassword` / `isHashed` |
| 行情 Edge Function | `supabase/functions/stock-proxy/index.ts` |
| 仓位快照 | `src/utils/positionSnapshot.js` |
| 资金池计算 | `src/stores/funds.js` → `totalCapital` getter |
| RLS 策略参考 | `supabase/rls_policies.sql` |

## 构建与部署

```bash
npm run dev      # 本地开发 (0.0.0.0:5173)
npm run build    # 生产构建
```

CI/CD：推送到 main 分支自动触发 GitHub Pages 部署。环境变量通过 GitHub Actions secrets 注入。

## 数据流

```
用户操作 → Pinia Store → Supabase CRUD API → PostgreSQL
                                    ↕
                             Edge Function → 新浪行情
```

## 安全规范

- `.env` 被 `.gitignore` 排除，禁止提交凭据到 git
- 凭据必须通过环境变量（`import.meta.env.VITE_*`）注入，禁止硬编码
- 密码使用 SHA-256 哈希，不存明文
- 测试文件不得包含真实凭据
- 历史中泄露的凭据文件需彻底清理（`filter-branch` / `rebase` + `git push --force`）
