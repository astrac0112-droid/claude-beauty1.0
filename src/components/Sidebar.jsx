export default function Sidebar({ conversations, activeConvId, onSelect, onDelete, onCreate, onOpenSettings }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Claude Beauty</h2>
        <button className="btn-icon" onClick={onOpenSettings} title="设置">⚙</button>
      </div>
      <button className="btn-new-chat" onClick={onCreate}>
        + 新对话
      </button>
      <div className="conversation-list">
        {conversations.map(conv => (
          <div
            key={conv.id}
            className={`conv-item ${conv.id === activeConvId ? 'active' : ''}`}
            onClick={() => onSelect(conv.id)}
          >
            <span className="conv-title">{conv.title}</span>
            <button
              className="btn-delete"
              onClick={(e) => { e.stopPropagation(); onDelete(conv.id) }}
              title="删除"
            >×</button>
          </div>
        ))}
        {conversations.length === 0 && (
          <p className="no-convs">暂无对话</p>
        )}
      </div>
    </aside>
  )
}
