// Tool definitions for AI, plus local handlers (server-first, browser-fallback).

const SERVER = 'http://localhost:3001'

let serverAvailable = false

export async function checkServer() {
  try {
    const res = await fetch(`${SERVER}/ping`, { signal: AbortSignal.timeout(2000) })
    const j = await res.json()
    serverAvailable = j.ok === true
    return serverAvailable
  } catch {
    serverAvailable = false
    return false
  }
}

export function isServerAvailable() { return serverAvailable }

export const TOOLS = [
  {
    name: 'read_file',
    description: 'Read the contents of a file on the local machine. Provide the full file path.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Full path to the file (e.g. C:/Users/1/Desktop/file.txt or /home/user/file.txt)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files and folders in a directory on the local machine.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to list (e.g. C:/Users/1/Desktop or /home/user)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file. Creates parent directories if needed. Use this to create or update files on the local machine.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Full path where to write the file' },
        content: { type: 'string', description: 'The content to write to the file' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'run_command',
    description: 'Execute a shell command on the local machine and return the output. Only use this when the user explicitly asks you to run a command. Never run destructive commands without user confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute' },
        cwd: { type: 'string', description: 'Working directory for the command (optional)' },
      },
      required: ['command'],
    },
  },
]

// ---- Browser fallback (File System Access API) ----

let dirHandle = null

export function setDirectoryHandle(handle) {
  dirHandle = handle
}

async function resolveFileBrowser(pathStr, baseHandle) {
  if (!baseHandle) throw new Error('No directory access')
  const parts = pathStr.replace(/\\/g, '/').split('/').filter(Boolean)
  let current = baseHandle
  for (let i = 0; i < parts.length - 1; i++) {
    current = await current.getDirectoryHandle(parts[i], { create: false })
  }
  return await current.getFileHandle(parts[parts.length - 1], { create: false })
}

// ---- Execute via server or browser ----

export async function executeTool(name, input) {
  // Try local server first
  if (serverAvailable) {
    try {
      if (name === 'read_file') {
        const r = await fetch(`${SERVER}/read-file`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: input.path }),
        })
        const j = await r.json()
        return j.error || j.content
      }
      if (name === 'list_directory') {
        const r = await fetch(`${SERVER}/list-dir`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: input.path }),
        })
        const j = await r.json()
        if (j.error) return j.error
        return j.entries.map(e => `${e.type === 'dir' ? '📁' : '📄'} ${e.name}  ${e.type === 'file' ? formatSize(e.size) : ''}`).join('\n') || '(empty)'
      }
      if (name === 'write_file') {
        const r = await fetch(`${SERVER}/write-file`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: input.path, content: input.content }),
        })
        const j = await r.json()
        return j.error || `File written: ${j.path} (${j.written} bytes)`
      }
      if (name === 'run_command') {
        const r = await fetch(`${SERVER}/run-command`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: input.command, cwd: input.cwd }),
        })
        const j = await r.json()
        return (j.output || '') + (j.error ? '\n[ERROR] ' + j.error : '')
      }
    } catch (e) {
      // fall through to browser fallback
    }
  }

  // Browser fallback using File System Access API
  if (name === 'read_file') {
    if (!dirHandle) return 'Error: No local server and no directory access. Run "node server.js" or click the folder icon.'
    try {
      const fh = await resolveFileBrowser(input.path, dirHandle)
      const file = await fh.getFile()
      return await file.text()
    } catch (e) {
      return `Error: ${e.message}`
    }
  }
  if (name === 'list_directory') {
    if (!dirHandle) return 'Error: No local server and no directory access. Run "node server.js" or click the folder icon.'
    try {
      const parts = input.path.replace(/\\/g, '/').split('/').filter(Boolean)
      let current = dirHandle
      for (const p of parts) {
        current = await current.getDirectoryHandle(p, { create: false })
      }
      const out = []
      for await (const [nm, h] of current.entries()) {
        out.push(`${h.kind === 'directory' ? '📁' : '📄'} ${nm}`)
      }
      return out.join('\n') || '(empty)'
    } catch (e) {
      return `Error: ${e.message}`
    }
  }

  return `Tool "${name}" is only available when the local server is running. Start it with: node server.js`
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}
