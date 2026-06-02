// Multi-provider API with multi-modal + tool-use support.

export const PROTOCOLS = ['anthropic', 'openai', 'gemini']

// ---- stream parsers (return { usage, toolUses }) ----

function parseAnthropic(lines, onChunk, onTool) {
  let usage = null
  const toolBlocks = {}  // index -> partial tool use
  for (const line of lines) {
    const t = line.trim()
    if (!t.startsWith('data: ')) continue
    const d = t.slice(6)
    if (d === '[DONE]') continue
    try {
      const j = JSON.parse(d)

      // text delta
      if (j.type === 'content_block_delta') {
        if (j.delta?.type === 'text_delta') onChunk(j.delta.text || '')
        if (j.delta?.type === 'input_json_delta' && onTool) {
          const idx = j.index
          if (!toolBlocks[idx]) toolBlocks[idx] = { id: '', name: '', input: '' }
          toolBlocks[idx].input += j.delta.partial_json || ''
        }
      }

      // tool_use block start
      if (j.type === 'content_block_start' && j.content_block?.type === 'tool_use') {
        const cb = j.content_block
        toolBlocks[j.index] = { id: cb.id, name: cb.name, input: '' }
      }

      // usage
      if (j.type === 'message_start' && j.message?.usage) {
        usage = { inputTokens: j.message.usage.input_tokens || 0, outputTokens: 0 }
      }
      if (j.type === 'message_delta' && j.usage?.output_tokens) {
        if (!usage) usage = { inputTokens: 0, outputTokens: 0 }
        usage.outputTokens = j.usage.output_tokens
      }
    } catch { /* skip */ }
  }
  // flush complete tool blocks
  if (onTool) {
    for (const tb of Object.values(toolBlocks)) {
      if (tb.id && tb.name) {
        try { tb.input = JSON.parse(tb.input) } catch { /* partial, ignore */ }
        onTool(tb)
      }
    }
  }
  return usage
}

function parseOpenAI(lines, onChunk, onTool) {
  let usage = null
  const toolCalls = {}
  for (const line of lines) {
    const t = line.trim()
    if (!t.startsWith('data: ')) continue
    const d = t.slice(6)
    if (d === '[DONE]') continue
    try {
      const j = JSON.parse(d)
      const delta = j.choices?.[0]?.delta

      if (delta?.content) onChunk(delta.content)

      // tool calls
      if (delta?.tool_calls && onTool) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index
          if (!toolCalls[idx]) toolCalls[idx] = { id: tc.id || '', name: '', input: '' }
          if (tc.id) toolCalls[idx].id = tc.id
          if (tc.function?.name) toolCalls[idx].name = tc.function.name
          if (tc.function?.arguments) toolCalls[idx].input += tc.function.arguments
        }
      }

      if (j.usage) {
        usage = { inputTokens: j.usage.prompt_tokens || 0, outputTokens: j.usage.completion_tokens || 0 }
      }
    } catch { /* skip */ }
  }
  if (onTool) {
    for (const tc of Object.values(toolCalls)) {
      if (tc.id && tc.name) {
        try { tc.input = JSON.parse(tc.input) } catch { /* keep string */ }
        onTool(tc)
      }
    }
  }
  return usage
}

function parseGemini(lines, onChunk, onTool) {
  let usage = null
  for (const line of lines) {
    const t = line.trim()
    if (!t.startsWith('data: ')) continue
    const d = t.slice(6)
    if (d === '[DONE]') continue
    try {
      const j = JSON.parse(d)
      const parts = j.candidates?.[0]?.content?.parts
      if (parts) {
        for (const p of parts) {
          if (p.text) onChunk(p.text)
          if (p.functionCall && onTool) {
            onTool({
              id: 'gemini-' + Date.now(),
              name: p.functionCall.name,
              input: p.functionCall.args || {},
            })
          }
        }
      }
      if (j.usageMetadata) {
        usage = { inputTokens: j.usageMetadata.promptTokenCount || 0, outputTokens: j.usageMetadata.candidatesTokenCount || 0 }
      }
    } catch { /* skip */ }
  }
  return usage
}

// ---- stream reader ----

async function readStream(response, parseFn, onChunk, onTool) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let usage = null
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    const u = parseFn(lines, onChunk, onTool)
    if (u) usage = u
  }
  return usage
}

// ---- content builders ----

