// Local tool server — gives AI real filesystem + shell access.
// Start with:  node server.js
// Default port: 3001  (set PORT env var to change)

const http = require('http')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const PORT = process.env.PORT || 3001

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(data))
}

function readFile(p) {
  const abs = path.resolve(p)
  if (!fs.existsSync(abs)) return { error: `File not found: ${abs}` }
  const stat = fs.statSync(abs)
  if (stat.isDirectory()) return { error: `Path is a directory: ${abs}` }
  const content = fs.readFileSync(abs, 'utf-8')
  const size = stat.size
  return { path: abs, content, size }
}

function listDir(p) {
  const abs = path.resolve(p)
  if (!fs.existsSync(abs)) return { error: `Directory not found: ${abs}` }
  const stat = fs.statSync(abs)
  if (!stat.isDirectory()) return { error: `Not a directory: ${abs}` }
  const entries = fs.readdirSync(abs, { withFileTypes: true }).map(e => ({
    name: e.name,
    type: e.isDirectory() ? 'dir' : 'file',
    size: e.isFile() ? fs.statSync(path.join(abs, e.name)).size : 0,
  }))
  return { path: abs, entries }
}

function runCommand(cmd, cwd) {
  try {
    const dir = cwd ? path.resolve(cwd) : process.cwd()
    const output = execSync(cmd, { cwd: dir, encoding: 'utf-8', timeout: 30000, maxBuffer: 10 * 1024 * 1024 })
    return { command: cmd, cwd: dir, output: output || '(no output)', error: null }
  } catch (e) {
    return { command: cmd, cwd, output: e.stdout || '', error: e.stderr || e.message }
  }
}

function writeFile(p, content) {
  const abs = path.resolve(p)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content, 'utf-8')
  return { path: abs, written: Buffer.byteLength(content, 'utf-8') }
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    return res.end()
  }

  if (req.method === 'GET' && req.url === '/ping') {
    return json(res, { ok: true, cwd: process.cwd(), pid: process.pid })
  }

  if (req.method === 'POST') {
    let body = ''
    req.on('data', c => body += c)
    req.on('end', () => {
      let input
      try { input = JSON.parse(body) } catch { input = {} }

      if (req.url === '/read-file') {
        const r = readFile(input.path)
        return json(res, r, r.error ? 400 : 200)
      }
      if (req.url === '/list-dir') {
        const r = listDir(input.path)
        return json(res, r, r.error ? 400 : 200)
      }
      if (req.url === '/run-command') {
        const r = runCommand(input.command, input.cwd)
        return json(res, r)
      }
      if (req.url === '/write-file') {
        const r = writeFile(input.path, input.content)
        return json(res, r, r.error ? 400 : 200)
      }
      json(res, { error: 'Unknown endpoint' }, 404)
    })
    return
  }

  json(res, { error: 'Not found' }, 404)
})

server.listen(PORT, () => {
  console.log(`Local tool server running on http://localhost:${PORT}`)
  console.log(`  Endpoints: /ping  /read-file  /list-dir  /run-command  /write-file`)
  console.log(`  Working directory: ${process.cwd()}`)
})
