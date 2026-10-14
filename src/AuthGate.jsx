import { useCallback, useEffect, useState } from 'react'
import App from './App.jsx'
import AuthPage from './components/AuthPage.jsx'
import { clearSession, hasAccounts, loadSession, saveSession } from './utils/auth.js'
import { loadSettings, setStorageScope } from './utils/storage.js'

/**
 * Decides between the sign-in page and the app. Each account (and the guest) has its own stored
 * data; <App key=…> is remounted on switching so nothing leaks between them.
 */
export default function AuthGate() {
  const [session, setSession] = useState(() => loadSession())

  // Must run before <App> reads storage, so do it during render (it is idempotent).
  setStorageScope(session?.user?.id || null)

  // Theme for the sign-in screen (the app sets it itself once open).
  useEffect(() => {
    if (session) return
    const pref = loadSettings().theme
    const dark = pref === 'dark' || (pref === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, [session])

  const onAuthed = useCallback((next, remember) => {
    saveSession(next, remember)
    setStorageScope(next.user?.id || null)
    setSession(next)
  }, [])

  const signOut = useCallback(() => {
    clearSession()
    setStorageScope(null)
    setSession(null)
  }, [])

  if (!session) return <AuthPage hasAccounts={hasAccounts()} onAuthed={onAuthed} />
  return <App key={session.user?.id || 'guest'} user={session.user || null} onSignOut={signOut} />
}
