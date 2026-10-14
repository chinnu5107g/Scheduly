import AIAssistant from '../components/AIAssistant.jsx'
import { PageHeader } from '../components/ui.jsx'
import { useApp } from '../AppContext.js'

export default function AssistantPage() {
  const app = useApp()
  return (
    <>
      <PageHeader title="AI Assistant" subtitle="Set up a timetable step by step, or give a quick command." />
      <AIAssistant
        session={app.assistant}
        onSession={app.setAssistant}
        onReset={app.resetAssistant}
        timetables={app.timetables}
        constraints={app.constraints}
        resources={app.resources}
        targetId={app.assistant.targetId}
        onTarget={(id) => app.setAssistant((s) => ({ ...s, targetId: id }))}
        onApplyEffects={app.applyAssistantEffects}
        onOpenTimetable={app.openTimetable}
      />
    </>
  )
}
