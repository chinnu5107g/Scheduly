// Local, browser-only accounts for the Scheduly demo.
//
// IMPORTANT: this is NOT real authentication. Accounts live in this browser's localStorage, so
// anyone with access to the browser profile can read or change them, and there is no password
// recovery. Passwords are never stored in plain text (salted PBKDF2 via Web Crypto), but this only
// separates people who share one browser. A real product needs a server for sign-in.

import { DATA_NAMES, loadJSON, readRaw, removeKey, saveJSON } from './storage.js'

const ACCOUNTS_KEY = 'scheduly:v1:accounts'
const SESSION_KEY = 'scheduly:v1:session'
const ITERATIONS = 150000
const MAX_FAILS = 5
const LOCK_MS = 30000

const fails = new Map() // email -> { n, until } (in-memory, resets on reload — a courtesy, not security)

const enc = new TextEncoder()
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export const normEmail = (e) => String(e || '').trim().toLowerCase()
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function cryptoAvailable() {
  return typeof crypto !== 'undefined' && !!crypto.subtle && !!crypto.getRandomValues
}

async function hash(password, saltB64) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(saltB64), iterations: ITERATIONS },
    key,
    256,
  )
  return toB64(bits)
}

function readAccounts() {
  const res = loadJSON(ACCOUNTS_KEY)
  return res.status === 'ok' && Array.isArray(res.value) ? res.value.filter((a) => a && a.id && a.email) : []
}
const writeAccounts = (list) => saveJSON(ACCOUNTS_KEY, list)

export const publicUser = (a) => (a ? { id: a.id, name: a.name, email: a.email } : null)

/** Password rules shown to the user while typing. */
export function passwordChecks(pw) {
  return [
    { ok: pw.length >= 8, label: 'At least 8 characters' },
    { ok: /[A-Za-z]/.test(pw), label: 'A letter' },
    { ok: /\d/.test(pw), label: 'A number' },
  ]
}

export function validateSignUp({ name, email, password, confirm }) {
  const errors = {}
  if (!String(name || '').trim()) errors.name = 'Enter your name.'
  if (!EMAIL_RE.test(normEmail(email))) errors.email = 'Enter a valid email address.'
  if (!passwordChecks(password || '').every((c) => c.ok)) errors.password = 'Use at least 8 characters with a letter and a number.'
  if (password !== confirm) errors.confirm = 'The passwords do not match.'
  return errors
}

export async function signUp({ name, email, password }) {
  if (!cryptoAvailable()) return { ok: false, error: 'This browser cannot create accounts here (secure context needed).' }
  const mail = normEmail(email)
  const accounts = readAccounts()
  if (accounts.some((a) => a.email === mail)) return { ok: false, errors: { email: 'An account with this email already exists. Try signing in.' } }
  const salt = toB64(crypto.getRandomValues(new Uint8Array(16)))
  const account = {
    id: `u${Date.now().toString(36)}${toB64(crypto.getRandomValues(new Uint8Array(4))).replace(/[^A-Za-z0-9]/g, '')}`,
    name: String(name).trim().slice(0, 40),
    email: mail,
    salt,
    hash: await hash(password, salt),
    createdAt: Date.now(),
  }
  if (!writeAccounts([...accounts, account])) return { ok: false, error: 'Could not save the account — browser storage is blocked.' }
  adoptGuestData(account)
  return { ok: true, user: publicUser(account) }
}

export async function signIn({ email, password }) {
  if (!cryptoAvailable()) return { ok: false, error: 'This browser cannot sign in here (secure context needed).' }
  const mail = normEmail(email)
  const f = fails.get(mail)
  if (f && f.until > Date.now()) {
    return { ok: false, error: `Too many attempts. Try again in ${Math.ceil((f.until - Date.now()) / 1000)} seconds.` }
  }
  const account = readAccounts().find((a) => a.email === mail)
  // Always run the hash so timing doesn't reveal whether the email exists.
  const salt = account?.salt || toB64(new Uint8Array(16))
  const h = await hash(password, salt)
  if (!account || h !== account.hash) {
    const n = (f?.n || 0) + 1
    fails.set(mail, n >= MAX_FAILS ? { n: 0, until: Date.now() + LOCK_MS } : { n, until: 0 })
    return { ok: false, error: 'Email or password is incorrect.' }
  }
  fails.delete(mail)
  return { ok: true, user: publicUser(account) }
}

/** First account takes over the guest data (the original un-prefixed keys) so nothing is lost. */
function adoptGuestData(account) {
  const accounts = readAccounts()
  if (accounts.length !== 1) {
    seedSettings(account)
    return
  }
  let copied = false
  for (const name of DATA_NAMES) {
    const raw = readRaw(`scheduly:v1:${name}`)
    if (raw !== null) {
      try {
        window.localStorage.setItem(`scheduly:v1:u:${account.id}:${name}`, raw)
        copied = true
      } catch {
        /* ignore */
      }
    }
  }
  if (!copied) seedSettings(account)
  else {
    try {
      const k = `scheduly:v1:u:${account.id}:settings`
      const s = JSON.parse(readRaw(k) || '{}')
      saveJSON(k, { ...s, displayName: account.name })
    } catch {
      seedSettings(account)
    }
  }
}

function seedSettings(account) {
  saveJSON(`scheduly:v1:u:${account.id}:settings`, { displayName: account.name, tf2: true, timeFormat: '12h' })
}

// ---- session ----
export function loadSession() {
  const read = (store) => {
    try {
      return JSON.parse(store.getItem(SESSION_KEY) || 'null')
    } catch {
      return null
    }
  }
  let s = null
  try {
    s = read(window.sessionStorage) || read(window.localStorage)
  } catch {
    s = null
  }
  if (!s) return null
  if (s.guest) return { guest: true }
  const acc = readAccounts().find((a) => a.id === s.userId)
  return acc ? { user: publicUser(acc) } : null
}

export function saveSession(session, remember) {
  clearSession()
  const value = JSON.stringify(session.guest ? { guest: true } : { userId: session.user.id })
  try {
    ;(remember ? window.localStorage : window.sessionStorage).setItem(SESSION_KEY, value)
  } catch {
    /* ignore: user stays signed in for this page view only */
  }
}

export function clearSession() {
  removeKey(SESSION_KEY)
  try {
    window.sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export const hasAccounts = () => readAccounts().length > 0
