import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ChatInterface from './components/ChatInterface'
import Settings from './components/Settings'
import { sendMessage } from './utils/api'
import { TOOLS, executeTool, setDirectoryHandle, checkServer, isServerAvailable } from './utils/tools'

const STORAGE_KEY = 'claude-beauty-conversations'
const SETTINGS_KEY = 'claude-beauty-settings'

function App() {
  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [dirLabel, setDirLabel] = useState(null)
  const [serverOnline, setServerOnline] = useState(false)

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem(SETTINGS_KEY)
    if (saved) {
      const s = JSON.parse(saved)
      if (s.provider === 'anthropic') s.provider = 'anthropic-claude'
      if (s.provider === 'deepseek') s.provider = 'openai-deepseek'
      if (s.provider === 'openai') s.provider = 'openai-custom'
      return s
    }
    return { provider: 'anthropic-claude', protocol: 'anthropic', apiKey: '', model: 'claude-sonnet-4-6', baseUrl: '', toolsEnabled: true }
  })

  // Check local server on mount
  useEffect(() => {
    checkServer().then(setServerOnline)
    const interval = setInterval(() => { checkServer().then(setServerOnline) }, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.length > 0) {
          setConversations(parsed)
          setActiveConvId(parsed[0].id)
        }
      } catch { /* corrupted data */ }
    }
  }, [])

  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
    }
  }, [conversations])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  const activeConv = conversations.find(c => c.id === activeConvId) || null

  const createConversation = useCallback(() => {
    const newConv = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [],
      createdAt: new Date().toISOString(),
    }
    setConversations(prev => [newConv, ...prev])
    setActiveConvId(newConv.id)
  }, [])

  const deleteConversation = useCallback((id) => {
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id)
      if (id === activeConvId) setActiveConvId(next.length > 0 ? next[0].id : null)
      if (next.length === 0) localStorage.removeItem(STORAGE_KEY)
      return next
    })
  }, [activeConvId])

  const handleGrantDir = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker()
      setDirectoryHandle(handle)
      setDirLabel(handle.name)
    } catch (e) {
      if (e.name !== 'AbortError') alert('目录授权失败: ' + e.message)
    }
  }, [])

  const handleSend = useCallback(async (content, files) => {
    if (!activeConvId) {
      createConversation()
      return
    }

    const userMsg = { role: 'user', content, timestamp: Date.now(), files: files?.length ? files : undefined }

    setConversations(prev => prev.map(c => {
      if (c.id !== activeConvId) return c
      const updated = { ...c, messages: [...c.messages, userMsg] }
      if (c.messages.length === 0) {
        updated.title = content.slice(0, 30) + (content.length > 30 ? '...' : '') || (files?.[0]?.name || '新对话')
      }
      return updated
    }))

    const toolsEnabled = settings.toolsEnabled !== false
    const isAnthropic = settings.protocol === 'anthropic'
    const allSettings = toolsEnabled ? { ...settings, tools: TOOLS } : settings

    // Agent system prompt — tells AI it has tools and should use them proactively
    const agentPrompt = toolsEnabled ? `You are an AI agent running on the user's local machine. You have access to tools that let you read/write files, list directories, and execute shell commands. Use these tools PROACTIVELY and AUTONOMOUSLY to complete the user's request.

Rules:
- Plan your approach, then execute tools step by step.
- Observe results and adapt. If one approach fails, try another.
- Do NOT ask the user to do things you can do yourself.
- When you have completed the task, summarize what you did.
- Be thorough. The user wants you to actually DO things, not just explain how.
- All file paths are real paths on the user's machine.` : null

    // Build conversation messages: inject agent prompt as system message if using tools
    const conv = conversations.find(c => c.id === activeConvId)
    let loopMessages = [...(conv?.messages || []), userMsg]
    if (agentPrompt) {
      loopMessages = [{ role: 'system', content: agentPrompt }, ...loopMessages]
    }

    // Max agent iterations to prevent infinite loops
    const MAX_ITER = 10
    let iteration = 0

    while (iteration < MAX_ITER) {
      iteration++
      const assistantMsg = { role: 'assistant', content: '', timestamp: Date.now(), streaming: true, model: settings.model, toolUses: [], iteration }

      setConversations(prev => prev.map(c => {
        if (c.id !== activeConvId) return c
        return { ...c, messages: [...c.messages, assistantMsg] }
      }))

      try {
        const apiMessages = loopMessages.map(m => ({
          role: m.role,
          content: m.content,
          files: m.files,
          toolUses: m.toolUses,
          toolResults: m.toolResults,
        }))

        let fullContent = ''
        const toolUses = []

        const result = await sendMessage(apiMessages, allSettings,
          (chunk) => {
            fullContent += chunk
            setConversations(prev => prev.map(c => {
              if (c.id !== activeConvId) return c
              const msgs = [...c.messages]
              const last = msgs[msgs.length - 1]
              if (last.role === 'assistant') {
                msgs[msgs.length - 1] = { ...last, content: fullContent }
              }
              return { ...c, messages: msgs }
            }))
          },
          (tool) => {
            toolUses.push(tool)
          }
        )

        if (toolUses.length === 0) {
          setConversations(prev => prev.map(c => {
            if (c.id !== activeConvId) return c
            const msgs = [...c.messages]
            const last = msgs[msgs.length - 1]
            if (last.role === 'assistant') {
              msgs[msgs.length - 1] = { ...last, streaming: false, content: fullContent || last.content, usage: result?.usage || null }
            }
            return { ...c, messages: msgs }
          }))
          break
        }

        const toolResults = []
        for (const tool of toolUses) {
          const output = await executeTool(tool.name, tool.input)
          toolResults.push({ id: tool.id, name: tool.name, input: tool.input, output })
        }

        const finalContent = fullContent || '(调用工具中...)'
        const isAnthropic = settings.protocol === 'anthropic'
        setConversations(prev => prev.map(c => {
          if (c.id !== activeConvId) return c
          const msgs = [...c.messages]
          const last = msgs[msgs.length - 1]
          if (last.role === 'assistant') {
            msgs[msgs.length - 1] = { ...last, streaming: false, content: finalContent, usage: result?.usage || null, toolUses }
            if (isAnthropic) {
              for (const tr of toolResults) {
                msgs.push({ role: 'tool', toolResult: tr, timestamp: Date.now(), model: settings.model })
              }
            } else {
              const resultText = toolResults.map(tr =>
                `[工具执行结果: ${tr.name}]\n${tr.output}`
              ).join('\n\n')
              if (resultText) msgs.push({ role: 'user', content: resultText, timestamp: Date.now() })
            }
          }
          return { ...c, messages: msgs }
        }))

        // For Anthropic: use native tool_use/tool_result blocks
        // For other protocols: send tool results as plain text (avoids tool_calls pairing issues)
        if (settings.protocol === 'anthropic') {
          loopMessages = [
            ...loopMessages,
            { role: 'assistant', content: finalContent, toolUses },
            { role: 'user', content: '', toolResults },
          ]
        } else {
          const resultText = toolResults.map(tr =>
            `[工具执行结果: ${tr.name}]\n${tr.output}`
          ).join('\n\n')
          loopMessages = [
            ...loopMessages,
            { role: 'assistant', content: finalContent, toolUses },
            { role: 'user', content: resultText },
          ]
        }

      } catch (err) {
        setConversations(prev => prev.map(c => {
          if (c.id !== activeConvId) return c
          const msgs = [...c.messages]
          const last = msgs[msgs.length - 1]
          if (last.role === 'assistant') {
            msgs[msgs.length - 1] = { ...last, streaming: false, content: `**错误:** ${err.message}` }
          }
          return { ...c, messages: msgs }
        }))
        break
      }
    }
  }, [activeConvId, conversations, settings, createConversation])

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeConvId={activeConvId}
        onSelect={setActiveConvId}
        onDelete={deleteConversation}
        onCreate={createConversation}
        onOpenSettings={() => setShowSettings(true)}
      />
      <main className="main">
        {showSettings ? (
          <Settings settings={settings} onSave={setSettings} onClose={() => setShowSettings(false)} />
        ) : activeConv ? (
          <ChatInterface
            conversation={activeConv}
            onSend={handleSend}
            onGrantDir={handleGrantDir}
            dirLabel={dirLabel}
            serverOnline={serverOnline}
          />
        ) : (
          <div className="empty-state">
            <div className="empty-content">
              <h1>Claude Beauty</h1>
              <p>上传文件或启动本地服务，让 AI 直接操作你的桌面</p>
              <button className="btn-primary" onClick={createConversation}>开始新对话</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
