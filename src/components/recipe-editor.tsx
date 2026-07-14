'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCacheInvalidation } from '@/lib/queries/hooks'
import { Sparkles, Plus, X, Loader2, Link2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import CuisineCombobox from '@/components/cuisine-combobox'
import { CookingLoader } from '@/components/cooking-loader'
import InstructionsEditor from '@/components/instructions-editor'
import { textToSteps, stepsToText, splitSourceNote } from '@/lib/instructions'
import type { ExtractedRecipe } from '@/types/database'

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
  const invalidate = useCacheInvalidation()
  const [name, setName] = useState(initialValues?.name ?? '')
  const [description, setDescription] = useState(initialValues?.description ?? '')
  const [cuisine, setCuisine] = useState(initialValues?.cuisine ?? '')
  const [recipeType, setRecipeType] = useState(initialValues?.recipeType ?? '')
  const [cookTime, setCookTime] = useState(initialValues?.cookTime ?? '')
  const [servings, setServings] = useState(initialValues?.servings ?? '4')
  // Instructions edited as discrete steps; reassembled into the source string
  // on save. Any trailing "Source: <url>" note is kept separate.
  const [steps, setSteps] = useState<string[]>(() => textToSteps(splitSourceNote(initialValues?.instructions).body))
  const [sourceNote, setSourceNote] = useState(() => splitSourceNote(initialValues?.instructions).note)
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
  // True only while the on-mount auto-lookup runs, so we can show a full-panel
  // cooking animation instead of an empty form for AI-generated new recipes.
  const [autoFilling, setAutoFilling] = useState(!!(autoLookup && showLookup && initialValues?.name))
  const [saving, setSaving] = useState(false)
  const [looked, setLooked] = useState(false)

  // Import panel state
  const [showImport, setShowImport] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importNeedsText, setImportNeedsText] = useState(false)
  const [importHint, setImportHint] = useState('')
  const [importPasteText, setImportPasteText] = useState('')
  const [importTextLoading, setImportTextLoading] = useState(false)

  // Auto-trigger AI lookup when the editor is pre-populated with a name
  useEffect(() => {
    if (autoLookup && showLookup && initialValues?.name) {
      handleLookup(initialValues.name).finally(() => setAutoFilling(false))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const applyImport = (r: ExtractedRecipe) => {
    if (r.name) setName(r.name)
    if (r.description) setDescription(r.description)
    if (r.cuisine) setCuisine(r.cuisine)
    if (r.cook_time_minutes != null) setCookTime(String(r.cook_time_minutes))
    if (r.servings != null) setServings(String(r.servings))
    if (r.instructions) {
      setSteps(textToSteps(r.instructions))
      setSourceNote(r.source_url ? `Source: ${r.source_url}` : '')
    }
    if (r.ingredients?.length) setIngredients(r.ingredients)
    setShowImport(false)
    setImportUrl('')
    setImportPasteText('')
    setImportNeedsText(false)
    toast.success('Recipe imported!')
  }

  const handleImportUrl = async () => {
    if (!importUrl.trim()) return
    setImportLoading(true)
    try {
      const res = await fetch('/api/recipes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim() }),
      })
      const data = await res.json()
      if (data.needsText) {
        setImportHint(data.hint || "We couldn't read that page. Paste the recipe text below.")
        setImportNeedsText(true)
      } else if (data.error) {
        toast.error(data.error)
      } else {
        applyImport(data as ExtractedRecipe)
      }
    } catch {
      toast.error('Import failed. Check the URL and try again.')
    } finally {
      setImportLoading(false)
    }
  }

  const handleImportText = async () => {
    if (!importPasteText.trim()) return
    setImportTextLoading(true)
    try {
      const res = await fetch('/api/recipes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: importPasteText }),
      })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        applyImport(data as ExtractedRecipe)
      }
    } catch {
      toast.error('Import failed. Please try again.')
    } finally {
      setImportTextLoading(false)
    }
  }

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
      if (data.instructions) {
        const { body, note } = splitSourceNote(data.instructions)
        setSteps(textToSteps(body))
        setSourceNote(note)
      }
      if (data.difficulty && !difficulty) setDifficulty(data.difficulty)
      setLooked(true)
      toast.success('Recipe filled!')
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Could not fill recipe. Try again.')
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
    if (!stepsToText(steps).trim()) { toast.error('Add at least one instruction step'); return }
    setSaving(true)
    try {
      const body = stepsToText(steps)
      const instructions = body ? [body, sourceNote].filter(Boolean).join('\n\n') : ''
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
      invalidate.recipesChanged()
      router.push(`/recipes/${data.id}`)
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Could not save recipe')
    } finally {
      setSaving(false)
    }
  }

  // Full-panel cooking animation while AI builds a brand-new recipe from a name.
  if (autoFilling) {
    return (
      <div className="py-20">
        <CookingLoader size="lg" />
        {initialValues?.name && (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Cooking up <span className="font-medium text-foreground">{initialValues.name}</span>…
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Imported image preview */}
      {imageUrl && (
        <div className="rounded-xl overflow-hidden aspect-video bg-gray-100">
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Name + AI Fill + Import */}
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
            <>
              <Button
                onClick={() => handleLookup()}
                disabled={!name.trim() || lookupLoading}
                className="bg-orange-500 hover:bg-orange-600 text-white shrink-0"
              >
                {lookupLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><Sparkles className="w-4 h-4 mr-1" /> Fill</>}
              </Button>
              <Button
                onClick={() => setShowImport(v => !v)}
                variant="outline"
                className="shrink-0 border-gray-200 text-gray-600 hover:text-brand hover:border-brand"
              >
                <Link2 className="w-4 h-4 mr-1" /> Import
              </Button>
            </>
          )}
        </div>
        {showLookup && !looked && !showImport && (
          <p className="text-xs text-gray-400 mt-1.5">
            Type a recipe name and tap Fill to auto-load the recipe with AI.
          </p>
        )}

        {/* Inline import panel */}
        {showImport && (
          <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-3">
            {importNeedsText ? (
              <>
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {importHint}
                </p>
                <Textarea
                  value={importPasteText}
                  onChange={e => setImportPasteText(e.target.value)}
                  placeholder="Paste the recipe caption, description, or full recipe text here…"
                  className="h-32 resize-none"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleImportText}
                    disabled={!importPasteText.trim() || importTextLoading}
                    className="flex-1 bg-brand hover:bg-brand/90 text-white h-10"
                  >
                    {importTextLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Extracting…</>
                      : 'Extract Recipe'}
                  </Button>
                  <button
                    onClick={() => { setImportNeedsText(false); setImportHint('') }}
                    className="text-sm text-gray-400 hover:text-gray-600 px-2"
                  >
                    ← Back
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-500">
                  Paste a link to any recipe website, YouTube video, or social media post.
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      value={importUrl}
                      onChange={e => setImportUrl(e.target.value)}
                      placeholder="https://..."
                      className="pl-9"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') handleImportUrl() }}
                      disabled={importLoading}
                    />
                  </div>
                  <Button
                    onClick={handleImportUrl}
                    disabled={!importUrl.trim() || importLoading}
                    className="bg-brand hover:bg-brand/90 text-white shrink-0"
                  >
                    {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Import'}
                  </Button>
                </div>
                {importLoading && (
                  <p className="text-xs text-gray-400 flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" /> Fetching and extracting recipe…
                  </p>
                )}
                <button
                  onClick={() => {
                    setImportHint("Paste the recipe text, caption, or instructions below.")
                    setImportNeedsText(true)
                  }}
                  className="text-xs text-gray-400 hover:text-brand transition-colors"
                >
                  Paste recipe text instead →
                </button>
              </>
            )}
          </div>
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
        </div>

        {ingredients.length === 0 ? (
          <button
            type="button"
            onClick={addIngredient}
            className="w-full text-center py-5 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-colors"
          >
            <Plus className="w-4 h-4 inline mr-1 -mt-0.5" />
            Add the first ingredient{showLookup ? ' — or tap Fill' : ''}
          </button>
        ) : (
          <button
            type="button"
            onClick={addIngredient}
            className="mt-2 text-sm text-orange-500 font-medium flex items-center gap-1 hover:text-orange-600"
          >
            <Plus className="w-3.5 h-3.5" /> Add ingredient
          </button>
        )}
      </div>

      {/* Instructions — step-based editor. Instruction generation is handled by
          the AI "Fill" button alongside the rest of the recipe. */}
      <InstructionsEditor
        steps={steps}
        onStepsChange={setSteps}
        ingredientNames={ingredients.map(i => i.name).filter(Boolean)}
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

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={saving || !name.trim() || !steps.some(s => s.trim())}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-base font-semibold"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        {saving ? 'Saving...' : 'Save Recipe'}
      </Button>
    </div>
  )
}
