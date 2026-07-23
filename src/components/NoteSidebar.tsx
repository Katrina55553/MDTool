import { memo, useMemo } from 'react'
import { getNoteTitle } from '../utils/noteUtils'
import type { Note } from '../types/note'

interface NoteSidebarProps {
  notes: Note[]
  activeNoteId: string
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function NoteSidebarBase({ notes, activeNoteId, onSelect, onCreate, onDelete }: NoteSidebarProps) {
  const sorted = useMemo(() => [...notes].sort((a, b) => b.updatedAt - a.updatedAt), [notes])

  return (
    <aside className="note-sidebar">
      <div className="note-sidebar-header">
        <span className="note-sidebar-title">笔记</span>
        <button type="button" className="note-create-btn" onClick={onCreate} title="新建笔记" aria-label="新建笔记">
          +
        </button>
      </div>
      <ul className="note-list">
        {sorted.map((note) => {
          const active = note.id === activeNoteId
          return (
            <li
              key={note.id}
              className={`note-item${active ? ' note-item-active' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(note.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(note.id)
                }
              }}
              title={getNoteTitle(note.content)}
            >
              <span className="note-item-title">{getNoteTitle(note.content)}</span>
              <button
                type="button"
                className="note-delete-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(note.id)
                }}
                title="删除笔记"
                aria-label="删除笔记"
              >
                <TrashIcon />
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

const NoteSidebar = memo(NoteSidebarBase)
export default NoteSidebar
