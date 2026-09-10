# 数据安全研究报告

日期：2026-09-10
状态：待决策

## 背景

ETF 合伙账户管理系统，5 人合伙，数据存储在 Supabase (PostgreSQL)，前端部署在 GitHub Pages。用户关注两个核心风险：

1. **当前数据损毁** — 数据意外丢失或损坏
2. **某设备误操作损毁数据** — 单台设备上的误操作导致数据不可逆损毁，如何恢复

---

## 一、数据架构概览

### 数据表与可恢复性

| 表 | 性质 | 内容 | 损毁后能否从数据库重建 |
|---|---|---|---|
| `transactions` | **核心源数据** | 交易记录（买入/卖出/校验） | **不可重建** |
| `capital_log` | **核心源数据** | 资金变动（增资/减资/出入金） | **不可重建** |
| `holdings` | 派生 | 当前持仓（数量+成本） | 可从 `transactions` 用移动平均法重建 |
| `position_snapshots` | 派生 | 每日仓位快照（趋势图） | 可从 `holdings` + `prices` 重新生成 |
| `stock_cache` | 派生 | 行情缓存（股票名称+价格） | 可从行情 API 重新拉取 |
| `pools` | 静态配置 | 5 个子池定义 | `init.sql` 里有，可重建 |
| `app_config` | 配置 | 密码哈希等 | 小数据，可重置 |

**结论：只需保住 `transactions` 和 `capital_log` 两张表，其余全部可重建。**

### 认证方式

- 4 位数字 PIN 码，SHA-256 哈希后存储在 `app_config` 表
- 本地 localStorage 缓存哈希，跨设备通过 Supabase 同步
- 无 Supabase Auth（JWT），无设备区分

### 备份机制

- 唯一的备份手段：Settings 页手动导出 JSON 文件（下载至本地）
- 导入时全量覆盖（先删全部、再逐行插入）
- 无自动备份、无定时快照

---

## 二、风险点分析

### P0 — 导入无事务保护（最高风险）

`SettingsPage.vue` 的导入流程：逐表逐行先删后插，**没有数据库事务**。

风险场景：用户导入备份 → 导入到第 3 张表时网络断开/浏览器崩溃 → 前 2 张表已被清空、第 3 张表删了一半 → **数据不可逆损毁，无法回滚**。

当前代码没有"导入前先自动备份"的保护机制。

### P0 — anon key 无鉴权

应用用 Supabase anon key 直连数据库。`transactions`/`holdings`/`capital_log` 表未启用 RLS（行级安全策略）。

风险场景：anon key 打包在 GitHub Pages 的公开 JS 里 → 任何人可拿到 anon key → 直接用 Supabase API 删光所有数据 → **无法恢复**（免费版无 PITR）。

`supabase/rls_policies.sql` 文件里写了 RLS 策略但被注释掉了，实际未启用。

### P1 — 硬删除无回收站

所有删除操作（`deleteTransaction`、`deleteCapitalLog`、`deleteHolding`）都是硬删除，无软删除、无回收站、无法撤销。

风险场景：用户在某设备上误删一条交易记录 → 永久丢失 → 除非有手动备份。

### P1 — 无审计日志

无操作日志记录"谁、何时、做了什么操作"。出事后无法追溯，也无法判断是否误操作。

### P2 — 4 位 PIN 全设备共享

所有设备共用同一密码，无设备隔离。忘记密码后只能通过 anon key 直连 Supabase 修改 `app_config` 表重置（又回到 P0 风险）。

### P2 — 无自动备份

Supabase 免费版无 PITR（Point-in-Time Recovery）。唯一的备份手段是手动导出 JSON。

---

## 三、三个损毁场景与恢复方案

### 场景 A：某设备误删了单条记录

| 误删内容 | 能否恢复 | 恢复方式 |
|---|---|---|
| `holdings` 记录 | 能 | 用 `json/` 里的维护脚本从 `transactions` 重建 |
| `transactions` 记录 | **不能** | 只能靠手动备份 JSON 或券商 App 导出记录 |
| `capital_log` 记录 | **不能** | 只能靠手动备份 JSON |

### 场景 B：导入中途崩溃导致数据损毁

- 导入前未自动备份 → 已删数据无法恢复
- 崩溃后检查哪些表被清空，从最近的备份 JSON 恢复
- 最坏情况：删了一半 + 插了一半 → 用备份覆盖，但中间新产生的数据也会丢失

