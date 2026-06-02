import { useState } from 'react'

// Protocol: anthropic | openai | gemini
// For openai protocol, most providers auto-detect baseUrl from provider id.
// baseUrl can still be overridden by user.

const PROVIDERS = [
  // ── Anthropic ──
  { id: 'anthropic-claude',  label: 'Anthropic (Claude)',       protocol: 'anthropic', base: 'https://api.anthropic.com', models: ['claude-sonnet-4-6','claude-opus-4-7','claude-haiku-4-5','claude-sonnet-4-5','claude-opus-4-5'], defaultModel: 'claude-sonnet-4-6', keyHint: 'sk-ant-api03-...' },

  // ── OpenAI & 海外 ──
  { id: 'openai-official',   label: 'OpenAI',                   protocol: 'openai',    base: 'https://api.openai.com',         models: ['gpt-4o','gpt-4o-mini','gpt-4-turbo','o4-mini','o3-mini'], defaultModel: 'gpt-4o', keyHint: 'sk-...' },
  { id: 'openai-deepseek',   label: 'DeepSeek',                 protocol: 'openai',    base: 'https://api.deepseek.com',       models: ['deepseek-chat','deepseek-reasoner'], defaultModel: 'deepseek-chat', keyHint: 'sk-...' },
  { id: 'openai-mistral',    label: 'Mistral AI',               protocol: 'openai',    base: 'https://api.mistral.ai',          models: ['mistral-large-latest','mistral-medium-latest','mistral-small-latest','codestral-latest','ministral-8b-latest'], defaultModel: 'mistral-large-latest', keyHint: '...' },
  { id: 'openai-groq',       label: 'Groq',                     protocol: 'openai',    base: 'https://api.groq.com/openai',     models: ['llama-4-scout-17b-16e-instruct','llama-4-maverick-17b-128e-instruct','deepseek-r1-distill-llama-70b','qwen-2.5-32b'], defaultModel: 'llama-4-scout-17b-16e-instruct', keyHint: 'gsk_...' },
  { id: 'openai-together',   label: 'Together AI',              protocol: 'openai',    base: 'https://api.together.xyz',        models: ['meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8','meta-llama/Llama-4-Scout-17B-16E-Instruct','deepseek-ai/DeepSeek-R1','Qwen/Qwen3-235B-A22B'], defaultModel: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8', keyHint: '...' },
  { id: 'openai-xai',        label: 'xAI (Grok)',               protocol: 'openai',    base: 'https://api.x.ai',                models: ['grok-4','grok-3','grok-3-mini'], defaultModel: 'grok-4', keyHint: 'xai-...' },
  { id: 'openai-perplexity', label: 'Perplexity',               protocol: 'openai',    base: 'https://api.perplexity.ai',       models: ['sonar-pro','sonar-deep-research','sonar-reasoning-pro'], defaultModel: 'sonar-pro', keyHint: 'pplx-...' },
  { id: 'openai-cohere',     label: 'Cohere',                   protocol: 'openai',    base: 'https://api.cohere.ai',           models: ['command-r-plus','command-r','command-a-v-01'], defaultModel: 'command-r-plus', keyHint: '...' },

  // ── 国内厂商 (OpenAI 兼容) ──
  { id: 'openai-moonshot',   label: '月之暗面 (Kimi)',           protocol: 'openai',    base: 'https://api.moonshot.cn',         models: ['moonshot-v1-auto','moonshot-v1-8k','moonshot-v1-32k','moonshot-v1-128k','kimi-latest'], defaultModel: 'moonshot-v1-auto', keyHint: 'sk-...' },
  { id: 'openai-zhipu',      label: '智谱 AI (GLM)',             protocol: 'openai',    base: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4.6','glm-4.5','glm-4-plus','glm-4-air','glm-4-flash','glm-4-long'], defaultModel: 'glm-4.6', keyHint: '...' },
  { id: 'openai-qwen',       label: '通义千问 (Qwen/阿里云)',     protocol: 'openai',    base: 'https://dashscope.aliyuncs.com/compatible-mode', models: ['qwen-max','qwen-plus','qwen-turbo','qwen3-235b-a22b','qwq-plus'], defaultModel: 'qwen-max', keyHint: 'sk-...' },
  { id: 'openai-doubao',     label: '豆包 (字节/火山引擎)',      protocol: 'openai',    base: 'https://ark.cn-beijing.volces.com/api/v3', models: ['doubao-1.5-pro-256k','doubao-1.5-lite-32k','doubao-1.5-thinking-pro','deepseek-r1-250528','deepseek-v3-250324'], defaultModel: 'doubao-1.5-pro-256k', keyHint: '需要创建推理接入点' },
  { id: 'openai-baichuan',   label: '百川智能 (Baichuan)',       protocol: 'openai',    base: 'https://api.baichuan-ai.com',     models: ['Baichuan4-Air','Baichuan4','Baichuan4-Turbo'], defaultModel: 'Baichuan4-Air', keyHint: 'sk-...' },
  { id: 'openai-minimax',    label: 'MiniMax (海螺)',            protocol: 'openai',    base: 'https://api.minimax.chat',        models: ['abab6.5s-chat','abab7','MiniMax-M1'], defaultModel: 'abab6.5s-chat', keyHint: '...' },
  { id: 'openai-stepfun',    label: '阶跃星辰 (StepFun)',        protocol: 'openai',    base: 'https://api.stepfun.com',         models: ['step-2-16k','step-2-mini','step-1-flash','step-1-8k'], defaultModel: 'step-2-16k', keyHint: 'sk-...' },
  { id: 'openai-deepseek-cn',label: '深度求索 (国内)',            protocol: 'openai',    base: 'https://api.deepseek.com',       models: ['deepseek-chat','deepseek-reasoner'], defaultModel: 'deepseek-chat', keyHint: 'sk-...' },

  // ── 本地 / 开源 ──
  { id: 'openai-ollama',     label: 'Ollama (本地)',             protocol: 'openai',    base: 'http://localhost:11434',          models: [], defaultModel: '', keyHint: 'ollama (可不填)', local: true },
  { id: 'openai-vllm',       label: 'vLLM / SGLang / 自部署',   protocol: 'openai',    base: '',                                 models: [], defaultModel: '', keyHint: '可选', local: true },
  { id: 'openai-openrouter', label: 'OpenRouter',                protocol: 'openai',    base: 'https://openrouter.ai/api',       models: [], defaultModel: '', keyHint: 'sk-or-...' },

  // ── Google ──
  { id: 'gemini-official',   label: 'Google Gemini',             protocol: 'gemini',    base: 'https://generativelanguage.googleapis.com', models: ['gemini-2.5-pro','gemini-2.5-flash','gemini-2.0-flash','gemini-2.0-flash-lite'], defaultModel: 'gemini-2.5-flash', keyHint: 'AIza...' },

  // ── 自定义 ──
  { id: 'openai-custom',     label: '自定义 OpenAI 兼容',        protocol: 'openai',    base: '',                                 models: [], defaultModel: '', keyHint: 'sk-...', local: true },
]

export default function Settings({ settings, onSave, onClose }) {
  const [local, setLocal] = useState(() => ({
    provider: settings.provider || 'anthropic-claude',
    protocol: settings.protocol || 'anthropic',
    apiKey: settings.apiKey || '',
    model: settings.model || 'claude-sonnet-4-6',
    baseUrl: settings.baseUrl || '',
    toolsEnabled: settings.toolsEnabled !== false,
  }))

  const current = PROVIDERS.find(p => p.id === local.provider) || PROVIDERS[0]
  const needsCustomModel = current.models.length === 0
  const needsCustomBase = current.local

  const handleProviderChange = (id) => {
    const p = PROVIDERS.find(x => x.id === id)
    const next = {
      ...local,
      provider: id,
      protocol: p.protocol,
      model: p.defaultModel || '',
      baseUrl: p.base || '',
    }
    setLocal(next)
  }

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>设置</h2>
        <button className="btn-icon" onClick={onClose}>✕</button>
      </div>
      <div className="settings-body">
        <label>
          服务商
          <select value={local.provider} onChange={(e) => handleProviderChange(e.target.value)}>
            <optgroup label="Anthropic">
              {PROVIDERS.filter(p => p.protocol === 'anthropic').map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
            <optgroup label="海外 (OpenAI 兼容)">
              {PROVIDERS.filter(p => p.protocol === 'openai' && ['openai-official','openai-deepseek','openai-mistral','openai-groq','openai-together','openai-xai','openai-perplexity','openai-cohere'].includes(p.id)).map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
            <optgroup label="国内 (OpenAI 兼容)">
              {PROVIDERS.filter(p => p.protocol === 'openai' && ['openai-moonshot','openai-zhipu','openai-qwen','openai-doubao','openai-baichuan','openai-minimax','openai-stepfun','openai-deepseek-cn'].includes(p.id)).map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
            <optgroup label="本地 / 开源">
              {PROVIDERS.filter(p => ['openai-ollama','openai-vllm','openai-openrouter'].includes(p.id)).map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
            <optgroup label="Google">
              {PROVIDERS.filter(p => p.protocol === 'gemini').map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
            <optgroup label="其他">
              {PROVIDERS.filter(p => p.id === 'openai-custom').map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
          </select>
        </label>

        <label>
          API Key
          <input
            type="password"
            value={local.apiKey}
            onChange={(e) => setLocal({ ...local, apiKey: e.target.value })}
            placeholder={current.keyHint}
          />
        </label>

        <label>
          模型
          {needsCustomModel ? (
            <input
              type="text"
              value={local.model}
              onChange={(e) => setLocal({ ...local, model: e.target.value })}
              placeholder="输入模型名称，如 gpt-4o"
            />
          ) : (
            <select value={local.model} onChange={(e) => setLocal({ ...local, model: e.target.value })}>
              {current.models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
        </label>

        <label>
          API 地址
          <input
            type="text"
            value={local.baseUrl}
            onChange={(e) => setLocal({ ...local, baseUrl: e.target.value })}
            placeholder={current.base || '输入自定义 API 地址'}
          />
          <span className="hint">{needsCustomBase ? '手动填写你的 API 地址' : '可修改，留空使用默认地址'}</span>
        </label>

        {local.protocol === 'anthropic' && (
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={local.toolsEnabled}
              onChange={(e) => setLocal({ ...local, toolsEnabled: e.target.checked })}
            />
            <span>启用本地工具调用（需要授权文件夹访问）</span>
          </label>
        )}

        <button className="btn-primary" onClick={() => { onSave(local); onClose() }}>保存设置</button>
      </div>
    </div>
  )
}
