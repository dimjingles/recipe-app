'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, ChevronLeft, ChevronRight, Timer, Plus, Check,
  Mic, Volume2, ListChecks, ChefHat, Send, Loader2, Play,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { splitStepsFromText } from '@/lib/instructions'
import { detectDurations, formatClock } from '@/lib/cook/durations'
import { useWakeLock } from '@/lib/cook/use-wake-lock'
import { useVoiceControl, type VoiceCommand } from '@/lib/cook/use-voice-control'
import { useCookTimers } from '@/lib/cook/use-cook-timers'
import type { RecipeWithDetails, InstructionStep } from '@/types/database'

const MANUAL_PRESETS = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60] // minutes

type Stage = 'welcome' | 'cooking' | 'finish'
type Role = 'user' | 'assistant'
// `hidden` control turns steer the chef (welcome / "present step N") but are
// never rendered in the transcript — the user only sees the chef's replies and
// their own typed questions.
interface Msg { role: Role; content: string; hidden?: boolean }

const WELCOME_PROMPT =
  'Welcome me to cooking this recipe. Give a warm 2-3 sentence overview of the dish — what we are making and the general vibe — without listing any steps. End by asking if I am ready to begin.'

const presentStepPrompt = (n: number, text: string) =>
  `I'm ready. Please walk me through Step ${n} now: "${text}". Narrate exactly this step in a warm, spoken style. If it has cooking jargon or a vague doneness cue, explain it briefly. Then stop and wait — do not give me the next step yet.`