function buildContentBlocks(message, proto) {
  const text = message.content || ''
  const files = message.files || []
  const toolUses = message.toolUses || []
  const toolResults = message.toolResults || []

  // Tool use messages (Anthropic format)
  if (toolUses.length > 0 && proto === 'anthropic') {
    const blocks = []
    if (text) blocks.push({ type: 'text', text })
    for (const tu of toolUses) {
      blocks.push({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input })
    }
    return blocks
  }

  if (toolResults.length > 0 && proto === 'anthropic') {
    return toolResults.map(tr => ({
      type: 'tool_result',
      tool_use_id: tr.id,
      content: tr.output,
    }))
  }

  if (files.length === 0) {
    if (proto === 'gemini') return [{ text }]
    return text
  }

  if (proto === 'anthropic') {
    const blocks = []
    for (const f of files) {
      if (f.type.startsWith('image/')) {
        blocks.push({
          type: 'image',
          source: { type: 'base64', media_type: f.type, data: f.data },
        })
      } else {
        blocks.push({ type: 'text', text: `[File: ${f.name}]\n${f.data}` })
      }
    }
    if (text) blocks.push({ type: 'text', text })
    return blocks
  }

  if (proto === 'openai') {
    const blocks = []
    for (const f of files) {
      if (f.type.startsWith('image/')) {
        blocks.push({
          type: 'image_url',
          image_url: { url: `data:${f.type};base64,${f.data}` },
        })
      } else {
        blocks.push({ type: 'text', text: `[File: ${f.name}]\n${f.data}` })
      }
    }
    if (text) blocks.push({ type: 'text', text })
    return blocks
  }

  // gemini
  const parts = []
  for (const f of files) {
    if (f.type.startsWith('image/')) {
      parts.push({ inlineData: { mimeType: f.type, data: f.data } })
    } else {
      parts.push({ text: `[File: ${f.name}]\n${f.data}` })
    }
  }
  if (text) parts.push({ text })
  return parts
}

function buildMessages(chatMessages, proto) {
  return chatMessages.map(m => {
    const role = m.role === 'assistant' ? (proto === 'gemini' ? 'model' : 'assistant') : 'user'
    const content = buildContentBlocks(m, proto)
    return { role, content }
  })
}

// ---- request builders ----

function buildAnthropic(messages, model, system, apiKey, base, tools) {
  const body = {
    model,
    max_tokens: 8192,
    messages,
    stream: true,
  }
  if (system) body.system = system
  if (tools?.length) {
    body.tools = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }))
  }
  return {
    url: `${base}/v1/messages`,
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    },
    parser: parseAnthropic,
  }
}

function buildOpenAI(messages, model, system, apiKey, base, tools) {
  const msgs = []
  if (system) msgs.push({ role: 'system', content: system })
  msgs.push(...messages)
  const body = { model, messages: msgs, stream: true }
  if (tools?.length) {
    body.tools = tools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }))
  }
  return {
    url: `${base}/v1/chat/completions`,
    options: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    },
    parser: parseOpenAI,
  }
}

function buildGemini(messages, model, system, apiKey, base, tools) {
  const body = { contents: messages }
  if (system) body.systemInstruction = { parts: [{ text: system }] }
  if (tools?.length) {
    body.tools = [{
      functionDeclarations: tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      })),
    }]
  }
  return {
    url: `${base || 'https://generativelanguage.googleapis.com'}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`,
    options: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    parser: parseGemini,
  }
}

// ---- main ----

export async function sendMessage(messages, settings, onChunk, onTool) {
  const { apiKey, model, baseUrl, provider } = settings
  if (!apiKey) throw new Error('请先在设置中填写 API Key')

  const proto = settings.protocol || inferProtocol(provider)

  let system = null
  const chatMessages = messages.filter(m => {
    if (m.role === 'system') { system = m.content; return false }
    return true
  })

  const formatted = buildMessages(chatMessages, proto)

  // Only include tools for Anthropic protocol (most reliable streaming tool_use)
  const tools = proto === 'anthropic' ? settings.tools : null

  let req
  switch (proto) {
    case 'anthropic':
      req = buildAnthropic(formatted, model, system, apiKey, baseUrl, tools)
      break
    case 'gemini':
      req = buildGemini(formatted, model, system, apiKey, baseUrl, tools)
      break
    default:
      req = buildOpenAI(formatted, model, system, apiKey, baseUrl, tools)
  }

  const res = await fetch(req.url, req.options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err.error?.message || err.error?.code || `HTTP ${res.status}`
    throw new Error(msg)
  }
  const usage = await readStream(res, req.parser, onChunk, onTool)
  return { usage }
}

function inferProtocol(provider) {
  if (!provider) return 'openai'
  if (provider.startsWith('anthropic')) return 'anthropic'
  if (provider.startsWith('gemini')) return 'gemini'
  return 'openai'
}
