import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

export default function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false)
  const codeStr = String(code).replace(/\n$/, '')

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span>{language}</span>
        <button
          className="btn-copy"
          onClick={() => {
            navigator.clipboard.writeText(codeStr)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <SyntaxHighlighter style={oneDark} language={language} PreTag="div">
        {codeStr}
      </SyntaxHighlighter>
    </div>
  )
}
