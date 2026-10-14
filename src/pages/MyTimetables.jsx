import { Plus } from 'lucide-react'
import TimetableBrowser from '../components/TimetableBrowser.jsx'
import { PageHeader } from '../components/ui.jsx'
import { useApp } from '../AppContext.js'

export default function MyTimetables() {
  const app = useApp()
  const counts = app.timetables.reduce(
    (acc, t) => ({ ...acc, [t.status]: (acc[t.status] || 0) + 1 }),
    { Active: 0, Draft: 0, Archived: 0 },
  )
  return (
    <>
      <PageHeader
        title="My Timetables"
        subtitle={`${app.timetables.length} in total · ${counts.Active} active · ${counts.Draft} draft · ${counts.Archived} archived`}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => app.openCreate()}>
            <Plus size={17} aria-hidden="true" /> Create New Timetable
          </button>
        }
      />
      <TimetableBrowser
        timetables={app.timetables}
        query={app.query}
        onQuery={app.setQuery}
        view={app.view}
        onView={app.setView}
        onCreate={app.openCreate}
        onOpen={app.openTimetable}
        onRename={app.askRename}
        onDuplicate={app.duplicate}
        onDelete={app.askDelete}
        onToggleArchive={app.toggleArchive}
      />
    </>
  )
}