export default function CookMode({ recipe }: { recipe: RecipeWithDetails }) {
  const router = useRouter()

  const steps: InstructionStep[] = useMemo(() => {
    const structured = recipe.instruction_steps
    if (structured && structured.length > 0) return structured
    return splitStepsFromText(recipe.instructions)
  }, [recipe.instruction_steps, recipe.instructions])
  const total = steps.length

  const [stage, setStage] = useState<Stage>('welcome')
  const [stepIndex, setStepIndex] = useState(0)

  // Chef conversation. We mirror it in a ref so button/voice handlers can read
  // the live transcript without waiting for a state flush.
  const [messages, setMessagesState] = useState<Msg[]>([])
  const messagesRef = useRef<Msg[]>([])
  const setMessages = (updater: Msg[] | ((prev: Msg[]) => Msg[])) =>
    setMessagesState(prev => {
      const next = typeof updater === 'function' ? (updater as (p: Msg[]) => Msg[])(prev) : updater
      messagesRef.current = next
      return next
    })
  const [streaming, setStreaming] = useState(false)
  const [waitingFirstChunk, setWaitingFirstChunk] = useState(false)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [showIngredients, setShowIngredients] = useState(false)
  const [showManualTimer, setShowManualTimer] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const { timers, startTimer, toggleTimer, dismissTimer } = useCookTimers()

  const currentStep = stage === 'cooking' ? steps[stepIndex] : null
  const currentDurations = useMemo(
    () => (currentStep ? detectDurations(currentStep.text) : []),
    [currentStep],
  )

  // Keep the screen awake for the whole session (best-effort).
  useWakeLock(true)

  const exit = () => router.push(`/recipes/${recipe.id}`)

  // ── Chef streaming ────────────────────────────────────────────────────────
  async function runTurn(userMsg: Msg, fallback?: string) {
    const next = [...messagesRef.current, userMsg]
    setMessages([...next, { role: 'assistant', content: '' }])
    setStreaming(true)
    setWaitingFirstChunk(true)
    try {
      const res = await fetch(`/api/recipes/${recipe.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) }),
      })
      if (!res.ok || !res.body) throw new Error('Chef AI unavailable')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() || ''
        for (const chunk of chunks) {
          const line = chunk.split('\n').find(l => l.startsWith('data: '))
          if (!line) continue
          const data = line.slice(6)
          if (data === '[DONE]') { setStreaming(false); setWaitingFirstChunk(false); return }
          const parsed = JSON.parse(data)
          setWaitingFirstChunk(false)
          setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: m.content + parsed.text } : m))
        }
      }
    } catch {
      // Fall back to the canonical step text so the user can still cook offline.
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1
          ? { ...m, content: m.content || fallback || 'Chef AI is unavailable right now — carry on with the step shown and I will try to reconnect.' }
          : m,
      ))
    } finally {
      setStreaming(false)
      setWaitingFirstChunk(false)
    }
  }

  const presentStep = (i: number) => runTurn(
    { role: 'user', content: presentStepPrompt(steps[i].n, steps[i].text), hidden: true },
    `Step ${steps[i].n}. ${steps[i].text}`,
  )

  // Kick off the welcome once on mount.
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current || total === 0) return
    startedRef.current = true
    runTurn({ role: 'user', content: WELCOME_PROMPT, hidden: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scroll the transcript.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streaming])

  // ── Navigation ────────────────────────────────────────────────────────────
  const goNext = () => {
    if (streaming) return
    if (stage === 'welcome') {
      setStage('cooking')
      setStepIndex(0)
      presentStep(0)
    } else if (stage === 'cooking') {
      if (stepIndex >= total - 1) {
        setStage('finish')
      } else {
        const n = stepIndex + 1
        setStepIndex(n)
        presentStep(n)
      }
    }
  }

  const goBack = () => {
    if (streaming) return
    if (stage === 'cooking' && stepIndex > 0) {
      const n = stepIndex - 1
      setStepIndex(n)
      presentStep(n)
    }
  }

  const ask = (raw: string) => {
    const text = raw.trim()
    if (!text || streaming) return
    setInput('')
    runTurn({ role: 'user', content: text })
  }

  // ── Text-to-speech (reads the chef's latest message) ──────────────────────
  const speakLatest = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const last = [...messagesRef.current].reverse().find(m => m.role === 'assistant' && m.content.trim())
    if (!last) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(last.content)
    u.rate = 0.95
    window.speechSynthesis.speak(u)
  }

  const startFirstTimer = () => {
    if (currentDurations.length > 0) {
      const d = currentDurations[0]
      startTimer(d.ms, d.label)
      toast.success(`Timer started — ${d.label}`)
    } else {
      setShowManualTimer(true)
    }
  }

  // ── Voice commands ────────────────────────────────────────────────────────
  const handleCommand = (cmd: VoiceCommand) => {
    if (cmd === 'next') goNext()
    else if (cmd === 'back') goBack()
    else if (cmd === 'repeat') speakLatest()
    else if (cmd === 'timer') startFirstTimer()
  }
  const voice = useVoiceControl(handleCommand)

  // ── Keyboard shortcuts (desktop testing / attached keyboards) ─────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goBack()
      else if (e.key === 'Escape') exit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, stepIndex, streaming, total])

  // Stop any spoken message when leaving cook mode.
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

  const markCooked = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/recipes/${recipe.id}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() || undefined }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Cooking logged! 🎉')
      router.push(`/recipes/${recipe.id}`)
      router.refresh()
    } catch {
      toast.error('Could not save log')
      setSaving(false)
    }
  }

  const toggleChecked = (id: string) =>
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const ingredients = recipe.ingredients ?? []
  const checkedCount = ingredients.filter(i => checked.has(i.id)).length

  // ── Empty / no-instructions guard ─────────────────────────────────────────
  if (total === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-medium">This recipe has no instructions to guide yet.</p>
        <Button onClick={exit} className="bg-brand text-brand-foreground">Back to recipe</Button>
      </div>
    )
  }

  const progress =
    stage === 'welcome' ? 0 : stage === 'finish' ? 100 : Math.round(((stepIndex + 1) / total) * 100)
  const stageLabel =
    stage === 'welcome' ? 'Getting ready' : stage === 'finish' ? 'Complete' : `Step ${stepIndex + 1} of ${total}`

  const visible = messages.filter(m => !m.hidden)

  return (
    <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={exit}
            aria-label="Exit cook mode"
            className="p-2 -ml-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all"
          >
            <X className="w-6 h-6" />
          </button>

          <p className="text-sm font-semibold text-muted-foreground truncate">
            {recipe.name}
          </p>

          <div className="flex items-center gap-1">
            <button
              onClick={speakLatest}
              aria-label="Read the chef's message aloud"
              className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all"
            >
              <Volume2 className="w-5 h-5" />
            </button>
            {voice.supported && (
              <button
                onClick={voice.toggle}
                aria-label={voice.listening ? 'Stop voice control' : 'Start voice control'}
                aria-pressed={voice.listening}
                className={`p-2 rounded-full active:scale-95 transition-all ${
                  voice.listening
                    ? 'bg-brand text-brand-foreground animate-pulse'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setShowIngredients(true)}
              aria-label="Ingredients"
              className="relative p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all"
            >
              <ListChecks className="w-5 h-5" />
              {checkedCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-sage text-sage-foreground text-[10px] font-bold flex items-center justify-center">
                  {checkedCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Progress bar + label */}
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-brand rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs font-medium text-muted-foreground text-center">
            {stageLabel}
          </p>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      {stage === 'finish' ? (
        <FinishScreen
          notes={notes}
          setNotes={setNotes}
          saving={saving}
          onCook={markCooked}
          onBack={() => { setStage('cooking'); setStepIndex(total - 1) }}
          onExit={exit}
        />
      ) : (
        <>
          {/* Chef transcript */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {visible.map((message, index) => {
              const isLast = index === visible.length - 1
              return (
                <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'assistant' && (
                    <span className="w-8 h-8 mr-2 shrink-0 rounded-full bg-cooking-subtle text-cooking flex items-center justify-center self-end">
                      <ChefHat className="w-4 h-4" />
                    </span>
                  )}
                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-2.5 whitespace-pre-wrap ${
                      message.role === 'user'
                        ? 'bg-brand text-brand-foreground text-sm'
                        : 'bg-card border border-border text-foreground text-base leading-relaxed'
                    }`}
                  >
                    {message.content || (waitingFirstChunk && isLast
                      ? <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> chef is thinking…</span>
                      : '')}
                  </div>
                </div>
              )
            })}

            {/* Detected-duration timer buttons for the current step */}
            {stage === 'cooking' && currentDurations.length > 0 && (
              <div className="flex flex-wrap gap-2 pl-10">
                {currentDurations.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      startTimer(d.ms, d.label)
                      toast.success(`Timer started — ${d.label}`)
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-cooking-subtle text-cooking border border-cooking/30 px-4 py-2 text-sm font-semibold active:scale-95 transition-all"
                  >
                    <Timer className="w-4 h-4" /> Start {d.label} timer
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Active timers tray ──────────────────────────────────────── */}
          <TimerTray
            timers={timers}
            onToggle={toggleTimer}
            onDismiss={dismissTimer}
            onAdd={() => setShowManualTimer(true)}
          />

          {/* ── Ask the chef ────────────────────────────────────────────── */}
          <div className="shrink-0 px-4 pt-2 flex gap-2">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input) } }}
              placeholder="Ask the chef anything…"
              className="min-h-11 max-h-28 resize-none bg-card"
              disabled={streaming}
            />
            <Button
              onClick={() => ask(input)}
              disabled={streaming || !input.trim()}
              aria-label="Send question"
              className="self-end h-11 px-3 bg-cooking hover:bg-cooking/90 text-cooking-foreground"
            >
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>

          {/* ── Footer nav ──────────────────────────────────────────────── */}
          <div className="shrink-0 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-3">
            {stage === 'welcome' ? (
              <Button
                onClick={goNext}
                disabled={streaming}
                className="flex-1 h-14 rounded-2xl text-base font-semibold bg-brand text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
              >
                <Play className="w-5 h-5" /> I&apos;m ready — let&apos;s cook
              </Button>
            ) : (
              <>
                <Button
                  onClick={goBack}
                  disabled={stepIndex === 0 || streaming}
                  variant="outline"
                  className="flex-1 h-14 rounded-2xl text-base font-semibold disabled:opacity-40"
                >
                  <ChevronLeft className="w-5 h-5" /> Back
                </Button>
                <Button
                  onClick={goNext}
                  disabled={streaming}
                  className="flex-[2] h-14 rounded-2xl text-base font-semibold bg-brand text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
                >
                  {stepIndex === total - 1 ? 'Finish' : 'Next'}
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Ingredients sheet ─────────────────────────────────────────────── */}
      {showIngredients && (
        <BottomSheet open onClose={() => setShowIngredients(false)} zIndex="elevated" maxHeight="75vh">
          <div className="px-6 pb-10">
            <h3 className="font-heading text-lg font-bold text-foreground mb-1">Ingredients</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Tap to check off as you prep · {checkedCount}/{ingredients.length}
            </p>
            {ingredients.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No ingredients listed.</p>
            ) : (
              <ul className="space-y-1">
                {ingredients.map(ing => {
                  const isChecked = checked.has(ing.id)
                  return (
                    <li key={ing.id}>
                      <button
                        onClick={() => toggleChecked(ing.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                          isChecked ? 'bg-sage-subtle' : 'hover:bg-muted'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isChecked ? 'bg-sage border-sage' : 'border-border'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 text-sage-foreground" />}
                        </span>
                        <span className={`flex-1 text-sm ${isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {ing.name}
                        </span>
                        {(ing.quantity || ing.unit) && (
                          <span className="text-sm text-muted-foreground font-medium shrink-0">
                            {ing.quantity} {ing.unit}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </BottomSheet>
      )}

      {/* ── Manual timer sheet ────────────────────────────────────────────── */}
      {showManualTimer && (
        <ManualTimerSheet
          onClose={() => setShowManualTimer(false)}
          onStart={(ms, label) => {
            startTimer(ms, label)
            toast.success(`Timer started — ${label}`)
            setShowManualTimer(false)
          }}
        />
      )}
    </div>
  )
}

// ── Active timer tray ───────────────────────────────────────────────────────

function TimerTray({
  timers,
  onToggle,
  onDismiss,
  onAdd,
}: {
  timers: ReturnType<typeof useCookTimers>['timers']
  onToggle: (id: string) => void
  onDismiss: (id: string) => void
  onAdd: () => void
}) {
  return (
    <div className="shrink-0 px-4 py-2 flex items-center gap-2 overflow-x-auto border-t border-border">
      <button
        onClick={onAdd}
        aria-label="Add timer"
        className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground active:scale-95 transition-all"
      >
        <Plus className="w-4 h-4" /> Timer
      </button>
      {timers.map(t => {
        const done = t.remainingMs === 0
        return (
          <div
            key={t.id}
            className={`shrink-0 inline-flex items-center gap-2 rounded-full pl-3 pr-1.5 py-1 border ${
              done
                ? 'bg-brand-subtle border-brand/40 text-brand'
                : 'bg-cooking-subtle border-cooking/30 text-cooking'
            }`}
          >
            <button
              onClick={() => onToggle(t.id)}
              className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-sm"
              aria-label={t.running ? `Pause ${t.label} timer` : `Resume ${t.label} timer`}
            >
              <Timer className={`w-4 h-4 ${t.running ? 'animate-pulse' : ''}`} />
              {done ? `${t.label} done` : formatClock(t.remainingMs)}
            </button>
            <button
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss timer"
              className="p-1 rounded-full hover:bg-black/5 active:scale-90 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Manual timer sheet ──────────────────────────────────────────────────────

function ManualTimerSheet({
  onClose,
  onStart,
}: {
  onClose: () => void
  onStart: (ms: number, label: string) => void
}) {
  const [custom, setCustom] = useState('')

  const startCustom = () => {
    const mins = parseFloat(custom)
    if (!Number.isFinite(mins) || mins <= 0) return
    onStart(Math.round(mins * 60_000), `${mins} min`)
  }

  return (
    <BottomSheet open onClose={onClose} zIndex="elevated">
      <div className="px-6 pb-10">
        <h3 className="font-heading text-lg font-bold text-foreground mb-4">Set a timer</h3>
        <div className="grid grid-cols-5 gap-2 mb-5">
          {MANUAL_PRESETS.map(m => (
            <button
              key={m}
              onClick={() => onStart(m * 60_000, `${m} min`)}
              className="h-14 rounded-xl bg-cooking-subtle text-cooking border border-cooking/20 font-semibold text-sm active:scale-95 transition-all"
            >
              {m}m
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') startCustom() }}
            placeholder="Custom minutes"
            className="flex-1 border border-border rounded-xl px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-brand/50"
          />
          <Button
            onClick={startCustom}
            disabled={!custom.trim()}
            className="h-auto px-4 bg-brand text-brand-foreground hover:bg-brand/90"
          >
            Start
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}

// ── Finish / mark-as-cooked screen ──────────────────────────────────────────

function FinishScreen({
  notes,
  setNotes,
  saving,
  onCook,
  onBack,
  onExit,
}: {
  notes: string
  setNotes: (v: string) => void
  saving: boolean
  onCook: () => void
  onBack: () => void
  onExit: () => void
}) {
  return (
    <div className="flex-1 overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="max-w-lg mx-auto w-full py-6 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="font-heading text-2xl font-bold text-foreground mb-2">Nicely done!</h2>
        <p className="text-muted-foreground text-sm mb-6">
          You cooked every step. Log it to keep your cooking history up to date.
        </p>

        <div className="text-left mb-4">
          <label className="text-sm font-medium text-foreground mb-2 block">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="How did it turn out? Any tweaks?"
            className="w-full border border-border rounded-xl p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-brand/50 bg-card"
          />
        </div>

        <Button
          onClick={onCook}
          disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-brand text-brand-foreground hover:bg-brand/90"
        >
          {saving ? 'Saving…' : '🍳 Mark as Cooked'}
        </Button>
        <div className="flex gap-3 mt-3">
          <Button onClick={onBack} variant="outline" className="flex-1 h-12 rounded-2xl">
            <ChevronLeft className="w-4 h-4" /> Back to steps
          </Button>
          <Button onClick={onExit} variant="ghost" className="flex-1 h-12 rounded-2xl text-muted-foreground">
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  )
}
