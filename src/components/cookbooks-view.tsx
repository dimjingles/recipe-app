'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, PenLine, Trash2, BookOpen, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CookbookWithCount, RecipeWithIngredients } from '@/types/database'

interface CookbooksViewProps {
  initialCookbooks: CookbookWithCount[]
  initialRecipes: RecipeWithIngredients[]
}

export default function CookbooksView({ initialCookbooks, initialRecipes }: CookbooksViewProps) {
  const router = useRouter()
  const [cookbooks, setCookbooks] = useState(initialCookbooks)

  // Create sheet
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedRecipes, setSelectedRecipes] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  // Rename
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const toggleRecipe = (id: string) =>
    setSelectedRecipes(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id])

  const createCookbook = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/cookbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), recipe_ids: selectedRecipes }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast.success(`"${newName.trim()}" created!`)
      setCookbooks(prev => [...prev, { ...data, cookbook_recipes: selectedRecipes.map(id => ({ recipe_id: id })) }])
      setShowCreate(false)
      setNewName('')
      setSelectedRecipes([])
    } catch (e: any) {
      toast.error(e.message || 'Could not create cookbook')
    } finally {
      setCreating(false)
    }
  }

  const startRename = (id: string, name: string) => {
    setDeletingId(null)
    setRenamingId(id)
    setRenameValue(name)
  }

  const commitRename = async (id: string) => {
    if (!renameValue.trim()) { setRenamingId(null); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/cookbooks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue.trim() }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCookbooks(prev => prev.map(c => c.id === id ? { ...c, name: renameValue.trim() } : c))
      toast.success('Renamed!')
    } catch (e: any) {
      toast.error(e.message || 'Could not rename')
    } finally {
      setSaving(false)
      setRenamingId(null)
    }
  }

  const deleteCookbook = async (id: string) => {
    try {
      const res = await fetch(`/api/cookbooks/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCookbooks(prev => prev.filter(c => c.id !== id))
      setDeletingId(null)
      toast.success('Cookbook deleted')
    } catch (e: any) {
      toast.error(e.message || 'Could not delete')
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/recipes"
            className="text-muted-foreground hover:text-foreground p-1 -ml-1 active:scale-[0.95] transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-heading text-2xl font-bold text-foreground">Cookbooks</h1>
        </div>
        <button
          onClick={() => { setShowCreate(true) }}
          className="bg-brand text-brand-foreground rounded-full p-2.5 hover:bg-brand/90 active:scale-[0.95] transition-all shadow-md"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* List */}
      {cookbooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="font-heading text-lg font-semibold text-foreground mb-1">No cookbooks yet</p>
          <p className="text-sm text-muted-foreground mb-6">Create your first to group your favourite recipes.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 bg-brand text-brand-foreground rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-brand/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Cookbook
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {cookbooks.map(cb => (
            <div
              key={cb.id}
              className="bg-card rounded-2xl border border-border shadow-sm px-4 py-3"
            >
              {deletingId === cb.id ? (
                /* Delete confirm row */
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-destructive font-medium">Delete &quot;{cb.name}&quot;?</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeletingId(null)}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => deleteCookbook(cb.id)}
                      className="text-sm font-semibold text-destructive hover:text-destructive/80"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : renamingId === cb.id ? (
                /* Rename row */
                <div className="flex items-center gap-2">
                  <Input
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    autoFocus
                    className="flex-1 h-9 bg-card"
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename(cb.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    onBlur={() => commitRename(cb.id)}
                  />
                  <button
                    onClick={() => commitRename(cb.id)}
                    disabled={saving}
                    className="text-sm font-medium text-brand disabled:opacity-50"
                  >
                    {saving ? '...' : 'Save'}
                  </button>
                </div>
              ) : (
                /* Normal row */
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.push(`/cookbooks/${cb.id}`)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="font-semibold text-foreground truncate">{cb.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {cb.cookbook_recipes.length} {cb.cookbook_recipes.length === 1 ? 'recipe' : 'recipes'}
                    </p>
                  </button>
                  <button
                    onClick={() => startRename(cb.id, cb.name)}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    aria-label="Rename"
                  >
                    <PenLine className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setRenamingId(null); setDeletingId(cb.id) }}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Cookbook Sheet */}
      <BottomSheet open={showCreate} onClose={() => { setShowCreate(false); setNewName(''); setSelectedRecipes([]) }} maxHeight="85vh">
        <div className="px-6 pb-8">
          <h3 className="font-heading text-lg font-bold text-foreground mb-4">New Cookbook</h3>

          <div className="mb-4">
            <p className="text-sm font-medium text-foreground mb-2">Name</p>
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Quick Weeknight Dinners"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && createCookbook()}
              className="bg-card"
            />
          </div>

          {initialRecipes.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-medium text-foreground mb-2">
                Add recipes <span className="text-muted-foreground font-normal">(optional)</span>
              </p>
              <div className="space-y-1 max-h-56 overflow-y-auto -mx-1 px-1">
                {initialRecipes.map(r => (
                  <button
                    key={r.id}
                    onClick={() => toggleRecipe(r.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      selectedRecipes.includes(r.id)
                        ? 'bg-brand-subtle text-brand'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      selectedRecipes.includes(r.id) ? 'bg-brand border-brand' : 'border-border'
                    }`}>
                      {selectedRecipes.includes(r.id) && (
                        <span className="text-brand-foreground text-[10px] font-bold">✓</span>
                      )}
                    </span>
                    <span className="flex-1 text-left truncate">{r.name}</span>
                    {r.cuisine && (
                      <span className="text-xs text-muted-foreground capitalize shrink-0">{r.cuisine}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={createCookbook}
            disabled={creating || !newName.trim()}
            className="w-full bg-brand hover:bg-brand/90 text-brand-foreground h-12 text-base"
          >
            {creating ? 'Creating...' : 'Create Cookbook'}
          </Button>
        </div>
      </BottomSheet>
    </div>
  )
}
