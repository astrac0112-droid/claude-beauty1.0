export default function FilePreview({ files, onRemove }) {
  if (!files || files.length === 0) return null

  return (
    <div className="file-preview-list">
      {files.map((f, i) => (
        <div key={i} className="file-preview-item">
          <span className="file-preview-icon">{f.type.startsWith('image/') ? '🖼' : '📄'}</span>
          <span className="file-preview-name">{f.name}</span>
          <span className="file-preview-size">{formatSize(f.size)}</span>
          <button className="file-preview-remove" onClick={() => onRemove(i)}>×</button>
        </div>
      ))}
    </div>
  )
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
