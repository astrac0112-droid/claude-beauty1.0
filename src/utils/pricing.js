// Pricing per million tokens (USD). Update as providers change pricing.
// { input: per 1M input tokens, output: per 1M output tokens }
const PRICING = {
  // ── Anthropic ──
  'claude-opus-4-7':         { input: 15, output: 75 },
  'claude-opus-4-5':         { input: 15, output: 75 },
  'claude-sonnet-4-6':       { input: 3,  output: 15 },
  'claude-sonnet-4-5':       { input: 3,  output: 15 },
  'claude-haiku-4-5':        { input: 0.80, output: 4 },

  // ── OpenAI ──
  'gpt-4o':                  { input: 2.50, output: 10 },
  'gpt-4o-mini':             { input: 0.15, output: 0.60 },
  'gpt-4-turbo':             { input: 10,   output: 30 },
  'o4-mini':                 { input: 1.10, output: 4.40 },
  'o3-mini':                 { input: 1.10, output: 4.40 },

  // ── DeepSeek ──
  'deepseek-chat':           { input: 0.27, output: 1.10 },
  'deepseek-reasoner':       { input: 0.55, output: 2.19 },
  'deepseek-r1-250528':      { input: 0.55, output: 2.19 },
  'deepseek-v3-250324':      { input: 0.27, output: 1.10 },

  // ── Mistral ──
  'mistral-large-latest':    { input: 2,    output: 6 },
  'mistral-medium-latest':   { input: 0.80, output: 2.40 },
  'mistral-small-latest':    { input: 0.20, output: 0.60 },
  'codestral-latest':        { input: 0.20, output: 0.60 },
  'ministral-8b-latest':     { input: 0.10, output: 0.10 },

  // ── Groq ──
  'llama-4-scout-17b-16e-instruct':    { input: 0.15, output: 0.50 },
  'llama-4-maverick-17b-128e-instruct': { input: 0.40, output: 1.30 },
  'deepseek-r1-distill-llama-70b':     { input: 0.75, output: 0.99 },
  'qwen-2.5-32b':                      { input: 0.35, output: 0.40 },

  // ── Together AI ──
  'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8': { input: 0.40, output: 1.30 },
  'meta-llama/Llama-4-Scout-17B-16E-Instruct':         { input: 0.15, output: 0.50 },
  'deepseek-ai/DeepSeek-R1':                           { input: 0.55, output: 2.19 },
  'Qwen/Qwen3-235B-A22B':                              { input: 0.50, output: 1 },

  // ── xAI ──
  'grok-4':           { input: 0.80, output: 3.20 },
  'grok-3':           { input: 0.50, output: 2 },
  'grok-3-mini':      { input: 0.15, output: 0.60 },

  // ── Perplexity ──
  'sonar-pro':                { input: 1, output: 5 },
  'sonar-deep-research':      { input: 2, output: 10 },
  'sonar-reasoning-pro':      { input: 2, output: 10 },

  // ── Cohere ──
  'command-r-plus':   { input: 2.50, output: 10 },
  'command-r':        { input: 0.50, output: 1.50 },
  'command-a-v-01':   { input: 0.50, output: 1.50 },

  // ── Google Gemini ──
  'gemini-2.5-pro':     { input: 1.25, output: 10 },
  'gemini-2.5-flash':   { input: 0.15, output: 0.60 },
  'gemini-2.0-flash':   { input: 0.10, output: 0.40 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },

  // ── Kimi (Moonshot) ──
  'moonshot-v1-auto':   { input: 0.85, output: 0.85 },
  'moonshot-v1-8k':     { input: 0.85, output: 0.85 },
  'moonshot-v1-32k':    { input: 0.85, output: 0.85 },
  'moonshot-v1-128k':   { input: 0.85, output: 0.85 },
  'kimi-latest':        { input: 0.85, output: 0.85 },

  // ── Zhipu (GLM) ──
  'glm-4.6':    { input: 0.14, output: 0.14 },
  'glm-4.5':    { input: 0.14, output: 0.14 },
  'glm-4-plus': { input: 0.70, output: 0.70 },
  'glm-4-air':  { input: 0.07, output: 0.07 },
  'glm-4-flash':{ input: 0,    output: 0 },
  'glm-4-long': { input: 0.14, output: 0.14 },

  // ── Qwen (通义千问) ──
  'qwen-max':            { input: 0.40, output: 1.20 },
  'qwen-plus':           { input: 0.10, output: 0.30 },
  'qwen-turbo':          { input: 0.04, output: 0.12 },
  'qwen3-235b-a22b':     { input: 0.50, output: 1.50 },
  'qwq-plus':            { input: 0.40, output: 1.20 },

  // ── Doubao (豆包) ──
  'doubao-1.5-pro-256k':       { input: 0.10, output: 0.30 },
  'doubao-1.5-lite-32k':       { input: 0.02, output: 0.06 },
  'doubao-1.5-thinking-pro':   { input: 0.50, output: 1.50 },

  // ── Baichuan ──
  'Baichuan4-Air':   { input: 0.10, output: 0.10 },
  'Baichuan4':        { input: 0.10, output: 0.10 },
  'Baichuan4-Turbo':  { input: 0.10, output: 0.10 },

  // ── MiniMax ──
  'abab6.5s-chat':  { input: 0.10, output: 0.10 },
  'abab7':          { input: 0.10, output: 0.10 },
  'MiniMax-M1':     { input: 0.50, output: 0.50 },

  // ── StepFun ──
  'step-2-16k':   { input: 0.10, output: 0.10 },
  'step-2-mini':  { input: 0.05, output: 0.05 },
  'step-1-flash': { input: 0.01, output: 0.01 },
  'step-1-8k':    { input: 0.01, output: 0.01 },
}

// Fallback for unknown models
const DEFAULT = { input: 0, output: 0 }

export function getPricing(model) {
  if (!model) return DEFAULT
  // Exact match
  if (PRICING[model]) return PRICING[model]
  // Fuzzy match: check if model contains a known key
  for (const key of Object.keys(PRICING)) {
    if (model.includes(key) || key.includes(model)) return PRICING[key]
  }
  return DEFAULT
}

export function calcCost(inputTokens, outputTokens, model) {
  const p = getPricing(model)
  const inputCost = (inputTokens / 1_000_000) * p.input
  const outputCost = (outputTokens / 1_000_000) * p.output
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    pricing: p,
  }
}
