import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRecipes } from '@/lib/db/recipes'
import { getWeekPlan, getWeekStart } from '@/lib/db/planner'
import { getProfile } from '@/lib/db/profile'
import Link from 'next/link'
import { ChefHat, CalendarDays, Clock, Plus, LogOut } from 'lucide-react'
import { format, addDays } from 'date-fns'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const CUISINE_EMOJI: Record<string, string> = {
  italian: '🍝', japanese: '🍜', chinese: '🥢', mexican: '🌮', indian: '🍛',
  thai: '🌶️', french: '🥐', american: '🍔', mediterranean: '🫒', korean: '🍱',
  vietnamese: '🍲', greek: '🥗', spanish: '🥘', middle_eastern: '🧆',
}

function getCuisineEmoji(cuisine: string | null) {
  if (!cuisine) return '🍽️'
  return CUISINE_EMOJI[cuisine.toLowerCase()] ?? '🍽️'
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Gate: send new users to onboarding
  if (user) {
    const profile = await getProfile()
    if (!profile?.onboarding_completed) {
      redirect('/onboarding')
    }
  }

  const weekStart = getWeekStart()
  const [recipes, plan] = await Promise.all([
    getRecipes(),
    getWeekPlan(weekStart),
  ])

  const recentRecipes = recipes.slice(0, 6)
  const slots = plan?.weekly_plan_slots ?? []

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(weekStart + 'T00:00:00'), i)
    const slot = slots.find(s => s.day_of_week === i)
    return { day: DAYS[i], date, slot }
  })

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-orange-500" />
            <h1 className="text-2xl font-bold text-gray-900">Mise en Place</h1>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(new Date(), 'EEEE, MMMM d')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              title="Sign out"
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all"
            >
              <LogOut className="w-4 h-4 text-gray-500" />
            </button>
          </form>
          <Link
            href="/recipes/new"
            className="bg-orange-500 text-white rounded-full p-3 shadow-md hover:bg-orange-600 active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* This week's plan */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-orange-500" />
            This Week
          </h2>
          <Link href="/planner" className="text-sm text-orange-500 font-medium">
            Edit plan →
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(({ day, date, slot }) => {
            const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
            return (
              <div key={day} className="text-center">
                <p className={`text-xs font-medium mb-1 ${isToday ? 'text-orange-500' : 'text-gray-400'}`}>{day}</p>
                <div className={`rounded-lg h-14 flex items-center justify-center text-center p-1 ${
                  isToday ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'
                }`}>
                  {slot?.recipe ? (
                    <p className="text-xs text-gray-700 leading-tight line-clamp-3 font-medium">
                      {getCuisineEmoji((slot.recipe as any).cuisine)} {(slot.recipe as any).name}
                    </p>
                  ) : (
                    <Link href="/planner" className="text-gray-300 hover:text-orange-400 text-lg">+</Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {slots.length > 0 && (
          <Link
            href="/planner/grocery"
            className="mt-3 flex items-center justify-center gap-2 w-full bg-orange-50 hover:bg-orange-100 text-orange-600 font-medium text-sm rounded-xl py-2.5 transition-colors"
          >
            🛒 View grocery list
          </Link>
        )}
      </div>

      {/* Recent recipes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">My Recipes</h2>
          <Link href="/recipes" className="text-sm text-orange-500 font-medium">
            See all →
          </Link>
        </div>
        {recentRecipes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
            <div className="text-4xl mb-3">🧑‍🍳</div>
            <p className="text-gray-500 mb-4">No recipes yet. Add your first one!</p>
            <Link
              href="/recipes/new"
              className="inline-flex items-center gap-2 bg-orange-500 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add recipe
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {recentRecipes.map(recipe => (
              <Link
                key={recipe.id}
                href={`/recipes/${recipe.id}`}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md active:scale-98 transition-all"
              >
                <div className="text-3xl mb-2">{getCuisineEmoji(recipe.cuisine)}</div>
                <p className="font-semibold text-gray-900 text-sm line-clamp-2 leading-tight">{recipe.name}</p>
                {recipe.cuisine && (
                  <p className="text-xs text-gray-400 mt-1 capitalize">{recipe.cuisine}</p>
                )}
                <div className="flex items-center gap-1 mt-2">
                  {recipe.cook_time_minutes && (
                    <span className="text-xs text-gray-400 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" /> {recipe.cook_time_minutes}m
                    </span>
                  )}
                  {recipe.cooked_count > 0 && (
                    <span className="text-xs text-gray-400 ml-auto">🍳 ×{recipe.cooked_count}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
