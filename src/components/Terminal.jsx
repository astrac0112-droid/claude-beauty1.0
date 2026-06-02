import { useState, useRef, useEffect } from 'react'

const SERVER = 'http://localhost:3001'

async function runCmd(command, cwd) {
  const res = await fetch(`${SERVER}/run-command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, cwd }),
  })
  const j = await res.json()
  return (j.output || '') + (j.error ? '\n[stderr] ' + j.error : '')
}

async function getCwd() {
  try {
    const res = await fetch(`${SERVER}/ping`, { signal: AbortSignal.timeout(2000) })
    const j = await res.json()
    return j.cwd || ''
  } catch { return '' }
}

export default function Terminal({ serverOnline }) {
  const [cwd, setCwd] = useState('')
  const [cmd, setCmd] = useState('')
  const [history, setHistory] = useState([])
  const [running, setRunning] = useState(false)
  const outputRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (serverOnline) getCwd().then(setCwd)
  }, [serverOnline])

  useEffect(() => {
    outputRef.current?.scrollTo(0, outputRef.current.scrollHeight)
  }, [history])

  const handleRun = async (e) => {
    e?.preventDefault()
    const trimmed = cmd.trim()
    if (!trimmed || running || !serverOnline) return

    setRunning(true)
    const entry = { cmd: trimmed, cwd, output: '', error: false }
    setHistory(prev => [...prev, entry])
    setCmd('')

    try {
      const output = await runCmd(trimmed, cwd)
      setHistory(prev => prev.map((h, i) =>
        i === prev.length - 1 ? { ...h, output, error: output.includes('[stderr]') } : h
      ))
      // Refresh cwd after cd commands
      if (trimmed.startsWith('cd ') || trimmed === 'cd') {
        getCwd().then(setCwd)
      }
    } catch (e) {
      setHistory(prev => prev.map((h, i) =>
        i === prev.length - 1 ? { ...h, output: 'Error: ' + e.message, error: true } : h
      ))
    }
    setRunning(false)
  }

  if (!serverOnline) return null

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <span className="terminal-title">{'\u{1F4BB}'} 终端 — {cwd || '...'}</span>
      </div>
      <div className="terminal-output" ref={outputRef}>
        {history.map((h, i) => (
          <div key={i} className="term-entry">
            <div className="term-cmd">{cwd || '~'}&gt; {h.cmd}</div>
            {h.output && <pre className={`term-out ${h.error ? 'term-err' : ''}`}>{h.output}</pre>}
          </div>
        ))}
        {history.length === 0 && (
          <div className="term-hint">输入命令查看输出，如 dir、ipconfig、python --version 等</div>
        )}
      </div>
      <form className="terminal-input-row" onSubmit={handleRun}>
        <span className="term-prompt">&gt;</span>
        <input
          ref={inputRef}
          className="term-input"
          value={cmd}
          onChange={e => setCmd(e.target.value)}
          placeholder="输入命令..."
          disabled={running}
        />
        <button type="submit" className="term-run-btn" disabled={running || !cmd.trim()}>
          {running ? '...' : '运行'}
        </button>
      </form>
    </div>
  )
}
