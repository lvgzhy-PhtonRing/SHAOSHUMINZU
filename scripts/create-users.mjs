// scripts/create-users.mjs
// 在 Supabase 后台创建 4 个合伙人账号
// 用法: SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/create-users.mjs
//
// 创建后需在 Supabase Dashboard → Auth → Settings 中：
//   1. Password → Minimum password length 改为 6
//   2. Email → Confirm email 关闭（跳过邮箱验证）

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('请设置环境变量:')
  console.error('  SUPABASE_URL=https://xxx.supabase.co')
  console.error('  SUPABASE_SERVICE_ROLE_KEY=***')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

const USERS = [
  { email: 'dui@dick.com',  password: '123456', name: '队' },
  { email: 'hui@dick.com',  password: '234567', name: '回' },
  { email: 'chun@dick.com', password: '345678', name: '春' },
  { email: 'wei@dick.com',  password: '456789', name: '维' },
]

async function createUser(user) {
  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { name: user.name }
  })
  if (error) {
    console.log(`⚠️  ${user.name} (${user.email}): ${error.message}`)
    return false
  }
  console.log(`✅ ${user.name}: ${user.email} / ${user.password}`)
  return true
}

console.log('='.repeat(50))
console.log('创建合伙人账号')
console.log('='.repeat(50))
console.log('')

for (const user of USERS) {
  await createUser(user)
}

console.log('')
console.log('='.repeat(50))
console.log('完成后请在 Supabase Dashboard 操作：')
console.log('  1. Auth → Settings → Password → Minimum password length = 6')
console.log('  2. Auth → Settings → Email → Confirm email = OFF')
console.log(''.repeat(50))
console.log('')
console.log('账号密码（请发给合伙人后让他们改密码）：')
console.log('-'.repeat(50))
for (const u of USERS) {
  console.log(`  ${u.name}: ${u.email} / ${u.password}`)
}
console.log('-'.repeat(50))
