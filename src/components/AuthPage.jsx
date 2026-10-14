import { useId, useRef, useState } from 'react'
import { CalendarCheck, Check, Eye, EyeOff, ShieldAlert, Sparkles, Users } from 'lucide-react'
import Logo from './Logo.jsx'
import { passwordChecks, signIn, signUp, validateSignUp } from '../utils/auth.js'

function PasswordField({ id, label, value, onChange, error, autoComplete, describedBy, hint }) {
  const [show, setShow] = useState(false)
  const errId = `${id}-err`
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw-wrap">
        <input
          id={id}
          className="input"
          type={show ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={[error ? errId : null, describedBy].filter(Boolean).join(' ') || undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
          {show ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        </button>
      </div>
      {hint}
      {error ? (
        <span id={errId} className="field-error">
          {error}
        </span>
      ) : null}
    </div>
  )
}

/** Sign in / create account screen. Calls onAuthed(session, remember) on success. */
export default function AuthPage({ initialMode = 'signin', hasAccounts, onAuthed }) {
  const [mode, setMode] = useState(hasAccounts ? initialMode : 'signup')
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const uid = useId()
  const formRef = useRef(null)
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const isUp = mode === 'signup'

  const switchMode = (m) => {
    setMode(m)
    setErrors({})
    setFormError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setFormError('')
    if (isUp) {
      const errs = validateSignUp(form)
      setErrors(errs)
      if (Object.keys(errs).length) {
        formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
        return
      }
    } else {
      const errs = {}
      if (!form.email.trim()) errs.email = 'Enter your email.'
      if (!form.password) errs.password = 'Enter your password.'
      setErrors(errs)
      if (Object.keys(errs).length) {
        formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
        return
      }
    }
    setBusy(true)
    try {
      const res = isUp ? await signUp(form) : await signIn(form)
      if (!res.ok) {
        setErrors(res.errors || {})
        setFormError(res.error || '')
        return
      }
      onAuthed({ user: res.user }, remember)
    } catch {
      setFormError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const checks = passwordChecks(form.password)

  return (
    <div className="auth">
      <aside className="auth-side" aria-hidden="false">
        <div className="auth-brand">
          <Logo size={40} />
          <span>Scheduly</span>
        </div>
        <h1>Timetables that build themselves.</h1>
        <p>Pick your subjects, durations and teachers — Scheduly lays out the week and keeps teachers from being double-booked.</p>
        <ul className="auth-points">
          <li>
            <CalendarCheck size={18} aria-hidden="true" /> Automatic weekly timetable from your subjects
          </li>
          <li>
            <Users size={18} aria-hidden="true" /> Teacher and room clash checks across timetables
          </li>
          <li>
            <Sparkles size={18} aria-hidden="true" /> Demo assistant for quick edits
          </li>
        </ul>
      </aside>

      <main className="auth-main" id="main">
        <div className="auth-card card">
          <div className="auth-brand auth-brand-sm">
            <Logo size={32} />
            <span>Scheduly</span>
          </div>
          <div className="auth-tabs" role="tablist" aria-label="Account">
            <button type="button" role="tab" id={`${uid}-t-in`} aria-selected={!isUp} aria-controls={`${uid}-panel`} className={!isUp ? 'is-active' : ''} onClick={() => switchMode('signin')}>
              Sign in
            </button>
            <button type="button" role="tab" id={`${uid}-t-up`} aria-selected={isUp} aria-controls={`${uid}-panel`} className={isUp ? 'is-active' : ''} onClick={() => switchMode('signup')}>
              Create account
            </button>
          </div>

          <form id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-t-${isUp ? 'up' : 'in'}`} ref={formRef} onSubmit={submit} noValidate className="auth-form">
            <h2>{isUp ? 'Create your account' : 'Welcome back'}</h2>
            <p className="muted">{isUp ? 'It takes a few seconds.' : 'Sign in to open your timetables.'}</p>

            {formError ? (
              <div className="notice notice-danger" role="alert">
                <ShieldAlert size={17} aria-hidden="true" /> {formError}
              </div>
            ) : null}

            {isUp ? (
              <div className="field">
                <label htmlFor={`${uid}-name`}>Full name</label>
                <input id={`${uid}-name`} className="input" value={form.name} maxLength={40} autoComplete="name" aria-invalid={errors.name ? 'true' : undefined} aria-describedby={errors.name ? `${uid}-name-err` : undefined} onChange={(e) => set('name')(e.target.value)} />
                {errors.name ? (
                  <span id={`${uid}-name-err`} className="field-error">
                    {errors.name}
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="field">
              <label htmlFor={`${uid}-email`}>Email</label>
              <input id={`${uid}-email`} className="input" type="email" inputMode="email" value={form.email} autoComplete={isUp ? 'email' : 'username'} aria-invalid={errors.email ? 'true' : undefined} aria-describedby={errors.email ? `${uid}-email-err` : undefined} onChange={(e) => set('email')(e.target.value)} />
              {errors.email ? (
                <span id={`${uid}-email-err`} className="field-error">
                  {errors.email}
                </span>
              ) : null}
            </div>

            <PasswordField
              id={`${uid}-pw`}
              label="Password"
              value={form.password}
              onChange={set('password')}
              error={errors.password}
              autoComplete={isUp ? 'new-password' : 'current-password'}
              describedBy={isUp ? `${uid}-rules` : undefined}
              hint={
                isUp ? (
                  <ul className="pw-rules" id={`${uid}-rules`} aria-label="Password rules">
                    {checks.map((c) => (
                      <li key={c.label} className={c.ok ? 'ok' : ''}>
                        <Check size={13} aria-hidden="true" /> {c.label}
                        <span className="sr-only">{c.ok ? ' (met)' : ' (not met)'}</span>
                      </li>
                    ))}
                  </ul>
                ) : null
              }
            />

            {isUp ? <PasswordField id={`${uid}-pw2`} label="Confirm password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} autoComplete="new-password" /> : null}

            <label className="check-row">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep me signed in on this browser
            </label>

            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Please wait…' : isUp ? 'Create account' : 'Sign in'}
            </button>

            <p className="auth-switch">
              {isUp ? 'Already have an account?' : 'New to Scheduly?'}{' '}
              <button type="button" className="link-btn" onClick={() => switchMode(isUp ? 'signin' : 'signup')}>
                {isUp ? 'Sign in' : 'Create an account'}
              </button>
            </p>
          </form>

          <div className="auth-or" aria-hidden="true">
            <span>or</span>
          </div>
          <button type="button" className="btn btn-soft btn-block" onClick={() => onAuthed({ guest: true }, remember)}>
            Continue as guest
          </button>

          <p className="auth-note">
            Demo accounts are stored only in this browser — there is no server, no email and no password recovery. If you clear this browser’s data, accounts and timetables are lost. Don’t reuse a password from another site.
          </p>
        </div>
      </main>
    </div>
  )
}
