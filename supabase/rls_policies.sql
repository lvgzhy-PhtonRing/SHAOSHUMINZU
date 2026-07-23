-- ================================================================
-- Supabase 行级安全（RLS）策略 — 推荐配置
-- 应用场景：本应用目前使用 anon key + 客户端密码验证
-- 如需更安全的多用户隔离，请升级至 Supabase Auth（JWT）
-- ================================================================

-- 1. pools 表 — 公开可读（子池信息）
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pools_select_anon" ON pools
  FOR SELECT USING (true);

-- 2. holdings 表 — 仅认证用户可读写
--    （当前架构下 anon key 可直接访问，以下 SQL 需搭配 Supabase Auth 使用）
-- ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "holdings_select_own" ON holdings
--   FOR SELECT USING (auth.role() = 'authenticated');
-- CREATE POLICY "holdings_insert_own" ON holdings
--   FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "holdings_update_own" ON holdings
--   FOR UPDATE USING (auth.role() = 'authenticated')
--   WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "holdings_delete_own" ON holdings
--   FOR DELETE USING (auth.role() = 'authenticated');

-- 3. transactions 表
-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "transactions_select_own" ON transactions
--   FOR SELECT USING (auth.role() = 'authenticated');
-- CREATE POLICY "transactions_insert_own" ON transactions
--   FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "transactions_update_own" ON transactions
--   FOR UPDATE USING (auth.role() = 'authenticated');
-- CREATE POLICY "transactions_delete_own" ON transactions
--   FOR DELETE USING (auth.role() = 'authenticated');

-- 4. capital_log 表
-- ALTER TABLE capital_log ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "capital_log_select_own" ON capital_log
--   FOR SELECT USING (auth.role() = 'authenticated');
-- CREATE POLICY "capital_log_insert_own" ON capital_log
--   FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "capital_log_update_own" ON capital_log
--   FOR UPDATE USING (auth.role() = 'authenticated');
-- CREATE POLICY "capital_log_delete_own" ON capital_log
--   FOR DELETE USING (auth.role() = 'authenticated');

-- 5. stock_cache 表 — 公开可读（行情缓存）
ALTER TABLE stock_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_cache_select_anon" ON stock_cache
  FOR SELECT USING (true);
-- 写入仅限认证用户
-- CREATE POLICY "stock_cache_insert_auth" ON stock_cache
--   FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "stock_cache_update_auth" ON stock_cache
--   FOR UPDATE USING (auth.role() = 'authenticated');

-- 6. app_config 表 — 限制访问（含密码哈希等敏感信息）
-- ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "app_config_select_auth" ON app_config
--   FOR SELECT USING (auth.role() = 'authenticated');
-- CREATE POLICY "app_config_insert_auth" ON app_config
--   FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ⚠️ 启用上述 RLS 策略前，必须先将应用登录改为 Supabase Auth
-- （当前使用 localStorage 4位PIN + anon key 直连，无 JWT 令牌）
-- 否则启用 RLS 后会阻断所有 anon 请求，导致应用无法正常读写数据。
