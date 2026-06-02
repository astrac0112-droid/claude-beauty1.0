export default function ToolBlock({ block }) {
  const isResult = block.type === 'tool_result'

  return (
    <div className={`tool-block ${isResult ? 'tool-result' : 'tool-use'}`}>
      <div className="tool-block-header">
        {isResult ? '🔧 工具返回' : '⚙ 调用工具'}
        <span className="tool-name">{block.name || block.tool_name}</span>
      </div>
      <div className="tool-block-body">
        {isResult ? (
          <pre className="tool-content">{truncate(block.content || block.result || '', 2000)}</pre>
        ) : (
          <pre className="tool-content">{truncate(JSON.stringify(block.input, null, 2), 1000)}</pre>
        )}
      </div>
    </div>
  )
}

function truncate(s, max) {
  const str = String(s)
  if (str.length <= max) return str
  return str.slice(0, max) + '\n... (truncated)'
}
