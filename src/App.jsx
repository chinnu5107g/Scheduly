import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppContext } from './AppContext.js'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import CreateTimetableModal from './components/CreateTimetableModal.jsx'
import RenameModal from './components/RenameModal.jsx'
import ConfirmDialog from './components/ConfirmDialog.jsx'
import { Notice, Toasts } from './components/ui.jsx'
import Dashboard from './pages/Dashboard.jsx'
import MyTimetables from './pages/MyTimetables.jsx'
import TimetablePage from './pages/TimetablePage.jsx'
import AssistantPage from './pages/AssistantPage.jsx'
import CalendarView from './pages/CalendarView.jsx'
import ResourcePage from './pages/ResourcePage.jsx'
import Constraints from './pages/Constraints.jsx'
import Settings from './pages/Settings.jsx'
import ImportExport from './pages/ImportExport.jsx'
import Help from './pages/Help.jsx'
import { NAV_ITEMS } from './components/Sidebar.jsx'
import { useTimetables } from './hooks/useTimetables.js'
import { useStoredState } from './hooks/useStoredState.js'
import { KEYS, loadConstraints, loadResources, loadSettings, loadUi } from './utils/storage.js'
import { buildSeedConstraints, buildSeedResources, buildSeedTimetables } from './utils/seedData.js'
import { makeTimetable, uid } from './utils/timetableModel.js'
import { findConflicts } from './utils/timetableValidation.js'
import { generateSchedule, summarizeGeneration } from './utils/generator.js'
import { createSession } from './utils/assistant.js'

const EMPTY_RESOURCES = { subjects: [], teachers: [], rooms: [] }

