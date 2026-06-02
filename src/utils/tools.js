// Tool definitions sent to the AI, and local handlers executed in the browser.

export const TOOLS = [
  {
    name: 'read_local_file',
    description: 'Read the contents of a file in the user-accessible local directory. Use this to read any file the user mentions or that you need to inspect.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative or absolute path to the file to read' },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_local_files',
    description: 'List files in a directory. Use this to explore the user-accessible file structure.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to list. Use "." for current directory.' },
      },
      required: ['path'],
    },
  },
]

// In-memory cache of directory handles (File System Access API)
let dirHandle = null

export function setDirectoryHandle(handle) {
  dirHandle = handle
}

export function getDirectoryHandle() {
  return dirHandle
}

async function resolveFile(path, baseHandle) {
  if (!baseHandle) throw new Error('No local directory access. Grant access in settings or via the folder button.')
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean)
  let current = baseHandle
  for (let i = 0; i < parts.length - 1; i++) {
    current = await current.getDirectoryHandle(parts[i], { create: false })
  }
  return await current.getFileHandle(parts[parts.length - 1], { create: false })
}

export async function executeTool(name, input) {
  if (name === 'read_local_file') {
    if (!dirHandle) return 'Error: No local directory access granted. Click the folder icon to grant access.'
    try {
      const fileHandle = await resolveFile(input.path, dirHandle)
      const file = await fileHandle.getFile()
      return await file.text()
    } catch (e) {
      return `Error reading file "${input.path}": ${e.message}`
    }
  }

  if (name === 'list_local_files') {
    if (!dirHandle) return 'Error: No local directory access granted. Click the folder icon to grant access.'
    try {
      const parts = input.path.replace(/\\/g, '/').split('/').filter(Boolean)
      let current = dirHandle
      for (const part of parts) {
        current = await current.getDirectoryHandle(part, { create: false })
      }
      const entries = []
      for await (const [name, handle] of current.entries()) {
        entries.push(`${handle.kind === 'directory' ? '📁' : '📄'} ${name}`)
      }
      return entries.join('\n') || '(empty directory)'
    } catch (e) {
      return `Error listing "${input.path}": ${e.message}`
    }
  }

  return `Unknown tool: ${name}`
}
