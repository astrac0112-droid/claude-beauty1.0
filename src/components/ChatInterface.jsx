import { useState, useRef, useEffect } from 'react'
import MessageItem from './MessageItem'
import FilePreview from './FilePreview'

function readFileAsData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      resolve({ name: file.name, type: file.type, size: file.size, data: base64 })
    }
    reader.onerror = reject
    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file)
    } else {
      reader.readAsText(file)
    }
  })
}

export default function ChatInterface({ conversation, onSend, onGrantDir, dirLabel, serverOnline }) {
  const [input, setInput] = useState('')
  const [files, setFiles] = useState([])
  const messagesEnd = useRef(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation.messages])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [conversation.id])

  const handleSubmit = async (e) => {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed && files.length === 0) return
    onSend(trimmed, files)
    setInput('')
    setFiles([])
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleFileChange = async (e) => {
    const selected = Array.from(e.target.files)
    const read = await Promise.all(selected.map(readFileAsData))
    setFiles(prev => [...prev, ...read])
    e.target.value = ''
  }

  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i))

  const isStreaming = conversation.messages.some(m => m.streaming)

  return (
    <div className="chat-container">
      <div className="message-list">
        {conversation.messages.length === 0 ? (
          <div className="chat-empty">
            <p>发送消息开始对话，或上传文件让 AI 读取</p>
          </div>
        ) : (
          conversation.messages.map((msg, i) => (
            <MessageItem key={i} message={msg} />
          ))
        )}
        <div ref={messagesEnd} />
      </div>

      <FilePreview files={files} onRemove={removeFile} />

      {serverOnline && <div className="server-indicator">{'🟢'} 本地服务已连接 — AI 可直接读写文件、执行命令</div>}
      {dirLabel && <div className="dir-indicator">{'📂'} 已授权文件夹: {dirLabel}</div>}

      <form className="chat-input-area" onSubmit={handleSubmit}>
        <input
          type="file"
          ref={fileInputRef}
          className="file-input-hidden"
          onChange={handleFileChange}
          multiple
          accept="image/*,.txt,.md,.js,.jsx,.ts,.tsx,.py,.json,.csv,.html,.css,.xml,.yaml,.yml,.log,.pdf"
        />
        <button
          type="button"
          className="btn-attach"
          onClick={() => fileInputRef.current?.click()}
          title="上传文件"
          disabled={isStreaming}
        >📎</button>
        {onGrantDir && (
          <button
            type="button"
            className="btn-attach"
            onClick={onGrantDir}
            title="授权本地文件夹（AI 可读取）"
          >📁</button>
        )}
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
          rows={1}
          disabled={isStreaming}
        />
        <button
          type="submit"
          className="btn-send"
          disabled={isStreaming || (!input.trim() && files.length === 0)}
        >
          {isStreaming ? '…' : '发送'}
        </button>
      </form>
    </div>
  )
}
