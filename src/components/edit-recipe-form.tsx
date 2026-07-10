'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, X, Loader2, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { RecipeWithIngredients } from '@/types/database'
import CuisineCombobox from '@/components/cuisine-combobox'
import InstructionsEditor from '@/components/instructions-editor'
import { textToSteps, stepsToText, splitSourceNote } from '@/lib/instructions'

const CATEGORIES = ['produce', 'dairy', 'meat', 'seafood', 'pantry', 'spices', 'bakery', 'frozen', 'other']

const PREDEFINED_TAGS = [
  'Vegan',
  'Vegetarian',
  'Gluten-Free',
  'Dairy-Free',
  'Nut-Free',
  'Spicy: Mild',
  'Spicy: Medium',
  'Spicy: Hot',
  'Quick (<30 min)',
  'Meal Prep',
]

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
  const [recipeType, setRecipeType] = useState(recipe.recipe_type || '')
  const [cookTime, setCookTime] = useState(String(recipe.cook_time_minutes || ''))
  const [servings, setServings] = useState(String(recipe.servings || 4))
  // Instructions are edited as discrete steps; the source-of-truth string is
  // reassembled on save. Prefer the AI-structured steps if present, else split
  // the raw blob. Any trailing "Source: <url>" note is preserved separately.
  const [steps, setSteps] = useState<string[]>(() =>
    recipe.instruction_steps && recipe.instruction_steps.length > 0
      ? recipe.instruction_steps.map(s => s.text)
      : textToSteps(splitSourceNote(recipe.instructions).body)
  )
  const [sourceNote] = useState(() => splitSourceNote(recipe.instructions).note)
  const [difficulty, setDifficulty] = useState<number | null>(recipe.difficulty ?? null)
  const [tags, setTags] = useState<string[]>(recipe.tags || [])
  const [customTagInput, setCustomTagInput] = useState('')
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    (recipe.ingredients || []).map(i => ({
      name: i.name,
      quantity: i.quantity || '',
      unit: i.unit || '',
      category: i.category || 'other',
    }))
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [instructionsLoading, setInstructionsLoading] = useState(false)

  const addIngredient = () => {
    setIngredients(prev => [...prev, { name: '', quantity: '', unit: '', category: 'other' }])
  }

  const removeIngredient = (i: number) => {
    setIngredients(prev => prev.filter((_, idx) => idx !== i))
  }

  const updateIngredient = (i: number, field: keyof IngredientRow, value: string) => {
    setIngredients(prev => prev.map((ing, idx) => idx === i ? { ...ing, [field]: value } : ing))
  }

  const toggleTag = (tag: string) => {
    setTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const addCustomTag = () => {
    const t = customTagInput.trim()
    if (!t) return
    if (!tags.includes(t)) {
      setTags(prev => [...prev, t])
    }
    setCustomTagInput('')
  }

  const handleGenerateInstructions = async () => {
    if (!name.trim()) {
      toast.error('Enter a recipe name first')
      return
    }
    if (ingredients.length === 0 || !ingredients.some(i => i.name.trim())) {
      toast.error('Add at least one ingredient first')
      return
    }
    setInstructionsLoading(true)
    try {
      const res = await fetch('/api/recipes/generate-instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          ingredients: ingredients.filter(i => i.name.trim()),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      // AI returns a numbered blob — split it into separate editable steps.
      if (data.instructions) setSteps(textToSteps(splitSourceNote(data.instructions).body))
      if (data.difficulty && !difficulty) setDifficulty(data.difficulty)
      toast.success('Instructions generated!')
    } catch {
      toast.error('Could not generate instructions. Try again.')
    } finally {
      setInstructionsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this recipe? This cannot be undone.')) return
    setDeleting(true)
    try {
      await fetch(`/api/recipes/${recipe.id}`, { method: 'DELETE' })
      toast.success('Recipe deleted')
      router.push('/recipes')
    } catch {
      toast.error('Could not delete recipe')
      setDeleting(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Recipe name is required'); return }
    setSaving(true)
    try {
      const body = stepsToText(steps)
      const instructions = body ? [body, sourceNote].filter(Boolean).join('\n\n') : ''
      const res = await fetch(`/api/recipes/${recipe.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          cuisine: cuisine.trim() || null,
          recipe_type: recipeType || null,
          cook_time_minutes: cookTime ? parseInt(cookTime) : null,
          servings: servings ? parseInt(servings) : 4,
          instructions: instructions.trim() || null,
          difficulty: difficulty ?? null,
          tags: tags,
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-gray-700 font-medium text-sm">Cuisine</Label>
            <CuisineCombobox value={cuisine} onChange={setCuisine} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-gray-700 font-medium text-sm">Type</Label>
            <select
              value={recipeType}
              onChange={e => setRecipeType(e.target.value)}
              className="mt-1.5 w-full border border-input rounded-md px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="">— none —</option>
              <option value="appetizer">🥗 Appetizer</option>
              <option value="main">🍽️ Main</option>
              <option value="dessert">🍰 Dessert</option>
              <option value="drink">🍹 Drink</option>
            </select>
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

        {/* Difficulty */}
        <div>
          <Label className="text-gray-700 font-medium">Difficulty</Label>
          <div className="flex gap-2 mt-1.5">
            {[1, 2, 3].map(level => (
              <button
                key={level}
                onClick={() => setDifficulty(difficulty === level ? null : level)}
                className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                  difficulty === level
                    ? 'border-orange-400 bg-orange-50 text-orange-700'
                    : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                }`}
              >
                {Array.from({ length: level }, (_, i) => (
                  <span key={i}>🔪</span>
                ))}
                <span className="text-xs ml-0.5">
                  {level === 1 ? 'Easy' : level === 2 ? 'Medium' : 'Hard'}
                </span>
              </button>
            ))}
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

        {/* Instructions — step-based editor with AI generation */}
        <InstructionsEditor
          steps={steps}
          onStepsChange={setSteps}
          ingredientNames={ingredients.map(i => i.name).filter(Boolean)}
          onGenerate={handleGenerateInstructions}
          generating={instructionsLoading}
          generateDisabled={!name.trim()}
        />

        {/* Tags - Chip multi-select */}
        <div>
          <Label className="text-gray-700 font-medium">Tags</Label>
          <div className="mt-1.5 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {PREDEFINED_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    tags.includes(tag)
                      ? 'bg-orange-50 border-orange-300 text-orange-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            {/* Custom tags */}
            {tags.filter(t => !PREDEFINED_TAGS.includes(t)).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.filter(t => !PREDEFINED_TAGS.includes(t)).map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-orange-50 border border-orange-300 text-orange-700"
                  >
                    {tag}
                    <button onClick={() => toggleTag(tag)} className="text-orange-400 hover:text-orange-600">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <Input
                value={customTagInput}
                onChange={e => setCustomTagInput(e.target.value)}
                placeholder="Add custom tag..."
                className="flex-1 text-sm"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag() } }}
              />
              <button
                onClick={addCustomTag}
                disabled={!customTagInput.trim()}
                className="text-orange-500 font-medium text-sm px-2 disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving || deleting || !name.trim()} className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-base font-semibold">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : 'Save Changes'}
        </Button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-full flex items-center justify-center gap-2 text-sm text-red-400 hover:text-red-600 py-2 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          {deleting ? 'Deleting...' : 'Delete recipe'}
        </button>
      </div>
    </div>
  )
}
