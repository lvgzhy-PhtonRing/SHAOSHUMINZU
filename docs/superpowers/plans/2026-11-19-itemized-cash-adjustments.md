# 校对核缺分项实施计划

> **For agentic workers:** Use the approved design in `docs/superpowers/specs/2026-11-19-itemized-cash-adjustments-design.md` and implement inline with the executing-plans workflow. Work through every task and check each item after verification.

**目标：** 资本管理页可以录入有名称、有正负金额的校对分项，自动汇总并紧凑展示。

**架构：** 在独立纯函数模块中解析、格式化和汇总五类分项，保存在现有 capital_log.note JSON 中，避免数据库迁移。AdjustmentPanel 负责录入和两级展示，FundPage 负责把净额写入现有资金账本。

**技术栈：** Vue 3、Vant、Node.js 内置测试运行器、现有 Supabase capital_log。

---

### Task 1：分项模型和金额运算

**文件：**
- 新建 `src/utils/correctionDetails.js`
- 新建 `scripts/correction-details.test.mjs`

- [x] **步骤 1：先写失败测试**

  测试股票红利、逆回购收益、利息归本、股息个税和费用误差五类分项，两个股票红利保留各自股票名，收益为正、股息个税为负、费用误差支持正负，求和后按分四舍五入。再测解析备注 JSON、格式化 `+126.68`、格式化 `-55.00`、空分项与无效金额。

  测试使用 `node:test` 和 `node:assert/strict`，直接导入 `../src/utils/correctionDetails.js`。

- [x] **步骤 2：运行测试确认功能缺失**

  运行 `node --test scripts/correction-details.test.mjs`。预期因工具模块不存在而失败。

- [x] **步骤 3：实现最小纯函数模块**

  导出类别常量、`normalizeCorrectionItems(items)`、`sumCorrectionItems(items)`、`formatSignedAmount(amount)`、`parseCorrectionNote(note)` 和 `serializeCorrectionNote(note, items)`。金额使用整数分计算。股息个税归一成扣减，其他收益归一成增加，费用误差保留用户选择的符号。序列化使用带明确前缀的 JSON 字符串，旧备注解析为无分项。

- [x] **步骤 4：运行测试确认通过**

  再运行 `node --test scripts/correction-details.test.mjs`。预期全部通过。

### Task 2：录入分项并保存汇总

**文件：**
- 修改 `src/components/fund/AdjustmentPanel.vue`
- 修改 `src/pages/FundPage.vue`

- [x] **步骤 1：添加弹窗金额计算测试**

  复用 Task 1 的纯函数测试，补一条组合案例，输入两笔股票红利、逆回购、利息、税和费用调整，验证净额正负能决定资本记录的 add/remove 类型，净额为零时不可提交。

- [x] **步骤 2：运行相关测试确认失败**

  运行 `node --test scripts/correction-details.test.mjs`，确认组合场景尚无支持函数。

- [x] **步骤 3：实现录入弹窗和 FundPage 持久化**

  生成核缺时打开分项表单，默认日期沿用现有日期输入。股票红利行包含股票名称和金额，可添加多行。逆回购收益、利息归本、股息个税、费用误差分别按类别录入。预览逐行显示带符号金额和合计。税额始终以负数显示。费用误差提供增加/扣减方向。净额为零时禁用确认。提交 payload 为 `{ amount, type, date, note, details }`，其中 `amount` 为绝对值，`type` 由净额正负决定，`details` 是规范化分项。FundPage 把 `details` 序列化到备注并保留现有 `category: 'adjust'` 及日期写法。

- [x] **步骤 4：运行功能测试**

  运行 `node --test scripts/correction-details.test.mjs`，确认正负方向、合计和序列化解析均通过。

### Task 3：紧凑两级明细和兼容旧记录

**文件：**
- 修改 `src/components/fund/AdjustmentPanel.vue`
- 修改 `scripts/correction-details.test.mjs`

- [x] **步骤 1：先增加旧数据与符号回归测试**

  测试旧的普通备注和空备注解析为空分项，同时新增分项备注可恢复股票名和 signed amounts。测试正数前缀为 `+`、负数前缀为 `-`。

- [x] **步骤 2：运行测试确认回归案例失败**

  运行 `node --test scripts/correction-details.test.mjs`，确认旧备注兼容或 signed formatting 的失败原因。

- [x] **步骤 3：实现两级明细列表**

  保留左滑删除。默认紧凑主行显示日期、校对核缺标签和一级带符号合计。点击主行展开二级列表，逐行显示类别、股票名称（仅股票红利项）和带符号金额。二级采用较小字号、较弱颜色、紧凑行距。旧记录无分项时不显示空表，展开后显示“旧记录无分项明细”。正负总额分别展示加款和扣款方向。

- [x] **步骤 4：验证构建和测试**

  运行 `node --test scripts/correction-details.test.mjs` 和 `npm run build`，确认全部通过且 Vue 模板构建成功。

### Task 4：复查差异并提交

**文件：**
- 检查以上改动文件和批准的设计说明

- [x] **步骤 1：检查完整差异**

  运行 `git diff --check` 和 `git status --short`，确认仅包含校对核缺分项功能及测试。

- [x] **步骤 2：提交功能**

  运行 `git add src/components/fund/AdjustmentPanel.vue src/pages/FundPage.vue src/utils/correctionDetails.js scripts/correction-details.test.mjs`，再运行 `git commit -m "feat: 支持校对核缺分项明细"`。
