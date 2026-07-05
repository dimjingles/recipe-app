'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Plus, X, Loader2, ChefHat } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import CuisineCombobox from '@/components/cuisine-combobox'

export interface IngredientRow {
  name: string
  quantity: string
  unit: string
  category: string
}

export interface RecipeEditorValues {
  name?: string
  description?: string
  cuisine?: string
  recipeType?: string
  cookTime?: string
  servings?: string
  instructions?: string
  difficulty?: number
  tags?: string
  ingredients?: IngredientRow[]
  image_url?: string
  gallery_images?: string[]
}

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

interface RecipeEditorProps {
  initialValues?: RecipeEditorValues
  /**
   * Show the AI "Fill" button that calls /api/recipes/lookup to populate
   * ingredients from a dish name. Used on the New Recipe page.
   */
  showLookup?: boolean
  /**
   * When true, automatically trigger the AI lookup on mount using
   * initialValues.name. Only relevant when showLookup is also true.
   */
  autoLookup?: boolean
}

export default function RecipeEditor({ initialValues, showLookup, autoLookup }: RecipeEditorProps) {
  const router = useRouter()
  const [name, setName] = useState(initialValues?.name ?? '')
  const [description, setDescription] = useState(initialValues?.description ?? '')
  const [cuisine, setCuisine] = useState(initialValues?.cuisine ?? '')
  const [recipeType, setRecipeType] = useState(initialValues?.recipeType ?? '')
  const [cookTime, setCookTime] = useState(initialValues?.cookTime ?? '')
  const [servings, setServings] = useState(initialValues?.servings ?? '4')
  const [instructions, setInstructions] = useState(initialValues?.instructions ?? '')
  const [difficulty, setDifficulty] = useState<number | null>(initialValues?.difficulty ?? null)
  const [tags, setTags] = useState<string[]>(
    initialValues?.tags
      ? initialValues.tags.split(',').map(t => t.trim()).filter(Boolean)
      : []
  )
  const [customTagInput, setCustomTagInput] = useState('')
  const [ingredients, setIngredients] = useState<IngredientRow[]>(initialValues?.ingredients ?? [])
  const [imageUrl] = useState(initialValues?.image_url ?? '')
  const [galleryImages] = useState<string[]>(initialValues?.gallery_images ?? [])
  const [lookupLoading, setLookupLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [looked, setLooked] = useState(false)
  const [instructionsLoading, setInstructionsLoading] = useState(false)

  // Auto-trigger AI lookup when the editor is pre-populated with a name
  useEffect(() => {
    if (autoLookup && showLookup && initialValues?.name) {
      handleLookup(initialValues.name)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLookup = async (recipeName?: string) => {
    const n = (recipeName || name).trim()
    if (!n) return
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
      if (data.recipe_type) setRecipeType(data.recipe_type)
      if (data.cook_time_minutes) setCookTime(String(data.cook_time_minutes))
      if (data.servings) setServings(String(data.servings))
      if (data.description) setDescription(data.description)
      setLooked(true)
      toast.success('Ingredients loaded!')
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Could not load ingredients. Try again.')
    } finally {
      setLookupLoading(false)
    }
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
      if (data.instructions) setInstructions(data.instructions)
      if (data.difficulty && !difficulty) setDifficulty(data.difficulty)
      toast.success('Instructions generated!')
    } catch {
      toast.error('Could not generate instructions. Try again.')
    } finally {
      setInstructionsLoading(false)
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
          recipe_type: recipeType || undefined,
          cook_time_minutes: cookTime ? parseInt(cookTime) : undefined,
          servings: servings ? parseInt(servings) : 4,
          instructions: instructions.trim() || undefined,
          difficulty: difficulty ?? undefined,
          tags: tags,
          ingredients: ingredients.filter(i => i.name.trim()),
          image_url: imageUrl || undefined,
          gallery_images: galleryImages.length > 0 ? galleryImages : undefined,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast.success('Recipe saved!')
      router.push(`/recipes/${data.id}`)
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Could not save recipe')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Imported image preview */}
      {imageUrl && (
        <div className="rounded-xl overflow-hidden aspect-video bg-gray-100">
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Name + optional AI Fill */}
      <div>
        <Label className="text-gray-700 font-medium">Recipe Name *</Label>
        <div className="flex gap-2 mt-1.5">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Spaghetti Carbonara"
            className="flex-1"
            onKeyDown={e => { if (e.key === 'Enter' && showLookup) handleLookup() }}
          />
          {showLookup && (
            <Button
              onClick={() => handleLookup()}
              disabled={!name.trim() || lookupLoading}
              className="bg-orange-500 hover:bg-orange-600 text-white shrink-0"
            >
              {lookupLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <><Sparkles className="w-4 h-4 mr-1" /> Fill</>}
            </Button>
          )}
        </div>
        {showLookup && !looked && (
          <p className="text-xs text-gray-400 mt-1.5">
            Type a recipe name and tap Fill to auto-load ingredients with AI.
          </p>
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
          <Input
            value={cookTime}
            onChange={e => setCookTime(e.target.value)}
            placeholder="30"
            type="number"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label className="text-gray-700 font-medium text-sm">Servings</Label>
          <Input
            value={servings}
            onChange={e => setServings(e.target.value)}
            placeholder="4"
            type="number"
            className="mt-1.5"
          />
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
        {!difficulty && (
          <p className="text-xs text-gray-400 mt-1.5">
            Will be inferred from instructions when generating with AI. You can also set it manually.
          </p>
        )}
      </div>

      {/* Ingredients */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-gray-700 font-medium">Ingredients</Label>
          <button
            onClick={addIngredient}
            className="text-sm text-orange-500 font-medium flex items-center gap-1"
          >
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
              <button
                onClick={() => removeIngredient(i)}
                className="text-gray-300 hover:text-red-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {ingredients.length === 0 && (
            <div className="text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <p className="text-sm text-gray-400">
                {showLookup
                  ? 'No ingredients yet. Tap Fill or Add manually.'
                  : 'No ingredients found. Add them manually.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Instructions + AI Generate */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-gray-700 font-medium">Instructions</Label>
          <button
            onClick={handleGenerateInstructions}
            disabled={instructionsLoading || !name.trim()}
            className="text-sm text-orange-500 font-medium flex items-center gap-1 hover:text-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {instructionsLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Sparkles className="w-3.5 h-3.5" />}
            {instructionsLoading ? 'Generating...' : 'Generate with AI'}
          </button>
        </div>
        <Textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          placeholder="Step by step instructions..."
          className="mt-1.5 resize-none h-32"
        />
        {instructions && (
          <p className="text-xs text-gray-400 mt-1">
            <ChefHat className="w-3 h-3 inline mr-0.5" /> You can edit these instructions freely. They'll be saved as-is.
          </p>
        )}
      </div>

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

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={saving || !name.trim()}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-base font-semibold"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        {saving ? 'Saving...' : 'Save Recipe'}
      </Button>
    </div>
  )
}
