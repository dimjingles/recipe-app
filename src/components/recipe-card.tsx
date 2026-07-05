'use client'

import { ReactNode, CSSProperties } from 'react'
import { getCuisineEmoji } from '@/lib/cuisine-emoji'
import { cn } from '@/lib/utils'

export interface RecipeCardRecipe {
  id: string
  name: string
  cuisine?: string | null
  tags?: string[] | null
  image_url?: string | null
  rank?: number | null
}

interface RecipeCardProps {
  recipe: RecipeCardRecipe
  /** 'list' = horizontal row (ranked list); 'grid' = square card (grid) */
  variant: 'grid' | 'list'
  onClick?: () => void
  /** Slot rendered at the trailing edge (list) or below text (grid) */
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

  /* ── List (horizontal row) ─────────────────────────────────────────── */
  if (variant === 'list') {
    return (
      <div
        className={cn(
          'flex items-center gap-3 bg-card rounded-2xl border border-border shadow-sm px-4 py-3',
          'hover:shadow-md active:scale-[0.98] transition-all cursor-pointer',
          className,
        )}
        onClick={onClick}
        style={style}
      >
        {/* Rank badge */}
        {recipe.rank != null && (
          <span className="shrink-0 text-xs font-bold text-brand bg-brand-subtle rounded-full w-7 h-7 flex items-center justify-center">
            {recipe.rank}
          </span>
        )}

        {/* Thumbnail — 48×48 (was tiny 40×40) */}
        {recipe.image_url ? (
          <div className="shrink-0 w-12 h-12 rounded-xl overflow-hidden">
            <img
              src={recipe.image_url}
              alt={recipe.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <span className="shrink-0 w-12 text-center text-2xl leading-none">{emoji}</span>
        )}

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground text-sm leading-snug truncate">
            {recipe.name}
          </p>
          {recipe.cuisine && (
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{recipe.cuisine}</p>
          )}
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>
    )
  }

  /* ── Grid (square card) ────────────────────────────────────────────── */
  return (
    <div
      className={cn(
        'bg-card rounded-2xl border border-border shadow-sm overflow-hidden',
        'hover:shadow-md active:scale-[0.97] transition-all cursor-pointer',
        className,
      )}
      onClick={onClick}
      style={style}
    >
      {/* Square image or emoji block */}
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
          <span className="text-4xl">{emoji}</span>
        </div>
      )}

      {/* Text + tags */}
      <div className="p-3">
        <p className="font-medium text-foreground text-sm leading-snug line-clamp-2">
          {recipe.name}
        </p>
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {recipe.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {action && <div className="px-3 pb-3 -mt-1">{action}</div>}
    </div>
  )
}
