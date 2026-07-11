'use client'

import { useEffect, useState } from 'react'
import { Check, ChefHat, Loader2, Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  CHEF_PERSONAS,
  CHEF_SKILL_PREFS,
  CHEF_PACING_OPTIONS,
  type ChefOption,
  type ChefPreferences,
} from '@/lib/cook/chef-preferences'

const VOICE_SAMPLE = "Let's get cooking. Preheat your pan over medium heat while I walk you through the first step."

function OptionGroup<K extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string
  options: ChefOption<K>[]
  value: K
  onChange: (key: K) => void
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      <div className="grid gap-2">
        {options.map(opt => {
          const active = opt.key === value
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              aria-pressed={active}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors',
                active
                  ? 'border-brand bg-brand/5'
                  : 'border-border bg-card hover:bg-muted/50 active:bg-muted',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{opt.label}</span>
                <span className="block text-xs text-muted-foreground">{opt.description}</span>
              </span>
              <span
                className={cn(
                  'grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                  active ? 'border-brand bg-brand text-brand-foreground' : 'border-border',
                )}
              >
                {active && <Check className="h-3.5 w-3.5" />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function ChefPreferencesCard({ initial }: { initial: ChefPreferences }) {
  const [persona, setPersona] = useState(initial.persona)
  const [skillPref, setSkillPref] = useState(initial.skillPref)
  const [pacing, setPacing] = useState(initial.pacing)
  const [voiceURI, setVoiceURI] = useState<string | null>(initial.voiceURI)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<ChefPreferences>(initial)

  // Populate the device's TTS voices. They can load asynchronously, so we also
  // listen for the voiceschanged event.
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const load = () => setVoices(window.speechSynthesis.getVoices())
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  // Stop any preview when leaving the page.
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

  const dirty =
    persona !== saved.persona ||
    skillPref !== saved.skillPref ||
    pacing !== saved.pacing ||
    voiceURI !== saved.voiceURI

  const previewVoice = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Your browser does not support voice preview')
      return
    }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(VOICE_SAMPLE)
    u.rate = 0.95
    const match = voiceURI ? voices.find(v => v.voiceURI === voiceURI) : undefined
    if (match) u.voice = match
    window.speechSynthesis.speak(u)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/profile/chef', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chef_persona: persona,
          chef_skill_pref: skillPref,
          chef_pacing: pacing,
          chef_voice_uri: voiceURI,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setSaved({ persona, skillPref, pacing, voiceURI })
      toast.success('Chef AI preferences saved')
    } catch (e: any) {
      toast.error(e.message || 'Could not save preferences')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mb-8">
      <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <ChefHat className="h-4 w-4" /> Cook with AI
      </h2>
      <div className="space-y-6 rounded-xl border border-border bg-card p-4">
        <OptionGroup title="Persona" options={CHEF_PERSONAS} value={persona} onChange={setPersona} />
        <OptionGroup title="Skill level" options={CHEF_SKILL_PREFS} value={skillPref} onChange={setSkillPref} />
        <OptionGroup title="Pacing" options={CHEF_PACING_OPTIONS} value={pacing} onChange={setPacing} />

        {/* Voice for text-to-audio */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Voice</h3>
          {voices.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No text-to-speech voices are available on this device.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <select
                  value={voiceURI ?? ''}
                  onChange={e => setVoiceURI(e.target.value || null)}
                  className="h-11 flex-1 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand/40"
                >
                  <option value="">Device default</option>
                  {voices.map(v => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={previewVoice}
                  aria-label="Preview voice"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted/50 active:bg-muted"
                >
                  <Volume2 className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Used when you tap the speaker in Cook with AI. Voices are provided by your device, so this
                choice may not carry across phones and browsers.
              </p>
            </>
          )}
        </div>

        <Button
          onClick={save}
          disabled={saving || !dirty}
          className="h-11 w-full rounded-xl bg-brand text-sm font-bold text-brand-foreground hover:bg-brand/90"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : dirty ? 'Save Chef AI preferences' : 'Saved'}
        </Button>
      </div>
    </section>
  )
}
