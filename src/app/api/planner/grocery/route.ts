import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Normalize unit to a standard for combining
function normalizeUnit(unit: string | null): string {
  if (!unit) return ''
  const u = unit.toLowerCase().trim()
  const map: Record<string, string> = {
    'tbsp': 'tbsp', 'tablespoon': 'tbsp', 'tablespoons': 'tbsp',
    'tsp': 'tsp', 'teaspoon': 'tsp', 'teaspoons': 'tsp',
    'cup': 'cup', 'cups': 'cup',
    'oz': 'oz', 'ounce': 'oz', 'ounces': 'oz',
    'lb': 'lb', 'pound': 'lb', 'pounds': 'lb',
    'g': 'g', 'gram': 'g', 'grams': 'g',
    'kg': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
    'ml': 'ml', 'milliliter': 'ml', 'milliliters': 'ml',
    'l': 'l', 'liter': 'l', 'liters': 'l',
    'clove': 'clove', 'cloves': 'clove',
  }
  return map[u] || u
}

function parseQuantity(qty: string | null): number {
  if (!qty) return 0
  const cleaned = qty.trim()
  // Handle fractions like "1/2", "3/4"
  const fracMatch = cleaned.match(/^(\d+)\/(\d+)$/)
  if (fracMatch) return parseInt(fracMatch[1]) / parseInt(fracMatch[2])
  // Handle mixed numbers like "1 1/2"
  const mixedMatch = cleaned.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixedMatch) return parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3])
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const weekStart = request.nextUrl.searchParams.get('week_start')
    if (!weekStart) return NextResponse.json({ error: 'week_start required' }, { status: 400 })

    // Get the week's plan with all recipes and their ingredients
    const { data: plan } = await supabase
      .from('weekly_plans')
      .select('id, weekly_plan_slots(recipe_id, day_of_week, meal_type, recipe:recipes(name, servings, ingredients(*)))')
      .eq('user_id', user.id)
      .eq('week_start', weekStart)
      .maybeSingle()

    if (!plan) {
      return NextResponse.json({ grouped: {}, items: [] })
    }

    // Aggregate ingredients
    const ingredientMap = new Map<string, {
      name: string
      quantity: number
      unit: string
      category: string
      recipes: string[]
      displayQty: string
    }>()

    const slots = ((plan as any).weekly_plan_slots as any[]) || []
    for (const slot of slots) {
      const recipe = slot.recipe
      if (!recipe) continue
      const ingredients = recipe.ingredients || []

      for (const ing of ingredients) {
        const unit = normalizeUnit(ing.unit)
        const key = `${ing.name.toLowerCase().trim()}::${unit}`
        const qty = parseQuantity(ing.quantity)

        if (ingredientMap.has(key)) {
          const existing = ingredientMap.get(key)!
          existing.quantity += qty
          if (!existing.recipes.includes(recipe.name)) {
            existing.recipes.push(recipe.name)
          }
        } else {
          ingredientMap.set(key, {
            name: ing.name,
            quantity: qty,
            unit,
            category: ing.category || 'other',
            recipes: [recipe.name],
            displayQty: '',
          })
        }
      }
    }

    // Format quantities for display
    const items = Array.from(ingredientMap.values()).map(item => {
      let displayQty = ''
      if (item.quantity > 0) {
        // Format nicely: whole numbers as int, decimals as fractions
        const qty = item.quantity
        if (qty === Math.floor(qty)) {
          displayQty = qty.toString()
        } else if (Math.abs(qty - 0.25) < 0.01) displayQty = '¼'
        else if (Math.abs(qty - 0.5) < 0.01) displayQty = '½'
        else if (Math.abs(qty - 0.75) < 0.01) displayQty = '¾'
        else if (Math.abs(qty - 1.5) < 0.01) displayQty = '1½'
        else if (Math.abs(qty - 2.5) < 0.01) displayQty = '2½'
        else displayQty = qty.toFixed(1).replace(/\.0$/, '')
      }
      return { ...item, displayQty }
    })

    // Group by category
    const categoryOrder = ['produce', 'meat', 'seafood', 'dairy', 'bakery', 'pantry', 'spices', 'frozen', 'other']
    const grouped: Record<string, typeof items> = {}
    for (const cat of categoryOrder) {
      const catItems = items.filter(i => i.category === cat)
      if (catItems.length > 0) {
        grouped[cat] = catItems.sort((a, b) => a.name.localeCompare(b.name))
      }
    }
    // Any uncategorized
    const knownCats = new Set(categoryOrder)
    const other = items.filter(i => !knownCats.has(i.category))
    if (other.length > 0) {
      grouped['other'] = [...(grouped['other'] || []), ...other].sort((a, b) => a.name.localeCompare(b.name))
    }

    return NextResponse.json({ grouped, items })
  } catch (error) {
    console.error('Grocery error:', error)
    return NextResponse.json({ error: 'Failed to generate grocery list' }, { status: 500 })
  }
}
