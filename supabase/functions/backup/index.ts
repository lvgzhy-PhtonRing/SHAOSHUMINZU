import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  Deno.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const TABLES = ['pools', 'holdings', 'transactions', 'capital_log', 'stock_cache', 'app_config']
const BUCKET = 'backups'
const MAX_AGE_DAYS = 30

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers })
}

async function exportAllTables(): Promise<Record<string, unknown>> {
  const backup: Record<string, unknown> = {
    _backup_at: new Date().toISOString(),
    _version: 2,
  }
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) throw new Error(`${table}: ${error.message}`)
    backup[table] = data || []
  }
  return backup
}

async function cleanupOldBackups(): Promise<number> {
  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000)
  const { data: files, error } = await supabase.storage
    .from(BUCKET)
    .list('')

  if (error || !files) return 0

  const toDelete = files
    .filter(f => {
      const d = new Date(f.created_at)
      return d < cutoff
    })
    .map(f => f.name)

  if (toDelete.length === 0) return 0

  await supabase.storage.from(BUCKET).remove(toDelete)
  return toDelete.length
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers })
  }

  const url = new URL(req.url)
  const path = url.pathname.replace(/\/+$/, '')

  try {
    if (req.method === 'POST' && path.endsWith('/backup')) {
      const backup = await exportAllTables()
      const now = new Date()
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const filename = `backup-${timestamp}.json`

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filename, blob, { contentType: 'application/json' })

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

      const deletedCount = await cleanupOldBackups()

      return jsonResponse({
        success: true,
        filename,
        tables: TABLES,
        backup_at: backup._backup_at,
        deleted_old: deletedCount,
      })
    }

    if (req.method === 'GET' && path.endsWith('/backup/list')) {
      const { data: files, error } = await supabase.storage
        .from(BUCKET)
        .list('')

      if (error) throw new Error(error.message)

      const backups = (files || [])
        .map(f => ({
          filename: f.name,
          size: f.metadata?.size || 0,
          created_at: f.created_at,
        }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))

      return jsonResponse({ backups })
    }

    if (req.method === 'GET' && path.endsWith('/backup/restore')) {
      const file = url.searchParams.get('file')
      if (!file) return jsonResponse({ error: 'missing file param' }, 400)

      if (!/^backup-[\d\-T]+\.json$/.test(file)) {
        return jsonResponse({ error: 'invalid filename' }, 400)
      }

      const { data, error } = await supabase.storage.from(BUCKET).download(file)
      if (error) throw new Error(error.message)

      const text = await data.text()
      const backup = JSON.parse(text)
      return jsonResponse(backup)
    }

    return jsonResponse({ error: 'not found' }, 404)
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
