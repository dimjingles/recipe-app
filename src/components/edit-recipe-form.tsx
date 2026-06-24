'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, X, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { RecipeWithIngredients } from '@/types/database'

const CATEGORIES = ['produce', 'dairy', 'meat', 'seafood', 'pantry', 'spices', 'bakery', 'frozen', 'other']

interface IngredientRow {
  name: string
  quantity: string
  unit: string
  category: string
}

export default function EditRecipeForm({ recipe }: { recipe: RecipeWithIngredients }) {
  const router = useRouter()
  const [name, setName] = useState(recipe.name)
  const [description, setDescription] = useState(recipe.description || '')
  const [cuisine, setCuisine] = useState(recipe.cuisine || '')
  const [cookTime, setCookTime] = useState(String(recipe.cook_time_minutes || ''))
  const [servings, setServings] = useState(String(recipe.servings || 4))
  const [instructions, setInstructions] = useState(recipe.instructions || '')
  const [tags, setTags] = useState((recipe.tags || []).join(', '))
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    (recipe.ingredients || []).map(i => ({
      name: i.name,
      quantity: i.quantity || '',
      unit: i.unit || '',
      category: i.category || 'other',
    }))
  )
  const [saving, setSaving] = useState(false)

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
      const res = await fetch(`/api/recipes/${recipe.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          cuisine: cuisine.trim() || null,
          cook_time_minutes: cookTime ? parseInt(cookTime) : null,
          servings: servings ? parseInt(servings) : 4,
          instructions: instructions.trim() || null,
          tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          ingredients: ingredients.filter(i => i.name.trim()),
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('Recipe updated!')
      router.push(`/recipes/${recipe.id}`)
    } catch {
      toast.error('Could not save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/recipes/${recipe.id}`} className="text-gray-400 hover:text-gray-600 p-1 -ml-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Edit Recipe</h1>
      </div>

      <div className="space-y-5">
        <div>
          <Label className="text-gray-700 font-medium">Recipe Name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label className="text-gray-700 font-medium">Description</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} className="mt-1.5 resize-none h-20" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-gray-700 font-medium text-sm">Cuisine</Label>
            <Input value={cuisine} onChange={e => setCuisine(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-gray-700 font-medium text-sm">Cook Time (min)</Label>
            <Input value={cookTime} onChange={e => setCookTime(e.target.value)} type="number" className="mt-1.5" />
          </div>
          <div>
            <Label className="text-gray-700 font-medium text-sm">Servings</Label>
            <Input value={servings} onChange={e => setServings(e.target.value)} type="number" className="mt-1.5" />
          </div>
        </div>

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
                <Input value={ing.quantity} onChange={e => updateIngredient(i, 'quantity', e.target.value)} placeholder="Qty" className="w-16 bg-white text-sm" />
                <Input value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)} placeholder="Unit" className="w-20 bg-white text-sm" />
                <Input value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)} placeholder="Ingredient" className="flex-1 bg-white text-sm" />
                <select value={ing.category} onChange={e => updateIngredient(i, 'category', e.target.value)} className="text-xs border rounded-lg px-1.5 py-2 bg-white text-gray-600">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={() => removeIngredient(i)} className="text-gray-300 hover:text-red-400"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-gray-700 font-medium">Instructions</Label>
          <Textarea value={instructions} onChange={e => setInstructions(e.target.value)} className="mt-1.5 resize-none h-32" />
        </div>
        <div>
          <Label className="text-gray-700 font-medium">Tags</Label>
          <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="quick, weeknight (comma-separated)" className="mt-1.5" />
        </div>

        <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-base font-semibold">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
