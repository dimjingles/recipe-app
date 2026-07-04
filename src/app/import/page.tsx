'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Link2, Loader2, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import RecipeEditor from '@/components/recipe-editor'
import type { RecipeEditorValues } from '@/components/recipe-editor'
import type { ExtractedRecipe } from '@/types/database'

type ImportState = 'idle' | 'loading' | 'preview' | 'needsText'

/** Extract the first http/https URL from a string (e.g. Android share text). */
function extractFirstUrl(text: string): string {
  const m = text.match(/https?:\/\/[^\s]+/)
  return m ? m[0] : ''
}

function extractedToEditorValues(r: ExtractedRecipe): RecipeEditorValues {
  // Append the source URL to instructions so provenance is preserved
  // (no source_url column in the DB yet — this is the v1 approach).
  const sourceNote = r.source_url ? `\n\nSource: ${r.source_url}` : ''
  return {
    name: r.name,
    description: r.description,
    cuisine: r.cuisine,
    cookTime: r.cook_time_minutes != null ? String(r.cook_time_minutes) : '',
    servings: r.servings != null ? String(r.servings) : '4',
    instructions: (r.instructions ?? '') + sourceNote,
    ingredients: r.ingredients,
    image_url: r.image_url,
    gallery_images: r.gallery_images,
  }
}

export default function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; text?: string; title?: string }>
}) {
  const [url, setUrl] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [importState, setImportState] = useState<ImportState>('idle')
  const [extracted, setExtracted] = useState<ExtractedRecipe | null>(null)
  const [hint, setHint] = useState('')
  // Separate loading flag for the paste-text path so we don't need to
  // transition importState to 'loading' (which would unmount the textarea).
  const [textSubmitting, setTextSubmitting] = useState(false)

  // Resolve shared params from the Android Web Share Target.
  // Android delivers the link in the `text` param (not always `url`),
  // so we try `url` first, then extract the first URL from `text`.
  useEffect(() => {
    searchParams.then(params => {
      const sharedUrl = params.url || extractFirstUrl(params.text || '')
      if (sharedUrl) {
        setUrl(sharedUrl)
        doImport(sharedUrl)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const doImport = async (importUrl: string) => {
    setImportState('loading')
    try {
      const res = await fetch('/api/recipes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim() }),
      })

      if (res.status === 401) {
        // Not logged in — redirect to login, then return here
        const next = encodeURIComponent(window.location.pathname + window.location.search)
        window.location.href = `/login?next=${next}`
        return
      }

      const data = await res.json()

      if (data.needsText) {
        setHint(data.hint || "We couldn't read that page. Paste the recipe text below.")
        setImportState('needsText')
      } else if (data.error) {
        toast.error(data.error)
        setImportState('idle')
      } else {
        setExtracted(data as ExtractedRecipe)
        setImportState('preview')
      }
    } catch {
      toast.error('Import failed. Check the URL and try again.')
      setImportState('idle')
    }
  }

  const handleImportClick = () => {
    if (!url.trim()) return
    doImport(url)
  }

  const handleTextImport = async () => {
    if (!pasteText.trim()) return
    setTextSubmitting(true)
    try {
      const res = await fetch('/api/recipes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      })

      if (res.status === 401) {
        const next = encodeURIComponent(window.location.pathname + window.location.search)
        window.location.href = `/login?next=${next}`
        return
      }

      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        setExtracted(data as ExtractedRecipe)
        setImportState('preview')
      }
    } catch {
      toast.error('Import failed. Please try again.')
    } finally {
      setTextSubmitting(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/recipes" className="text-gray-400 hover:text-gray-600 p-1 -ml-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Import Recipe</h1>
      </div>

      {/* ── Preview state: show the editable recipe form ── */}
      {importState === 'preview' && extracted ? (
        <>
          <div className="mb-5 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
            <span>AI extracted this recipe — double-check the details before saving.</span>
          </div>
          <RecipeEditor initialValues={extractedToEditorValues(extracted)} />
        </>
      ) : importState === 'needsText' ? (

        /* ── Needs-text fallback: paste caption / recipe text ── */
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-sm text-amber-800">{hint}</p>
          </div>
          <Textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder="Paste the recipe caption, description, or full recipe text here…"
            className="h-48 resize-none"
            autoFocus
          />
          <Button
            onClick={handleTextImport}
            disabled={!pasteText.trim() || textSubmitting}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white h-11"
          >
            {textSubmitting
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Extracting…</>
              : 'Extract Recipe'}
          </Button>
          <button
            onClick={() => { setImportState('idle'); setHint('') }}
            className="w-full text-sm text-gray-400 hover:text-gray-600 py-1"
          >
            ← Back
          </button>
        </div>
      ) : (

        /* ── Idle / loading state: URL input ── */
        <div className="space-y-5">
          <p className="text-sm text-gray-500">
            Paste a link to any recipe website, YouTube video, or social media post.
          </p>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://..."
                className="pl-9"
                onKeyDown={e => { if (e.key === 'Enter') handleImportClick() }}
                disabled={importState === 'loading'}
              />
            </div>
            <Button
              onClick={handleImportClick}
              disabled={!url.trim() || importState === 'loading'}
              className="bg-orange-500 hover:bg-orange-600 text-white shrink-0"
            >
              {importState === 'loading'
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : 'Import'}
            </Button>
          </div>

          {importState === 'loading' && (
            <div className="flex items-center justify-center gap-2 py-6 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
              <span className="text-sm">Fetching and extracting recipe…</span>
            </div>
          )}

          {importState === 'idle' && (
            <>
              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-xs text-gray-400">or</span>
                </div>
              </div>

              {/* Platform notes */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setHint("Paste the recipe text, caption, or instructions below.")
                    setImportState('needsText')
                  }}
                  className="w-full text-sm text-gray-500 hover:text-orange-600 py-2 transition-colors"
                >
                  Paste recipe text instead →
                </button>
                <p className="text-xs text-gray-400 text-center">
                  Instagram & TikTok links may need you to paste the caption text instead.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
