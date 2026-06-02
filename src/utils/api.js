// Provider 用 id 引用，定义见 components/Settings.jsx 的 PROVIDERS

export const PROTOCOLS = ['anthropic', 'openai', 'gemini']

// ---- stream parsers (return accumulated usage) ----

function parseAnthropic(lines, onChunk) {
  let usage = null
  for (const line of lines) {
    const t = line.trim()
    if (!t.startsWith('data: ')) continue
    const d = t.slice(6)
    if (d === '[DONE]') continue
    try {
      const j = JSON.parse(d)
      if (j.type === 'content_block_delta') onChunk(j.delta?.text || '')
      if (j.type === 'message_start' && j.message?.usage) {
        usage = { inputTokens: j.message.usage.input_tokens || 0, outputTokens: 0 }
      }
      if (j.type === 'message_delta' && j.usage?.output_tokens) {
        if (!usage) usage = { inputTokens: 0, outputTokens: 0 }
        usage.outputTokens = j.usage.output_tokens
      }
    } catch { /* skip */ }
  }
  return usage
}

function parseOpenAI(lines, onChunk) {
  let usage = null
  for (const line of lines) {
    const t = line.trim()
    if (!t.startsWith('data: ')) continue
    const d = t.slice(6)
    if (d === '[DONE]') continue
    try {
      const j = JSON.parse(d)
      const c = j.choices?.[0]?.delta?.content
      if (c) onChunk(c)
      if (j.usage) {
        usage = {
          inputTokens: j.usage.prompt_tokens || 0,
          outputTokens: j.usage.completion_tokens || 0,
        }
      }
    } catch { /* skip */ }
  }
  return usage
}

function parseGemini(lines, onChunk) {
  let usage = null
  for (const line of lines) {
    const t = line.trim()
    if (!t.startsWith('data: ')) continue
    const d = t.slice(6)
    if (d === '[DONE]') continue
    try {
      const j = JSON.parse(d)
      const text = j.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) onChunk(text)
      if (j.usageMetadata) {
        usage = {
          inputTokens: j.usageMetadata.promptTokenCount || 0,
          outputTokens: j.usageMetadata.candidatesTokenCount || 0,
        }
      }
    } catch { /* skip */ }
  }
  return usage
}

// ---- stream reader helper ----

async function readStream(response, parseFn, onChunk) {
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
    const u = parseFn(lines, onChunk)
    if (u) usage = u
  }
  return usage
}

// ---- builders ----

function buildAnthropic(messages, model, system, apiKey, base) {
  const body = { model, max_tokens: 4096, messages, stream: true }
  if (system) body.system = system
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

function buildOpenAI(messages, model, system, apiKey, base) {
  const msgs = []
  if (system) msgs.push({ role: 'system', content: system })
  msgs.push(...messages)
  return {
    url: `${base}/v1/chat/completions`,
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages: msgs, stream: true }),
    },
    parser: parseOpenAI,
  }
}

function buildGemini(messages, model, system, apiKey, base) {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const body = { contents }
  if (system) body.systemInstruction = { parts: [{ text: system }] }

  // Gemini accepts API key as query param. Use base v1beta path.
  const basePath = base || 'https://generativelanguage.googleapis.com'
  const url = `${basePath}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`
  return {
    url,
    options: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    parser: parseGemini,
  }
}

// ---- main ----

export async function sendMessage(messages, settings, onChunk) {
  const { apiKey, model, baseUrl, provider } = settings
  if (!apiKey) throw new Error('请先在设置中填写 API Key')

  const proto = settings.protocol || inferProtocol(provider)

  let system = null
  const chatMessages = messages.filter(m => {
    if (m.role === 'system') { system = m.content; return false }
    return true
  })

  let req
  switch (proto) {
    case 'anthropic':
      req = buildAnthropic(chatMessages, model, system, apiKey, baseUrl)
      break
    case 'gemini':
      req = buildGemini(chatMessages, model, system, apiKey, baseUrl)
      break
    default:
      req = buildOpenAI(chatMessages, model, system, apiKey, baseUrl)
  }

  const res = await fetch(req.url, req.options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err.error?.message || err.error?.code || `HTTP ${res.status}`
    throw new Error(msg)
  }
  const usage = await readStream(res, req.parser, onChunk)
  return { usage }
}

function inferProtocol(provider) {
  if (!provider) return 'openai'
  // Map provider id prefixes to protocol
  if (provider.startsWith('anthropic')) return 'anthropic'
  if (provider.startsWith('gemini')) return 'gemini'
  return 'openai'
}
