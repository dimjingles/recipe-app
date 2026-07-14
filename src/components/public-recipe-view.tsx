import { Clock, Users } from 'lucide-react'
import InstructionSteps from '@/components/instruction-steps'
import { getCuisineEmoji } from '@/lib/cuisine-emoji'
import type { Recipe, Ingredient, InstructionStep } from '@/types/database'

// Read-only recipe presentation for public share links (/share/[token]).
// Deliberately contains NO interactive controls or links into the authenticated
// app — a logged-out visitor can only look. Keep it that way.

const CATEGORY_EMOJI: Record<string, string> = {
  produce: '🥦', dairy: '🧀', meat: '🥩', seafood: '🐟',
  pantry: '🫙', spices: '🌿', bakery: '🍞', frozen: '🧊', other: '📦',
}

const CATEGORY_ORDER = ['produce', 'meat', 'seafood', 'dairy', 'bakery', 'pantry', 'spices', 'frozen', 'other']

function groupIngredients(ingredients: Ingredient[]) {
  const groups: Record<string, Ingredient[]> = {}
  for (const ing of ingredients) {
    const cat = ing.category || 'other'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(ing)
  }
  return CATEGORY_ORDER.filter(c => groups[c]).map(c => ({ category: c, items: groups[c] }))
}

export default function PublicRecipeView({ recipe }: { recipe: Recipe & { ingredients: Ingredient[] } }) {
  const emoji = getCuisineEmoji(recipe.cuisine)
  const grouped = groupIngredients(recipe.ingredients ?? [])

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* ── Hero image ─────────────────────────────────────────────── */}
      {recipe.image_url && (
        <img src={recipe.image_url} alt={recipe.name} className="w-full h-auto" />
      )}

      {/* ── Header band ────────────────────────────────────────────── */}
      {recipe.image_url ? (
        <div className="bg-gradient-to-br from-brand to-cooking/80 px-4 pt-4 pb-8">
          <h1 className="font-heading text-2xl font-bold text-white leading-tight">{recipe.name}</h1>
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
            {recipe.difficulty && (
              <span className="flex items-center gap-0.5 text-white/90 text-sm" title={['Easy', 'Medium', 'Hard'][recipe.difficulty - 1]}>
                {Array.from({ length: recipe.difficulty }, (_, i) => <span key={i}>🔪</span>)}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-card border-b border-border px-4 pt-6 pb-6">
          <div className="flex items-start gap-4">
            <span className="text-5xl">{emoji}</span>
            <div className="flex-1 min-w-0">
              <h1 className="font-heading text-2xl font-bold text-foreground leading-tight">{recipe.name}</h1>
              {recipe.description && (
                <p className="text-muted-foreground text-sm mt-2 leading-relaxed">{recipe.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            {recipe.cuisine && (
              <span className="bg-brand-subtle text-brand rounded-full px-3 py-1 text-xs font-medium capitalize">{recipe.cuisine}</span>
            )}
            {recipe.cook_time_minutes && (
              <span className="flex items-center gap-1 text-muted-foreground text-sm">
                <Clock className="w-3.5 h-3.5" /> {recipe.cook_time_minutes} min
              </span>
            )}
            {recipe.servings && (
              <span className="flex items-center gap-1 text-muted-foreground text-sm">
                <Users className="w-3.5 h-3.5" /> {recipe.servings} servings
              </span>
            )}
            {recipe.difficulty && (
              <span className="flex items-center gap-0.5 text-muted-foreground text-sm" title={['Easy', 'Medium', 'Hard'][recipe.difficulty - 1]}>
                {Array.from({ length: recipe.difficulty }, (_, i) => <span key={i}>🔪</span>)}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="px-4 pt-6">
        {/* ── Ingredients ──────────────────────────────────────────── */}
        {grouped.length > 0 && (
          <div className="mb-6">
            <h2 className="font-heading font-bold text-foreground text-lg mb-3">Ingredients</h2>
            <div className="space-y-3">
              {grouped.map(({ category, items }) => (
                <div key={category} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  <div className="px-4 py-2 bg-sage-subtle border-b border-sage/15">
                    <h3 className="text-xs font-semibold text-sage uppercase tracking-wide flex items-center gap-1.5">
                      <span>{CATEGORY_EMOJI[category] ?? '📦'}</span> {category}
                    </h3>
                  </div>
                  <ul className="divide-y divide-border/50">
                    {items.map(ing => (
                      <li key={ing.id} className="px-4 py-2.5 flex items-center justify-between">
                        <span className="text-foreground text-sm">{ing.name}</span>
                        {(ing.quantity || ing.unit) && (
                          <span className="text-muted-foreground text-sm font-medium">
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

        {/* ── Instructions ─────────────────────────────────────────── */}
        {recipe.instructions && (
          <div className="mb-6">
            <h2 className="font-heading font-bold text-foreground text-lg mb-3">Instructions</h2>
            <InstructionSteps
              steps={recipe.instruction_steps as InstructionStep[] | null}
              rawInstructions={recipe.instructions}
              ingredients={recipe.ingredients}
            />
          </div>
        )}

        {/* ── Tags ─────────────────────────────────────────────────── */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {recipe.tags.map(tag => (
              <span key={tag} className="bg-brand-subtle text-brand rounded-full px-3 py-1 text-sm font-medium">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* ── Non-interactive branding footer ──────────────────────── */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Shared with <span className="font-semibold text-brand">Preptable</span>
        </p>
      </div>
    </div>
  )
}
