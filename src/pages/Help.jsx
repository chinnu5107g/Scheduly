import { PageHeader, Notice } from '../components/ui.jsx'

const SECTIONS = [
  {
    title: 'Create a timetable',
    body: 'Choose Create New Timetable in the top bar or on the dashboard. Pick a type (school, college, personal routine, study plan, work or custom), name it, then set days, hours, slot length, breaks and activities. Each type asks only for what it needs.',
  },
  {
    title: 'Edit a timetable',
    body: 'Open a timetable and click any cell. First choose the subject (or type a new one), then how long it lasts, then the teacher and optionally a room. Teachers and rooms already busy at that time in another timetable are greyed out, so a clash cannot be saved. Use Clear slot to empty a cell.',
  },
  {
    title: 'Add and manage subjects',
    body: 'Use the Subjects panel under a timetable to add a subject with its usual duration and teacher, change them later, or remove a subject. You can also type a new subject name straight into a cell.',
  },
  {
    title: 'Use Scheduly AI',
    body: 'The assistant asks one question at a time to set up a timetable, and understands commands such as “Add a lunch break”, “Keep Sunday free”, “Give Mathematics more periods” and “Fill the empty slots”. It is a rule-based demo, not an AI model.',
  },
  {
    title: 'Keep your data safe',
    body: 'Timetables are saved in this browser only. Use Import / Export to download a JSON backup and restore it later or on another device.',
  },
  {
    title: 'Keyboard tips',
    body: 'Tab moves between controls, Enter or Space activates them, and Escape closes dialogs and menus. Grid cells are buttons, so the whole timetable can be edited without a mouse.',
  },
]

export default function Help() {
  return (
    <>
      <PageHeader title="Help & Guide" subtitle="How Scheduly works, and what it does not do yet." />
      <Notice tone="warn">
        <strong>What is not built yet:</strong> automatic timetable generation, teacher availability rules, accounts and cloud sync. Teacher
        and room clashes across your timetables are checked; demo timetables are samples.
      </Notice>
      <div className="faq">
        {SECTIONS.map((s, i) => (
          <details key={s.title} className="card faq-item" open={i === 0}>
            <summary>{s.title}</summary>
            <p>{s.body}</p>
          </details>
        ))}
      </div>
    </>
  )
}