function useResolvedTheme(pref) {
  const query = '(prefers-color-scheme: dark)'
  const [systemDark, setSystemDark] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false))
  useEffect(() => {
    if (!window.matchMedia) return undefined
    const mq = window.matchMedia(query)
    const on = (e) => setSystemDark(e.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return pref === 'system' ? (systemDark ? 'dark' : 'light') : pref
}

export default function App({ user = null, onSignOut = () => {} }) {
  const tts = useTimetables()
  const [resources, setResources, resOk] = useStoredState(KEYS.resources, loadResources)
  const [constraints, setConstraints, conOk] = useStoredState(KEYS.constraints, loadConstraints)
  const [settings, setSettings, setOk] = useStoredState(KEYS.settings, loadSettings)
  const [ui, setUi, uiOk] = useStoredState(KEYS.ui, loadUi)
  const saveOk = tts.saveOk && resOk && conOk && setOk && uiOk

  const resolvedTheme = useResolvedTheme(settings.theme)
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const [route, setRoute] = useState({ page: 'dashboard', id: null })
  const [mobileNav, setMobileNav] = useState(false)
  const [query, setQuery] = useState('')
  const [view, setView] = useState(settings.defaultView)
  const [previewId, setPreviewId] = useState(null)
  const [assistant, setAssistant] = useState(() => createSession(null))

  const [creating, setCreating] = useState(null)
  const [renaming, setRenaming] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [confirm, setConfirm] = useState(null) // 'reset' | 'clear'

  const [toasts, setToasts] = useState([])
  const [notifications, setNotifications] = useState([])
  const mainRef = useRef(null)

  const notify = useCallback((text, { silent = false } = {}) => {
    const id = uid('n')
    setNotifications((list) => [{ id, text, time: Date.now(), read: false }, ...list].slice(0, 30))
    if (!silent) {
      setToasts((list) => [...list, { id, kind: 'info', text }].slice(-3))
      setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4500)
    }
  }, [])

  const navigate = useCallback((page) => {
    setRoute({ page, id: null })
    setMobileNav(false)
  }, [])
  const openTimetable = useCallback((id) => {
    setRoute({ page: 'timetable', id })
    setMobileNav(false)
  }, [])

  const activeNav = route.page === 'timetable' ? 'timetables' : route.page
  useEffect(() => {
    const label = route.page === 'timetable' ? 'Timetable' : NAV_ITEMS.find((n) => n.id === route.page)?.label || 'Scheduly'
    document.title = `${label} · Scheduly`
    mainRef.current?.scrollTo?.({ top: 0 })
    window.scrollTo?.(0, 0)
  }, [route])

  // ----- timetable actions
  const openCreate = useCallback((type) => setCreating({ type: typeof type === 'string' ? type : null }), [])

  const handleCreate = (config, opts = {}) => {
    let tt = makeTimetable({ ...config, id: uid('tt') })
    let summary = ''
    if (opts.autoFill && tt.activities.length) {
      const res = generateSchedule(tt, { timetables: tts.timetables, constraints, resources, mode: 'replace' })
      tt = res.tt
      summary = ` ${summarizeGeneration(res)}`
    }
    tts.add(tt)
    setCreating(null)
    notify(`Created “${tt.name}” as a draft.${summary}`)
    openTimetable(tt.id)
  }

  /** Build (or rebuild) a timetable's schedule from its subjects. mode: 'fill' keeps entries, 'replace' starts over. */
  const generateFor = (id, mode = 'fill') => {
    const tt = tts.timetables.find((t) => t.id === id)
    if (!tt) return null
    const res = generateSchedule(tt, { timetables: tts.timetables, constraints, resources, mode })
    if (res.filled || mode === 'replace') tts.update(id, () => res.tt)
    notify(`“${tt.name}”: ${summarizeGeneration(res)}`)
    return res
  }

  const duplicate = (tt) => {
    const copy = tts.duplicate(tt.id)
    if (copy) notify(`Duplicated as “${copy.name}”.`)
  }
  const toggleArchive = (tt) => {
    const archived = tt.status === 'Archived'
    tts.update(tt.id, { status: archived ? 'Active' : 'Archived' })
    notify(archived ? `Restored “${tt.name}”.` : `Archived “${tt.name}”.`)
  }
  const confirmDelete = () => {
    const tt = deleting
    tts.remove(tt.id)
    setDeleting(null)
    if (route.page === 'timetable' && route.id === tt.id) navigate('timetables')
    notify(`Deleted “${tt.name}”.`)
  }

  // ----- assistant
  const applyAssistantEffects = (effects) => {
    for (const fx of effects) {
      if (fx.type === 'add') {
        tts.add(fx.timetable)
        notify(`Scheduly AI created “${fx.timetable.name}” (draft).`)
      } else if (fx.type === 'replace') {
        tts.replace(fx.timetable)
        notify(`Scheduly AI updated “${fx.timetable.name}”.`, { silent: true })
      } else if (fx.type === 'constraint') {
        setConstraints((list) =>
          list.some((c) => c.rule === fx.rule)
            ? list.map((c) => (c.rule === fx.rule ? { ...c, enabled: true } : c))
            : [...list, { id: uid('con'), rule: fx.rule || 'custom', label: fx.label, enabled: true }],
        )
        notify('Rule switched on in Constraints.', { silent: true })
      }
    }
  }
  const askAssistant = (id) => {
    setAssistant((s) => ({ ...s, targetId: id }))
    navigate('assistant')
  }
  const resetAssistant = () => setAssistant((s) => createSession(s.targetId))

  // ----- data
  const resetDemo = () => {
    tts.replaceAll(buildSeedTimetables())
    setResources(buildSeedResources())
    setConstraints(buildSeedConstraints())
    setPreviewId(null)
    setConfirm(null)
    navigate('dashboard')
    notify('Demo data restored.')
  }
  const clearAll = () => {
    tts.replaceAll([])
    setResources(EMPTY_RESOURCES)
    setConstraints(buildSeedConstraints())
    setPreviewId(null)
    setConfirm(null)
    navigate('dashboard')
    notify('All timetables and lists were deleted.')
  }
  const importBackup = ({ timetables, resources: res, constraints: cons }, mode) => {
    if (mode === 'replace') {
      tts.replaceAll(timetables)
      if (res) setResources(res)
      if (cons) setConstraints(cons)
    } else {
      const have = new Set(tts.timetables.map((t) => t.id))
      const incoming = timetables.map((t) => (have.has(t.id) ? { ...t, id: uid('tt') } : t))
      tts.replaceAll([...incoming, ...tts.timetables])
      if (res) {
        setResources((cur) => {
          const merge = (a, b) => [...a, ...b.filter((x) => !a.some((y) => y.id === x.id))]
          return { subjects: merge(cur.subjects, res.subjects), teachers: merge(cur.teachers, res.teachers), rooms: merge(cur.rooms, res.rooms) }
        })
      }
      if (cons) setConstraints((cur) => [...cur, ...cons.filter((x) => !cur.some((y) => y.id === x.id))])
    }
    notify(`Imported ${timetables.length} timetable(s).`)
  }

  const conflicts = useMemo(() => findConflicts(tts.timetables, constraints), [tts.timetables, constraints])

  /** Add a teacher or room by name and return its id (used by the slot editor and subjects panel). */
  const addResource = (kind, name) => {
    const id = uid(kind === 'teachers' ? 'tch' : 'room')
    const extra = kind === 'teachers' ? { subjects: '', availability: '' } : { type: '', capacity: 0 }
    setResources((r) => ({ ...r, [kind]: [...r[kind], { id, name: String(name).trim().slice(0, 80), ...extra }] }))
    return id
  }

  const subjectLibrary = useMemo(() => resources.subjects.map((s) => s.name), [resources.subjects])

  const ctx = {
    user,
    signOut: onSignOut,
    timetables: tts.timetables,
    updateTimetable: tts.update,
    resources,
    setResources,
    constraints,
    setConstraints,
    settings,
    setSettings,
    saveOk,
    query,
    setQuery,
    view,
    setView,
    previewId,
    setPreviewId,
    navigate,
    openTimetable,
    openCreate,
    askRename: setRenaming,
    askDelete: setDeleting,
    askResetDemo: () => setConfirm('reset'),
    askClearAll: () => setConfirm('clear'),
    duplicate,
    toggleArchive,
    notify,
    assistant,
    setAssistant,
    resetAssistant,
    askAssistant,
    applyAssistantEffects,
    importBackup,
    generateFor,
    conflicts,
    addResource,
  }

  let page
  switch (route.page) {
    case 'timetable':
      page = <TimetablePage id={route.id} />
      break
    case 'timetables':
      page = <MyTimetables />
      break
    case 'assistant':
      page = <AssistantPage />
      break
    case 'calendar':
      page = <CalendarView />
      break
    case 'subjects':
    case 'teachers':
    case 'rooms':
      page = <ResourcePage key={route.page} kind={route.page} />
      break
    case 'constraints':
      page = <Constraints />
      break
    case 'settings':
      page = <Settings />
      break
    case 'import-export':
      page = <ImportExport />
      break
    case 'help':
      page = <Help />
      break
    default:
      page = <Dashboard />
  }

  return (
    <AppContext.Provider value={ctx}>
      <div className={`app${ui.sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Sidebar
          activeId={activeNav}
          onNavigate={navigate}
          collapsed={ui.sidebarCollapsed}
          onToggleCollapse={() => setUi((u) => ({ ...u, sidebarCollapsed: !u.sidebarCollapsed }))}
          mobileOpen={mobileNav}
          onCloseMobile={() => setMobileNav(false)}
        />
        <div className="app-main">
          <Topbar
            query={query}
            onQuery={setQuery}
            timetables={tts.timetables}
            onOpenTimetable={openTimetable}
            onSubmitSearch={() => navigate('timetables')}
            onCreate={openCreate}
            onNavigate={navigate}
            notifications={notifications}
            onMarkAllRead={() => setNotifications((l) => l.map((n) => ({ ...n, read: true })))}
            onClearNotifications={() => setNotifications([])}
            resolvedTheme={resolvedTheme}
            onToggleTheme={() => setSettings((s) => ({ ...s, theme: resolvedTheme === 'dark' ? 'light' : 'dark' }))}
            displayName={settings.displayName}
            account={user}
            onSignOut={onSignOut}
            onResetDemo={() => setConfirm('reset')}
            onOpenMenu={() => setMobileNav(true)}
            sidebarCollapsed={ui.sidebarCollapsed}
            onToggleCollapse={() => setUi((u) => ({ ...u, sidebarCollapsed: !u.sidebarCollapsed }))}
          />
          <main id="main" className="page" tabIndex={-1} ref={mainRef}>
            {!saveOk ? (
              <Notice tone="warn">Your browser is blocking local storage, so your changes will be lost when you close or refresh this tab.</Notice>
            ) : null}
            {page}
          </main>
        </div>

        {creating ? (
          <CreateTimetableModal
            initialType={creating.type}
            subjectLibrary={subjectLibrary}
            resources={resources}
            onAddResource={addResource}
            onCreate={handleCreate}
            onClose={() => setCreating(null)}
          />
        ) : null}
        {renaming ? (
          <RenameModal
            timetable={renaming}
            onClose={() => setRenaming(null)}
            onSave={(name) => {
              tts.update(renaming.id, { name })
              notify(`Renamed to “${name}”.`)
              setRenaming(null)
            }}
          />
        ) : null}
        {deleting ? (
          <ConfirmDialog
            title="Delete timetable?"
            message={`“${deleting.name}” and all of its entries will be permanently deleted. This can’t be undone.`}
            confirmLabel="Delete timetable"
            danger
            onConfirm={confirmDelete}
            onCancel={() => setDeleting(null)}
          />
        ) : null}
        {confirm === 'reset' ? (
          <ConfirmDialog
            title="Reset to demo data?"
            message="This replaces all your timetables, subjects, teachers, rooms and rules with the demo set. Download a backup first if you want to keep anything."
            confirmLabel="Reset"
            danger
            onConfirm={resetDemo}
            onCancel={() => setConfirm(null)}
          />
        ) : null}
        {confirm === 'clear' ? (
          <ConfirmDialog
            title="Delete all data?"
            message="Every timetable, subject, teacher and room will be permanently deleted from this browser."
            confirmLabel="Delete everything"
            danger
            onConfirm={clearAll}
            onCancel={() => setConfirm(null)}
          />
        ) : null}

        <Toasts toasts={toasts} onDismiss={(id) => setToasts((l) => l.filter((t) => t.id !== id))} />
      </div>
    </AppContext.Provider>
  )
}
