-- ================================================================
-- Supabase Storage Bucket：backups（自动备份存储）
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴执行
-- ================================================================

-- 创建 backups bucket（私有，仅 Edge Function 可访问）
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- 仅允许 service_role（Edge Function）读写 backups bucket
-- 前端无法直接访问，必须通过 Edge Function 中转
DROP POLICY IF EXISTS "backups_service_role_all" ON storage.objects;
CREATE POLICY "backups_service_role_all" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'backups')
  WITH CHECK (bucket_id = 'backups');

-- ================================================================
-- Edge Function 部署（需配置 SUPABASE_SERVICE_ROLE_KEY secret）
-- ================================================================
-- 1. Supabase Dashboard → Edge Functions → Secrets
--    添加: SUPABASE_SERVICE_ROLE_KEY = <你的 service role key>
--    （在 Settings → API 中找到 service_role key）
--
-- 2. 部署 Edge Function:
--    supabase functions deploy backup
--    或手动上传 supabase/functions/backup/index.ts
--
-- 3. GitHub Actions 触发（已有 .github/workflows/backup.yml）
--    每次部署后会自动执行
-- ================================================================
