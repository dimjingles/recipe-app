import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { getRecipes } from '@/lib/db/recipes'
import { getWeekPlan, getWeekStart } from '@/lib/db/planner'
import { getProfile } from '@/lib/db/profile'
import { getFeed } from '@/lib/db/activity'
import Link from 'next/link'
import { ChefHat, CalendarDays, Clock, Plus, ShoppingCart, Sparkles, Users } from 'lucide-react'
import { format, addDays } from 'date-fns'
import { getCuisineEmoji } from '@/lib/cuisine-emoji'
import { AddRecipeLauncher } from '@/components/add-recipe-sheet'
import { EmptyState, RecipeBookIllustration } from '@/components/ui/empty-state'
import { FeedItemRow } from '@/components/feed-item'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default async function HomePage() {
  const user = await getUser()
  const weekStart = getWeekStart()

  // Fetch everything the page needs in one parallel batch. profile is only used
  // for the onboarding gate + avatar, and the data queries don't depend on it,
  // so overlapping it with them saves a full sequential round-trip (~90ms).
  const [profile, recipes, plan, feed] = await Promise.all([
    user ? getProfile() : Promise.resolve(null),
    getRecipes(),
    getWeekPlan(weekStart),
    getFeed(undefined, 5),
  ])

  if (user && !profile?.onboarding_completed) {
    redirect('/onboarding')
  }

  const recentRecipes = recipes.slice(0, 6)
  const slots = plan?.weekly_plan_slots ?? []
  const plannedCount = slots.length
  const todayIndex = Math.max(0, Math.min(6, Math.floor((new Date().getDay() + 6) % 7)))
  const tonightSlot = slots.find(s => s.day_of_week === todayIndex)

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(weekStart + 'T00:00:00'), i)
    const slot = slots.find(s => s.day_of_week === i)
    return { day: DAYS[i], date, slot }
  })

  return (
    <div className="mx-auto max-w-6xl px-5 pt-8 pb-4 md:px-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-foreground">
          <ChefHat className="h-8 w-8 text-brand" />
          <h1 className="font-heading text-4xl font-bold tracking-tight">PrepTable</h1>
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          {format(new Date(), 'EEEE, MMMM d')}
        </p>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_360px] lg:items-start">
      <section className="surface-gradient overflow-hidden rounded-2xl border border-white/70 p-5 shadow-card md:p-7">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand">Tonight</p>
            {tonightSlot?.recipe ? (
              <>
                <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground">
                  {(tonightSlot.recipe as any).name}
                </h2>
                <p className="mt-2 text-sm font-medium capitalize text-muted-foreground">
                  {(tonightSlot.recipe as any).cuisine || 'Dinner is planned'}
                </p>
              </>
            ) : (
              <>
                <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground">
                  Plan tonight's dinner
                </h2>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  Pick a recipe now and your grocery list stays useful.
                </p>
              </>
            )}
          </div>
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-card/70 p-3 shadow-sm ring-[10px] ring-white/70">
            <span className="text-4xl">
              {tonightSlot?.recipe ? getCuisineEmoji((tonightSlot.recipe as any).cuisine) : '🍽️'}
            </span>
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <Link
            href="/planner"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-bold text-background shadow-sm transition-all active:scale-[0.97]"
          >
            <CalendarDays className="h-4 w-4" /> Plan week
          </Link>
          <AddRecipeLauncher
            className="grid h-12 w-12 place-items-center rounded-xl bg-card text-foreground shadow-sm ring-1 ring-border transition-all active:scale-[0.95]"
            ariaLabel="Add recipe"
          >
            <Plus className="h-5 w-5" />
          </AddRecipeLauncher>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">This week</h2>
            <p className="text-sm text-muted-foreground">{plannedCount}/7 dinners planned</p>
          </div>
          {slots.length > 0 && (
            <Link
              href="/planner/grocery"
              className="inline-flex items-center gap-1.5 rounded-full bg-sage-subtle px-3 py-2 text-xs font-bold text-sage transition-colors hover:bg-sage-subtle/80"
            >
              <ShoppingCart className="h-3.5 w-3.5" /> Grocery
            </Link>
          )}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map(({ day, date, slot }) => {
            const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
            return (
              <Link key={day} href="/planner" className="group text-center">
                <p className={`mb-1 text-[11px] font-bold ${isToday ? 'text-brand' : 'text-muted-foreground'}`}>{day}</p>
                <div className={`grid h-14 place-items-center rounded-xl border transition-all group-active:scale-[0.96] ${
                  isToday ? 'border-brand/30 bg-brand-subtle text-brand' : slot ? 'border-sage/20 bg-sage-subtle text-sage' : 'border-border bg-muted/60 text-muted-foreground'
                }`}>
                  <span className="text-sm font-bold">{slot?.recipe ? getCuisineEmoji((slot.recipe as any).cuisine) : format(date, 'd')}</span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
      </div>

      {feed.items.length > 0 && (
        <section className="mb-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-brand">
                <Users className="h-3.5 w-3.5" /> Friends
              </p>
              <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">Activity</h2>
            </div>
            <Link href="/feed" className="text-sm font-bold uppercase tracking-wide text-brand">
              See all →
            </Link>
          </div>
          <div className="space-y-2">
            {feed.items.map(item => <FeedItemRow key={item.id} item={item} />)}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-brand">
              <Sparkles className="h-3.5 w-3.5" /> Library
            </p>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">My recipes</h2>
          </div>
          <Link href="/recipes" className="text-sm font-bold uppercase tracking-wide text-brand">
            View all
          </Link>
        </div>
        {recentRecipes.length === 0 ? (
          <EmptyState
            illustration={<RecipeBookIllustration />}
            title="No recipes yet"
            description="Add your first one and PrepTable will help fill in the details."
            variant="dashed"
            action={
              <Link
                href="/recipes/new"
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
              >
                <Plus className="h-4 w-4" /> Add recipe
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {recentRecipes.map((recipe, i) => (
              <Link
                key={recipe.id}
                href={`/recipes/${recipe.id}`}
                className="group overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover active:scale-[0.97]"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {recipe.image_url ? (
                  <div className="aspect-[4/3] overflow-hidden bg-muted">
                    <img
                      src={recipe.image_url}
                      alt={recipe.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="food-placeholder grid aspect-[4/3] place-items-center">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-card/80 text-2xl shadow-sm">
                      {getCuisineEmoji(recipe.cuisine)}
                    </span>
                  </div>
                )}
                <div className="p-4">
                  <p className="line-clamp-2 text-sm font-bold leading-snug text-foreground">{recipe.name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                    {recipe.cuisine && <span className="capitalize">{recipe.cuisine}</span>}
                    {recipe.cook_time_minutes && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" /> {recipe.cook_time_minutes}m
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
