import { Plus, Sparkles } from 'lucide-react'
import TimetableBrowser from '../components/TimetableBrowser.jsx'
import WeeklyPreview from '../components/WeeklyPreview.jsx'
import { PageHeader } from '../components/ui.jsx'
import { useApp } from '../AppContext.js'

export default function Dashboard() {
  const app = useApp()
  return (
    <>
      <PageHeader
        title="My Timetables"
        subtitle="Create, manage and organize all your timetables in one place."
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => app.navigate('assistant')}>
              <Sparkles size={17} aria-hidden="true" /> Ask Scheduly AI
            </button>
            <button type="button" className="btn btn-primary" onClick={() => app.openCreate()}>
              <Plus size={17} aria-hidden="true" /> Create New Timetable
            </button>
          </>
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
      <h2 className="section-title">Weekly preview</h2>
      <WeeklyPreview
        timetables={app.timetables}
        resources={app.resources}
        timeFormat={app.settings.timeFormat}
        selectedId={app.previewId}
        onSelect={app.setPreviewId}
        onUpdate={app.updateTimetable}
        onOpenFull={app.openTimetable}
        notify={app.notify}
      />
    </>
  )
}
