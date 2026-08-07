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

  // === 拼音/名称联想模式 (key= 参数) ===
  const keyParam = url.searchParams.get('key') || ''
  if (keyParam.trim()) {
    try {
      const suggestUrl = 'https://suggest3.sinajs.cn/suggest/type=11,12,13,14,15&key=' + encodeURIComponent(keyParam.trim())
      const resp = await fetch(suggestUrl, {
        headers: { 'Referer': 'https://finance.sina.com.cn' }
      })

      const buffer = await resp.arrayBuffer()
      const decoder = new TextDecoder('gb18030')
      const text = decoder.decode(buffer)

      // 解析 var suggestvalue="字段1,字段2,...;字段1,字段2,..."
      const match = text.match(/var suggestvalue="([^"]*)"/)
      const suggestions: Array<{ stock_code: string; stock_name: string; market: string }> = []

      if (match) {
        const entries = match[1].split(';').filter(function (e) { return e.trim() })
        for (const entry of entries) {
          const parts = entry.split(',')
          // parts[0]=名称, parts[1]=类型(11=沪A,12=深A), parts[2]=代码
          const name = parts[0] || ''
          const type = parts[1] || ''
          const code = parts[2] || ''
          if (!/^\d{6}$/.test(code)) continue
          if (type !== '11' && type !== '12') continue
          suggestions.push({
            stock_code: code,
            stock_name: name,
            market: type === '11' ? '沪' : '深'
          })
        }
      }

      return new Response(JSON.stringify({ suggestions }), { headers })
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers })
    }
  }

  // === 报价模式 (codes= 参数, 原有逻辑) ===
  const codesParam = url.searchParams.get('codes') || ''
  const codes = codesParam.split(',').filter(function(c) { return /^\d{6}$/.test(c.trim()) })

  if (codes.length === 0) {
    return new Response(JSON.stringify({ error: 'missing codes or key param' }), { status: 400, headers })
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

    var results: Record<string, unknown> = {}
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
