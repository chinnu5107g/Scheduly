import {
  ArrowLeftRight,
  BookOpen,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  DoorOpen,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Table,
  Users,
  X,
} from 'lucide-react'
import Logo from './Logo.jsx'

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'timetables', label: 'My Timetables', icon: Table },
  { id: 'assistant', label: 'AI Assistant', icon: Sparkles },
  { id: 'calendar', label: 'Calendar View', icon: CalendarDays },
  { id: 'subjects', label: 'Subjects / Activities', icon: BookOpen },
  { id: 'teachers', label: 'Teachers', icon: Users },
  { id: 'rooms', label: 'Rooms / Resources', icon: DoorOpen },
  { id: 'constraints', label: 'Constraints', icon: SlidersHorizontal },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'import-export', label: 'Import / Export', icon: ArrowLeftRight },
  { id: 'help', label: 'Help & Guide', icon: LifeBuoy },
]

export default function Sidebar({ activeId, onNavigate, collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  return (
    <>
      {mobileOpen ? <div className="sidebar-overlay" onClick={onCloseMobile} aria-hidden="true" /> : null}
      <aside
        className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}
        aria-label="Primary"
      >
        <div className="sidebar-brand">
          <button type="button" className="brand-btn" onClick={() => onNavigate('dashboard')} aria-label="Scheduly home">
            <Logo size={32} />
            <span className="brand-name">Scheduly</span>
          </button>
          <button type="button" className="icon-btn sidebar-close" onClick={onCloseMobile} aria-label="Close menu">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <nav className="sidebar-nav">
          <ul>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = item.id === activeId
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`nav-item${active ? ' active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                    onClick={() => onNavigate(item.id)}
                  >
                    <Icon size={19} aria-hidden="true" />
                    <span className="nav-label">{item.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <button
          type="button"
          className="collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
        >
          {collapsed ? <ChevronsRight size={18} aria-hidden="true" /> : <ChevronsLeft size={18} aria-hidden="true" />}
          <span className="nav-label">Collapse</span>
        </button>
      </aside>
    </>
  )
}