### 场景 C：anon key 泄露被恶意清空

- 免费版无 PITR，无法从 Supabase 侧恢复
- 只能靠手动备份 JSON 恢复
- 无备份 → 从券商 App 导出交易记录，手动重建（痛苦但可行）

---

## 四、建议措施（按优先级）

| 优先级 | 措施 | 工作量 | 防什么场景 | 说明 |
|---|---|---|---|---|
| **P0** | 导入前强制自动备份到 localStorage | 小 | 场景 B | 导入开始前将当前全部数据存入 localStorage，崩溃后可手动恢复 |
| **P0** | 启用 Supabase RLS | 中 | 场景 C | 需改造认证方式为 Supabase Auth (JWT) 或自建 token 验证 |
| **P1** | 自动定时备份（Edge Function → S3） | 中 | 场景 A/C | 每日自动导出到外部存储，不依赖用户手动操作 |
| **P1** | 删除操作加二次确认 + 操作日志表 | 小 | 场景 A | 删除前弹窗确认，同时记录到 audit_log 表 |
| **P2** | 导入用数据库事务（Edge Function） | 中 | 场景 B | 将导入逻辑封装到 Edge Function 中，用 SQL 事务包裹全部操作 |
| **P2** | 升级 Supabase Pro（$25/月）获 PITR | 小 | 全部 | 支持 7 天内任意时间点恢复 |

---

## 五、决策记录

### P0-1 导入前强制手动导出 — 已确认 ✅

采用**方案 A：导入前强制手动导出**。

流程：点"导入数据" → 选文件 → 弹窗提示"请先导出当前数据到本地" → 点"先导出"按钮自动下载备份文件 → 导出成功后弹窗切换为"确认导入" → 才能点确认。导出失败则阻止导入。

已实施（v4.0.4），改动文件：`src/pages/SettingsPage.vue`

### P0-2 启用 Supabase RLS — 已决策 ✅

采用**方案 A：Supabase Auth + RLS**。

具体方案：
- 管理员在 Supabase 后台创建 4 个假邮箱账号，发放给 4 位合伙人，各自改密码
- 忘记密码找管理员重置
- 前端改造登录页（PIN → 邮箱+密码），启用 RLS 保护数据

**用户配置**：

| 合伙人 | 邮箱 | 初始密码 |
|---|---|---|
| 队 | dui@etf.com | 6 位数字，用户自改 |
| 回 | hui@etf.com | 6 位数字，用户自改 |
| 春 | chun@etf.com | 6 位数字，用户自改 |
| 维 | wei@etf.com | 6 位数字，用户自改 |

密码策略：Supabase Dashboard → Auth → Password → Minimum password length 改为 6

**待实施步骤**：

| 步骤 | 内容 | 文件 |
|---|---|---|
| 1 | 写脚本创建 4 个账号（在 Supabase 后台） | 新建 `scripts/create-users.mjs` |
| 2 | 改造登录页：PIN 输入 → 邮箱+密码 | `src/pages/LoginPage.vue` |
| 3 | 所有 Supabase 调用加 JWT（`supabase.auth.getSession()`） | `src/api/supabase.js` |
| 4 | 启用 RLS 策略（取消注释） | `supabase/rls_policies.sql` |
| 5 | 改造修改密码功能（用 `supabase.auth.updateUser()`） | `src/pages/SettingsPage.vue` |

### P1-1 自动定时备份 — 已决策 ✅

采用**方案 A：Edge Function + Supabase Storage**。

每日定时运行 Edge Function，导出全部表数据为 JSON，上传到 Supabase Storage，保留最近 30 天备份。

**待实施步骤**：

| 步骤 | 内容 | 文件 |
|---|---|---|
| 1 | 创建 Edge Function：导出全部表 → 上传 Storage | 新建 `supabase/functions/backup/index.ts` |
| 2 | 创建 Storage bucket：`backups`（private） | Supabase Dashboard |
| 3 | 配置定时触发器（Supabase 内置 cron 或外部调度） | Supabase Dashboard 或外部 cron |
| 4 | 添加备份恢复功能（Settings 页从 Storage 下载） | `src/pages/SettingsPage.vue` |

### 待决策项

1. **是否升级 Supabase Pro**：$25/月，5 人合伙分摊每人 $5/月，获 PITR + 更大配额
2. **操作日志范围**：仅记录删除操作，还是所有写操作（INSERT/UPDATE/DELETE）
