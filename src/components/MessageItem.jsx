import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import CodeBlock from './CodeBlock'
import ToolBlock from './ToolBlock'
import { calcCost } from '../utils/pricing'

function formatTokens(n) {
  if (!n && n !== 0) return null
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toString()
}

function formatCost(c) {
  if (c == null) return null
  if (c >= 0.01) return '$' + c.toFixed(4)
  if (c >= 0.0001) return (c * 10000).toFixed(2) + '‱'
  return '<0.01‱'
}

export default function MessageItem({ message }) {
  const isTool = message.role === 'tool'
  const isUser = message.role === 'user'
  const usage = message.usage
  const model = message.model
  const cost = usage ? calcCost(usage.inputTokens, usage.outputTokens, model) : null
  const showUsage = !isUser && !isTool && usage && usage.inputTokens + usage.outputTokens > 0
  const files = message.files || []
  const toolUses = message.toolUses || []
  const toolResults = message.toolResults || []
  const toolResult = message.toolResult  // standalone tool result message

  if (isTool && toolResult) {
    return <ToolBlock block={{ type: 'tool_result', ...toolResult }} />
  }

  const modelLabel = model || 'AI'
  const avatar = isUser ? '👤' : model?.includes('gemini') ? '\u{1F310}' : model?.includes('gpt') || model?.includes('o3') || model?.includes('o4') ? '\u{1F9E0}' : '\u{1F338}'

  return (
    <div className={`message ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-avatar">{avatar}</div>
      <div className="message-body">
        <div className="message-role">{isUser ? '你' : modelLabel}</div>

        {files.length > 0 && (
          <div className="message-files">
            {files.map((f, i) => (
              <div key={i} className="msg-file-badge">
                {f.type?.startsWith('image/') ? '\u{1F5BC} ' : '\u{1F4C4} '}
                {f.name} ({formatSize(f.size)})
                {f.type?.startsWith('image/') && f.data && (
                  <img src={`data:${f.type};base64,${f.data}`} alt={f.name} className="msg-image-thumb" />
                )}
              </div>
            ))}
          </div>
        )}

        {message.content && (
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
        )}

        {toolUses.map((tu, i) => (
          <ToolBlock key={`tu-${i}`} block={{ type: 'tool_use', ...tu }} />
        ))}
        {toolResults.map((tr, i) => (
          <ToolBlock key={`tr-${i}`} block={{ type: 'tool_result', ...tr }} />
        ))}

        {showUsage && (
          <div className="message-usage">
            <span className="usage-item" title="输入 tokens">{'↗'} {formatTokens(usage.inputTokens)}</span>
            <span className="usage-sep">·</span>
            <span className="usage-item" title="输出 tokens">{'↘'} {formatTokens(usage.outputTokens)}</span>
            <span className="usage-sep">·</span>
            <span className="usage-item usage-cost" title="费用 (USD)">{formatCost(cost?.totalCost)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
