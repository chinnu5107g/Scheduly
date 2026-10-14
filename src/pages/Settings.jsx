import { useId, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Notice, PageHeader, Segmented } from '../components/ui.jsx'
import { useApp } from '../AppContext.js'

export default function Settings() {
  const app = useApp()
  const { settings } = app
  const nameId = useId()
  const [name, setName] = useState(settings.displayName)
  const set = (patch) => app.setSettings((s) => ({ ...s, ...patch }))

  const saveName = (e) => {
    e.preventDefault()
    const v = name.trim().slice(0, 40)
    if (!v) return
    set({ displayName: v })
    app.notify('Display name saved.', { silent: true })
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Preferences are saved in this browser." />
      <div className="settings-grid">
        <section className="card">
          <h2 className="card-title">Profile</h2>
          <form onSubmit={saveName} className="inline-form" noValidate>
            <div className="field grow">
              <label htmlFor={nameId}>Display name</label>
              <input id={nameId} className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-soft" disabled={!name.trim() || name.trim() === settings.displayName}>
              Save
            </button>
          </form>
          <p className="muted">
            {app.user
              ? `Signed in as ${app.user.email}. This account and its timetables are stored only in this browser.`
              : 'You are using Scheduly as a guest. Create an account from the profile menu to keep separate timetables per person on this browser.'}
          </p>
          <button type="button" className="btn btn-soft" onClick={app.signOut}>
            {app.user ? 'Sign out' : 'Sign in / create account'}
          </button>
        </section>

        <section className="card">
          <h2 className="card-title">Appearance</h2>
          <div className="setting-row">
            <span id="theme-label">Theme</span>
            <Segmented
              label="Theme"
              value={settings.theme}
              onChange={(v) => set({ theme: v })}
              options={[
                { value: 'light', label: 'Light', icon: <Sun size={15} aria-hidden="true" /> },
                { value: 'dark', label: 'Dark', icon: <Moon size={15} aria-hidden="true" /> },
                { value: 'system', label: 'System', icon: <Monitor size={15} aria-hidden="true" /> },
              ]}
            />
          </div>
          <div className="setting-row">
            <span>Time format</span>
            <Segmented
              label="Time format"
              value={settings.timeFormat}
              onChange={(v) => set({ timeFormat: v })}
              options={[
                { value: '24h', label: '24-hour' },
                { value: '12h', label: '12-hour' },
              ]}
            />
          </div>
          <div className="setting-row">
            <span>Default timetable layout</span>
            <Segmented
              label="Default layout"
              value={settings.defaultView}
              onChange={(v) => {
                set({ defaultView: v })
                app.setView(v)
              }}
              options={[
                { value: 'grid', label: 'Grid' },
                { value: 'list', label: 'List' },
              ]}
            />
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Your data</h2>
          <p className="muted">Everything is stored in this browser’s localStorage. Clearing site data removes it, so export a backup first.</p>
          <div className="stack">
            <button type="button" className="btn btn-ghost" onClick={() => app.navigate('import-export')}>
              Go to Import / Export
            </button>
            <button type="button" className="btn btn-ghost" onClick={app.askResetDemo}>
              Reset to demo data…
            </button>
            <button type="button" className="btn btn-danger-soft" onClick={app.askClearAll}>
              Delete all my data…
            </button>
          </div>
        </section>
      </div>
      {!app.saveOk ? <Notice tone="warn">Your browser is blocking storage, so changes will be lost when you close this tab.</Notice> : null}
    </>
  )
}
