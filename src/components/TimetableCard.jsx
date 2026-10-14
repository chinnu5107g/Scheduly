import { Archive, ArrowRight, Clock, Copy, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { formatRelative } from '../utils/time.js'
import { getType } from '../utils/timetableTypes.js'
import { periodsPerDay, workingDaysLabel } from '../utils/timetableModel.js'
import TypeIcon from './TypeIcon.jsx'
import { ActionMenu, StatusBadge, ValidationBadge } from './ui.jsx'

export default function TimetableCard({ timetable: tt, view, onOpen, onRename, onDuplicate, onDelete, onToggleArchive }) {
  const type = getType(tt.type)
  const periods = periodsPerDay(tt)
  const archived = tt.status === 'Archived'

  const menuItems = [
    { label: 'Open', icon: <ArrowRight size={16} aria-hidden="true" />, onClick: () => onOpen(tt.id) },
    { label: 'Rename', icon: <Pencil size={16} aria-hidden="true" />, onClick: () => onRename(tt) },
    { label: 'Duplicate', icon: <Copy size={16} aria-hidden="true" />, onClick: () => onDuplicate(tt) },
    {
      label: archived ? 'Restore from archive' : 'Archive',
      icon: archived ? <RotateCcw size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />,
      onClick: () => onToggleArchive(tt),
    },
    { label: 'Delete', icon: <Trash2 size={16} aria-hidden="true" />, onClick: () => onDelete(tt), danger: true },
  ]

  return (
    <article className={`tt-card ${view === 'list' ? 'is-list' : ''}${archived ? ' is-archived' : ''}`}>
      <div className="tt-card-main">
        <span className={`type-chip type-${tt.type}`}>
          <TypeIcon type={tt.type} size={20} />
        </span>
        <div className="tt-card-title">
          <h3>
            <button type="button" className="title-btn" onClick={() => onOpen(tt.id)}>
              {tt.name}
            </button>
          </h3>
          <p className="muted">
            {type.short}
            {tt.category ? ` · ${tt.category}` : ''}
          </p>
        </div>
      </div>

      <dl className="tt-facts">
        <div>
          <dt>Days</dt>
          <dd>{workingDaysLabel(tt.days)}</dd>
        </div>
        <div>
          <dt>Per day</dt>
          <dd>
            {periods} {periods === 1 ? type.unit.replace(/s$/, '') : type.unit}
          </dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>
            <Clock size={13} aria-hidden="true" /> {formatRelative(tt.updatedAt)}
          </dd>
        </div>
      </dl>

      <div className="tt-card-badges">
        <StatusBadge status={tt.status} />
        <ValidationBadge timetable={tt} />
      </div>

      <div className="tt-card-actions">
        <button type="button" className="btn btn-soft btn-sm" onClick={() => onOpen(tt.id)}>
          Open
        </button>
        <ActionMenu label={`More actions for ${tt.name}`} items={menuItems} />
      </div>
    </article>
  )
}
