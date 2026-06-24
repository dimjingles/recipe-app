'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Sparkles, Plus, X, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface IngredientRow {
  name: string
  quantity: string
  unit: string
  category: string
}

const CATEGORIES = ['produce', 'dairy', 'meat', 'seafood', 'pantry', 'spices', 'bakery', 'frozen', 'other']

export default function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [cookTime, setCookTime] = useState('')
  const [servings, setServings] = useState('4')
  const [instructions, setInstructions] = useState('')
  const [tags, setTags] = useState('')
  const [ingredients, setIngredients] = useState<IngredientRow[]>([])
  const [lookupLoading, setLookupLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [looked, setLooked] = useState(false)

  useEffect(() => {
    searchParams.then(params => {
      if (params.name) {
        setName(params.name)
        // Auto-lookup if pre-filled
        handleLookup(params.name)
      }
    })
  }, [])

  const handleLookup = async (recipeName?: string) => {
    const n = recipeName || name
    if (!n.trim()) return
    setLookupLoading(true)
    try {
      const res = await fetch('/api/recipes/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setIngredients(data.ingredients || [])
      if (data.cuisine) setCuisine(data.cuisine)
      if (data.cook_time_minutes) setCookTime(String(data.cook_time_minutes))
      if (data.servings) setServings(String(data.servings))
      if (data.description) setDescription(data.description)
      setLooked(true)
      toast.success('Ingredients loaded!')
    } catch (e: any) {
      toast.error('Could not load ingredients. Try again.')
    } finally {
      setLookupLoading(false)
    }
  }

  const addIngredient = () => {
    setIngredients(prev => [...prev, { name: '', quantity: '', unit: '', category: 'other' }])
  }

  const removeIngredient = (i: number) => {
    setIngredients(prev => prev.filter((_, idx) => idx !== i))
  }

  const updateIngredient = (i: number, field: keyof IngredientRow, value: string) => {
    setIngredients(prev => prev.map((ing, idx) => idx === i ? { ...ing, [field]: value } : ing))
  }

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Recipe name is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          cuisine: cuisine.trim() || undefined,
          cook_time_minutes: cookTime ? parseInt(cookTime) : undefined,
          servings: servings ? parseInt(servings) : 4,
          instructions: instructions.trim() || undefined,
          tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          ingredients: ingredients.filter(i => i.name.trim()),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast.success('Recipe saved!')
      router.push(`/recipes/${data.id}`)
    } catch (e: any) {
      toast.error(e.message || 'Could not save recipe')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/recipes" className="text-gray-400 hover:text-gray-600 p-1 -ml-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">New Recipe</h1>
      </div>

      <div className="space-y-5">
        {/* Name + Lookup */}
        <div>
          <Label className="text-gray-700 font-medium">Recipe Name *</Label>
          <div className="flex gap-2 mt-1.5">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Spaghetti Carbonara"
              className="flex-1"
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
            />
            <Button
              onClick={() => handleLookup()}
              disabled={!name.trim() || lookupLoading}
              className="bg-orange-500 hover:bg-orange-600 text-white shrink-0"
            >
              {lookupLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <><Sparkles className="w-4 h-4 mr-1" /> Fill</>
              )}
            </Button>
          </div>
          {!looked && (
            <p className="text-xs text-gray-400 mt-1.5">Type a recipe name and tap Fill to auto-load ingredients with AI.</p>
          )}
        </div>

        {/* Description */}
        <div>
          <Label className="text-gray-700 font-medium">Description</Label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Brief description of the dish..."
            className="mt-1.5 resize-none h-20"
          />
        </div>

        {/* Meta fields */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-gray-700 font-medium text-sm">Cuisine</Label>
            <Input value={cuisine} onChange={e => setCuisine(e.target.value)} placeholder="Italian" className="mt-1.5" />
          </div>
          <div>
            <Label className="text-gray-700 font-medium text-sm">Cook Time (min)</Label>
            <Input value={cookTime} onChange={e => setCookTime(e.target.value)} placeholder="30" type="number" className="mt-1.5" />
          </div>
          <div>
            <Label className="text-gray-700 font-medium text-sm">Servings</Label>
            <Input value={servings} onChange={e => setServings(e.target.value)} placeholder="4" type="number" className="mt-1.5" />
          </div>
        </div>

        {/* Ingredients */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-gray-700 font-medium">Ingredients</Label>
            <button onClick={addIngredient} className="text-sm text-orange-500 font-medium flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
          <div className="space-y-2">
            {ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2 items-center bg-gray-50 rounded-xl p-2">
                <Input
                  value={ing.quantity}
                  onChange={e => updateIngredient(i, 'quantity', e.target.value)}
                  placeholder="Qty"
                  className="w-16 bg-white text-sm"
                />
                <Input
                  value={ing.unit}
                  onChange={e => updateIngredient(i, 'unit', e.target.value)}
                  placeholder="Unit"
                  className="w-20 bg-white text-sm"
                />
                <Input
                  value={ing.name}
                  onChange={e => updateIngredient(i, 'name', e.target.value)}
                  placeholder="Ingredient"
                  className="flex-1 bg-white text-sm"
                />
                <select
                  value={ing.category}
                  onChange={e => updateIngredient(i, 'category', e.target.value)}
                  className="text-xs border rounded-lg px-1.5 py-2 bg-white text-gray-600"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={() => removeIngredient(i)} className="text-gray-300 hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {ingredients.length === 0 && (
              <div className="text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-sm text-gray-400">No ingredients yet. Tap Fill or Add manually.</p>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div>
          <Label className="text-gray-700 font-medium">Instructions (optional)</Label>
          <Textarea
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder="Step by step instructions..."
            className="mt-1.5 resize-none h-32"
          />
        </div>

        {/* Tags */}
        <div>
          <Label className="text-gray-700 font-medium">Tags</Label>
          <Input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="quick, weeknight, vegetarian (comma-separated)"
            className="mt-1.5"
          />
        </div>

        {/* Save */}
        <Button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-base font-semibold"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {saving ? 'Saving...' : 'Save Recipe'}
        </Button>
      </div>
    </div>
  )
}
