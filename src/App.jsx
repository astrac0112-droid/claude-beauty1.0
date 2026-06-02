import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ChatInterface from './components/ChatInterface'
import Settings from './components/Settings'
import { sendMessage } from './utils/api'

const STORAGE_KEY = 'claude-beauty-conversations'
const SETTINGS_KEY = 'claude-beauty-settings'

function App() {
  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem(SETTINGS_KEY)
    if (saved) {
      const s = JSON.parse(saved)
      // Migrate old short provider ids to new full ids
      if (s.provider === 'anthropic') s.provider = 'anthropic-claude'
      if (s.provider === 'deepseek') s.provider = 'openai-deepseek'
      if (s.provider === 'openai') s.provider = 'openai-custom'
      return s
    }
    return { provider: 'anthropic-claude', protocol: 'anthropic', apiKey: '', model: 'claude-sonnet-4-6', baseUrl: '' }
  })

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
      if (id === activeConvId) {
        setActiveConvId(next.length > 0 ? next[0].id : null)
      }
      if (next.length === 0) {
        localStorage.removeItem(STORAGE_KEY)
      }
      return next
    })
  }, [activeConvId])

  const updateConversation = useCallback((id, updates) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
  }, [])

  const handleSend = useCallback(async (content) => {
    if (!activeConvId) {
      createConversation()
      return
    }

    const userMsg = { role: 'user', content, timestamp: Date.now() }

    setConversations(prev => prev.map(c => {
      if (c.id !== activeConvId) return c
      const updated = {
        ...c,
        messages: [...c.messages, userMsg],
      }
      if (c.messages.length === 0) {
        updated.title = content.slice(0, 30) + (content.length > 30 ? '...' : '')
      }
      return updated
    }))

    const assistantMsg = { role: 'assistant', content: '', timestamp: Date.now(), streaming: true }

    setConversations(prev => prev.map(c => {
      if (c.id !== activeConvId) return c
      return { ...c, messages: [...c.messages, assistantMsg] }
    }))

    try {
      const conv = conversations.find(c => c.id === activeConvId)
      const messages = [...(conv?.messages || []), userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }))

      let fullContent = ''
      await sendMessage(messages, settings, (chunk) => {
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
      })

      setConversations(prev => prev.map(c => {
        if (c.id !== activeConvId) return c
        const msgs = [...c.messages]
        const last = msgs[msgs.length - 1]
        if (last.role === 'assistant') {
          msgs[msgs.length - 1] = { ...last, streaming: false, content: fullContent }
        }
        return { ...c, messages: msgs }
      }))
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
          />
        ) : (
          <div className="empty-state">
            <div className="empty-content">
              <h1>Claude Beauty</h1>
              <p>点击左侧「新对话」开始聊天</p>
              <button className="btn-primary" onClick={createConversation}>开始新对话</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
