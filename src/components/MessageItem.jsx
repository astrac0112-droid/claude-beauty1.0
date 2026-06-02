import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import CodeBlock from './CodeBlock'

export default function MessageItem({ message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`message ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-avatar">
        {isUser ? '👤' : '🌸'}
      </div>
      <div className="message-body">
        <div className="message-role">{isUser ? '你' : 'Claude'}</div>
        <div className="message-content">
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  if (!inline && match) {
                    return <CodeBlock language={match[1]} code={String(children)} />
                  }
                  return <code className={className} {...props}>{children}</code>
                },
              }}
            >
              {message.content || (message.streaming ? '思考中...' : '')}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  )
}
