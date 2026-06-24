'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, Users, Edit, Trash2, ChefHat, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { RecipeWithDetails } from '@/types/database'

const CATEGORY_EMOJI: Record<string, string> = {
  produce: '🥦', dairy: '🧀', meat: '🥩', seafood: '🐟',
  pantry: '🫙', spices: '🌿', bakery: '🍞', frozen: '🧊', other: '📦',
}

const CATEGORY_ORDER = ['produce', 'meat', 'seafood', 'dairy', 'bakery', 'pantry', 'spices', 'frozen', 'other']

function groupIngredients(ingredients: RecipeWithDetails['ingredients']) {
  const groups: Record<string, typeof ingredients> = {}
  for (const ing of ingredients) {
    const cat = ing.category || 'other'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(ing)
  }
  return CATEGORY_ORDER.filter(c => groups[c]).map(c => ({ category: c, items: groups[c] }))
}

interface CookDialogProps {
  recipeId: string
  onClose: () => void
  onSaved: () => void
}

function CookDialog({ recipeId, onClose, onSaved }: CookDialogProps) {
  const [rating, setRating] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await fetch(`/api/recipes/${recipeId}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: rating || undefined, notes: notes || undefined }),
      })
      toast.success('Cooking logged! 🎉')
      onSaved()
      onClose()
    } catch {
      toast.error('Could not save log')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl p-6 pb-10 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-gray-900 mb-4">Log Cooking Session</h3>
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Rating</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setRating(n)}
                className={`text-2xl transition-transform ${n <= rating ? '' : 'opacity-30'} hover:scale-110`}
              >
                ⭐
              </button>
            ))}
          </div>
        </div>
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">Notes (optional)</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="How did it turn out? Any tweaks?"
            className="w-full border rounded-xl p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <Button
          onClick={save}
          disabled={saving}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-base"
        >
          {saving ? 'Saving...' : 'Log it!'}
        </Button>
      </div>
    </div>
  )
}

export default function RecipeDetail({ recipe }: { recipe: RecipeWithDetails }) {
  const router = useRouter()
  const [showCook, setShowCook] = useState(false)
  const [cookedCount, setCookedCount] = useState(recipe.cooked_count)
  const grouped = groupIngredients(recipe.ingredients || [])
  const logs = (recipe.cooking_log || []).sort((a, b) => new Date(b.cooked_at).getTime() - new Date(a.cooked_at).getTime()).slice(0, 5)
  const avgRating = logs.filter(l => l.rating).reduce((s, l) => s + (l.rating || 0), 0) / (logs.filter(l => l.rating).length || 1)

  const handleDelete = async () => {
    if (!confirm('Delete this recipe?')) return
    await fetch(`/api/recipes/${recipe.id}`, { method: 'DELETE' })
    toast.success('Recipe deleted')
    router.push('/recipes')
  }

  return (
    <div className="max-w-lg mx-auto pb-8">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-orange-400 to-amber-500 px-4 pt-6 pb-8">
        <div className="flex items-center justify-between mb-4">
          <Link href="/recipes" className="text-white/80 hover:text-white p-1 -ml-1">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex gap-2">
            <Link
              href={`/recipes/${recipe.id}/edit`}
              className="text-white/80 hover:text-white p-2"
            >
              <Edit className="w-4 h-4" />
            </Link>
            <button onClick={handleDelete} className="text-white/80 hover:text-red-200 p-2">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="text-5xl mb-3">
          {recipe.cuisine ? { italian:'🍝',japanese:'🍜',chinese:'🥢',mexican:'🌮',indian:'🍛',thai:'🌶️',french:'🥐',american:'🍔',mediterranean:'🫒',korean:'🍱',vietnamese:'🍲',greek:'🥗',spanish:'🥘' }[recipe.cuisine.toLowerCase()] ?? '🍽️' : '🍽️'}
        </div>
        <h1 className="text-2xl font-bold text-white leading-tight">{recipe.name}</h1>
        {recipe.description && (
          <p className="text-white/80 text-sm mt-2 leading-relaxed">{recipe.description}</p>
        )}
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          {recipe.cuisine && (
            <span className="bg-white/20 text-white rounded-full px-3 py-1 text-xs font-medium capitalize">{recipe.cuisine}</span>
          )}
          {recipe.cook_time_minutes && (
            <span className="flex items-center gap-1 text-white/90 text-sm">
              <Clock className="w-3.5 h-3.5" /> {recipe.cook_time_minutes} min
            </span>
          )}
          {recipe.servings && (
            <span className="flex items-center gap-1 text-white/90 text-sm">
              <Users className="w-3.5 h-3.5" /> {recipe.servings} servings
            </span>
          )}
          {cookedCount > 0 && (
            <span className="flex items-center gap-1 text-white/90 text-sm">
              <ChefHat className="w-3.5 h-3.5" /> Cooked {cookedCount}×
            </span>
          )}
        </div>
      </div>

      <div className="px-4 -mt-4">
        {/* Log cooking button */}
        <Button
          onClick={() => setShowCook(true)}
          className="w-full bg-white text-orange-600 hover:bg-orange-50 border border-orange-200 font-semibold h-12 rounded-2xl shadow-md mb-6"
        >
          🍳 Mark as Cooked
        </Button>

        {/* Ingredients */}
        {grouped.length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold text-gray-900 text-lg mb-3">Ingredients</h2>
            <div className="space-y-3">
              {grouped.map(({ category, items }) => (
                <div key={category} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                      <span>{CATEGORY_EMOJI[category] ?? '📦'}</span> {category}
                    </h3>
                  </div>
                  <ul className="divide-y divide-gray-50">
                    {items.map(ing => (
                      <li key={ing.id} className="px-4 py-2.5 flex items-center justify-between">
                        <span className="text-gray-900 text-sm">{ing.name}</span>
                        {(ing.quantity || ing.unit) && (
                          <span className="text-gray-400 text-sm font-medium">
                            {ing.quantity} {ing.unit}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        {recipe.instructions && (
          <div className="mb-6">
            <h2 className="font-bold text-gray-900 text-lg mb-3">Instructions</h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{recipe.instructions}</p>
            </div>
          </div>
        )}

        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {recipe.tags.map(tag => (
              <span key={tag} className="bg-orange-50 text-orange-600 rounded-full px-3 py-1 text-sm font-medium">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Cooking history */}
        {logs.length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold text-gray-900 text-lg mb-3">
              Cooking History
              {logs.some(l => l.rating) && (
                <span className="text-sm font-normal text-gray-400 ml-2">
                  avg ⭐{avgRating.toFixed(1)}
                </span>
              )}
            </h2>
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600">{format(new Date(log.cooked_at), 'MMM d, yyyy')}</p>
                    {log.notes && <p className="text-xs text-gray-400 mt-0.5">{log.notes}</p>}
                  </div>
                  {log.rating && (
                    <div className="flex">
                      {Array.from({ length: log.rating }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showCook && (
        <CookDialog
          recipeId={recipe.id}
          onClose={() => setShowCook(false)}
          onSaved={() => setCookedCount(c => c + 1)}
        />
      )}
    </div>
  )
}
