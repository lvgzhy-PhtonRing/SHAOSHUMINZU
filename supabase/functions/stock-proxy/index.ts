// Supabase Edge Function: 股票行情代理
// 部署后通过 https://mqdxmbsaddebxlallgos.supabase.co/functions/v1/stock-proxy?codes=002340,300736 调用

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers })
  }

  const url = new URL(req.url)
  const codesParam = url.searchParams.get('codes') || ''
  const codes = codesParam.split(',').filter(c => /^\d{6}$/.test(c.trim()))

  if (!codes.length) {
    return new Response(JSON.stringify({ error: '请提供股票代码, 如 ?codes=002340,300736' }), { status: 400, headers })
  }

  try {
    // 调用新浪行情接口
    const sinaCodes = codes.map(c => {
      if (c.startsWith('6')) return `sh${c}`
      if (c.startsWith('0') || c.startsWith('3')) return `sz${c}`
      return c
    }).join(',')

    const resp = await fetch(`https://hq.sinajs.cn/list=${sinaCodes}`, {
      headers: { 'Referer': 'https://finance.sina.com.cn' }
    })
    const text = await resp.text()

    // 解析新浪返回格式
    const results = {}
    const lines = text.split(';\n').filter(l => l.trim())
    for (const line of lines) {
      const match = line.match(/hq_str_(\w+)="(.+)"/)
      if (!match) continue
      const code = match[1].replace(/^(sh|sz)/, '')
      const fields = match[2].split(',')
      const price = parseFloat(fields[3]) || 0
      const prevClose = parseFloat(fields[2]) || 0
      results[code] = {
        stock_code: code,
        stock_name: fields[0] || '',
        price,
        prev_close: prevClose,
        high: parseFloat(fields[4]) || 0,
        low: parseFloat(fields[5]) || 0,
        volume: parseInt(fields[8]) || 0,
        amount: parseFloat(fields[9]) || 0,
        change_pct: prevClose > 0 ? parseFloat(((price - prevClose) / prevClose * 100).toFixed(2)) : 0,
        updated_at: new Date().toISOString()
      }
    }

    return new Response(JSON.stringify({ data: results }), { headers })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
})
