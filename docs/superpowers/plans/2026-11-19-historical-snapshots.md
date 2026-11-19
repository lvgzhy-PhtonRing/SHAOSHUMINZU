# 历史资产快照补算实施计划

- [x] 用 Node 测试覆盖按成交日期还原仓位和现金、补录后日期失效、缺行情时跳过，以及原快照优先。
- [x] 在 `src/utils/historicalSnapshotLedger.js` 实现可独立测试的历史持仓、现金和估值计算。
- [x] 在 `src/api/stock.js` 复用新浪日线并加入交易日查询，在 `src/utils/historicalSnapshots.js` 协调读取账本、估值和本地缓存。
- [x] 在登录后的主布局触发后台补算，交易完成后刷新，趋势页合并原始与补算结果。
- [x] 运行 `node --test scripts/historical-snapshots.test.mjs` 和 `npm run build`。
