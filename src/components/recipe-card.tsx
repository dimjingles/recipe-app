'use client'

import { ReactNode, CSSProperties } from 'react'
import { Clock, ImageIcon } from 'lucide-react'
import { getCuisineEmoji } from '@/lib/cuisine-emoji'
import { cn } from '@/lib/utils'

export interface RecipeCardRecipe {
  id: string
  name: string
  cuisine?: string | null
  tags?: string[] | null
  image_url?: string | null
  rank?: number | null
  cook_time_minutes?: number | null
}

interface RecipeCardProps {
  recipe: RecipeCardRecipe
  variant: 'grid' | 'list'
  onClick?: () => void
  action?: ReactNode
  style?: CSSProperties
  className?: string
}

export function RecipeCard({
  recipe,
  variant,
  onClick,
  action,
  style,
  className,
}: RecipeCardProps) {
  const emoji = getCuisineEmoji(recipe.cuisine)

  if (variant === 'list') {
    return (
      <div
        className={cn(
          'group flex cursor-pointer items-center gap-3 rounded-3xl border border-border bg-card px-4 py-3 shadow-card',
          'transition-all hover:-translate-y-0.5 hover:shadow-card-hover active:scale-[0.98]',
          className,
        )}
        onClick={onClick}
        style={style}
      >
        {recipe.rank != null && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-subtle text-xs font-bold text-brand ring-1 ring-brand/15">
            {recipe.rank}
          </span>
        )}

        {recipe.image_url ? (
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
            <img
              src={recipe.image_url}
              alt={recipe.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        ) : (
          <div className="food-placeholder grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-border/70">
            <span className="text-2xl" aria-hidden>{emoji}</span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-bold leading-snug text-foreground">
            {recipe.name}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
            {recipe.cuisine && <span className="capitalize">{recipe.cuisine}</span>}
            {recipe.cook_time_minutes ? (
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" /> {recipe.cook_time_minutes}m
              </span>
            ) : null}
          </div>
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group cursor-pointer overflow-hidden rounded-3xl border border-border bg-card shadow-card',
        'transition-all hover:-translate-y-0.5 hover:shadow-card-hover active:scale-[0.97]',
        className,
      )}
      onClick={onClick}
      style={style}
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
        <div className="food-placeholder relative aspect-[4/3] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent" />
          <div className="relative grid h-full place-items-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-card/80 shadow-sm ring-1 ring-border">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2 p-4">
        <p className="line-clamp-2 text-sm font-bold leading-snug text-foreground">
          {recipe.name}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
          {recipe.cuisine && <span className="capitalize">{recipe.cuisine}</span>}
          {recipe.cook_time_minutes ? (
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" /> {recipe.cook_time_minutes}m
            </span>
          ) : null}
        </div>
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recipe.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {action && <div className="px-4 pb-4 -mt-1">{action}</div>}
    </div>
  )
}
