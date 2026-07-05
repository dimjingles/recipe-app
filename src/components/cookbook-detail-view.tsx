'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, PenLine, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { RecipeCard } from '@/components/recipe-card'
import { CookbookWithRecipes, Recipe } from '@/types/database'

interface CookbookDetailViewProps {
  cookbook: CookbookWithRecipes
}

export default function CookbookDetailView({ cookbook }: CookbookDetailViewProps) {
  const router = useRouter()
  const [name, setName] = useState(cookbook.name)
  const [recipes, setRecipes] = useState<Recipe[]>(
    cookbook.cookbook_recipes.map(cr => cr.recipe)
  )
  const [editing, setEditing] = useState(false)
  const [renameValue, setRenameValue] = useState(cookbook.name)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const commitRename = async () => {
    if (!renameValue.trim() || renameValue.trim() === name) { setEditing(false); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/cookbooks/${cookbook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue.trim() }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setName(renameValue.trim())
      toast.success('Renamed!')
    } catch (e: any) {
      toast.error(e.message || 'Could not rename')
      setRenameValue(name)
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  const deleteCookbook = async () => {
    try {
      const res = await fetch(`/api/cookbooks/${cookbook.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast.success('Cookbook deleted')
      router.push('/cookbooks')
    } catch (e: any) {
      toast.error(e.message || 'Could not delete')
    }
  }

  const removeRecipe = async (recipeId: string) => {
    setRemovingId(recipeId)
    // Optimistic update
    setRecipes(prev => prev.filter(r => r.id !== recipeId))
    try {
      const res = await fetch(`/api/cookbooks/${cookbook.id}/recipes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe_id: recipeId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
    } catch (e: any) {
      // Revert
      setRecipes(cookbook.cookbook_recipes.map(cr => cr.recipe))
      toast.error(e.message || 'Could not remove recipe')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <Link
          href="/cookbooks"
          className="text-muted-foreground hover:text-foreground p-1 -ml-1 mt-0.5 active:scale-[0.95] transition-all shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className="flex-1 min-w-0">
          {editing ? (
            <Input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              autoFocus
              className="font-heading text-2xl font-bold h-auto py-0 border-0 border-b border-brand rounded-none px-0 focus-visible:ring-0 bg-transparent"
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') { setEditing(false); setRenameValue(name) }
              }}
              onBlur={commitRename}
            />
          ) : (
            <h1 className="font-heading text-2xl font-bold text-foreground leading-tight">{name}</h1>
          )}
          <p className="text-sm text-muted-foreground mt-0.5">
            {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
          </p>
        </div>

        <div className="flex gap-1 shrink-0 mt-0.5">
          <button
            onClick={() => { setShowDeleteConfirm(false); setEditing(true); setRenameValue(name) }}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Rename cookbook"
          >
            <PenLine className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setEditing(false); setShowDeleteConfirm(s => !s) }}
            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Delete cookbook"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-destructive">Delete this cookbook? Recipes won&apos;t be affected.</p>
          <div className="flex gap-3 shrink-0">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={deleteCookbook}
              className="text-sm font-semibold text-destructive hover:text-destructive/80"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Recipe list */}
      {recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-heading text-lg font-semibold text-foreground mb-1">No recipes yet</p>
          <p className="text-sm text-muted-foreground">
            Open a recipe and use &quot;Add to Cookbook&quot; to add it here.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {recipes.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              variant="list"
              onClick={() => router.push(`/recipes/${recipe.id}`)}
              action={
                <button
                  onClick={e => { e.stopPropagation(); removeRecipe(recipe.id) }}
                  disabled={removingId === recipe.id}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                  aria-label="Remove from cookbook"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
