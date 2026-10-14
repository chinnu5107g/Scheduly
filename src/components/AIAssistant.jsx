import { useEffect, useId, useRef, useState } from 'react'
import { Bot, RotateCcw, SendHorizontal, Sparkles, User } from 'lucide-react'
import { Notice } from './ui.jsx'
import { QUICK_PROMPTS, assistantClient } from '../utils/assistant.js'

/**
 * Scheduly AI chat panel (demo). All logic lives in utils/assistant.js; this component only
 * renders the conversation and forwards effects to the app. Swap `assistantClient` for a
 * server-backed client later (keys stay on the server).
 */
export default function AIAssistant({
  session,
  onSession,
  onReset,
  timetables,
  constraints,
  resources,
  targetId,
  onTarget,
  onApplyEffects,
  onOpenTimetable,
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)
  const inputId = useId()
  const targetSelId = useId()
  const sessionRef = useRef(session)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' })
  }, [session.messages.length, busy])

  const send = async (value) => {
    const input = String(value ?? text).trim()
    if (!input || busy) return
    setText('')
    setBusy(true)
    try {
      const result = await assistantClient.send(sessionRef.current, input, {
        timetables,
        constraints,
        resources,
        now: Date.now(),
      })
      onSession(result.session)
      if (result.effects?.length) onApplyEffects(result.effects, result.session)
    } catch {
      onSession({
        ...sessionRef.current,
        messages: [
          ...sessionRef.current.messages,
          { id: `err-${Date.now()}`, role: 'assistant', text: 'Sorry, something went wrong handling that. Your timetables were not changed.' },
        ],
      })
    } finally {
      setBusy(false)
    }
  }

  const choose = (option) => {
    if (option.action?.type === 'open') onOpenTimetable(option.action.id)
    else send(option.value ?? option.label)
  }

  const lastAssistantIndex = (() => {
    for (let i = session.messages.length - 1; i >= 0; i--) if (session.messages[i].role === 'assistant') return i
    return -1
  })()

  return (
    <section className="card chat" aria-label="Scheduly AI assistant">
      <header className="chat-head">
        <span className="chat-avatar">
          <Sparkles size={18} aria-hidden="true" />
        </span>
        <div>
          <h2>Scheduly AI</h2>
          <p className="muted">Demo assistant · guided setup and basic commands</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm chat-reset" onClick={onReset}>
          <RotateCcw size={15} aria-hidden="true" /> New chat
        </button>
      </header>

      <div className="chat-target">
        <label htmlFor={targetSelId}>Edit commands apply to</label>
        <select id={targetSelId} className="input" value={targetId || ''} onChange={(e) => onTarget(e.target.value || null)}>
          <option value="">No timetable selected</option>
          {timetables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="chat-log" role="log" aria-live="polite" aria-label="Conversation">
        {session.messages.map((m, i) => (
          <div key={m.id} className={`msg msg-${m.role}`}>
            <span className="msg-avatar" aria-hidden="true">
              {m.role === 'user' ? <User size={15} /> : <Bot size={15} />}
            </span>
            <div className="msg-body">
              <p>{m.text}</p>
              {m.options && i === lastAssistantIndex ? (
                <div className="chips" role="group" aria-label="Suggested replies">
                  {m.options.map((o) => (
                    <button key={o.label} type="button" className="chip" disabled={busy} onClick={() => choose(o)}>
                      {o.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {busy ? (
          <div className="msg msg-assistant">
            <span className="msg-avatar" aria-hidden="true">
              <Bot size={15} />
            </span>
            <div className="msg-body typing" aria-label="Scheduly AI is typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <div className="quick-prompts" role="group" aria-label="Quick actions">
        {QUICK_PROMPTS.map((p) => (
          <button key={p} type="button" className="chip chip-quick" disabled={busy} onClick={() => send(p)}>
            {p}
          </button>
        ))}
      </div>

      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Message Scheduly AI
        </label>
        <input
          id={inputId}
          className="input"
          value={text}
          maxLength={400}
          placeholder="Answer, or type a command like “Add a lunch break”"
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
          <SendHorizontal size={16} aria-hidden="true" /> Send
        </button>
      </form>

      <Notice tone="info">
        This is a rule-based demo, not an AI model. Nothing is sent to a server. Slots it fills in have no teachers, so add teachers to get clash checking.
      </Notice>
    </section>
  )
}
