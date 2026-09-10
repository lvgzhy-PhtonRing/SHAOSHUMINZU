-- ================================================================
-- Supabase 行级安全（RLS）策略 — 已启用
-- 应用场景：Supabase Auth (JWT) 认证
-- 所有数据表仅 authenticated 用户可读写
-- ================================================================

-- 1. pools 表
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pools_select_auth" ON pools
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "pools_insert_auth" ON pools
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "pools_update_auth" ON pools
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "pools_delete_auth" ON pools
  FOR DELETE USING (auth.role() = 'authenticated');

-- 2. holdings 表
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holdings_select_auth" ON holdings
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "holdings_insert_auth" ON holdings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "holdings_update_auth" ON holdings
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "holdings_delete_auth" ON holdings
  FOR DELETE USING (auth.role() = 'authenticated');

-- 3. transactions 表
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_select_auth" ON transactions
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "transactions_insert_auth" ON transactions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "transactions_update_auth" ON transactions
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "transactions_delete_auth" ON transactions
  FOR DELETE USING (auth.role() = 'authenticated');

-- 4. capital_log 表
ALTER TABLE capital_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "capital_log_select_auth" ON capital_log
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "capital_log_insert_auth" ON capital_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "capital_log_update_auth" ON capital_log
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "capital_log_delete_auth" ON capital_log
  FOR DELETE USING (auth.role() = 'authenticated');

-- 5. stock_cache 表
ALTER TABLE stock_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_cache_select_auth" ON stock_cache
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "stock_cache_insert_auth" ON stock_cache
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "stock_cache_update_auth" ON stock_cache
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "stock_cache_delete_auth" ON stock_cache
  FOR DELETE USING (auth.role() = 'authenticated');

-- 6. app_config 表
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_config_select_auth" ON app_config
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "app_config_insert_auth" ON app_config
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "app_config_update_auth" ON app_config
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "app_config_delete_auth" ON app_config
  FOR DELETE USING (auth.role() = 'authenticated');

-- ================================================================
-- 执行前请先：
-- 1. 运行 scripts/create-users.mjs 创建 4 个用户
-- 2. Supabase Dashboard → Auth → Settings → Password → Minimum password length = 6
-- 3. Supabase Dashboard → Auth → Settings → Email → Confirm email = OFF
-- 4. 粘贴执行本文件
-- 5. 测试登录和所有功能
-- ================================================================
