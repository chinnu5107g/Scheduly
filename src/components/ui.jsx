// Small presentational helpers shared by several pages.

import { useId, useRef, useState } from 'react'
import { getValidationBadge } from '../utils/timetableValidation.js'
import { useDismiss } from '../hooks/useDismiss.js'
import { useApp } from '../AppContext.js'

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  )
}

export function Badge({ tone = 'neutral', children, title }) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }) {
  const tone = status === 'Active' ? 'success' : status === 'Draft' ? 'warn' : 'neutral'
  return <Badge tone={tone}>{status}</Badge>
}

export function ValidationBadge({ timetable }) {
  const { conflicts } = useApp()
  const b = getValidationBadge(timetable, conflicts)
  return (
    <Badge tone={b.tone} title={b.title}>
      {b.label}
    </Badge>
  )
}

export function EmptyState({ icon, title, children, action }) {
  return (
    <div className="empty-state">
      {icon ? <div className="empty-icon">{icon}</div> : null}
      <h3>{title}</h3>
      {children ? <p className="muted">{children}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  )
}

export function Notice({ tone = 'info', children }) {
  return (
    <div className={`notice notice-${tone}`} role="note">
      {children}
    </div>
  )
}

export function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob" />
    </button>
  )
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? 'active' : ''}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          title={o.title}
        >
          {o.icon}
          {o.label ? <span>{o.label}</span> : null}
        </button>
      ))}
    </div>
  )
}

function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  )
}

/** Three-dot actions menu. items: [{ label, icon, onClick, danger }] */
export function ActionMenu({ label, items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const id = useId()
  useDismiss(open, ref, () => setOpen(false))

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <DotsIcon />
      </button>
      {open ? (
        <div className="menu" role="menu" id={id}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`menu-item${item.danger ? ' danger' : ''}`}
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} role="status">
          <span>{t.text}</span>
          <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={() => onDismiss(t.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
