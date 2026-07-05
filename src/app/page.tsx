import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRecipes } from '@/lib/db/recipes'
import { getWeekPlan, getWeekStart } from '@/lib/db/planner'
import { getProfile } from '@/lib/db/profile'
import Link from 'next/link'
import { ChefHat, CalendarDays, Clock, Plus, LogOut } from 'lucide-react'
import { format, addDays } from 'date-fns'
import { getCuisineEmoji } from '@/lib/cuisine-emoji'
import { EmptyState, RecipeBookIllustration } from '@/components/ui/empty-state'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

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
            <ChefHat className="w-6 h-6 text-brand" />
            <h1 className="font-heading text-2xl font-bold text-foreground">Mise en Place</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), 'EEEE, MMMM d')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              title="Sign out"
              className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-border active:scale-[0.95] transition-all"
            >
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </button>
          </form>
          <Link
            href="/recipes/new"
            className="bg-brand text-brand-foreground rounded-full p-3 shadow-md hover:bg-brand/90 active:scale-[0.95] transition-all"
          >
            <Plus className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* This week's plan */}
      <div className="bg-card rounded-2xl shadow-sm border border-border p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-brand" />
            This Week
          </h2>
          <Link href="/planner" className="text-sm text-brand font-medium">
            Edit plan →
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(({ day, date, slot }) => {
            const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
            return (
              <div key={day} className="text-center">
                <p className={`text-xs font-medium mb-1 ${isToday ? 'text-brand' : 'text-muted-foreground'}`}>{day}</p>
                <div className={`rounded-lg h-14 flex items-center justify-center text-center p-1 ${
                  isToday ? 'bg-brand-subtle border border-brand/30' : 'bg-muted'
                }`}>
                  {slot?.recipe ? (
                    <p className="text-xs text-foreground leading-tight line-clamp-3 font-medium">
                      {getCuisineEmoji((slot.recipe as any).cuisine)} {(slot.recipe as any).name}
                    </p>
                  ) : (
                    <Link href="/planner" className="text-muted-foreground hover:text-brand text-lg transition-colors">+</Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {slots.length > 0 && (
          <Link
            href="/planner/grocery"
            className="mt-3 flex items-center justify-center gap-2 w-full bg-brand-subtle hover:bg-brand/20 text-brand font-medium text-sm rounded-xl py-2.5 transition-colors"
          >
            🛒 View grocery list
          </Link>
        )}
      </div>

      {/* Recent recipes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-semibold text-foreground">My Recipes</h2>
          <Link href="/recipes" className="text-sm text-brand font-medium">
            See all →
          </Link>
        </div>
        {recentRecipes.length === 0 ? (
          <EmptyState
            illustration={<RecipeBookIllustration />}
            title="No recipes yet"
            description="Add your first one to get started!"
            variant="dashed"
            action={
              <Link
                href="/recipes/new"
                className="inline-flex items-center gap-2 bg-brand text-brand-foreground rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-brand/90 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add recipe
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {recentRecipes.map((recipe, i) => (
              <Link
                key={recipe.id}
                href={`/recipes/${recipe.id}`}
                className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden hover:shadow-md active:scale-[0.97] transition-all"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {/* Square image or emoji */}
                {recipe.image_url ? (
                  <div className="aspect-square overflow-hidden">
                    <img
                      src={recipe.image_url}
                      alt={recipe.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-square flex items-center justify-center bg-brand-subtle">
                    <span className="text-4xl">{getCuisineEmoji(recipe.cuisine)}</span>
                  </div>
                )}
                <div className="p-3">
                  <p className="font-semibold text-foreground text-sm line-clamp-2 leading-tight">{recipe.name}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {recipe.cuisine && (
                      <span className="text-xs text-muted-foreground capitalize">{recipe.cuisine}</span>
                    )}
                    {recipe.cook_time_minutes && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Clock className="w-3 h-3" /> {recipe.cook_time_minutes}m
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
