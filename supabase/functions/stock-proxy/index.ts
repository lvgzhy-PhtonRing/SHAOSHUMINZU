import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers })
  }

  const url = new URL(req.url)
  const codesParam = url.searchParams.get('codes') || ''
  const codes = codesParam.split(',').filter(function(c) { return /^\d{6}$/.test(c.trim()) })

  if (codes.length === 0) {
    return new Response(JSON.stringify({ error: 'missing codes param' }), { status: 400, headers })
  }

  try {
    var sinaCodes = codes.map(function(c) {
      if (c.startsWith('6')) return 'sh' + c
      if (c.startsWith('0') || c.startsWith('3')) return 'sz' + c
      return c
    }).join(',')

    var resp = await fetch('https://hq.sinajs.cn/list=' + sinaCodes, {
      headers: { 'Referer': 'https://finance.sina.com.cn' }
    })

    // 新浪返回 GB18030 编码，需转成 UTF-8
    var buffer = await resp.arrayBuffer()
    var decoder = new TextDecoder('gb18030')
    var text = decoder.decode(buffer)

    var results = {}
    var lines = text.split(';\n').filter(function(l) { return l.trim() })
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i]
      var match = line.match(/hq_str_(\w+)="(.+)"/)
      if (!match) continue
      var code = match[1].replace(/^(sh|sz)/, '')
      var fields = match[2].split(',')
      var price = parseFloat(fields[3]) || 0
      var prevClose = parseFloat(fields[2]) || 0
      results[code] = {
        stock_code: code,
        stock_name: fields[0] || '',
        price: price,
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
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers })
  }
})
