import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import CodeBlock from './CodeBlock'
import { calcCost } from '../utils/pricing'

function formatTokens(n) {
  if (!n && n !== 0) return null
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toString()
}

function formatCost(c) {
  if (c == null) return null
  if (c >= 0.01) return '$' + c.toFixed(4)
  if (c >= 0.0001) return (c * 10000).toFixed(2) + '‱'  // permyriad
  return '<0.01‱'
}

export default function MessageItem({ message }) {
  const isUser = message.role === 'user'
  const usage = message.usage
  const model = message.model
  const cost = usage ? calcCost(usage.inputTokens, usage.outputTokens, model) : null
  const showUsage = !isUser && usage && usage.inputTokens + usage.outputTokens > 0

  const modelLabel = model || 'AI'
  const avatar = isUser ? '👤' : model?.includes('gemini') ? '🌐' : model?.includes('gpt') || model?.includes('o3') || model?.includes('o4') ? '🧠' : '🌸'

  return (
    <div className={`message ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-avatar">
        {avatar}
      </div>
      <div className="message-body">
        <div className="message-role">{isUser ? '你' : modelLabel}</div>
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
        {showUsage && (
          <div className="message-usage">
            <span className="usage-item" title="输入 tokens">↗ {formatTokens(usage.inputTokens)}</span>
            <span className="usage-sep">·</span>
            <span className="usage-item" title="输出 tokens">↘ {formatTokens(usage.outputTokens)}</span>
            <span className="usage-sep">·</span>
            <span className="usage-item usage-cost" title="费用 (USD)">{formatCost(cost?.totalCost)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
