-- ================================================================
-- audit_log 表：记录所有删除操作
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴执行
-- ================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id          INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_email  VARCHAR(100) NOT NULL,
  action      VARCHAR(20) NOT NULL,
  table_name  VARCHAR(50) NOT NULL,
  record_id   INT,
  record_info TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- 启用 RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_select_auth" ON audit_log
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "audit_log_insert_auth" ON audit_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
