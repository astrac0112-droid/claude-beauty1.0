import { useState, useRef, useEffect } from 'react'
import MessageItem from './MessageItem'

export default function ChatInterface({ conversation, onSend }) {
  const [input, setInput] = useState('')
  const messagesEnd = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation.messages])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [conversation.id])

  const handleSubmit = (e) => {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    onSend(trimmed)
    setInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const isStreaming = conversation.messages.some(m => m.streaming)

  return (
    <div className="chat-container">
      <div className="message-list">
        {conversation.messages.length === 0 ? (
          <div className="chat-empty">
            <p>发送一条消息开始对话</p>
          </div>
        ) : (
          conversation.messages.map((msg, i) => (
            <MessageItem key={i} message={msg} />
          ))
        )}
        <div ref={messagesEnd} />
      </div>
      <form className="chat-input-area" onSubmit={handleSubmit}>
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
          disabled={isStreaming || !input.trim()}
        >
          {isStreaming ? '…' : '发送'}
        </button>
      </form>
    </div>
  )
}
