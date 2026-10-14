import { useId, useMemo, useRef, useState } from 'react'
import { Bell, ChevronsLeft, ChevronsRight, LifeBuoy, LogOut, Menu, Moon, Plus, Search, Sun, User, X } from 'lucide-react'
import { useDismiss } from '../hooks/useDismiss.js'
import { formatRelative } from '../utils/time.js'
import { getType } from '../utils/timetableTypes.js'
import TypeIcon from './TypeIcon.jsx'

function SearchBox({ query, onQuery, timetables, onOpen, onSubmit }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const listId = useId()
  useDismiss(open, ref, () => setOpen(false))

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return timetables
      .filter((t) => `${t.name} ${t.category} ${getType(t.type).label}`.toLowerCase().includes(q))
      .slice(0, 6)
  }, [query, timetables])

  const showList = open && query.trim().length > 0

  return (
    <div className="search" ref={ref} role="search">
      <Search size={17} className="search-icon" aria-hidden="true" />
      <input
        type="search"
        className="search-input"
        placeholder="Search timetables…"
        aria-label="Search timetables"
        aria-controls={showList ? listId : undefined}
        aria-expanded={showList}
        value={query}
        onChange={(e) => {
          onQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            setOpen(false)
            onSubmit()
          }
        }}
      />
      {query ? (
        <button
          type="button"
          className="search-clear"
          aria-label="Clear search"
          onClick={() => {
            onQuery('')
            setOpen(false)
          }}
        >
          <X size={15} aria-hidden="true" />
        </button>
      ) : null}

      {showList ? (
        <div className="popover search-results" id={listId}>
          {results.length ? (
            <>
              <ul>
                {results.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="result-item"
                      onClick={() => {
                        setOpen(false)
                        onOpen(t.id)
                      }}
                    >
                      <span className="result-icon">
                        <TypeIcon type={t.type} size={16} />
                      </span>
                      <span className="result-text">
                        <strong>{t.name}</strong>
                        <small>{getType(t.type).short}{t.category ? ` · ${t.category}` : ''}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="result-all"
                onClick={() => {
                  setOpen(false)
                  onSubmit()
                }}
              >
                See all matches in My Timetables
              </button>
            </>
          ) : (
            <p className="popover-empty">No timetables match “{query.trim()}”.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

function NotificationsMenu({ notifications, onMarkAllRead, onClear }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const id = useId()
  useDismiss(open, ref, () => setOpen(false))
  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={19} aria-hidden="true" />
        {unread ? <span className="dot-badge">{unread > 9 ? '9+' : unread}</span> : null}
      </button>
      {open ? (
        <div className="popover notifications" id={id}>
          <div className="popover-head">
            <strong>Notifications</strong>
            <div className="popover-head-actions">
              <button type="button" className="link-btn" onClick={onMarkAllRead} disabled={!unread}>
                Mark all read
              </button>
              <button type="button" className="link-btn" onClick={onClear} disabled={!notifications.length}>
                Clear
              </button>
            </div>
          </div>
          {notifications.length ? (
            <ul>
              {notifications.map((n) => (
                <li key={n.id} className={n.read ? 'read' : 'unread'}>
                  <span>{n.text}</span>
                  <small>{formatRelative(n.time)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="popover-empty">You’re all caught up. Activity from this session shows up here.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

function ProfileMenu({ name, account, onSignOut, onNavigate, onResetDemo }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const id = useId()
  useDismiss(open, ref, () => setOpen(false))
  const initial = (name || 'G').trim().charAt(0).toUpperCase() || 'G'

  const go = (page) => {
    setOpen(false)
    onNavigate(page)
  }

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        type="button"
        className="avatar-btn"
        aria-label="Open profile menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar" aria-hidden="true">
          {initial}
        </span>
      </button>
      {open ? (
        <div className="menu menu-right profile-menu" role="menu" id={id}>
          <div className="profile-head">
            <span className="avatar large" aria-hidden="true">
              {initial}
            </span>
            <div>
              <strong>{name}</strong>
              <small>{account ? account.email : 'Guest · data stays in this browser'}</small>
            </div>
          </div>
          <button type="button" role="menuitem" className="menu-item" onClick={() => go('settings')}>
            <User size={16} aria-hidden="true" /> Profile & settings
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={() => go('import-export')}>
            Import / Export data
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={() => go('help')}>
            Help & Guide
          </button>
          <div className="menu-sep" />
          <button
            type="button"
            role="menuitem"
            className="menu-item danger"
            onClick={() => {
              setOpen(false)
              onResetDemo()
            }}
          >
            Reset to demo data…
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              setOpen(false)
              onSignOut()
            }}
          >
            <LogOut size={16} aria-hidden="true" /> {account ? 'Sign out' : 'Sign in / create account'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default function Topbar({
  query,
  onQuery,
  timetables,
  onOpenTimetable,
  onSubmitSearch,
  onCreate,
  onNavigate,
  notifications,
  onMarkAllRead,
  onClearNotifications,
  resolvedTheme,
  onToggleTheme,
  displayName,
  account,
  onSignOut,
  onResetDemo,
  onOpenMenu,
  sidebarCollapsed,
  onToggleCollapse,
}) {
  const dark = resolvedTheme === 'dark'
  return (
    <header className="topbar">
      <button type="button" className="icon-btn menu-toggle" onClick={onOpenMenu} aria-label="Open navigation menu">
        <Menu size={20} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="icon-btn collapse-toggle"
        onClick={onToggleCollapse}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <ChevronsRight size={19} aria-hidden="true" /> : <ChevronsLeft size={19} aria-hidden="true" />}
      </button>

      <SearchBox
        query={query}
        onQuery={onQuery}
        timetables={timetables}
        onOpen={onOpenTimetable}
        onSubmit={onSubmitSearch}
      />

      <div className="topbar-actions">
        <button type="button" className="btn btn-primary create-btn" onClick={() => onCreate()}>
          <Plus size={18} aria-hidden="true" />
          <span>Create New Timetable</span>
        </button>
        <button type="button" className="icon-btn hide-sm" onClick={() => onNavigate('help')} aria-label="Help & Guide">
          <LifeBuoy size={19} aria-hidden="true" />
        </button>
        <NotificationsMenu notifications={notifications} onMarkAllRead={onMarkAllRead} onClear={onClearNotifications} />
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
        </button>
        <ProfileMenu name={displayName} account={account} onSignOut={onSignOut} onNavigate={onNavigate} onResetDemo={onResetDemo} />
      </div>
    </header>
  )
}
